/**
 * Import MEC hierarchical POF report.
 *
 * Parsea el reporte oficial "Reporte de Planta Orgánica Funcional" del MEC
 * (archivo .xls con dos hojas: Hoja1 plazas activas, Hoja2 desafectadas).
 *
 * Es IDEMPOTENTE a nivel plaza: para cada plaza del reporte borra las
 * assignments existentes y las recrea desde las prestaciones, así se puede
 * correr una y otra vez con reportes nuevos sin duplicar.
 *
 * - Plazas de Hoja1 → is_active = true
 * - Plazas de Hoja2 → is_active = false (desafectadas)
 * - Prestación con Egreso vacío → assignment ACTIVA
 * - Prestación con Egreso cargado → assignment FINALIZADA
 * - Agente que no existe se crea con DNI placeholder "MEC-APELLIDO-NOMBRE"
 *
 * Uso:
 *   npm run import:mec                      # dry-run, solo loggea cambios
 *   npm run import:mec -- --commit          # aplica a la DB
 *   npm run import:mec -- imports/foo.xls   # archivo custom (default: imports/mec-pof.xls)
 */

import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

type SheetLayout = {
  // posiciones de columnas (0-indexed) para el encabezado de la plaza
  plaza: {
    plazaNumber: number;
    nivel: number;
    cargo: number;
    asignatura: number;
    curso: number;
    division: number;
    turno: number;
    hs: number;
    estado: number;
  };
  // posiciones de columnas (0-indexed) para la fila de prestación
  prestacion: {
    apellido: number;
    nombre: number;
    sitRev: number;
    escalafon: number;
    ingreso: number;
    egreso: number;
    nLegalDesignacion: number;
    nLegalCese: number;
    licencia: number;
  };
};

// Layout de Hoja1 (plazas activas / normales / vacantes)
const HOJA1_LAYOUT: SheetLayout = {
  plaza: {
    plazaNumber: 0,
    nivel: 4,
    cargo: 8,
    asignatura: 13,
    curso: 17,
    division: 20,
    turno: 23,
    hs: 27,
    estado: 32,
  },
  prestacion: {
    apellido: 2,
    nombre: 4,
    sitRev: 8,
    escalafon: 13,
    ingreso: 17,
    egreso: 20,
    nLegalDesignacion: 23,
    nLegalCese: 27,
    licencia: 32,
  },
};

// Layout de Hoja2 (plazas desafectadas / con inconsistencia) - columnas más compactas
const HOJA2_LAYOUT: SheetLayout = {
  plaza: {
    plazaNumber: 0,
    nivel: 4,
    cargo: 6,
    asignatura: 7,
    curso: 8,
    division: 9,
    turno: 10,
    hs: 11,
    estado: 15,
  },
  prestacion: {
    apellido: 3,
    nombre: 4,
    sitRev: 6,
    escalafon: 7,
    ingreso: 8,
    egreso: 9,
    nLegalDesignacion: 10,
    nLegalCese: 11,
    licencia: 15,
  },
};

type ParsedPrestacion = {
  apellido: string;
  nombre: string;
  sit_rev: string | null;
  escalafon: string | null;
  ingreso_date: string | null;
  ingreso_motivo: string | null;
  egreso_date: string | null;
  egreso_motivo: string | null;
  n_legal_designacion: string | null;
  n_legal_cese: string | null;
  licencia: string | null;
};

type ParsedPlaza = {
  plaza_number: string;
  nivel: string | null;
  cargo: string | null;
  asignatura: string | null;
  curso: string | null;
  division: string | null;
  turno: string | null;
  hs: number | null;
  estado: string | null;
  prestaciones: ParsedPrestacion[];
  is_desafectada: boolean;
};

// ---------- helpers ----------

function str(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s || null;
}

function num(v: Cell): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function looksLikePlazaCode(v: Cell): boolean {
  const s = str(v);
  if (!s) return false;
  return /^\d{2}-\d{3}$/.test(s);
}

// parsea "DD/MM/YYYY( Motivo )" o "DD/MM/YYYY" → { date: ISO, motivo }
function parseDateMotivo(v: Cell): { date: string | null; motivo: string | null } {
  const s = str(v);
  if (!s) return { date: null, motivo: null };

  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s*\(\s*([^)]+?)\s*\))?/);
  if (!m) return { date: null, motivo: s };

  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { date: null, motivo: s };
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date: iso, motivo: m[4]?.trim() || null };
}

function normalizeName(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function placeholderDni(apellido: string, nombre: string): string {
  const a = normalizeName(apellido).replace(/[^A-Z0-9]/g, '');
  const n = normalizeName(nombre).replace(/[^A-Z0-9]/g, '');
  return `MEC-${a}-${n}`.slice(0, 40);
}

// ---------- parseo de hojas ----------

function sheetToRows(sheet: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
}

function isEmptyRow(row: Row): boolean {
  return !row || row.every((c) => c === null || c === undefined || (typeof c === 'string' && !c.trim()));
}

function parseSheet(rows: Row[], layout: SheetLayout, isDesafectada: boolean): ParsedPlaza[] {
  const plazas: ParsedPlaza[] = [];
  let i = 0;

  while (i < rows.length) {
    // saltar vacías
    while (i < rows.length && isEmptyRow(rows[i])) i++;
    if (i >= rows.length) break;

    const firstRow = rows[i];
    const plazaCode = str(firstRow[layout.plaza.plazaNumber]);

    // solo arrancamos un bloque si la primera celda parece un código de plaza
    if (!plazaCode || !looksLikePlazaCode(plazaCode)) {
      i++;
      continue;
    }

    // fila siguiente = datos de la plaza
    const dataRow = rows[i + 1] ?? [];

    const plaza: ParsedPlaza = {
      plaza_number: plazaCode,
      nivel: str(dataRow[layout.plaza.nivel]),
      cargo: str(dataRow[layout.plaza.cargo]),
      asignatura: str(dataRow[layout.plaza.asignatura]),
      curso: str(dataRow[layout.plaza.curso]),
      division: str(dataRow[layout.plaza.division]),
      turno: str(dataRow[layout.plaza.turno]),
      hs: num(dataRow[layout.plaza.hs]),
      estado: str(dataRow[layout.plaza.estado]),
      prestaciones: [],
      is_desafectada: isDesafectada,
    };

    // avanzar hasta la fila de headers de prestaciones (después del marker "Prestaciones")
    let j = i + 2;
    while (j < rows.length && !isEmptyRow(rows[j])) {
      const cells = rows[j].map((c) => str(c)?.toLowerCase() ?? '');
      // header row de prestaciones contiene "apellido" y "nombre"
      if (cells.includes('apellido') && cells.includes('nombre')) {
        j++;
        break;
      }
      j++;
    }

    // leer prestaciones hasta fila vacía o próximo código de plaza
    while (j < rows.length && !isEmptyRow(rows[j])) {
      const row = rows[j];
      // si aparece otro código de plaza, corto
      if (looksLikePlazaCode(row[layout.plaza.plazaNumber])) break;

      const apellido = str(row[layout.prestacion.apellido]);
      const nombre = str(row[layout.prestacion.nombre]);

      if (apellido && nombre) {
        const ingreso = parseDateMotivo(row[layout.prestacion.ingreso]);
        const egreso = parseDateMotivo(row[layout.prestacion.egreso]);

        plaza.prestaciones.push({
          apellido,
          nombre,
          sit_rev: str(row[layout.prestacion.sitRev]),
          escalafon: str(row[layout.prestacion.escalafon]),
          ingreso_date: ingreso.date,
          ingreso_motivo: ingreso.motivo,
          egreso_date: egreso.date,
          egreso_motivo: egreso.motivo,
          n_legal_designacion: str(row[layout.prestacion.nLegalDesignacion]),
          n_legal_cese: str(row[layout.prestacion.nLegalCese]),
          licencia: str(row[layout.prestacion.licencia]),
        });
      }

      j++;
    }

    plazas.push(plaza);
    i = j;
  }

  return plazas;
}

// ---------- matcher de agentes ----------

type AgentIndex = Map<string, Agent>;

function buildAgentIndex(agents: Agent[]): AgentIndex {
  const map: AgentIndex = new Map();
  for (const a of agents) {
    const keys = new Set<string>();
    if (a.full_name) keys.add(normalizeName(a.full_name));
    if (a.last_name && a.first_name) {
      keys.add(normalizeName(`${a.last_name} ${a.first_name}`));
      keys.add(normalizeName(`${a.first_name} ${a.last_name}`));
    }
    for (const k of keys) {
      if (!map.has(k)) map.set(k, a);
    }
  }
  return map;
}

function findAgentInIndex(index: AgentIndex, apellido: string, nombre: string): Agent | null {
  const k1 = normalizeName(`${apellido} ${nombre}`);
  const k2 = normalizeName(`${nombre} ${apellido}`);
  return index.get(k1) ?? index.get(k2) ?? null;
}

// ---------- main ----------

type Stats = {
  plazas_upserted: number;
  plazas_activas: number;
  plazas_desafectadas: number;
  agents_created: number;
  agents_matched: number;
  assignments_deleted: number;
  assignments_created: number;
  assignments_activas: number;
  assignments_finalizadas: number;
};

async function run() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const filePath = fileArg
    ? path.isAbsolute(fileArg)
      ? fileArg
      : path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'imports/mec-pof.xls');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No existe el archivo: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Leyendo reporte MEC: ${filePath}`);
  console.log(`⚙️  Modo: ${commit ? '🔴 COMMIT (aplica a DB)' : '🟢 DRY-RUN (no escribe nada)'}`);

  const wb = XLSX.readFile(filePath, { cellDates: false });

  const hoja1 = wb.Sheets['Hoja1'];
  const hoja2 = wb.Sheets['Hoja2'];

  if (!hoja1) {
    console.error('❌ No se encontró Hoja1 en el reporte.');
    process.exit(1);
  }

  const plazasActivas = parseSheet(sheetToRows(hoja1), HOJA1_LAYOUT, false);
  const plazasDesafectadas = hoja2
    ? parseSheet(sheetToRows(hoja2), HOJA2_LAYOUT, true)
    : [];

  const allPlazas = [...plazasActivas, ...plazasDesafectadas];

  console.log(
    `📊 Parseadas: ${plazasActivas.length} plazas activas + ${plazasDesafectadas.length} desafectadas = ${allPlazas.length} totales`,
  );
  console.log(
    `   Prestaciones totales: ${allPlazas.reduce((sum, p) => sum + p.prestaciones.length, 0)}`,
  );

  const stats: Stats = {
    plazas_upserted: 0,
    plazas_activas: 0,
    plazas_desafectadas: 0,
    agents_created: 0,
    agents_matched: 0,
    assignments_deleted: 0,
    assignments_created: 0,
    assignments_activas: 0,
    assignments_finalizadas: 0,
  };

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const agentsRepo = app.get<Repository<Agent>>(getRepositoryToken(Agent));
  const pofRepo = app.get<Repository<PofPosition>>(getRepositoryToken(PofPosition));
  const assignRepo = app.get<Repository<AgentAssignment>>(getRepositoryToken(AgentAssignment));

  const allAgents = await agentsRepo.find();
  const agentIndex = buildAgentIndex(allAgents);

  // samples para el log cuando es dry-run
  const sampleAssignments: string[] = [];

  for (const plaza of allPlazas) {
    // upsert plaza
    let pof = await pofRepo.findOne({ where: { plaza_number: plaza.plaza_number } });

    const pofPayload: Partial<PofPosition> = {
      plaza_number: plaza.plaza_number,
      subject_name: plaza.asignatura,
      hours_count: plaza.hs,
      course: plaza.curso,
      division: plaza.division,
      shift: plaza.turno,
      revista_status: plaza.estado,
      modality: plaza.cargo, // "Cargo / Nivel Funcional" lo guardamos en modality
      notes: plaza.nivel ? `Nivel: ${plaza.nivel}` : null,
      is_active: !plaza.is_desafectada,
    };

    if (!pof) {
      if (commit) {
        pof = await pofRepo.save(pofRepo.create(pofPayload));
      } else {
        // simulamos para poder seguir vinculando en dry-run
        pof = pofRepo.create({ ...pofPayload, id: -1 });
      }
    } else {
      if (commit) {
        await pofRepo.update(pof.id, pofPayload);
      }
      Object.assign(pof, pofPayload);
    }
    stats.plazas_upserted++;
    if (plaza.is_desafectada) stats.plazas_desafectadas++;
    else stats.plazas_activas++;

    // borrar assignments existentes (solo si la plaza ya existía y tenemos id real)
    if (commit && pof.id && pof.id > 0) {
      const deleted = await assignRepo.delete({ pof_position_id: pof.id });
      stats.assignments_deleted += deleted.affected ?? 0;
    }

    // crear assignments desde las prestaciones
    for (const pr of plaza.prestaciones) {
      // buscar agente
      let agent = findAgentInIndex(agentIndex, pr.apellido, pr.nombre);

      if (!agent) {
        const full_name = `${pr.apellido} ${pr.nombre}`;
        const dni = placeholderDni(pr.apellido, pr.nombre);

        // chequeo extra contra DB por si el índice en memoria quedó corto
        const existingByDni = await agentsRepo.findOne({ where: { dni } });

        if (existingByDni) {
          agent = existingByDni;
          // lo metemos en el índice para próximas prestaciones
          agentIndex.set(normalizeName(full_name), agent);
        } else {
          const newAgent = agentsRepo.create({
            full_name,
            last_name: pr.apellido,
            first_name: pr.nombre,
            dni,
            is_active: !plaza.is_desafectada,
            notes: 'Agente importado desde reporte MEC. DNI placeholder, actualizar desde admin.',
          });

          if (commit) {
            agent = await agentsRepo.save(newAgent);
          } else {
            agent = { ...newAgent, id: -1 } as Agent;
          }

          agentIndex.set(normalizeName(full_name), agent);
          stats.agents_created++;
        }
      } else {
        stats.agents_matched++;
      }

      const isActive = !pr.egreso_date;
      const status = isActive ? 'ACTIVA' : 'FINALIZADA';

      const assignmentPayload: Partial<AgentAssignment> = {
        agent_id: agent.id,
        pof_position_id: pof.id,
        movement_type: 'DESIGNACION',
        character_type: pr.sit_rev,
        assignment_date: pr.ingreso_date ? (pr.ingreso_date as unknown as Date) : null,
        end_date: pr.egreso_date ? (pr.egreso_date as unknown as Date) : null,
        status,
        resolution_number: pr.n_legal_designacion,
        legal_norm: pr.n_legal_designacion,
        notes: [
          pr.ingreso_motivo ? `Ingreso: ${pr.ingreso_motivo}` : null,
          pr.egreso_motivo ? `Egreso: ${pr.egreso_motivo}` : null,
          pr.licencia ? `Licencia: ${pr.licencia}` : null,
          pr.n_legal_cese ? `N. Legal Cese: ${pr.n_legal_cese}` : null,
          pr.escalafon ? `Escalafón: ${pr.escalafon}` : null,
        ]
          .filter(Boolean)
          .join(' | ') || null,
      };

      if (commit && pof.id > 0 && agent.id > 0) {
        await assignRepo.save(assignRepo.create(assignmentPayload));
      }

      stats.assignments_created++;
      if (isActive) stats.assignments_activas++;
      else stats.assignments_finalizadas++;

      // log de muestra para Tymoszuk (y primeras 3 en general)
      if (
        /TYMOSZUK/.test(normalizeName(pr.apellido)) ||
        sampleAssignments.length < 3
      ) {
        sampleAssignments.push(
          `  • ${plaza.plaza_number} ${plaza.cargo ?? ''} ${plaza.asignatura ?? ''} → ${pr.apellido} ${pr.nombre} [${status}] ingreso=${pr.ingreso_date ?? '-'} egreso=${pr.egreso_date ?? '-'}`,
        );
      }
    }
  }

  await app.close();

  console.log('\n📈 Resultado:');
  console.log(`   Plazas upserted:       ${stats.plazas_upserted} (${stats.plazas_activas} activas, ${stats.plazas_desafectadas} desafectadas)`);
  console.log(`   Agentes creados:       ${stats.agents_created}`);
  console.log(`   Agentes matcheados:    ${stats.agents_matched}`);
  console.log(`   Assignments borradas:  ${stats.assignments_deleted}`);
  console.log(`   Assignments creadas:   ${stats.assignments_created} (${stats.assignments_activas} ACTIVAS, ${stats.assignments_finalizadas} FINALIZADAS)`);

  if (sampleAssignments.length > 0) {
    console.log('\n🔎 Muestra:');
    console.log(sampleAssignments.join('\n'));
  }

  if (!commit) {
    console.log('\n⚠️  DRY-RUN: no se escribió nada. Para aplicar:');
    console.log('   npm run import:mec -- --commit');
  } else {
    console.log('\n✅ Import MEC completado.');
  }
}

run().catch((err) => {
  console.error('❌ Error en import MEC:', err);
  process.exit(1);
});
