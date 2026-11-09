import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { LETTERS, toLower, type LetterId } from '../../content/alphabet';
import { HINTS, PRAISE, PRAISE_READING_ALONE, PRAISE_READING_TOGETHER, pick } from '../../content/phrases';
import type { BlendExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording, soundKey } from '../../audio/recordings';
import { sayKey } from '../../logic/voice';
import { SoloRead } from '../SoloRead';
import { ReadingMarks, SayButton } from '../ui';
import { caseText, glide } from '../text';
import { Syllable } from './SyllableSplit';
import type { ExerciseProps } from './types';

type Phase = 'idle' | 'drag' | 'auto' | 'done';

/** Кулька майже біля другої букви - звуки злилися. */
const DONE_AT = 0.9;
/** Скільки пікселів треба провести, щоб це був рух пальчиком, а не дотик. */
const TAP_SLOP = 10;
/** Дотик без руху: кулька їде сама, повільно, щоб звук устиг протягнутися. */
const AUTO_MS = 1600;

/**
 * З'єднай два звуки: дитина веде кульку пальчиком від першої букви до другої
 * і весь цей час тягне перший звук - «л-л-л…» - аж поки кулька не доїде до «а».
 * Букви не натискаються окремо: окремі дотики вчать читати «л… а…», а треба злито.
 * Просто торкнутися першої букви теж можна - тоді кулька поїде сама.
 */
export function Blend({ exercise, readingCase, solo, completed, onFeedback, onComplete }: ExerciseProps<BlendExercise>) {
  const [a, b] = exercise.sounds;
  const syllable = toLower(a + b);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const track = useRef<HTMLSpanElement>(null);
  const down = useRef<{ x: number; moved: boolean } | null>(null);
  const frame = useRef(0);
  const show = (l: string) => caseText(l, readingCase);
  const done = phase === 'done' || completed;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const sound = (key: string) => {
    if (hasRecording(key)) void playRecording(key);
  };

  const finish = () => {
    cancelAnimationFrame(frame.current);
    down.current = null;
    setProgress(1);
    setPhase('done');
    chime();
    sound(sayKey(syllable));
    onFeedback({ mood: 'happy', text: solo ? HINTS.soloRead : HINTS.blendDone });
  };

  const begin = () => {
    sound(soundKey(a as LetterId));
    onFeedback({ mood: 'idle', text: HINTS.blendHold });
  };

  const autoSlide = () => {
    if (done || phase === 'auto') return;
    setPhase('auto');
    begin();
    const from = progress;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / AUTO_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const p = from + (1 - from) * eased;
      setProgress(p);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else finish();
    };
    frame.current = requestAnimationFrame(step);
  };

  const progressAt = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (x - r.left) / r.width));
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (done || phase === 'auto') return;
    const onFirst = (e.target as HTMLElement).closest('.slide__tile--a, .slide__track');
    if (!onFirst) {
      onFeedback({ mood: 'thinking', text: HINTS.blendStart });
      return;
    }
    try {
      // Пальчик може з'їхати з доріжки - кулька однаково їде за ним.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Без захоплення теж працює, поки пальчик над доріжкою.
    }
    down.current = { x: e.clientX, moved: false };
    setPhase('drag');
    begin();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Стан фази може ще не встигнути оновитися між подіями, тож дивимося на сам дотик.
    const d = down.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) > TAP_SLOP) d.moved = true;
    const p = progressAt(e.clientX);
    setProgress(p);
    if (p >= DONE_AT) finish();
  };

  const onUp = () => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    if (!d.moved) {
      autoSlide();
      return;
    }
    // Відпустила посередині: кулька котиться назад, пробуємо ще раз.
    setPhase('idle');
    setProgress(0);
    onFeedback({ mood: 'thinking', text: HINTS.blendNext });
  };

  const mark = (alone: boolean) => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(alone ? PRAISE_READING_ALONE : PRAISE_READING_TOGETHER) });
    onComplete({ hinted: !alone, reading: { text: syllable, alone } });
  };

  const soloDone = () => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(PRAISE) });
    onComplete({ hinted: false });
  };

  return (
    <div className="exercise exercise--blend">
      {done ? (
        <div className="blend__result">
          <span className="syl-hint">
            <Syllable text={syllable} readingCase={readingCase} big speak />
            <span className="syl-hint__glide">{glide(syllable)}</span>
          </span>
          <SayButton text={syllable} />
        </div>
      ) : (
        <div
          className={`slide slide--${phase}`}
          style={{ '--p': progress } as CSSProperties}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <button
            type="button"
            className={`slide__tile slide__tile--a slide__tile--${LETTERS[a].kind}`}
            onClick={(e) => {
              // Дотик обробляємо вище; тут - лише клавіатура (Enter, пробіл).
              if (e.detail === 0) autoSlide();
            }}
            aria-label="Перший звук: веди кульку до другої букви"
          >
            <span className="letter-glyph">{show(a)}</span>
          </button>
          <span className="slide__track" ref={track} aria-hidden="true">
            <span className="slide__fill" />
            <span className="slide__ball" />
          </span>
          <span className={`slide__tile slide__tile--b slide__tile--${LETTERS[b].kind}`} aria-label="Другий звук">
            <span className="letter-glyph">{show(b)}</span>
          </span>
        </div>
      )}

      {done && !completed && (solo ? <SoloRead text={syllable} onDone={soloDone} /> : <ReadingMarks onMark={mark} />)}
    </div>
  );
}
