import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LicenseTypesController } from './license-types.controller';
import { LicenseTypesService } from './license-types.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { LicenseType } from './entities/license-type.entity';
import { License } from './entities/license.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LicenseType, License])],
  controllers: [LicenseTypesController, LicensesController],
  providers: [LicenseTypesService, LicensesService],
  exports: [LicenseTypesService, LicensesService],
})
export class LicensesModule {}
