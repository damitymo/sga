import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Orientacion } from './entities/orientacion.entity';
import { Curso } from '../cursos/entities/curso.entity';

export type OrientacionWithCount = Orientacion & { cursos_count: number };

@Injectable()
export class OrientacionesService {
  constructor(
    @InjectRepository(Orientacion)
    private readonly orientacionesRepository: Repository<Orientacion>,

    @InjectRepository(Curso)
    private readonly cursosRepository: Repository<Curso>,
  ) {}

  create(data: Partial<Orientacion>) {
    const orientacion = this.orientacionesRepository.create(data);
    return this.orientacionesRepository.save(orientacion);
  }

  async findAll(): Promise<OrientacionWithCount[]> {
    const orientaciones = await this.orientacionesRepository.find({
      where: { is_active: true },
      order: { nombre: 'ASC' },
    });

    const counts = await this.cursosRepository
      .createQueryBuilder('curso')
      .select('curso.orientacion_id', 'orientacion_id')
      .addSelect('COUNT(*)', 'count')
      .where('curso.is_active = true')
      .groupBy('curso.orientacion_id')
      .getRawMany<{ orientacion_id: number; count: string }>();

    const countByOrientacion = new Map(
      counts.map((row) => [row.orientacion_id, Number(row.count)]),
    );

    return orientaciones.map((orientacion) => ({
      ...orientacion,
      cursos_count: countByOrientacion.get(orientacion.id) ?? 0,
    }));
  }

  findOne(id: number) {
    return this.orientacionesRepository.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Orientacion>) {
    await this.orientacionesRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const orientacion = await this.findOne(id);
    if (!orientacion) return null;

    orientacion.is_active = false;
    return this.orientacionesRepository.save(orientacion);
  }
}
