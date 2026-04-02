import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../app.module';
import { Agent } from '../agents/entities/agent.entity';
import { User } from '../users/entities/user.entity';

function normalizeDni(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = String(value).replace(/\D/g, '').trim();

  if (!normalized) return null;

  return normalized;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const agentRepository = app.get<Repository<Agent>>(
      getRepositoryToken(Agent),
    );
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

    const agents = await agentRepository.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    console.log('====================================================');
    console.log('CREACIÓN MASIVA DE USUARIOS PARA AGENTES');
    console.log('====================================================');
    console.log(`Agentes encontrados: ${agents.length}`);

    let created = 0;
    let skippedNoDni = 0;
    let skippedAlreadyLinked = 0;
    let linkedExistingByUsername = 0;
    let skippedDuplicateUsername = 0;
    let errors = 0;

    for (const agent of agents) {
      try {
        const dni = normalizeDni(agent.dni);

        if (!dni) {
          skippedNoDni++;
          console.log(`⚠️ Agente ID ${agent.id} sin DNI válido. Saltado.`);
          continue;
        }

        const existingByAgent = await userRepository.findOne({
          where: { agent_id: agent.id },
        });

        if (existingByAgent) {
          skippedAlreadyLinked++;
          console.log(
            `⏭️ Agente ID ${agent.id} ya tiene usuario vinculado (${existingByAgent.username}).`,
          );
          continue;
        }

        const existingByUsername = await userRepository.findOne({
          where: { username: dni },
        });

        if (existingByUsername) {
          if (!existingByUsername.agent_id) {
            existingByUsername.agent_id = agent.id;
            existingByUsername.agent = agent;

            if (!existingByUsername.full_name && agent.full_name) {
              existingByUsername.full_name = agent.full_name;
            }

            if (!existingByUsername.email && agent.email) {
              existingByUsername.email = agent.email;
            }

            if (!existingByUsername.role) {
              existingByUsername.role = 'AGENTE';
            }

            await userRepository.save(existingByUsername);
            linkedExistingByUsername++;

            console.log(
              `🔗 Usuario existente ${dni} vinculado al agente ID ${agent.id}.`,
            );
          } else {
            skippedDuplicateUsername++;
            console.log(
              `⚠️ Username ${dni} ya existe y está asociado a otro agente. Saltado.`,
            );
          }

          continue;
        }

        const passwordHash = await bcrypt.hash(dni, 10);

        const newUser = userRepository.create({
          full_name: agent.full_name,
          username: dni,
          email: agent.email ?? null,
          password_hash: passwordHash,
          role: 'AGENTE',
          is_active: true,
          must_change_password: true,
          agent_id: agent.id,
          agent,
        });

        await userRepository.save(newUser);
        created++;

        console.log(
          `✅ Usuario creado | agent_id=${agent.id} | username=${dni}`,
        );
      } catch (error) {
        errors++;
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        console.error(`❌ Error con agente ID ${agent.id}: ${message}`);
      }
    }

    console.log('====================================================');
    console.log('RESULTADO FINAL');
    console.log('====================================================');
    console.log(`✅ Usuarios creados: ${created}`);
    console.log(` Usuarios existentes vinculados: ${linkedExistingByUsername}`);
    console.log(`⏭️ Agentes ya vinculados: ${skippedAlreadyLinked}`);
    console.log(`⚠️ Agentes sin DNI válido: ${skippedNoDni}`);
    console.log(
      `
     ⚠️ Usernames duplicados no vinculables: ${skippedDuplicateUsername}`,
    );
    console.log(`❌ Errores: ${errors}`);
    console.log('====================================================');
  } finally {
    await app.close();
  }
}

void bootstrap();
