import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.attendanceService.findByAgent(Number(agentId));
  }

  @Roles('ADMINISTRATIVO')
  @Post()
  create(@Body() body: Partial<AttendanceRecord>) {
    return this.attendanceService.create(body);
  }
}
