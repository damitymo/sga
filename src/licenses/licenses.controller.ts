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
import { LicensesService } from './licenses.service';
import { License } from './entities/license.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';

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
@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Get()
  findAll(
    @Query('agentId') agentId?: string,
    @Query('licenseTypeId') licenseTypeId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.licensesService.findAll({
      agentId: agentId ? Number(agentId) : undefined,
      licenseTypeId: licenseTypeId ? Number(licenseTypeId) : undefined,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
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
          'El rol AGENTE solo puede ver sus propias licencias.',
        );
      }
    }

    return this.licensesService.findByAgent(agentId);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(@Body() body: CreateLicenseDto) {
    return this.licensesService.create(body as unknown as Partial<License>);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLicenseDto) {
    return this.licensesService.update(
      Number(id),
      body as unknown as Partial<License>,
    );
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licensesService.remove(Number(id));
  }
}
