import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LicenseTypesService } from './license-types.service';
import { LicenseType } from './entities/license-type.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateLicenseTypeDto } from './dto/create-license-type.dto';
import { UpdateLicenseTypeDto } from './dto/update-license-type.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('license-types')
export class LicenseTypesController {
  constructor(private readonly licenseTypesService: LicenseTypesService) {}

  @Get()
  findAll() {
    return this.licenseTypesService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() body: CreateLicenseTypeDto) {
    return this.licenseTypesService.create(
      body as unknown as Partial<LicenseType>,
    );
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateLicenseTypeDto) {
    return this.licenseTypesService.update(
      Number(id),
      body as unknown as Partial<LicenseType>,
    );
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licenseTypesService.remove(Number(id));
  }
}
