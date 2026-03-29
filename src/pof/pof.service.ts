import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { PofPosition } from './entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { PofHistory } from './entities/pof-history.entity';

type PofFilters = {
  plaza?: string;
  docente?: string;
  materia?: string;
  curso?: string;
};

type CurrentHolder = {
  assignment_id: number;
  agent_id: number | null;
  full_name: string | null;
  dni: string | null;
  movement_type: string | null;
  assignment_date: Date | null;
  status: string | null;
};

type PofResult = PofPosition & {
  current_holder: CurrentHolder | null;
};

@Injectable()
export class PofService {
  constructor(
    @InjectRepository(PofPosition)
    private readonly pofRepository: Repository<PofPosition>,

    @InjectRepository(AgentAssignment)
    private readonly assignmentsRepository: Repository<AgentAssignment>,

    @InjectRepository(PofHistory)
    private readonly historyRepository: Repository<PofHistory>,
  ) {}

  create(data: Partial<PofPosition>) {
    const pof = this.pofRepository.create(data);
    return this.pofRepository.save(pof);
  }

  async findAll(filters?: PofFilters): Promise<PofResult[]> {
    const where: Record<string, unknown> = {
      is_active: true,
    };

    if (filters?.plaza?.trim()) {
      where.plaza_number = ILike(`%${filters.plaza.trim()}%`);
    }

    if (filters?.materia?.trim()) {
      where.subject_name = ILike(`%${filters.materia.trim()}%`);
    }

    if (filters?.curso?.trim()) {
      where.course = ILike(`%${filters.curso.trim()}%`);
    }

    const positions = await this.pofRepository.find({
      where,
      order: { plaza_number: 'ASC' },
    });

    const activeAssignments = await this.assignmentsRepository.find({
      where: { status: 'ACTIVA' },
      relations: ['agent', 'pof_position'],
      order: { assignment_date: 'DESC' },
    });

    const currentByPofId = new Map<number, AgentAssignment>();

    for (const assignment of activeAssignments) {
      if (!assignment.pof_position?.id) continue;

      if (!currentByPofId.has(assignment.pof_position.id)) {
        currentByPofId.set(assignment.pof_position.id, assignment);
      }
    }

    let result: PofResult[] = positions.map((position) => {
      const currentAssignment = currentByPofId.get(position.id);

      return {
        ...position,
        current_holder: currentAssignment
          ? {
              assignment_id: currentAssignment.id,
              agent_id: currentAssignment.agent?.id ?? null,
              full_name: currentAssignment.agent?.full_name ?? null,
              dni: currentAssignment.agent?.dni ?? null,
              movement_type: currentAssignment.movement_type ?? null,
              assignment_date: currentAssignment.assignment_date ?? null,
              status: currentAssignment.status ?? null,
            }
          : null,
      };
    });

    // 🔎 filtro por docente
    if (filters?.docente?.trim()) {
      const docenteFilter = filters.docente.trim().toLowerCase();

      result = result.filter((item) => {
        const fullName = item.current_holder?.full_name;
        return fullName
          ? fullName.toLowerCase().includes(docenteFilter)
          : false;
      });
    }

    return result;
  }

  findOne(id: number) {
    return this.pofRepository.findOne({
      where: { id },
    });
  }

  async findByPlazaNumber(plazaNumber: string): Promise<PofResult | null> {
    const position = await this.pofRepository.findOne({
      where: { plaza_number: plazaNumber, is_active: true },
    });

    if (!position) return null;

    const currentAssignment = await this.assignmentsRepository.findOne({
      where: {
        pof_position_id: position.id,
        status: 'ACTIVA',
      },
      relations: ['agent', 'pof_position'],
      order: { assignment_date: 'DESC' },
    });

    return {
      ...position,
      current_holder: currentAssignment
        ? {
            assignment_id: currentAssignment.id,
            agent_id: currentAssignment.agent?.id ?? null,
            full_name: currentAssignment.agent?.full_name ?? null,
            dni: currentAssignment.agent?.dni ?? null,
            movement_type: currentAssignment.movement_type ?? null,
            assignment_date: currentAssignment.assignment_date ?? null,
            status: currentAssignment.status ?? null,
          }
        : null,
    };
  }

  async update(id: number, data: Partial<PofPosition>) {
    const existing = await this.pofRepository.findOne({ where: { id } });

    if (!existing) return null;

    const changes: PofHistory[] = [];

    const keys = Object.keys(data) as (keyof PofPosition)[];

    for (const key of keys) {
      const oldValue = existing[key];
      const newValue = data[key];

      if (newValue === undefined) continue;
      if (oldValue === newValue) continue;

      const history = new PofHistory();
      history.pof_position_id = id;
      history.field_name = String(key);
      history.old_value =
        oldValue === null || oldValue === undefined
          ? null
          : JSON.stringify(oldValue);

      history.new_value =
        newValue === null || newValue === undefined
          ? null
          : JSON.stringify(newValue);

      changes.push(history);
    }

    await this.pofRepository.update(id, data);

    if (changes.length > 0) {
      await this.historyRepository.save(changes);
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const pof = await this.pofRepository.findOne({ where: { id } });

    if (!pof) return null;

    pof.is_active = false;
    return this.pofRepository.save(pof);
  }

  async getHistory(id: number) {
    return this.historyRepository.find({
      where: { pof_position_id: id },
      order: { created_at: 'DESC' },
    });
  }
}
