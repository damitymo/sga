import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentAssignment } from './entities/agent-assignment.entity';
import { Agent } from '../agents/entities/agent.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { RevistaModule } from '../revista/revista.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentAssignment, Agent, PofPosition]),
    RevistaModule,
  ],
  providers: [AssignmentsService],
  controllers: [AssignmentsController],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
