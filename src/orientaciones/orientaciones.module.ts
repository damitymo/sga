import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrientacionesController } from './orientaciones.controller';
import { OrientacionesService } from './orientaciones.service';
import { Orientacion } from './entities/orientacion.entity';
import { Curso } from '../cursos/entities/curso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Orientacion, Curso])],
  controllers: [OrientacionesController],
  providers: [OrientacionesService],
  exports: [OrientacionesService],
})
export class OrientacionesModule {}
