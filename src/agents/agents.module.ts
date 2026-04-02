import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './entities/agent.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { RevistaRecord } from '../revista/entities/revista-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentAssignment,
      AttendanceRecord,
      RevistaRecord,
    ]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, TypeOrmModule],
})
export class AgentsModule {}
