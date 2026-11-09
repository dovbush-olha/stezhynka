import type { LetterId } from './alphabet';

export type { LetterId };

export type LetterCase = 'upper' | 'lower';

/** Знайомство з новою буквою: велика картка, звук, асоціація. */
export interface IntroLetterExercise {
  kind: 'intro-letter';
  letter: LetterId;
}

/** Знайди таку саму букву серед 2-3 варіантів (зоровий пошук). */
export interface FindLetterExercise {
  kind: 'find-letter';
  target: LetterId;
  options: LetterId[];
  letterCase?: LetterCase;
}

/** Дорослий вимовляє звук - дитина обирає букву. */
export interface LetterBySoundExercise {
  kind: 'letter-by-sound';
  target: LetterId;
  options: LetterId[];
  letterCase?: LetterCase;
}

/**
 * Бачиш букву - скажи її звук сама. Без варіантів на вибір: звук треба згадати, а не впізнати.
 * Саме так буква зустрічається в читанні, і саме це дається найважче.
 */
export interface SaySoundExercise {
  kind: 'say-sound';
  letter: LetterId;
  letterCase?: LetterCase;
}

/** З'єднай два звуки в склад (М + А = МА). */
export interface BlendExercise {
  kind: 'blend';
  sounds: [LetterId, LetterId];
}

/** Прочитай склад - дорослий відмічає, чи вдалося самостійно. */
export interface ReadSyllableExercise {
  kind: 'read-syllable';
  syllable: string;
}

/** Прочитай коротке слово. Картинка з'являється лише після читання. */
export interface ReadWordExercise {
  kind: 'read-word';
  /** Ключ слова з банку слів (words.ts). */
  word: string;
}

/** Дорослий каже слово - дитина складає його з відомих складів. */
export interface BuildWordExercise {
  kind: 'build-word';
  /** Ключ слова з банку слів (words.ts). */
  word: string;
  /** Зайві склади, які не входять у слово. */
  distractors: string[];
}

/** Знайди однакові склади: кожен склад з'являється на двох картках. */
export interface MatchSyllablesExercise {
  kind: 'match-syllables';
  syllables: string[];
}

/**
 * Дорослий читає склад, слово чи фразу (або звучить його запис) - дитина вибирає, що почула.
 * Перевіряє зв'язок «звучання → написане», без вимоги читати вголос.
 */
export interface PickByEarExercise {
  kind: 'pick-by-ear';
  /** Що звучить: склад, слово чи фраза (слова й фрази - з банку слів). */
  text: string;
  /** Написані варіанти, серед них і правильний. */
  options: string[];
}

/**
 * Прочитай і вибери картинку. Не пишеться в контенті вручну: так перетворюється
 * «прочитай слово», коли дитина грається сама і дорослий не може відмітити читання.
 */
export interface PickPictureExercise {
  kind: 'pick-picture';
  word: string;
  /** Ключі слів, чиї картинки показуємо як варіанти (разом із правильним). */
  options: string[];
}

export type Exercise =
  | IntroLetterExercise
  | PickPictureExercise
  | PickByEarExercise
  | FindLetterExercise
  | LetterBySoundExercise
  | SaySoundExercise
  | BlendExercise
  | ReadSyllableExercise
  | ReadWordExercise
  | BuildWordExercise
  | MatchSyllablesExercise;

export type ExerciseKind = Exercise['kind'];

export type MissionGoal = 'learn' | 'reinforce' | 'practice';

export interface Mission {
  id: string;
  day: number;
  /** Номер місії в дні, з 1. */
  order: number;
  title: string;
  goal: MissionGoal;
  /** Усі букви, які трапляються в місії. Місія відкривається, лише коли всі вони доступні дитині. */
  requires: LetterId[];
  /** Букви, з якими місія знайомить уперше (не повторюються в розминці). */
  newLetters?: LetterId[];
  /** Коротка порада для дорослого перед місією. */
  adultNote: string;
  /** Лісовий друг-наліпка за проходження. */
  sticker: string;
  exercises: Exercise[];
}

export interface Day {
  day: number;
  title: string;
  /** Що зображено на камінці мапи (буква або символ). */
  badge: string;
  /** Перша місія навчає, наступні закріплюють. */
  missions: [Mission, ...Mission[]];
}

export interface WordEntry {
  /** Слово або коротка фраза так, як пишеться (імена - з великої букви). */
  text: string;
  /** Поділ на склади: склади через дефіс, слова через пробіл. Наприклад «Ма-ма ми-ла». */
  split: string;
  /** Ілюстрація, яку показуємо лише ПІСЛЯ читання. */
  picture: string;
  /** Пояснення для дорослого (наприклад, для багатозначних слів). */
  note?: string;
  /** Картинка однозначно називає слово - можна складати слово за картинкою, коли дитина грається сама. */
  clear?: boolean;
  /**
   * `false` - картинку не впізнати, лише прочитавши текст («у Олі» 🎀, «мамі» 💝),
   * тому коли дитина грається сама, читання не перевіряємо вибором картинки.
   * Картинки-люди так позначати не треба - їх розпізнаємо самі.
   */
  pickable?: false;
}
