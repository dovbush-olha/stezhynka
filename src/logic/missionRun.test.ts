import { describe, expect, it } from 'vitest';
import type { LetterId } from '../content/alphabet';
import { COURSE_MISSIONS } from '../content/course';
import type { BuildWordExercise, Exercise, ExerciseKind, Mission } from '../content/types';
import { buildPracticeMission, makeRng } from './generate';
import { exerciseResult, finishMission, missionExercises, missionSummary, type VoiceChecks } from './missionRun';
import { applyExerciseResult, createInitialState, unlockLetter, updateSettings, type ExerciseResult, type ProgressState } from './progress';
import { practisedItems } from './review';

const TODAY = '2026-11-05';

const NO_VOICE: VoiceChecks = { hasSound: () => false, hasSay: () => false };
const SOUNDS_ONLY: VoiceChecks = { hasSound: () => true, hasSay: () => false };

const mission = (id: string): Mission => COURSE_MISSIONS.find((m) => m.id === id)!;
const kinds = (exercises: readonly Exercise[]): ExerciseKind[] => exercises.map((e) => e.kind);

/** Стан після всіх місій з підказками всюди: розминці є що повторювати. */
function struggled(mode: 'solo' | 'together'): ProgressState {
  let s = updateSettings(createInitialState(TODAY), { mode });
  for (const l of ['М', 'С', 'Н', 'К'] as LetterId[]) s = unlockLetter(s, l, TODAY);
  for (const m of COURSE_MISSIONS) {
    for (const ex of m.exercises) s = applyExerciseResult(s, { hinted: true, items: practisedItems(ex, true) }, TODAY);
  }
  return s;
}

describe('проходження місії: складання вправ', () => {
  it('однаковий seed дає ті самі вправи, а різні - інший порядок варіантів', () => {
    const s = struggled('together');
    const m = mission('l-2');
    const run = (seed: string) => missionExercises(s, m, TODAY, seed, NO_VOICE);
    expect(run('a')).toEqual(run('a'));
    const orders = new Set(['a', 'b', 'c', 'd', 'e'].map((seed) => JSON.stringify(run(seed))));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('перед місією йде розминка, а перед «Повторенням у лісі» - ні', () => {
    const s = struggled('together');
    const m = mission('l-2');
    expect(missionExercises(s, m, TODAY, 'w', NO_VOICE).length).toBeGreaterThan(m.exercises.length);
    const practice = buildPracticeMission(s, TODAY, makeRng('p'));
    expect(missionExercises(s, practice, TODAY, 'w', NO_VOICE)).toHaveLength(practice.exercises.length);
  });

  it('сама без жодних записів дитина не отримує вправ на слух - і в розминці теж', () => {
    const byEar = (exercises: readonly Exercise[]) => exercises.filter((e) => e.kind === 'letter-by-sound' || e.kind === 'pick-by-ear');
    const seeds = ['1', '2', '3', '4', '5'];
    const all = (s: ProgressState) =>
      [...COURSE_MISSIONS, buildPracticeMission(s, TODAY, makeRng('p'))].flatMap((m) =>
        seeds.flatMap((seed) => missionExercises(s, m, TODAY, `${m.id}-${seed}`, NO_VOICE)),
      );
    // З дорослим поруч такі вправи є - і в місіях, і в розминці, тож перевірка не порожня.
    expect(byEar(all(struggled('together'))).length).toBeGreaterThan(0);
    expect(byEar(all(struggled('solo')))).toEqual([]);
  });

  it('із записом звуку букви «знайди букву» стає «послухай і знайди» в обох режимах', () => {
    const m = COURSE_MISSIONS.find((x) => x.exercises.some((e) => e.kind === 'find-letter'))!;
    for (const mode of ['solo', 'together'] as const) {
      // Свіжий стан: розминці ще нічого повторювати, тож вправи - лише з місії.
      const s = updateSettings(createInitialState(TODAY), { mode });
      expect(kinds(missionExercises(s, m, TODAY, 'v', NO_VOICE)), mode).toContain('find-letter');
      const voiced = kinds(missionExercises(s, m, TODAY, 'v', SOUNDS_ONLY));
      expect(voiced, mode).not.toContain('find-letter');
      expect(voiced, mode).toContain('letter-by-sound');
    }
  });
});

describe('проходження місії: результат вправи', () => {
  it('прочитаний склад і складене слово потрапляють в інтервальне повторення', () => {
    const syllable = exerciseResult({ kind: 'read-syllable', syllable: 'ла' }, { hinted: false, reading: { text: 'ла', alone: true } });
    expect(syllable).toEqual({ hinted: false, reading: { text: 'ла', alone: true }, items: [{ text: 'ла', firstTry: true }] });
    const build = COURSE_MISSIONS.flatMap((m) => m.exercises).find((e): e is BuildWordExercise => e.kind === 'build-word')!;
    const word = exerciseResult(build, { hinted: true });
    expect(word.items).toEqual([{ text: build.word, firstTry: false }]);

    let s = createInitialState(TODAY);
    for (const r of [syllable, word]) s = applyExerciseResult(s, r, TODAY);
    expect(s.review['ла']).toMatchObject({ box: 2 });
    expect(s.review[build.word]).toMatchObject({ box: 1, due: TODAY });
  });

  it('пошук букви нічого не додає до повторення складів і слів', () => {
    expect(exerciseResult({ kind: 'find-letter', target: 'Л', options: ['Л', 'А'], letterCase: 'upper' }, { hinted: false }).items).toEqual([]);
  });
});

describe('проходження місії: підсумок і завершення', () => {
  const results: ExerciseResult[] = [
    { hinted: true, unscored: true },
    { hinted: true },
    { hinted: false, reading: { text: 'ла', alone: true } },
    { hinted: false, reading: { text: 'ло', alone: false } },
    { hinted: false },
  ];

  it('ознайомчі вправи не входять у частку підказок, а прочитане самостійно рахується окремо', () => {
    const m = mission('l-2');
    expect(missionSummary(m, results)).toEqual({ missionId: 'l-2', sticker: m.sticker, scored: 4, hinted: 1, readAlone: 1, readTotal: 2 });
  });

  it('завершення записує місію, наліпку і частку підказок', () => {
    const m = mission('vowels-1');
    const done = finishMission(createInitialState(TODAY), m, results, TODAY);
    expect(done.summary).toEqual({ missionId: 'vowels-1', sticker: m.sticker, scored: 4, hinted: 1, readAlone: 1, readTotal: 2 });
    expect(done.state.missions['vowels-1']).toMatchObject({
      completions: 1,
      lastCompletedAt: TODAY,
      lastHintRate: 0.25,
      lastReadAlone: 1,
      lastReadTotal: 2,
    });
    expect(done.state.stickers).toContain(m.sticker);
    expect(done.opened).toEqual([]);
  });

  it('остання місія перед М відкриває М і повідомляє про нову букву', () => {
    const beforeM = COURSE_MISSIONS.slice(
      0,
      COURSE_MISSIONS.findIndex((m) => m.id === 'm-1'),
    );
    const lastBeforeM = beforeM[beforeM.length - 1];
    let s = createInitialState(TODAY);
    for (const m of beforeM.slice(0, -1)) {
      const done = finishMission(s, m, results, TODAY);
      expect(done.opened, m.id).toEqual([]);
      s = done.state;
    }
    const last = finishMission(s, lastBeforeM, results, TODAY);
    expect(last.opened).toEqual(['М']);
    expect(last.state.unlocked).toContain('М');
    // Повторне проходження тієї самої місії нічого нового вже не відкриває.
    expect(finishMission(last.state, lastBeforeM, results, TODAY).opened).toEqual([]);
  });
});
