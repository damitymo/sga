import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { AssignmentsService } from '../assignments/assignments.service';

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

type SuggestedMatch = {
  row_number: number;
  plaza_number?: string;
  docente_pof?: string;
  motivo: string;
  suggestions: Array<{
    agent_id: number;
    full_name: string;
    dni: string;
    score: number;
  }>;
};

type AppliedResult = {
  row_number: number;
  plaza_number?: string;
  docente_pof?: string;
  agent_id: number;
  agent_name: string;
  score: number;
  second_score?: number;
  rule: string;
  resultado: 'DESIGNACION_OK' | 'BAJA_OK' | 'YA_EXISTIA' | 'ERROR';
  detalle?: string;
};

type PendingResult = {
  row_number: number;
  plaza_number?: string;
  docente_pof?: string;
  motivo: string;
  best_score?: number;
  second_score?: number;
  suggested_agent?: string;
};

const STRICT_THRESHOLD = 0.75;
const STRICT_GAP = 0.12;

const LAST_NAME_THRESHOLD = 0.7;
const LAST_NAME_GAP = 0.08;

function normalizeName(value?: string): string {
  if (!value) return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .toUpperCase();
}

function getLastNameTokens(value?: string): string[] {
  const normalized = normalizeName(value);
  if (!normalized) return [];

  if (normalized.includes(',')) {
    const beforeComma = normalized.split(',')[0].trim();
    return beforeComma.split(' ').filter(Boolean);
  }

  return normalized.split(' ').slice(0, 2).filter(Boolean);
}

function hasStrongLastNameMatch(a?: string, b?: string): boolean {
  const aTokens = getLastNameTokens(a);
  const bTokens = getLastNameTokens(b);

  if (aTokens.length === 0 || bTokens.length === 0) return false;

  return aTokens.some((token) => bTokens.includes(token));
}

function getMatchRule(item: SuggestedMatch): string | null {
  const best = item.suggestions[0];
  if (!best) return null;

  const second = item.suggestions[1];
  const secondScore = second?.score ?? 0;
  const gap = best.score - secondScore;

  if (best.score >= STRICT_THRESHOLD && gap >= STRICT_GAP) {
    return 'strict-score-gap';
  }

  if (
    best.score >= LAST_NAME_THRESHOLD &&
    gap >= LAST_NAME_GAP &&
    hasStrongLastNameMatch(item.docente_pof, best.full_name)
  ) {
    return 'lastname-score-gap';
  }

  return null;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepository = app.get<Repository<Agent>>(
    getRepositoryToken(Agent),
  );
  const assignmentsService = app.get<AssignmentsService>(AssignmentsService);

  const importsDir = path.join(process.cwd(), 'imports');
  const diagnosticsFile = path.join(importsDir, 'assignment-diagnostics.json');
  const suggestionsFile = path.join(importsDir, 'assignment-suggestions.json');
  const appliedFile = path.join(
    importsDir,
    'assignment-applied-third-pass.json',
  );
  const pendingFile = path.join(
    importsDir,
    'assignment-pending-review-third-pass.json',
  );

  if (!fs.existsSync(diagnosticsFile)) {
    throw new Error(`No existe ${diagnosticsFile}`);
  }

  if (!fs.existsSync(suggestionsFile)) {
    throw new Error(`No existe ${suggestionsFile}`);
  }

  const diagnostics = JSON.parse(
    fs.readFileSync(diagnosticsFile, 'utf-8'),
  ) as AssignmentDiagnostic[];

  const suggestions = JSON.parse(
    fs.readFileSync(suggestionsFile, 'utf-8'),
  ) as SuggestedMatch[];

  const diagnosticsByRow = new Map<number, AssignmentDiagnostic>();
  diagnostics.forEach((item) => diagnosticsByRow.set(item.row_number, item));

  const applied: AppliedResult[] = [];
  const pending: PendingResult[] = [];

  let autoAccepted = 0;
  let autoRejected = 0;
  let successAssignments = 0;
  let successBajas = 0;
  let alreadyExists = 0;
  let errors = 0;
  let acceptedStrict = 0;
  let acceptedLastName = 0;

  for (const item of suggestions) {
    const best = item.suggestions[0];
    const second = item.suggestions[1];
    const rule = getMatchRule(item);

    if (!best || !rule) {
      pending.push({
        row_number: item.row_number,
        plaza_number: item.plaza_number,
        docente_pof: item.docente_pof,
        motivo: 'Sin coincidencia automática segura en tercera pasada',
        best_score: best?.score,
        second_score: second?.score,
        suggested_agent: best?.full_name,
      });
      autoRejected += 1;
      continue;
    }

    const diagnostic = diagnosticsByRow.get(item.row_number);

    if (!diagnostic || !diagnostic.plaza_number || !diagnostic.docente) {
      pending.push({
        row_number: item.row_number,
        plaza_number: item.plaza_number,
        docente_pof: item.docente_pof,
        motivo: 'No se encontró la fila de diagnóstico completa',
        best_score: best.score,
        second_score: second?.score,
        suggested_agent: best.full_name,
      });
      autoRejected += 1;
      continue;
    }

    const agent = await agentsRepository.findOne({
      where: { id: best.agent_id },
    });

    if (!agent) {
      pending.push({
        row_number: item.row_number,
        plaza_number: item.plaza_number,
        docente_pof: item.docente_pof,
        motivo: 'El agente sugerido ya no existe',
        best_score: best.score,
        second_score: second?.score,
        suggested_agent: best.full_name,
      });
      autoRejected += 1;
      continue;
    }

    autoAccepted += 1;
    if (rule === 'strict-score-gap') acceptedStrict += 1;
    if (rule === 'lastname-score-gap') acceptedLastName += 1;

    try {
      await assignmentsService.createByPlazaNumber({
        agent_id: agent.id,
        plaza_number: diagnostic.plaza_number,
        movement_type: 'DESIGNACION',
        assignment_date: diagnostic.start_date,
        status: 'ACTIVA',
        notes: `Asignación conciliada automáticamente en tercera pasada (${rule})`,
      });

      applied.push({
        row_number: item.row_number,
        plaza_number: diagnostic.plaza_number,
        docente_pof: diagnostic.docente,
        agent_id: agent.id,
        agent_name: agent.full_name,
        score: best.score,
        second_score: second?.score,
        rule,
        resultado: 'DESIGNACION_OK',
      });

      successAssignments += 1;

      if (diagnostic.end_date) {
        try {
          await assignmentsService.createByPlazaNumber({
            agent_id: agent.id,
            plaza_number: diagnostic.plaza_number,
            movement_type: 'BAJA',
            assignment_date: diagnostic.end_date,
            end_date: diagnostic.end_date,
            status: 'FINALIZADA',
            notes: 'Baja conciliada automáticamente en tercera pasada',
          });

          applied.push({
            row_number: item.row_number,
            plaza_number: diagnostic.plaza_number,
            docente_pof: diagnostic.docente,
            agent_id: agent.id,
            agent_name: agent.full_name,
            score: best.score,
            second_score: second?.score,
            rule,
            resultado: 'BAJA_OK',
          });

          successBajas += 1;
        } catch (error: unknown) {
          const detail =
            error instanceof Error ? error.message : 'Error desconocido';

          applied.push({
            row_number: item.row_number,
            plaza_number: diagnostic.plaza_number,
            docente_pof: diagnostic.docente,
            agent_id: agent.id,
            agent_name: agent.full_name,
            score: best.score,
            second_score: second?.score,
            rule,
            resultado: 'ERROR',
            detalle: `La designación se creó, pero la baja falló: ${detail}`,
          });

          errors += 1;
        }
      }
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : 'Error desconocido';

      if (
        typeof detail === 'string' &&
        detail.includes('ya está activa para este docente')
      ) {
        applied.push({
          row_number: item.row_number,
          plaza_number: diagnostic.plaza_number,
          docente_pof: diagnostic.docente,
          agent_id: agent.id,
          agent_name: agent.full_name,
          score: best.score,
          second_score: second?.score,
          rule,
          resultado: 'YA_EXISTIA',
          detalle: detail,
        });

        alreadyExists += 1;
      } else {
        applied.push({
          row_number: item.row_number,
          plaza_number: diagnostic.plaza_number,
          docente_pof: diagnostic.docente,
          agent_id: agent.id,
          agent_name: agent.full_name,
          score: best.score,
          second_score: second?.score,
          rule,
          resultado: 'ERROR',
          detalle: detail,
        });

        errors += 1;
      }
    }
  }

  fs.writeFileSync(appliedFile, JSON.stringify(applied, null, 2), 'utf-8');
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2), 'utf-8');

  console.log(`✅ Coincidencias automáticas aceptadas (3ra pasada):
     ${autoAccepted}`);
  console.log(`   └─ Por regla estricta: ${acceptedStrict}`);
  console.log(`   └─ Por apellido fuerte: ${acceptedLastName}`);
  console.log(`⚠️ Coincidencias enviadas a revisión (3ra pasada):
     ${autoRejected}`);
  console.log(`✅ Designaciones creadas (3ra pasada): ${successAssignments}`);
  console.log(`✅ Bajas creadas (3ra pasada): ${successBajas}`);
  console.log(`♻️ Ya existentes (3ra pasada): ${alreadyExists}`);
  console.log(`❌ Errores (3ra pasada): ${errors}`);
  console.log(`📝 Aplicadas: ${appliedFile}`);
  console.log(`📝 Pendientes: ${pendingFile}`);

  await app.close();
}

bootstrap().catch((error: unknown) => {
  console.error('❌ Error aplicando sugerencias en tercera pasada:', error);
  process.exit(1);
});
