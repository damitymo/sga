import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicenseType } from './entities/license-type.entity';

@Injectable()
export class LicenseTypesService {
  constructor(
    @InjectRepository(LicenseType)
    private readonly licenseTypesRepository: Repository<LicenseType>,
  ) {}

  create(data: Partial<LicenseType>) {
    const licenseType = this.licenseTypesRepository.create(data);
    return this.licenseTypesRepository.save(licenseType);
  }

  findAll() {
    return this.licenseTypesRepository.find({
      where: { is_active: true },
      order: { article: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.licenseTypesRepository.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<LicenseType>) {
    await this.licenseTypesRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const licenseType = await this.findOne(id);

    if (!licenseType) return null;

    licenseType.is_active = false;
    return this.licenseTypesRepository.save(licenseType);
  }
}
