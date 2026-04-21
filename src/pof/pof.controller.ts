import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PofService } from './pof.service';
import { PofPosition } from './entities/pof-position.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePofPositionDto } from './dto/create-pof-position.dto';
import { UpdatePofPositionDto } from './dto/update-pof-position.dto';

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
@Controller('pof')
export class PofController {
  constructor(private readonly pofService: PofService) {}

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('plaza') plaza?: string,
    @Query('docente') docente?: string,
    @Query('materia') materia?: string,
    @Query('curso') curso?: string,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      throw new ForbiddenException(
        'El rol AGENTE no puede consultar la POF general.',
      );
    }

    return this.pofService.findAll({
      plaza,
      docente,
      materia,
      curso,
    });
  }

  @Get('plaza/:plazaNumber')
  findByPlazaNumber(
    @Request() req: AuthenticatedRequest,
    @Param('plazaNumber') plazaNumber: string,
  ) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      throw new ForbiddenException(
        'El rol AGENTE no puede consultar plazas de la POF.',
      );
    }

    return this.pofService.findByPlazaNumber(plazaNumber);
  }

  @Get(':id/history')
  getHistory(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = req.user;

    if (user.role === 'AGENTE') {
      throw new ForbiddenException(
        'El rol AGENTE no puede consultar historial de POF.',
      );
    }

    return this.pofService.getHistory(Number(id));
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: CreatePofPositionDto) {
    return this.pofService.create(body as unknown as Partial<PofPosition>);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePofPositionDto) {
    return this.pofService.update(
      Number(id),
      body as unknown as Partial<PofPosition>,
    );
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pofService.remove(Number(id));
  }
}
