import type { LetterId } from '../content/alphabet';
import type { Exercise, WordEntry } from '../content/types';
import { ALL_WORDS, WORDS, getWord, isPhrase } from '../content/words';
import { shuffle, type Rng } from './generate';
import { compareCloseness, closeness, editDistance } from './similar';

/** Картинки-люди схожі між собою - як зайві варіанти не годяться. */
const PEOPLE = /[👩👧👨👶🧒🙋👫👱]/u;

/**
 * Є запис голосу дорослого для букви - шукаємо її на слух, а не за зразком.
 * Звук → буква важливіший зв'язок для читання, ніж зорове порівняння.
 */
export function preferRecordedVoice(ex: Exercise, hasSound: (l: LetterId) => boolean): Exercise {
  if (ex.kind === 'find-letter' && hasSound(ex.target)) {
    return { kind: 'letter-by-sound', target: ex.target, options: ex.options, letterCase: ex.letterCase };
  }
  return ex;
}

/**
 * Вправу дитина виконує сама: там, де дорослий мав би вимовити звук чи слово або перевірити читання,
 * перетворюємо її так, щоб вона звучала записом і перевірялася без вимови.
 * Діє завжди, незалежно від налаштувань. Те, що лишається читанням уголос (склад, слово без
 * однозначної картинки), перевіряє дорослий: за записом або одразу - див. `readingCheck`.
 * Контент місій при цьому не змінюється.
 */
export function adaptForSolo(
  ex: Exercise,
  hasSound: (l: LetterId) => boolean,
  rng: Rng,
  /** Чи записав дорослий, як читається це слово чи фраза. */
  hasSay: (text: string) => boolean = () => false,
): Exercise {
  switch (ex.kind) {
    case 'letter-by-sound':
      // Без запису голосу звук ніхто не вимовить - шукаємо букву за зразком.
      return hasSound(ex.target) ? ex : { kind: 'find-letter', target: ex.target, options: ex.options, letterCase: ex.letterCase };
    case 'read-word':
      // Якщо картинку не впізнати за текстом, лишаємо «прочитай уголос»: його перевірить дорослий.
      return toPickPicture(ex.word, rng) ?? ex;
    case 'build-word': {
      // Складати можна, коли слово звучить голосом дорослого або картинка однозначна;
      // інакше - читаємо й обираємо картинку.
      if (hasSay(ex.word) || getWord(ex.word).clear) return ex;
      return toPickPicture(ex.word, rng) ?? { kind: 'read-word', word: ex.word };
    }
    case 'pick-by-ear': {
      // Без запису вголос ніхто не прочитає - тоді дитина читає сама.
      if (hasSay(ex.text)) return ex;
      if (!WORDS[ex.text]) return { kind: 'read-syllable', syllable: ex.text };
      return toPickPicture(ex.text, rng) ?? { kind: 'read-word', word: ex.text };
    }
    default:
      return ex;
  }
}

/**
 * Чи доводить вибір картинки, що слово прочитане.
 * Ні, якщо на картинці людина: зайві варіанти без людей, тож її вибирають, не читаючи
 * («Алла» 👩 серед 🧼 і 🦙). І ні, якщо картинку за текстом не впізнати («у Олі» 🎀).
 */
export function canPickPicture(entry: WordEntry): boolean {
  return entry.pickable !== false && !PEOPLE.test(entry.picture);
}

/**
 * Зайві картинки називають слова, схожі на правильне (СОМ: 🐟, а поруч 🧃 сік і 🦉 сова),
 * щоб відповідь не можна було вгадати за першою буквою - треба дочитати слово.
 * Дитина бачить лише картинки зайвих слів, тож їхні букви можуть бути ще не вивчені,
 * але картинки мусять бути однозначними.
 */
function toPickPicture(word: string, rng: Rng): Exercise | undefined {
  const target = getWord(word);
  if (!canPickPicture(target)) return undefined;
  // У фразі картинка показує зміст, тож слово з самої фрази як зайвий варіант - пастка:
  // «Мама мила» 🧽 поруч із 🧼 мило збиває того, хто прочитав правильно.
  const phraseWords = isPhrase(target) ? word.toLowerCase().split(' ') : [];
  const pool = ALL_WORDS.filter(
    (w) =>
      w.text !== word &&
      w.clear &&
      !isPhrase(w) &&
      w.picture !== target.picture &&
      !PEOPLE.test(w.picture) &&
      !phraseWords.some((p) => editDistance(p, w.text.toLowerCase()) <= 1),
  );
  // Перемішування перед стабільним сортуванням: рівно схожі слова щоразу обираються по-різному.
  const ranked = shuffle(pool, rng)
    .map((w) => ({ w, key: closeness(word, w.text) }))
    .sort((p, q) => compareCloseness(p.key, q.key))
    .map((p) => p.w);
  const seen = new Set<string>([target.picture]);
  const distractors: string[] = [];
  for (const w of ranked) {
    if (seen.has(w.picture)) continue;
    seen.add(w.picture);
    distractors.push(w.text);
    if (distractors.length === 2) break;
  }
  if (distractors.length < 2) return undefined;
  return { kind: 'pick-picture', word, options: shuffle([word, ...distractors], rng) };
}
