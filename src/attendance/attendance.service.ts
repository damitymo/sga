import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AttendanceConditionType,
  AttendanceRecord,
  AttendanceShift,
  AttendanceStatus,
} from './entities/attendance-record.entity';

type FindAttendanceFilters = {
  agentId?: number;
  year?: number;
  month?: number;
  status?: AttendanceStatus;
  conditionType?: AttendanceConditionType;
  shift?: AttendanceShift;
};

type AttendanceStats = {
  total_records: number;
  counts: {
    PRESENTE: number;
    AUSENTE_INJUSTIFICADO: number;
    LICENCIA: number;
  };
  percentages: {
    PRESENTE: number;
    AUSENTE_INJUSTIFICADO: number;
    LICENCIA: number;
  };
};

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
  ) {}

  private normalizeStatus(value?: string | null): AttendanceStatus {
    const normalized = (value || '').trim().toUpperCase();

    if (normalized === 'PRESENTE' || normalized === 'P') {
      return AttendanceStatus.PRESENTE;
    }

    if (
      normalized === 'AUSENTE_INJUSTIFICADO' ||
      normalized === 'IJ' ||
      normalized === 'AI' ||
      normalized === 'AUSENTE'
    ) {
      return AttendanceStatus.AUSENTE_INJUSTIFICADO;
    }

    if (normalized === 'LICENCIA' || normalized === 'L1') {
      return AttendanceStatus.LICENCIA;
    }

    throw new BadRequestException(
      'Estado de asistencia inválido. Usá PRESENTE, AUSENTE_INJUSTIFICADO o LICENCIA.',
    );
  }

  private normalizeConditionType(
    value?: string | null,
  ): AttendanceConditionType | null {
    if (!value) return null;

    const normalized = value.trim().toUpperCase();

    if (normalized === 'TITULAR') return AttendanceConditionType.TITULAR;
    if (normalized === 'INTERINO') return AttendanceConditionType.INTERINO;
    if (normalized === 'SUPLENTE') return AttendanceConditionType.SUPLENTE;

    return AttendanceConditionType.OTRO;
  }

  private normalizeShift(value?: string | null): AttendanceShift | null {
    if (!value) return null;

    const normalized = value
      .trim()
      .toUpperCase()
      .replace('Ñ', 'N')
      .replace('Á', 'A');

    if (normalized === 'MANANA' || normalized === 'TM') {
      return AttendanceShift.MANANA;
    }

    if (normalized === 'TARDE' || normalized === 'TT') {
      return AttendanceShift.TARDE;
    }

    if (normalized === 'NOCHE' || normalized === 'TN') {
      return AttendanceShift.NOCHE;
    }

    return AttendanceShift.OTRO;
  }

  private buildDateParts(attendanceDate: string) {
    const date = new Date(`${attendanceDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('attendance_date inválida.');
    }

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  async create(data: Partial<AttendanceRecord>) {
    if (!data.agent_id) {
      throw new BadRequestException('agent_id es obligatorio.');
    }

    if (!data.attendance_date) {
      throw new BadRequestException('attendance_date es obligatorio.');
    }

    const sourceStatus =
      data.status !== undefined && data.status !== null
        ? String(data.status)
        : (data.raw_code ?? undefined);

    const status = this.normalizeStatus(sourceStatus);

    const { year, month, day } = this.buildDateParts(data.attendance_date);

    const sourceSheetName = data.source_sheet_name?.trim() || 'SIN_HOJA';

    const existing = await this.attendanceRepository.findOne({
      where: {
        agent_id: data.agent_id,
        attendance_date: data.attendance_date,
        source_sheet_name: sourceSheetName,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe un registro de asistencia para este agente, fecha y hoja origen.',
      );
    }

    const record = this.attendanceRepository.create({
      agent_id: data.agent_id,
      attendance_date: data.attendance_date,
      year,
      month,
      day,
      status,
      raw_code: data.raw_code?.trim().toUpperCase() || null,
      condition_type: this.normalizeConditionType(data.condition_type),
      shift: this.normalizeShift(data.shift),
      source_sheet_name: sourceSheetName,
      source_agent_name: data.source_agent_name?.trim() || null,
      source_dni: data.source_dni?.trim() || null,
      observation: data.observation?.trim() || null,
      import_batch_id: data.import_batch_id?.trim() || null,
    });

    return this.attendanceRepository.save(record);
  }

  async findAll(filters?: FindAttendanceFilters) {
    const where: FindOptionsWhere<AttendanceRecord> = {};

    if (filters?.agentId) where.agent_id = filters.agentId;
    if (filters?.year) where.year = filters.year;
    if (filters?.month) where.month = filters.month;
    if (filters?.status) where.status = filters.status;
    if (filters?.conditionType) where.condition_type = filters.conditionType;
    if (filters?.shift) where.shift = filters.shift;

    return this.attendanceRepository.find({
      where,
      order: {
        attendance_date: 'DESC',
        source_sheet_name: 'ASC',
        id: 'DESC',
      },
    });
  }

  async findByAgent(
    agentId: number,
    filters?: Omit<FindAttendanceFilters, 'agentId'>,
  ) {
    return this.findAll({
      agentId,
      year: filters?.year,
      month: filters?.month,
      status: filters?.status,
      conditionType: filters?.conditionType,
      shift: filters?.shift,
    });
  }

  async findOne(id: number) {
    const record = await this.attendanceRepository.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Registro de asistencia no encontrado.');
    }

    return record;
  }

  async getStatsByAgent(
    agentId: number,
    filters?: Omit<FindAttendanceFilters, 'agentId'>,
  ): Promise<AttendanceStats> {
    const items = await this.findByAgent(agentId, filters);

    const counts = {
      PRESENTE: 0,
      AUSENTE_INJUSTIFICADO: 0,
      LICENCIA: 0,
    };

    for (const item of items) {
      if (item.status === AttendanceStatus.PRESENTE) {
        counts.PRESENTE += 1;
      }

      if (item.status === AttendanceStatus.AUSENTE_INJUSTIFICADO) {
        counts.AUSENTE_INJUSTIFICADO += 1;
      }

      if (item.status === AttendanceStatus.LICENCIA) {
        counts.LICENCIA += 1;
      }
    }

    const total = items.length;

    const calc = (value: number) =>
      total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

    return {
      total_records: total,
      counts,
      percentages: {
        PRESENTE: calc(counts.PRESENTE),
        AUSENTE_INJUSTIFICADO: calc(counts.AUSENTE_INJUSTIFICADO),
        LICENCIA: calc(counts.LICENCIA),
      },
    };
  }

  async update(id: number, data: Partial<AttendanceRecord>) {
    const existing = await this.findOne(id);

    const attendanceDate = data.attendance_date || existing.attendance_date;
    const { year, month, day } = this.buildDateParts(attendanceDate);

    const sourceSheetName =
      data.source_sheet_name?.trim() ||
      existing.source_sheet_name ||
      'SIN_HOJA';

    const agentId = data.agent_id || existing.agent_id;

    const duplicate = await this.attendanceRepository.findOne({
      where: {
        agent_id: agentId,
        attendance_date: attendanceDate,
        source_sheet_name: sourceSheetName,
      },
    });

    if (duplicate && duplicate.id !== id) {
      throw new BadRequestException(
        'Ya existe otro registro con el mismo agente, fecha y hoja origen.',
      );
    }

    await this.attendanceRepository.update(id, {
      agent_id: agentId,
      attendance_date: attendanceDate,
      year,
      month,
      day,
      status: data.status ? this.normalizeStatus(data.status) : existing.status,
      raw_code:
        data.raw_code !== undefined
          ? data.raw_code?.trim().toUpperCase() || null
          : existing.raw_code,
      condition_type:
        data.condition_type !== undefined
          ? this.normalizeConditionType(data.condition_type)
          : existing.condition_type,
      shift:
        data.shift !== undefined
          ? this.normalizeShift(data.shift)
          : existing.shift,
      source_sheet_name: sourceSheetName,
      source_agent_name:
        data.source_agent_name !== undefined
          ? data.source_agent_name?.trim() || null
          : existing.source_agent_name,
      source_dni:
        data.source_dni !== undefined
          ? data.source_dni?.trim() || null
          : existing.source_dni,
      observation:
        data.observation !== undefined
          ? data.observation?.trim() || null
          : existing.observation,
      import_batch_id:
        data.import_batch_id !== undefined
          ? data.import_batch_id?.trim() || null
          : existing.import_batch_id,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    await this.attendanceRepository.delete(id);
    return {
      message: 'Registro de asistencia eliminado correctamente.',
      deleted_id: existing.id,
    };
  }
}
