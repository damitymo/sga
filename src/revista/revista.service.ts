import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevistaRecord } from './entities/revista-record.entity';

function hasEndDate(value?: Date | string | null): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isHistoricalRecord(record: RevistaRecord): boolean {
  if (hasEndDate(record.end_date)) return true;
  if (record.is_current === false) return true;
  return false;
}

function sortRevistaDesc(a: RevistaRecord, b: RevistaRecord): number {
  const aTime = a.start_date ? new Date(a.start_date).getTime() : 0;
  const bTime = b.start_date ? new Date(b.start_date).getTime() : 0;

  if (bTime !== aTime) return bTime - aTime;
  return (b.id ?? 0) - (a.id ?? 0);
}

@Injectable()
export class RevistaService {
  constructor(
    @InjectRepository(RevistaRecord)
    private readonly revistaRepository: Repository<RevistaRecord>,
  ) {}

  create(data: Partial<RevistaRecord>) {
    const record = this.revistaRepository.create(data);
    return this.revistaRepository.save(record);
  }

  findAll() {
    return this.revistaRepository.find({
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  async findByAgent(agentId: number) {
    const records = await this.revistaRepository.find({
      where: { agent_id: agentId },
      order: { start_date: 'DESC', id: 'DESC' },
    });

    return records.sort(sortRevistaDesc);
  }

  async findCurrentByAgent(agentId: number) {
    const records = await this.findByAgent(agentId);
    return records.filter((record) => !isHistoricalRecord(record));
  }

  async findHistoricalByAgent(agentId: number) {
    const records = await this.findByAgent(agentId);
    return records.filter((record) => isHistoricalRecord(record));
  }

  async closeCurrentRecordsByAgentAndPosition(
    agentId: number,
    pofPositionId: number,
    endDate: string,
  ) {
    const currentRecords = await this.revistaRepository.find({
      where: {
        agent_id: agentId,
        pof_position_id: pofPositionId,
        is_current: true,
      },
    });

    if (!currentRecords.length) return [];

    const updated = currentRecords.map((record) => ({
      ...record,
      is_current: false,
      end_date: endDate as unknown as Date,
    }));

    return this.revistaRepository.save(updated);
  }

  update(id: number, data: Partial<RevistaRecord>) {
    return this.revistaRepository.update(id, data);
  }

  remove(id: number) {
    return this.revistaRepository.delete(id);
  }
}
