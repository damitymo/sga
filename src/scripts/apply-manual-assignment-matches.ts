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

type ManualMatch = {
  row_number: number;
  agent_id: number;
};

type AppliedResult = {
  row_number: number;
  plaza_number?: string;
  docente_pof?: string;
  agent_id: number;
  agent_name: string;
  resultado: 'DESIGNACION_OK' | 'BAJA_OK' | 'YA_EXISTIA' | 'ERROR';
  detalle?: string;
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepository = app.get<Repository<Agent>>(
    getRepositoryToken(Agent),
  );
  const assignmentsService = app.get<AssignmentsService>(AssignmentsService);

  const importsDir = path.join(process.cwd(), 'imports');
  const diagnosticsFile = path.join(importsDir, 'assignment-diagnostics.json');
  const manualMatchesFile = path.join(
    importsDir,
    'manual-assignment-matches.json',
  );
  const appliedFile = path.join(importsDir, 'assignment-applied-manual.json');

  if (!fs.existsSync(diagnosticsFile)) {
    throw new Error(`No existe ${diagnosticsFile}`);
  }

  if (!fs.existsSync(manualMatchesFile)) {
    throw new Error(`No existe ${manualMatchesFile}`);
  }

  const diagnostics = JSON.parse(
    fs.readFileSync(diagnosticsFile, 'utf-8'),
  ) as AssignmentDiagnostic[];

  const manualMatches = JSON.parse(
    fs.readFileSync(manualMatchesFile, 'utf-8'),
  ) as ManualMatch[];

  const diagnosticsByRow = new Map<number, AssignmentDiagnostic>();
  diagnostics.forEach((item) => diagnosticsByRow.set(item.row_number, item));

  const applied: AppliedResult[] = [];

  let processed = 0;
  let successAssignments = 0;
  let successBajas = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const match of manualMatches) {
    processed += 1;

    const diagnostic = diagnosticsByRow.get(match.row_number);

    if (!diagnostic || !diagnostic.plaza_number || !diagnostic.docente) {
      applied.push({
        row_number: match.row_number,
        agent_id: match.agent_id,
        agent_name: '',
        resultado: 'ERROR',
        detalle: 'No se encontró la fila de diagnóstico correspondiente',
      });
      errors += 1;
      continue;
    }

    const agent = await agentsRepository.findOne({
      where: { id: match.agent_id },
    });

    if (!agent) {
      applied.push({
        row_number: match.row_number,
        plaza_number: diagnostic.plaza_number,
        docente_pof: diagnostic.docente,
        agent_id: match.agent_id,
        agent_name: '',
        resultado: 'ERROR',
        detalle: 'No existe el agent_id indicado',
      });
      errors += 1;
      continue;
    }

    try {
      await assignmentsService.createByPlazaNumber({
        agent_id: agent.id,
        plaza_number: diagnostic.plaza_number,
        movement_type: 'DESIGNACION',
        assignment_date: diagnostic.start_date,
        status: 'ACTIVA',
        notes: 'Asignación conciliada manualmente',
      });

      applied.push({
        row_number: match.row_number,
        plaza_number: diagnostic.plaza_number,
        docente_pof: diagnostic.docente,
        agent_id: agent.id,
        agent_name: agent.full_name,
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
            notes: 'Baja conciliada manualmente',
          });

          applied.push({
            row_number: match.row_number,
            plaza_number: diagnostic.plaza_number,
            docente_pof: diagnostic.docente,
            agent_id: agent.id,
            agent_name: agent.full_name,
            resultado: 'BAJA_OK',
          });

          successBajas += 1;
        } catch (error: unknown) {
          const detail =
            error instanceof Error ? error.message : 'Error desconocido';

          applied.push({
            row_number: match.row_number,
            plaza_number: diagnostic.plaza_number,
            docente_pof: diagnostic.docente,
            agent_id: agent.id,
            agent_name: agent.full_name,
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
          row_number: match.row_number,
          plaza_number: diagnostic.plaza_number,
          docente_pof: diagnostic.docente,
          agent_id: agent.id,
          agent_name: agent.full_name,
          resultado: 'YA_EXISTIA',
          detalle: detail,
        });

        alreadyExists += 1;
      } else {
        applied.push({
          row_number: match.row_number,
          plaza_number: diagnostic.plaza_number,
          docente_pof: diagnostic.docente,
          agent_id: agent.id,
          agent_name: agent.full_name,
          resultado: 'ERROR',
          detalle: detail,
        });

        errors += 1;
      }
    }
  }

  fs.writeFileSync(appliedFile, JSON.stringify(applied, null, 2), 'utf-8');

  console.log(`✅ Registros manuales procesados: ${processed}`);
  console.log(`✅ Designaciones creadas manualmente: ${successAssignments}`);
  console.log(`✅ Bajas creadas manualmente: ${successBajas}`);
  console.log(`♻️ Ya existentes manualmente: ${alreadyExists}`);
  console.log(`❌ Errores manuales: ${errors}`);
  console.log(`📝 Archivo generado: ${appliedFile}`);

  await app.close();
}

bootstrap().catch((error: unknown) => {
  console.error('❌ Error aplicando conciliación manual:', error);
  process.exit(1);
});
