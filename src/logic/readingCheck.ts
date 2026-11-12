import type { Settings } from './progress';

/**
 * Хто перевіряє читання вголос (склад, слово чи фразу без однозначної картинки, «Як звучить ця буква?»):
 * - `recording` - читання записується, дорослий послухає й відмітить потім у розділі «Для дорослих»;
 * - `adult` - дорослий сидить поруч і відмічає одразу.
 * Автоматичної оцінки вимови немає, тож читання завжди перевіряє дорослий - одразу або за записом.
 */
export type ReadingCheck = 'recording' | 'adult';

/**
 * Чи надовго відмовив мікрофон. Заборонений доступ чи відсутній мікрофон сам не з'явиться - далі відмічає
 * дорослий. Якщо ж мікрофон лише зайнятий іншою програмою чи запис обірвався, наступна вправа спробує знову.
 */
export function isLastingMicFailure(error: unknown): boolean {
  const passing = ['NotReadableError', 'AbortError'];
  return !(error instanceof DOMException && passing.includes(error.name));
}

/**
 * Записуємо лише тоді, коли дорослий цього хоче і мікрофон справді працює.
 * Без мікрофона (заборонений, його немає, немає https) запис нічого не дасть - тоді відмічає дорослий поруч.
 */
export function readingCheck(settings: Pick<Settings, 'recordReading'>, micAvailable: boolean): ReadingCheck {
  return settings.recordReading && micAvailable ? 'recording' : 'adult';
}
