/**
 * Helpers de calendario para el cálculo de la grilla anual en el backend.
 * Mantiene en sincronía feriados y recesos con frontend/src/lib/calendar-utils.ts.
 *
 * Cuando se sumen años nuevos hay que actualizar ambos archivos.
 */

export type DayKind =
  | 'saturday'
  | 'sunday'
  | 'holiday'
  | 'break'
  | 'school'
  | 'nonexistent';

const HOLIDAYS_BY_YEAR: Record<number, Record<string, string>> = {
  2025: {
    '2025-01-01': 'Año Nuevo',
    '2025-03-03': 'Carnaval (lunes)',
    '2025-03-04': 'Carnaval (martes)',
    '2025-03-24': 'Día de la Memoria',
    '2025-04-02': 'Malvinas',
    '2025-04-18': 'Viernes Santo',
    '2025-05-01': 'Día del Trabajador',
    '2025-05-02': 'Puente turístico',
    '2025-05-25': 'Revolución de Mayo',
    '2025-06-16': 'Güemes (trasladado)',
    '2025-06-20': 'Día de la Bandera',
    '2025-07-09': 'Independencia',
    '2025-08-17': 'San Martín',
    '2025-10-12': 'Día del Respeto a la Diversidad Cultural',
    '2025-11-24': 'Soberanía Nacional (trasladado)',
    '2025-12-08': 'Inmaculada Concepción',
    '2025-12-25': 'Navidad',
  },
  2026: {
    '2026-01-01': 'Año Nuevo',
    '2026-02-16': 'Carnaval (lunes)',
    '2026-02-17': 'Carnaval (martes)',
    '2026-03-24': 'Día de la Memoria',
    '2026-04-02': 'Malvinas',
    '2026-04-03': 'Viernes Santo',
    '2026-05-01': 'Día del Trabajador',
    '2026-05-25': 'Revolución de Mayo',
    '2026-06-15': 'Güemes (trasladado)',
    '2026-06-20': 'Día de la Bandera',
    '2026-07-09': 'Independencia',
    '2026-08-17': 'San Martín',
    '2026-10-12': 'Día del Respeto a la Diversidad Cultural',
    '2026-11-23': 'Soberanía Nacional (trasladado)',
    '2026-12-08': 'Inmaculada Concepción',
    '2026-12-25': 'Navidad',
  },
};

const SCHOOL_BREAKS: Record<
  number,
  Array<{ start: string; end: string; label: string }>
> = {
  2025: [
    { start: '2025-01-01', end: '2025-02-10', label: 'Receso verano' },
    { start: '2025-07-14', end: '2025-07-25', label: 'Receso invierno' },
  ],
  2026: [
    { start: '2026-01-01', end: '2026-02-10', label: 'Receso verano' },
    { start: '2026-07-13', end: '2026-07-24', label: 'Receso invierno' },
  ],
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado (formato JS estándar).
 */
export function getWeekday(
  year: number,
  month: number,
  day: number,
): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(year, month - 1, day).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function classifyDay(
  year: number,
  month: number,
  day: number,
): DayKind {
  if (day > daysInMonth(year, month)) return 'nonexistent';

  const iso = toIso(year, month, day);

  const breaks = SCHOOL_BREAKS[year] ?? [];
  for (const b of breaks) {
    if (iso >= b.start && iso <= b.end) return 'break';
  }

  if (HOLIDAYS_BY_YEAR[year]?.[iso]) return 'holiday';

  const wd = getWeekday(year, month, day);
  if (wd === 6) return 'saturday';
  if (wd === 0) return 'sunday';

  return 'school';
}
