import { useMemo, useState, type ReactNode } from 'react';
import { BASE_LETTERS, LETTERS, NOT_YET_STUDIED, PLANNED_LETTERS, UKRAINIAN_ALPHABET, isLetterId, toLower, toUpper, type LetterId } from '../content/alphabet';
import { personalize } from '../content/child';
import { BackupPanel } from '../components/Backup';
import { ChildForm } from '../components/ChildForm';
import type { Mission } from '../content/types';
import { COURSE, COURSE_MISSIONS } from '../content/course';
import { clearReadings, playReading, removeReading, usePendingReadings } from '../audio/readings';
import {
  canRecord,
  deleteRecording,
  hasBuiltinVoice,
  playBuiltinVoice,
  playRecording,
  requestMicrophone,
  saveRecording,
  soundKey,
  startRecording,
  useMicAvailable,
  useOwnRecordingKeys,
} from '../audio/recordings';
import { HELPERS } from '../content/helpers';
import { Helper } from '../components/Helper';
import { ColoredText, Modal } from '../components/ui';
import { adviseNextLetter, missingLetters, missionAvailability } from '../logic/availability';
import { availableSyllables } from '../logic/generate';
import { sayKey, voiceItems } from '../logic/voice';
import {
  LETTER_STATUS_LABEL,
  lockLetter,
  logLetter,
  logReading,
  setLetterStatus,
  suggestStatus,
  todayISO,
  unlockLetter,
  updateSettings,
  type LetterStatus,
  type Settings,
} from '../logic/progress';
import { resetProgress, updateProgress, useChild, useProgress } from '../store/progressStore';
import { plural } from '../components/text';
import type { PendingReading } from '../logic/readingQueue';

type Tab = 'letters' | 'reading' | 'missions' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'letters', label: 'Букви', icon: '🔤' },
  { id: 'reading', label: 'Читання складів', icon: '📖' },
  { id: 'missions', label: 'Місії й прогрес', icon: '🗺️' },
  { id: 'settings', label: 'Налаштування', icon: '⚙️' },
];

interface Props {
  onBack: () => void;
  onStart: (mission: Mission | 'practice') => void;
}

export function Parent({ onBack, onStart }: Props) {
  const pending = usePendingReadings().length;
  const [tab, setTab] = useState<Tab>(pending ? 'reading' : 'letters');
  return (
    <div className="screen parent">
      <header className="parent__header">
        <button type="button" className="text-button text-button--back" onClick={onBack}>
          ← До дитячого режиму
        </button>
        <h1 className="parent__title">Для дорослих</h1>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tabs__tab ${tab === t.id ? 'tabs__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
            {t.id === 'reading' && pending > 0 && (
              <span className="tabs__badge" aria-label={`нових записів: ${pending}`}>
                {pending}
              </span>
            )}
          </button>
        ))}
      </nav>
      <main className="parent__body">
        {tab === 'letters' && <LettersTab />}
        {tab === 'reading' && <ReadingTab />}
        {tab === 'missions' && <MissionsTab onStart={onStart} />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

const STATUSES: LetterStatus[] = ['knows', 'sometimes', 'learning'];

function LettersTab() {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const progress = useProgress();
  const advice = adviseNextLetter(progress);
  const [confirm, setConfirm] = useState<{ letter: LetterId; action: 'unlock' | 'lock' } | null>(null);
  const locked = UKRAINIAN_ALPHABET.filter((l) => !progress.unlocked.includes(l));
  const lockedPlanned = PLANNED_LETTERS.filter((l) => locked.includes(l));
  const lockedOther = locked.filter((l) => !PLANNED_LETTERS.includes(l));

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Букви, які {child.name} вже вчить</h2>
        <p className="panel__hint">
          Позначте, як {child.name} знає кожну букву. Програма лише підказує на основі останніх відповідей - рішення за вами.
        </p>
        <div className="letter-cards">
          {progress.unlocked.map((l) => {
            const lp = progress.letters[l];
            const suggestion = suggestStatus(lp);
            const status = lp?.status ?? 'learning';
            return (
              <article key={l} className={`letter-card letter-card--${status}`}>
                <div className="letter-card__head">
                  <span className={`letter-card__glyph colored__ch--${LETTERS[l].kind}`}>
                    {l}
                    <small>{toLower(l)}</small>
                  </span>
                  <span className="letter-card__sound">{LETTERS[l].sound}</span>
                </div>
                <div className="segmented" role="radiogroup" aria-label={`Статус букви ${l}`}>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={status === s}
                      className={`segmented__item segmented__item--${s} ${status === s ? 'segmented__item--active' : ''}`}
                      onClick={() => updateProgress((st) => setLetterStatus(st, l, s, todayISO()))}
                    >
                      {LETTER_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <p className="letter-card__stats">
                  {lp && lp.seen
                    ? `З першого разу: ${lp.firstTry} з ${lp.seen}. Останні: ${lp.recent.map((r) => (r ? '●' : '○')).join('')}`
                    : 'Ще не траплялася у вправах'}
                </p>
                {suggestion && suggestion !== status && (
                  <button
                    type="button"
                    className="suggestion"
                    onClick={() => updateProgress((st) => setLetterStatus(st, l, suggestion, todayISO()))}
                  >
                    Схоже на «{LETTER_STATUS_LABEL[suggestion]}» - позначити?
                  </button>
                )}
                {!BASE_LETTERS.includes(l) && (
                  <button type="button" className="text-button text-button--small" onClick={() => setConfirm({ letter: l, action: 'lock' })}>
                    Сховати букву
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">Додати наступну букву</h2>
        {advice ? (
          <div className={`advice ${advice.ready ? 'advice--ready' : ''}`}>
            <span className="advice__icon" aria-hidden="true">
              {advice.ready ? '🌟' : '🌱'}
            </span>
            <p>{t(advice.message)}</p>
          </div>
        ) : (
          <p className="panel__hint">Усі букви з місіями відкрито. Далі можна додавати букви, які вчать у школі.</p>
        )}
        {lockedPlanned.length > 0 && (
          <>
            <h3 className="panel__subtitle">Букви з місіями</h3>
            <div className="unlock-grid">
              {lockedPlanned.map((l) => (
                <button key={l} type="button" className="unlock-tile unlock-tile--planned" onClick={() => setConfirm({ letter: l, action: 'unlock' })}>
                  <span className="unlock-tile__glyph">{l}</span>
                  <span className="unlock-tile__label">{l === advice?.letter ? 'наступна' : 'з місіями'}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className="panel__subtitle">Інші букви шкільної програми</h3>
        <p className="panel__hint">
          Для цих букв ще немає окремих місій: вони з’являться в «Повторенні в лісі» разом зі словами, які можна ними прочитати.
        </p>
        <div className="unlock-grid">
          {lockedOther.map((l) => (
            <button
              key={l}
              type="button"
              className={`unlock-tile ${NOT_YET_STUDIED.includes(l) ? 'unlock-tile--later' : ''}`}
              onClick={() => setConfirm({ letter: l, action: 'unlock' })}
            >
              <span className="unlock-tile__glyph">{l}</span>
              {NOT_YET_STUDIED.includes(l) && <span className="unlock-tile__label">ще не вчили</span>}
            </button>
          ))}
        </div>
      </section>

      {confirm && (
        <Modal
          title={confirm.action === 'unlock' ? `Відкрити букву ${confirm.letter}?` : `Сховати букву ${confirm.letter}?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button type="button" className="text-button" onClick={() => setConfirm(null)}>
                Скасувати
              </button>
              <button
                type="button"
                className="big-button big-button--small"
                onClick={() => {
                  const { letter, action } = confirm;
                  updateProgress((s) => (action === 'unlock' ? unlockLetter(s, letter, todayISO()) : lockLetter(s, letter)));
                  setConfirm(null);
                }}
              >
                {confirm.action === 'unlock' ? 'Відкрити' : 'Сховати'}
              </button>
            </>
          }
        >
          {confirm.action === 'unlock' ? (
            <>
              <p>
                Звук {LETTERS[confirm.letter].sound}: {LETTERS[confirm.letter].say}. Буква з’явиться у вправах, а нові місії з нею
                стануть доступними.
              </p>
              {NOT_YET_STUDIED.includes(confirm.letter) && (
                <p className="warning">Цю букву в школі ще не вивчали. {t('Відкривайте, лише якщо {name} вже з нею {знайома|знайомий}.')}</p>
              )}
            </>
          ) : (
            <p>
              Буква зникне з вправ. Прогрес по ній збережеться, і її можна буде відкрити знову тут. Сама гра її більше не відкриє.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function courseSyllables(): string[] {
  const set = new Set<string>();
  for (const m of COURSE_MISSIONS) {
    for (const e of m.exercises) {
      if (e.kind === 'read-syllable') set.add(e.syllable);
      if (e.kind === 'blend') set.add(toLower(e.sounds.join('')));
      if (e.kind === 'match-syllables') e.syllables.forEach((s) => set.add(s));
    }
  }
  return [...set];
}

function ReadingTab() {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const progress = useProgress();
  const items = useMemo(() => {
    const syllables = new Set([...courseSyllables(), ...availableSyllables(progress.unlocked)]);
    const readable = [...syllables].filter((s) => [...s.toLocaleUpperCase('uk-UA')].every((l) => progress.unlocked.includes(l as LetterId)));
    const extra = Object.keys(progress.reading).filter((k) => !syllables.has(k));
    return { syllables: readable.sort((a, b) => a.localeCompare(b, 'uk')), words: extra.sort((a, b) => a.localeCompare(b, 'uk')) };
  }, [progress.unlocked, progress.reading]);

  const row = (text: string) => {
    const log = progress.reading[text];
    const total = (log?.alone ?? 0) + (log?.helped ?? 0);
    const state = !log ? 'new' : log.last === 'alone' ? 'alone' : 'helped';
    return (
      <li key={text} className={`read-row read-row--${state}`}>
        <span className="read-row__text">{text.toLocaleUpperCase('uk-UA')}</span>
        <span className="read-row__stats">
          {total ? (
            <>
              <b>{log!.alone}</b> {t('{сама|сам}')} · <b>{log!.helped}</b> з допомогою
              <small>востаннє: {log!.last === 'alone' ? t('{сама|сам}') : 'з допомогою'}</small>
            </>
          ) : (
            t('ще не {читала|читав}')
          )}
        </span>
        <span className="read-row__actions">
          <button type="button" className="chip chip--alone" onClick={() => updateProgress((s) => logReading(s, text, true, todayISO()))}>
            ⭐ {t('{Сама|Сам}')}
          </button>
          <button type="button" className="chip" onClick={() => updateProgress((s) => logReading(s, text, false, todayISO()))}>
            🤝 Разом
          </button>
        </span>
      </li>
    );
  };

  return (
    <>
      <ReadingReview />
      <section className="panel">
      <h2 className="panel__title">Чи читає {child.name} склади без допомоги</h2>
      <p className="panel__hint">
        Сюди потрапляють ваші відмітки читання: зроблені одразу під час місії кнопками «{t('{Прочитала сама|Прочитав сам}')}» / «Прочитали разом» або
        потім, за записом. Тут можна побачити підсумок і додати відмітку, якщо читали в книжці чи зошиті.
      </p>
      <ul className="read-list">{items.syllables.map(row)}</ul>
      {items.words.length > 0 && (
        <>
          <h3 className="panel__subtitle">Слова</h3>
          <ul className="read-list">{items.words.map(row)}</ul>
        </>
      )}
      </section>
    </>
  );
}

/**
 * Записи того, як дитина читала вголос: дорослий слухає й відмічає, і відмітка йде в журнал читання.
 * Уже зроблені записи лишаються доступними й після вимкнення запису - щоб їх послухати або видалити.
 */
function ReadingReview() {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const { recordReading } = useProgress().settings;
  const items = usePendingReadings();
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length && !recordReading) return null;

  const resolve = async (r: PendingReading, ok?: boolean) => {
    setBusy(r.id);
    try {
      // Спершу видаляємо запис: якщо не вийде, відмітка не задвоїться при повторному натисканні.
      await removeReading(r.id);
      if (ok !== undefined) {
        const day = todayISO(new Date(r.at));
        // Звук букви («Що це за звук?») іде в повторення букв, а склади й слова - в журнал читання.
        updateProgress((s) => (isLetterId(r.text) ? logLetter(s, { id: r.text, firstTry: ok }, day) : logReading(s, r.text, ok, day)));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">{t('Послухайте, як {name} {читала|читав}')}</h2>
      <p className="panel__hint">
        Натисніть ▶ і відмітьте, чи {t('{прочитала|прочитав}')} правильно. Відмітка потрапить у журнал нижче й допоможе вибирати, що повторювати, а запис
        видалиться. Записи зберігаються лише на цьому пристрої.
      </p>
      {items.length ? (
        <ul className="read-list">
          {items.map((r) => (
            <li key={r.id} className="read-row review-row">
              <button type="button" className="review-row__play" onClick={() => void playReading(r.id)} aria-label={`Послухати «${r.text}»`}>
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                  <path d="M6 3.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 6 3.5Z" fill="currentColor" />
                </svg>
              </button>
              <span className="review-row__info">
                <span className="read-row__text">{isLetterId(r.text) ? `звук ${r.text}` : r.text.toLocaleUpperCase('uk-UA')}</span>
                <small className="review-row__when">{formatWhen(r.at)}</small>
              </span>
              <span className="read-row__actions">
                <button type="button" className="chip chip--alone" disabled={busy === r.id} onClick={() => void resolve(r, true)}>
                  ⭐ Правильно
                </button>
                <button type="button" className="chip" disabled={busy === r.id} onClick={() => void resolve(r, false)}>
                  🤝 Ще вчимо
                </button>
                <button
                  type="button"
                  className="chip chip--icon"
                  disabled={busy === r.id}
                  onClick={() => void resolve(r)}
                  aria-label={`Видалити запис «${r.text}» без відмітки`}
                  title="Не чути - видалити без відмітки"
                >
                  🗑
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="review-empty">Нових записів немає. {t('Вони з’являться, коли {name} почитає вголос у місії.')}</p>
      )}
    </section>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const day = todayISO(d);
  if (day === todayISO()) return `сьогодні о ${time}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === todayISO(yesterday)) return `учора о ${time}`;
  return `${formatDate(day)} о ${time}`;
}

function MissionsTab({ onStart }: { onStart: Props['onStart'] }) {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const progress = useProgress();
  const done = COURSE_MISSIONS.filter((m) => progress.missions[m.id]?.completions).length;
  const letterStats = progress.unlocked.map((l) => progress.letters[l]).filter(Boolean);
  const seen = letterStats.reduce((a, l) => a + (l?.seen ?? 0), 0);
  const first = letterStats.reduce((a, l) => a + (l?.firstTry ?? 0), 0);
  const reading = Object.values(progress.reading);
  const alone = reading.reduce((a, r) => a + r.alone, 0);
  const readTotal = reading.reduce((a, r) => a + r.alone + r.helped, 0);

  return (
    <>
      <section className="stats">
        <div className="stat">
          <span className="stat__value">
            {done}
            <small>/{COURSE_MISSIONS.length}</small>
          </span>
          <span className="stat__label">місій пройдено</span>
        </div>
        <div className="stat">
          <span className="stat__value">{seen ? Math.round((first / seen) * 100) : 0}%</span>
          <span className="stat__label">букв упізнано з першого разу</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {alone}
            <small>/{readTotal}</small>
          </span>
          <span className="stat__label">прочитано без допомоги</span>
        </div>
        <div className="stat">
          <span className="stat__value">{progress.stickers.length}</span>
          <span className="stat__label">лісових друзів</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel__row">
          <h2 className="panel__title">Повторити будь-яку місію</h2>
          <button type="button" className="big-button big-button--small" onClick={() => onStart('practice')}>
            🍄 Повторення в лісі
          </button>
        </div>
        <p className="panel__hint">
          Місії не прив’язані до календаря: переходьте далі, коли матеріал дається легко. Якщо підказок було багато, дитячий екран
          сам запропонує повторити.
        </p>
        <div className="day-list">
          {COURSE.map((day) => (
            <article key={day.day} className="day-row">
              <h3 className="day-row__title">
                День {day.day}. {day.title}
              </h3>
              {day.missions.map((m) => {
                const rec = progress.missions[m.id];
                const missing = missingLetters(progress, m);
                const av = missionAvailability(progress, m);
                return (
                  <div key={m.id} className={`mission-row mission-row--${av}`}>
                    <span className="mission-row__icon" aria-hidden="true">
                      {rec ? m.sticker : m.goal === 'learn' ? '🌱' : '🍃'}
                    </span>
                    <span className="mission-row__info">
                      <b>{m.title}</b>
                      <small>
                        {m.goal === 'learn' ? 'вчимося' : 'закріплюємо'} · {m.exercises.length} завдань
                        {rec &&
                          ` · пройдено ${rec.completions} ${plural(rec.completions, 'раз', 'рази', 'разів')}, востаннє ${formatDate(rec.lastCompletedAt)} · підказки ${Math.round(rec.lastHintRate * 100)}%${rec.lastReadTotal ? t(` · {сама прочитала|сам прочитав} ${rec.lastReadAlone}/${rec.lastReadTotal}`) : ''}`}
                      </small>
                    </span>
                    {missing.length ? (
                      <span className="mission-row__need">потрібна {missing.join(', ')}</span>
                    ) : (
                      <button type="button" className="chip chip--go" onClick={() => onStart(m)}>
                        {rec ? 'Повторити' : 'Почати'}
                      </button>
                    )}
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SettingsTab() {
  const child = useChild();
  const progress = useProgress();
  const { settings } = progress;
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch: Partial<Settings>) => updateProgress((s) => updateSettings(s, patch));
  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Дитина</h2>
        <ChildForm initial={child} submitLabel="Зберегти" onSave={(c) => set({ child: c })} />
      </section>

      <section className="panel settings">
        <h2 className="panel__title">Як грається {child.name}</h2>
        <RecordReadingSwitch />
        <Choice
          title="Букви для читання складів і слів"
          hint="Усі великими, як на початку букваря, або як пишеться в книжці (імена з великої)."
          value={settings.readingCase}
          options={[
            ['upper', 'МАМА'],
            ['natural', 'мама, Міла'],
          ]}
          onChange={(readingCase) => set({ readingCase })}
        />
        <Choice
          title="Ліс"
          value={settings.theme}
          options={[
            ['day', '☀️ День'],
            ['night', '🌙 Ніч'],
          ]}
          onChange={(theme) => set({ theme })}
        />
        <label className="switch-row">
          <span>
            <b>Підказка одразу на екрані</b>
            <small>
              Слово вже розділене на склади з дужками (склад - на звуки), і є 🔊, щоб послухати ваш запис. Вимкніть - і все це
              з’являтиметься лише після <span className="nowrap">«💡 Підказка»</span>.
            </small>
          </span>
          <input type="checkbox" checked={settings.openHints} onChange={(e) => set({ openHints: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>
            <b>Звуки натискань</b>
            <small>М’який звук на кожне натискання і дзвіночок за правильну відповідь. Звуків за помилку немає.</small>
          </span>
          <input type="checkbox" checked={settings.sounds} onChange={(e) => set({ sounds: e.target.checked })} />
        </label>
        <div className="switch-row switch-row--column">
          <span>
            <b>Друг у подорожі</b>
          </span>
          <div className="helper-picker helper-picker--inline">
            {HELPERS.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`helper-picker__item ${settings.helper === h.id ? 'helper-picker__item--active' : ''}`}
                onClick={() => set({ helper: h.id })}
              >
                <Helper id={h.id} size={64} />
                <span>{h.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Recordings />
      <SayRecordings />

      <BackupPanel />

      <section className="panel">
        <button type="button" className="text-button text-button--danger" onClick={() => setConfirmReset(true)}>
          Почати спочатку (стерти прогрес)
        </button>
      </section>
      <p className="app-version">Версія {__APP_VERSION__} · {formatWhen(__BUILD_DATE__)}</p>
      {confirmReset && (
        <Modal
          title="Стерти весь прогрес?"
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <button type="button" className="text-button" onClick={() => setConfirmReset(false)}>
                Скасувати
              </button>
              <button
                type="button"
                className="big-button big-button--small big-button--danger"
                onClick={() => {
                  resetProgress();
                  void clearReadings();
                  setConfirmReset(false);
                }}
              >
                Стерти
              </button>
            </>
          }
        >
          <p>Зникнуть пройдені місії, зірочки, наліпки, статуси букв, відмітки й записи читання. Ваш голос для звуків залишиться.</p>
        </Modal>
      )}
    </>
  );
}

/**
 * Єдине налаштування, від якого залежить, хто перевіряє читання вголос: запис чи дорослий поруч.
 * Дорослий вмикає запис - і одразу дає дозвіл на мікрофон, щоб дитина цього питання не бачила.
 */
function RecordReadingSwitch() {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const { recordReading } = useProgress().settings;
  const [error, setError] = useState<string | null>(null);
  const supported = canRecord();
  const available = useMicAvailable();

  const toggle = async (on: boolean) => {
    setError(null);
    if (on && !(await requestMicrophone())) {
      setError('Не вдалося ввімкнути мікрофон. Дозвольте доступ до мікрофона в браузері й спробуйте ще раз.');
      return;
    }
    updateProgress((s) => updateSettings(s, { recordReading: on }));
  };

  return (
    <>
      <label className="switch-row">
        <span>
          <b>Запис читання</b>
          <small>
            Увімкнено - {child.name} читає вголос у 🎙️, а ви слухаєте записи потім на вкладці «Читання складів». Вимкнено - ви сидите поруч і
            відмічаєте одразу: «{t('{Прочитала сама|Прочитав сам}')}» / «Прочитали разом». Записи залишаються лише на цьому пристрої.
          </small>
        </span>
        <input type="checkbox" checked={recordReading && supported} disabled={!supported} onChange={(e) => void toggle(e.target.checked)} />
      </label>
      {!supported && (
        <p className="warning">
          Запис доступний, коли застосунок відкрито через захищене з’єднання (https) або на цьому комп’ютері (localhost). Поки що читання відмічаєте
          ви, одразу.
        </p>
      )}
      {supported && recordReading && !available && !error && (
        <p className="warning">
          Мікрофон заборонений або недоступний, тож поки що читання відмічаєте ви, одразу. Щоб записувати, дозвольте доступ до мікрофона в
          браузері й відкрийте застосунок знову.
        </p>
      )}
      {error && <p className="warning">{error}</p>}
    </>
  );
}

function Choice<T extends string>({
  title,
  hint,
  value,
  options,
  onChange,
}: {
  title: string;
  hint?: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="switch-row switch-row--choice">
      <span>
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      <div className="segmented segmented--compact" role="radiogroup" aria-label={title}>
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`segmented__item ${value === v ? 'segmented__item--active' : ''}`}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface RecItem {
  key: string;
  /** Що показати на плитці (буква, склад чи слово). */
  glyph: ReactNode;
  /** Дрібний підпис під плиткою: як вимовляти. */
  sub?: string;
  /** Для голосових підказок: «звук М», «склад ма». */
  label: string;
}

/** Плитки «записати / послухати / видалити» для голосу дорослого. */
function RecordGrid({ items, maxMs, wide = false }: { items: RecItem[]; maxMs: number; wide?: boolean }) {
  const keys = useOwnRecordingKeys();
  const [recording, setRecording] = useState<{ key: string; stop?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (key: string) => {
    setError(null);
    // Одразу займаємо плитку: поки мікрофон вмикається, другий запис не почнеться.
    setRecording({ key });
    try {
      const r = await startRecording(maxMs);
      setRecording({ key, stop: r.stop });
      const blob = await r.done;
      await saveRecording(key, blob);
      void playRecording(key);
    } catch {
      setError('Не вдалося ввімкнути мікрофон. Дозвольте доступ до мікрофона в браузері.');
    } finally {
      setRecording(null);
    }
  };

  return (
    <>
      {error && <p className="warning">{error}</p>}
      <div className={`rec-grid ${wide ? 'rec-grid--wide' : ''}`}>
        {items.map(({ key, glyph, sub, label }) => {
          const has = keys.has(key);
          const isRec = recording?.key === key;
          return (
            <div key={key} className={`rec-tile ${has ? 'rec-tile--has' : ''} ${isRec ? 'rec-tile--recording' : ''}`}>
              <span className="rec-tile__glyph">{glyph}</span>
              {sub && <span className="rec-tile__sound">{sub}</span>}
              <span className="rec-tile__actions">
                {isRec ? (
                  <button type="button" className="chip chip--rec" disabled={!recording.stop} onClick={() => recording.stop?.()}>
                    ⏹ Стоп
                  </button>
                ) : (
                  <button type="button" className="chip" disabled={!canRecord() || Boolean(recording)} onClick={() => void start(key)} aria-label={`Записати ${label}`}>
                    🎙️
                  </button>
                )}
                {!has && !isRec && hasBuiltinVoice(key) && (
                  <button
                    type="button"
                    className="chip chip--builtin"
                    onClick={() => void playBuiltinVoice(key)}
                    aria-label={`Послухати готовий голос: ${label}`}
                    title="Готовий голос «Стежинки»"
                  >
                    ▶
                  </button>
                )}
                {has && !isRec && (
                  <>
                    <button type="button" className="chip" onClick={() => void playRecording(key)} aria-label={`Послухати ${label}`}>
                      ▶
                    </button>
                    <button type="button" className="chip" onClick={() => void deleteRecording(key)} aria-label={`Видалити запис ${label}`}>
                      🗑
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const HTTPS_WARNING = 'Запис доступний, коли застосунок відкрито через захищене з’єднання (https) або на цьому комп’ютері (localhost).';

/** Букви, для яких дорослий записує голос: відкриті й ті, що чекають у плані. */
function voiceLetters(unlocked: readonly LetterId[]): LetterId[] {
  return UKRAINIAN_ALPHABET.filter((l) => unlocked.includes(l) || PLANNED_LETTERS.includes(l));
}

/** Дорослий записує звуки букв своїм голосом - їх чує дитина у вправах. */
function Recordings() {
  const child = useChild();
  const t = (text: string) => personalize(text, child);
  const progress = useProgress();
  const keys = useOwnRecordingKeys();
  const letters = voiceLetters(progress.unlocked);
  const done = letters.filter((l) => keys.has(soundKey(l))).length;
  const items = letters.map<RecItem>((l) => ({
    key: soundKey(l),
    glyph: <span className={`colored__ch--${LETTERS[l].kind}`}>{l}</span>,
    sub: LETTERS[l].sound,
    label: `звук ${LETTERS[l].sound}`,
  }));

  return (
    <section className="panel">
      <h2 className="panel__title">Ваш голос для звуків</h2>
      <p className="panel__hint">
        {t('Коли {name} грається {сама, вона|сам, він} чує звук букви.')} Де є кнопка ▶ з пунктиром, там уже є готовий голос.
        Хочете, щоб звучав ваш голос, - натисніть 🎙️ і скажіть сам звук (не назву букви): протяжне «м-м-м», коротке «к!».
        Запис зупиниться сам за 2 секунди. Ваших записів: {done} з {letters.length}.
      </p>
      {!canRecord() && <p className="warning">{HTTPS_WARNING}</p>}
      <RecordGrid items={items} maxMs={2500} />
    </section>
  );
}

/** Дорослий читає склади й слова - дитина слухає, як правильно, коли просить підказку. */
function SayRecordings() {
  const child = useChild();
  const progress = useProgress();
  const keys = useOwnRecordingKeys();
  const { syllables, words } = useMemo(() => voiceItems(voiceLetters(progress.unlocked), COURSE_MISSIONS), [progress.unlocked]);
  const count = (list: string[]) => list.filter((t) => keys.has(sayKey(t))).length;
  const tiles = (list: string[], what: string) =>
    list.map<RecItem>((t) => ({
      key: sayKey(t),
      glyph: <ColoredText text={toUpper(t)} />,
      label: `${what} ${t}`,
    }));

  return (
    <section className="panel">
      <h2 className="panel__title">Ваш голос для складів і слів</h2>
      <p className="panel__hint">
        Під словом у вправі є 🔊, а склади можна торкнути - {child.name} почує, як правильно. Де є кнопка ▶ з пунктиром, там уже є готовий
        голос. Щоб звучав ваш, натисніть 🎙️ і читайте чітко й не поспішаючи; склади в слові - злито, без пауз. Запис зупиниться сам за 4
        секунди або кнопкою «Стоп».
      </p>
      {!canRecord() && <p className="warning">{HTTPS_WARNING}</p>}
      <details className="rec-group">
        <summary>
          Склади · ваших записів {count(syllables)} з {syllables.length}
        </summary>
        <RecordGrid items={tiles(syllables, 'склад')} maxMs={4000} />
      </details>
      <details className="rec-group">
        <summary>
          Слова й фрази · ваших записів {count(words)} з {words.length}
        </summary>
        <RecordGrid items={tiles(words, 'слово')} maxMs={4000} wide />
      </details>
    </section>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
}
