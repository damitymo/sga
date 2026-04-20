import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../attendance/entities/attendance-record.entity';

type DiagnosticItem = {
  sheet_name: string;
  teacher_name?: string;
  dni?: string;
  month?: number;
  day?: number;
  raw_code?: string;
  reason: string;
};

type ImportSummary = {
  sheets_processed: number;
  records_created: number;
  duplicates_skipped: number;
  codes_skipped: number;
  agents_not_found: number;
  sheets_skipped: number;
  errors: number;
};

type MappedCodeResult = {
  status?: AttendanceStatus;
  skip: boolean;
  note?: string;
};

const MONTH_ROW_START = 14;
const MONTH_ROW_END = 25;
const DAY_COL_START = 2;
const DAY_COL_END = 32;

const MONTH_MAP: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

function getCellValue(
  sheet: XLSX.WorkSheet,
  address: string,
): string | number | undefined {
  const cell = sheet[address] as XLSX.CellObject | undefined;

  if (!cell) return undefined;

  const rawValue = cell.v;
  const formattedValue = cell.w;

  if (typeof rawValue === 'string' || typeof rawValue === 'number') {
    return rawValue;
  }

  if (
    rawValue !== null &&
    rawValue !== undefined &&
    typeof rawValue !== 'object'
  ) {
    return String(rawValue);
  }

  if (
    typeof formattedValue === 'string' ||
    typeof formattedValue === 'number'
  ) {
    return formattedValue;
  }

  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  const text = String(value).trim();

  if (!text) return undefined;

  return text;
}

function normalizeDni(value: unknown): string | undefined {
  const text = normalizeString(value);
  if (!text) return undefined;

  return text.replace(/\.0$/, '').replace(/\D/g, '');
}

function normalizeName(value?: string): string {
  if (!value) return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeTeacherNameForCompare(value?: string): string {
  const normalized = normalizeName(value);

  return normalized
    .replace(/\bJEFE DPTO\b/g, '')
    .replace(/\bJEFE DPTO\.\b/g, '')
    .replace(/\bJEFE\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAttendanceSheet(sheet: XLSX.WorkSheet): boolean {
  const title = normalizeString(getCellValue(sheet, 'A1'));

  return (
    normalizeName(title) ===
    'LIBRO DE ASISTENCIA INDIVIDUAL DEL PERSONAL DOCENTE'
  );
}

function extractTeacherName(sheet: XLSX.WorkSheet): string | undefined {
  return normalizeString(getCellValue(sheet, 'B3'));
}

function extractTeacherDni(sheet: XLSX.WorkSheet): string | undefined {
  return normalizeDni(getCellValue(sheet, 'Z3'));
}

function extractMonthNumber(rawMonthCell: unknown): number | undefined {
  const text = normalizeString(rawMonthCell);
  if (!text) return undefined;

  const clean = normalizeName(text).replace(/\./g, '');
  const monthName = Object.keys(MONTH_MAP).find((key) => clean.startsWith(key));

  if (!monthName) return undefined;

  return MONTH_MAP[monthName];
}

function buildDateOnly(
  year: number,
  month: number,
  day: number,
): string | null {
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(
    2,
    '0',
  )}-${String(day).padStart(2, '0')}`;
}

function normalizeRawCode(value: unknown): string | undefined {
  const text = normalizeString(value);
  if (!text) return undefined;

  return text.toUpperCase();
}

function mapCodeToImport(rawCode?: string): MappedCodeResult {
  const code = normalizeRawCode(rawCode);

  if (!code) {
    return { skip: true };
  }

  if (['S', 'D', 'F'].includes(code)) {
    return { skip: true, note: 'Fin de semana o feriado' };
  }

  if (code === 'P') {
    return { status: AttendanceStatus.PRESENTE, skip: false };
  }

  if (code === 'AI' || code === 'IJ') {
    return {
      status: AttendanceStatus.AUSENTE_INJUSTIFICADO,
      skip: false,
    };
  }

  if (code === 'AJ') {
    return {
      status: AttendanceStatus.LICENCIA,
      skip: false,
      note: 'Importado como LICENCIA desde código AJ',
    };
  }

  if (code === 'L1' || code === 'L2') {
    return { status: AttendanceStatus.LICENCIA, skip: false };
  }

  return {
    skip: true,
    note: `Código no soportado por el esquema actual: ${code}`,
  };
}

function findBestAgent(
  agents: Agent[],
  dni?: string,
  teacherName?: string,
): Agent | null {
  if (dni) {
    const byDni = agents.find((agent) => normalizeDni(agent.dni) === dni);
    if (byDni) return byDni;
  }

  const safeTeacherName = normalizeTeacherNameForCompare(teacherName);
  if (!safeTeacherName) return null;

  const byNormalizedFullName = agents.find(
    (agent) =>
      normalizeTeacherNameForCompare(agent.full_name) === safeTeacherName,
  );

  if (byNormalizedFullName) return byNormalizedFullName;

  const bySplitNames = agents.find((agent) => {
    const lastName = normalizeTeacherNameForCompare(agent.last_name ?? '');
    const firstName = normalizeTeacherNameForCompare(agent.first_name ?? '');
    const rebuilt = `${lastName}${lastName && firstName ? ', ' : ''}${firstName}`;

    return rebuilt === safeTeacherName;
  });

  if (bySplitNames) return bySplitNames;

  return null;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const agentsRepository = app.get<Repository<Agent>>(
      getRepositoryToken(Agent),
    );

    const attendanceRepository = app.get<Repository<AttendanceRecord>>(
      getRepositoryToken(AttendanceRecord),
    );

    const filePathArg = process.argv[2];
    const workbookPath = filePathArg
      ? path.resolve(process.cwd(), filePathArg)
      : path.resolve(process.cwd(), 'imports', 'attendance2025.xlsx');

    if (!fs.existsSync(workbookPath)) {
      throw new Error(`No existe el archivo: ${workbookPath}`);
    }

    const workbook = XLSX.readFile(workbookPath, {
      cellDates: false,
      raw: false,
    });

    console.log(`Archivo abierto: ${workbookPath}`);
    console.log(`Hojas detectadas: ${workbook.SheetNames.length}`);
    console.log('Iniciando recorrido de hojas...');

    const allAgents = await agentsRepository.find({
      where: { is_active: true },
      order: { full_name: 'ASC' },
    });

    const diagnostics: DiagnosticItem[] = [];
    const summary: ImportSummary = {
      sheets_processed: 0,
      records_created: 0,
      duplicates_skipped: 0,
      codes_skipped: 0,
      agents_not_found: 0,
      sheets_skipped: 0,
      errors: 0,
    };

    const batchId = `attendance-import-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}`;

    const importsDir = path.join(process.cwd(), 'imports');

    if (!fs.existsSync(importsDir)) {
      fs.mkdirSync(importsDir, { recursive: true });
    }

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      if (!sheet || !isAttendanceSheet(sheet)) {
        summary.sheets_skipped += 1;
        continue;
      }

      const teacherName = extractTeacherName(sheet);
      const dni = extractTeacherDni(sheet);

      if (!teacherName && !dni) {
        diagnostics.push({
          sheet_name: sheetName,
          reason: 'Hoja plantilla o sin nombre/DNI del docente',
        });
        summary.sheets_skipped += 1;
        continue;
      }

      const agent = findBestAgent(allAgents, dni, teacherName);

      if (!agent) {
        diagnostics.push({
          sheet_name: sheetName,
          teacher_name: teacherName,
          dni,
          reason: 'No se encontró agente por DNI ni por nombre',
        });
        summary.agents_not_found += 1;
        continue;
      }

      summary.sheets_processed += 1;

      console.log(
        `Procesando hoja ${summary.sheets_processed}: ${sheetName} | Docente: ${
          teacherName ?? 'SIN_NOMBRE'
        } | DNI: ${dni ?? 'SIN_DNI'}`,
      );

      for (let row = MONTH_ROW_START; row <= MONTH_ROW_END; row += 1) {
        const monthCellAddress = `A${row}`;
        const monthNumber = extractMonthNumber(
          getCellValue(sheet, monthCellAddress),
        );

        if (!monthNumber) {
          continue;
        }

        for (let col = DAY_COL_START; col <= DAY_COL_END; col += 1) {
          const dayHeaderAddress = XLSX.utils.encode_cell({
            r: 12,
            c: col - 1,
          });
          const cellAddress = XLSX.utils.encode_cell({
            r: row - 1,
            c: col - 1,
          });

          const dayValue = getCellValue(sheet, dayHeaderAddress);
          const rawCode = normalizeRawCode(getCellValue(sheet, cellAddress));

          const day = Number(dayValue);

          if (!day || Number.isNaN(day)) {
            continue;
          }

          const mapped = mapCodeToImport(rawCode);

          if (mapped.skip) {
            if (rawCode) {
              diagnostics.push({
                sheet_name: sheetName,
                teacher_name: teacherName,
                dni,
                month: monthNumber,
                day,
                raw_code: rawCode,
                reason: mapped.note ?? 'Código omitido',
              });
              summary.codes_skipped += 1;
            }
            continue;
          }

          const attendanceDate = buildDateOnly(2025, monthNumber, day);

          if (!attendanceDate) {
            diagnostics.push({
              sheet_name: sheetName,
              teacher_name: teacherName,
              dni,
              month: monthNumber,
              day,
              raw_code: rawCode,
              reason: 'Fecha inválida al construir attendance_date',
            });
            summary.errors += 1;
            continue;
          }

          try {
            const existing = await attendanceRepository.findOne({
              where: {
                agent_id: agent.id,
                attendance_date: attendanceDate,
                source_sheet_name: sheetName,
              },
            });

            if (existing) {
              summary.duplicates_skipped += 1;
              continue;
            }

            const record = attendanceRepository.create({
              agent_id: agent.id,
              attendance_date: attendanceDate,
              year: 2025,
              month: monthNumber,
              day,
              status: mapped.status!,
              raw_code: rawCode ?? null,
              condition_type: null,
              shift: null,
              source_sheet_name: sheetName,
              source_agent_name: teacherName ?? agent.full_name,
              source_dni: dni ?? agent.dni,
              observation: mapped.note ?? null,
              import_batch_id: batchId,
            });

            await attendanceRepository.save(record);
            summary.records_created += 1;

            if (summary.records_created % 100 === 0) {
              console.log(
                `Registros creados hasta ahora: ${summary.records_created}`,
              );
            }
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : 'Error desconocido';

            diagnostics.push({
              sheet_name: sheetName,
              teacher_name: teacherName,
              dni,
              month: monthNumber,
              day,
              raw_code: rawCode,
              reason: message,
            });
            summary.errors += 1;
          }
        }
      }
    }

    console.log('Recorrido finalizado. Generando resumen...');

    const diagnosticsPath = path.join(
      importsDir,
      `${batchId}-diagnostics.json`,
    );

    fs.writeFileSync(
      diagnosticsPath,
      JSON.stringify(
        {
          workbook: workbookPath,
          batch_id: batchId,
          summary,
          diagnostics,
        },
        null,
        2,
      ),
      'utf-8',
    );

    console.log('====================================================');
    console.log('IMPORTACIÓN DE ASISTENCIAS 2025');
    console.log('====================================================');
    console.log(`Archivo: ${workbookPath}`);
    console.log(`Batch ID: ${batchId}`);
    console.log(`Hojas procesadas: ${summary.sheets_processed}`);
    console.log(`Registros creados: ${summary.records_created}`);
    console.log(`Duplicados salteados: ${summary.duplicates_skipped}`);
    console.log(`Códigos omitidos: ${summary.codes_skipped}`);
    console.log(`Docentes no encontrados: ${summary.agents_not_found}`);
    console.log(`Hojas salteadas: ${summary.sheets_skipped}`);
    console.log(`Errores: ${summary.errors}`);
    console.log(`Diagnóstico: ${diagnosticsPath}`);
    console.log('====================================================');
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('❌ Error en importación de asistencias');
  console.error(error);
  process.exit(1);
});
