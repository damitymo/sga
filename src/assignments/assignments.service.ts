import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AgentAssignment } from './entities/agent-assignment.entity';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { RevistaService } from '../revista/revista.service';
import { CreateAssignmentByPlazaNumberDto } from './dto/create-assignment-by-plaza-number.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(AgentAssignment)
    private readonly assignmentsRepository: Repository<AgentAssignment>,

    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,

    @InjectRepository(PofPosition)
    private readonly pofRepository: Repository<PofPosition>,

    private readonly revistaService: RevistaService,
  ) {}

  private buildLegalNormLabel(
    legalNormType?: string | null,
    legalNormNumber?: string | null,
  ): string | undefined {
    if (!legalNormType && !legalNormNumber) {
      return undefined;
    }

    const labels: Record<string, string> = {
      DECRETO: 'Decreto',
      RESOLUCION_MINISTERIAL: 'Resolución Ministerial',
      DISPOSICION: 'Disposición',
      RI: 'Resolución Interna (R.I.)',
    };

    let typeLabel = '';

    if (legalNormType) {
      typeLabel = labels[legalNormType] || legalNormType;
    }

    const numberLabel = legalNormNumber ? legalNormNumber.trim() : '';

    return `${typeLabel}${typeLabel && numberLabel ? ' Nº ' : ''}${numberLabel}`.trim();
  }

  async createByPlazaNumber(data: CreateAssignmentByPlazaNumberDto) {
    const agent = await this.agentsRepository.findOne({
      where: { id: data.agent_id, is_active: true },
    });

    if (!agent) {
      throw new NotFoundException('No existe el agente o está inactivo');
    }

    const pofPosition = await this.pofRepository.findOne({
      where: { plaza_number: data.plaza_number, is_active: true },
    });

    if (!pofPosition) {
      throw new NotFoundException('No existe la plaza o está inactiva');
    }

    const assignmentDateStr =
      data.assignment_date ?? new Date().toISOString().slice(0, 10);

    const assignmentDate = new Date(assignmentDateStr);

    if (Number.isNaN(assignmentDate.getTime())) {
      throw new BadRequestException('La fecha desde es inválida');
    }

    let bajaDate: Date | undefined;

    if (data.movement_type === 'BAJA') {
      const bajaDateStr = data.end_date ?? assignmentDateStr;
      bajaDate = new Date(bajaDateStr);

      if (Number.isNaN(bajaDate.getTime())) {
        throw new BadRequestException('La fecha hasta es inválida');
      }

      if (bajaDate.getTime() < assignmentDate.getTime()) {
        throw new BadRequestException(
          'La fecha hasta no puede ser anterior a la fecha desde',
        );
      }
    }

    const activeAssignment = await this.assignmentsRepository.findOne({
      where: {
        agent_id: data.agent_id,
        pof_position_id: pofPosition.id,
        status: 'ACTIVA',
      },
      order: { id: 'DESC' },
    });

    if (data.movement_type === 'DESIGNACION' && activeAssignment) {
      throw new BadRequestException(
        'Esa plaza ya está activa para este docente. No se puede designar nuevamente.',
      );
    }

    if (data.movement_type === 'BAJA' && !activeAssignment) {
      throw new BadRequestException(
        'No existe una designación activa para esa plaza y ese docente. No se puede dar de baja.',
      );
    }

    const status: 'ACTIVA' | 'FINALIZADA' =
      data.movement_type === 'BAJA' ? 'FINALIZADA' : 'ACTIVA';

    const legalNormLabel = this.buildLegalNormLabel(
      data.legal_norm_type,
      data.legal_norm_number,
    );

    const characterType =
      data.character_type ?? pofPosition.revista_status ?? 'TITULAR';

    const assignmentPayload: DeepPartial<AgentAssignment> = {
      agent_id: data.agent_id,
      pof_position_id: pofPosition.id,
      movement_type: data.movement_type,
      resolution_number: data.legal_norm_number ?? undefined,
      legal_norm: legalNormLabel,
      legal_norm_type: data.legal_norm_type ?? undefined,
      legal_norm_number: data.legal_norm_number ?? undefined,
      character_type: characterType,
      assignment_date: assignmentDate,
      end_date: data.movement_type === 'BAJA' ? bajaDate : undefined,
      status,
      notes: data.notes?.trim() || undefined,
    };

    const assignment = this.assignmentsRepository.create(assignmentPayload);
    const savedAssignment = await this.assignmentsRepository.save(assignment);

    if (data.movement_type === 'DESIGNACION') {
      await this.revistaService.create({
        agent_id: data.agent_id,
        pof_position_id: pofPosition.id,
        assignment_id: savedAssignment.id,
        revista_type: 'DOCENTE',
        character_type: characterType,
        start_date: assignmentDate,
        end_date: null,
        is_current: true,
        legal_norm: legalNormLabel ?? pofPosition.legal_norm ?? undefined,
        resolution_number: data.legal_norm_number ?? undefined,
        notes:
          data.notes?.trim() || 'Generado automáticamente desde designación',
      });
    }

    if (data.movement_type === 'BAJA') {
      const closeDateStr = data.end_date ?? assignmentDateStr;

      await this.revistaService.closeCurrentRecordsByAgentAndPosition(
        data.agent_id,
        pofPosition.id,
        closeDateStr,
      );

      await this.assignmentsRepository.update(activeAssignment!.id, {
        status: 'FINALIZADA',
        end_date: bajaDate,
      });
    }

    return this.assignmentsRepository.findOne({
      where: { id: savedAssignment.id },
    });
  }

  async create(data: Partial<AgentAssignment>) {
    const assignment = this.assignmentsRepository.create(
      data as DeepPartial<AgentAssignment>,
    );
    return this.assignmentsRepository.save(assignment);
  }

  findAll() {
    return this.assignmentsRepository.find({
      order: { id: 'DESC' },
    });
  }

  findByAgent(agentId: number) {
    return this.assignmentsRepository.find({
      where: { agent_id: agentId },
      order: { id: 'DESC' },
    });
  }

  async update(id: number, data: UpdateAssignmentDto) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('No existe la asignación');
    }

    const patch: Partial<AgentAssignment> = {
      movement_type: data.movement_type ?? assignment.movement_type,
      resolution_number:
        data.legal_norm_number ||
        data.resolution_number ||
        assignment.resolution_number,
      legal_norm_type: data.legal_norm_type ?? assignment.legal_norm_type,
      legal_norm_number: data.legal_norm_number ?? assignment.legal_norm_number,
      character_type: data.character_type ?? assignment.character_type,
      legal_norm:
        this.buildLegalNormLabel(
          data.legal_norm_type ?? assignment.legal_norm_type,
          data.legal_norm_number ?? assignment.legal_norm_number,
        ) ??
        data.legal_norm ??
        assignment.legal_norm,
      status: data.status ?? assignment.status,
      notes: data.notes ?? assignment.notes,
    };

    if (data.assignment_date) {
      const parsedStart = new Date(data.assignment_date);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new BadRequestException('La fecha desde es inválida');
      }
      patch.assignment_date = parsedStart;
    }

    if (data.end_date) {
      const parsedEnd = new Date(data.end_date);
      if (Number.isNaN(parsedEnd.getTime())) {
        throw new BadRequestException('La fecha hasta es inválida');
      }
      patch.end_date = parsedEnd;
    }

    await this.assignmentsRepository.update(id, patch);

    return this.assignmentsRepository.findOne({
      where: { id },
    });
  }

  remove(id: number) {
    return this.assignmentsRepository.delete(id);
  }
}
