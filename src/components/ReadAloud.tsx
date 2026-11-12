import { useEffect, useRef, useState, type ReactNode } from 'react';
import { saveReading } from '../audio/readings';
import { playBlob, startRecording } from '../audio/recordings';
import type { ReadingCheck } from '../logic/readingCheck';
import { ReadingMarks } from './ui';

/** Найдовше читання - коротка фраза по складах. */
const MAX_MS = 8000;
/**
 * Два швидкі дотики - це ще не читання: дотик до «Готово» раніше, ніж за стільки після «Читаю!»,
 * ігноруємо, а пізніший дотик зупиняє запис не раніше, ніж він триватиме стільки.
 */
const MIN_MS = 800;

/** Скільки ще чекати, поки від `since` мине MIN_MS (від'ємне - уже минуло). */
const untilMin = (since: number) => since + MIN_MS - performance.now();
const now = () => performance.now();

type Phase = 'idle' | 'starting' | 'recording' | 'hearing';

interface Props {
  text: string;
  /** Хто перевіряє: запис, який дорослий послухає потім, чи дорослий поруч. */
  check: ReadingCheck;
  /** Дитина каже звук букви, а не читає. */
  say?: boolean;
  /** Дорослому, який відмічає одразу: що має прозвучати. */
  expected?: ReactNode;
  /** Читання записано й чекає на дорослого: відмітки ще немає. */
  onRecorded: () => void;
  /** Дорослий поруч відмітив, як вийшло. */
  onMark: (alone: boolean) => void;
}

/**
 * Дитина читає вголос (або каже звук букви - `say`), і це завжди хтось перевіряє.
 * Із записом дитина записує себе, одразу чує свій голос до кінця, а дорослий послухає й відмітить потім.
 * Похвала й «як правильно» звучать лише після того, як дитина почула себе: інакше вони перебивають її голос.
 * Без запису (вимкнений, мікрофон заборонений чи відмовив посеред місії) - кнопки дорослого, який сидить поруч.
 */
export function ReadAloud({ text, check, say = false, expected, onRecorded, onMark }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const stopRef = useRef<(() => void) | undefined>(undefined);
  /** Коли дитина натиснула «Читаю!» і коли мікрофон справді почав писати. */
  const tappedAt = useRef(0);
  const recordingSince = useRef(0);
  /** Дитина вже натиснула «Готово», а мікрофон ще вмикався чи запис ще закороткий. */
  const stopWanted = useRef(false);
  const stopTimer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      // Пішли з вправи посеред запису: звільняємо мікрофон і нічого не зберігаємо.
      alive.current = false;
      window.clearTimeout(stopTimer.current);
      stopRef.current?.();
    };
  }, []);

  if (check === 'adult') return <ReadingMarks onMark={onMark} say={say} expected={expected} />;

  /** Зупиняє запис, щойно він триває щонайменше MIN_MS. */
  const stopWhenReady = () => {
    window.clearTimeout(stopTimer.current);
    if (!stopWanted.current || !stopRef.current) return;
    const wait = untilMin(recordingSince.current);
    if (wait > 0) stopTimer.current = window.setTimeout(stopWhenReady, wait);
    else stopRef.current();
  };

  const requestStop = () => {
    if (untilMin(tappedAt.current) > 0) return;
    stopWanted.current = true;
    stopWhenReady();
  };

  const start = async () => {
    // Відповідаємо на дотик одразу: на телефоні мікрофон вмикається до секунди-двох.
    tappedAt.current = now();
    stopWanted.current = false;
    setPhase('starting');
    let rec: Awaited<ReturnType<typeof startRecording>>;
    try {
      rec = await startRecording(MAX_MS);
    } catch {
      // Мікрофон заборонений чи зайнятий: він тепер позначений недоступним, тож читання відмітить дорослий.
      if (alive.current) setPhase('idle');
      return;
    }
    if (!alive.current) {
      rec.stop();
      return;
    }
    stopRef.current = rec.stop;
    recordingSince.current = now();
    setPhase('recording');
    stopWhenReady();
    const blob = await rec.done;
    stopRef.current = undefined;
    if (!alive.current) return;
    setPhase('hearing');
    const saved = saveReading(text, blob).catch(() => {
      // Сховище недоступне - дитина однаково себе почує.
    });
    // Запас на випадок, якщо телефон так і не скаже, що звук закінчився.
    await Promise.race([playBlob(blob), new Promise((r) => window.setTimeout(r, MAX_MS + 1000))]);
    await saved;
    if (alive.current) onRecorded();
  };

  if (phase === 'hearing') {
    return (
      <button type="button" className="read-aloud read-aloud--busy read-aloud--hearing" disabled>
        <span className="read-aloud__star" aria-hidden="true">
          🔊
        </span>
        Слухаємо
      </button>
    );
  }

  if (phase !== 'idle') {
    const recording = phase === 'recording';
    return (
      <button
        type="button"
        className={`read-aloud read-aloud--busy read-aloud--recording${recording ? '' : ' read-aloud--starting'}`}
        onClick={requestStop}
      >
        <span className="read-aloud__dot" aria-hidden="true" />
        {recording ? 'Готово' : 'Слухаю…'}
      </button>
    );
  }

  return (
    <button type="button" className="read-aloud read-aloud--mic" onClick={() => void start()}>
      <span className="read-aloud__star" aria-hidden="true">
        🎙️
      </span>
      {say ? 'Кажу!' : 'Читаю!'}
    </button>
  );
}
