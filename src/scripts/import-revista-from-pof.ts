import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { AssignmentsService } from '../assignments/assignments.service';

type PofRow = {
  PLAZA?: string | number;
  'NOMBRE Y APELLIDO'?: string;
  DNI?: string | number;
  'TOMA DE PO'?: string | number | Date;
  HASTA?: string | number | Date;
  'SIT. REVISTA'?: string;
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

  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'nan') return undefined;

  return text;
}

function normalizeDni(value: unknown): string | undefined {
  const text = normalizeString(value);
  if (!text) return undefined;

  return text.replace(/\.0$/, '').replace(/\D/g, '');
}

function toDateOnly(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
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
    return text;
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

    if (a > 12) {
      return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }

    return `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }

  return undefined;
}

function normalizeNameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function tokenizeName(value: string): string[] {
  return normalizeNameKey(value)
    .split(' ')
    .filter((token) => token.length > 2);
}

function getScore(a: string, b: string): number {
  const tokensA = tokenizeName(a);
  const tokensB = tokenizeName(b);

  if (!tokensA.length || !tokensB.length) return 0;

  const setB = new Set(tokensB);
  let matches = 0;

  for (const token of tokensA) {
    if (setB.has(token)) matches += 1;
  }

  return matches / Math.max(tokensA.length, tokensB.length);
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

function normalizeCharacterType(
  value: unknown,
): 'TITULAR' | 'INTERINO' | 'SUPLENTE' {
  const text = normalizeString(value)?.toUpperCase();

  if (text === 'INTERINO') return 'INTERINO';
  if (text === 'SUPLENTE') return 'SUPLENTE';

  return 'TITULAR';
}

type AgentCache = {
  all: Agent[];
  byDni: Map<string, Agent>;
  byName: Map<string, Agent>;
};

function buildAgentCache(agents: Agent[]): AgentCache {
  const byDni = new Map<string, Agent>();
  const byName = new Map<string, Agent>();

  for (const agent of agents) {
    if (agent.dni) {
      byDni.set(agent.dni, agent);
    }

    byName.set(normalizeNameKey(agent.full_name), agent);
  }

  return { all: agents, byDni, byName };
}

function findAgentInCache(
  cache: AgentCache,
  dni?: string,
  name?: string,
): Agent | null {
  if (dni) {
    const byDni = cache.byDni.get(dni);
    if (byDni) return byDni;
  }

  if (!name) return null;

  const normalizedName = normalizeNameKey(name);
  const exactByName = cache.byName.get(normalizedName);
  if (exactByName) return exactByName;

  let best: Agent | null = null;
  let bestScore = 0;

  for (const agent of cache.all) {
    const score = getScore(name, agent.full_name);

    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  return bestScore >= 0.75 ? best : null;
}

function isDuplicateActiveError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(
    'Esa plaza ya está activa para este docente. No se puede designar nuevamente.',
  );
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepo = app.get<Repository<Agent>>(getRepositoryToken(Agent));
  const assignmentsService = app.get(AssignmentsService);

  const filePath = process.argv[2];

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Archivo no encontrado');
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<PofRow>(sheet, { defval: '' });

  console.log(`📄 Archivo: ${filePath}`);
  console.log(`📚 Hoja: ${workbook.SheetNames[0]}`);
  console.log(`🧾 Filas: ${rows.length}`);
  console.log('📥 Cargando agentes en memoria...');

  const existingAgents = await agentsRepo.find({
    select: ['id', 'full_name', 'first_name', 'last_name', 'dni', 'is_active'],
  });

  const cache = buildAgentCache(existingAgents);

  console.log(`👥 Agentes cargados: ${cache.all.length}`);
  console.log('🚀 Iniciando procesamiento...');

  let createdAgents = 0;
  let createdDesignaciones = 0;
  let createdBajas = 0;
  let skipped = 0;
  let duplicatesSkipped = 0;

  const processedDesignaciones = new Set<string>();
  const processedBajas = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];

    const docente = normalizeString(row['NOMBRE Y APELLIDO']);
    const dni = normalizeDni(row.DNI);
    const plaza = normalizeString(row.PLAZA);

    if (!docente || !plaza) {
      skipped += 1;
      continue;
    }

    let agent = findAgentInCache(cache, dni, docente);

    if (!agent && dni) {
      const split = splitName(docente);

      const saved = await agentsRepo.save({
        ...split,
        dni,
        is_active: true,
      });

      cache.all.push(saved);
      if (saved.dni) cache.byDni.set(saved.dni, saved);
      cache.byName.set(normalizeNameKey(saved.full_name), saved);

      agent = saved;
      createdAgents += 1;
      console.log(`🆕 Creado: ${docente} (${dni})`);
    }

    if (!agent) {
      skipped += 1;
      continue;
    }

    const start = toDateOnly(row['TOMA DE PO']);
    const end = toDateOnly(row.HASTA);

    if (!start) {
      skipped += 1;
      continue;
    }

    const designacionKey = `${agent.id}|${plaza}|DESIGNACION|${start}`;

    if (!processedDesignaciones.has(designacionKey)) {
      try {
        await assignmentsService.createByPlazaNumber({
          agent_id: agent.id,
          plaza_number: plaza,
          movement_type: 'DESIGNACION',
          assignment_date: start,
          status: 'ACTIVA',
          character_type: normalizeCharacterType(row['SIT. REVISTA']),
        });

        createdDesignaciones += 1;
        processedDesignaciones.add(designacionKey);
      } catch (error: unknown) {
        if (isDuplicateActiveError(error)) {
          duplicatesSkipped += 1;
          processedDesignaciones.add(designacionKey);
        } else {
          throw error;
        }
      }
    } else {
      duplicatesSkipped += 1;
    }

    if (end) {
      const bajaKey = `${agent.id}|${plaza}|BAJA|${end}`;

      if (!processedBajas.has(bajaKey)) {
        try {
          await assignmentsService.createByPlazaNumber({
            agent_id: agent.id,
            plaza_number: plaza,
            movement_type: 'BAJA',
            assignment_date: start,
            end_date: end,
            status: 'FINALIZADA',
            character_type: normalizeCharacterType(row['SIT. REVISTA']),
          });

          createdBajas += 1;
          processedBajas.add(bajaKey);
        } catch (error: unknown) {
          if (isDuplicateActiveError(error)) {
            duplicatesSkipped += 1;
            processedBajas.add(bajaKey);
          } else {
            throw error;
          }
        }
      } else {
        duplicatesSkipped += 1;
      }
    }

    if ((i + 1) % 25 === 0) {
      console.log(`⏳ Procesadas ${i + 1} de ${rows.length} filas...`);
    }
  }

  console.log('\n✅ FIN');
  console.log(`Agentes creados automáticamente: ${createdAgents}`);
  console.log(`Designaciones creadas: ${createdDesignaciones}`);
  console.log(`Bajas creadas: ${createdBajas}`);
  console.log(`Duplicados salteados: ${duplicatesSkipped}`);
  console.log(`Filas salteadas: ${skipped}`);

  await app.close();
}

void bootstrap().catch((error: unknown) => {
  console.error('❌ Error en importación');
  console.error(error);
  process.exit(1);
});
