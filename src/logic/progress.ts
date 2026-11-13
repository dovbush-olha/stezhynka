import { BASE_LETTERS, PLANNED_LETTERS, UKRAINIAN_ALPHABET, isLetterId, lettersOf, type LetterId } from '../content/alphabet';
import { LEGACY_CHILD, isChild, type Child } from '../content/child';
import { isHelperId, type HelperId } from '../content/helpers';
import type { Mission } from '../content/types';
import { COURSE_MISSIONS, LEGACY_MISSION_IDS, previousStage, stageOfMission } from '../content/course';
import type { ItemOutcome } from './review';
import { nextReview, type ReviewItem } from './srs';

/** «Знає впевнено» ставить лише дорослий: програма його ніколи не пропонує. */
export type LetterStatus = 'confident' | 'knows' | 'sometimes' | 'learning';

export const LETTER_STATUSES: readonly LetterStatus[] = ['confident', 'knows', 'sometimes', 'learning'];

const isLetterStatus = (v: unknown): v is LetterStatus => LETTER_STATUSES.includes(v as LetterStatus);

export const LETTER_STATUS_LABEL: Record<LetterStatus, string> = {
  confident: 'Знає впевнено',
  knows: 'Знає',
  sometimes: 'Іноді забуває',
  learning: 'Ще вчить',
};

export interface LetterProgress extends ReviewItem {
  status: LetterStatus;
  seen: number;
  firstTry: number;
  /** Останні результати: true - з першої спроби. */
  recent: boolean[];
}

export interface ReadingLog {
  alone: number;
  helped: number;
  last?: 'alone' | 'helped';
  lastAt?: string;
}

export interface MissionRecord {
  completions: number;
  lastCompletedAt: string;
  /** Частка вправ, де знадобилася підказка, в останньому проходженні. */
  lastHintRate: number;
  lastReadAlone: number;
  lastReadTotal: number;
}

export interface Settings {
  /** Тихі звуки натискань і дзвіночок за правильну відповідь. */
  sounds: boolean;
  /** Склади й слова: усі великими (МАМА) чи як у книжці (Мама). */
  readingCase: 'upper' | 'natural';
  theme: 'day' | 'night';
  helper: HelperId;
  /**
   * Читання вголос записується, щоб дорослий потім послухав і відмітив.
   * Вимкнено - дорослий сидить поруч і відмічає одразу (див. `readingCheck`).
   */
  recordReading: boolean;
  /** Склади з дужками й кнопка 🔊 видно одразу; вимкнено - лише після «Підказка». */
  openHints: boolean;
  /**
   * Нова буква плану не відкривається сама після останньої місії попередньої:
   * дорослий спершу відповідає, чи дитина вже знає попередню.
   */
  adultOpensLetters: boolean;
  /** Хто грається. null - ще не знайомилися: застосунок спершу спитає ім'я. */
  child: Child | null;
}

export const DEFAULT_SETTINGS: Settings = {
  sounds: true,
  readingCase: 'upper',
  theme: 'day',
  helper: 'fox',
  recordReading: true,
  openHints: true,
  adultOpensLetters: false,
  child: null,
};

function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    sounds: typeof r.sounds === 'boolean' ? r.sounds : d.sounds,
    readingCase: r.readingCase === 'natural' || r.readingCase === 'upper' ? r.readingCase : d.readingCase,
    theme: r.theme === 'night' || r.theme === 'day' ? r.theme : d.theme,
    helper: isHelperId(r.helper) ? r.helper : d.helper,
    // Раніше був ще вибір режиму. «З дорослим» читання відмічав дорослий поруч - це і є «без запису»;
    // мікрофон у такому режимі не вмикався, тож і після оновлення застосунок сам його не попросить.
    recordReading: r.mode !== 'together' && (typeof r.recordReading === 'boolean' ? r.recordReading : d.recordReading),
    openHints: typeof r.openHints === 'boolean' ? r.openHints : d.openHints,
    adultOpensLetters: typeof r.adultOpensLetters === 'boolean' ? r.adultOpensLetters : d.adultOpensLetters,
    // Збережений прогрес без поля child - з часів, коли застосунок був лише для Майї.
    child: isChild(r.child) ? r.child : 'child' in r ? null : LEGACY_CHILD,
  };
}

export interface ProgressState {
  version: 1;
  unlocked: LetterId[];
  /**
   * Букви з плану, які програма вже відкривала сама або які дорослий сховав.
   * Їх програма сама більше не відкриває, щоб не перекрити рішення дорослого.
   */
  autoUnlocked: LetterId[];
  letters: Partial<Record<LetterId, LetterProgress>>;
  reading: Record<string, ReadingLog>;
  /** Інтервальне повторення складів і слів, як у букв. Ключ - текст з контенту («ма», «Лола»). */
  review: Record<string, ReviewItem>;
  /** Скільки нових місій пройдено після останнього «Повторення в лісі». */
  sinceReview: number;
  /** Записи про проходження: лише додаються, «Пройти букву ще раз» їх не стирає. */
  missions: Record<string, MissionRecord>;
  /**
   * Місії, які дорослий пропустив, бо дитина букву вже знає. Для шляху вони рахуються пройденими,
   * але наліпки за них немає, доки дитина справді їх не пройде.
   */
  skipped: string[];
  /** Пройдені місії, які дорослий повернув у чергу («Пройти букву ще раз»); знімається, коли місію пройдено знову. */
  redo: string[];
  stickers: string[];
  /** Зірочки за кожне виконане завдання. Лише додаються, ніколи не забираються. */
  stars: number;
  settings: Settings;
}

export interface LetterOutcome {
  id: LetterId;
  firstTry: boolean;
}

export interface ReadingOutcome {
  text: string;
  alone: boolean;
}

export interface ExerciseResult {
  hinted: boolean;
  /** Ознайомчі екрани не враховуються в частці підказок. */
  unscored?: boolean;
  letters?: LetterOutcome[];
  /** Відмітка читання. Записуємо лише перевірене: дорослим (одразу чи потім, за записом) або вибором картинки. */
  reading?: ReadingOutcome;
  /** Склади й слова, які тренувала вправа (для інтервального повторення). */
  items?: ItemOutcome[];
}

const RECENT_WINDOW = 6;

/** Ідентифікатор «Повторення в лісі»: місія складається щоразу заново. */
export const PRACTICE_ID = 'practice';

export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function freshLetter(status: LetterStatus, today: string): LetterProgress {
  return { status, seen: 0, firstTry: 0, recent: [], box: 1, due: today };
}

export function createInitialState(today = todayISO()): ProgressState {
  const letters: ProgressState['letters'] = {};
  const partlyKnown: LetterId[] = ['А', 'О', 'У', 'І'];
  for (const l of BASE_LETTERS) letters[l] = freshLetter(partlyKnown.includes(l) ? 'sometimes' : 'learning', today);
  return {
    version: 1,
    unlocked: [...BASE_LETTERS],
    autoUnlocked: [],
    letters,
    reading: {},
    review: {},
    sinceReview: 0,
    missions: {},
    skipped: [],
    redo: [],
    stickers: [],
    stars: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Відновлює стан із localStorage, терпимо до пошкоджених або старих даних. */
export function normalizeState(raw: unknown, today = todayISO()): ProgressState {
  const base = createInitialState(today);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ProgressState>;
  if (r.version !== 1) return base;

  const unlocked = new Set<LetterId>(BASE_LETTERS);
  for (const l of Array.isArray(r.unlocked) ? r.unlocked : []) if (isLetterId(l)) unlocked.add(l);

  const letters: ProgressState['letters'] = { ...base.letters };
  if (r.letters && typeof r.letters === 'object') {
    for (const [k, v] of Object.entries(r.letters)) {
      if (!isLetterId(k) || !v || typeof v !== 'object') continue;
      const lp = v as Partial<LetterProgress>;
      letters[k] = {
        ...freshLetter('learning', today),
        ...lp,
        status: isLetterStatus(lp.status) ? lp.status : 'learning',
        recent: Array.isArray(lp.recent) ? lp.recent.slice(-RECENT_WINDOW) : [],
      };
    }
  }

  // Прогрес, збережений до автоматичного відкриття букв, теж одразу доходить до наступного дня.
  return autoUnlockLetters(
    {
      version: 1,
      unlocked: UKRAINIAN_ALPHABET.filter((l) => unlocked.has(l)),
      autoUnlocked: Array.isArray(r.autoUnlocked) ? r.autoUnlocked.filter(isLetterId) : [],
      letters,
      reading: r.reading && typeof r.reading === 'object' ? r.reading : {},
      review: normalizeReview(r.review),
      sinceReview: typeof r.sinceReview === 'number' && r.sinceReview >= 0 ? Math.floor(r.sinceReview) : 0,
      missions: normalizeMissions(r.missions),
      skipped: normalizeMissionIds(r.skipped),
      redo: normalizeMissionIds(r.redo),
      stickers: Array.isArray(r.stickers) ? r.stickers : [],
      stars: typeof r.stars === 'number' && r.stars >= 0 ? Math.floor(r.stars) : 0,
      settings: normalizeSettings(r.settings),
    },
    today,
  );
}

/** Прогрес зі старими ідентифікаторами місій переносимо на нинішні; нинішній запис важливіший. */
function normalizeMissions(raw: unknown): Record<string, MissionRecord> {
  const missions: Record<string, MissionRecord> = {};
  if (!raw || typeof raw !== 'object') return missions;
  for (const [id, record] of Object.entries(raw as Record<string, MissionRecord>)) {
    const current = LEGACY_MISSION_IDS[id];
    if (!current) missions[id] = record;
    else if (!(current in (raw as object))) missions[current] = record;
  }
  return missions;
}

/** Список місій зі збереження: лише наявні в плані, старі ідентифікатори - на нинішні. */
function normalizeMissionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((id): id is string => typeof id === 'string')
    .map((id) => LEGACY_MISSION_IDS[id] ?? id)
    .filter((id) => COURSE_MISSIONS.some((m) => m.id === id));
  return [...new Set(ids)];
}

function normalizeReview(raw: unknown): Record<string, ReviewItem> {
  const review: Record<string, ReviewItem> = {};
  if (!raw || typeof raw !== 'object') return review;
  for (const [text, v] of Object.entries(raw)) {
    const item = v as Partial<ReviewItem> | null;
    if (!item || typeof item.box !== 'number' || typeof item.due !== 'string') continue;
    try {
      if (!lettersOf(text).length) continue;
    } catch {
      continue;
    }
    review[text] = { box: item.box, due: item.due, promotedAt: typeof item.promotedAt === 'string' ? item.promotedAt : undefined };
  }
  return review;
}

function letterOf(state: ProgressState, id: LetterId, today: string): LetterProgress {
  return state.letters[id] ?? freshLetter('learning', today);
}

export function applyExerciseResult(state: ProgressState, result: ExerciseResult, today = todayISO()): ProgressState {
  let next: ProgressState = { ...state, stars: state.stars + 1 };
  for (const o of result.letters ?? []) next = logLetter(next, o, today);
  if (result.items?.length) {
    const review = { ...next.review };
    for (const o of result.items) review[o.text] = nextReview(review[o.text] ?? { box: 1, due: today }, o.firstTry, today);
    next = { ...next, review };
  }
  if (result.reading) next = logReading(next, result.reading.text, result.reading.alone, today);
  return next;
}

/** Одна відповідь про букву: оновлює статистику й інтервал повторення. */
export function logLetter(state: ProgressState, o: LetterOutcome, today = todayISO()): ProgressState {
  const cur = letterOf(state, o.id, today);
  const review = nextReview(cur, o.firstTry, today);
  const updated: LetterProgress = {
    ...cur,
    ...review,
    seen: cur.seen + 1,
    firstTry: cur.firstTry + (o.firstTry ? 1 : 0),
    recent: [...cur.recent, o.firstTry].slice(-RECENT_WINDOW),
  };
  return { ...state, letters: { ...state.letters, [o.id]: updated } };
}

export function logReading(state: ProgressState, text: string, alone: boolean, today = todayISO()): ProgressState {
  const key = text.toLocaleLowerCase('uk-UA');
  const cur = state.reading[key] ?? { alone: 0, helped: 0 };
  return {
    ...state,
    reading: {
      ...state.reading,
      [key]: {
        alone: cur.alone + (alone ? 1 : 0),
        helped: cur.helped + (alone ? 0 : 1),
        last: alone ? 'alone' : 'helped',
        lastAt: today,
      },
    },
  };
}

export interface MissionSummary {
  missionId: string;
  sticker: string;
  scored: number;
  hinted: number;
  readAlone: number;
  readTotal: number;
}

export function completeMission(state: ProgressState, s: MissionSummary, today = todayISO()): ProgressState {
  const prev = state.missions[s.missionId];
  const wasDone = isMissionDone(state, s.missionId);
  return autoUnlockLetters(
    {
      ...state,
      missions: {
        ...state.missions,
        [s.missionId]: {
          completions: (prev?.completions ?? 0) + 1,
          lastCompletedAt: today,
          lastHintRate: s.scored ? s.hinted / s.scored : 0,
          lastReadAlone: s.readAlone,
          lastReadTotal: s.readTotal,
        },
      },
      // Пройдена пропущена чи повернута місія стає звичайною пройденою.
      skipped: without(state.skipped, s.missionId),
      redo: without(state.redo, s.missionId),
      stickers: state.stickers.includes(s.sticker) ? state.stickers : [...state.stickers, s.sticker],
      // Повторна місія сама вже повторення - рахуємо лише нові для шляху.
      sinceReview: s.missionId === PRACTICE_ID ? 0 : state.sinceReview + (wasDone ? 0 : 1),
    },
    today,
  );
}

const without = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : list);

export type MissionState = 'done' | 'skipped' | 'pending';

/** Пройдена, пропущена дорослим чи ще в черзі (зокрема повернута «Пройти букву ще раз»). */
export function missionState(state: ProgressState, id: string): MissionState {
  if (state.skipped.includes(id)) return 'skipped';
  if (isMissionEarned(state, id) && !state.redo.includes(id)) return 'done';
  return 'pending';
}

/** Дорослий позначив букву «Знає впевнено»: на неї вже не варто витрачати час. */
export function isConfident(state: ProgressState, l: LetterId): boolean {
  return state.letters[l]?.status === 'confident';
}

/** Дорослий позначив, що дитина знає букву: «Знає» чи «Знає впевнено». */
export function isKnownByAdult(state: ProgressState, l: LetterId): boolean {
  const status = state.letters[l]?.status;
  return status === 'knows' || status === 'confident';
}

/** Дитина хоч раз пройшла місію сама. Зароблене не забирається: повернення в чергу цього не змінює. */
export function isMissionEarned(state: ProgressState, id: string): boolean {
  return Boolean(state.missions[id]?.completions);
}

/** Для черги місій і відкриття букв пропущена місія - те саме, що пройдена. */
export function isMissionDone(state: ProgressState, id: string): boolean {
  return missionState(state, id) !== 'pending';
}

export function nextMission(state: ProgressState, missions: Mission[] = COURSE_MISSIONS): Mission | undefined {
  return missions.find((m) => !isMissionDone(state, m.id));
}

/**
 * Букви з плану (М, С, Н, К), яких бракує наступній місії, коли всі місії до неї пройдено.
 * Букву, яку дорослий сховав, не повертаємо: її відкриває лише він.
 */
export function lettersReadyToOpen(state: ProgressState, missions: Mission[] = COURSE_MISSIONS): LetterId[] {
  const next = nextMission(state, missions);
  if (!next) return [];
  const missing = next.requires.filter((l) => !state.unlocked.includes(l));
  return missing.every((l) => PLANNED_LETTERS.includes(l) && !state.autoUnlocked.includes(l)) ? missing : [];
}

/**
 * Дорослий уже позначив «Знає впевнено» всі букви етапу перед місією, до якої дійшла дитина.
 * Це й є відповідь на питання «Чи вже знає букву?», тож питати вдруге не треба.
 */
export function previousLettersConfident(state: ProgressState, missions: Mission[] = COURSE_MISSIONS): boolean {
  const next = nextMission(state, missions);
  const stage = next && stageOfMission(next.id);
  const previous = stage && previousStage(stage);
  return Boolean(previous?.letters.every((l) => isConfident(state, l)));
}

/**
 * Програма сама відкриває букву, до якої дійшла дитина (див. `lettersReadyToOpen`),
 * якщо дорослий не вирішив відкривати нові букви сам
 * або вже відповів, що попередні букви дитина знає впевнено.
 */
export function autoUnlockLetters(state: ProgressState, today = todayISO(), missions: Mission[] = COURSE_MISSIONS): ProgressState {
  if (state.settings.adultOpensLetters && !previousLettersConfident(state, missions)) return state;
  const ready = lettersReadyToOpen(state, missions);
  if (!ready.length) return state;
  let s = state;
  for (const l of ready) s = unlockLetter(s, l, today);
  return { ...s, autoUnlocked: [...s.autoUnlocked, ...ready] };
}

/** Статус ставить дорослий; «Знає впевнено» для букв, після яких чекає нова буква, її й відкриває. */
export function setLetterStatus(state: ProgressState, id: LetterId, status: LetterStatus, today = todayISO()): ProgressState {
  return autoUnlockLetters({ ...state, letters: { ...state.letters, [id]: { ...letterOf(state, id, today), status } } }, today);
}

export function unlockLetter(state: ProgressState, id: LetterId, today = todayISO()): ProgressState {
  if (state.unlocked.includes(id)) return state;
  const unlocked = UKRAINIAN_ALPHABET.filter((l) => l === id || state.unlocked.includes(l));
  return {
    ...state,
    unlocked,
    letters: { ...state.letters, [id]: state.letters[id] ?? freshLetter('learning', today) },
  };
}

export function lockLetter(state: ProgressState, id: LetterId): ProgressState {
  if (BASE_LETTERS.includes(id)) return state;
  return {
    ...state,
    unlocked: state.unlocked.filter((l) => l !== id),
    autoUnlocked: state.autoUnlocked.includes(id) ? state.autoUnlocked : [...state.autoUnlocked, id],
  };
}

export function updateSettings(state: ProgressState, patch: Partial<Settings>): ProgressState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** Порада для дорослого щодо статусу букви на основі останніх відповідей. */
export function suggestStatus(lp: LetterProgress | undefined): LetterStatus | undefined {
  if (!lp || lp.recent.length < 4) return undefined;
  const ok = lp.recent.filter(Boolean).length;
  const ratio = ok / lp.recent.length;
  // «Знає впевнено» ставить лише дорослий, і знижувати його до «Знає» за самими лише вдалими відповідями не радимо.
  if (ratio >= 0.85) return lp.status === 'confident' ? undefined : 'knows';
  if (ratio >= 0.5) return 'sometimes';
  return 'learning';
}
