/**
 * Проходження місії: з чого воно складається, що дає кожна вправа і чим закінчується.
 * Екран лише показує вправи й передає сюди результати.
 */
import type { LetterId } from '../content/alphabet';
import type { Exercise, Mission } from '../content/types';
import { makeRng, prepareExercise, warmUp } from './generate';
import { completeMission, type ExerciseResult, type MissionSummary, type ProgressState } from './progress';
import { practisedItems } from './review';
import { adaptForSolo, preferRecordedVoice } from './solo';

/** Чи є живий голос: без нього вправи на слух дитина сама не виконає. */
export interface VoiceChecks {
  /** Чи є запис звуку букви. */
  hasSound: (letter: LetterId) => boolean;
  /** Чи є запис, як читається склад, слово чи фраза. */
  hasSay: (text: string) => boolean;
}

/**
 * Вправи одного проходження: розминка (крім «Повторення в лісі», яке саме є повторенням) і вправи місії.
 * Кроки йдуть у цьому порядку: спершу «знайди букву» стає пошуком на слух, якщо є запис;
 * потім режим «сама» прибирає все, що без дорослого не виконати (розминку теж);
 * наостанок перемішуються варіанти відповідей - уже тих вправ, які побачить дитина.
 * Той самий seed дає ті самі вправи, щоб місія не змінювалася під час перемальовування.
 */
export function missionExercises(state: ProgressState, mission: Mission, today: string, seed: string, voice: VoiceChecks): Exercise[] {
  const rng = makeRng(seed);
  const solo = state.settings.mode === 'solo';
  const warm = mission.goal === 'practice' ? [] : warmUp(state, mission, today, rng);
  return [...warm, ...mission.exercises]
    .map((e) => preferRecordedVoice(e, voice.hasSound))
    .map((e) => (solo ? adaptForSolo(e, voice.hasSound, rng, voice.hasSay) : e))
    .map((e) => prepareExercise(e, rng));
}

/** Результат вправи разом з тим, що вона тренувала: склад чи слово піде в інтервальне повторення. */
export function exerciseResult(exercise: Exercise, result: ExerciseResult): ExerciseResult {
  return { ...result, items: practisedItems(exercise, result.hinted) };
}

/** Підсумок проходження. Ознайомчі вправи в частку підказок не входять: за нею радимо, чи повторити місію. */
export function missionSummary(mission: Mission, results: readonly ExerciseResult[]): MissionSummary {
  const scored = results.filter((r) => !r.unscored);
  const reading = results.flatMap((r) => (r.reading ? [r.reading] : []));
  return {
    missionId: mission.id,
    sticker: mission.sticker,
    scored: scored.length,
    hinted: scored.filter((r) => r.hinted).length,
    readAlone: reading.filter((r) => r.alone).length,
    readTotal: reading.length,
  };
}

export interface FinishedMission {
  state: ProgressState;
  summary: MissionSummary;
  /** Букви, які відкрилися самі, бо цією місією пройдено все до наступної букви плану. */
  opened: LetterId[];
}

/** Завершує місію: записує підсумок у прогрес і каже, які букви після цього відкрилися. */
export function finishMission(state: ProgressState, mission: Mission, results: readonly ExerciseResult[], today: string): FinishedMission {
  const summary = missionSummary(mission, results);
  const next = completeMission(state, summary, today);
  return { state: next, summary, opened: next.unlocked.filter((l) => !state.unlocked.includes(l)) };
}
