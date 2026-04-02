import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Agent } from './entities/agent.entity';

type AuthenticatedRequest = {
  user: {
    id: number;
    userId: number;
    username: string;
    full_name: string;
    role: string;
    agent_id?: number | null;
  };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      const ownAgent = await this.agentsService.findOne(user.agent_id);
      return ownAgent ? [ownAgent] : [];
    }

    return this.agentsService.findAll();
  }

  @Get('birthdays/month')
  findBirthdaysByCurrentMonth() {
    return this.agentsService.findBirthdaysByCurrentMonth();
  }

  @Get('search')
  search(
    @Request() req: AuthenticatedRequest,
    @Query('dni') dni?: string,
    @Query('apellido') apellido?: string,
    @Query('nombre') nombre?: string,
    @Query('materia') materia?: string,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      throw new ForbiddenException(
        'El rol AGENTE no puede realizar búsquedas generales de docentes.',
      );
    }

    return this.agentsService.search({
      dni,
      apellido,
      nombre,
      materia,
    });
  }

  @Get('dni/:dni')
  findByDni(@Request() req: AuthenticatedRequest, @Param('dni') dni: string) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      throw new ForbiddenException(
        'El rol AGENTE no puede buscar docentes por DNI.',
      );
    }

    return this.agentsService.findByDni(dni);
  }

  @Get(':id/full-profile')
  findFullProfile(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== id) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su propio perfil.',
        );
      }
    }

    return this.agentsService.findFullProfile(id);
  }

  @Get(':id')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== id) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver sus propios datos.',
        );
      }
    }

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
