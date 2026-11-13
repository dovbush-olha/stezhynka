import { BASE_LETTERS, PLANNED_LETTERS, type LetterId } from '../content/alphabet';
import type { Mission } from '../content/types';
import { COURSE_MISSIONS, stageMissions, stageOfMission } from '../content/course';
import { isMissionDone, missionState, type ProgressState } from './progress';

/** `skipped` - дорослий пропустив: для шляху як пройдена, але дитина може в неї пограти й отримати наліпку. */
export type MissionAvailability = 'done' | 'skipped' | 'available' | 'needs-letters' | 'locked';

/** Якщо в останньому проходженні підказки знадобилися частіше, радимо повторити місію. */
export const STRUGGLE_HINT_RATE = 0.4;
/** Скільки разів поспіль радимо повторити складну місію, перш ніж іти далі. */
export const MAX_SUGGESTED_REPEATS = 3;
/** Після скількох місій поспіль радимо «Повторення в лісі», навіть посеред дня. */
export const REVIEW_EVERY = 3;

export function missingLetters(state: ProgressState, mission: Mission): LetterId[] {
  return mission.requires.filter((l) => !state.unlocked.includes(l));
}

export function missionAvailability(state: ProgressState, mission: Mission, missions = COURSE_MISSIONS): MissionAvailability {
  const own = missionState(state, mission.id);
  if (own === 'done') return own;
  const index = missions.findIndex((m) => m.id === mission.id);
  if (own === 'skipped') {
    if (!missingLetters(state, mission).length) return own;
    // Букву пропущеної місії сховано: поверненням - відкриється сама, коли дитина дійде; дорослим - лише він її відкриє.
    const next = missions.findIndex((m) => !isMissionDone(state, m.id));
    return next !== -1 && next < index ? 'locked' : 'needs-letters';
  }
  const prev = index > 0 ? missions[index - 1] : undefined;
  if (prev && !isMissionDone(state, prev.id)) return 'locked';
  // Попередню пройдено, а букви немає: дорослий її сховав, і відкрити її може лише він.
  if (missingLetters(state, mission).length) return 'needs-letters';
  return 'available';
}

export type Recommendation =
  | { kind: 'mission'; mission: Mission; reason: 'next' | 'repeat' }
  | { kind: 'practice'; reason: 'needs-letters'; letters: LetterId[]; waitingMission: Mission }
  | { kind: 'practice'; reason: 'all-done' }
  /** Новий день або кілька місій поспіль: спершу повторюємо вже знайоме. */
  | { kind: 'practice'; reason: 'review'; nextMission: Mission };

export function recommend(state: ProgressState, missions = COURSE_MISSIONS): Recommendation {
  const index = missions.findIndex((m) => !isMissionDone(state, m.id));
  if (index === -1) return { kind: 'practice', reason: 'all-done' };
  const next = missions[index];
  const prev = index > 0 ? missions[index - 1] : undefined;
  // Пропущену місію дитина не проходила, тож і повторювати її радити нема з чого.
  // Повернута буква починається наново: підказки в останній місії попередньої букви - давні.
  // Про повернення свідчить будь-яка місія етапу в черзі «ще раз»: перші могли бути пропущені й записів не мати.
  const stage = stageOfMission(next.id);
  const restartsLetter = Boolean(
    prev && stage && stage !== stageOfMission(prev.id) && stageMissions(stage).some((m) => state.redo.includes(m.id)),
  );
  const prevRecord = prev && missionState(state, prev.id) === 'done' && !restartsLetter ? state.missions[prev.id] : undefined;
  if (prev && prevRecord && prevRecord.lastHintRate > STRUGGLE_HINT_RATE && prevRecord.completions < MAX_SUGGESTED_REPEATS) {
    return { kind: 'mission', mission: prev, reason: 'repeat' };
  }
  const missing = missingLetters(state, next);
  if (missing.length) return { kind: 'practice', reason: 'needs-letters', letters: missing, waitingMission: next };
  // Перша місія нового дня приносить нову букву - перед нею повторюємо попередні дні.
  const newDay = Boolean(prev) && next.order === 1;
  if (state.sinceReview >= REVIEW_EVERY || (newDay && state.sinceReview > 0)) {
    return { kind: 'practice', reason: 'review', nextMission: next };
  }
  return { kind: 'mission', mission: next, reason: 'next' };
}

export interface UnlockAdvice {
  letter: LetterId;
  ready: boolean;
  message: string;
}

/**
 * Порада дорослому щодо наступної букви з плану.
 * Зазвичай вона відкривається сама після попереднього дня (див. autoUnlockLetters);
 * порада про готовність потрібна, коли дорослий букву сховав.
 */
export function adviseNextLetter(state: ProgressState, missions = COURSE_MISSIONS): UnlockAdvice | undefined {
  const letter = PLANNED_LETTERS.find((l) => !state.unlocked.includes(l));
  if (!letter) return undefined;

  const newest = [...PLANNED_LETTERS].reverse().find((l) => state.unlocked.includes(l)) ?? BASE_LETTERS[BASE_LETTERS.length - 1];
  const reachable = missions.filter((m) => m.requires.every((l) => state.unlocked.includes(l)));
  const pending = reachable.filter((m) => !isMissionDone(state, m.id));
  if (pending.length) {
    const when = state.settings.adultOpensLetters
      ? `Коли {name} пройде доступні місії (залишилось ${pending.length}), тут з’явиться питання, чи відкривати ${letter}.`
      : `Буква ${letter} відкриється сама, коли {name} пройде доступні місії (залишилось ${pending.length}).`;
    return { letter, ready: false, message: `${when} Якщо в школі її вже вчили, можна відкрити й зараз.` };
  }

  const lp = state.letters[newest];
  const recent = lp?.recent ?? [];
  const ratio = recent.length ? recent.filter(Boolean).length / recent.length : 0;
  if (recent.length >= 4 && ratio >= 0.67 && lp?.status !== 'learning') {
    return { letter, ready: true, message: `{name} добре впізнає ${newest}. Можна відкривати ${letter}.` };
  }
  if (recent.length >= 4 && ratio >= 0.67) {
    return {
      letter,
      ready: true,
      message: `{name} здебільшого впізнає ${newest} з першого разу. Якщо погоджуєтесь, позначте ${newest} як «Знає» або «Іноді забуває» і відкривайте ${letter}.`,
    };
  }
  return {
    letter,
    ready: false,
    message: `${newest} поки що іноді плутається. Пограйте «Повторення в лісі» ще раз-два - поспішати не потрібно.`,
  };
}
