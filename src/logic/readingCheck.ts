import type { Settings } from './progress';

/**
 * Хто перевіряє читання вголос (склад, слово чи фразу без однозначної картинки, «Як звучить ця буква?»):
 * - `recording` - читання записується, дорослий послухає й відмітить потім у розділі «Для дорослих»;
 * - `adult` - дорослий сидить поруч і відмічає одразу.
 * Автоматичної оцінки вимови немає, тож читання завжди перевіряє дорослий - одразу або за записом.
 */
export type ReadingCheck = 'recording' | 'adult';

/**
 * Записуємо лише тоді, коли дорослий цього хоче і мікрофон справді працює.
 * Без мікрофона (заборонений, зайнятий, немає https) запис нічого не дасть - тоді відмічає дорослий поруч.
 */
export function readingCheck(settings: Pick<Settings, 'recordReading'>, micAvailable: boolean): ReadingCheck {
  return settings.recordReading && micAvailable ? 'recording' : 'adult';
}
