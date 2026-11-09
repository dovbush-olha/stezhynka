import { useEffect, useState } from 'react';
import { toLower } from '../../content/alphabet';
import { HINTS, PRAISE, PRAISE_AFTER_HINT, TRY_AGAIN, pick } from '../../content/phrases';
import type { PickByEarExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { playRecording, useRecordingKeys } from '../../audio/recordings';
import { sayKey } from '../../logic/voice';
import { SayAloud, ColoredText, HintButton, ListenButton } from '../ui';
import { caseText } from '../text';
import type { ExerciseProps } from './types';

/**
 * «Послухай і вибери»: звучить голос дорослого (запис або вживу) - дитина торкає написане.
 * Варіанти не озвучуються: інакше їх можна було б порівняти на слух, не дивлячись на букви.
 */
export function PickByEar({ exercise, readingCase, solo, completed, onFeedback, onComplete }: ExerciseProps<PickByEarExercise>) {
  const { text, options } = exercise;
  const keys = useRecordingKeys();
  const recorded = keys.has(sayKey(text));
  const play = () => void playRecording(sayKey(text));
  const isTarget = (o: string) => toLower(o) === toLower(text);

  const [tried, setTried] = useState<string[]>([]);
  const [level, setLevel] = useState(0);

  // Запис лунає сам на початку вправи.
  useEffect(() => {
    if (!recorded) return;
    const t = window.setTimeout(() => void playRecording(sayKey(text)), 500);
    return () => window.clearTimeout(t);
  }, [recorded, text]);

  const raise = (afterMistake: boolean) => {
    const next = Math.min(2, level + 1);
    setLevel(next);
    if (recorded) window.setTimeout(play, 300);
    const hint = next === 1 ? HINTS.earWrong : HINTS.earGlow;
    onFeedback({ mood: 'thinking', text: afterMistake && next === 1 ? `${pick(TRY_AGAIN)} ${hint}` : hint });
  };

  const choose = (o: string) => {
    if (completed || tried.includes(o)) return;
    if (isTarget(o)) {
      const hinted = level > 0 || tried.length > 0;
      chime();
      onFeedback({ mood: 'cheer', text: pick(hinted ? PRAISE_AFTER_HINT : PRAISE) });
      onComplete({ hinted });
    } else {
      setTried((t) => [...t, o]);
      raise(true);
    }
  };

  // Слова й фрази - стовпчиком однакових карток; короткі склади - рядком.
  const long = options.some((o) => o.length > 3);

  return (
    <div className="exercise exercise--ear">
      {/* Підказка - поруч із кнопкою звуку, а не окремим рядком: з трьома словами стовпчиком
          інакше кнопка «Далі» на телефоні опиняється нижче екрана. */}
      <div className="ear-head">
        {recorded ? (
          <ListenButton onPlay={play} big />
        ) : (
          <div className="listen-badge" aria-hidden="true">
            <span className="listen-badge__ear">👂</span>
            <span className="listen-badge__waves" />
          </div>
        )}
        <HintButton onClick={() => raise(false)} disabled={completed || level >= 2} />
      </div>
      {!solo && !recorded && <SayAloud>«{text}»</SayAloud>}

      <div className={`ear-row ${long ? 'ear-row--long' : ''}`}>
        {options.map((o) => {
          const target = isTarget(o);
          const isTried = tried.includes(o);
          return (
            <button
              key={o}
              type="button"
              className={[
                'syllable-tile',
                'ear-tile',
                isTried && 'ear-tile--tried',
                level >= 2 && !completed && !target && 'ear-tile--dim',
                level >= 2 && !completed && target && 'syllable-tile--glow',
                completed && target && 'ear-tile--correct',
                completed && !target && 'ear-tile--rest',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => choose(o)}
              disabled={completed || isTried}
              aria-label={caseText(o, readingCase)}
            >
              <ColoredText text={caseText(o, readingCase)} className="reading-text reading-text--tile" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
