import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevistaRecord } from './entities/revista-record.entity';
import { RevistaService } from './revista.service';
import { RevistaController } from './revista.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RevistaRecord])],
  providers: [RevistaService],
  controllers: [RevistaController],
  exports: [RevistaService, TypeOrmModule],
})
export class RevistaModule {}
