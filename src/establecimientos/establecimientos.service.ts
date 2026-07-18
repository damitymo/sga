import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Establecimiento } from './entities/establecimiento.entity';

@Injectable()
export class EstablecimientosService {
  constructor(
    @InjectRepository(Establecimiento)
    private readonly establecimientosRepository: Repository<Establecimiento>,
  ) {}

  create(data: Partial<Establecimiento>) {
    const establecimiento = this.establecimientosRepository.create(data);
    return this.establecimientosRepository.save(establecimiento);
  }

  findAll() {
    return this.establecimientosRepository.find({
      where: { is_active: true },
      order: { nombre: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.establecimientosRepository.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Establecimiento>) {
    await this.establecimientosRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const establecimiento = await this.findOne(id);
    if (!establecimiento) return null;

    establecimiento.is_active = false;
    return this.establecimientosRepository.save(establecimiento);
  }
}
