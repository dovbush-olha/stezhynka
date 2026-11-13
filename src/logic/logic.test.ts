import { describe, expect, it } from 'vitest';
import { NOT_YET_STUDIED, isReadableWith, type LetterId } from '../content/alphabet';
import type { BuildWordExercise, Exercise, PickByEarExercise } from '../content/types';
import { validateExercise, validateMission } from '../content/validate';
import { COURSE, COURSE_MISSIONS, findMission, findStage, stageMissions } from '../content/course';
import { adviseNextLetter, isDayEarned, mapMission, missionAvailability, recommend } from './availability';
import { MAX_WARM_UP, availableSyllables, buildPracticeMission, earExercise, letterDistractors, makeRng, warmUp } from './generate';
import { dueItems, practisedItems, textsOf } from './review';
import { adaptForSolo, canPickPicture, preferRecordedVoice } from './solo';
import { closeness } from './similar';
import { ALL_WORDS, getWord, isPhrase, syllablesOf } from '../content/words';
import { sayKey, voiceItems } from './voice';
import {
  applyExerciseResult,
  completeMission,
  createInitialState,
  lockLetter,
  logLetter,
  normalizeState,
  setLetterStatus,
  suggestStatus,
  unlockLetter,
  unlockedInCourseOrder,
  updateSettings,
  type ProgressState,
} from './progress';
import { applyKnownLetters, canRedoStage, letterQuestion, openQuestionedLetters, redoPreview, redoStage, skipMissions, skipOffer } from './path';
import { isLastingMicFailure, readingCheck, readingCheckInExercise } from './readingCheck';
import { newestFirst, overflow } from './readingQueue';
import { addDays, nextReview } from './srs';

const TODAY = '2026-11-05';

function complete(state: ProgressState, id: string, hinted = 0, scored = 5): ProgressState {
  return completeMission(state, { missionId: id, sticker: id, scored, hinted, readAlone: 0, readTotal: 0 }, TODAY);
}

describe('інтервальне повторення', () => {
  it('підвищує коробку лише раз на день і повертає в першу після підказки', () => {
    const a = nextReview({ box: 1, due: TODAY }, true, TODAY);
    expect(a).toMatchObject({ box: 2, due: addDays(TODAY, 1) });
    const b = nextReview(a, true, TODAY);
    expect(b.box).toBe(2);
    const c = nextReview(b, true, addDays(TODAY, 1));
    expect(c.box).toBe(3);
    expect(nextReview(c, false, TODAY)).toMatchObject({ box: 1, due: TODAY });
  });

  it('addDays коректно переходить через місяць', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});

describe('стан прогресу', () => {
  it('на старті відкриті голосні й перша приголосна Л', () => {
    const s = createInitialState(TODAY);
    expect([...s.unlocked].sort()).toEqual(['А', 'О', 'У', 'И', 'І', 'Е', 'Л'].sort());
    expect(s.letters['Л']?.status).toBe('learning');
    expect(s.letters['А']?.status).toBe('sometimes');
  });

  it('збереження з режимом «З дорослим» вимикає запис читання: читання й далі відмічає дорослий, а прогрес лишається', () => {
    let old = createInitialState(TODAY);
    old = applyExerciseResult(old, { hinted: false, reading: { text: 'ла', alone: true } }, TODAY);
    old = complete(old, 'vowels-1');
    const saved = JSON.parse(JSON.stringify(old));
    saved.settings = { ...saved.settings, mode: 'together', recordReading: true };
    const s = normalizeState(saved, TODAY);
    expect(s.settings.recordReading).toBe(false);
    expect(s.settings).not.toHaveProperty('mode');
    expect(s.stars).toBe(old.stars);
    expect(s.stickers).toEqual(old.stickers);
    expect(s.missions).toEqual(old.missions);
    expect(s.reading).toEqual(old.reading);
  });

  it('збереження з режимом «Сама» лишає запис читання таким, як був', () => {
    const saved = (recordReading: boolean) => {
      const raw = JSON.parse(JSON.stringify(createInitialState(TODAY)));
      raw.settings = { ...raw.settings, mode: 'solo', recordReading };
      return normalizeState(raw, TODAY).settings;
    };
    expect(saved(true).recordReading).toBe(true);
    expect(saved(false).recordReading).toBe(false);
    expect(saved(true)).not.toHaveProperty('mode');
  });

  it('пошкоджені режим чи запис читання у збереженні не ламають налаштувань', () => {
    const saved = (settings: Record<string, unknown>) => {
      const raw = JSON.parse(JSON.stringify(createInitialState(TODAY)));
      raw.settings = { ...raw.settings, ...settings };
      return normalizeState(raw, TODAY).settings;
    };
    // Невідомий режим - як без режиму: лишається збережене значення запису, а без нього - типове (увімкнено).
    expect(saved({ mode: 'щось', recordReading: false }).recordReading).toBe(false);
    expect(saved({ mode: 42, recordReading: 'так' }).recordReading).toBe(true);
    expect(saved({ mode: 42 })).not.toHaveProperty('mode');
    // «З дорослим» вимикає запис, хоч би яким було збережене значення запису.
    expect(saved({ mode: 'together', recordReading: 'так' }).recordReading).toBe(false);
    expect(saved({ mode: 'together', recordReading: undefined }).recordReading).toBe(false);
  });

  it('зірочки лише додаються - і за підказку теж', () => {
    let s = createInitialState(TODAY);
    s = applyExerciseResult(s, { hinted: true }, TODAY);
    s = applyExerciseResult(s, { hinted: false }, TODAY);
    expect(s.stars).toBe(2);
  });

  it('відкидає невідомі налаштування (наприклад, старий голос)', () => {
    const s = normalizeState({ version: 1, settings: { voice: true, theme: 'night', helper: 'dragon' } }, TODAY);
    expect(s.settings).toMatchObject({ theme: 'night', helper: 'fox' });
    expect('voice' in s.settings).toBe(false);
  });

  it('витримує пошкоджені дані з localStorage', () => {
    expect(normalizeState('garbage', TODAY).unlocked).toHaveLength(7);
    expect(normalizeState({ version: 1, unlocked: ['С', 'X', 42] }, TODAY).unlocked).toContain('С');
    expect(normalizeState({ version: 1, unlocked: ['С', 'X'] }, TODAY).unlocked).not.toContain('X');
  });

  it('записує результати букв і читання', () => {
    let s = createInitialState(TODAY);
    s = applyExerciseResult(s, { hinted: false, letters: [{ id: 'Л', firstTry: true }], reading: { text: 'ЛА', alone: true } }, TODAY);
    expect(s.letters['Л']).toMatchObject({ seen: 1, firstTry: 1, box: 2 });
    expect(s.reading['ла']).toMatchObject({ alone: 1, helped: 0, last: 'alone' });
  });
});

describe('доступність місій', () => {
  it('рекомендує першу місію на старті', () => {
    const r = recommend(createInitialState(TODAY));
    expect(r).toMatchObject({ kind: 'mission', reason: 'next' });
    if (r.kind === 'mission') expect(r.mission.id).toBe('vowels-1');
  });

  /** Голосні й усі дні з Л - усе, що доступно до М. */
  const BEFORE_M = COURSE_MISSIONS.slice(0, COURSE_MISSIONS.findIndex((m) => m.id === 'm-1')).map((m) => m.id);

  it('голосні й дні з Л доступні одразу, а М відкривається сама після них', () => {
    let s = createInitialState(TODAY);
    const firstM = COURSE_MISSIONS.find((m) => m.id === 'm-1')!;
    for (const id of BEFORE_M) {
      expect(missionAvailability(s, COURSE_MISSIONS.find((m) => m.id === id)!)).toBe('available');
      expect(missionAvailability(s, firstM)).toBe('locked');
      expect(s.unlocked).not.toContain('М');
      s = complete(s, id);
    }
    expect(s.unlocked).toContain('М');
    expect(s.letters.М).toMatchObject({ status: 'learning', box: 1, due: TODAY });
    expect(missionAvailability(s, firstM)).toBe('available');
    // Перед новою буквою - повторення попередніх днів.
    expect(recommend(s)).toMatchObject({ kind: 'practice', reason: 'review', nextMission: { id: 'm-1' } });
    s = complete(s, 'practice');
    expect(recommend(s)).toMatchObject({ kind: 'mission', mission: { id: 'm-1' } });
  });

  it('після кожного дня відкривається наступна буква плану', () => {
    let s = createInitialState(TODAY);
    for (const m of COURSE_MISSIONS) {
      expect(missionAvailability(s, m)).toBe('available');
      s = complete(s, m.id);
    }
    expect(s.unlocked).toEqual(expect.arrayContaining(['М', 'С', 'Н', 'К']));
    expect(recommend(s)).toMatchObject({ kind: 'practice', reason: 'all-done' });
  });

  it('прогрес, збережений до автовідкриття, після завантаження одразу веде до М', () => {
    let s = createInitialState(TODAY);
    for (const id of BEFORE_M) s = complete(s, id);
    const old = JSON.parse(
      JSON.stringify({ ...s, unlocked: s.unlocked.filter((l) => l !== 'М'), autoUnlocked: undefined, sinceReview: undefined }),
    );
    const loaded = normalizeState(old, TODAY);
    expect(loaded.unlocked).toContain('М');
    expect(recommend(loaded)).toMatchObject({ kind: 'mission', mission: { id: 'm-1' } });
  });

  it('прогрес до появи нових місій веде в нові місії, не ховаючи вже відкритих букв', () => {
    let s = createInitialState(TODAY);
    // Так виглядав прогрес, коли план був на 7 днів: голосні, Л і перші дві місії М.
    for (const id of ['w1d1m1', 'w1d1m2', 'w1d2m1', 'w1d2m2', 'w1d2m3', 'w1d3m1', 'w1d3m2', 'w1d3m3', 'w1d4m1', 'w1d4m2']) s = complete(s, id);
    const loaded = normalizeState(JSON.parse(JSON.stringify({ ...s, unlocked: [...s.unlocked, 'М'], sinceReview: undefined })), TODAY);
    expect(loaded.unlocked).toContain('М');
    for (const id of ['vowels-1', 'vowels-2', 'l-1', 'l-3', 'l-5', 'l-8', 'm-1', 'm-2']) {
      expect(missionAvailability(loaded, COURSE_MISSIONS.find((m) => m.id === id)!), id).toBe('done');
    }
    expect(Object.keys(loaded.missions).some((id) => id.startsWith('w1d'))).toBe(false);
    // Нова місія з И - перша непройдена.
    expect(recommend(loaded)).toMatchObject({ kind: 'mission', mission: { id: 'vowels-3' } });
    // Повторне завантаження нічого не змінює, а нинішній запис важливіший за старий.
    expect(normalizeState(JSON.parse(JSON.stringify(loaded)), TODAY).missions).toEqual(loaded.missions);
    const both = normalizeState(JSON.parse(JSON.stringify({ ...loaded, missions: { ...loaded.missions, w1d1m1: { ...loaded.missions['vowels-1'], completions: 9 } } })), TODAY);
    expect(both.missions['vowels-1'].completions).toBe(1);
  });

  it('букву, яку сховав дорослий, гра сама вже не відкриває', () => {
    let s = createInitialState(TODAY);
    for (const id of BEFORE_M) s = complete(s, id);
    s = lockLetter(s, 'М');
    const firstM = COURSE_MISSIONS.find((m) => m.id === 'm-1')!;
    expect(missionAvailability(s, firstM)).toBe('needs-letters');
    s = complete(s, BEFORE_M.at(-1)!);
    s = normalizeState(JSON.parse(JSON.stringify(s)), TODAY);
    expect(s.unlocked).not.toContain('М');
    expect(recommend(s)).toMatchObject({ kind: 'practice', reason: 'needs-letters', letters: ['М'] });
    s = unlockLetter(s, 'М', TODAY);
    expect(missionAvailability(s, firstM)).toBe('available');
  });

  it('не відкриває букву, поки не пройдено всі попередні місії', () => {
    let s = createInitialState(TODAY);
    for (const id of BEFORE_M.filter((id) => id !== 'l-1')) s = complete(s, id);
    expect(s.unlocked).not.toContain('М');
    s = complete(s, 'l-1');
    expect(s.unlocked).toContain('М');
  });

  it('радить повторити місію, якщо було багато підказок, але не безкінечно', () => {
    let s = complete(createInitialState(TODAY), 'vowels-1', 4, 6);
    expect(recommend(s)).toMatchObject({ kind: 'mission', reason: 'repeat' });
    s = complete(s, 'vowels-1', 4, 6);
    s = complete(s, 'vowels-1', 4, 6);
    const r = recommend(s);
    expect(r.kind === 'mission' && r.mission.id).toBe('vowels-2');
  });

  it('радить про сховану букву лише тоді, коли доступні місії пройдено', () => {
    let s = createInitialState(TODAY);
    for (const id of BEFORE_M.slice(0, 2)) s = complete(s, id);
    expect(adviseNextLetter(s)).toMatchObject({ letter: 'М', ready: false });
    expect(adviseNextLetter(s)?.message).toContain('відкриється сама');
    for (const id of BEFORE_M) s = complete(s, id);
    s = lockLetter(s, 'М');
    expect(adviseNextLetter(s)?.letter).toBe('М');
    expect(adviseNextLetter(s)?.message).not.toContain('відкриється сама');
  });
});

describe('згенеровані вправи', () => {
  const letterSets: LetterId[][] = [
    [],
    ['М'],
    ['С'],
    ['М', 'С', 'Н', 'К'],
    ['М', 'С', 'Н', 'К', 'Т', 'Р', 'В'],
  ];

  it.each(letterSets.map((ls) => [ls.join('') || 'базовими', ls] as const))('практика з %s містить лише відкриті букви', (_k, ls) => {
    let s = createInitialState(TODAY);
    for (const l of ls) s = unlockLetter(s, l, TODAY);
    for (let seed = 0; seed < 25; seed++) {
      const m = buildPracticeMission(s, TODAY, makeRng(`seed-${seed}`));
      expect(m.exercises.length).toBeGreaterThanOrEqual(5);
      for (const ex of m.exercises) {
        expect(validateExercise(ex, s.unlocked), JSON.stringify(ex)).toEqual([]);
      }
    }
  });

  it('розминка не використовує Я, Ю, Є, Ї і недоступні в місії букви', () => {
    let s = createInitialState(TODAY);
    for (const l of ['М', 'С', 'Н', 'К', 'Я'] as LetterId[]) s = unlockLetter(s, l, TODAY);
    for (const l of s.unlocked) s = applyExerciseResult(s, { hinted: true, letters: [{ id: l, firstTry: false }] }, TODAY);
    for (const m of COURSE_MISSIONS) {
      for (let seed = 0; seed < 10; seed++) {
        for (const ex of warmUp(s, m, TODAY, makeRng(`${m.id}-${seed}`))) {
          expect(validateExercise(ex, m.requires), `${m.id} ${JSON.stringify(ex)}`).toEqual([]);
          if (ex.kind === 'find-letter' || ex.kind === 'letter-by-sound') {
            expect(ex.options.some((o) => NOT_YET_STUDIED.includes(o))).toBe(false);
          }
        }
      }
    }
  });

  it('у практиці є «послухай і вибери» для складу і для слова', () => {
    let s = createInitialState(TODAY);
    for (const l of ['М', 'С'] as LetterId[]) s = unlockLetter(s, l, TODAY);
    const ears = buildPracticeMission(s, TODAY, makeRng('ear')).exercises.filter((e) => e.kind === 'pick-by-ear');
    expect(ears).toHaveLength(2);
  });

  it('«послухай і вибери»: зайві варіанти найсхожіші на правильний', () => {
    const ex = earExercise('сом', ['сон', 'мама', 'сік', 'лимон', 'сом'], makeRng('a'));
    expect(ex).toEqual({ kind: 'pick-by-ear', text: 'сом', options: ['сом', expect.any(String), expect.any(String)] });
    if (ex?.kind === 'pick-by-ear') expect(ex.options).toEqual(expect.arrayContaining(['сік', 'сон']));
    expect(earExercise('сом', ['сон'], makeRng('a'))).toBeUndefined();
    expect(validateExercise({ kind: 'pick-by-ear', text: 'ла', options: ['ло', 'лу'] }, ['Л', 'А', 'О', 'У'])).not.toEqual([]);
  });

  it('слова в практиці читаються відкритими буквами', () => {
    const s = createInitialState(TODAY);
    const m = buildPracticeMission(s, TODAY, makeRng('x'));
    for (const ex of m.exercises) {
      if (ex.kind === 'read-word' || ex.kind === 'build-word') expect(isReadableWith(ex.word, s.unlocked)).toBe(true);
    }
  });
});

describe('вправи, які дитина виконує сама', () => {
  const always = () => true;
  const never = () => false;

  it('читання слова перетворюється на вибір картинки з різними картинками', () => {
    for (const m of COURSE_MISSIONS) {
      m.exercises.forEach((ex, i) => {
        const out = adaptForSolo(ex, never, makeRng(`${m.id}-${i}`));
        if (ex.kind === 'read-word') {
          expect(out.kind, `${m.id} ${ex.word}`).toBe(canPickPicture(getWord(ex.word)) ? 'pick-picture' : 'read-word');
          expect(validateExercise(out, m.requires), JSON.stringify(out)).toEqual([]);
        }
      });
    }
  });

  it('людей і картинки, яких не впізнати за текстом, не вгадують - лишається просте читання', () => {
    for (const word of ['Алла', 'Ніна', 'мамо', 'Ми малі', 'Ніна мала', 'у Олі', 'мамі', 'мале']) {
      expect(adaptForSolo({ kind: 'read-word', word }, never, makeRng(word)).kind, word).toBe('read-word');
    }
    expect(adaptForSolo({ kind: 'read-word', word: 'сом' }, never, makeRng('a')).kind).toBe('pick-picture');
  });

  it('у вибір картинки потрапляють лише слова, які видно з картинки', () => {
    const pickable = ALL_WORDS.filter(canPickPicture).map((w) => w.text);
    expect(pickable).toContain('лама');
    expect(pickable).not.toContain('Олена');
    expect(pickable).not.toContain('у мами');
  });

  it('зайві картинки називають схожі слова, щоб не вгадати за першою буквою', () => {
    const out = adaptForSolo({ kind: 'read-word', word: 'сом' }, never, makeRng('a'));
    if (out.kind !== 'pick-picture') throw new Error(out.kind);
    expect(out.options).toHaveLength(3);
    for (const o of out.options) expect(o[0]).toBe('с');
  });

  it('якщо є хоча б два схожі за першою буквою слова - обидва зайві варіанти на ту саму букву', () => {
    for (const m of COURSE_MISSIONS) {
      m.exercises.forEach((ex, i) => {
        const out = adaptForSolo(ex, never, makeRng(`${m.id}-${i}`));
        if (out.kind !== 'pick-picture') return;
        const first = out.word[0].toLowerCase();
        const target = getWord(out.word);
        const sameFirst = new Set(
          ALL_WORDS.filter((w) => w.clear && !isPhrase(w) && w.text !== out.word && w.picture !== target.picture && w.text[0].toLowerCase() === first)
            .map((w) => w.picture),
        );
        if (sameFirst.size < 2) return;
        for (const o of out.options) expect(o[0].toLowerCase(), `${m.id} ${out.word}: ${out.options.join(', ')}`).toBe(first);
      });
    }
  });

  it('у фразі зайвий варіант не схожий на її слова', () => {
    for (const word of ['Мама мила', 'Лис у лісі']) {
      for (let seed = 0; seed < 20; seed++) {
        const out = adaptForSolo({ kind: 'read-word', word }, never, makeRng(`${word}-${seed}`));
        if (out.kind !== 'pick-picture') throw new Error(out.kind);
        expect(out.options, word).not.toContain('мило');
        expect(out.options, word).not.toContain('ліс');
      }
    }
  });

  it('схожість: перша буква важливіша за решту слова', () => {
    expect(closeness('сом', 'сік')).toEqual([0, 2, 1]);
    expect(closeness('сом', 'дім')).toEqual([1, 2, 0]);
    expect(closeness('Мама', 'мама')).toEqual([0, 0, 0]);
  });

  it('звук без запису стає пошуком букви за зразком', () => {
    const ex: Exercise = { kind: 'letter-by-sound', target: 'Л', options: ['Л', 'А'] };
    expect(adaptForSolo(ex, never, makeRng('a')).kind).toBe('find-letter');
    expect(adaptForSolo(ex, always, makeRng('a')).kind).toBe('letter-by-sound');
  });

  it('скласти слово сама - лише за однозначною картинкою', () => {
    expect(adaptForSolo({ kind: 'build-word', word: 'мило', distractors: ['ла'] }, never, makeRng('a')).kind).toBe('build-word');
    expect(adaptForSolo({ kind: 'build-word', word: 'сом', distractors: ['са'] }, never, makeRng('a')).kind).toBe('pick-picture');
    expect(adaptForSolo({ kind: 'build-word', word: 'Алла', distractors: ['ло'] }, never, makeRng('a'))).toEqual({ kind: 'read-word', word: 'Алла' });
    // Дорослий записав фразу - Майя складає її сама, на слух.
    const phrase: BuildWordExercise = { kind: 'build-word', word: 'Мама мила', distractors: ['мо'] };
    expect(adaptForSolo(phrase, never, makeRng('a'), (t) => t === 'Мама мила').kind).toBe('build-word');
    expect(adaptForSolo(phrase, never, makeRng('a')).kind).not.toBe('build-word');
  });

  it('«послухай і вибери» сама - лише коли є запис, інакше читаємо', () => {
    const syl: PickByEarExercise = { kind: 'pick-by-ear', text: 'ма', options: ['ма', 'мо'] };
    expect(adaptForSolo(syl, never, makeRng('a'), () => true)).toEqual(syl);
    expect(adaptForSolo(syl, never, makeRng('a'))).toEqual({ kind: 'read-syllable', syllable: 'ма' });
    expect(adaptForSolo({ kind: 'pick-by-ear', text: 'сом', options: ['сом', 'сон'] }, never, makeRng('a')).kind).toBe('pick-picture');
    expect(adaptForSolo({ kind: 'pick-by-ear', text: 'Алла', options: ['Алла', 'Елла'] }, never, makeRng('a'))).toEqual({ kind: 'read-word', word: 'Алла' });
  });
});

describe('голос дорослого', () => {
  const find: Exercise = { kind: 'find-letter', target: 'Л', options: ['Л', 'А', 'О'], letterCase: 'lower' };

  it('«знайди букву» стає «послухай і знайди», коли є запис', () => {
    expect(preferRecordedVoice(find, (l) => l === 'Л')).toEqual({ ...find, kind: 'letter-by-sound' });
  });

  it('без запису вправа не змінюється, а з записом лишається пошуком на слух', () => {
    expect(preferRecordedVoice(find, () => false)).toBe(find);
    const voiced = preferRecordedVoice(find, () => true);
    expect(adaptForSolo(voiced, () => true, makeRng('x')).kind).toBe('letter-by-sound');
  });
});

describe('записи читання для дорослого', () => {
  const at = (minute: number) => `2026-11-05T10:${String(minute).padStart(2, '0')}:00.000Z`;
  const item = (id: string, minute: number) => ({ id, text: 'ма', at: at(minute) });

  it('найновіші зверху', () => {
    expect(newestFirst([item('a', 1), item('c', 3), item('b', 2)]).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('понад ліміт видаляються найстаріші', () => {
    expect(overflow([item('a', 1), item('b', 2), item('c', 3)], 2)).toEqual(['a']);
    expect(overflow([item('a', 1)], 2)).toEqual([]);
  });

  it('запис читання увімкнений, доки дорослий його не вимкне, і переживає перезавантаження', () => {
    expect(createInitialState(TODAY).settings.recordReading).toBe(true);
    const off = updateSettings(createInitialState(TODAY), { recordReading: false });
    expect(normalizeState(JSON.parse(JSON.stringify(off)), TODAY).settings.recordReading).toBe(false);
    expect(normalizeState({ ...off, settings: { recordReading: 'так' } }, TODAY).settings.recordReading).toBe(true);
  });
});

describe('хто перевіряє читання вголос', () => {
  it('запис увімкнений і мікрофон доступний - читання записується і чекає на дорослого', () => {
    expect(readingCheck({ recordReading: true }, true)).toBe('recording');
  });

  it('запис вимкнений - відмічає дорослий поруч, навіть якщо мікрофон доступний', () => {
    expect(readingCheck({ recordReading: false }, true)).toBe('adult');
  });

  it('мікрофон заборонений чи недоступний - відмічає дорослий поруч, хоч запис і увімкнений', () => {
    expect(readingCheck({ recordReading: true }, false)).toBe('adult');
    expect(readingCheck({ recordReading: false }, false)).toBe('adult');
  });

  it('заборонений чи відсутній мікрофон недоступний надовго, а зайнятий - лише цього разу', () => {
    expect(isLastingMicFailure(new DOMException('', 'NotAllowedError'))).toBe(true);
    expect(isLastingMicFailure(new DOMException('', 'NotFoundError'))).toBe(true);
    expect(isLastingMicFailure(new TypeError('getUserMedia is undefined'))).toBe(true);
    expect(isLastingMicFailure(new DOMException('', 'NotReadableError'))).toBe(false);
    expect(isLastingMicFailure(new DOMException('', 'AbortError'))).toBe(false);
  });

  it('у самій вправі: невдалий запис відмічає дорослий, а вже зроблений запис лишається перевіркою, хоч би мікрофон після цього й відмовив', () => {
    const fresh = { failed: false, captured: false };
    expect(readingCheckInExercise('recording', fresh)).toBe('recording');
    expect(readingCheckInExercise('adult', fresh)).toBe('adult');
    expect(readingCheckInExercise('recording', { failed: true, captured: false })).toBe('adult');
    // Запис уже є і збережеться: якби тут відмітив ще й дорослий, читання мало б дві відмітки.
    expect(readingCheckInExercise('adult', { failed: false, captured: true })).toBe('recording');
    // Запис не зберігся - відмічає дорослий, хоч запис і був зроблений.
    expect(readingCheckInExercise('recording', { failed: true, captured: true })).toBe('adult');
  });

  it('нове збереження записує читання, а колишнє «З дорослим» - ні', () => {
    expect(readingCheck(createInitialState(TODAY).settings, true)).toBe('recording');
    const old = { ...JSON.parse(JSON.stringify(createInitialState(TODAY))), settings: { mode: 'together', recordReading: true } };
    expect(readingCheck(normalizeState(old, TODAY).settings, true)).toBe('adult');
  });
});

describe('голос дорослого для складів і слів', () => {
  const letters: LetterId[] = ['А', 'О', 'У', 'И', 'І', 'Е', 'Л', 'М'];
  const items = voiceItems(letters, COURSE_MISSIONS);

  it('один запис на склад незалежно від регістру', () => {
    expect(sayKey('Ма')).toBe(sayKey('ма'));
    expect(sayKey('Мама мила')).toBe('say:мама мила');
  });

  it('склад з однієї букви - це звук букви, окремо його не записуємо', () => {
    expect(sayKey('О')).toBe('sound:О');
    expect(sayKey('у')).toBe('sound:У');
    expect(items.syllables).not.toContain('о');
  });

  it('слово з одного складу - лише серед слів', () => {
    expect(items.words).toContain('ми');
    expect(items.syllables).not.toContain('ми');
  });

  it('містить склади з місій, склади слів і самі слова', () => {
    expect(items.syllables).toEqual(expect.arrayContaining(['ла', 'ма', 'ал', 'ло']));
    expect(items.words).toEqual(expect.arrayContaining(['мама', 'мама мила', 'алла']));
  });

  it('містить і зворотні склади з голосної: «ам», «ум», «ім»', () => {
    expect(items.syllables).toEqual(expect.arrayContaining(['ам', 'ом', 'ум', 'им', 'ім', 'ем', 'ул', 'іл']));
  });

  it('лише те, що читається доступними буквами, без повторів', () => {
    for (const t of [...items.syllables, ...items.words]) expect(isReadableWith(t, letters), t).toBe(true);
    expect(items.words).not.toContain('оса');
    expect(new Set(items.syllables).size).toBe(items.syllables.length);
  });

  it('кожен склад кожного доступного слова можна записати', () => {
    for (const w of ALL_WORDS.filter((x) => isReadableWith(x.text, letters))) {
      for (const s of syllablesOf(w)) {
        const key = s.toLocaleLowerCase('uk-UA');
        if (key.length > 1) expect([...items.syllables, ...items.words], `${w.text}: ${s}`).toContain(key);
      }
    }
  });
});

describe('повторення складів і слів', () => {
  const mission = (id: string) => COURSE_MISSIONS.find((m) => m.id === id)!;

  it('вправа записує склад чи слово в інтервальне повторення', () => {
    let s = createInitialState(TODAY);
    const items = [
      ...practisedItems({ kind: 'blend', sounds: ['Л', 'А'] }, false),
      ...practisedItems({ kind: 'read-word', word: 'Лола' }, true),
    ];
    expect(items).toEqual([
      { text: 'ла', firstTry: true },
      { text: 'Лола', firstTry: false },
    ]);
    expect(practisedItems({ kind: 'match-syllables', syllables: ['ла', 'ло', 'лу'] }, false)).toEqual([]);
    s = applyExerciseResult(s, { hinted: false, items }, TODAY);
    expect(s.review['ла']).toMatchObject({ box: 2, due: addDays(TODAY, 1) });
    expect(s.review['Лола']).toMatchObject({ box: 1, due: TODAY });
    expect(dueItems(s.review, TODAY, s.unlocked)).toEqual(['Лола']);
    expect(dueItems(s.review, addDays(TODAY, 1), s.unlocked)).toEqual(['Лола', 'ла']);
  });

  it('пошкоджені записи повторення відкидаються під час завантаження', () => {
    const raw = { ...createInitialState(TODAY), review: { ма: { box: 2, due: TODAY }, 'x!': { box: 1, due: TODAY }, ло: { box: 'a' } } };
    expect(Object.keys(normalizeState(JSON.parse(JSON.stringify(raw)), TODAY).review)).toEqual(['ма']);
  });

  /** Стан після всіх місій з підказками всюди: усім складам і словам час повторення. */
  function struggled(): ProgressState {
    let s = createInitialState(TODAY);
    for (const l of ['М', 'С', 'Н', 'К'] as LetterId[]) s = unlockLetter(s, l, TODAY);
    for (const m of COURSE_MISSIONS) {
      for (const ex of m.exercises) s = applyExerciseResult(s, { hinted: true, items: practisedItems(ex, true) }, TODAY);
    }
    return s;
  }

  it('розминка повторює склади й слова, не беручи нових букв і того, що є в місії', () => {
    const s = struggled();
    for (const m of COURSE_MISSIONS) {
      for (let seed = 0; seed < 10; seed++) {
        const warm = warmUp(s, m, TODAY, makeRng(`${m.id}-${seed}`));
        expect(warm.length, m.id).toBeLessThanOrEqual(MAX_WARM_UP);
        expect(warm.length + m.exercises.length, m.id).toBeLessThanOrEqual(14);
        const allowed = m.requires.filter((l) => !(m.newLetters ?? []).includes(l));
        const inMission = textsOf(m.exercises);
        for (const ex of warm) {
          expect(validateExercise(ex, allowed), `${m.id} ${JSON.stringify(ex)}`).toEqual([]);
          for (const { text } of practisedItems(ex, false)) expect(inMission.has(text.toLowerCase()), `${m.id} ${text}`).toBe(false);
        }
      }
    }
    // Місії з 11 вправ - повна розминка: буква, склади чи слова.
    const warm = warmUp(s, mission('l-2'), TODAY, makeRng('w'));
    expect(warm).toHaveLength(MAX_WARM_UP);
    expect(warmUp(s, mission('s-2'), TODAY, makeRng('w')).some((e) => e.kind !== 'find-letter' && e.kind !== 'letter-by-sound')).toBe(true);
  });

  it('без того, що чекає повторення, розминка лишається короткою', () => {
    const s = createInitialState(TODAY);
    expect(warmUp(s, mission('l-2'), addDays(TODAY, 30), makeRng('a')).length).toBeLessThanOrEqual(1);
  });

  it('у повторенні в лісі першими йдуть склади, яким час повторення', () => {
    let s = createInitialState(TODAY);
    s = unlockLetter(s, 'М', TODAY);
    s = applyExerciseResult(s, { hinted: true, letters: [{ id: 'М', firstTry: true }], items: [{ text: 'ма', firstTry: false }] }, TODAY);
    for (let seed = 0; seed < 10; seed++) {
      const blends = buildPracticeMission(s, TODAY, makeRng(`d-${seed}`)).exercises.filter((e) => e.kind === 'read-syllable');
      expect(blends[0]).toEqual({ kind: 'read-syllable', syllable: 'ма' });
    }
  });

  it('у повторенні в лісі не більше 12 вправ, є фраза, коли їх уже можна читати', () => {
    let s = createInitialState(TODAY);
    for (const l of ['М', 'С'] as LetterId[]) s = unlockLetter(s, l, TODAY);
    for (let seed = 0; seed < 25; seed++) {
      const m = buildPracticeMission(s, TODAY, makeRng(`p-${seed}`));
      expect(m.exercises.length).toBeLessThanOrEqual(12);
      expect(m.exercises.some((e) => e.kind === 'read-word' && isPhrase(getWord(e.word)))).toBe(true);
    }
    s = unlockLetter(s, 'Н', TODAY);
    for (let seed = 0; seed < 25; seed++) expect(buildPracticeMission(s, TODAY, makeRng(`f-${seed}`)).exercises.length).toBeLessThanOrEqual(12);
  });

  it('перед новим днем радить повторення, і воно не показує букву, з якою знайомить наступна місія', () => {
    let s = complete(complete(createInitialState(TODAY), 'vowels-1'), 'vowels-2');
    // Посеред дня місії йдуть одна за одною.
    expect(recommend(s)).toMatchObject({ kind: 'mission', mission: { id: 'vowels-3' } });
    s = complete(s, 'vowels-3');
    expect(recommend(s)).toMatchObject({ kind: 'practice', reason: 'review', nextMission: { id: 'l-1' } });
    for (let seed = 0; seed < 25; seed++) {
      const m = buildPracticeMission(s, TODAY, makeRng(`v-${seed}`));
      expect(m.exercises.length).toBeGreaterThanOrEqual(6);
      for (const ex of m.exercises) expect(validateExercise(ex, ['А', 'О', 'У', 'И', 'І', 'Е']), JSON.stringify(ex)).toEqual([]);
    }
    s = complete(s, 'practice');
    expect(recommend(s)).toMatchObject({ kind: 'mission', mission: { id: 'l-1' } });
    s = complete(s, 'l-1');
    expect(recommend(s)).toMatchObject({ kind: 'mission', mission: { id: 'l-2' } });
  });

  it('повторні проходження не наближають повторення в лісі', () => {
    let s = complete(createInitialState(TODAY), 'vowels-1');
    for (let i = 0; i < 5; i++) s = complete(s, 'vowels-1');
    expect(s.sinceReview).toBe(1);
  });
});

describe('звук букви: згадати, а не лише впізнати', () => {
  it('у кожній місії з приголосною дитина сама каже звук, і щодня - звук кожної нової приголосної', () => {
    for (const m of COURSE_MISSIONS.filter((x) => x.requires.includes('Л'))) {
      expect(m.exercises.some((e) => e.kind === 'say-sound'), m.id).toBe(true);
    }
    for (const day of COURSE) {
      for (const l of day.missions[0].newLetters ?? []) {
        const said = day.missions.flatMap((m) => m.exercises).filter((e) => e.kind === 'say-sound' && e.letter === l);
        if (l !== 'Е' && l !== 'И') expect(said.length, `день ${day.day}: ${l}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('звук нової букви не питаємо до знайомства з нею', () => {
    const m = { ...COURSE_MISSIONS.find((x) => x.id === 'm-1')! };
    m.exercises = [{ kind: 'say-sound', letter: 'М' }, ...m.exercises.filter((e) => e.kind !== 'say-sound')];
    expect(validateMission(m).join()).toContain('раніше, ніж знайомимо');
  });

  it('зайвою буквою стає найсхожіша на вигляд: Л поруч з М, а не лише з голосними', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(letterDistractors('Л', ['А', 'О', 'Л', 'М'], makeRng(`l-${seed}`))[0]).toBe('М');
      expect(letterDistractors('Н', ['А', 'И', 'Н', 'М'], makeRng(`n-${seed}`))[0]).toBe('И');
    }
    expect(letterDistractors('Л', ['А', 'О', 'Л'], makeRng('x')).sort()).toEqual(['А', 'О']);
  });

  it('повторення в лісі закінчується тим, що дитина сама каже звук букви', () => {
    let s = createInitialState(TODAY);
    s = unlockLetter(s, 'М', TODAY);
    for (let seed = 0; seed < 10; seed++) {
      const m = buildPracticeMission(s, TODAY, makeRng(`say-${seed}`));
      expect(m.exercises.at(-1)?.kind, `seed ${seed}`).toBe('say-sound');
    }
  });

  it('розминка здебільшого просить згадати звук букви', () => {
    const s = createInitialState(TODAY);
    const kinds = Array.from({ length: 40 }, (_, i) => warmUp(s, COURSE_MISSIONS.find((m) => m.id === 'l-2')!, TODAY, makeRng(`w-${i}`))[0]?.kind);
    expect(kinds.filter((k) => k === 'say-sound').length).toBeGreaterThan(15);
  });

  it('відмітка дорослого за записом звука йде в повторення букви', () => {
    const s = createInitialState(TODAY);
    const ok = logLetter(s, { id: 'Л', firstTry: true }, TODAY);
    expect(ok.letters.Л).toMatchObject({ seen: 1, firstTry: 1, box: 2 });
    const no = logLetter(ok, { id: 'Л', firstTry: false }, TODAY);
    expect(no.letters.Л).toMatchObject({ seen: 2, firstTry: 1, box: 1, due: TODAY });
  });
});

describe('шлях букви: дорослий пропускає знайоме і повертає важке', () => {
  const ids = (stageId: string) => stageMissions(findStage(stageId)!).map((m) => m.id);
  /** Яку місію дитячий екран веде проходити наступною (і тоді, коли спершу пропонує повторення). */
  const upNext = (s: ProgressState) => {
    const r = recommend(s);
    return r.kind === 'mission' ? r.mission.id : r.reason === 'review' ? r.nextMission.id : r.reason;
  };
  const completeAll = (s: ProgressState, list: string[]) => list.reduce((acc, id) => complete(acc, id), s);
  /** Голосні й Л пройдено - М відкрилася сама. */
  const reachedM = () => completeAll(createInitialState(TODAY), [...ids('vowels'), ...ids('l')]);

  it('«Знає впевнено» пропонує пропустити всі непройдені місії букви; після пропуску - наступна буква й її перша місія', () => {
    let s = complete(reachedM(), 'm-1');
    s = setLetterStatus(s, 'М', 'confident', TODAY);
    const offer = skipOffer(s, 'М');
    expect(offer?.missions).toEqual(ids('m').slice(1));
    s = skipMissions(s, offer!.missions, TODAY);
    expect(s.unlocked).toContain('С');
    expect(upNext(s)).toBe(ids('s')[0]);
    for (const id of ids('m').slice(1)) expect(missionAvailability(s, findMission(id)!), id).toBe('skipped');
  });

  it('«Знає» пропонує скорочений шлях: без дня знайомства, а склади, слова й фрази лишаються', () => {
    let s = setLetterStatus(reachedM(), 'М', 'knows', TODAY);
    const intro = findStage('m')!.days[0].missions.map((m) => m.id);
    expect(skipOffer(s, 'М')).toMatchObject({ kind: 'intro', missions: intro });
    s = skipMissions(s, intro, TODAY);
    expect(upNext(s)).toBe(findStage('m')!.days[1].missions[0].id);
  });

  it('пропуск не пропонується, коли пропускати нічого', () => {
    let s = reachedM();
    // День знайомства з М уже пройдено.
    s = completeAll(s, findStage('m')!.days[0].missions.map((m) => m.id));
    expect(skipOffer(setLetterStatus(s, 'М', 'knows', TODAY), 'М')).toBeUndefined();
    // У голосних один день - скороченого шляху немає.
    expect(skipOffer(setLetterStatus(createInitialState(TODAY), 'А', 'knows', TODAY), 'А')).toBeUndefined();
    // Етап голосних пропускаємо, лише коли впевнено знайомі всі голосні.
    let v = setLetterStatus(createInitialState(TODAY), 'А', 'confident', TODAY);
    expect(skipOffer(v, 'А')).toBeUndefined();
    for (const l of findStage('vowels')!.letters) v = setLetterStatus(v, l, 'confident', TODAY);
    expect(skipOffer(v, 'А')).toMatchObject({ kind: 'all', missions: ids('vowels') });
  });

  it('за пропущену місію наліпки й зірочок немає, а коли дитина її пройде - наліпка з’являється', () => {
    let s = setLetterStatus(reachedM(), 'М', 'confident', TODAY);
    const before = { stickers: s.stickers, stars: s.stars };
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    expect({ stickers: s.stickers, stars: s.stars }).toEqual(before);
    const m2 = findMission('m-2')!;
    s = completeMission(s, { missionId: m2.id, sticker: m2.sticker, scored: 5, hinted: 0, readAlone: 0, readTotal: 0 }, TODAY);
    expect(s.stickers).toContain(m2.sticker);
    expect(missionAvailability(s, m2)).toBe('done');
  });

  it('зниження статусу пропуску не скасовує', () => {
    let s = setLetterStatus(reachedM(), 'М', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    s = setLetterStatus(s, 'М', 'learning', TODAY);
    expect(missionAvailability(s, findMission('m-1')!)).toBe('skipped');
    expect(upNext(s)).toBe(ids('s')[0]);
  });

  it('порада «повторити місію» не стосується пропущеної місії', () => {
    // Остання місія Л далася важко, але день знайомства з М дорослий пропустив - повторювати нема чого.
    let s = createInitialState(TODAY);
    s = completeAll(s, [...ids('vowels'), ...ids('l').slice(0, -1)]);
    s = complete(s, ids('l').at(-1)!, 4, 6);
    expect(recommend(s)).toMatchObject({ reason: 'repeat' });
    s = setLetterStatus(s, 'М', 'knows', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    expect(recommend(s)).not.toMatchObject({ reason: 'repeat' });
    expect(upNext(s)).toBe(findStage('m')!.days[1].missions[0].id);
  });

  it('після повернення до букви зі скороченим шляхом не радимо повторити давню важку місію попередньої букви', () => {
    let s = applyKnownLetters(createInitialState(TODAY), { l: 'knows' }, TODAY);
    s = completeAll(s, ids('vowels').slice(0, -1));
    s = complete(s, ids('vowels').at(-1)!, 4, 6);
    s = completeAll(s, ids('l').filter((id) => missionAvailability(s, findMission(id)!) !== 'skipped'));
    s = redoStage(s, 'l', TODAY);
    expect(recommend(s)).not.toMatchObject({ reason: 'repeat' });
    expect(upNext(s)).toBe(ids('l')[0]);
  });

  /** Пройдено голосні, Л, М і перша місія С; С відкрилася сама. */
  const reachedS = () => complete(completeAll(reachedM(), ids('m')), 's-1');

  it('«Пройти букву ще раз»: перша місія букви знову наступна, наступні букви сховані, а зароблене й статистика лишаються', () => {
    let s = applyExerciseResult(reachedS(), { hinted: false, letters: [{ id: 'М', firstTry: true }], reading: { text: 'ма', alone: true } }, TODAY);
    s = setLetterStatus(s, 'М', 'knows', TODAY);
    const before = s;
    s = redoStage(s, 'm', TODAY);
    expect(upNext(s)).toBe('m-1');
    expect(s.unlocked).toContain('М');
    expect(s.unlocked).not.toContain('С');
    expect(s.letters.М?.status).toBe('learning');
    expect(missionAvailability(s, findMission('s-1')!)).toBe('locked');
    expect(s.stars).toBe(before.stars);
    expect(s.stickers).toEqual(before.stickers);
    expect(s.missions).toEqual(before.missions);
    expect(s.reading).toEqual(before.reading);
    expect(s.letters.М).toMatchObject({ seen: before.letters.М!.seen, firstTry: before.letters.М!.firstTry, recent: before.letters.М!.recent });
    // Збереження читається так само.
    expect(upNext(normalizeState(JSON.parse(JSON.stringify(s)), TODAY))).toBe('m-1');
  });

  it('на мапі зароблене лишається після «Пройти букву ще раз», а пропущене зірочки не дає', () => {
    const s = redoStage(reachedS(), 'm', TODAY);
    const m1 = mapMission(s, findMission('m-1')!);
    const m2 = mapMission(s, findMission('m-2')!);
    expect(m1).toMatchObject({ availability: 'available', earned: true, playable: true });
    // Повернута в чергу зароблена місія - зірочкою, і пограти в неї можна, бо М відкрита.
    expect(m2).toMatchObject({ availability: 'locked', look: 'done', earned: true, playable: true });
    // Буква С сховалася - її зароблена місія чекає, доки дитина знову не дійде.
    expect(mapMission(s, findMission('s-1')!)).toMatchObject({ look: 'done', earned: true, playable: false });
    expect(isDayEarned(s, findStage('m')!.days[0])).toBe(true);

    let k = setLetterStatus(reachedM(), 'М', 'confident', TODAY);
    k = skipMissions(k, skipOffer(k, 'М')!.missions, TODAY);
    expect(mapMission(k, findMission('m-2')!)).toMatchObject({ look: 'skipped', earned: false, playable: true });
    expect(isDayEarned(k, findStage('m')!.days[1])).toBe(false);
  });

  it('після повторного проходження букви наступна відкривається сама, і її місії проходяться наново', () => {
    let s = redoStage(reachedS(), 'm', TODAY);
    s = completeAll(s, ids('m'));
    expect(s.unlocked).toContain('С');
    expect(upNext(s)).toBe('s-1');
    expect(missionAvailability(s, findMission('s-1')!)).toBe('available');
  });

  it('наступна буква «Знає впевнено» після повернення не ховається, і її пропуски лишаються', () => {
    let s = setLetterStatus(reachedS(), 'С', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'С')!.missions, TODAY);
    expect(s.unlocked).toContain('Н');
    s = redoStage(s, 'm', TODAY);
    expect(s.unlocked).toContain('С');
    expect(s.unlocked).not.toContain('Н');
    expect(missionAvailability(s, findMission('s-2')!)).toBe('skipped');
    // s-1 пройдено, тож вона в черзі знову; решта С - пропущені.
    s = completeAll(s, [...ids('m'), 's-1']);
    expect(upNext(s)).toBe(ids('n')[0]);
    expect(s.unlocked).toContain('Н');
  });

  it('пропущену місію схованої поверненням букви дитина не відкриє, доки знову до неї не дійде', () => {
    // При знайомстві М - «Знає»: день знайомства з М пропущено, і М відкрита.
    let s = applyKnownLetters(createInitialState(TODAY), { m: 'knows' }, TODAY);
    s = completeAll(s, [...ids('vowels'), ...ids('l')]);
    s = redoStage(s, 'l', TODAY);
    expect(s.unlocked).not.toContain('М');
    expect(missionAvailability(s, findMission('m-1')!)).toBe('locked');
    s = completeAll(s, ids('l'));
    expect(s.unlocked).toContain('М');
    expect(missionAvailability(s, findMission('m-1')!)).toBe('skipped');
  });

  it('пропущену місію букви, яку сховав дорослий, дитина не відкриє, доки дорослий не відкриє букву', () => {
    let s = setLetterStatus(reachedM(), 'М', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    s = lockLetter(s, 'М');
    expect(missionAvailability(s, findMission('m-1')!)).toBe('needs-letters');
  });

  it('повернення знімає пропуски самої букви', () => {
    let s = setLetterStatus(reachedM(), 'М', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    s = redoStage(s, 'm', TODAY);
    expect(missionAvailability(s, findMission('m-1')!)).toBe('available');
    expect(missionAvailability(s, findMission('m-2')!)).toBe('locked');
  });

  it('«Пройти голосні ще раз» - одна дія на всі голосні; їхні статуси не змінюються', () => {
    let s = setLetterStatus(reachedS(), 'А', 'knows', TODAY);
    s = redoStage(s, 'vowels', TODAY);
    expect(upNext(s)).toBe('vowels-1');
    expect(s.letters.А?.status).toBe('knows');
    expect(s.unlocked).not.toContain('М');
  });

  it('букви поза планом, відкриті дорослим, повернення не чіпає', () => {
    let s = unlockLetter(reachedS(), 'Т', TODAY);
    s = redoStage(s, 'm', TODAY);
    expect(s.unlocked).toContain('Т');
  });

  it('дія «ще раз» доступна, коли в букві є пройдені або пропущені місії', () => {
    expect(canRedoStage(createInitialState(TODAY), findStage('m')!)).toBe(false);
    expect(canRedoStage(reachedS(), findStage('m')!)).toBe(true);
    let s = setLetterStatus(reachedM(), 'М', 'knows', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    expect(canRedoStage(s, findStage('m')!)).toBe(true);
    expect(canRedoStage(redoStage(reachedS(), 'm', TODAY), findStage('m')!)).toBe(false);
  });

  it('перед поверненням дорослий бачить, скільки місій повернеться і які букви сховаються', () => {
    let s = setLetterStatus(reachedS(), 'С', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'С')!.missions, TODAY);
    s = unlockLetter(s, 'Н', TODAY);
    expect(redoPreview(s, 'l')).toEqual({
      missions: ids('l').length + ids('m').length + 1,
      laterMissions: ids('m').length + 1,
      laterSkipped: true,
      hides: ['М', 'Н'],
    });
  });

  it('перед поверненням до букви, після якої дитина ще нічого не проходила, мова лише про її власні місії', () => {
    // Дитина пройшла лише кілька місій М: наступних букв ні пройдених, ні пропущених немає.
    const s = completeAll(reachedM(), ids('m').slice(0, 2));
    expect(redoPreview(s, 'm')).toEqual({ missions: 2, laterMissions: 0, laterSkipped: false, hides: [] });
    // Наступні букви пройдено - їхні місії теж повертаються, а пропусків немає.
    expect(redoPreview(reachedS(), 'l')).toMatchObject({ laterMissions: ids('m').length + 1, laterSkipped: false });
  });

  /** Літери-вправи: де дитина впізнає букву чи згадує її звук. */
  const letterTargets = (exercises: Exercise[]) =>
    exercises.flatMap((e) => (e.kind === 'find-letter' || e.kind === 'letter-by-sound' ? [e.target] : e.kind === 'say-sound' ? [e.letter] : []));
  /** Голосні повторено сьогодні - чекає повторення лише Л. */
  const onlyLDue = () => {
    let s = createInitialState(TODAY);
    for (const l of findStage('vowels')!.letters) s = logLetter(s, { id: l, firstTry: true }, TODAY);
    return s;
  };

  it('розминка не бере вправи на букву «Знає впевнено», а склади й слова, яким час повторення, бере', () => {
    // Місія з Л, де сама місія вправи на Л не має - інакше розминка її й так не бере.
    const mission = COURSE_MISSIONS.find((m) => !m.newLetters && m.requires.includes('Л') && !letterTargets(m.exercises).includes('Л'))!;
    const syllable = availableSyllables(mission.requires).find((t) => !textsOf(mission.exercises).has(t))!;
    // Букви місії відкриті й щойно повторені - чекає повторення лише Л.
    let s = onlyLDue();
    for (const l of mission.requires.filter((l) => !s.unlocked.includes(l))) s = logLetter(unlockLetter(s, l, TODAY), { id: l, firstTry: true }, TODAY);
    s = applyExerciseResult(s, { hinted: true, items: [{ text: syllable, firstTry: false }] }, TODAY);
    expect(letterTargets(warmUp(s, mission, TODAY, makeRng('w')))).toEqual(['Л']);
    s = setLetterStatus(s, 'Л', 'confident', TODAY);
    for (let seed = 0; seed < 20; seed++) {
      const warm = warmUp(s, mission, TODAY, makeRng(`w-${seed}`));
      expect(letterTargets(warm), `seed ${seed}`).toEqual([]);
      expect(textsOf(warm).has(syllable), `seed ${seed}`).toBe(true);
    }
  });

  it('у «Повторенні в лісі» впевнено знайома буква - лише коли іншим буквам повторення не потрібне', () => {
    let s = setLetterStatus(onlyLDue(), 'Л', 'confident', TODAY);
    // Самій лише Л час повторення - тоді й вона годиться.
    expect(letterTargets(buildPracticeMission(s, TODAY, makeRng('p')).exercises)).toContain('Л');
    s = logLetter(s, { id: 'О', firstTry: false }, TODAY);
    for (let seed = 0; seed < 20; seed++) {
      const targets = letterTargets(buildPracticeMission(s, TODAY, makeRng(`p-${seed}`)).exercises);
      expect(targets, `seed ${seed}`).toContain('О');
      expect(targets, `seed ${seed}`).not.toContain('Л');
    }
  });

  it('«Повторення в лісі» не знайомить наново з буквою, яку дорослий позначив знайомою', () => {
    const intros = (s: ProgressState, seed: string) =>
      buildPracticeMission(s, TODAY, makeRng(seed)).exercises.flatMap((e) => (e.kind === 'intro-letter' ? [e.letter] : []));
    for (const choice of ['knows', 'confident'] as const) {
      const s = applyKnownLetters(createInitialState(TODAY), { m: choice }, TODAY);
      for (let seed = 0; seed < 10; seed++) expect(intros(s, `k-${seed}`), `${choice} ${seed}`).not.toContain('М');
    }
    // Відкрита, але ще не знайома буква - як і раніше, зі знайомством.
    expect(intros(unlockLetter(createInitialState(TODAY), 'М', TODAY), 'k')).toContain('М');
  });

  it('порада щодо статусу ніколи не пропонує «Знає впевнено» і не радить знизити його до «Знає»', () => {
    let s = createInitialState(TODAY);
    for (let i = 0; i < 6; i++) s = logLetter(s, { id: 'Л', firstTry: true }, TODAY);
    expect(suggestStatus(s.letters.Л)).toBe('knows');
    expect(suggestStatus(setLetterStatus(s, 'Л', 'confident', TODAY).letters.Л)).toBeUndefined();
    for (let i = 0; i < 6; i++) s = logLetter(s, { id: 'Л', firstTry: false }, TODAY);
    expect(suggestStatus(setLetterStatus(s, 'Л', 'confident', TODAY).letters.Л)).toBe('learning');
  });

  it('з «Нову букву відкриває дорослий» буква не відкривається сама, дитині - «Повторення в лісі», дорослому - питання', () => {
    let s = updateSettings(createInitialState(TODAY), { adultOpensLetters: true });
    s = completeAll(s, [...ids('vowels'), ...ids('l')]);
    expect(s.unlocked).not.toContain('М');
    expect(recommend(s)).toMatchObject({ kind: 'practice', reason: 'needs-letters', letters: ['М'] });
    expect(letterQuestion(s)).toMatchObject({ letters: ['М'], previous: { id: 'l' } });
    // Без налаштування питання немає: буква відкрилася сама.
    expect(letterQuestion(reachedM())).toBeUndefined();
    // Відповідь «Так, відкрити».
    s = openQuestionedLetters(s, TODAY);
    expect(s.unlocked).toContain('М');
    expect(letterQuestion(s)).toBeUndefined();
    expect(upNext(s)).toBe('m-1');
  });

  it('питання дорослому - про букву, яку дитина справді проходила, а не про пропущену', () => {
    let s = applyKnownLetters(createInitialState(TODAY), { m: 'confident' }, TODAY);
    // Місії М пропущено, але потім дорослий засумнівався: М уже не «Знає впевнено».
    s = setLetterStatus(updateSettings(s, { adultOpensLetters: true }), 'М', 'knows', TODAY);
    s = completeAll(s, [...ids('vowels'), ...ids('l')]);
    expect(letterQuestion(s)).toMatchObject({ letters: ['С'], previous: { id: 'l' } });
  });

  it('з «Нову букву відкриває дорослий» пропуск місій впевнено знайомої букви одразу відкриває наступну, без питання', () => {
    let s = updateSettings(createInitialState(TODAY), { adultOpensLetters: true });
    s = completeAll(openQuestionedLetters(completeAll(s, [...ids('vowels'), ...ids('l')]), TODAY), ['m-1']);
    s = setLetterStatus(s, 'М', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    expect(s.unlocked).toContain('С');
    expect(letterQuestion(s)).toBeUndefined();
    expect(upNext(s)).toBe(ids('s')[0]);
  });

  it('з «Нову букву відкриває дорослий» «Знає впевнено» для букви, яку дитина вже пройшла, - відповідь на питання про неї', () => {
    let s = updateSettings(createInitialState(TODAY), { adultOpensLetters: true });
    s = completeAll(openQuestionedLetters(completeAll(s, [...ids('vowels'), ...ids('l')]), TODAY), ids('m'));
    expect(letterQuestion(s)).toMatchObject({ letters: ['С'], previous: { id: 'm' } });
    // «Знає» - ще не відповідь: дорослий вирішує сам.
    expect(letterQuestion(setLetterStatus(s, 'М', 'knows', TODAY))).toMatchObject({ letters: ['С'] });
    s = setLetterStatus(s, 'М', 'confident', TODAY);
    expect(s.unlocked).toContain('С');
    expect(letterQuestion(s)).toBeUndefined();
    expect(upNext(s)).toBe(ids('s')[0]);
    // Те саме й у збереженні, де дорослий позначив М раніше, ніж дитина її пройшла.
    const saved = JSON.parse(JSON.stringify(s));
    saved.unlocked = saved.unlocked.filter((l: string) => l !== 'С');
    saved.autoUnlocked = [];
    expect(normalizeState(saved, TODAY).unlocked).toContain('С');
  });

  it('з «Нову букву відкриває дорослий» сховані поверненням букви теж чекають дорослого', () => {
    let s = updateSettings(redoStage(reachedS(), 'm', TODAY), { adultOpensLetters: true });
    s = completeAll(s, ids('m'));
    expect(s.unlocked).not.toContain('С');
    expect(letterQuestion(s)).toMatchObject({ letters: ['С'], previous: { id: 'm' } });
  });

  it('вибір при знайомстві дає той самий шлях, що й відповідні дії дорослого', () => {
    const chosen = applyKnownLetters(createInitialState(TODAY), { vowels: 'confident', l: 'knows', m: 'confident', s: 'unknown' }, TODAY);

    let byHand = createInitialState(TODAY);
    for (const l of findStage('vowels')!.letters) byHand = setLetterStatus(byHand, l, 'confident', TODAY);
    byHand = skipMissions(byHand, skipOffer(byHand, 'А')!.missions, TODAY);
    byHand = setLetterStatus(byHand, 'Л', 'knows', TODAY);
    byHand = skipMissions(byHand, skipOffer(byHand, 'Л')!.missions, TODAY);
    byHand = setLetterStatus(unlockLetter(byHand, 'М', TODAY), 'М', 'confident', TODAY);
    byHand = skipMissions(byHand, skipOffer(byHand, 'М')!.missions, TODAY);

    const path = (s: ProgressState) => ({
      next: upNext(s),
      unlocked: s.unlocked,
      statuses: Object.fromEntries(s.unlocked.map((l) => [l, s.letters[l]?.status])),
      missions: COURSE_MISSIONS.map((m) => missionAvailability(s, m)),
    });
    expect(path(chosen)).toEqual(path(byHand));
    expect(upNext(chosen)).toBe(findStage('l')!.days[1].missions[0].id);
  });

  it('при знайомстві «Знає» для голосних лише ставить статус, а «Ще не знає» нічого не змінює', () => {
    const fresh = createInitialState(TODAY);
    const s = applyKnownLetters(fresh, { vowels: 'knows', l: 'unknown' }, TODAY);
    for (const l of findStage('vowels')!.letters) expect(s.letters[l]?.status).toBe('knows');
    expect(s.letters.Л?.status).toBe(fresh.letters.Л?.status);
    expect(upNext(s)).toBe('vowels-1');
    expect(COURSE_MISSIONS.some((m) => missionAvailability(s, m) === 'skipped')).toBe(false);
  });

  it('пропуск місії, яку дитина вже проходила до повернення, робить її знову пройденою, а не пропущеною', () => {
    let s = redoStage(reachedS(), 'm', TODAY);
    s = setLetterStatus(s, 'М', 'confident', TODAY);
    s = skipMissions(s, skipOffer(s, 'М')!.missions, TODAY);
    for (const id of ids('m')) expect(missionAvailability(s, findMission(id)!), id).toBe('done');
    expect(s.unlocked).toContain('С');
  });

  it('відкриті букви показуються в порядку курсу, а не за абеткою, і порядок не змінюється після відкриття нової', () => {
    const plan = ['А', 'О', 'У', 'И', 'І', 'Е', 'Л'];
    expect(unlockedInCourseOrder(createInitialState(TODAY))).toEqual(plan);
    let s = unlockLetter(unlockLetter(reachedM(), 'Т', TODAY), 'Б', TODAY);
    expect(unlockedInCourseOrder(s)).toEqual([...plan, 'М', 'Б', 'Т']);
    // Старе збереження з буквами за абеткою - той самий порядок.
    s = normalizeState(JSON.parse(JSON.stringify(s)), TODAY);
    expect(unlockedInCourseOrder(s)).toEqual([...plan, 'М', 'Б', 'Т']);
  });

  it('старе збереження читається як «нічого не пропущено, нічого не повернуто, букви відкриваються самі»', () => {
    const now = reachedS();
    const old = JSON.parse(JSON.stringify(now));
    delete old.skipped;
    delete old.redo;
    delete old.settings.adultOpensLetters;
    const s = normalizeState(old, TODAY);
    expect(s.settings.adultOpensLetters).toBe(false);
    expect(s.missions).toEqual(now.missions);
    expect(s.unlocked).toEqual(now.unlocked);
    expect(COURSE_MISSIONS.map((m) => missionAvailability(s, m))).toEqual(COURSE_MISSIONS.map((m) => missionAvailability(now, m)));
    expect(upNext(s)).toBe(upNext(now));
  });

  it('пошкоджені нові поля відкидаються, а старі ідентифікатори місій переносяться на нинішні', () => {
    const raw = JSON.parse(JSON.stringify(reachedM()));
    raw.skipped = ['w1d4m1', 42, 'нема-такої', 'm-2', 'm-2'];
    raw.redo = 'сміття';
    raw.settings.adultOpensLetters = 'так';
    raw.letters.М = { ...raw.letters.М, status: 'дуже-дуже' };
    const s = normalizeState(raw, TODAY);
    expect(COURSE_MISSIONS.filter((m) => missionAvailability(s, m) === 'skipped').map((m) => m.id)).toEqual(['m-1', 'm-2']);
    // Пошкоджене «пройти ще раз» нічого не повертає: пройдене лишається пройденим.
    expect([...ids('vowels'), ...ids('l')].map((id) => missionAvailability(s, findMission(id)!))).not.toContain('available');
    expect(s.settings.adultOpensLetters).toBe(false);
    expect(s.letters.М?.status).toBe('learning');
    expect(upNext(s)).toBe('m-3');
    // Пропуски, повернення й налаштування переживають збереження.
    const again = normalizeState(JSON.parse(JSON.stringify(updateSettings(redoStage(s, 'l', TODAY), { adultOpensLetters: true }))), TODAY);
    expect(again.settings.adultOpensLetters).toBe(true);
    expect(upNext(again)).toBe('l-1');
  });
});
