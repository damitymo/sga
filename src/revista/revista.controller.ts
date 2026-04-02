import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RevistaService } from './revista.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

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
@Controller('revista')
export class RevistaController {
  constructor(private readonly revistaService: RevistaService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      return this.revistaService.findByAgent(user.agent_id);
    }

    return this.revistaService.findAll();
  }

  @Get('me/current')
  findMyCurrent(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    return this.revistaService.findCurrentByAgent(user.agent_id);
  }

  @Get('me/historical')
  findMyHistorical(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    return this.revistaService.findHistoricalByAgent(user.agent_id);
  }

  @Get('agent/:agentId')
  findByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== agentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su propia revista.',
        );
      }
    }

    return this.revistaService.findByAgent(agentId);
  }

  @Get('agent/:agentId/current')
  findCurrentByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== agentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su revista actual.',
        );
      }
    }

    return this.revistaService.findCurrentByAgent(agentId);
  }

  @Get('agent/:agentId/historical')
  findHistoricalByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== agentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su revista histórica.',
        );
      }
    }

    return this.revistaService.findHistoricalByAgent(agentId);
  }
}
