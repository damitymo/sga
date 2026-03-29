import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RevistaService } from './revista.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('revista')
export class RevistaController {
  constructor(private readonly revistaService: RevistaService) {}

  @Get()
  findAll() {
    return this.revistaService.findAll();
  }

  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.revistaService.findByAgent(Number(agentId));
  }

  @Get('agent/:agentId/current')
  findCurrentByAgent(@Param('agentId') agentId: string) {
    return this.revistaService.findCurrentByAgent(Number(agentId));
  }

  @Get('agent/:agentId/historical')
  findHistoricalByAgent(@Param('agentId') agentId: string) {
    return this.revistaService.findHistoricalByAgent(Number(agentId));
  }
}
