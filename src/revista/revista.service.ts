import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevistaRecord } from './entities/revista-record.entity';

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
      order: { id: 'DESC' },
    });
  }

  findByAgent(agentId: number) {
    return this.revistaRepository.find({
      where: { agent_id: agentId },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findCurrentByAgent(agentId: number) {
    return this.revistaRepository.find({
      where: { agent_id: agentId, is_current: true },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findHistoricalByAgent(agentId: number) {
    return this.revistaRepository.find({
      where: { agent_id: agentId, is_current: false },
      order: { start_date: 'DESC', id: 'DESC' },
    });
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
      end_date: endDate,
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
