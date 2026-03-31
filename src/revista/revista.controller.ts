import {
  Controller,
  ForbiddenException,
  Get,
  Param,
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

  @Get('agent/:agentId')
  findByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId') agentId: string,
  ) {
    const user = req.user;
    const targetAgentId = Number(agentId);

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== targetAgentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su propia revista.',
        );
      }
    }

    return this.revistaService.findByAgent(targetAgentId);
  }

  @Get('agent/:agentId/current')
  findCurrentByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId') agentId: string,
  ) {
    const user = req.user;
    const targetAgentId = Number(agentId);

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== targetAgentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su revista actual.',
        );
      }
    }

    return this.revistaService.findCurrentByAgent(targetAgentId);
  }

  @Get('agent/:agentId/historical')
  findHistoricalByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId') agentId: string,
  ) {
    const user = req.user;
    const targetAgentId = Number(agentId);

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      if (user.agent_id !== targetAgentId) {
        throw new ForbiddenException(
          'El rol AGENTE solo puede ver su revista histórica.',
        );
      }
    }

    return this.revistaService.findHistoricalByAgent(targetAgentId);
  }
}
