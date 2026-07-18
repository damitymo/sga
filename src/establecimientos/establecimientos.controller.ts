import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EstablecimientosService } from './establecimientos.service';
import { Establecimiento } from './entities/establecimiento.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateEstablecimientoDto } from './dto/create-establecimiento.dto';
import { UpdateEstablecimientoDto } from './dto/update-establecimiento.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('establecimientos')
export class EstablecimientosController {
  constructor(
    private readonly establecimientosService: EstablecimientosService,
  ) {}

  @Get()
  findAll() {
    return this.establecimientosService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() body: CreateEstablecimientoDto) {
    return this.establecimientosService.create(
      body as unknown as Partial<Establecimiento>,
    );
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateEstablecimientoDto) {
    return this.establecimientosService.update(
      Number(id),
      body as unknown as Partial<Establecimiento>,
    );
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.establecimientosService.remove(Number(id));
  }
}
