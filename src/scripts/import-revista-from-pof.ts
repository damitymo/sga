import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { RevistaService } from '../revista/revista.service';
import { AssignmentsService } from '../assignments/assignments.service';

type PofRow = {
  PLAZA?: string | number;
  ASIGNATURA?: string;
  HS?: string | number;
  CURSO?: string | number;
  'DIV.'?: string | number;
  TURNO?: string;
  'TOMA DE PO'?: string | Date | number;
  HASTA?: string | Date | number;
  'SIT. REVISTA'?: string;
  'NORM LEGAL'?: string;
  OBSERVACIONES?: string;
  'NOMBRE Y APELLIDO'?: string;
  DNI?: string | number;
  MODALIDAD?: string;
};

type ParsedDate = {
  y: number;
  m: number;
  d: number;
};

function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return undefined;
  }

  const text = `${value}`.trim();

  if (!text) return undefined;
  if (text.toLowerCase() === 'nan') return undefined;

  return text;
}

function normalizeDni(value: unknown): string | undefined {
  const text = normalizeString(value);
  if (!text) return undefined;

  return text.replace(/\.0$/, '').replace(/\D/g, '');
}

function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  const num = Number(value);
  if (Number.isNaN(num)) return undefined;

  return num;
}

function parseExcelDateCode(value: number): ParsedDate | null {
  const ssf = XLSX.SSF as unknown as {
    parse_date_code?: (input: number) => ParsedDate | null;
  };

  if (typeof ssf.parse_date_code !== 'function') return null;

  try {
    return ssf.parse_date_code(value) ?? null;
  } catch {
    return null;
  }
}

function buildIsoDate(
  year: number,
  month: number,
  day: number,
): string | undefined {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return undefined;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return undefined;

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${yyyy}-${mm}-${dd}`;
}

function toDateOnly(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = parseExcelDateCode(value);
    if (!parsed) return undefined;

    return buildIsoDate(parsed.y, parsed.m, parsed.d);
  }

  const text = normalizeString(value);
  if (!text) return undefined;

  const upper = text.toUpperCase();

  if (
    upper === '-' ||
    upper === 'CONTINUA' ||
    upper === 'CONTINUO' ||
    upper === 'JUBILADA' ||
    upper === 'JUBILADO'
  ) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [yyyy, mm, dd] = text.split('-').map(Number);
    return buildIsoDate(yyyy, mm, dd);
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    const [yyyy, mm, dd] = text.split('/').map(Number);
    return buildIsoDate(yyyy, mm, dd);
  }

  const parts = text.split(/[/-]/);

  if (parts.length === 3) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    let c = Number(parts[2]);

    if ([a, b, c].some((n) => Number.isNaN(n))) {
      return undefined;
    }

    if (parts[2].length === 2) {
      c = c >= 50 ? 1900 + c : 2000 + c;
    }

    // dd/mm/yyyy
    if (a > 12) {
      return buildIsoDate(c, b, a);
    }

    // mm/dd/yyyy
    if (b > 12) {
      return buildIsoDate(c, a, b);
    }

    // ambiguo: preferimos mm/dd/yyyy
    return buildIsoDate(c, a, b);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return undefined;
}

function normalizeNameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,/g, ' ')
    .trim()
    .toUpperCase();
}

function splitFullName(fullName: string) {
  const raw = normalizeString(fullName) ?? '';
  const clean = raw.replace(/\s+/g, ' ').trim();

  if (!clean) {
    return {
      first_name: undefined as string | undefined,
      last_name: undefined as string | undefined,
      full_name: undefined as string | undefined,
    };
  }

  if (clean.includes(',')) {
    const [last, ...rest] = clean.split(',');
    const first = rest.join(',').trim();

    return {
      last_name: last.trim() || undefined,
      first_name: first || undefined,
      full_name: `${last.trim()}${first ? `, ${first}` : ''}`,
    };
  }

  const parts = clean.split(' ');

  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: undefined,
      full_name: parts[0],
    };
  }

  const last_name = parts[0];
  const first_name = parts.slice(1).join(' ');

  return {
    last_name,
    first_name,
    full_name: `${last_name}, ${first_name}`,
  };
}

function parseLegalNorm(rawValue: unknown): {
  legal_norm_type: 'DECRETO' | 'RESOLUCION_MINISTERIAL' | 'DISPOSICION' | 'RI';
  legal_norm_number?: string;
} {
  const text = normalizeString(rawValue)?.toUpperCase() ?? '';

  if (
    text.includes('R.I') ||
    text.includes('R I') ||
    text.includes('RESOLUCION INTERNA')
  ) {
    return {
      legal_norm_type: 'RI',
      legal_norm_number: normalizeString(rawValue),
    };
  }

  if (text.includes('DISP') || text.includes('DISPOSICION')) {
    return {
      legal_norm_type: 'DISPOSICION',
      legal_norm_number: normalizeString(rawValue),
    };
  }

  if (text.includes('DTO') || text.includes('DECRETO')) {
    return {
      legal_norm_type: 'DECRETO',
      legal_norm_number: normalizeString(rawValue),
    };
  }

  return {
    legal_norm_type: 'RESOLUCION_MINISTERIAL',
    legal_norm_number: normalizeString(rawValue),
  };
}

function isCurrentHasta(value: unknown): boolean {
  const text = normalizeString(value)?.toUpperCase();
  return !text || text === 'CONTINUA' || text === 'CONTINUO';
}

async function findAgentByIdentity(
  agentsRepository: Repository<Agent>,
  dni?: string,
  docente?: string,
): Promise<{
  agent?: Agent;
  method:
    | 'dni'
    | 'dni-ilike'
    | 'nombre-exacto'
    | 'nombre-ilike'
    | 'nombre-normalizado'
    | 'no-encontrado';
}> {
  if (dni) {
    const byDni = await agentsRepository.findOne({
      where: { dni },
    });

    if (byDni) return { agent: byDni, method: 'dni' };

    const byDniLike = await agentsRepository.findOne({
      where: { dni: ILike(dni) },
    });

    if (byDniLike) return { agent: byDniLike, method: 'dni-ilike' };
  }

  const cleanName = normalizeString(docente);
  if (!cleanName) return { method: 'no-encontrado' };

  const byExact = await agentsRepository.findOne({
    where: { full_name: cleanName },
  });

  if (byExact) return { agent: byExact, method: 'nombre-exacto' };

  const byInsensitive = await agentsRepository.findOne({
    where: { full_name: ILike(cleanName) },
  });

  if (byInsensitive) return { agent: byInsensitive, method: 'nombre-ilike' };

  const allAgents = await agentsRepository.find({
    select: ['id', 'full_name', 'dni', 'first_name', 'last_name', 'is_active'],
  });

  const targetKey = normalizeNameKey(cleanName);

  const normalized = allAgents.find(
    (item) => normalizeNameKey(item.full_name) === targetKey,
  );

  if (normalized) return { agent: normalized, method: 'nombre-normalizado' };

  return { method: 'no-encontrado' };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepository = app.get<Repository<Agent>>(
    getRepositoryToken(Agent),
  );
  const pofRepository = app.get<Repository<PofPosition>>(
    getRepositoryToken(PofPosition),
  );
  const assignmentsRepository = app.get<Repository<AgentAssignment>>(
    getRepositoryToken(AgentAssignment),
  );
  const assignmentsService = app.get(AssignmentsService);
  const revistaService = app.get(RevistaService);

  const filePath =
    process.argv[2] ||
    path.resolve(process.cwd(), '..', 'POF - Okanta Organica Funcional.xlsx');

  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo: ${filePath}`);
  }

  console.log(`📄 Leyendo archivo: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<PofRow>(sheet, {
    defval: '',
    raw: false,
  });

  console.log(`📚 Hoja: ${sheetName}`);
  console.log(`🧾 Filas leídas: ${rows.length}`);

  console.log('⏱️ Configurando timeouts de sesión...');
  await assignmentsRepository.query(`SET lock_timeout = '10s';`);
  await assignmentsRepository.query(`SET statement_timeout = '20min';`);

  console.log('🧹 Limpiando revista_records...');
  await assignmentsRepository.query(
    'TRUNCATE TABLE revista_records RESTART IDENTITY CASCADE;',
  );
  console.log('✅ revista_records limpiada');

  console.log('🧹 Limpiando agent_assignments...');
  await assignmentsRepository.query(
    'TRUNCATE TABLE agent_assignments RESTART IDENTITY CASCADE;',
  );
  console.log('✅ agent_assignments limpiada');

  let updatedPof = 0;
  let createdAssignments = 0;
  let createdBajas = 0;
  let createdAgents = 0;
  let currentRows = 0;
  let historicalRows = 0;
  let skippedRows = 0;
  const warnings: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2;

    const plazaNumber = normalizeString(row.PLAZA);
    const docente = normalizeString(row['NOMBRE Y APELLIDO']);
    const dni = normalizeDni(row.DNI);

    if (!plazaNumber || !docente) {
      skippedRows += 1;
      continue;
    }

    const startDate = toDateOnly(row['TOMA DE PO']);
    const endDate = toDateOnly(row.HASTA);
    const current = isCurrentHasta(row.HASTA);
    const split = splitFullName(docente);
    const { legal_norm_type, legal_norm_number } = parseLegalNorm(
      row['NORM LEGAL'],
    );

    const pofPayload: Partial<PofPosition> = {
      plaza_number: plazaNumber,
      subject_name: normalizeString(row.ASIGNATURA),
      hours_count: normalizeNumber(row.HS),
      course: normalizeString(row.CURSO),
      division: normalizeString(row['DIV.']),
      shift: normalizeString(row.TURNO),
      start_date: startDate
        ? (new Date(`${startDate}T00:00:00.000Z`) as unknown as Date)
        : undefined,
      end_date:
        current || !endDate
          ? (null as unknown as Date)
          : (new Date(`${endDate}T00:00:00.000Z`) as unknown as Date),
      revista_status: normalizeString(row['SIT. REVISTA']),
      legal_norm: normalizeString(row['NORM LEGAL']),
      modality: normalizeString(row.MODALIDAD),
      notes: normalizeString(row.OBSERVACIONES),
      is_active: true,
    };

    const existingPof = await pofRepository.findOne({
      where: { plaza_number: plazaNumber },
    });

    let pof: PofPosition;

    if (existingPof) {
      await pofRepository.update(existingPof.id, pofPayload);
      pof = (await pofRepository.findOne({
        where: { id: existingPof.id },
      })) as PofPosition;
    } else {
      const created = pofRepository.create(pofPayload);
      pof = await pofRepository.save(created);
    }

    updatedPof += 1;

    let { agent, method } = await findAgentByIdentity(
      agentsRepository,
      dni,
      docente,
    );

    if (!agent && dni) {
      const createdAgent = agentsRepository.create({
        full_name: split.full_name || docente,
        first_name: split.first_name,
        last_name: split.last_name,
        dni,
        is_active: true,
      });

      agent = await agentsRepository.save(createdAgent);
      createdAgents += 1;
      method = 'dni';
    }

    if (!agent) {
      warnings.push(
        `Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | DNI ${dni ?? '-'} | No se encontró agente`,
      );
      skippedRows += 1;
      continue;
    }

    if (!startDate) {
      warnings.push(
        `Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | DNI ${dni ?? '-'} | Sin fecha TOMA DE PO válida. Valor recibido: ${
          normalizeString(row['TOMA DE PO']) ?? '-'
        }`,
      );
      skippedRows += 1;
      continue;
    }

    try {
      await assignmentsService.createByPlazaNumber({
        agent_id: agent.id,
        plaza_number: plazaNumber,
        movement_type: 'DESIGNACION',
        legal_norm_type,
        legal_norm_number,
        assignment_date: startDate,
        status: 'ACTIVA',
        character_type:
          (normalizeString(row['SIT. REVISTA'])?.toUpperCase() as
            | 'TITULAR'
            | 'INTERINO'
            | 'SUPLENTE'
            | undefined) ?? 'TITULAR',
        notes: normalizeString(row.OBSERVACIONES),
      });

      createdAssignments += 1;

      if (current) {
        currentRows += 1;
      } else {
        historicalRows += 1;

        if (endDate) {
          await assignmentsService.createByPlazaNumber({
            agent_id: agent.id,
            plaza_number: plazaNumber,
            movement_type: 'BAJA',
            legal_norm_type,
            legal_norm_number,
            assignment_date: startDate,
            end_date: endDate,
            status: 'FINALIZADA',
            character_type:
              (normalizeString(row['SIT. REVISTA'])?.toUpperCase() as
                | 'TITULAR'
                | 'INTERINO'
                | 'SUPLENTE'
                | undefined) ?? 'TITULAR',
            notes: normalizeString(row.OBSERVACIONES),
          });

          createdBajas += 1;
        } else {
          await revistaService.create({
            agent_id: agent.id,
            pof_position_id: pof.id,
            revista_type: 'DOCENTE',
            character_type:
              normalizeString(row['SIT. REVISTA'])?.toUpperCase() ?? 'TITULAR',
            start_date: new Date(`${startDate}T00:00:00.000Z`),
            end_date: undefined,
            is_current: false,
            legal_norm: normalizeString(row['NORM LEGAL']),
            resolution_number: legal_norm_number,
            notes:
              `Registro histórico sin fecha de cierre exacta. Valor HASTA: ${
                normalizeString(row.HASTA) ?? '-'
              }. ${normalizeString(row.OBSERVACIONES) ?? ''}`.trim(),
          });

          warnings.push(
            `Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | DNI ${dni ?? '-'} | Histórico sin fecha exacta de cierre: ${
              normalizeString(row.HASTA) ?? '-'
            }`,
          );
        }
      }
    } catch (error) {
      warnings.push(
        `Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | DNI ${dni ?? '-'} | Método ${method} | Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if ((i + 1) % 50 === 0) {
      console.log(`⏳ Procesadas ${i + 1} de ${rows.length} filas...`);
    }
  }

  console.log('\n✅ IMPORTACIÓN FINALIZADA');
  console.log(`POF actualizadas/creadas: ${updatedPof}`);
  console.log(`Agentes creados automáticamente: ${createdAgents}`);
  console.log(`Designaciones creadas: ${createdAssignments}`);
  console.log(`Bajas creadas: ${createdBajas}`);
  console.log(`Filas actuales: ${currentRows}`);
  console.log(`Filas históricas: ${historicalRows}`);
  console.log(`Filas salteadas: ${skippedRows}`);

  if (warnings.length > 0) {
    const warningsPath = path.resolve(
      process.cwd(),
      'import-revista-warnings.txt',
    );
    fs.writeFileSync(warningsPath, warnings.join('\n'), 'utf8');
    console.log(`⚠️ Advertencias: ${warnings.length}`);
    console.log(`📝 Archivo generado: ${warningsPath}`);
  }

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Error fatal en importación de revista desde POF');
  console.error(error);
  process.exit(1);
});
