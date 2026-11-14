import { BASE_LETTERS, LETTERS, LOOKALIKES, isReadableWith, lettersOf, toLower, type LetterId } from '../content/alphabet';
import type { Exercise, LetterCase, Mission } from '../content/types';
import { ALL_WORDS, getWord, isPhrase, syllablesOf } from '../content/words';
import { COURSE_MISSIONS } from '../content/course';
import { PRACTICE_ID, isConfident, isKnownByAdult, nextMission, type LetterStatus, type ProgressState } from './progress';
import { dueItems, isWordItem, textsOf } from './review';
import { compareCloseness, closeness } from './similar';
import { isDue } from './srs';

export type Rng = () => number;

/** Детермінований генератор випадкових чисел (mulberry32), щоб місія не перемішувалася під час перемальовування. */
export function makeRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Перемішує варіанти відповідей, щоб правильна не стояла завжди першою. */
export function prepareExercise(ex: Exercise, rng: Rng): Exercise {
  switch (ex.kind) {
    case 'find-letter':
    case 'letter-by-sound':
      return { ...ex, options: shuffle(ex.options, rng) };
    case 'match-syllables':
      return { ...ex, syllables: shuffle(ex.syllables, rng) };
    case 'build-word':
      return { ...ex, distractors: shuffle(ex.distractors, rng) };
    case 'pick-by-ear':
      return { ...ex, options: shuffle(ex.options, rng) };
    default:
      return ex;
  }
}

/**
 * Чи знайома дитині буква: вже бачила її у вправах, базова (знайома зі школи)
 * або дорослий сам позначив, що дитина її знає, - тоді знайомити з нею наново не треба.
 */
function isIntroduced(state: ProgressState, l: LetterId): boolean {
  return BASE_LETTERS.includes(l) || (state.letters[l]?.seen ?? 0) > 0 || isKnownByAdult(state, l);
}

function introducedLetters(state: ProgressState): LetterId[] {
  return state.unlocked.filter((l) => isIntroduced(state, l));
}

/** Що нижча вага, то раніше буква в черзі повторення; впевнено знайомі - в самому кінці. */
const STATUS_WEIGHT: Record<LetterStatus, number> = { learning: 0, sometimes: 1, knows: 2, confident: 3 };

/** Букви, яким час повторення, від найважчих. */
export function dueLetters(state: ProgressState, today: string, exclude: LetterId[] = []): LetterId[] {
  return introducedLetters(state)
    .filter((l) => LETTERS[l].kind !== 'sign' && !exclude.includes(l))
    .filter((l) => {
      const lp = state.letters[l];
      return !lp || isDue(lp, today);
    })
    .sort((a, b) => {
      const la = state.letters[a];
      const lb = state.letters[b];
      const sa = STATUS_WEIGHT[la?.status ?? 'learning'];
      const sb = STATUS_WEIGHT[lb?.status ?? 'learning'];
      return sa - sb || (la?.box ?? 1) - (lb?.box ?? 1);
    });
}

type LetterVariant = 'find-letter' | 'letter-by-sound' | 'say-sound';

function letterExercise(target: LetterId, pool: LetterId[], rng: Rng, variant: LetterVariant, letterCase?: LetterCase): Exercise {
  if (variant === 'say-sound') return { kind: 'say-sound', letter: target, letterCase };
  return { kind: variant, target, options: shuffle([target, ...letterDistractors(target, pool, rng)], rng), letterCase };
}

/**
 * Два зайві варіанти: спершу найсхожіша на вигляд буква з доступних (Л поруч з М),
 * далі будь-яка. Інакше букву знаходять як «єдину не таку», нічого про неї не знаючи.
 */
export function letterDistractors(target: LetterId, pool: readonly LetterId[], rng: Rng): LetterId[] {
  const candidates = pool.filter((l) => l !== target && LETTERS[l].kind !== 'sign');
  const lookalike = (LOOKALIKES[target] ?? []).find((l) => candidates.includes(l));
  const rest = shuffle(
    candidates.filter((l) => l !== lookalike),
    rng,
  );
  return [...(lookalike ? [lookalike] : []), ...rest].slice(0, 2);
}

/**
 * Згадати звук, побачивши букву, - те, що потрібно для читання, і найважче.
 * Тому повторення букви здебільшого саме таке, а впізнавання серед схожих - навперемін.
 */
function reviewVariant(rng: Rng): LetterVariant {
  const r = rng();
  return r < 0.6 ? 'say-sound' : r < 0.8 ? 'letter-by-sound' : 'find-letter';
}

/**
 * Розминка - не більше двох вправ, і разом з місією не більше дванадцяти, щоб місія не втомлювала.
 * Хоча б одна вправа розминки є завжди: так не забуваються вже вивчені букви.
 */
export const MAX_WARM_UP = 2;
export const MAX_WITH_WARM_UP = 12;

/**
 * Розминка перед місією: буква, якій настав час повторення, і склади та слова з минулих місій,
 * що чекають повторення за інтервалами (спершу ті, що давалися важче).
 * Використовує лише букви, доступні в цій місії, і не бере нових букв місії.
 */
export function warmUp(state: ProgressState, mission: Mission, today: string, rng: Rng): Exercise[] {
  const limit = Math.max(1, Math.min(MAX_WARM_UP, MAX_WITH_WARM_UP - mission.exercises.length));
  const alreadyPractised = new Set<LetterId>(
    mission.exercises.flatMap((e) =>
      e.kind === 'find-letter' || e.kind === 'letter-by-sound' ? [e.target] : e.kind === 'say-sound' ? [e.letter] : [],
    ),
  );
  const pool = mission.requires.filter((l) => state.unlocked.includes(l));
  // Нову букву місії до знайомства з нею не показуємо навіть як зайвий варіант.
  const known = pool.filter((l) => !(mission.newLetters ?? []).includes(l));
  const out: Exercise[] = [];
  // Впевнено знайому букву дорослий позначив саме для того, щоб на неї більше не витрачати час.
  const letter = dueLetters(state, today, [...(mission.newLetters ?? []), ...alreadyPractised]).find(
    (l) => known.includes(l) && !isConfident(state, l),
  );
  if (letter) out.push(letterExercise(letter, known, rng, reviewVariant(rng)));

  for (const text of dueItems(state.review, today, known, textsOf(mission.exercises))) {
    if (out.length >= limit) break;
    const ex = reviewExercise(text, known, rng);
    if (ex) out.push(ex);
  }
  return out;
}

/**
 * Вправа на повторення складу чи слова. Навперемін: прочитати саму або знайти на слух,
 * щоб повторення не було одноманітним.
 */
export function reviewExercise(text: string, letters: readonly LetterId[], rng: Rng): Exercise | undefined {
  if (!isReadableWith(text, letters)) return undefined;
  const byEar = rng() < 0.5;
  if (!isWordItem(text)) {
    if (!lettersOf(text).some((l) => LETTERS[l].kind === 'vowel')) return undefined;
    const pool = [...availableSyllables(letters), ...closedSyllables(letters)];
    return (byEar && earExercise(text, pool, rng)) || { kind: 'read-syllable', syllable: text };
  }
  const phrase = isPhrase(getWord(text));
  const pool = ALL_WORDS.filter((w) => isPhrase(w) === phrase && isReadableWith(w.text, letters)).map((w) => w.text);
  return (byEar && earExercise(text, pool, rng)) || { kind: 'read-word', word: text };
}

/** Усі відкриті склади «приголосний + голосний» із доступних букв. */
export function availableSyllables(letters: readonly LetterId[]): string[] {
  const vowels = letters.filter((l) => LETTERS[l].kind === 'vowel');
  const consonants = letters.filter((l) => LETTERS[l].kind === 'consonant' && l !== 'Й');
  return consonants.flatMap((c) => vowels.map((v) => toLower(c + v)));
}

/** Усі зворотні склади «голосний + приголосний» із доступних букв: «ан», «ок», «ай». */
export function closedSyllables(letters: readonly LetterId[]): string[] {
  const vowels = letters.filter((l) => LETTERS[l].kind === 'vowel');
  const consonants = letters.filter((l) => LETTERS[l].kind === 'consonant');
  return vowels.flatMap((v) => consonants.map((c) => toLower(v + c)));
}

/**
 * «Послухай і вибери» з двома зайвими варіантами, найсхожішими на правильний:
 * «ма» поруч із «мо» і «ам», «сом» поруч із «сон» - щоб треба було вслухатися, а не вгадувати.
 */
export function earExercise(text: string, pool: readonly string[], rng: Rng): Exercise | undefined {
  const target = toLower(text);
  const distractors = shuffle(
    pool.filter((p) => toLower(p) !== target),
    rng,
  )
    .map((p) => ({ p, key: closeness(target, toLower(p)) }))
    .sort((a, b) => compareCloseness(a.key, b.key))
    .slice(0, 2)
    .map((x) => x.p);
  if (distractors.length < 2) return undefined;
  return { kind: 'pick-by-ear', text, options: [text, ...distractors] };
}

function readingScore(state: ProgressState, text: string): number {
  const log = state.reading[text];
  if (!log) return -1;
  const total = log.alone + log.helped;
  return total ? log.alone / total + total * 0.05 : -1;
}

const PRACTICE_STICKERS = ['🍄', '🌸', '🍁', '🌰', '🐌', '🐢', '🐦', '🦆', '🐻', '🐺', '🦡', '🌻'];

/** Менше вправ - це вже не прогулянка лісом: добираємо буквами. */
const MIN_PRACTICE = 6;
/** Далекий кінець черги для текстів, яким ще не час повторення. */
const NOT_DUE = 1e6;

/**
 * «Повторення в лісі» - місія, яку щоразу складаємо з того, що дитині вже доступно:
 * букви, яким час повторення, склади й слова, яким час повторення або що читаються найважче,
 * і слова та фрази з банку слів.
 * Нову букву наступної місії не чіпаємо: з нею знайомить сама місія.
 */
export function buildPracticeMission(state: ProgressState, today: string, rng: Rng, missions: Mission[] = COURSE_MISSIONS): Mission {
  const next = nextMission(state, missions);
  const held = (next?.newLetters ?? []).filter((l) => (state.letters[l]?.seen ?? 0) === 0);
  const letters = state.unlocked.filter((l) => !held.includes(l));
  const exercises: Exercise[] = [];

  const fresh = letters.find((l) => !isIntroduced(state, l));
  if (fresh) exercises.push({ kind: 'intro-letter', letter: fresh }, letterExercise(fresh, letters, rng, 'find-letter'));

  const dueAll = dueLetters(state, today, [...(fresh ? [fresh] : []), ...held]);
  // Повторення - про те, що ще не засвоєно: впевнено знайомі букви лише тоді, коли іншим повторення не потрібне.
  const unsure = dueAll.filter((l) => !isConfident(state, l));
  const due = unsure.length ? unsure : dueAll;
  const introduced = introducedLetters(state).filter((l) => letters.includes(l) && LETTERS[l].kind !== 'sign');
  // З новою буквою місія й так довга: старі букви повторить розминка звичайних місій.
  const focus = (due.length ? due : shuffle(introduced, rng)).slice(0, fresh ? 0 : 2);
  // Перша буква: спершу впізнаємо серед схожих, а наприкінці місії згадуємо її звук сама.
  // Друга - одразу згадуємо звук малої букви.
  focus.forEach((l, i) => exercises.push(letterExercise(l, letters, rng, i === 0 ? 'letter-by-sound' : 'say-sound', i === 1 ? 'lower' : undefined)));
  const recallLater = fresh ?? focus[0];

  const known = letters.filter((l) => l !== fresh);
  const waiting = dueItems(state.review, today, known);
  const rank = (text: string) => {
    const i = waiting.indexOf(text);
    return i === -1 ? NOT_DUE : i;
  };
  const harder = (a: string, b: string) => rank(a) - rank(b) || readingScore(state, a) - readingScore(state, b);

  const syllables = availableSyllables(known);
  const byDifficulty = shuffle(syllables, rng).sort(harder);
  // Злиття двох звуків дається найважче, тож два найважчі склади спершу з'єднуємо доріжкою, а потім читаємо.
  for (const s of byDifficulty.slice(0, 2)) {
    const [c, v] = [...s.toLocaleUpperCase('uk-UA')] as LetterId[];
    exercises.push({ kind: 'blend', sounds: [c, v] }, { kind: 'read-syllable', syllable: s });
  }
  if (syllables.length >= 3) exercises.push({ kind: 'match-syllables', syllables: shuffle(syllables, rng).slice(0, 3) });
  const heard = byDifficulty[2] ?? byDifficulty[0];
  const earSyllable = heard && earExercise(heard, [...syllables, ...closedSyllables(known)], rng);
  if (earSyllable) exercises.push(earSyllable);

  const readable = ALL_WORDS.filter((w) => isReadableWith(w.text, known));
  const ranked = shuffle(readable, rng).sort((a, b) => harder(a.text, b.text));
  const word = ranked[0];
  const singles = readable.filter((w) => !isPhrase(w)).map((w) => w.text);
  const earWord = ranked.find((w) => w !== word && !isPhrase(w));
  const earWordEx = earWord && earExercise(earWord.text, singles, rng);
  if (earWordEx) exercises.push(earWordEx);
  if (word) {
    // Імена пишуться з великої («Ло-ла»), а склади-картки - з малої.
    const parts = syllablesOf(word).map(toLower);
    if (parts.length >= 2 && !isPhrase(word)) {
      const distractors = shuffle(
        syllables.filter((s) => !parts.includes(s)),
        rng,
      ).slice(0, 2);
      exercises.push(
        distractors.length
          ? { kind: 'build-word', word: word.text, distractors }
          : { kind: 'read-word', word: word.text },
      );
    } else {
      exercises.push({ kind: 'read-word', word: word.text });
    }
  }
  // Ще одне читання: фраза, коли вже є з чого їх складати, або слово, якому час повторення.
  const extra = ranked.find((w) => w !== word && w !== earWord && (isPhrase(w) || rank(w.text) !== NOT_DUE));
  if (extra) exercises.push({ kind: 'read-word', word: extra.text });

  // Самі голосні (ще до першої приголосної): співаємо пари і шукаємо букви.
  if (exercises.length < MIN_PRACTICE) {
    const vowels = known.filter((l) => LETTERS[l].kind === 'vowel');
    if (vowels.length >= 3 && syllables.length < 3) {
      exercises.push({ kind: 'match-syllables', syllables: shuffle(vowels, rng).slice(0, 3).map(toLower) });
    }
    const more = shuffle(
      introduced.filter((l) => !focus.includes(l)),
      rng,
    );
    for (const [i, l] of more.entries()) {
      if (exercises.length >= MIN_PRACTICE) break;
      exercises.push(letterExercise(l, letters, rng, i % 2 === 0 ? 'find-letter' : 'letter-by-sound', i % 2 === 0 ? 'lower' : undefined));
    }
  }

  // Наприкінці - згадати звук сама, без варіантів: між впізнаванням і згадуванням минуло кілька вправ.
  if (recallLater) exercises.push({ kind: 'say-sound', letter: recallLater });

  const sticker = PRACTICE_STICKERS.find((s) => !state.stickers.includes(s)) ?? PRACTICE_STICKERS[Math.floor(rng() * PRACTICE_STICKERS.length)];

  return {
    id: PRACTICE_ID,
    day: 0,
    order: 1,
    title: 'Повторення в лісі',
    goal: 'practice',
    requires: [...letters],
    newLetters: fresh ? [fresh] : [],
    sticker,
    adultNote: fresh
      ? 'Ця місія знайомить з новою відкритою буквою і повторює те, що {name} вже знає.'
      : 'Місія складається щоразу заново: букви, яким час повторення, і склади, що даються найважче.',
    exercises,
  };
}
