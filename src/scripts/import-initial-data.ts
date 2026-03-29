import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AssignmentsService } from '../assignments/assignments.service';

type AgentRow = {
  DOCENTE?: string;
  DNI?: string | number;
  'Junta de clasificacion'?: string | number;
  'junta de nivel secundario'?: string | number;
  'Fecha de Nacimiento'?: string | Date | number;
  'E-mail'?: string;
  Domicilio?: string;
  'Teléfono Fijo'?: string | number;
  Celular?: string | number;
  'Título que posee (tal cual figura en su título)'?: string;
  'Cédula de Identidad'?: string | number;
  'Fecha de Inicio en la Docencia'?: string | Date | number;
  'Fecha de Inicio en la Escuela'?: string | Date | number;
};

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

type AssignmentDiagnostic = {
  row_number: number;
  plaza_number?: string;
  dni?: string;
  docente?: string;
  start_date?: string;
  end_date?: string;
  metodo_busqueda?: string;
  agente_encontrado?: string;
  motivo: string;
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

  if (typeof ssf.parse_date_code !== 'function') {
    return null;
  }

  return ssf.parse_date_code(value);
}

function parseLatinDateText(text: string): string | undefined {
  const clean = text.trim();

  if (!clean) return undefined;
  if (clean.toUpperCase() === 'CONTINUA') return undefined;

  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);

    if (year < 100) year += 2000;

    if (
      year >= 1900 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(
        2,
        '0',
      )}-${String(day).padStart(2, '0')}`;
    }
  }

  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return clean;

  return undefined;
}

function toDateOnly(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = parseExcelDateCode(value);

    if (parsed) {
      const year = String(parsed.y).padStart(4, '0');
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return undefined;
  }

  const text = `${value}`.trim();
  if (!text) return undefined;

  const latinDate = parseLatinDateText(text);
  if (latinDate) return latinDate;

  return undefined;
}

function splitFullName(fullName?: string) {
  const safe = normalizeString(fullName);

  if (!safe) {
    return {
      full_name: '',
      first_name: undefined,
      last_name: undefined,
    };
  }

  if (safe.includes(',')) {
    const [lastNameRaw, firstNameRaw] = safe.split(',').map((v) => v.trim());
    const first_name = normalizeString(firstNameRaw);
    const last_name = normalizeString(lastNameRaw);

    return {
      full_name:
        `${last_name ?? ''}${first_name ? `, ${first_name}` : ''}`.trim(),
      first_name,
      last_name,
    };
  }

  return {
    full_name: safe,
    first_name: undefined,
    last_name: undefined,
  };
}

function normalizeNameForCompare(value?: string): string {
  if (!value) return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\.+/g, '.')
    .trim()
    .toUpperCase();
}

async function findAgentByIdentity(
  agentsRepository: Repository<Agent>,
  dni: string | undefined,
  docente: string | undefined,
): Promise<{
  agent: Agent | null;
  method: string;
}> {
  if (dni) {
    const byDni = await agentsRepository.findOne({
      where: { dni },
    });

    if (byDni) {
      return { agent: byDni, method: 'dni' };
    }
  }

  const safeDocente = normalizeString(docente);

  if (!safeDocente) {
    return { agent: null, method: 'sin-datos' };
  }

  const byExactName = await agentsRepository.findOne({
    where: { full_name: safeDocente },
  });

  if (byExactName) {
    return { agent: byExactName, method: 'nombre-exacto' };
  }

  const byInsensitiveName = await agentsRepository.findOne({
    where: { full_name: ILike(safeDocente) },
  });

  if (byInsensitiveName) {
    return { agent: byInsensitiveName, method: 'nombre-ilike' };
  }

  const allAgents = await agentsRepository.find();
  const normalizedTarget = normalizeNameForCompare(safeDocente);

  const byNormalized = allAgents.find(
    (item) => normalizeNameForCompare(item.full_name) === normalizedTarget,
  );

  if (byNormalized) {
    return { agent: byNormalized, method: 'nombre-normalizado' };
  }

  return { agent: null, method: 'no-encontrado' };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepository = app.get<Repository<Agent>>(
    getRepositoryToken(Agent),
  );
  const pofRepository = app.get<Repository<PofPosition>>(
    getRepositoryToken(PofPosition),
  );
  const assignmentsService = app.get(AssignmentsService);

  const importsDir = path.join(process.cwd(), 'imports');
  const agentsFile = path.join(importsDir, 'Planilla de Datos Agentes.xlsx');
  const pofFile = path.join(importsDir, 'POF - Okanta Organica Funcional.xlsx');
  const diagnosticsFile = path.join(importsDir, 'assignment-diagnostics.json');

  console.log('📥 Iniciando importación...');
  console.log('📂 Carpeta imports:', importsDir);

  const diagnostics: AssignmentDiagnostic[] = [];

  // =========================
  // 1. IMPORTAR AGENTES
  // =========================
  const agentsWorkbook = XLSX.readFile(agentsFile, { cellDates: true });
  const agentsSheetName = agentsWorkbook.SheetNames[0];
  const agentsSheet = agentsWorkbook.Sheets[agentsSheetName];

  const agentRows = XLSX.utils.sheet_to_json<AgentRow>(agentsSheet, {
    defval: '',
    raw: false,
  });

  let createdAgents = 0;
  let updatedAgents = 0;

  for (const row of agentRows) {
    const dni = normalizeDni(row.DNI);
    const docente = normalizeString(row.DOCENTE);

    if (!dni || !docente) continue;

    const nameParts = splitFullName(docente);

    const payload: Partial<Agent> = {
      full_name: nameParts.full_name || docente,
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
      dni,
      birth_date: toDateOnly(row['Fecha de Nacimiento']) as unknown as Date,
      email: normalizeString(row['E-mail']),
      address: normalizeString(row.Domicilio),
      phone: normalizeString(row['Teléfono Fijo']),
      mobile: normalizeString(row.Celular),
      titles: normalizeString(
        row['Título que posee (tal cual figura en su título)'],
      ),
      identity_card_number: normalizeString(row['Cédula de Identidad']),
      board_file_number: normalizeString(row['Junta de clasificacion']),
      secondary_board_number: normalizeString(row['junta de nivel secundario']),
      teaching_entry_date: toDateOnly(
        row['Fecha de Inicio en la Docencia'],
      ) as unknown as Date,
      school_entry_date: toDateOnly(
        row['Fecha de Inicio en la Escuela'],
      ) as unknown as Date,
      is_active: true,
    };

    const existing = await agentsRepository.findOne({
      where: { dni },
    });

    if (existing) {
      await agentsRepository.update(existing.id, payload);
      updatedAgents += 1;
    } else {
      const created = agentsRepository.create(payload);
      await agentsRepository.save(created);
      createdAgents += 1;
    }
  }

  console.log(`✅ Agentes creados: ${createdAgents}`);
  console.log(`♻️ Agentes actualizados: ${updatedAgents}`);

  // =========================
  // 2. IMPORTAR POF
  // =========================
  const pofWorkbook = XLSX.readFile(pofFile, { cellDates: true });
  const pofSheetName = pofWorkbook.SheetNames[0];
  const pofSheet = pofWorkbook.Sheets[pofSheetName];

  const pofRows = XLSX.utils.sheet_to_json<PofRow>(pofSheet, {
    defval: '',
    raw: false,
  });

  let createdPof = 0;
  let updatedPof = 0;
  let createdAssignments = 0;
  let createdBajas = 0;
  let skippedAssignments = 0;
  let fallbackAgents = 0;
  let linkedByDni = 0;
  let linkedByExactName = 0;
  let linkedByInsensitiveName = 0;
  let linkedByNormalizedName = 0;

  for (let i = 0; i < pofRows.length; i += 1) {
    const row = pofRows[i];
    const rowNumber = i + 2;

    const plazaNumber = normalizeString(row.PLAZA);
    if (!plazaNumber) continue;

    const startDate = toDateOnly(row['TOMA DE PO']);
    const endDate = toDateOnly(row.HASTA);

    const pofPayload: Partial<PofPosition> = {
      plaza_number: plazaNumber,
      subject_name: normalizeString(row.ASIGNATURA),
      hours_count: normalizeNumber(row.HS),
      course: normalizeString(row.CURSO),
      division: normalizeString(row['DIV.']),
      shift: normalizeString(row.TURNO),
      start_date: startDate as unknown as Date,
      end_date: endDate as unknown as Date,
      revista_status: normalizeString(row['SIT. REVISTA']),
      legal_norm: normalizeString(row['NORM LEGAL']),
      modality: normalizeString(row.MODALIDAD),
      notes: normalizeString(row.OBSERVACIONES),
      is_active: true,
    };

    const existingPof = await pofRepository.findOne({
      where: { plaza_number: plazaNumber },
    });

    if (existingPof) {
      await pofRepository.update(existingPof.id, pofPayload);
      updatedPof += 1;
    } else {
      const created = pofRepository.create(pofPayload);
      await pofRepository.save(created);
      createdPof += 1;
    }

    const dni = normalizeDni(row.DNI);
    const docente = normalizeString(row['NOMBRE Y APELLIDO']);

    if (!docente) {
      skippedAssignments += 1;
      diagnostics.push({
        row_number: rowNumber,
        plaza_number: plazaNumber,
        dni,
        docente,
        start_date: startDate,
        end_date: endDate,
        metodo_busqueda: 'sin-nombre',
        motivo: 'Fila sin NOMBRE Y APELLIDO',
      });
      continue;
    }

    let { agent, method } = await findAgentByIdentity(
      agentsRepository,
      dni,
      docente,
    );

    if (!agent && dni) {
      const nameParts = splitFullName(docente);

      const fallbackAgent = agentsRepository.create({
        full_name: nameParts.full_name || docente,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        dni,
        is_active: true,
      });

      agent = await agentsRepository.save(fallbackAgent);
      fallbackAgents += 1;
      method = 'creado-desde-pof';
    }

    if (!agent) {
      skippedAssignments += 1;
      diagnostics.push({
        row_number: rowNumber,
        plaza_number: plazaNumber,
        dni,
        docente,
        start_date: startDate,
        end_date: endDate,
        metodo_busqueda: method,
        motivo: 'No se encontró agente por DNI ni por nombre',
      });

      if (diagnostics.length <= 10) {
        console.log(
          `⚠️ Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | No se encontró agente`,
        );
      }
      continue;
    }

    if (method === 'dni') linkedByDni += 1;
    if (method === 'nombre-exacto') linkedByExactName += 1;
    if (method === 'nombre-ilike') linkedByInsensitiveName += 1;
    if (method === 'nombre-normalizado') linkedByNormalizedName += 1;

    try {
      await assignmentsService.createByPlazaNumber({
        agent_id: agent.id,
        plaza_number: plazaNumber,
        movement_type: 'DESIGNACION',
        legal_norm_type: 'RESOLUCION_MINISTERIAL',
        legal_norm_number: normalizeString(row['NORM LEGAL']),
        assignment_date: startDate,
        status: 'ACTIVA',
        notes: normalizeString(row.OBSERVACIONES),
      });

      createdAssignments += 1;

      if (endDate) {
        await assignmentsService.createByPlazaNumber({
          agent_id: agent.id,
          plaza_number: plazaNumber,
          movement_type: 'BAJA',
          legal_norm_type: 'RESOLUCION_MINISTERIAL',
          legal_norm_number: normalizeString(row['NORM LEGAL']),
          assignment_date: endDate,
          end_date: endDate,
          status: 'FINALIZADA',
          notes: 'Baja generada automáticamente desde importación inicial',
        });

        createdBajas += 1;
      }
    } catch (error) {
      skippedAssignments += 1;

      const motivo =
        error instanceof Error ? error.message : 'error desconocido';

      diagnostics.push({
        row_number: rowNumber,
        plaza_number: plazaNumber,
        dni,
        docente,
        start_date: startDate,
        end_date: endDate,
        metodo_busqueda: method,
        agente_encontrado: agent.full_name,
        motivo,
      });

      if (diagnostics.length <= 10) {
        console.log(
          `⚠️ Fila ${rowNumber} | Plaza ${plazaNumber} | Docente ${docente} | Método ${method} | ${motivo}`,
        );
      }
    }
  }

  fs.writeFileSync(
    diagnosticsFile,
    JSON.stringify(diagnostics, null, 2),
    'utf-8',
  );

  console.log(`✅ POF creadas: ${createdPof}`);
  console.log(`♻️ POF actualizadas: ${updatedPof}`);
  console.log(`✅ Designaciones creadas: ${createdAssignments}`);
  console.log(`✅ Bajas creadas: ${createdBajas}`);
  console.log(`🆕 Agentes mínimos creados desde POF: ${fallbackAgents}`);
  console.log(`🔎 Vinculadas por DNI: ${linkedByDni}`);
  console.log(`🔎 Vinculadas por nombre exacto: ${linkedByExactName}`);
  console.log(`🔎 Vinculadas por nombre ILIKE: ${linkedByInsensitiveName}`);
  console.log(`🔎 Vinculadas por nombre normalizado: 
    ${linkedByNormalizedName}`);
  console.log(`⚠️ Asignaciones omitidas: ${skippedAssignments}`);
  console.log(`📝 Diagnóstico guardado en: ${diagnosticsFile}`);
  console.log('🎉 Importación finalizada.');

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Error en la importación:', error);
  process.exit(1);
});
