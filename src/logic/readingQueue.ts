/** Запис того, як дитина читала сама. Чекає, поки дорослий послухає й відмітить. */
export interface PendingReading {
  id: string;
  /** Склад, слово чи фраза - як у журналі читання. Велика буква («Л») - звук букви з вправи «Як звучить ця буква?». */
  text: string;
  /** Коли записано (ISO з часом). */
  at: string;
}

/** Більше записів не тримаємо: найстаріші, які дорослий так і не послухав, видаляємо. */
export const MAX_PENDING_READINGS = 60;

/** Найновіші зверху. */
export function newestFirst<T extends PendingReading>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

/** Які записи видалити, щоб їх залишилося не більше `max` (найстаріші). */
export function overflow(items: readonly PendingReading[], max = MAX_PENDING_READINGS): string[] {
  return newestFirst(items)
    .slice(max)
    .map((r) => r.id);
}
