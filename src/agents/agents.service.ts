import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../attendance/entities/attendance-record.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { RevistaRecord } from '../revista/entities/revista-record.entity';

type SearchAgentsFilters = {
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

    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,

    @InjectRepository(AgentAssignment)
    private readonly assignmentsRepository: Repository<AgentAssignment>,

    @InjectRepository(RevistaRecord)
    private readonly revistaRepository: Repository<RevistaRecord>,
  ) {}

  async create(data: Partial<Agent>) {
    if (!data.full_name?.trim()) {
      throw new BadRequestException('El nombre completo es obligatorio.');
    }

    if (!data.dni?.trim()) {
      throw new BadRequestException('El DNI es obligatorio.');
    }

    const existing = await this.agentsRepository.findOne({
      where: { dni: data.dni.trim() },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un agente con ese DNI.');
    }

    const agent = this.agentsRepository.create({
      ...data,
      full_name: data.full_name.trim(),
      dni: data.dni.trim(),
      last_name: data.last_name?.trim() || null,
      first_name: data.first_name?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      mobile: data.mobile?.trim() || null,
      email: data.email?.trim() || null,
      teaching_file_number: data.teaching_file_number?.trim() || null,
      board_file_number: data.board_file_number?.trim() || null,
      secondary_board_number: data.secondary_board_number?.trim() || null,
      titles: data.titles?.trim() || null,
      identity_card_number: data.identity_card_number?.trim() || null,
      notes: data.notes?.trim() || null,
      legal_norm_type: data.legal_norm_type?.trim() || null,
      legal_norm_number: data.legal_norm_number?.trim() || null,
      character_type: data.character_type?.trim() || null,
      is_active: data.is_active ?? true,
    });

    return this.agentsRepository.save(agent);
  }

  async findAll() {
    return this.agentsRepository.find({
      order: {
        full_name: 'ASC',
      },
    });
  }

  async search(filters: SearchAgentsFilters) {
    const dni = filters.dni?.trim();
    const apellido = filters.apellido?.trim();
    const nombre = filters.nombre?.trim();
    const materia = filters.materia?.trim();

    if (!dni && !apellido && !nombre && !materia) {
      return [];
    }

    const where: FindOptionsWhere<Agent>[] = [];

    if (dni) {
      where.push({ dni: ILike(`%${dni}%`) });
    }

    if (apellido) {
      where.push({ last_name: ILike(`%${apellido}%`) });
      where.push({ full_name: ILike(`%${apellido}%`) });
    }

    if (nombre) {
      where.push({ first_name: ILike(`%${nombre}%`) });
      where.push({ full_name: ILike(`%${nombre}%`) });
    }
    if (materia) {
      where.push({ notes: ILike(`%${materia}%`) });
      where.push({ titles: ILike(`%${materia}%`) });
    }

    return this.agentsRepository.find({
      where,
      order: {
        full_name: 'ASC',
      },
      take: 100,
    });
  }

  async findOne(id: number) {
    const agent = await this.agentsRepository.findOne({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException('Agente no encontrado.');
    }

    return agent;
  }

  async findByDni(dni: string) {
    const agent = await this.agentsRepository.findOne({
      where: { dni: dni.trim() },
    });

    if (!agent) {
      throw new NotFoundException('Agente no encontrado.');
    }

    return agent;
  }

  async update(id: number, data: Partial<Agent>) {
    const existing = await this.findOne(id);

    if (data.dni && data.dni.trim() !== existing.dni) {
      const duplicate = await this.agentsRepository.findOne({
        where: { dni: data.dni.trim() },
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Ya existe otro agente con ese DNI.');
      }
    }

    await this.agentsRepository.update(id, {
      full_name:
        data.full_name !== undefined
          ? data.full_name.trim()
          : existing.full_name,
      dni: data.dni !== undefined ? data.dni.trim() : existing.dni,
      last_name:
        data.last_name !== undefined
          ? data.last_name?.trim() || null
          : existing.last_name,
      first_name:
        data.first_name !== undefined
          ? data.first_name?.trim() || null
          : existing.first_name,
      birth_date:
        data.birth_date !== undefined ? data.birth_date : existing.birth_date,
      address:
        data.address !== undefined
          ? data.address?.trim() || null
          : existing.address,
      phone:
        data.phone !== undefined ? data.phone?.trim() || null : existing.phone,
      mobile:
        data.mobile !== undefined
          ? data.mobile?.trim() || null
          : existing.mobile,
      email:
        data.email !== undefined ? data.email?.trim() || null : existing.email,
      teaching_file_number:
        data.teaching_file_number !== undefined
          ? data.teaching_file_number?.trim() || null
          : existing.teaching_file_number,
      board_file_number:
        data.board_file_number !== undefined
          ? data.board_file_number?.trim() || null
          : existing.board_file_number,
      secondary_board_number:
        data.secondary_board_number !== undefined
          ? data.secondary_board_number?.trim() || null
          : existing.secondary_board_number,
      school_entry_date:
        data.school_entry_date !== undefined
          ? data.school_entry_date
          : existing.school_entry_date,
      teaching_entry_date:
        data.teaching_entry_date !== undefined
          ? data.teaching_entry_date
          : existing.teaching_entry_date,
      titles:
        data.titles !== undefined
          ? data.titles?.trim() || null
          : existing.titles,
      identity_card_number:
        data.identity_card_number !== undefined
          ? data.identity_card_number?.trim() || null
          : existing.identity_card_number,
      notes:
        data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
      is_active:
        data.is_active !== undefined ? data.is_active : existing.is_active,
      legal_norm_type:
        data.legal_norm_type !== undefined
          ? data.legal_norm_type?.trim() || null
          : existing.legal_norm_type,
      legal_norm_number:
        data.legal_norm_number !== undefined
          ? data.legal_norm_number?.trim() || null
          : existing.legal_norm_number,
      character_type:
        data.character_type !== undefined
          ? data.character_type?.trim() || null
          : existing.character_type,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    await this.agentsRepository.delete(id);

    return {
      message: 'Agente eliminado correctamente.',
      deleted_id: existing.id,
    };
  }

  async getBirthdaysByMonth(month: number) {
    if (!month || month < 1 || month > 12) {
      throw new BadRequestException('Mes inválido.');
    }

    const agents = await this.agentsRepository.find({
      where: {
        is_active: true,
      },
      order: {
        full_name: 'ASC',
      },
    });

    return agents
      .filter((agent) => {
        if (!agent.birth_date) return false;

        const date = new Date(agent.birth_date);
        return date.getMonth() + 1 === month;
      })
      .map((agent) => {
        const date = new Date(agent.birth_date as Date);
        return {
          ...agent,
          day: date.getDate(),
        };
      });
  }

  async findBirthdaysByCurrentMonth() {
    const currentMonth = new Date().getMonth() + 1;
    return this.getBirthdaysByMonth(currentMonth);
  }

  async findFullProfile(id: number) {
    const agent = await this.findOne(id);

    const attendance = await this.attendanceRepository.find({
      where: { agent_id: id },
      order: { attendance_date: 'DESC', id: 'DESC' },
    });

    const assignments = await this.assignmentsRepository.find({
      where: { agent_id: id },
      order: {
        created_at: 'DESC',
        id: 'DESC',
      },
    });

    const revistaActual = await this.revistaRepository.find({
      where: {
        agent_id: id,
        is_current: true,
      },
      order: {
        start_date: 'DESC',
        id: 'DESC',
      },
    });

    const revistaHistorica = await this.revistaRepository.find({
      where: {
        agent_id: id,
        is_current: false,
      },
      order: {
        start_date: 'DESC',
        id: 'DESC',
      },
    });

    const licencias = attendance.filter(
      (item) => item.status === AttendanceStatus.LICENCIA,
    );

    const ausentes = attendance.filter(
      (item) => item.status === AttendanceStatus.AUSENTE_INJUSTIFICADO,
    );

    const presentes = attendance.filter(
      (item) => item.status === AttendanceStatus.PRESENTE,
    );

    const attendance_stats = {
      total_registros: attendance.length,
      licencias: licencias.length,
      ausentes: ausentes.length,
      presentes: presentes.length,
    };

    return {
      ...agent,
      attendance,
      attendance_stats,
      licencias,
      ausentes,
      presentes,
      assignments,
      revista_actual: revistaActual,
      revista_historica: revistaHistorica,
    };
  }
}
