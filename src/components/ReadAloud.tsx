import { useEffect, useRef, useState, type ReactNode } from 'react';
import { saveReading } from '../audio/readings';
import { playBlob, startRecording } from '../audio/recordings';
import { readingCheckInExercise, type ReadingCheck } from '../logic/readingCheck';
import { readAloudLook, type ReadAloudIcon, type ReadAloudPhase } from './readAloudLook';
import { ReadingMarks } from './ui';

/** Найдовше читання - коротка фраза по складах. */
const MAX_MS = 8000;
/**
 * Два швидкі дотики - це ще не читання: дотик до «стоп» раніше, ніж за стільки після дотику до мікрофона,
 * ігноруємо, а пізніший дотик зупиняє запис не раніше, ніж він триватиме стільки.
 */
const MIN_MS = 800;

/** Скільки ще чекати, поки від `since` мине MIN_MS (від'ємне - уже минуло). */
const untilMin = (since: number) => since + MIN_MS - performance.now();
const now = () => performance.now();

/** Піктограми круглої кнопки: мікрофон, «зачекай», «стоп», вушко. */
const ICONS: Record<ReadAloudIcon, ReactNode> = {
  mic: '🎙️',
  wait: (
    <span className="read-aloud__dots">
      <i />
      <i />
      <i />
    </span>
  ),
  stop: <span className="read-aloud__stop" />,
  ear: '👂',
};

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
  const [phase, setPhase] = useState<ReadAloudPhase>('idle');
  /** Запис у цій вправі не вдався - її відмічає дорослий. */
  const [failed, setFailed] = useState(false);
  const adult = readingCheckInExercise(check, { failed, captured: phase === 'hearing' }) === 'adult';
  /** Свіже значення для запису, який уже триває: він не має завершити вправу, яку відмічає дорослий. */
  const adultNow = useRef(adult);
  const settled = useRef(false);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  /** Коли дитина натиснула мікрофон і коли мікрофон справді почав писати. */
  const tappedAt = useRef(0);
  const recordingSince = useRef(0);
  /** Дитина вже натиснула «стоп», а запис ще закороткий: зупинимо, щойно він стане достатньо довгим. */
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
    if (!stopRef.current) return;
    const wait = untilMin(recordingSince.current);
    if (wait > 0) stopTimer.current = window.setTimeout(stopWhenReady, wait);
    else stopRef.current();
  };

  const requestStop = () => {
    if (untilMin(tappedAt.current) > 0) return;
    stopWhenReady();
  };

  const start = async () => {
    // Відповідаємо на дотик одразу: на телефоні мікрофон вмикається до секунди-двох.
    tappedAt.current = now();
    // «Стоп» від попереднього запису не має зупинити новий.
    window.clearTimeout(stopTimer.current);
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
    const blob = await rec.done;
    stopRef.current = undefined;
    if (!alive.current) return;
    if (adultNow.current) {
      // Дорослий перебрав перевірку посеред запису - і вже до кінця вправи, навіть якщо мікрофон повернеться:
      // інакше лишилася б кнопка «стоп» без запису, яка нічого не робить.
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

  const look = readAloudLook(phase, say);
  const onPress = look.action === 'start' ? () => void start() : look.action === 'stop' ? requestStop : undefined;
  return (
    <div className={`read-aloud${phase === 'idle' ? '' : ' read-aloud--busy'}`}>
      <button
        type="button"
        className={`read-aloud__button read-aloud__button--${look.icon}`}
        onClick={onPress}
        // Не `disabled`: вимкнена кнопка втрачає вибір клавіатурою, а ця лише чекає й нічого не робить.
        aria-disabled={!look.action}
        aria-label={look.label}
      >
        {/* Хвилі видно лише під час запису й прослуховування - так вирішують стилі. */}
        <span className="read-aloud__ripples" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="read-aloud__icon" aria-hidden="true">
          {ICONS[look.icon]}
        </span>
      </button>
      <span className={`read-aloud__caption read-aloud__caption--${look.icon}`} aria-hidden="true">
        {look.caption}
      </span>
    </div>
  );
}
