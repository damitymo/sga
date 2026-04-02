import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppModule } from '../app.module';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { RevistaRecord } from '../revista/entities/revista-record.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';

function toDateOnlyString(value?: Date | string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function sortAssignments(a: AgentAssignment, b: AgentAssignment): number {
  const aTime = a.assignment_date ? new Date(a.assignment_date).getTime() : 0;
  const bTime = b.assignment_date ? new Date(b.assignment_date).getTime() : 0;

  if (aTime !== bTime) return aTime - bTime;
  return a.id - b.id;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const assignmentsRepository = app.get<Repository<AgentAssignment>>(
      getRepositoryToken(AgentAssignment),
    );

    const revistaRepository = app.get<Repository<RevistaRecord>>(
      getRepositoryToken(RevistaRecord),
    );

    const pofRepository = app.get<Repository<PofPosition>>(
      getRepositoryToken(PofPosition),
    );

    const assignments = await assignmentsRepository.find({
      order: {
        agent_id: 'ASC',
        pof_position_id: 'ASC',
        assignment_date: 'ASC',
        id: 'ASC',
      },
    });

    console.log('====================================================');
    console.log('RECONCILIACIÓN REVISTA DESDE ASSIGNMENTS');
    console.log('====================================================');
    console.log(`Assignments encontrados: ${assignments.length}`);

    const grouped = new Map<string, AgentAssignment[]>();

    for (const assignment of assignments) {
      const key = `${assignment.agent_id}-${assignment.pof_position_id}`;
      const current = grouped.get(key) ?? [];
      current.push(assignment);
      grouped.set(key, current);
    }

    let created = 0;
    let updated = 0;
    let warnings = 0;

    for (const [, group] of grouped) {
      const ordered = [...group].sort(sortAssignments);
      const agentId = ordered[0].agent_id;
      const pofPositionId = ordered[0].pof_position_id;

      const pofPosition = await pofRepository.findOne({
        where: { id: pofPositionId },
      });

      const existingRevista = await revistaRepository.find({
        where: {
          agent_id: agentId,
          pof_position_id: pofPositionId,
        },
        order: {
          start_date: 'ASC',
          id: 'ASC',
        },
      });

      const designaciones = ordered.filter(
        (item) => item.movement_type === 'DESIGNACION',
      );

      const bajas = ordered.filter((item) => item.movement_type === 'BAJA');

      const expectedRecords = designaciones.map((designacion) => {
        const relatedBaja = bajas.find((baja) => {
          const bajaDate = toDateOnlyString(
            baja.end_date ?? baja.assignment_date,
          );
          const designacionDate = toDateOnlyString(designacion.assignment_date);

          if (!bajaDate || !designacionDate) return false;
          return bajaDate >= designacionDate;
        });

        const endDate = relatedBaja
          ? toDateOnlyString(
              relatedBaja.end_date ?? relatedBaja.assignment_date,
            )
          : toDateOnlyString(designacion.end_date);

        const isCurrent = !endDate;

        return {
          assignment_id: designacion.id,
          agent_id: designacion.agent_id,
          pof_position_id: designacion.pof_position_id,
          revista_type: 'DOCENTE',
          character_type:
            designacion.character_type ??
            pofPosition?.revista_status ??
            'TITULAR',
          start_date: toDateOnlyString(designacion.assignment_date),
          end_date: endDate,
          is_current: isCurrent,
          legal_norm: designacion.legal_norm ?? pofPosition?.legal_norm ?? null,
          resolution_number: designacion.legal_norm_number ?? null,
          notes:
            designacion.notes?.trim() ||
            'Reconciliado automáticamente desde assignments',
        };
      });

      if (designaciones.length === 0 && existingRevista.length > 0) {
        warnings++;
        console.log(
          `⚠️ Hay revista sin designaciones para agent_id=${agentId}, pof_position_id=${pofPositionId}`,
        );
        continue;
      }

      for (let i = 0; i < expectedRecords.length; i++) {
        const expected = expectedRecords[i];
        const existing = existingRevista.find(
          (item) => item.assignment_id === expected.assignment_id,
        );

        if (existing) {
          const patch: Partial<RevistaRecord> = {};
          let changed = false;

          if (toDateOnlyString(existing.start_date) !== expected.start_date) {
            patch.start_date = expected.start_date as unknown as Date;
            changed = true;
          }

          if (toDateOnlyString(existing.end_date) !== expected.end_date) {
            patch.end_date = expected.end_date as unknown as Date | null;
            changed = true;
          }

          if (existing.is_current !== expected.is_current) {
            patch.is_current = expected.is_current;
            changed = true;
          }

          if ((existing.character_type ?? null) !== expected.character_type) {
            patch.character_type = expected.character_type ?? null;
            changed = true;
          }

          if ((existing.legal_norm ?? null) !== expected.legal_norm) {
            patch.legal_norm = expected.legal_norm ?? null;
            changed = true;
          }

          if (
            (existing.resolution_number ?? null) !== expected.resolution_number
          ) {
            patch.resolution_number = expected.resolution_number ?? null;
            changed = true;
          }

          if ((existing.notes ?? null) !== expected.notes) {
            patch.notes = expected.notes ?? null;
            changed = true;
          }

          if (changed) {
            await revistaRepository.update(existing.id, patch);
            updated++;
            console.log(
              `🔄 Revista actualizada | revista_id=${existing.id} | assignment_id=${expected.assignment_id}`,
            );
          }
        } else {
          const createdRecord = revistaRepository.create({
            agent_id: expected.agent_id,
            pof_position_id: expected.pof_position_id,
            assignment_id: expected.assignment_id,
            revista_type: expected.revista_type,
            character_type: expected.character_type ?? undefined,
            start_date: expected.start_date as unknown as Date,
            end_date: expected.end_date as unknown as Date | null,
            is_current: expected.is_current,
            legal_norm: expected.legal_norm ?? undefined,
            resolution_number: expected.resolution_number ?? undefined,
            notes: expected.notes ?? undefined,
          });

          await revistaRepository.save(createdRecord);
          created++;

          console.log(
            `✅ Revista creada | agent_id=${expected.agent_id} | pof_position_id=${expected.pof_position_id} | assignment_id=${expected.assignment_id}`,
          );
        }
      }

      const validAssignmentIds = new Set(
        expectedRecords.map((item) => item.assignment_id),
      );

      for (const extra of existingRevista) {
        if (
          !extra.assignment_id ||
          !validAssignmentIds.has(extra.assignment_id)
        ) {
          const fallbackEndDate =
            toDateOnlyString(extra.end_date) ??
            toDateOnlyString(extra.start_date);

          await revistaRepository.update(extra.id, {
            is_current: false,
            end_date: fallbackEndDate as unknown as Date,
            notes: `${
              extra.notes ? `${extra.notes} | ` : ''
            }Cerrado automáticamente por reconciliación`,
          });

          updated++;
          console.log(
            `🧹 Revista extra cerrada | revista_id=${extra.id} | assignment_id=${extra.assignment_id ?? 'sin assignment'}`,
          );
        }
      }
    }

    console.log('====================================================');
    console.log('RESULTADO FINAL');
    console.log('====================================================');
    console.log(`✅ Revistas creadas: ${created}`);
    console.log(`🔄 Revistas actualizadas/cerradas: ${updated}`);
    console.log(`⚠️ Advertencias: ${warnings}`);
    console.log('====================================================');
  } finally {
    await app.close();
  }
}

void bootstrap();
