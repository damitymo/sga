import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PofController } from './pof.controller';
import { PofService } from './pof.service';
import { PofPosition } from './entities/pof-position.entity';
import { AgentAssignment } from '../assignments/entities/agent-assignment.entity';
import { PofHistory } from './entities/pof-history.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([PofPosition, AgentAssignment, PofHistory]),
  ],
  controllers: [PofController],
  providers: [PofService],
  exports: [PofService],
})
export class PofModule {}
