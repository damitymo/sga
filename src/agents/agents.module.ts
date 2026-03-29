import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './entities/agent.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentAssignment])],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
