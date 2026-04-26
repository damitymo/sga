/**
 * Import MEC histórico desde el JSON crudo de la API ge.mec.gob.ar.
 *
 * El reporte oficial .xls del MEC NO incluye las prestaciones cerradas
 * históricas (egresos viejos). En cambio, la API del frontend MEC
 * (/api/plaza?...) sí trae todas las prestaciones — incluyendo bajas y
 * suplencias completadas. El usuario captura ese JSON desde la consola del
 * navegador y este script lo procesa.
 *
 * Estrategia: idempotente a nivel plaza. Para cada plaza del JSON busca
 * la `pof_positions` correspondiente (debe existir, cargada antes con
 * `import-mec-pof.ts`), borra sus assignments y las recrea desde las
 * prestaciones del JSON. NO toca pof_positions ni agents (excepto crear
 * agentes nuevos por DNI cuando aparezca uno que no existe).
 *
 * Uso:
 *   npm run import:mec-historico              # dry-run, default imports/mec-plazas-full.json
 *   npm run import:mec-historico -- --commit  # aplica
 *   npm run import:mec-historico -- imports/foo.json --commit
 */

import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

// ---------- tipos del JSON MEC ----------

type MecPrestacion = {
  estaActiva?: boolean;
  tieneSalidaTransitoria?: boolean;
  tieneSalidaDefinitiva?: boolean;
  tieneLicencia?: boolean;
  prestacionFechaDesdeFormateada?: string; // DD/MM/YYYY
  prestacionFechaHastaFormateada?: string; // DD/MM/YYYY o ''
  prestacionId?: number;
  plazaId?: number;
  personaId?: number;
  personaApellido?: string;
  personaNombre?: string;
  nroDocumento?: string;
  situacionRevistaMnemo?: string; // T/I/S
  situacionRevistaDescripcion?: string;
  escalafon?: string;
  cargo?: string;
  motivoPrestacionIngresoDescripcion?: string;
  motivoPrestacionEgresoDescripcion?: string;
  designacionNormaLegal?: string | null; // "ME-R-07621/19"
  ceseNormaLegal?: string | null;
  licenciaNormaLegalAprobacion?: string | null;
};

type MecPlaza = {
  plazaIdentificacion?: string; // "20-006"
  identificadorDescripcionCompleto?: string;
  prestaciones?: MecPrestacion[];
};

type MecResponse = {
  aaData: MecPlaza[];
  iTotalRecords?: number;
};

// ---------- helpers ----------

function normName(v: string | undefined | null): string {
  if (!v) return '';
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseDdMmYyyy(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = String(s)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeCharacterType(mnemo: string | undefined | null): string | null {
  if (!mnemo) return null;
  const m = mnemo.trim().toUpperCase();
  if (m === 'T') return 'TITULAR';
  if (m === 'I') return 'INTERINO';
  if (m === 'S') return 'SUPLENTE';
  return mnemo.trim();
}

function placeholderDniFromName(apellido: string, nombre: string): string {
  const a = normName(apellido).replace(/[^A-Z0-9]/g, '');
  const n = normName(nombre).replace(/[^A-Z0-9]/g, '');
  return `MEC-${a}-${n}`.slice(0, 40);
}

function digitsOnly(s: string | undefined | null): string {
  return (s || '').replace(/\D/g, '');
}

// ---------- main ----------

type Stats = {
  plazas_en_json: number;
  plazas_matcheadas: number;
  plazas_sin_match: number;
  prestaciones_total: number;
  assignments_borradas: number;
  assignments_creadas: number;
  assignments_activas: number;
  assignments_finalizadas: number;
  agentes_creados: number;
  agentes_matcheados_por_dni: number;
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const filePath = fileArg
    ? path.isAbsolute(fileArg)
      ? fileArg
      : path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'imports/mec-plazas-full.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No existe el archivo: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Leyendo JSON MEC: ${filePath}`);
  console.log(
    `⚙️  Modo: ${commit ? '🔴 COMMIT (escribe en la DB)' : '🟢 DRY-RUN (no escribe nada)'}`,
  );

  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw) as MecResponse;
  const plazas = json.aaData ?? [];
  console.log(`📊 Plazas en JSON: ${plazas.length}`);

  const stats: Stats = {
    plazas_en_json: plazas.length,
    plazas_matcheadas: 0,
    plazas_sin_match: 0,
    prestaciones_total: 0,
    assignments_borradas: 0,
    assignments_creadas: 0,
    assignments_activas: 0,
    assignments_finalizadas: 0,
    agentes_creados: 0,
    agentes_matcheados_por_dni: 0,
  };

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const agentsRepo = app.get<Repository<Agent>>(getRepositoryToken(Agent));
  const pofRepo = app.get<Repository<PofPosition>>(
    getRepositoryToken(PofPosition),
  );
  const assignRepo = app.get<Repository<AgentAssignment>>(
    getRepositoryToken(AgentAssignment),
  );

  // Cache de agentes por DNI para no hacer 1000 queries
  const allAgents = await agentsRepo.find();
  const agentsByDni = new Map<string, Agent>();
  for (const a of allAgents) {
    if (a.dni) agentsByDni.set(a.dni, a);
  }
  console.log(`👥 Agentes en DB: ${allAgents.length}`);

  const sampleAssignments: string[] = [];
  const plazasSinMatch: string[] = [];

  for (const plaza of plazas) {
    const plazaNumber = (plaza.plazaIdentificacion || '').trim();
    if (!plazaNumber) continue;

    // Buscar pof_position
    const pof = await pofRepo.findOne({
      where: { plaza_number: plazaNumber },
    });

    if (!pof) {
      stats.plazas_sin_match++;
      plazasSinMatch.push(plazaNumber);
      continue;
    }
    stats.plazas_matcheadas++;

    // Borrar assignments existentes para esta plaza (van a recrearse del JSON)
    if (commit) {
      const del = await assignRepo.delete({ pof_position_id: pof.id });
      stats.assignments_borradas += del.affected ?? 0;
    }

    const prestaciones = plaza.prestaciones ?? [];
    stats.prestaciones_total += prestaciones.length;

    for (const pr of prestaciones) {
      const apellido = (pr.personaApellido || '').trim();
      const nombre = (pr.personaNombre || '').trim();
      const dni = digitsOnly(pr.nroDocumento);

      if (!apellido || !nombre) continue;

      // Match agente por DNI
      let agent: Agent | null = null;
      if (dni) {
        agent = agentsByDni.get(dni) ?? null;
      }

      if (agent) {
        stats.agentes_matcheados_por_dni++;
      } else {
        // Crear agente nuevo
        const fullDni = dni || placeholderDniFromName(apellido, nombre);
        const fullName = `${apellido}, ${nombre}`;
        const created = agentsRepo.create({
          full_name: fullName,
          last_name: apellido,
          first_name: nombre,
          dni: fullDni,
          is_active: true,
          notes:
            'Agente creado automáticamente por import-mec-historico. Verificar datos.',
        });

        if (commit) {
          agent = await agentsRepo.save(created);
        } else {
          agent = { ...created, id: -1 } as Agent;
        }

        agentsByDni.set(fullDni, agent);
        stats.agentes_creados++;
      }

      const ingreso = parseDdMmYyyy(pr.prestacionFechaDesdeFormateada);
      const egreso = parseDdMmYyyy(pr.prestacionFechaHastaFormateada);

      // El JSON del MEC marca "estaActiva" como fuente de verdad: hay
      // prestaciones con fecha de cese futura (proyectada) que siguen
      // ACTIVAS hoy. No alcanza con "tiene fecha hasta" → FINALIZADA.
      const status: 'ACTIVA' | 'FINALIZADA' =
        pr.estaActiva === false ? 'FINALIZADA' : 'ACTIVA';

      const notesParts = [
        pr.cargo ? `Cargo: ${pr.cargo}` : null,
        pr.motivoPrestacionIngresoDescripcion
          ? `Ingreso: ${pr.motivoPrestacionIngresoDescripcion}`
          : null,
        pr.motivoPrestacionEgresoDescripcion
          ? `Egreso: ${pr.motivoPrestacionEgresoDescripcion}`
          : null,
        pr.escalafon ? `Escalafón: ${pr.escalafon.trim()}` : null,
        pr.tieneLicencia ? 'Con licencia' : null,
        pr.tieneSalidaTransitoria ? 'Salida transitoria' : null,
        pr.tieneSalidaDefinitiva ? 'Salida definitiva' : null,
      ].filter(Boolean) as string[];

      // Normalizamos la NLD: viene tipo "ME-R-07621/19" con espacios al final.
      const designacionNld = (pr.designacionNormaLegal || '').trim() || null;
      const ceseNld = (pr.ceseNormaLegal || '').trim() || null;

      const payload: Partial<AgentAssignment> = {
        agent_id: agent.id,
        pof_position_id: pof.id,
        movement_type: 'DESIGNACION',
        character_type: normalizeCharacterType(pr.situacionRevistaMnemo),
        assignment_date: ingreso ? (ingreso as unknown as Date) : null,
        end_date: egreso ? (egreso as unknown as Date) : null,
        status,
        legal_norm: designacionNld,
        resolution_number: designacionNld,
        notes:
          [
            ...notesParts,
            ceseNld ? `NLD cese: ${ceseNld}` : null,
            pr.licenciaNormaLegalAprobacion
              ? `NLD licencia: ${pr.licenciaNormaLegalAprobacion}`
              : null,
          ]
            .filter(Boolean)
            .join(' | ') || null,
      };

      if (commit && pof.id > 0 && agent.id > 0) {
        await assignRepo.save(assignRepo.create(payload));
      }

      stats.assignments_creadas++;
      if (status === 'ACTIVA') stats.assignments_activas++;
      else stats.assignments_finalizadas++;

      // Muestra: TYMOSZUK + primeras 3
      if (
        /TYMOSZUK/.test(normName(apellido)) ||
        sampleAssignments.length < 3
      ) {
        sampleAssignments.push(
          `  • ${plazaNumber} → ${apellido} ${nombre} (DNI ${dni || '-'}) [${status}] ${ingreso ?? '-'} → ${egreso ?? '(continúa)'}`,
        );
      }
    }
  }

  await app.close();

  console.log('\n📈 Resultado:');
  console.log(`   Plazas en JSON:           ${stats.plazas_en_json}`);
  console.log(`   Plazas matcheadas:        ${stats.plazas_matcheadas}`);
  console.log(`   Plazas sin match en POF:  ${stats.plazas_sin_match}`);
  console.log(`   Prestaciones leídas:      ${stats.prestaciones_total}`);
  console.log(`   Assignments borradas:     ${stats.assignments_borradas}`);
  console.log(
    `   Assignments creadas:      ${stats.assignments_creadas} (${stats.assignments_activas} ACTIVAS, ${stats.assignments_finalizadas} FINALIZADAS)`,
  );
  console.log(`   Agentes matcheados:       ${stats.agentes_matcheados_por_dni}`);
  console.log(`   Agentes creados:          ${stats.agentes_creados}`);

  if (sampleAssignments.length > 0) {
    console.log('\n🔎 Muestra:');
    console.log(sampleAssignments.join('\n'));
  }

  if (plazasSinMatch.length > 0) {
    console.log(
      `\n⚠️  Plazas del JSON sin match en pof_positions (${plazasSinMatch.length}):`,
    );
    for (const p of plazasSinMatch.slice(0, 20)) console.log(`  · ${p}`);
    if (plazasSinMatch.length > 20) {
      console.log(`  ... y ${plazasSinMatch.length - 20} más`);
    }
    console.log(
      'Estas no se importaron. Asegurate de haber corrido npm run import:mec antes.',
    );
  }

  if (!commit) {
    console.log(
      '\n⚠️  DRY-RUN: no se escribió nada. Para aplicar:\n   npm run import:mec-historico -- --commit',
    );
  } else {
    console.log('\n✅ Import histórico completado.');
  }
}

main().catch((err) => {
  console.error('❌ Error en import-mec-historico:', err);
  process.exit(1);
});
