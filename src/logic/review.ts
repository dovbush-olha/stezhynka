import { isReadableWith, toLower, type LetterId } from '../content/alphabet';
import type { Exercise } from '../content/types';
import { WORDS } from '../content/words';
import { isDue, type ReviewItem } from './srs';

/**
 * Склад, слово чи фраза, які дитина вже читала або складала.
 * Ключ - текст так, як у контенті («Лола», «ма»): за ним же будуємо вправи.
 */
export interface ItemOutcome {
  text: string;
  firstTry: boolean;
}

/**
 * Що саме тренувала вправа - для інтервального повторення складів і слів.
 * «Знайди пару» не враховуємо: там кілька складів, і неясно, котрий дався важко.
 */
export function practisedItems(ex: Exercise, hinted: boolean): ItemOutcome[] {
  const firstTry = !hinted;
  switch (ex.kind) {
    case 'read-syllable':
      return [{ text: ex.syllable, firstTry }];
    case 'blend':
      return [{ text: toLower(ex.sounds.join('')), firstTry }];
    case 'read-word':
    case 'pick-picture':
    case 'build-word':
      return [{ text: ex.word, firstTry }];
    case 'pick-by-ear':
      return [{ text: ex.text, firstTry }];
    default:
      return [];
  }
}

/** Слово чи фраза з банку слів; решта - склади. */
export function isWordItem(text: string): boolean {
  return Boolean(WORDS[text]);
}

/** Тексти, які вже є у вправах місії: їх у розминці не повторюємо. */
export function textsOf(exercises: readonly Exercise[]): Set<string> {
  const texts = exercises.flatMap((ex): string[] => {
    switch (ex.kind) {
      case 'read-syllable':
        return [ex.syllable];
      case 'blend':
        return [ex.sounds.join('')];
      case 'read-word':
      case 'pick-picture':
      case 'build-word':
        return [ex.word];
      case 'pick-by-ear':
        return [...ex.options];
      case 'match-syllables':
        return [...ex.syllables];
      default:
        return [];
    }
  });
  return new Set(texts.map(toLower));
}

/** Букви, які вправи шукають чи просять назвати звуком. */
export function letterTargets(exercises: readonly Exercise[]): LetterId[] {
  return exercises.flatMap((e) =>
    e.kind === 'find-letter' || e.kind === 'letter-by-sound' ? [e.target] : e.kind === 'say-sound' ? [e.letter] : [],
  );
}

/**
 * Склади й слова, яким час повторення: спершу ті, що в нижчій коробці (даються важче),
 * потім ті, що чекають довше. Лише ті, що читаються доступними буквами.
 */
export function dueItems(
  review: Readonly<Record<string, ReviewItem>>,
  today: string,
  letters: readonly LetterId[],
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  return Object.entries(review)
    .filter(([text, item]) => isDue(item, today) && !exclude.has(toLower(text)) && isReadableWith(text, letters))
    .sort(([, a], [, b]) => a.box - b.box || a.due.localeCompare(b.due))
    .map(([text]) => text);
}
