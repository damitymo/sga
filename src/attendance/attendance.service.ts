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

/**
 * Shape de la grilla estilo libro de asistencia del MEC: filas = mes,
 * columnas = días 1..31, totales a la derecha + totales anuales al final.
 * Cada celda es el raw_code original (P/F/S/D/AJ/AI/L1/L2/H/etc).
 */
export type AttendanceGridDay = {
  day: number;
  raw_code: string | null;
  status: string | null;
  observation: string | null;
};

export type AttendanceGridMonthTotals = {
  dicto: number;
  ai: number;
  aj: number;
  lic1: number;
  lic2: number;
  deb_dic: number;
  pct_asist: number;
};

export type AttendanceGridMonth = {
  month: number; // 1..12
  days: AttendanceGridDay[]; // siempre 31 posiciones (los días inválidos quedan con raw_code=null)
  totals: AttendanceGridMonthTotals;
};

export type AttendanceGrid = {
  agent_id: number;
  year: number;
  months: AttendanceGridMonth[];
  year_totals: AttendanceGridMonthTotals;
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

    // Si el listado no está filtrado por agente específico, traemos el Agent
    // para mostrar nombre/DNI en la tabla. Si sí hay agentId, es innecesario.
    const includeAgent = !filters?.agentId;

    return this.attendanceRepository.find({
      where,
      relations: includeAgent ? { agent: true } : undefined,
      order: {
        year: 'DESC',
        month: 'DESC',
        day: 'DESC',
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
      // Traemos el agent para preservar el shape que antes devolvía el eager.
      // Es un findOne puntual, no es hot path.
      relations: { agent: true },
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

  /**
   * Devuelve la asistencia anual de un agente en formato grilla del libro
   * oficial del MEC. Solo lee datos: agrupa los AttendanceRecord del año
   * por mes/día y arma los totales mensuales y anuales.
   *
   * Los códigos que cuentan en cada columna vienen del Excel de origen:
   *  - DICTO  = días con raw_code entre P, F (feriado), AJ (cuenta como
   *             dictado con justificación), AI (cuenta como dictado pero
   *             ausente), L1 y L2 (días con licencia también cuentan
   *             como días hábiles del mes).
   *  - AI     = raw_code === 'AI'
   *  - AJ     = raw_code === 'AJ'
   *  - Lic. 1 = raw_code === 'L1'
   *  - Lic. 2 = raw_code === 'L2'
   *  - Deb. Dic. = suma de días hábiles (cuando faltan marcas)
   *  - % Asist = (DICTO − AI) / DICTO × 100
   *
   * Si el dataset del año está vacío, la grilla se devuelve igual con los
   * 12 meses en 0 — así el frontend siempre puede pintar la tabla.
   */
  async getAnnualGrid(agentId: number, year: number): Promise<AttendanceGrid> {
    const records = await this.attendanceRepository.find({
      where: { agent_id: agentId, year },
      order: { month: 'ASC', day: 'ASC', id: 'ASC' },
    });

    // Índice mes -> día -> record más reciente.
    // Si un mismo día aparece en varias hojas fuente (source_sheet_name
    // distinto), el más reciente (por id) gana para la grilla.
    const byMonthDay = new Map<string, AttendanceRecord>();
    for (const r of records) {
      byMonthDay.set(`${r.month}-${r.day}`, r);
    }

    const months: AttendanceGridMonth[] = [];

    let yDicto = 0;
    let yAi = 0;
    let yAj = 0;
    let yL1 = 0;
    let yL2 = 0;
    let yDebDic = 0;

    for (let m = 1; m <= 12; m += 1) {
      const days: AttendanceGridDay[] = [];
      let dicto = 0;
      let ai = 0;
      let aj = 0;
      let lic1 = 0;
      let lic2 = 0;
      let debDic = 0;

      const lastDay = new Date(year, m, 0).getDate(); // 28..31 real del mes

      for (let d = 1; d <= 31; d += 1) {
        const record = byMonthDay.get(`${m}-${d}`);
        const code = record?.raw_code?.toUpperCase() ?? null;

        if (d > lastDay) {
          // Día inexistente en el mes (ej: 30 feb). Fila en blanco.
          days.push({
            day: d,
            raw_code: null,
            status: null,
            observation: null,
          });
          continue;
        }

        days.push({
          day: d,
          raw_code: code,
          status: record?.status ?? null,
          observation: record?.observation ?? null,
        });

        // S (sábado) y D (domingo) son no-hábiles en el libro: no suman
        // dicto ni débito. El resto de códigos sí es día "cargado".
        if (code === 'S' || code === 'D') continue;

        if (!code) {
          // Día hábil sin marca: va a "Deb. Dic." (débito a dictar).
          debDic += 1;
          continue;
        }

        dicto += 1;
        if (code === 'AI') ai += 1;
        if (code === 'AJ') aj += 1;
        if (code === 'L1') lic1 += 1;
        if (code === 'L2') lic2 += 1;
      }

      const pctAsist =
        dicto > 0 ? Number((((dicto - ai) / dicto) * 100).toFixed(2)) : 0;

      months.push({
        month: m,
        days,
        totals: {
          dicto,
          ai,
          aj,
          lic1,
          lic2,
          deb_dic: debDic,
          pct_asist: pctAsist,
        },
      });

      yDicto += dicto;
      yAi += ai;
      yAj += aj;
      yL1 += lic1;
      yL2 += lic2;
      yDebDic += debDic;
    }

    const yPct =
      yDicto > 0 ? Number((((yDicto - yAi) / yDicto) * 100).toFixed(2)) : 0;

    return {
      agent_id: agentId,
      year,
      months,
      year_totals: {
        dicto: yDicto,
        ai: yAi,
        aj: yAj,
        lic1: yL1,
        lic2: yL2,
        deb_dic: yDebDic,
        pct_asist: yPct,
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
