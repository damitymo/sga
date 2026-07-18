import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CursosService } from './cursos.service';
import { Curso } from './entities/curso.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  findAll(@Query('establecimientoId') establecimientoId?: string) {
    return this.cursosService.findAll({
      establecimientoId: establecimientoId ? Number(establecimientoId) : undefined,
    });
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: CreateCursoDto) {
    return this.cursosService.create(body as unknown as Partial<Curso>);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCursoDto) {
    return this.cursosService.update(
      Number(id),
      body as unknown as Partial<Curso>,
    );
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cursosService.remove(Number(id));
  }
}
