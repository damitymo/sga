import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { LicenseType } from '../licenses/entities/license-type.entity';

/**
 * Catálogo de tipos de licencia según el "Régimen de licencias, permisos y
 * justificación de inasistencias del personal docente" (Decreto 1482/79 y
 * modificatoria 1620/79, Anexo II del Estatuto del Docente - Ley 3.723 de
 * Corrientes). Los códigos de artículo replican la numeración real del
 * decreto (no la del Estatuto), que es la que usan los sistemas de gestión
 * existentes.
 *
 * `max_days_*` en null significa que el decreto no fija un tope de días
 * simple (depende de antigüedad, se resuelve caso por caso, o dura mientras
 * subsista la situación) — se deja sin evaluar en el panel de límites en
 * vez de inventar un número.
 *
 * Idempotente: si el artículo ya existe (por `article`), lo actualiza en
 * vez de duplicarlo.
 */
const LICENSE_TYPES: Array<Partial<LicenseType>> = [
  {
    article: 'Art. 4° B',
    description:
      'Licencia ordinaria anual (vacaciones). Días corridos según antigüedad: hasta 5 años = 20 días, hasta 10 = 25, hasta 15 = 30, más de 15 = 35. Personal Superior desde Supervisor: 45 días.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
  },
  {
    article: 'Art. 8° A',
    description:
      'Enfermedad — afecciones comunes, lesiones u operaciones menores que inhabiliten para el trabajo.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 30,
    max_days_continuous: 30,
  },
  {
    article: 'Art. 8° B',
    description:
      'Enfermedad de largo tratamiento — afecciones que por su naturaleza requieran asistencia médica prolongada. 2 años con goce íntegro + 1 año más al 50%.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 730,
  },
  {
    article: 'Art. 8° C',
    description:
      'Accidente de trabajo o enfermedad ocupacional contraída en acto de servicio. 2 años con goce íntegro + 1 año más al 50%.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 730,
  },
  {
    article: 'Art. 10° C',
    description:
      'Disponibilidad con goce de haberes tras agotar los plazos del Art. 8° y estar en trámite jubilatorio por invalidez (120 días con goce, prorrogable 180 días sin goce).',
    applicable_to: 'Titulares e Interinos',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 120,
  },
  {
    article: 'Art. 11°',
    description:
      'Cambio de funciones por pérdida o disminución de aptitudes psicofísicas, sin merma de retribución (requiere 10 años de antigüedad docente).',
    applicable_to: 'Titulares e Interinos',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 730,
  },
  {
    article: 'Art. 12°',
    description:
      'Atención de salud de un familiar del grupo conviviente. 20 días corridos con goce íntegro, prorrogable por otros 20 días sin goce.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 20,
    max_days_continuous: 20,
  },
  {
    article: 'Art. 13°',
    description:
      'Licencia por maternidad. 180 días corridos con goce íntegro de haberes (Ley 6.137/12), fraccionados en pre y post parto.',
    applicable_to: 'Personal femenino',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 180,
  },
  {
    article: 'Art. 13° bis',
    description:
      'Licencia por violencia de género (Decreto 1914/20). 15 días corridos por año, con goce íntegro, prorrogable por igual período.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 30,
    max_days_continuous: 15,
  },
  {
    article: 'Art. XX',
    description:
      'Licencia especial para exámenes de Colposcopía, Papanicolau y Mamografía (Ley 2.745/14). 1 día laboral por año, con goce; no afecta la remuneración ni el presentismo.',
    applicable_to: 'Personal femenino',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 1,
    max_days_per_month: 1,
    max_days_continuous: 1,
  },
  {
    article: 'Art. 15°',
    description:
      'Matrimonio. 15 días corridos con goce íntegro (Titulares/Interinos). El personal Suplente tiene derecho a 5 días.',
    applicable_to: 'Titulares e Interinos',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 15,
  },
  {
    article: 'Art. 16° A',
    description:
      'Duelo — fallecimiento de madre, padre, cónyuge, hijo, hermano, padrastro, madrastra, hermanastros o hijastros. 7 días corridos.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 7,
  },
  {
    article: 'Art. 16° B',
    description:
      'Duelo — fallecimiento de abuelos, nietos, bisabuelos, padres, hermanos e hijos políticos. 3 días corridos.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 3,
  },
  {
    article: 'Art. 16° C',
    description:
      'Duelo — fallecimiento de tíos, sobrinos, primos carnales o políticos. 1 día (el del fallecimiento o el del sepelio).',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 1,
  },
  {
    article: 'Art. 17°',
    description:
      'Para desempeñar cargos de representación política (Ejecutivo/Legislativo Nacional, Provincial o Municipal). Sin goce de haberes, mientras dure el mandato.',
    applicable_to: 'Todos los docentes',
    paid: false,
    affects_presentismo: false,
  },
  {
    article: 'Art. 17° bis',
    description:
      'Candidatura a cargos de Junta de Clasificación o Disciplina. 30 días corridos inmediatos anteriores al acto eleccionario.',
    applicable_to: 'Titulares',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 30,
  },
  {
    article: 'Art. 18°',
    description:
      'Para desempeñar cargos de representación gremial en asociaciones con personería gremial. Sin goce de haberes, mientras dure el mandato.',
    applicable_to: 'Todos los docentes',
    paid: false,
    affects_presentismo: false,
  },
  {
    article: 'Art. 19° A',
    description:
      'Por estudio — preparación de exámenes en carreras de Nivel Superior (universitarias/terciarias). 12 días hábiles por año, en fracciones de hasta 3 días hábiles por vez.',
    applicable_to: 'Titulares e Interinos',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 12,
    max_days_continuous: 3,
  },
  {
    article: 'Art. 19° B',
    description:
      'Para exámenes de Enseñanza Media. 8 días hábiles por año, en fracciones de hasta 2 días hábiles continuos.',
    applicable_to: 'Titulares e Interinos',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 8,
    max_days_continuous: 2,
  },
  {
    article: 'Art. 20°',
    description:
      'Para estudios o investigaciones científicas, técnicas o culturales de interés provincial/nacional. Con goce íntegro, plazo a determinar en cada caso. Solo personal titular.',
    applicable_to: 'Titulares',
    paid: true,
    affects_presentismo: false,
  },
  {
    article: 'Art. 21°',
    description:
      'Por perfeccionamiento docente, especialización o becas. Con goce de haberes hasta 1 año, prorrogable por 1 año más; un tercer año se otorga sin goce.',
    applicable_to: 'Titulares',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 365,
  },
  {
    article: 'Art. 22°',
    description:
      'Por razones particulares, sin goce de haberes. 1 año cada decenio de servicios, fraccionable en 2 períodos de 6 meses mínimo; mínimo 10 días por vez.',
    applicable_to: 'Todos los docentes',
    paid: false,
    affects_presentismo: false,
    max_days_per_year: 365,
    max_days_continuous: 365,
  },
  {
    article: 'Art. 27°',
    description:
      'Licencia especial para situaciones no previstas en este régimen, por salud del agente o de un familiar a cargo. Resuelve el Gobernador. Con o sin goce, hasta 6 meses, prorrogable por 6 meses más.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 365,
  },
  {
    article: 'Art. 28°',
    description:
      'Para desempeñar cargos de mayor jerarquía o superior nivel, con carácter interino o suplente. Con o sin goce según corresponda, por el tiempo que dure la situación.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
  },
  {
    article: 'Art. 29°',
    description:
      'Por actividades deportivas — integrar delegaciones representativas de la Provincia o la Nación. Con goce íntegro, desde el comienzo hasta el final del evento.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
  },
  {
    article: 'Art. 30° A',
    description:
      'Justificación por nacimiento de hijo (agente varón). 5 días hábiles con goce (Ley 6.137/12, Art. 5°, que modifica el día hábil único del régimen original).',
    applicable_to: 'Personal masculino',
    paid: true,
    affects_presentismo: false,
    max_days_continuous: 5,
  },
  {
    article: 'Art. 30° B',
    description:
      'Justificación por razones particulares atendibles a juicio de la autoridad competente. Hasta 6 días por año calendario y no más de 2 por mes.',
    applicable_to: 'Todos los docentes',
    paid: true,
    affects_presentismo: false,
    max_days_per_year: 6,
    max_days_per_month: 2,
  },
];

async function main() {
  await AppDataSource.initialize();
  console.log('DB conectada.');

  const repo = AppDataSource.getRepository(LicenseType);
  let created = 0;
  let updated = 0;

  for (const data of LICENSE_TYPES) {
    const existing = await repo.findOne({ where: { article: data.article } });

    if (existing) {
      await repo.update(existing.id, data);
      updated += 1;
      console.log(`Actualizado: ${data.article}`);
    } else {
      const licenseType = repo.create(data);
      await repo.save(licenseType);
      created += 1;
      console.log(`Creado: ${data.article}`);
    }
  }

  console.log(`\nListo. Creados: ${created}, actualizados: ${updated}.`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Falló el seed de tipos de licencia:', err);
  process.exit(1);
});
