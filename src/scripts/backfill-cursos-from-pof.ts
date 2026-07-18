import 'reflect-metadata';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Establecimiento } from '../establecimientos/entities/establecimiento.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { PofPosition } from '../pof/entities/pof-position.entity';

/**
 * Backfill del Organigrama a partir de la data ya importada del MEC en
 * `pof_positions` (`establecimiento_cue`, `course`, `division`). No toca
 * esos campos — solo crea `establecimientos`/`cursos` y completa
 * `pof_positions.curso_id`. Idempotente: se puede correr de nuevo sin
 * duplicar nada.
 */
const NOMBRE_POR_CUE: Record<string, string> = {
  '1800697-00': 'Sede Central',
  '1800697-03': 'Extensión Áulica',
};

async function main() {
  await AppDataSource.initialize();
  console.log('DB conectada.');

  const establecimientosRepo = AppDataSource.getRepository(Establecimiento);
  const cursosRepo = AppDataSource.getRepository(Curso);
  const pofRepo = AppDataSource.getRepository(PofPosition);

  // 1. Establecimientos a partir de los CUEs distintos en pof_positions.
  const cuesRows: Array<{ establecimiento_cue: string }> = await pofRepo
    .createQueryBuilder('pof')
    .select('DISTINCT pof.establecimiento_cue', 'establecimiento_cue')
    .where('pof.is_active = true')
    .andWhere('pof.establecimiento_cue IS NOT NULL')
    .getRawMany();

  const establecimientoByCue = new Map<string, Establecimiento>();

  for (const { establecimiento_cue: cue } of cuesRows) {
    let establecimiento = await establecimientosRepo.findOne({
      where: { cue },
    });

    if (!establecimiento) {
      establecimiento = establecimientosRepo.create({
        cue,
        nombre: NOMBRE_POR_CUE[cue] ?? `Establecimiento ${cue}`,
      });
      establecimiento = await establecimientosRepo.save(establecimiento);
      console.log(`Establecimiento creado: ${establecimiento.nombre} (${cue})`);
    }

    establecimientoByCue.set(cue, establecimiento);
  }

  // 2. Cursos a partir de las combinaciones distintas (cue, course, division)
  //    con course no vacío.
  const combos: Array<{
    establecimiento_cue: string;
    course: string;
    division: string | null;
  }> = await pofRepo
    .createQueryBuilder('pof')
    .select('pof.establecimiento_cue', 'establecimiento_cue')
    .addSelect('pof.course', 'course')
    .addSelect('pof.division', 'division')
    .where('pof.is_active = true')
    .andWhere('pof.course IS NOT NULL')
    .andWhere("pof.course != ''")
    .groupBy('pof.establecimiento_cue')
    .addGroupBy('pof.course')
    .addGroupBy('pof.division')
    .getRawMany();

  let cursosCreados = 0;
  let filasActualizadas = 0;

  for (const combo of combos) {
    const establecimiento = establecimientoByCue.get(combo.establecimiento_cue);
    if (!establecimiento) continue;

    let curso = await cursosRepo.findOne({
      where: {
        establecimiento_id: establecimiento.id,
        nivel: 'Secundaria',
        anio: combo.course,
        division: combo.division === null ? IsNull() : combo.division,
      },
    });

    if (!curso) {
      curso = cursosRepo.create({
        nivel: 'Secundaria',
        anio: combo.course,
        division: combo.division,
        establecimiento_id: establecimiento.id,
      });
      curso = await cursosRepo.save(curso);
      cursosCreados += 1;
    }

    // 3. Backfill de curso_id en las plazas que matchean esta combinación.
    const updateResult = await pofRepo
      .createQueryBuilder()
      .update(PofPosition)
      .set({ curso_id: curso.id })
      .where('is_active = true')
      .andWhere('establecimiento_cue = :cue', { cue: combo.establecimiento_cue })
      .andWhere('course = :course', { course: combo.course })
      .andWhere(
        combo.division === null ? 'division IS NULL' : 'division = :division',
        combo.division === null ? {} : { division: combo.division },
      )
      .execute();

    filasActualizadas += updateResult.affected ?? 0;
  }

  const sinCurso = await pofRepo.count({
    where: { is_active: true, curso_id: IsNull() },
  });

  console.log(`\nEstablecimientos: ${establecimientoByCue.size}`);
  console.log(`Cursos creados: ${cursosCreados}`);
  console.log(`Filas de pof_positions actualizadas con curso_id: ${filasActualizadas}`);
  console.log(`Filas activas sin curso (cargos sin curso propio): ${sinCurso}`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Falló el backfill de cursos:', err);
  process.exit(1);
});
