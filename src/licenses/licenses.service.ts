import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { License } from './entities/license.entity';

type LicenseFilters = {
  agentId?: number;
  licenseTypeId?: number;
  year?: number;
  month?: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calcula la cantidad de días de una licencia a partir de las fechas.
 * Nunca confiamos en un `days_count` que venga del cliente.
 */
function computeDaysCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return diff + 1;
}

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(License)
    private readonly licensesRepository: Repository<License>,
  ) {}

  create(data: Partial<License>) {
    const license = this.licensesRepository.create({
      ...data,
      days_count: computeDaysCount(
        data.start_date as string,
        data.end_date as string,
      ),
    });

    return this.licensesRepository.save(license);
  }

  async findAll(filters?: LicenseFilters) {
    const where: Record<string, unknown> = {};

    if (filters?.agentId) where.agent_id = filters.agentId;
    if (filters?.licenseTypeId) where.license_type_id = filters.licenseTypeId;

    if (filters?.year) {
      const month = filters.month;
      const from = month
        ? `${filters.year}-${String(month).padStart(2, '0')}-01`
        : `${filters.year}-01-01`;
      const to = month
        ? new Date(filters.year, month, 0).toISOString().slice(0, 10)
        : `${filters.year}-12-31`;

      where.start_date = Between(from, to);
    }

    return this.licensesRepository.find({
      where,
      relations: { agent: true, license_type: true },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findByAgent(agentId: number) {
    return this.licensesRepository.find({
      where: { agent_id: agentId },
      relations: { license_type: true },
      order: { start_date: 'DESC', id: 'DESC' },
    });
  }

  findOne(id: number) {
    return this.licensesRepository.findOne({
      where: { id },
      relations: { agent: true, license_type: true },
    });
  }

  async update(id: number, data: Partial<License>) {
    const existing = await this.findOne(id);
    if (!existing) return null;

    const startDate = (data.start_date as string) ?? existing.start_date;
    const endDate = (data.end_date as string) ?? existing.end_date;

    await this.licensesRepository.update(id, {
      ...data,
      days_count: computeDaysCount(startDate, endDate),
    });

    return this.findOne(id);
  }

  remove(id: number) {
    return this.licensesRepository.delete(id);
  }

  /** Excel de licencias, mismos filtros que findAll(). */
  async exportToExcel(filters?: LicenseFilters): Promise<Buffer> {
    const licenses = await this.findAll(filters);

    const rows = licenses.map((license) => ({
      Docente: license.agent?.full_name ?? '',
      DNI: license.agent?.dni ?? '',
      Artículo: license.license_type?.article ?? '',
      Descripción: license.license_type?.description ?? '',
      Desde: license.start_date,
      Hasta: license.end_date,
      Días: license.days_count,
      Observaciones: license.observations ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Licencias');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
