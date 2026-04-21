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

  /**
   * Resumen por Nivel Funcional, inspirado en el reporte de Estructura POF del
   * sistema del MEC. Agrupa por el prefijo numérico del `plaza_number` (ej:
   * "50-774" → grupo "50") y devuelve totales comparables al Excel oficial.
   *
   * Se calcula en memoria: el dataset típico de una escuela ronda ~1100
   * plazas, así que no justifica un query con GROUP BY + subqueries. Si en
   * algún momento escalamos a muchos establecimientos, convertir a SQL.
   */
  async getStructure(): Promise<StructureRow[]> {
    const positions = await this.pofRepository.find({
      where: { is_active: true },
    });

    const activeAssignments = await this.assignmentsRepository.find({
      where: { status: 'ACTIVA' },
      relations: ['pof_position'],
    });

    // Índice: pof_position_id → cantidad de prestaciones (asignaciones) y agentes distintos.
    const prestacionesByPofId = new Map<number, number>();
    const agentsByPofId = new Map<number, Set<number>>();

    for (const assignment of activeAssignments) {
      const pofId = assignment.pof_position?.id;
      if (!pofId) continue;

      prestacionesByPofId.set(
        pofId,
        (prestacionesByPofId.get(pofId) ?? 0) + 1,
      );

      if (assignment.agent_id != null) {
        if (!agentsByPofId.has(pofId)) {
          agentsByPofId.set(pofId, new Set<number>());
        }
        agentsByPofId.get(pofId)!.add(assignment.agent_id);
      }
    }

    // Acumulador por grupo (prefijo del plaza_number).
    const buckets = new Map<string, StructureBucket>();

    for (const position of positions) {
      const plaza = position.plaza_number ?? '';
      const [rawCode] = plaza.split('-');
      const code = (rawCode ?? '').trim() || 'SIN-CODIGO';

      if (!buckets.has(code)) {
        buckets.set(code, {
          codigo: code,
          nivel_funcional: NIVEL_FUNCIONAL_BY_CODE[code] ?? 'SIN CLASIFICAR',
          plazas: 0,
          plazas_con_prestacion: 0,
          prestaciones: 0,
          agentes: new Set<number>(),
          inconsistentes: 0,
          hs_catedra: 0,
          extra_pof_ss: 0,
          extra_pof_cs: 0,
        });
      }

      const bucket = buckets.get(code)!;
      bucket.plazas += 1;

      const prestCount = prestacionesByPofId.get(position.id) ?? 0;
      bucket.prestaciones += prestCount;

      if (prestCount > 0) {
        bucket.plazas_con_prestacion += 1;
      }

      const agentSet = agentsByPofId.get(position.id);
      if (agentSet) {
        for (const agentId of agentSet) {
          bucket.agentes.add(agentId);
        }
      }

      // El grupo "50" (HORAS CATEDRAS COMUNES) acumula horas cátedra en vez
      // de cargos. Para los demás códigos, hs_catedra queda en 0 y
      // representan cargos (ver columna "Hs. Cátedra" del reporte del MEC).
      if (code === '50') {
        bucket.hs_catedra += position.hours_count ?? 0;
      }
    }

    // Orden: por código numérico ascendente; luego los no-numéricos al final.
    return Array.from(buckets.values())
      .sort((a, b) => {
        const aNum = Number(a.codigo);
        const bNum = Number(b.codigo);
        const aValid = !Number.isNaN(aNum);
        const bValid = !Number.isNaN(bNum);
        if (aValid && bValid) return aNum - bNum;
        if (aValid) return -1;
        if (bValid) return 1;
        return a.codigo.localeCompare(b.codigo);
      })
      .map((bucket) => ({
        codigo: bucket.codigo,
        nivel_funcional: bucket.nivel_funcional,
        plazas: bucket.plazas,
        plazas_con_prestacion: bucket.plazas_con_prestacion,
        prestaciones: bucket.prestaciones,
        agentes: bucket.agentes.size,
        inconsistentes: bucket.inconsistentes,
        hs_catedra: bucket.hs_catedra,
        extra_pof_ss: bucket.extra_pof_ss,
        extra_pof_cs: bucket.extra_pof_cs,
      }));
  }
}

/**
 * Mapa oficial de códigos de Nivel Funcional, tomado del reporte de Estructura
 * POF del sistema del MEC (ge.mec.gob.ar). Ampliar si aparecen códigos nuevos.
 */
const NIVEL_FUNCIONAL_BY_CODE: Record<string, string> = {
  '01': 'RECTOR DE PRIMERA',
  '02': 'VICE-RECTOR DE PRIMERA',
  '20': 'JEFE DE DEPARTAMENTO',
  '28': 'SECRETARIO DE PRIMERA',
  '30': 'JEFE DE PRECEPTORES DE PRIMERA',
  '32': 'PRECEPTOR',
  '37': 'JEFE DE TALLER',
  '41': 'MAESTRO DE ENSEÑANZA PRACTICA',
  '45': 'JEFE DE SECCION',
  '49': 'BIBLIOTECARIO',
  '50': 'HORAS CATEDRAS COMUNES',
  '72': 'AUXILIAR ADMINISTRATIVO',
  '73': 'AUXILIAR DE DIRECCION',
  '81': 'PERSONAL DE SERVICIOS',
  '96': 'DOCENTE DE APOYO A LA INCLUSION',
};

type StructureBucket = {
  codigo: string;
  nivel_funcional: string;
  plazas: number;
  plazas_con_prestacion: number;
  prestaciones: number;
  agentes: Set<number>;
  inconsistentes: number;
  hs_catedra: number;
  extra_pof_ss: number;
  extra_pof_cs: number;
};

export type StructureRow = {
  codigo: string;
  nivel_funcional: string;
  plazas: number;
  plazas_con_prestacion: number;
  prestaciones: number;
  agentes: number;
  inconsistentes: number;
  hs_catedra: number;
  extra_pof_ss: number;
  extra_pof_cs: number;
};
