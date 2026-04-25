/**
 * Import datos de agentes desde "Planilla de Datos Agentes.xlsx".
 *
 * El xlsx tiene una hoja "Información de Docentes" con columnas:
 *   N° Orden | DOCENTE | DNI | Junta de clasificacion | junta de nivel secundario |
 *   Fecha de Nacimiento | E-mail | Domicilio | Teléfono Fijo | Celular |
 *   Título que posee | Cédula de Identidad | Fecha de Inicio en la Docencia |
 *   Fecha de Inicio en la Escuela | MES
 *
 * MATCH por DNI. Política: FILL-MISSING — solo actualiza campos del Agent
 * que estén NULL/vacíos en la DB. Nunca pisa datos que el admin haya
 * cargado a mano. Si el agente NO existe (DNI no encontrado), se loggea
 * y se saltea (no crea agentes nuevos para no contaminar la base).
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-agents-data.ts \
 *     [--commit] [path/al.xlsx]
 *
 * Sin --commit es DRY-RUN: imprime los UPDATE que haría sin tocar la DB.
 *
 * Default file: imports/Planilla de Datos Agentes.xlsx
 */

import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';

type RawRow = Record<string, unknown>;

type Patch = {
  last_name?: string;
  first_name?: string;
  full_name?: string;
  birth_date?: string;
  email?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  titles?: string;
  identity_card_number?: string;
  board_file_number?: string;
  secondary_board_number?: string;
  teaching_entry_date?: string;
  school_entry_date?: string;
};

// ---------- helpers ----------

function s(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object' && v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const text = String(v).trim();
  if (!text || text.toLowerCase() === 'nan') return undefined;
  return text;
}

function normDni(v: unknown): string | undefined {
  const text = s(v);
  if (!text) return undefined;
  return text.replace(/\.0$/, '').replace(/\D/g, '') || undefined;
}

function toIsoDate(v: unknown): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  // Excel a veces serializa fechas como número (días desde 1900)
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }

  const text = s(v);
  if (!text) return undefined;

  // ISO directo
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  // DD/MM/YYYY o DD-MM-YYYY
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return undefined;
}

function splitName(full: string) {
  if (full.includes(',')) {
    const [last, first] = full.split(',');
    return {
      last_name: last.trim(),
      first_name: first.trim(),
      full_name: `${last.trim()}, ${first.trim()}`,
    };
  }
  const parts = full.trim().split(/\s+/);
  return {
    last_name: parts[0] ?? full,
    first_name: parts.slice(1).join(' '),
    full_name: full.trim(),
  };
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (v instanceof Date) return false;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function diffPatch(agent: Agent, incoming: Patch): Patch {
  const out: Patch = {};
  // Solo escribimos un campo si en la DB está vacío.
  const map: Array<[keyof Patch, keyof Agent]> = [
    ['last_name', 'last_name'],
    ['first_name', 'first_name'],
    ['full_name', 'full_name'],
    ['birth_date', 'birth_date'],
    ['email', 'email'],
    ['address', 'address'],
    ['phone', 'phone'],
    ['mobile', 'mobile'],
    ['titles', 'titles'],
    ['identity_card_number', 'identity_card_number'],
    ['board_file_number', 'board_file_number'],
    ['secondary_board_number', 'secondary_board_number'],
    ['teaching_entry_date', 'teaching_entry_date'],
    ['school_entry_date', 'school_entry_date'],
  ];

  for (const [patchKey, agentKey] of map) {
    const newVal = incoming[patchKey];
    if (newVal === undefined) continue;
    const dbVal = agent[agentKey];
    if (isEmpty(dbVal)) {
      out[patchKey] = newVal;
    }
  }
  return out;
}

// ---------- main ----------

async function bootstrap() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const filePath =
    fileArg || path.join('imports', 'Planilla de Datos Agentes.xlsx');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    process.exit(1);
  }

  console.log(`📄 Archivo: ${filePath}`);
  console.log(`🔧 Modo: ${commit ? '⚠️  COMMIT (escribe en la DB)' : 'DRY-RUN'}`);

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
  console.log(`📚 Hoja: "${sheetName}" · ${rows.length} filas`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const agentsRepo = app.get<Repository<Agent>>(getRepositoryToken(Agent));

  const allAgents = await agentsRepo.find();
  const byDni = new Map<string, Agent>();
  for (const a of allAgents) {
    if (a.dni) byDni.set(a.dni, a);
  }
  console.log(`👥 Agentes en DB: ${allAgents.length}`);

  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  for (const row of rows) {
    const dni = normDni(row['DNI']);
    const docente = s(row['DOCENTE']);

    if (!dni) continue;

    const agent = byDni.get(dni);
    if (!agent) {
      notFound += 1;
      notFoundList.push(`${dni} · ${docente ?? '(sin nombre)'}`);
      continue;
    }
    matched += 1;

    const patch: Patch = {};

    if (docente) {
      const split = splitName(docente);
      patch.last_name = split.last_name;
      patch.first_name = split.first_name;
      patch.full_name = split.full_name;
    }

    const birth = toIsoDate(row['Fecha de Nacimiento']);
    if (birth) patch.birth_date = birth;

    const email = s(row['E-mail']);
    if (email) patch.email = email;

    const address = s(row['Domicilio']);
    if (address) patch.address = address;

    const phone = s(row['Teléfono Fijo']);
    if (phone) patch.phone = phone;

    const mobile = s(row['Celular']);
    if (mobile) patch.mobile = mobile;

    const titles =
      s(row['Título que posee (tal cual figura en el frente del título)']) ??
      s(row['Título que posee']);
    if (titles) patch.titles = titles;

    const idcard = s(row['Cédula de Identidad']);
    if (idcard) patch.identity_card_number = idcard;

    const boardFile = s(row['Junta de clasificacion']);
    if (boardFile) patch.board_file_number = boardFile;

    const secBoardFile = s(row['junta de nivel secundario']);
    if (secBoardFile) patch.secondary_board_number = secBoardFile;

    const teachingEntry = toIsoDate(row['Fecha de Inicio en la Docencia']);
    if (teachingEntry) patch.teaching_entry_date = teachingEntry;

    const schoolEntry = toIsoDate(row['Fecha de Inicio en la Escuela']);
    if (schoolEntry) patch.school_entry_date = schoolEntry;

    const realPatch = diffPatch(agent, patch);
    const fields = Object.keys(realPatch);

    if (fields.length === 0) {
      unchanged += 1;
      continue;
    }

    updated += 1;
    console.log(
      `✏️  ${agent.full_name} (DNI ${agent.dni}) · campos: ${fields.join(', ')}`,
    );

    if (commit) {
      // Convertimos las strings de fecha a Date (TypeORM acepta string ISO en columnas date,
      // pero por consistencia convertimos las explícitas).
      const update: Partial<Agent> = { ...realPatch } as Partial<Agent>;
      await agentsRepo.update({ id: agent.id }, update);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Filas leídas:       ${rows.length}`);
  console.log(`Match por DNI:      ${matched}`);
  console.log(`Actualizados:       ${updated}`);
  console.log(`Sin cambios:        ${unchanged}`);
  console.log(`No encontrados:     ${notFound}`);
  if (notFoundList.length > 0) {
    console.log('\nDNIs no encontrados (primeros 20):');
    for (const x of notFoundList.slice(0, 20)) console.log(`  · ${x}`);
    if (notFoundList.length > 20) {
      console.log(`  ... y ${notFoundList.length - 20} más`);
    }
  }

  if (!commit) {
    console.log(
      '\n💡 Esto fue un DRY-RUN. Para aplicar, agregá --commit al comando.',
    );
  }

  await app.close();
}

void bootstrap().catch((err) => {
  console.error('❌ Error en import-agents-data');
  console.error(err);
  process.exit(1);
});
