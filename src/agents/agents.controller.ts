import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Agent } from './entities/agent.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Get('search')
  search(
    @Query('dni') dni?: string,
    @Query('apellido') apellido?: string,
    @Query('nombre') nombre?: string,
    @Query('materia') materia?: string,
  ) {
    return this.agentsService.search({
      dni,
      apellido,
      nombre,
      materia,
    });
  }

  @Get('dni/:dni')
  findByDni(@Param('dni') dni: string) {
    return this.agentsService.findByDni(dni);
  }

  @Get(':id/full-profile')
  findFullProfile(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findFullProfile(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: Partial<Agent>) {
    return this.agentsService.create(body);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<Agent>) {
    return this.agentsService.update(id, body);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.remove(id);
  }
}
