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
import { AttendanceService } from './attendance.service';
import {
  AttendanceConditionType,
  AttendanceRecord,
  AttendanceShift,
  AttendanceStatus,
} from './entities/attendance-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

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
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('conditionType') conditionType?: string,
    @Query('shift') shift?: string,
  ) {
    const user = req.user;

    const filters = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      status: status ? (status as AttendanceStatus) : undefined,
      conditionType: conditionType
        ? (conditionType as AttendanceConditionType)
        : undefined,
      shift: shift ? (shift as AttendanceShift) : undefined,
    };

    if (user.role === 'AGENTE') {
      if (!user.agent_id) {
        throw new ForbiddenException(
          'El usuario AGENTE no está vinculado a un docente/agente.',
        );
      }

      return this.attendanceService.findByAgent(user.agent_id, filters);
    }

    return this.attendanceService.findAll(filters);
  }

  @Get('me')
  findMyAttendance(
    @Request() req: AuthenticatedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('conditionType') conditionType?: string,
    @Query('shift') shift?: string,
  ) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    return this.attendanceService.findByAgent(user.agent_id, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      status: status ? (status as AttendanceStatus) : undefined,
      conditionType: conditionType
        ? (conditionType as AttendanceConditionType)
        : undefined,
      shift: shift ? (shift as AttendanceShift) : undefined,
    });
  }

  @Get('me/grid')
  findMyGrid(
    @Request() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    const parsedYear = year ? Number(year) : new Date().getFullYear();

    return this.attendanceService.getAnnualGrid(user.agent_id, parsedYear);
  }

  @Get('me/stats')
  findMyStats(
    @Request() req: AuthenticatedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('conditionType') conditionType?: string,
    @Query('shift') shift?: string,
  ) {
    const user = req.user;

    if (!user.agent_id) {
      throw new ForbiddenException(
        'El usuario autenticado no está vinculado a un docente/agente.',
      );
    }

    return this.attendanceService.getStatsByAgent(user.agent_id, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      conditionType: conditionType
        ? (conditionType as AttendanceConditionType)
        : undefined,
      shift: shift ? (shift as AttendanceShift) : undefined,
    });
  }

  @Get('agent/:agentId')
  findByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('conditionType') conditionType?: string,
    @Query('shift') shift?: string,
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

    return this.attendanceService.findByAgent(agentId, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      status: status ? (status as AttendanceStatus) : undefined,
      conditionType: conditionType
        ? (conditionType as AttendanceConditionType)
        : undefined,
      shift: shift ? (shift as AttendanceShift) : undefined,
    });
  }

  @Get('agent/:agentId/grid')
  findGridByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Query('year') year?: string,
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

    const parsedYear = year ? Number(year) : new Date().getFullYear();

    return this.attendanceService.getAnnualGrid(agentId, parsedYear);
  }

  @Get('agent/:agentId/stats')
  findStatsByAgent(
    @Request() req: AuthenticatedRequest,
    @Param('agentId', ParseIntPipe) agentId: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('conditionType') conditionType?: string,
    @Query('shift') shift?: string,
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

    return this.attendanceService.getStatsByAgent(agentId, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      conditionType: conditionType
        ? (conditionType as AttendanceConditionType)
        : undefined,
      shift: shift ? (shift as AttendanceShift) : undefined,
    });
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: CreateAttendanceRecordDto) {
    return this.attendanceService.create(
      body as unknown as Partial<AttendanceRecord>,
    );
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAttendanceRecordDto,
  ) {
    return this.attendanceService.update(
      id,
      body as unknown as Partial<AttendanceRecord>,
    );
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.remove(id);
  }
}
