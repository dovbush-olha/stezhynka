/**
 * Дорослий пристосовує шлях букви до дитини: пропускає місії знайомої букви
 * і повертає дитину до букви, яка далася важко. Рішення завжди за дорослим - програма лише пропонує.
 */
import { BASE_LETTERS, type LetterId } from '../content/alphabet';
import type { Stage } from '../content/types';
import { COURSE_STAGES, introMissions, isVowelStage, previousStage, stageMissions, stageOfLetter, stageOfMission } from '../content/course';
import {
  autoUnlockLetters,
  isMissionDone,
  lettersReadyToOpen,
  missionState,
  nextMission,
  setLetterStatus,
  todayISO,
  unlockLetter,
  type ProgressState,
} from './progress';

export interface SkipOffer {
  stage: Stage;
  /** `all` - «Знає впевнено»: увесь етап; `intro` - «Знає»: скорочений шлях без дня знайомства. */
  kind: 'all' | 'intro';
  /** Ще не пройдені місії, які пропонуємо пропустити. */
  missions: string[];
}

/**
 * Що запропонувати пропустити, коли дорослий поставив букві статус.
 * Голосні мають спільні місії, тож їх пропускаємо, лише коли впевнено знайомі всі голосні етапу.
 * Нічого пропускати - нічого й не питаємо.
 */
export function skipOffer(state: ProgressState, letter: LetterId): SkipOffer | undefined {
  const stage = stageOfLetter(letter);
  if (!stage) return undefined;
  const status = state.letters[letter]?.status;
  const allConfident = stage.letters.every((l) => state.letters[l]?.status === 'confident');
  const kind = allConfident ? 'all' : status === 'knows' || status === 'confident' ? 'intro' : undefined;
  if (!kind) return undefined;
  const candidates = kind === 'all' ? stageMissions(stage) : introMissions(stage);
  const missions = candidates.filter((m) => !isMissionDone(state, m.id)).map((m) => m.id);
  return missions.length ? { stage, kind, missions } : undefined;
}

/** Дорослий підтвердив пропуск. Наступна буква відкривається так само, як після проходження. */
export function skipMissions(state: ProgressState, ids: readonly string[], today = todayISO()): ProgressState {
  const pending = ids.filter((id) => !isMissionDone(state, id));
  if (!pending.length) return state;
  // Місію, яку дитина вже колись пройшла, а дорослий повернув у чергу, пропуск просто знову робить пройденою:
  // у статистиці вона - пройдена, а не пропущена.
  const add = pending.filter((id) => !state.missions[id]?.completions);
  return autoUnlockLetters(
    {
      ...state,
      skipped: [...state.skipped, ...add],
      redo: state.redo.filter((id) => !pending.includes(id)),
    },
    today,
  );
}

export interface LetterQuestion {
  /** Букви, які відкрилися б самі, якби дорослий не вирішив відкривати їх сам. */
  letters: LetterId[];
  /** Етап, який дитина щойно пройшла: про нього й питаємо, чи вже знає. */
  previous: Stage;
}

/**
 * Питання дорослому, коли ввімкнено «Нову букву відкриває дорослий» і дитина дійшла до нової букви:
 * чи вже знає попередню? «Так» - відкрити нову букву, «Ще повчимо» - пройти попередню ще раз.
 */
export function letterQuestion(state: ProgressState): LetterQuestion | undefined {
  if (!state.settings.adultOpensLetters) return undefined;
  const letters = lettersReadyToOpen(state);
  const next = nextMission(state);
  if (!letters.length || !next) return undefined;
  const stage = stageOfMission(next.id);
  const previous = stage && previousStage(stage);
  return previous && { letters, previous };
}

/** Відповідь дорослого при знайомстві для етапу плану. */
export type KnownChoice = 'unknown' | 'knows' | 'confident';

/** Відповіді при знайомстві: ідентифікатор етапу → відповідь; етап без відповіді - «Ще не знає». */
export type KnownChoices = Readonly<Partial<Record<string, KnownChoice>>>;

/**
 * «Які букви дитина вже знає?» при знайомстві. Те саме, що дорослий зробив би вручну:
 * відкрити букву, поставити статус і погодитися на запропонований пропуск.
 */
export function applyKnownLetters(
  state: ProgressState,
  choices: KnownChoices,
  today = todayISO(),
): ProgressState {
  let s = state;
  for (const stage of COURSE_STAGES) {
    const choice = choices[stage.id];
    if (!choice || choice === 'unknown') continue;
    for (const l of stage.letters) s = setLetterStatus(unlockLetter(s, l, today), l, choice, today);
    const offer = skipOffer(s, stage.letters[0]);
    if (offer) s = skipMissions(s, offer.missions, today);
  }
  return s;
}

/** Етап і всі наступні: «Пройти букву ще раз» повертає в чергу і їх. */
function stageAndLater(stageId: string): { stage: Stage; later: Stage[] } | undefined {
  const index = COURSE_STAGES.findIndex((s) => s.id === stageId);
  if (index === -1) return undefined;
  return { stage: COURSE_STAGES[index], later: COURSE_STAGES.slice(index + 1) };
}

/** Букви наступних етапів, які повернення сховає: відкриті, крім базових і впевнено знайомих. */
function lettersToHide(state: ProgressState, later: readonly Stage[]): LetterId[] {
  return later
    .flatMap((s) => s.letters)
    .filter((l) => state.unlocked.includes(l) && !BASE_LETTERS.includes(l) && state.letters[l]?.status !== 'confident');
}

/** Дія доступна, коли в етапі є пройдені або пропущені місії. */
export function canRedoStage(state: ProgressState, stage: Stage): boolean {
  return stageMissions(stage).some((m) => isMissionDone(state, m.id));
}

export interface RedoPreview {
  /** Скільки місій знову стане в чергу: цього етапу і всіх наступних. */
  missions: number;
  /** Букви наступних етапів, які сховаються з вправ, доки дитина до них знову не дійде. */
  hides: LetterId[];
}

/** Місії, які повернення поставить у чергу: етап цілком, а з наступних - лише пройдені (їхні пропуски лишаються). */
function returningMissions(state: ProgressState, stage: Stage, later: readonly Stage[]): string[] {
  const own = stageMissions(stage).filter((m) => isMissionDone(state, m.id));
  const rest = later.flatMap(stageMissions).filter((m) => missionState(state, m.id) === 'done');
  return [...own, ...rest].map((m) => m.id);
}

export function redoPreview(state: ProgressState, stageId: string): RedoPreview | undefined {
  const found = stageAndLater(stageId);
  if (!found) return undefined;
  return { missions: returningMissions(state, found.stage, found.later).length, hides: lettersToHide(state, found.later) };
}

/**
 * «Пройти букву ще раз»: місії етапу й усіх наступних знову в черзі, а букви наступних етапів
 * ховаються з вправ, доки дитина до них не дійде (тоді відкриваються самі, як уперше).
 * Записи про проходження, наліпки, зірочки, статистика й журнал читання не змінюються.
 */
export function redoStage(state: ProgressState, stageId: string, today = todayISO()): ProgressState {
  const found = stageAndLater(stageId);
  if (!found) return state;
  const { stage, later } = found;
  const ownIds = new Set(stageMissions(stage).map((m) => m.id));
  // Пропущені місії етапу просто перестають бути пропущеними; у `redo` - лише ті, що мають запис про проходження.
  const returning = returningMissions(state, stage, later).filter((id) => state.missions[id]?.completions);
  const hide = lettersToHide(state, later);

  const letters = { ...state.letters };
  // Голосні мають спільні місії, і повернення до них не означає, що жодна голосна не засвоєна.
  if (!isVowelStage(stage)) {
    for (const l of stage.letters) {
      const lp = state.letters[l];
      // «Ще вчить» і найближче повторення: буква знову частіше трапляється в розминці.
      if (lp) letters[l] = { ...lp, status: 'learning', box: 1, due: today };
    }
  }

  return {
    ...state,
    letters,
    redo: [...new Set([...state.redo, ...returning])],
    skipped: state.skipped.filter((id) => !ownIds.has(id)),
    unlocked: state.unlocked.filter((l) => !hide.includes(l)),
    // Сховані поверненням букви - не те саме, що сховані дорослим: програма відкриє їх знову, коли дитина дійде.
    autoUnlocked: state.autoUnlocked.filter((l) => !hide.includes(l)),
  };
}
