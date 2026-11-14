import { BASE_LETTERS, LETTERS, NOT_YET_STUDIED, PLANNED_LETTERS, isReadableWith, lettersOf, toLower, type LetterId } from './alphabet';
import type { Exercise, Mission } from './types';
import { WORDS, syllablesOf } from './words';

/** Власних вправ у місії з плану: разом із розминкою (хоча б одна вправа) місія вкладається у дванадцять. */
export const MAX_MISSION_EXERCISES = 11;

/** Усі рядки, які дитина бачить і має розпізнати/прочитати у вправі. */
export function childFacingTexts(ex: Exercise): string[] {
  switch (ex.kind) {
    case 'intro-letter':
    case 'say-sound':
      return [ex.letter];
    case 'find-letter':
    case 'letter-by-sound':
      return [ex.target, ...ex.options];
    case 'blend':
      return [...ex.sounds];
    case 'read-syllable':
      return [ex.syllable];
    case 'read-word':
      return [ex.word, ...wordSyllables(ex.word)];
    case 'pick-picture':
      // Інші варіанти - лише картинки, їхні слова дитина не бачить.
      return [ex.word, ...wordSyllables(ex.word)];
    case 'build-word':
      return [ex.word, ...wordSyllables(ex.word), ...ex.distractors];
    case 'match-syllables':
      return [...ex.syllables];
    case 'pick-by-ear':
      return [...ex.options];
  }
}

/** Перевіряє структуру однієї вправи. Повертає список помилок. */
export function validateExercise(ex: Exercise, allowed: readonly LetterId[]): string[] {
  const errors: string[] = [];
  const label = `${ex.kind}`;

  for (const text of childFacingTexts(ex)) {
    try {
      const letters = lettersOf(text);
      const forbidden = letters.filter((l) => NOT_YET_STUDIED.includes(l) && !allowed.includes(l));
      if (forbidden.length) errors.push(`${label}: «${text}» містить ще не вивчені букви ${forbidden.join(', ')}`);
      if (!isReadableWith(text, allowed)) {
        const missing = [...new Set(letters.filter((l) => !allowed.includes(l)))];
        errors.push(`${label}: «${text}» містить недоступні букви ${missing.join(', ')}`);
      }
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
    }
  }

  switch (ex.kind) {
    case 'find-letter':
    case 'letter-by-sound': {
      if (!ex.options.includes(ex.target)) errors.push(`${label}: варіанти не містять правильну букву ${ex.target}`);
      if (ex.options.length < 2 || ex.options.length > 3) errors.push(`${label}: має бути 2-3 варіанти, а є ${ex.options.length}`);
      if (new Set(ex.options).size !== ex.options.length) errors.push(`${label}: варіанти повторюються`);
      break;
    }
    case 'blend': {
      const [a, b] = ex.sounds;
      if (LETTERS[a].kind === LETTERS[b].kind) errors.push(`${label}: з'єднуємо голосний і приголосний, а не ${a}+${b}`);
      break;
    }
    case 'read-syllable': {
      const letters = safeLetters(ex.syllable);
      if (!letters.some((l) => LETTERS[l].kind === 'vowel')) errors.push(`${label}: склад «${ex.syllable}» без голосного`);
      break;
    }
    case 'read-word':
    case 'build-word': {
      const word = WORDS[ex.word];
      if (!word) {
        errors.push(`${label}: слова «${ex.word}» немає в банку слів`);
        break;
      }
      if (ex.kind === 'build-word') {
        const syllables = syllablesOf(word);
        if (syllables.length < 2) errors.push(`${label}: «${ex.word}» має лише один склад - краще read-word`);
        const lower = syllables.map(toLower);
        const overlap = ex.distractors.filter((d) => lower.includes(toLower(d)));
        if (overlap.length) errors.push(`${label}: зайві склади ${overlap.join(', ')} входять у слово`);
        if (!ex.distractors.length) errors.push(`${label}: потрібен хоча б один зайвий склад`);
      }
      break;
    }
    case 'match-syllables': {
      if (ex.syllables.length < 2 || ex.syllables.length > 4) errors.push(`${label}: потрібно 2-4 пари`);
      if (new Set(ex.syllables).size !== ex.syllables.length) errors.push(`${label}: склади повторюються`);
      break;
    }
    case 'pick-picture': {
      if (!WORDS[ex.word]) errors.push(`${label}: слова «${ex.word}» немає в банку слів`);
      if (!ex.options.includes(ex.word)) errors.push(`${label}: варіанти не містять правильне слово`);
      const pics = ex.options.map((o) => WORDS[o]?.picture);
      if (new Set(pics).size !== pics.length) errors.push(`${label}: картинки варіантів повторюються`);
      break;
    }
    case 'pick-by-ear': {
      const lower = ex.options.map(toLower);
      if (!lower.includes(toLower(ex.text))) errors.push(`${label}: варіанти не містять «${ex.text}»`);
      if (ex.options.length < 2 || ex.options.length > 3) errors.push(`${label}: має бути 2-3 варіанти, а є ${ex.options.length}`);
      if (new Set(lower).size !== lower.length) errors.push(`${label}: варіанти повторюються`);
      // Звучить або склад (одна голосна), або слово з банку слів.
      const vowels = safeLetters(ex.text).filter((l) => LETTERS[l].kind === 'vowel').length;
      if (!WORDS[ex.text] && vowels !== 1) errors.push(`${label}: «${ex.text}» - не склад і не слово з банку слів`);
      break;
    }
    case 'intro-letter':
    case 'say-sound':
      break;
  }
  return errors;
}

export function validateMission(m: Mission): string[] {
  const errors: string[] = [];
  const known = new Set<LetterId>([...BASE_LETTERS, ...PLANNED_LETTERS]);
  for (const l of m.requires) {
    if (!known.has(l)) errors.push(`${m.id}: місія вимагає букву ${l}, якої немає в плані`);
  }
  for (const l of m.newLetters ?? []) {
    if (!m.requires.includes(l)) errors.push(`${m.id}: нова буква ${l} не входить у requires`);
    const intro = m.exercises.findIndex((e) => e.kind === 'intro-letter' && e.letter === l);
    if (intro === -1) errors.push(`${m.id}: нову букву ${l} не представлено вправою intro-letter`);
    // Згадати звук можна лише після знайомства з ним.
    const say = m.exercises.findIndex((e) => e.kind === 'say-sound' && e.letter === l);
    if (say !== -1 && say < intro) errors.push(`${m.id}: звук нової букви ${l} питаємо раніше, ніж знайомимо з нею`);
  }
  if (m.exercises.length < 5 || m.exercises.length > MAX_MISSION_EXERCISES) {
    errors.push(`${m.id}: ${m.exercises.length} вправ - для 5-7 хвилин потрібно 5-${MAX_MISSION_EXERCISES}`);
  }
  if (new Set(m.exercises.map((e) => e.kind)).size < 3) errors.push(`${m.id}: замало різноманітності вправ`);
  m.exercises.forEach((ex, i) => {
    for (const err of validateExercise(ex, m.requires)) errors.push(`${m.id} #${i + 1} ${err}`);
  });
  return errors;
}

function wordSyllables(key: string): string[] {
  const w = WORDS[key];
  return w ? syllablesOf(w) : [];
}

function safeLetters(text: string): LetterId[] {
  try {
    return lettersOf(text);
  } catch {
    return [];
  }
}
