import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateAssignmentByPlazaNumberDto } from './dto/create-assignment-by-plaza-number.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AgentAssignment } from './entities/agent-assignment.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll() {
    return this.assignmentsService.findAll();
  }

  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.assignmentsService.findByAgent(Number(agentId));
  }

  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Post()
  create(@Body() body: Partial<AgentAssignment>) {
    return this.assignmentsService.create(body);
  }

  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Post('by-plaza-number')
  createByPlazaNumber(@Body() body: CreateAssignmentByPlazaNumberDto) {
    return this.assignmentsService.createByPlazaNumber(body);
  }

  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAssignmentDto) {
    return this.assignmentsService.update(Number(id), body);
  }

  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assignmentsService.remove(Number(id));
  }

  /**
   * Devuelve el Horario de Clase (matriz 5x7) de la asignación.
   * Accesible a cualquier usuario autenticado — el front ya valida que solo
   * ADMIN/ADMINISTRATIVO puedan modificarlo.
   */
  @Get(':id/schedule')
  getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.getSchedule(id);
  }

  @Roles('ADMINISTRATIVO', 'ADMIN')
  @Put(':id/schedule')
  putSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { weekly_schedule: boolean[][] },
  ) {
    return this.assignmentsService.setSchedule(id, body.weekly_schedule);
  }
}
