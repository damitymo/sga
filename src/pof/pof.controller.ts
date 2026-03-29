import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PofService } from './pof.service';
import { PofPosition } from './entities/pof-position.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pof')
export class PofController {
  constructor(private readonly pofService: PofService) {}

  @Get()
  findAll(
    @Query('plaza') plaza?: string,
    @Query('docente') docente?: string,
    @Query('materia') materia?: string,
    @Query('curso') curso?: string,
  ) {
    return this.pofService.findAll({
      plaza,
      docente,
      materia,
      curso,
    });
  }

  @Get('plaza/:plazaNumber')
  findByPlazaNumber(@Param('plazaNumber') plazaNumber: string) {
    return this.pofService.findByPlazaNumber(plazaNumber);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.pofService.getHistory(Number(id));
  }

  @Roles('ADMINISTRATIVO')
  @Post()
  create(@Body() body: Partial<PofPosition>) {
    return this.pofService.create(body);
  }

  @Roles('ADMINISTRATIVO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<PofPosition>) {
    return this.pofService.update(Number(id), body);
  }

  @Roles('ADMINISTRATIVO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pofService.remove(Number(id));
  }
}
