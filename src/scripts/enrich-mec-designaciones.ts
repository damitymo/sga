/**
 * Enriquece las assignments importadas por `import-mec-designaciones.ts`
 * con los detalles que NO trae el listado: plaza específica (pof_position_id),
 * fecha hasta real, motivo de ingreso/cese, modo de designación.
 *
 * Lee `imports/mec-fds-detalles-full.json` (descargado con script Console
 * desde DevTools del MEC). Para cada FD:
 *   - Parsea HTML de DetallePlazas → extrae plaza_number + asignatura.
 *   - Parsea HTML de Detalle → extrae Toma, Hasta, Motivo Ingreso, Modo Desig.
 *   - Hace match con pof_positions por plaza_number → pof_position_id real.
 *   - UPDATE en agent_assignments del FD: pof_position_id, end_date, notes.
 *
 * Idempotente: solo actualiza assignments que ya existen y tienen
 * resolution_number = "FD-XXXXX/YY". No toca prestaciones con plaza
 * vinculada que ya estén bien (matchadas por NLD).
 *
 * Uso:
 *   npm run enrich:mec-designaciones                # dry-run
 *   npm run enrich:mec-designaciones -- --commit    # aplica
 *   npm run enrich:mec-designaciones -- archivo.json --commit
 *
 * Default file: imports/mec-fds-detalles-full.json
 */

import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../app.module';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

type FdListItem = {
  formularioDesignacionId?: number;
  asuntoConMascara?: string;
  ingresoPersonaNroDocumento?: string;
};

type DetalleEntry = {
  detalle: string; // HTML del endpoint /Designacion/Formulario/Detalle/{id}
  plazas: string; // HTML del endpoint /Designacion/Formulario/DetallePlazas/{id}
};

type InputJson = {
  fds: FdListItem[];
  details: Record<string, DetalleEntry>;
};

// ---------- parsers HTML ----------

/**
 * Extrae el valor que sigue a un <label for="X"> en el HTML del Detalle.
 * El HTML tiene estructura:
 *   <label for="LABEL_ID">...</label>
 *   <div class="form-control">
 *     VALOR
 *   </div>
 */
function extractFormField(html: string, labelFor: string): string | null {
  // Escapamos puntos y guiones del id
  const safe = labelFor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<label[^>]*for="${safe}"[^>]*>[\\s\\S]*?</label>\\s*<div[^>]*class="form-control"[^>]*>([\\s\\S]*?)</div>`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').trim() || null;
}

function parseDetalle(html: string): {
  fecha: string | null;
  asunto: string | null;
  normaLegal: string | null;
  agente: string | null;
  modoDesignacion: string | null;
  motivoIngreso: string | null;
  tomaPosesion: string | null;
  hasta: string | null;
} {
  return {
    fecha: extractFormField(html, 'Fecha'),
    asunto: extractFormField(html, 'Asunto_N_'),
    normaLegal: extractFormField(html, 'Norma_Legal'),
    agente: extractFormField(html, 'Agente_propuesto_a'),
    modoDesignacion: extractFormField(html, 'Modo_de_Designaci_n'),
    motivoIngreso: extractFormField(html, 'Motivo_de__ngreso'),
    tomaPosesion: extractFormField(html, 'Toma_de_Posesi_n'),
    hasta: extractFormField(html, 'Hasta'),
  };
}

/**
 * Extrae las filas <tr> de la tabla de Plazas. Devuelve cada plaza con sus
 * 6 campos: Plaza, Asignatura/Función, Año, División, Turno, Horas.
 */
function parsePlazas(
  html: string,
): Array<{
  plaza: string;
  asignatura: string;
  anio: string;
  division: string;
  turno: string;
  horas: string;
}> {
  const rows: Array<{
    plaza: string;
    asignatura: string;
    anio: string;
    division: string;
    turno: string;
    horas: string;
  }> = [];

  // Encontramos el <tbody>...</tbody>
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return rows;

  const tbody = tbodyMatch[1];
  const trRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(tbody)) !== null) {
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (tds.length >= 6) {
      rows.push({
        plaza: tds[0] || '',
        asignatura: tds[1] || '',
        anio: tds[2] || '',
        division: tds[3] || '',
        turno: tds[4] || '',
        horas: tds[5] || '',
      });
    }
  }
  return rows;
}

function parseDdMmYyyy(s: string | null): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const createMissingPlazas = args.includes('--create-missing-plazas');
  // CUE de las plazas que vienen en el JSON (default: sede principal).
  const cueArg = args.find((a) => a.startsWith('--cue='));
  const cueDefault = cueArg ? cueArg.split('=')[1] : '1800697-00';
  const fileArg = args.find(
    (a) => !a.startsWith('--') && /\.json$/i.test(a),
  );
  const filePath = fileArg
    ? path.isAbsolute(fileArg)
      ? fileArg
      : path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'imports/mec-fds-detalles-full.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No existe: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Archivo: ${filePath}`);
  console.log(
    `⚙️  Modo: ${commit ? '🔴 COMMIT (escribe en DB)' : '🟢 DRY-RUN'}`,
  );
  console.log(`🏛️  CUE de las plazas: ${cueDefault}`);
  if (createMissingPlazas) {
    console.log(
      `🆕 --create-missing-plazas: crea PofPosition stub si la plaza no existe`,
    );
  }

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as InputJson;
  const fds = json.fds ?? [];
  const details = json.details ?? {};
  console.log(
    `📊 FDs en lista: ${fds.length} · Detalles disponibles: ${Object.keys(details).length}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const pofRepo = app.get<Repository<PofPosition>>(
    getRepositoryToken(PofPosition),
  );
  const assignRepo = app.get<Repository<AgentAssignment>>(
    getRepositoryToken(AgentAssignment),
  );

  // Cache de plazas. La key principal es (plaza_number, establecimiento_cue),
  // pero también guardamos un fallback solo por plaza_number para compat
  // con assignments viejas que no tengan CUE.
  const allPofs = await pofRepo.find();
  const pofByNumberCue = new Map<string, PofPosition>();
  const pofByNumberOnly = new Map<string, PofPosition>();
  for (const p of allPofs) {
    if (p.plaza_number) {
      pofByNumberCue.set(
        `${p.plaza_number}|${p.establecimiento_cue ?? cueDefault}`,
        p,
      );
      // Solo agregamos al mapa "solo por número" si no hay colisión, para
      // evitar ambigüedad. En caso de colisión, el match tiene que pasar
      // por (number, cue).
      if (!pofByNumberOnly.has(p.plaza_number)) {
        pofByNumberOnly.set(p.plaza_number, p);
      }
    }
  }
  console.log(`🏛️  Plazas en pof_positions: ${allPofs.length}`);

  let processed = 0;
  let updated = 0;
  let noDetail = 0;
  let noAssignment = 0;
  let noPlazaInDetail = 0;
  let plazaNotInPof = 0;
  const sample: string[] = [];
  const missingPlazas = new Set<string>();

  for (const fd of fds) {
    processed++;
    const id = String(fd.formularioDesignacionId ?? '');
    const fdAsunto = (fd.asuntoConMascara || '').trim();
    if (!id || !fdAsunto) continue;

    const entry = details[id];
    if (!entry) {
      noDetail++;
      continue;
    }

    // Buscar la assignment correspondiente (importada por import-mec-designaciones)
    const assignment = await assignRepo.findOne({
      where: { resolution_number: fdAsunto },
    });
    if (!assignment) {
      // Puede ser que ya esté representada por una prestación (saltada por
      // matching de NLD), en cuyo caso no hay nada que enriquecer.
      noAssignment++;
      continue;
    }

    const detalleParsed = parseDetalle(entry.detalle || '');
    const plazasParsed = parsePlazas(entry.plazas || '');

    if (plazasParsed.length === 0) {
      noPlazaInDetail++;
      continue;
    }

    // Tomamos la primera plaza (en general es 1 sola por FD)
    const firstPlaza = plazasParsed[0];
    const plazaNumber = firstPlaza.plaza.trim();
    // Match: primero (plaza_number, cueDefault), luego solo por plaza_number.
    let pof =
      pofByNumberCue.get(`${plazaNumber}|${cueDefault}`) ||
      pofByNumberOnly.get(plazaNumber);

    if (!pof) {
      if (!createMissingPlazas) {
        plazaNotInPof++;
        missingPlazas.add(plazaNumber);
        continue;
      }
      // Crear stub de PofPosition con datos del FD
      const stub = pofRepo.create({
        plaza_number: plazaNumber,
        establecimiento_cue: cueDefault,
        subject_name: firstPlaza.asignatura || null,
        modality: firstPlaza.asignatura || null,
        course: firstPlaza.anio || null,
        division: firstPlaza.division || null,
        shift: firstPlaza.turno || null,
        hours_count: firstPlaza.horas
          ? Number(firstPlaza.horas) || null
          : null,
        is_active: false, // las que no están en POF actual son desafectadas
        notes: 'Plaza creada por enrich-mec-designaciones (no estaba en POF actual). Verificar.',
      });
      if (commit) {
        pof = await pofRepo.save(stub);
      } else {
        pof = { ...stub, id: -1 } as PofPosition;
      }
      pofByNumberCue.set(`${plazaNumber}|${cueDefault}`, pof);
      if (!pofByNumberOnly.has(plazaNumber)) pofByNumberOnly.set(plazaNumber, pof);
      missingPlazas.add(plazaNumber); // tracking igual
    }

    // Construir el update
    const hastaIso = parseDdMmYyyy(detalleParsed.hasta);
    const tomaIso = parseDdMmYyyy(detalleParsed.tomaPosesion);

    const newNotes = [
      assignment.notes,
      detalleParsed.motivoIngreso
        ? `Motivo ingreso: ${detalleParsed.motivoIngreso}`
        : null,
      detalleParsed.modoDesignacion
        ? `Modo designación: ${detalleParsed.modoDesignacion}`
        : null,
      firstPlaza.asignatura ? `Plaza MEC: ${firstPlaza.asignatura}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    // Si tiene fecha hasta y ya pasó, FINALIZADA. Si no, ACTIVA.
    // Si no tiene fecha hasta, mantenemos el status actual.
    let newStatus = assignment.status;
    if (hastaIso) {
      newStatus = 'FINALIZADA';
    }

    const patch: Partial<AgentAssignment> = {
      pof_position_id: pof.id,
      end_date: hastaIso ? (hastaIso as unknown as Date) : null,
      assignment_date: tomaIso
        ? (tomaIso as unknown as Date)
        : assignment.assignment_date,
      status: newStatus,
      notes: newNotes || null,
    };

    if (commit) {
      await assignRepo.update({ id: assignment.id }, patch);
    }
    updated++;

    if (sample.length < 5 || /TYMOSZUK/i.test(detalleParsed.agente || '')) {
      sample.push(
        `  • ${fdAsunto} → plaza ${plazaNumber} ${firstPlaza.asignatura.slice(0, 40)} | toma=${tomaIso ?? '-'} hasta=${hastaIso ?? '-'} | ${newStatus}`,
      );
    }
  }

  await app.close();

  console.log('\n📈 Resultado:');
  console.log(`   FDs procesados:                 ${processed}`);
  console.log(`   Assignments enriquecidas:       ${updated}`);
  console.log(`   Sin detalle en JSON:            ${noDetail}`);
  console.log(`   Sin assignment en DB:           ${noAssignment} (probablemente saltados por NLD ya en POF)`);
  console.log(`   FD sin plaza en DetallePlazas:  ${noPlazaInDetail}`);
  console.log(`   Plaza no existe en pof_positions: ${plazaNotInPof}`);

  if (missingPlazas.size > 0) {
    console.log(`\n⚠️  Plazas faltantes en pof_positions:`);
    for (const p of Array.from(missingPlazas).slice(0, 30)) {
      console.log(`   · ${p}`);
    }
  }

  if (sample.length > 0) {
    console.log('\n🔎 Muestra:');
    console.log(sample.slice(0, 25).join('\n'));
  }

  if (!commit) {
    console.log(
      '\n⚠️  DRY-RUN. Para aplicar:\n   npm run enrich:mec-designaciones -- --commit',
    );
  } else {
    console.log('\n✅ Enrichment completado.');
  }
}

main().catch((err) => {
  console.error('❌ Error en enrich-mec-designaciones:', err);
  process.exit(1);
});
