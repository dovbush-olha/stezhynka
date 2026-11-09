import { useEffect, useRef, useState } from 'react';
import { saveReading } from '../audio/readings';
import { canRecord, playBlob, startRecording } from '../audio/recordings';
import { useProgress } from '../store/progressStore';
import { SoloReadButton } from './ui';

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

type Phase = 'idle' | 'starting' | 'recording';

/**
 * Дитина грається сама і читає вголос. Якщо запис читання увімкнений (так за замовчуванням),
 * дитина записує себе, одразу чує свій голос, а дорослий послухає й відмітить потім.
 * Без мікрофона - звичайна зірочка «Прочитала!». Так само дитина каже звук букви (`say`).
 */
export function SoloRead({ text, onDone, say = false }: { text: string; onDone: () => void; /** Дитина каже звук букви, а не читає. */ say?: boolean }) {
  const { recordReading } = useProgress().settings;
  const [phase, setPhase] = useState<Phase>('idle');
  const [failed, setFailed] = useState(false);
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

  if (!recordReading || !canRecord() || failed) return <SoloReadButton onDone={onDone} say={say} />;

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
      // Мікрофон заборонений чи зайнятий - не заважаємо читати.
      if (alive.current) setFailed(true);
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
    void playBlob(blob);
    try {
      await saveReading(text, blob);
    } catch {
      // Сховище недоступне - дитина однаково себе почула.
    }
    if (alive.current) onDone();
  };

  if (phase !== 'idle') {
    const recording = phase === 'recording';
    return (
      <button
        type="button"
        className={`solo-read solo-read--recording${recording ? '' : ' solo-read--starting'}`}
        onClick={requestStop}
      >
        <span className="solo-read__dot" aria-hidden="true" />
        {recording ? 'Готово' : 'Слухаю…'}
      </button>
    );
  }

  return (
    <button type="button" className="solo-read solo-read--mic" onClick={() => void start()}>
      <span className="solo-read__star" aria-hidden="true">
        🎙️
      </span>
      {say ? 'Кажу!' : 'Читаю!'}
    </button>
  );
}
