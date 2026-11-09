import { useEffect, useState } from 'react';
import { LETTERS, toLower, type LetterId } from '../../content/alphabet';
import { HINTS, PRAISE, PRAISE_AFTER_HINT, TRY_AGAIN, pick } from '../../content/phrases';
import type { FindLetterExercise, LetterBySoundExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording, soundKey } from '../../audio/recordings';
import { SayAloud, HintButton, ListenButton } from '../ui';
import type { ExerciseProps } from './types';

type Props = ExerciseProps<FindLetterExercise | LetterBySoundExercise>;

/** «Знайди таку саму букву» і «Вибери букву за звуком» - одна механіка з різною підказкою. */
export function ChooseLetter({ exercise, solo, completed, onFeedback, onComplete }: Props) {
  const { target, options, kind } = exercise;
  const lower = exercise.letterCase === 'lower';
  const show = (l: LetterId) => (lower ? toLower(l) : l);
  const info = LETTERS[target];
  const recorded = kind === 'letter-by-sound' && hasRecording(soundKey(target));
  const play = () => void playRecording(soundKey(target));

  const [tried, setTried] = useState<LetterId[]>([]);
  const [level, setLevel] = useState(0);
  const [picked, setPicked] = useState<LetterId | null>(null);

  // Звук лунає сам на початку вправи - дитині не треба нічого читати.
  useEffect(() => {
    if (!recorded) return;
    const t = window.setTimeout(() => void playRecording(soundKey(target)), 500);
    return () => window.clearTimeout(t);
  }, [recorded, target]);

  const raiseHint = (afterMistake: boolean) => {
    const next = Math.min(2, level + 1);
    setLevel(next);
    if (next === 1) {
      const hint = kind === 'find-letter' ? `Подивись: ${lowerFirst(info.shapeHint)}` : HINTS.listenAgain;
      if (kind === 'letter-by-sound' && recorded) window.setTimeout(play, 300);
      onFeedback({ mood: 'thinking', text: afterMistake ? `${pick(TRY_AGAIN)} ${hint}` : hint });
    } else {
      onFeedback({ mood: 'thinking', text: HINTS.showAnswer });
    }
  };

  const choose = (l: LetterId) => {
    if (completed || tried.includes(l)) return;
    if (l === target) {
      const hinted = level > 0 || tried.length > 0;
      setPicked(l);
      chime();
      onFeedback({ mood: 'cheer', text: pick(hinted ? PRAISE_AFTER_HINT : PRAISE) });
      onComplete({ hinted, letters: [{ id: target, firstTry: !hinted }] });
    } else {
      setTried((t) => [...t, l]);
      raiseHint(true);
    }
  };

  return (
    <div className="exercise exercise--choose">
      {kind === 'find-letter' ? (
        <div className="sample-card" aria-label="Зразок">
          <span className="sample-card__tag">⭐ Ось така буква</span>
          <span className="letter-glyph letter-glyph--sample">{show(target)}</span>
        </div>
      ) : (
        <>
          {recorded ? (
            <ListenButton onPlay={play} big />
          ) : (
            <div className="listen-badge" aria-hidden="true">
              <span className="listen-badge__ear">👂</span>
              <span className="listen-badge__waves" />
            </div>
          )}
          {!solo && !recorded && <SayAloud>{info.sound}</SayAloud>}
        </>
      )}

      <div className={`choice-row choice-row--${options.length}`}>
        {options.map((l) => {
          const isTried = tried.includes(l);
          const isTarget = l === target;
          const glow = level >= 2 && isTarget && !completed;
          const dim = (level >= 2 && !isTarget && !completed) || isTried;
          return (
            <button
              key={l}
              type="button"
              className={[
                'choice-tile',
                isTried && 'choice-tile--tried',
                dim && 'choice-tile--dim',
                glow && 'choice-tile--glow',
                completed && picked === l && 'choice-tile--correct',
                completed && picked !== l && 'choice-tile--rest',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => choose(l)}
              disabled={completed || isTried}
              aria-label={`Буква ${show(l)}`}
            >
              <span className="letter-glyph">{show(l)}</span>
            </button>
          );
        })}
      </div>

      <div className="exercise__tools">
        <HintButton onClick={() => raiseHint(false)} disabled={completed || level >= 2} />
      </div>
    </div>
  );
}

function lowerFirst(s: string) {
  return s.charAt(0).toLocaleLowerCase('uk-UA') + s.slice(1);
}
