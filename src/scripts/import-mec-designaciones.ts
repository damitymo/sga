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

  // Pre-cargar todas las assignments existentes con FD asociado para
  // detectar duplicados (idempotencia por agent_id + resolution_number).
  // El FD lo guardamos en `resolution_number` con formato "FD-XXXXX/YY".
  const existingAssignments = await assignRepo.find({
    where: { resolution_number: Not(IsNull()) },
    select: ['id', 'agent_id', 'resolution_number', 'pof_position_id'],
  });
  const existingByKey = new Set<string>();
  for (const ex of existingAssignments) {
    if (ex.resolution_number?.startsWith('FD-')) {
      existingByKey.add(`${ex.agent_id}|${ex.resolution_number}`);
    }
  }
  console.log(
    `🔎 FDs ya importados previamente: ${existingByKey.size}`,
  );

  let processed = 0;
  let created = 0;
  let skippedDuplicate = 0;
  let skippedNoAgent = 0;
  let skippedNoDni = 0;
  let skippedNoToma = 0;
  const sample: string[] = [];

  for (const fd of fds) {
    processed++;

    const dni = digitsOnly(fd.ingresoPersonaNroDocumento);
    if (!dni) {
      skippedNoDni++;
      continue;
    }

    const agent = byDni.get(dni);
    if (!agent) {
      skippedNoAgent++;
      continue;
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

    // Status: si fd está "Anulado" → FINALIZADA; sino ACTIVA
    const estado = (fd.estado || '').trim();
    const isAnulado = /anulad/i.test(estado);

    const status: 'ACTIVA' | 'FINALIZADA' = isAnulado ? 'FINALIZADA' : 'ACTIVA';

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
  console.log(`   FDs procesados:          ${processed}`);
  console.log(`   Assignments creadas:     ${created}`);
  console.log(`   Duplicados saltados:     ${skippedDuplicate}`);
  console.log(`   Sin agente en DB:        ${skippedNoAgent}`);
  console.log(`   Sin DNI:                 ${skippedNoDni}`);
  console.log(`   Sin toma de posesión:    ${skippedNoToma}`);

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
