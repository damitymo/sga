import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from './entities/attendance-record.entity';

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
    return this.attendanceRepository.find();
  }

  findByAgent(agentId: number) {
    return this.attendanceRepository.find({
      where: { agent_id: agentId },
      order: { start_date: 'DESC' },
    });
  }

  findByAgentAndType(agentId: number, recordType: string) {
    return this.attendanceRepository.find({
      where: {
        agent_id: agentId,
        record_type: recordType,
      },
      order: { start_date: 'DESC' },
    });
  }

  update(id: number, data: Partial<AttendanceRecord>) {
    return this.attendanceRepository.update(id, data);
  }

  remove(id: number) {
    return this.attendanceRepository.delete(id);
  }
}
