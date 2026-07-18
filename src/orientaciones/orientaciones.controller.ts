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
import { OrientacionesService } from './orientaciones.service';
import { Orientacion } from './entities/orientacion.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateOrientacionDto } from './dto/create-orientacion.dto';
import { UpdateOrientacionDto } from './dto/update-orientacion.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orientaciones')
export class OrientacionesController {
  constructor(private readonly orientacionesService: OrientacionesService) {}

  @Get()
  findAll() {
    return this.orientacionesService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() body: CreateOrientacionDto) {
    return this.orientacionesService.create(
      body as unknown as Partial<Orientacion>,
    );
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateOrientacionDto) {
    return this.orientacionesService.update(
      Number(id),
      body as unknown as Partial<Orientacion>,
    );
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orientacionesService.remove(Number(id));
  }
}
