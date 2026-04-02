import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Request,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      return this.attendanceService.findByAgent(user.agent_id);
    }

    return this.attendanceService.findAll();
  }

  @Get('me/stats')
  findMyStats(@Request() req: AuthenticatedRequest) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    return this.attendanceService.getStatsByAgent(user.agent_id);
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
          'El rol AGENTE solo puede ver su propia asistencia.',
        );
      }
    }

    return this.attendanceService.findByAgent(agentId);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: Partial<AttendanceRecord>) {
    return this.attendanceService.create(body);
  }
}
