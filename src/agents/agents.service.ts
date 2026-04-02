import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Agent } from './entities/agent.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { RevistaRecord } from '../revista/entities/revista-record.entity';

type AgentSearchFilters = {
  dni?: string;
  apellido?: string;
  nombre?: string;
  materia?: string;
};

function hasEndDate(value?: Date | string | null): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isHistoricalRevista(record: RevistaRecord): boolean {
  if (hasEndDate(record.end_date)) return true;
  if (record.is_current === false) return true;
  return false;
}

function sortByStartDateDesc<
  T extends { start_date?: Date | string | null; id?: number },
>(a: T, b: T): number {
  const aTime = a.start_date ? new Date(a.start_date).getTime() : 0;
  const bTime = b.start_date ? new Date(b.start_date).getTime() : 0;

  if (bTime !== aTime) return bTime - aTime;
  return (b.id ?? 0) - (a.id ?? 0);
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
    @InjectRepository(AgentAssignment)
    private readonly assignmentsRepository: Repository<AgentAssignment>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(RevistaRecord)
    private readonly revistaRepository: Repository<RevistaRecord>,
  ) {}

  findAll() {
    return this.agentsRepository.find({
      where: { is_active: true },
      order: { full_name: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.agentsRepository.findOne({
      where: { id, is_active: true },
    });
  }

  findByDni(dni: string) {
    return this.agentsRepository.findOne({
      where: { dni, is_active: true },
    });
  }

  async findBirthdaysByCurrentMonth() {
    return this.agentsRepository
      .createQueryBuilder('agent')
      .where('agent.is_active = :isActive', { isActive: true })
      .andWhere('agent.birth_date IS NOT NULL')
      .andWhere(
        'EXTRACT(MONTH FROM agent.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)',
      )
      .orderBy('EXTRACT(DAY FROM agent.birth_date)', 'ASC')
      .addOrderBy('agent.full_name', 'ASC')
      .getMany()
      .then((items) =>
        items.map((agent) => ({
          id: agent.id,
          full_name: agent.full_name,
          dni: agent.dni,
          birth_date: agent.birth_date,
          day: agent.birth_date ? new Date(agent.birth_date).getDate() : null,
        })),
      );
  }

  async search(filters: AgentSearchFilters) {
    const query = this.agentsRepository
      .createQueryBuilder('agent')
      .leftJoinAndSelect(
        'agent.assignments',
        'assignment',
        "assignment.status = 'ACTIVA'",
      )
      .leftJoinAndSelect('assignment.pof_position', 'pof')
      .where('agent.is_active = :isActive', { isActive: true });

    if (filters.dni?.trim()) {
      query.andWhere('agent.dni ILIKE :dni', {
        dni: `%${filters.dni.trim()}%`,
      });
    }

    if (filters.apellido?.trim()) {
      query.andWhere('agent.last_name ILIKE :apellido', {
        apellido: `%${filters.apellido.trim()}%`,
      });
    }

    if (filters.nombre?.trim()) {
      query.andWhere(
        '(agent.first_name ILIKE :nombre OR agent.full_name ILIKE :nombre)',
        {
          nombre: `%${filters.nombre.trim()}%`,
        },
      );
    }

    if (filters.materia?.trim()) {
      query.andWhere('pof.subject_name ILIKE :materia', {
        materia: `%${filters.materia.trim()}%`,
      });
    }

    query.orderBy('agent.full_name', 'ASC');

    const agents = await query.getMany();

    return agents.map((agent) => ({
      id: agent.id,
      full_name: agent.full_name,
      last_name: agent.last_name,
      first_name: agent.first_name,
      dni: agent.dni,
      email: agent.email,
      current_subjects:
        agent.assignments?.map((assignment) => ({
          plaza_number: assignment.pof_position?.plaza_number ?? null,
          subject_name: assignment.pof_position?.subject_name ?? null,
          shift: assignment.pof_position?.shift ?? null,
        })) ?? [],
    }));
  }

  async findFullProfile(id: number) {
    const agent = await this.agentsRepository.findOne({
      where: { id, is_active: true },
    });

    if (!agent) return null;

    const attendanceRecords = await this.attendanceRepository.find({
      where: { agent_id: id },
      order: { start_date: 'DESC', id: 'DESC' },
    });

    const revistaRecords = await this.revistaRepository.find({
      where: { agent_id: id },
      order: { start_date: 'DESC', id: 'DESC' },
    });

    const licencias = attendanceRecords.filter(
      (item) => item.record_type === 'LICENCIA',
    );

    const ausentes = attendanceRecords.filter(
      (item) => item.record_type === 'AUSENTE',
    );

    const capacitaciones = attendanceRecords.filter(
      (item) => item.record_type === 'CAPACITACION',
    );

    const revista_actual = revistaRecords
      .filter((item) => !isHistoricalRevista(item))
      .sort(sortByStartDateDesc);

    const revista_historica = revistaRecords
      .filter((item) => isHistoricalRevista(item))
      .sort(sortByStartDateDesc);

    return {
      ...agent,
      licencias,
      ausentes,
      capacitaciones,
      revista_actual,
      revista_historica,
    };
  }

  create(data: Partial<Agent>) {
    const agent = this.agentsRepository.create({
      ...data,
      is_active: true,
    });

    return this.agentsRepository.save(agent);
  }

  async update(id: number, data: Partial<Agent>) {
    const existing = await this.agentsRepository.findOne({
      where: { id },
    });

    if (!existing) return null;

    await this.agentsRepository.update(id, data);

    return this.agentsRepository.findOne({
      where: { id },
    });
  }

  async remove(id: number) {
    const existing = await this.agentsRepository.findOne({
      where: { id },
    });

    if (!existing) return null;

    existing.is_active = false;
    return this.agentsRepository.save(existing);
  }
}
