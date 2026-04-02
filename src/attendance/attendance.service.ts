import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';

type AttendanceStats = {
  total: number;
  counts: {
    LICENCIA: number;
    AUSENTE: number;
    CAPACITACION: number;
    CONSTANCIA: number;
    PARO: number;
  };
  percentages: {
    LICENCIA: number;
    AUSENTE: number;
    CAPACITACION: number;
    CONSTANCIA: number;
    PARO: number;
  };
};

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
  ) {}

  create(data: Partial<AttendanceRecord>) {
    const record = this.attendanceRepository.create(data);
    return this.attendanceRepository.save(record);
  }

  findAll() {
    return this.attendanceRepository.find({
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findByAgent(agentId: number) {
    return this.attendanceRepository.find({
      where: { agent_id: agentId },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findByAgentAndType(agentId: number, recordType: string) {
    return this.attendanceRepository.find({
      where: {
        agent_id: agentId,
        record_type: recordType,
      },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  async getStatsByAgent(agentId: number): Promise<AttendanceStats> {
    const items = await this.findByAgent(agentId);

    const counts = {
      LICENCIA: 0,
      AUSENTE: 0,
      CAPACITACION: 0,
      CONSTANCIA: 0,
      PARO: 0,
    };

    for (const item of items) {
      if (item.record_type in counts) {
        counts[item.record_type as keyof typeof counts] += 1;
      }
    }

    const total = items.length;

    const calc = (value: number) =>
      total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

    return {
      total,
      counts,
      percentages: {
        LICENCIA: calc(counts.LICENCIA),
        AUSENTE: calc(counts.AUSENTE),
        CAPACITACION: calc(counts.CAPACITACION),
        CONSTANCIA: calc(counts.CONSTANCIA),
        PARO: calc(counts.PARO),
      },
    };
  }

  update(id: number, data: Partial<AttendanceRecord>) {
    return this.attendanceRepository.update(id, data);
  }

  remove(id: number) {
    return this.attendanceRepository.delete(id);
  }
}
