/**
 * ПРОТОТИП, не для main: варіанти кнопки запису читання (задача #8).
 * Чотири варіанти на одній сторінці, перемикаються через ?variant= і панель унизу.
 * Поведінка запису однакова для всіх варіантів - відрізняється лише те, як виглядають стани.
 * Де мікрофон доступний (localhost, https) - справжній запис і прослуховування; на телефоні через http - імітація.
 */
import { StrictMode, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito/wght.css';
import '../../styles/base.css';
import '../../styles/components.css';
import '../../styles/exercises.css';
import '../../styles/screens.css';
import '../../styles/play.css';
import './prototype.css';
import { canRecord, playBlob, startRecording } from '../../audio/recordings';
import { Helper } from '../../components/Helper';
import { ColoredText, HintButton } from '../../components/ui';

type Phase = 'idle' | 'starting' | 'recording' | 'hearing' | 'done';

const MAX_MS = 8000;
const MIN_MS = 800;
const TEXT = 'ма';

/** Той самий хід, що в ReadAloud: старт → мікрофон вмикається → запис → дитина чує себе → похвала. */
function useRecorder() {
  const [phase, setPhase] = useState<Phase>('idle');
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const since = useRef(0);
  const real = canRecord();

  const start = useCallback(async () => {
    setPhase('starting');
    if (real) {
      try {
        const rec = await startRecording(MAX_MS);
        stopRef.current = rec.stop;
        since.current = performance.now();
        setPhase('recording');
        const blob = await rec.done;
        stopRef.current = undefined;
        setPhase('hearing');
        await Promise.race([playBlob(blob), new Promise((r) => window.setTimeout(r, MAX_MS + 1000))]);
      } catch {
        // Мікрофон відмовив - у прототипі просто імітуємо.
        await fake();
      }
    } else {
      await fake();
    }
    setPhase('done');
    window.setTimeout(() => setPhase('idle'), 2200);

    async function fake() {
      await wait(1100);
      since.current = performance.now();
      setPhase('recording');
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, MAX_MS);
        stopRef.current = () => {
          window.clearTimeout(t);
          resolve();
        };
      });
      stopRef.current = undefined;
      setPhase('hearing');
      await wait(2600);
    }
  }, [real]);

  const stop = useCallback(() => {
    // Як у ReadAloud: зарано натиснули - зупиняємо, щойно запис триватиме MIN_MS.
    const left = since.current + MIN_MS - performance.now();
    if (left > 0) window.setTimeout(() => stopRef.current?.(), left);
    else stopRef.current?.();
  }, []);

  return { phase, start: () => void start(), stop, real };
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

interface VariantProps {
  phase: Phase;
  onStart: () => void;
  onStop: () => void;
}

/** Картка зі складом - однакова для всіх, щоб кнопку бачити в реальному оточенні. */
function Card({ className = '', children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`read-card proto-card ${className}`}>
      <ColoredText text={TEXT} className="reading-text reading-text--syllable" />
      {children}
    </div>
  );
}

function Tools({ busy }: { busy: boolean }) {
  return (
    <div className="exercise__tools" style={busy ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
      <HintButton onClick={() => {}} />
    </div>
  );
}

const busy = (p: Phase) => p === 'starting' || p === 'recording' || p === 'hearing';

/* ---------- 0. Як зараз ---------- */

function VariantNow({ phase, onStart, onStop }: VariantProps) {
  let button: ReactNode;
  if (phase === 'hearing') {
    button = (
      <button type="button" className="read-aloud read-aloud--busy read-aloud--hearing" disabled>
        <span className="read-aloud__icon" aria-hidden="true">🔊</span>
        Слухаємо
      </button>
    );
  } else if (phase === 'starting' || phase === 'recording') {
    const rec = phase === 'recording';
    button = (
      <button type="button" className={`read-aloud read-aloud--busy read-aloud--recording${rec ? '' : ' read-aloud--starting'}`} onClick={onStop}>
        <span className="read-aloud__dot" aria-hidden="true" />
        {rec ? 'Готово' : 'Слухаю…'}
      </button>
    );
  } else {
    button = (
      <button type="button" className="read-aloud read-aloud--mic" onClick={onStart}>
        <span className="read-aloud__icon" aria-hidden="true">🎙️</span>
        Читаю!
      </button>
    );
  }
  return (
    <div className="exercise">
      <Card />
      <Tools busy={busy(phase)} />
      {button}
    </div>
  );
}

/* ---------- A. Одна кругла кнопка: кожен стан - своя піктограма й колір ---------- */

const A_STATES: Record<Phase, { icon: ReactNode; caption: string; cls: string }> = {
  idle: { icon: '🎙️', caption: 'Натисни й читай уголос', cls: 'mic' },
  done: { icon: '🎙️', caption: 'Натисни й читай уголос', cls: 'mic' },
  starting: { icon: <span className="proto-dots"><i /><i /><i /></span>, caption: 'Зачекай…', cls: 'wait' },
  recording: { icon: <span className="proto-stop" />, caption: 'Читай! Коли все - натисни ■', cls: 'rec' },
  hearing: { icon: '👂', caption: 'Послухай себе', cls: 'hear' },
};

function VariantRound({ phase, onStart, onStop }: VariantProps) {
  const s = A_STATES[phase];
  const click = phase === 'idle' ? onStart : phase === 'recording' ? onStop : undefined;
  return (
    <div className="exercise">
      <Card />
      <Tools busy={busy(phase)} />
      <div className="proto-round-wrap">
        <button type="button" className={`proto-round proto-round--${s.cls}`} onClick={click} disabled={!click && phase !== 'done'}>
          {phase === 'recording' && <span className="proto-ripples" aria-hidden="true"><i /><i /></span>}
          {phase === 'hearing' && <span className="proto-ripples proto-ripples--soft" aria-hidden="true"><i /><i /></span>}
          <span className="proto-round__icon">{s.icon}</span>
        </button>
        <span className={`proto-caption proto-caption--${s.cls}`}>{s.caption}</span>
      </div>
    </div>
  );
}

/* ---------- B. Три кроки: дорослий і дитина бачать увесь шлях і де вони зараз ---------- */

const STEPS = [
  { icon: '🎙️', label: 'Читай' },
  { icon: '⏹️', label: 'Стоп' },
  { icon: '👂', label: 'Послухай' },
];

function stepOf(phase: Phase): number {
  if (phase === 'recording') return 1;
  if (phase === 'hearing') return 2;
  if (phase === 'done') return 3;
  return 0;
}

function VariantSteps({ phase, onStart, onStop }: VariantProps) {
  const step = stepOf(phase);
  let button: ReactNode;
  if (phase === 'idle' || phase === 'done') {
    button = (
      <button type="button" className="read-aloud read-aloud--mic" onClick={onStart}>
        <span className="read-aloud__icon" aria-hidden="true">🎙️</span>
        Читаю!
      </button>
    );
  } else if (phase === 'starting') {
    button = (
      <button type="button" className="read-aloud proto-pill--wait" disabled>
        <span className="proto-dots"><i /><i /><i /></span>
        Зачекай…
      </button>
    );
  } else if (phase === 'recording') {
    button = (
      <button type="button" className="read-aloud read-aloud--recording" onClick={onStop}>
        <span className="proto-stop proto-stop--small" />
        Я все!
      </button>
    );
  } else {
    button = (
      <button type="button" className="read-aloud proto-pill--hear" disabled>
        <span className="proto-bars" aria-hidden="true"><i /><i /><i /><i /></span>
        Слухаємо тебе
      </button>
    );
  }
  return (
    <div className="exercise">
      <Card />
      <Tools busy={busy(phase)} />
      <ol className="proto-steps">
        {STEPS.map((s, i) => (
          <li key={s.label} className={`proto-step ${i === step ? 'proto-step--now' : ''} ${i < step ? 'proto-step--done' : ''}`}>
            <span className="proto-step__icon">{i < step ? '✔︎' : s.icon}</span>
            <span className="proto-step__label">{s.label}</span>
          </li>
        ))}
      </ol>
      {button}
    </div>
  );
}

/* ---------- C. Стан видно на самій картці, лисичка пояснює словами ---------- */

const C_SAY: Record<Phase, string> = {
  idle: 'Прочитай мені склад уголос!',
  done: 'Прочитай мені склад уголос!',
  starting: 'Зачекай, вмикаю мікрофон…',
  recording: 'Я тебе слухаю - читай!',
  hearing: 'А тепер послухай себе!',
};

function VariantCard({ phase, onStart, onStop }: VariantProps) {
  const cardCls = phase === 'recording' ? 'proto-card--rec' : phase === 'hearing' ? 'proto-card--hear' : phase === 'starting' ? 'proto-card--wait' : '';
  return (
    <div className="exercise">
      <div className="proto-fox">
        <Helper id="fox" mood={phase === 'recording' ? 'thinking' : phase === 'hearing' ? 'happy' : 'idle'} size={86} />
        <span className="proto-bubble">{C_SAY[phase]}</span>
      </div>
      <Card className={cardCls}>
        {phase === 'recording' && (
          <span className="proto-badge proto-badge--rec">
            <span className="read-aloud__dot" /> запис
          </span>
        )}
        {phase === 'hearing' && <span className="proto-badge proto-badge--hear">🔊 це ти</span>}
        {(phase === 'recording' || phase === 'hearing') && (
          <span className={`proto-wave ${phase === 'hearing' ? 'proto-wave--hear' : ''}`} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />)}
          </span>
        )}
      </Card>
      <Tools busy={busy(phase)} />
      {phase === 'recording' ? (
        <button type="button" className="read-aloud read-aloud--recording" onClick={onStop}>
          <span className="proto-stop proto-stop--small" />
          Стоп
        </button>
      ) : phase === 'idle' || phase === 'done' ? (
        <button type="button" className="read-aloud read-aloud--mic" onClick={onStart}>
          <span className="read-aloud__icon" aria-hidden="true">🎙️</span>
          Читаю!
        </button>
      ) : (
        // Під час «зачекай» і «послухай себе» кнопки немає зовсім: нічого не натискаємо.
        <div className="proto-no-button" />
      )}
    </div>
  );
}

/* ---------- Перемикач ---------- */

const VARIANTS = [
  { key: '0', name: 'Як зараз', C: VariantNow },
  { key: 'A', name: 'Кругла кнопка', C: VariantRound },
  { key: 'B', name: 'Три кроки', C: VariantSteps },
  { key: 'C', name: 'Стан на картці', C: VariantCard },
];

const GALLERY: { phase: Phase; label: string }[] = [
  { phase: 'idle', label: '1. Почати' },
  { phase: 'starting', label: '2. Мікрофон вмикається' },
  { phase: 'recording', label: '3. Іде запис' },
  { phase: 'hearing', label: '4. Дитина чує себе' },
];

function readVariant(): number {
  const k = new URLSearchParams(location.search).get('variant') ?? '0';
  return Math.max(0, VARIANTS.findIndex((v) => v.key === k));
}

function App() {
  const [i, setI] = useState(readVariant);
  const { phase, start, stop, real } = useRecorder();
  const v = VARIANTS[i];

  const go = useCallback((d: number) => {
    setI((cur) => {
      const next = (cur + d + VARIANTS.length) % VARIANTS.length;
      const url = new URL(location.href);
      url.searchParams.set('variant', VARIANTS[next].key);
      history.replaceState(null, '', url);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="proto">
      <p className="proto-banner">ПРОТОТИП · {real ? 'справжній запис' : 'імітація запису (мікрофон тут недоступний)'}</p>
      <section className="proto-live">
        <v.C phase={phase} onStart={start} onStop={stop} />
        {phase === 'done' && <p className="proto-done">⭐ Тут лисичка хвалить і вправа йде далі</p>}
      </section>

      <h2 className="proto-h">Усі стани поруч</h2>
      <div className="proto-gallery">
        {GALLERY.map((g) => (
          <figure key={g.phase} className="proto-shot">
            <figcaption>{g.label}</figcaption>
            <div className="proto-shot__inner" inert>
              <v.C phase={g.phase} onStart={() => {}} onStop={() => {}} />
            </div>
          </figure>
        ))}
      </div>

      <nav className="proto-switcher">
        <button type="button" onClick={() => go(-1)} aria-label="Попередній варіант">←</button>
        <span>
          {v.key} · {v.name}
        </span>
        <button type="button" onClick={() => go(1)} aria-label="Наступний варіант">→</button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
