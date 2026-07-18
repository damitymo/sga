import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EstablecimientosController } from './establecimientos.controller';
import { EstablecimientosService } from './establecimientos.service';
import { Establecimiento } from './entities/establecimiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Establecimiento])],
  controllers: [EstablecimientosController],
  providers: [EstablecimientosService],
  exports: [EstablecimientosService],
})
export class EstablecimientosModule {}
