import { useEffect, useRef, useState, type ReactNode } from 'react';
import { saveReading } from '../audio/readings';
import { playBlob, startRecording } from '../audio/recordings';
import { readingCheckInExercise, type ReadingCheck } from '../logic/readingCheck';
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
 * Без запису (вимкнений, мікрофон заборонений) - кнопки дорослого, який сидить поруч.
 * Ті самі кнопки з'являються, якщо запис у цій вправі не вдався: мікрофон відмовив або запис не зберігся.
 * Вправа завершується рівно один раз: або записом, або відміткою.
 */
export function ReadAloud({ text, check, say = false, expected, onRecorded, onMark }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  /** Запис у цій вправі не вдався - її відмічає дорослий. */
  const [failed, setFailed] = useState(false);
  const adult = readingCheckInExercise(check, { failed, captured: phase === 'hearing' }) === 'adult';
  /** Свіже значення для запису, який уже триває: він не має завершити вправу, яку відмічає дорослий. */
  const adultNow = useRef(adult);
  const settled = useRef(false);
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

  useEffect(() => {
    adultNow.current = adult;
    // Перевірка перейшла до дорослого посеред запису: звільняємо мікрофон, запис не потрібен.
    if (!adult) return;
    window.clearTimeout(stopTimer.current);
    stopRef.current?.();
  }, [adult]);

  /** Завершує вправу - лише вперше. */
  const settle = (finish: () => void) => {
    if (settled.current) return;
    settled.current = true;
    finish();
  };

  if (adult) return <ReadingMarks onMark={(alone) => settle(() => onMark(alone))} say={say} expected={expected} />;

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
      // Мікрофон заборонений чи зайнятий - читання в цій вправі відмітить дорослий.
      if (alive.current) setFailed(true);
      return;
    }
    if (!alive.current || adultNow.current) {
      // Поки мікрофон вмикався, з вправи пішли або перевірка перейшла до дорослого: запис не потрібен.
      rec.stop();
      if (alive.current) setFailed(true);
      return;
    }
    stopRef.current = rec.stop;
    recordingSince.current = now();
    setPhase('recording');
    stopWhenReady();
    const blob = await rec.done;
    stopRef.current = undefined;
    if (!alive.current) return;
    if (adultNow.current) {
      // Дорослий перебрав перевірку посеред запису - і вже до кінця вправи, навіть якщо мікрофон повернеться:
      // інакше лишилася б кнопка «Готово» без запису, яка нічого не робить.
      setFailed(true);
      return;
    }
    setPhase('hearing');
    // Сховище може бути недоступне - дитина однаково себе почує, а читання тоді відмітить дорослий.
    const saved = saveReading(text, blob).then(
      () => true,
      () => false,
    );
    // Запас на випадок, якщо телефон так і не скаже, що звук закінчився.
    await Promise.race([playBlob(blob), new Promise((r) => window.setTimeout(r, MAX_MS + 1000))]);
    const kept = await saved;
    if (!alive.current) return;
    // Запис уже зберігся й чекає на дорослого - вправу завершує він, хоч би мікрофон тим часом і відмовив.
    if (kept) settle(onRecorded);
    else setFailed(true);
  };

  if (phase === 'hearing') {
    return (
      <button type="button" className="read-aloud read-aloud--busy read-aloud--hearing" disabled>
        <span className="read-aloud__icon" aria-hidden="true">
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
      <span className="read-aloud__icon" aria-hidden="true">
        🎙️
      </span>
      {say ? 'Кажу!' : 'Читаю!'}
    </button>
  );
}
