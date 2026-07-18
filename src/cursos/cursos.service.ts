import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Curso } from './entities/curso.entity';

type CursoFilters = {
  establecimientoId?: number;
};

@Injectable()
export class CursosService {
  constructor(
    @InjectRepository(Curso)
    private readonly cursosRepository: Repository<Curso>,
  ) {}

  create(data: Partial<Curso>) {
    const curso = this.cursosRepository.create(data);
    return this.cursosRepository.save(curso);
  }

  findAll(filters?: CursoFilters) {
    const where: Record<string, unknown> = { is_active: true };

    if (filters?.establecimientoId) {
      where.establecimiento_id = filters.establecimientoId;
    }

    return this.cursosRepository.find({
      where,
      relations: { establecimiento: true, orientacion: true },
      order: { nivel: 'ASC', anio: 'ASC', division: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.cursosRepository.findOne({
      where: { id },
      relations: { establecimiento: true, orientacion: true },
    });
  }

  async update(id: number, data: Partial<Curso>) {
    await this.cursosRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const curso = await this.cursosRepository.findOne({ where: { id } });
    if (!curso) return null;

    curso.is_active = false;
    return this.cursosRepository.save(curso);
  }
}
