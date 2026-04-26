/**
 * Import designaciones (Formularios FD) desde el endpoint
 * /api/Designacion/listadoPorEstablecimiento del MEC.
 *
 * Estos FDs son los movimientos legales (designaciones) que tuvo cada
 * agente — significativamente más completos que las prestaciones del
 * endpoint /api/plaza, que solo trae las prestaciones vivas o
 * recientemente cerradas.
 *
 * Cada FD se guarda como `agent_assignments` con:
 *   - agent_id  → match por DNI con la tabla agents
 *   - pof_position_id  → NULL (el FD no trae plaza específica)
 *   - movement_type    → 'DESIGNACION'
 *   - assignment_date  → tomaPosesionFecha
 *   - status           → 'ACTIVA' si no tiene egresoPersona, sino 'FINALIZADA'
 *   - resolution_number → asuntoConMascara (FD-XXXXX/YY)
 *   - legal_norm       → normaLegalDesignacion
 *   - notes            → estado del formulario + ID del FD
 *
 * Idempotente por (agent_id, FD-asunto): si ya existe una assignment con
 * el mismo número de FD para el agente, no la duplica.
 *
 * Uso:
 *   npm run import:mec-designaciones                          # dry-run
 *   npm run import:mec-designaciones -- --commit              # aplica
 *   npm run import:mec-designaciones -- archivo.json --commit
 *
 * Default file: imports/mec-designaciones-full.json
 */

import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

type MecFormDesignacion = {
  formularioDesignacionId?: number;
  numero?: string;
  asuntoConMascara?: string; // "FD-03342/26"
  fecha?: string; // DD/MM/YYYY
  fechaIngresoEstado?: string;
  estado?: string;
  ingresoPersonaId?: number;
  ingresoPersonaApellido?: string;
  ingresoPersonaNombre?: string;
  ingresoPersonaNroDocumento?: string;
  tomaPosesionFecha?: string; // DD/MM/YYYY
  egresoPersonaApellido?: string | null;
  egresoPersonaNombre?: string | null;
  egresoPersonaNroDocumento?: string | null;
  normaLegalDesignacion?: string | null;
};

type MecResponse = {
  aaData: MecFormDesignacion[];
};

function parseDdMmYyyy(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year >= 50 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function digitsOnly(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const createMissingAgents = args.includes('--create-missing-agents');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const filePath = fileArg
    ? path.isAbsolute(fileArg)
      ? fileArg
      : path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'imports/mec-designaciones-full.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No existe: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Archivo: ${filePath}`);
  console.log(
    `⚙️  Modo: ${commit ? '🔴 COMMIT (escribe en DB)' : '🟢 DRY-RUN'}`,
  );
  if (createMissingAgents) {
    console.log(
      `🆕 --create-missing-agents: crea Agent placeholder si el DNI no existe`,
    );
  }

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MecResponse;
  const fds = json.aaData ?? [];
  console.log(`📊 Designaciones en JSON: ${fds.length}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const agentsRepo = app.get<Repository<Agent>>(getRepositoryToken(Agent));
  const assignRepo = app.get<Repository<AgentAssignment>>(
    getRepositoryToken(AgentAssignment),
  );

  const allAgents = await agentsRepo.find();
  const byDni = new Map<string, Agent>();
  for (const a of allAgents) {
    if (a.dni) byDni.set(a.dni, a);
  }
  console.log(`👥 Agentes en DB: ${allAgents.length}`);

  // 1) Borrar todos los FDs importados previamente para que el script sea
  // idempotente. Los identificamos por: pof_position_id IS NULL AND
  // resolution_number LIKE 'FD-%' AND notes LIKE '%formularioDesignacionId%'.
  if (commit) {
    const deleted = await assignRepo
      .createQueryBuilder()
      .delete()
      .where('pof_position_id IS NULL')
      .andWhere("resolution_number LIKE 'FD-%'")
      .andWhere("notes LIKE '%formularioDesignacionId%'")
      .execute();
    console.log(
      `🧹 FDs previos borrados: ${deleted.affected ?? 0} (idempotencia)`,
    );
  }

  // 2) Pre-cargar las assignments con plaza vinculada (no FD) para detectar
  // duplicados por norma legal: si un FD tiene la misma NLD que una
  // prestación con plaza, esa designación ya está representada — el FD
  // no se crea (sería un duplicado de la misma resolución).
  // Normalizamos: "ME-R-07621/19" y "07621/19" deben matchear.
  const assignmentsConPlaza = await assignRepo.find({
    where: { pof_position_id: Not(IsNull()) },
    select: ['id', 'agent_id', 'legal_norm', 'resolution_number'],
  });

  function normalizeNld(s: string | null | undefined): string {
    if (!s) return '';
    // Sacamos prefijos tipo "ME-R-", "R. M.", "DNS-D-", etc., y nos quedamos
    // con la última secuencia "NUMERO/AA" para comparar.
    const m = String(s).match(/(\d+)\s*\/\s*(\d{2,4})/);
    if (!m) return s.trim().toUpperCase();
    const num = String(parseInt(m[1], 10)); // saca ceros a la izquierda
    return `${num}/${m[2]}`;
  }

  const nldByAgent = new Map<number, Set<string>>();
  for (const a of assignmentsConPlaza) {
    const nld = normalizeNld(a.legal_norm) || normalizeNld(a.resolution_number);
    if (!nld) continue;
    if (!nldByAgent.has(a.agent_id)) nldByAgent.set(a.agent_id, new Set());
    nldByAgent.get(a.agent_id)!.add(nld);
  }
  console.log(
    `🔎 NLDs ya cubiertas por prestaciones con plaza: ${assignmentsConPlaza.length}`,
  );

  let processed = 0;
  let created = 0;
  let skippedDuplicate = 0;
  let skippedNldMatch = 0;
  let skippedNoAgent = 0;
  let skippedNoDni = 0;
  let skippedNoToma = 0;
  let agentsCreated = 0;
  const sample: string[] = [];
  const existingByKey = new Set<string>();

  for (const fd of fds) {
    processed++;

    const dni = digitsOnly(fd.ingresoPersonaNroDocumento);
    if (!dni) {
      skippedNoDni++;
      continue;
    }

    let agent = byDni.get(dni);
    if (!agent) {
      if (!createMissingAgents) {
        skippedNoAgent++;
        continue;
      }
      // Crear Agent placeholder con datos del FD
      const apellido = (fd.ingresoPersonaApellido || '').trim();
      const nombre = (fd.ingresoPersonaNombre || '').trim();
      const fullName = apellido && nombre ? `${apellido}, ${nombre}` : apellido || dni;
      const created = agentsRepo.create({
        full_name: fullName,
        last_name: apellido || null,
        first_name: nombre || null,
        dni,
        is_active: true,
        notes:
          'Agente creado por import-mec-designaciones (no estaba en agents). Verificar datos.',
      });
      if (commit) {
        agent = await agentsRepo.save(created);
      } else {
        agent = { ...created, id: -1 } as Agent;
      }
      byDni.set(dni, agent);
      agentsCreated++;
    }

    const tomaIso = parseDdMmYyyy(fd.tomaPosesionFecha);
    if (!tomaIso) {
      skippedNoToma++;
      continue;
    }

    const fdAsunto = (fd.asuntoConMascara || '').trim();
    const key = `${agent.id}|${fdAsunto}`;
    if (existingByKey.has(key)) {
      skippedDuplicate++;
      continue;
    }

    // Si la NLD del FD ya está cubierta por una assignment con plaza,
    // omitir: es la misma designación, ya representada con datos completos.
    const nldNorm = normalizeNld(fd.normaLegalDesignacion);
    if (nldNorm && nldByAgent.get(agent.id)?.has(nldNorm)) {
      skippedNldMatch++;
      continue;
    }

    // Status: estos FDs son siempre históricos (designaciones legales viejas).
    // El endpoint del MEC no nos dice si la persona sigue activa en esa
    // designación — para eso ya tenemos las prestaciones del endpoint /api/plaza,
    // que se filtran arriba con nldByAgent. Todo lo que llegue acá no tiene
    // contraparte en la POF actual → es histórico cerrado → FINALIZADA.
    const estado = (fd.estado || '').trim();
    const status: 'ACTIVA' | 'FINALIZADA' = 'FINALIZADA';

    const noteParts = [
      fd.numero ? `FD nro: ${fd.numero}` : null,
      estado ? `Estado MEC: ${estado}` : null,
      fd.formularioDesignacionId
        ? `formularioDesignacionId: ${fd.formularioDesignacionId}`
        : null,
      fd.fecha ? `Fecha formulario: ${fd.fecha}` : null,
    ].filter(Boolean) as string[];

    const payload: Partial<AgentAssignment> = {
      agent_id: agent.id,
      pof_position_id: null,
      movement_type: 'DESIGNACION',
      character_type: null,
      assignment_date: tomaIso as unknown as Date,
      end_date: null,
      status,
      resolution_number: fdAsunto || null,
      legal_norm: fd.normaLegalDesignacion || null,
      notes: noteParts.join(' | ') || null,
    };

    if (commit) {
      await assignRepo.save(assignRepo.create(payload));
    }

    created++;
    existingByKey.add(key);

    if (sample.length < 5 || /TYMOSZUK/i.test(fd.ingresoPersonaApellido || '')) {
      sample.push(
        `  • ${fd.ingresoPersonaApellido} ${fd.ingresoPersonaNombre} · ${fdAsunto} · NLD ${fd.normaLegalDesignacion ?? '-'} · toma=${tomaIso} · ${status}`,
      );
    }
  }

  await app.close();

  console.log('\n📈 Resultado:');
  console.log(`   FDs procesados:                     ${processed}`);
  console.log(`   Assignments FINALIZADAS creadas:    ${created}`);
  console.log(`   Saltados por NLD ya en POF actual:  ${skippedNldMatch}`);
  console.log(`   Saltados duplicados (dentro JSON):  ${skippedDuplicate}`);
  console.log(`   Sin agente en DB:                   ${skippedNoAgent}`);
  console.log(`   Agentes creados (placeholder):      ${agentsCreated}`);
  console.log(`   Sin DNI:                            ${skippedNoDni}`);
  console.log(`   Sin toma de posesión:               ${skippedNoToma}`);

  if (sample.length > 0) {
    console.log('\n🔎 Muestra:');
    console.log(sample.slice(0, 20).join('\n'));
  }

  if (!commit) {
    console.log(
      '\n⚠️  DRY-RUN. Para aplicar:\n   npm run import:mec-designaciones -- --commit',
    );
  } else {
    console.log('\n✅ Import completado.');
  }
}

main().catch((err) => {
  console.error('❌ Error en import-mec-designaciones:', err);
  process.exit(1);
});
