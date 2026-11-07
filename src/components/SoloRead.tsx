import { useEffect, useRef, useState } from 'react';
import { saveReading } from '../audio/readings';
import { canRecord, playBlob, startRecording } from '../audio/recordings';
import { useProgress } from '../store/progressStore';
import { SoloReadButton } from './ui';

/** Найдовше читання - коротка фраза по складах. */
const MAX_MS = 8000;
/** «Готово» стає доступною не одразу: два швидкі дотики - це ще не читання. */
const MIN_MS = 800;

type Phase = 'idle' | 'starting' | 'recording';

/**
 * Дитина грається сама і читає вголос. Якщо дорослий увімкнув запис читання,
 * дитина записує себе, одразу чує свій голос, а дорослий послухає й відмітить потім.
 * Без мікрофона - звичайна зірочка «Прочитала!». Так само дитина каже звук букви (`say`).
 */
export function SoloRead({ text, onDone, say = false }: { text: string; onDone: () => void; /** Дитина каже звук букви, а не читає. */ say?: boolean }) {
  const { recordReading } = useProgress().settings;
  const [phase, setPhase] = useState<Phase>('idle');
  const [failed, setFailed] = useState(false);
  const [canStop, setCanStop] = useState(false);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      // Пішли з вправи посеред запису: звільняємо мікрофон і нічого не зберігаємо.
      alive.current = false;
      stopRef.current?.();
    };
  }, []);

  if (!recordReading || !canRecord() || failed) return <SoloReadButton onDone={onDone} say={say} />;

  const start = async () => {
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
    setPhase('recording');
    setCanStop(false);
    window.setTimeout(() => alive.current && setCanStop(true), MIN_MS);
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

  if (phase === 'recording') {
    return (
      <button type="button" className="solo-read solo-read--recording" onClick={() => stopRef.current?.()} disabled={!canStop}>
        <span className="solo-read__dot" aria-hidden="true" />
        Готово
      </button>
    );
  }

  return (
    <button type="button" className="solo-read solo-read--mic" onClick={() => void start()} disabled={phase === 'starting'}>
      <span className="solo-read__star" aria-hidden="true">
        🎙️
      </span>
      {say ? 'Кажу!' : 'Читаю!'}
    </button>
  );
}
