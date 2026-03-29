import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Agent } from './entities/agent.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

type AgentSearchFilters = {
  dni?: string;
  apellido?: string;
  nombre?: string;
  materia?: string;
};

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
    @InjectRepository(AgentAssignment)
    private readonly assignmentsRepository: Repository<AgentAssignment>,
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
      relations: {
        attendance_records: true,
        revista_records: {
          pof_position: true,
        },
      },
      order: {
        attendance_records: {
          start_date: 'DESC',
        },
        revista_records: {
          start_date: 'DESC',
        },
      },
    });

    if (!agent) return null;

    const licencias =
      agent.attendance_records?.filter(
        (item) => item.record_type === 'LICENCIA',
      ) ?? [];

    const ausentes =
      agent.attendance_records?.filter(
        (item) => item.record_type === 'AUSENTE',
      ) ?? [];

    const capacitaciones =
      agent.attendance_records?.filter(
        (item) => item.record_type === 'CAPACITACION',
      ) ?? [];

    const revista_actual =
      agent.revista_records?.filter((item) => item.is_current) ?? [];

    const revista_historica =
      agent.revista_records?.filter((item) => !item.is_current) ?? [];

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
