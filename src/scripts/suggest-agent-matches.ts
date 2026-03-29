import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import stringSimilarity from 'string-similarity';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';

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

function compareNames(a: string, b: string): number {
  const lib = stringSimilarity as unknown as {
    compareTwoStrings: (first: string, second: string) => number;
  };

  return lib.compareTwoStrings(a, b);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const agentsRepository = app.get<Repository<Agent>>(
    getRepositoryToken(Agent),
  );

  const importsDir = path.join(process.cwd(), 'imports');
  const diagnosticsFile = path.join(importsDir, 'assignment-diagnostics.json');
  const suggestionsFile = path.join(importsDir, 'assignment-suggestions.json');

  if (!fs.existsSync(diagnosticsFile)) {
    throw new Error(`No existe el archivo de diagnóstico: ${diagnosticsFile}`);
  }

  const diagnostics = JSON.parse(
    fs.readFileSync(diagnosticsFile, 'utf-8'),
  ) as AssignmentDiagnostic[];

  const agents = await agentsRepository.find({
    order: { full_name: 'ASC' },
  });

  const normalizedAgents = agents.map((agent) => ({
    id: agent.id,
    full_name: agent.full_name,
    dni: agent.dni,
    normalized_name: normalizeName(agent.full_name),
  }));

  const results: SuggestedMatch[] = [];

  for (const item of diagnostics) {
    const docente = item.docente?.trim();

    if (!docente) continue;

    const normalizedDocente = normalizeName(docente);

    const comparisons = normalizedAgents.map((agent) => ({
      agent_id: agent.id,
      full_name: agent.full_name,
      dni: agent.dni,
      score: Number(
        compareNames(normalizedDocente, agent.normalized_name).toFixed(4),
      ),
    }));

    const suggestions = comparisons
      .filter((candidate) => candidate.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    results.push({
      row_number: item.row_number,
      plaza_number: item.plaza_number,
      docente_pof: item.docente,
      motivo: item.motivo,
      suggestions,
    });
  }

  fs.writeFileSync(suggestionsFile, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`✅ Sugerencias generadas: ${results.length}`);
  console.log(`📝 Archivo creado: ${suggestionsFile}`);

  const withSuggestions = results.filter((r) => r.suggestions.length > 0);
  const withoutSuggestions = results.filter((r) => r.suggestions.length === 0);

  console.log(`🔎 Con sugerencias: ${withSuggestions.length}`);
  console.log(`⚠️ Sin sugerencias: ${withoutSuggestions.length}`);

  console.log('\nPrimeras 10 sugerencias:\n');

  withSuggestions.slice(0, 10).forEach((item) => {
    console.log(
      `Fila ${item.row_number} | Plaza ${item.plaza_number} | ${item.docente_pof}`,
    );

    item.suggestions.forEach((s) => {
      console.log(`   -> ${s.full_name} | DNI ${s.dni} | score ${s.score}`);
    });

    console.log('');
  });

  await app.close();
}

bootstrap().catch((error) => {
  console.error('❌ Error generando sugerencias:', error);
  process.exit(1);
});
