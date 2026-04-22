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

type Holder = {
  assignment_id: number;
  agent_id: number | null;
  full_name: string | null;
  dni: string | null;
  movement_type: string | null;
  character_type: string | null;
  assignment_date: Date | null;
  end_date: Date | null;
  status: string | null;
};

/**
 * Resultado por plaza para la lista/detalle de POF.
 *
 * - `current_holder`: docente que está rindiendo servicio hoy.
 *   Si hay un SUPLENTE activo, él es el actual (porque el titular
 *   está cubierto con licencia). Si no, la asignación ACTIVA más
 *   reciente por fecha.
 * - `covered_titular`: cuando hay un suplente cubriendo, este campo
 *   expone al titular/interino con licencia. Null si no aplica.
 * - `previous_holder`: última asignación FINALIZADA (o con end_date
 *   en el pasado) para esta plaza, ordenada por fecha de cierre desc.
 */
type PofResult = PofPosition & {
  current_holder: Holder | null;
  covered_titular: Holder | null;
  previous_holder: Holder | null;
};

const CARACTER_SUPLENTE = ['SUPLENTE'];
const CARACTER_TITULAR_INTERINO = ['TITULAR', 'INTERINO'];

function normalizeCaracter(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().trim();
}

function isSuplente(assignment: AgentAssignment): boolean {
  const c = normalizeCaracter(assignment.character_type);
  return CARACTER_SUPLENTE.includes(c);
}

function isTitularOrInterino(assignment: AgentAssignment): boolean {
  const c = normalizeCaracter(assignment.character_type);
  return CARACTER_TITULAR_INTERINO.includes(c);
}

function toHolder(assignment: AgentAssignment): Holder {
  return {
    assignment_id: assignment.id,
    agent_id: assignment.agent?.id ?? null,
    full_name: assignment.agent?.full_name ?? null,
    dni: assignment.agent?.dni ?? null,
    movement_type: assignment.movement_type ?? null,
    character_type: assignment.character_type ?? null,
    assignment_date: assignment.assignment_date ?? null,
    end_date: assignment.end_date ?? null,
    status: assignment.status ?? null,
  };
}

function dateDesc(a: Date | null | undefined, b: Date | null | undefined): number {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return tb - ta;
}

/**
 * Dado el conjunto de asignaciones de UNA plaza, decide quién es
 * el actual, el titular cubierto (si aplica) y el anterior cerrado.
 */
function classifyAssignments(assignments: AgentAssignment[]): {
  current: Holder | null;
  covered: Holder | null;
  previous: Holder | null;
} {
  const activas = assignments.filter((a) => a.status === 'ACTIVA');
  const cerradas = assignments
    .filter((a) => a.status !== 'ACTIVA')
    .sort((a, b) => dateDesc(a.end_date ?? a.assignment_date, b.end_date ?? b.assignment_date));

  let current: AgentAssignment | null = null;
  let covered: AgentAssignment | null = null;

  const suplente = activas.find(isSuplente);

  if (suplente) {
    current = suplente;
    // Entre los demás activos, buscamos a un titular/interino con la misma plaza
    // (aunque en un caso normal habrá sólo uno).
    const titular = activas.find(
      (a) => a.id !== suplente.id && isTitularOrInterino(a),
    );
    if (titular) covered = titular;
  } else if (activas.length > 0) {
    current = activas
      .slice()
      .sort((a, b) => dateDesc(a.assignment_date, b.assignment_date))[0];
  }

  return {
    current: current ? toHolder(current) : null,
    covered: covered ? toHolder(covered) : null,
    previous: cerradas[0] ? toHolder(cerradas[0]) : null,
  };
}

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

    // Traemos TODAS las asignaciones (activas + cerradas) en un solo query.
    // Con ~1100 plazas y 1-3 asignaciones por plaza, es manejable en memoria
    // y nos evita N+1 queries al clasificar actual/cubierto/anterior.
    const allAssignments = await this.assignmentsRepository.find({
      relations: ['agent', 'pof_position'],
      order: { assignment_date: 'DESC' },
    });

    const byPofId = new Map<number, AgentAssignment[]>();

    for (const assignment of allAssignments) {
      const pofId = assignment.pof_position?.id;
      if (!pofId) continue;
      if (!byPofId.has(pofId)) byPofId.set(pofId, []);
      byPofId.get(pofId)!.push(assignment);
    }

    let result: PofResult[] = positions.map((position) => {
      const { current, covered, previous } = classifyAssignments(
        byPofId.get(position.id) ?? [],
      );

      return {
        ...position,
        current_holder: current,
        covered_titular: covered,
        previous_holder: previous,
      };
    });

    // 🔎 filtro por docente: aplica sobre actual O titular cubierto O anterior,
    // así el usuario puede encontrar un docente aunque esté con licencia o
    // haya dejado la plaza hace poco.
    if (filters?.docente?.trim()) {
      const docenteFilter = filters.docente.trim().toLowerCase();

      result = result.filter((item) => {
        const names = [
          item.current_holder?.full_name,
          item.covered_titular?.full_name,
          item.previous_holder?.full_name,
        ];

        return names.some((n) => n?.toLowerCase().includes(docenteFilter));
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

    const assignments = await this.assignmentsRepository.find({
      where: { pof_position_id: position.id },
      relations: ['agent', 'pof_position'],
      order: { assignment_date: 'DESC' },
    });

    const { current, covered, previous } = classifyAssignments(assignments);

    return {
      ...position,
      current_holder: current,
      covered_titular: covered,
      previous_holder: previous,
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
