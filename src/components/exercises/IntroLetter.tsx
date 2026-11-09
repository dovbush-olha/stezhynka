import { useState } from 'react';
import { LETTERS, toLower } from '../../content/alphabet';
import type { IntroLetterExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording, soundKey } from '../../audio/recordings';
import { SayAloud } from '../ui';
import type { ExerciseProps } from './types';

export function IntroLetter({ exercise, solo, completed, onFeedback, onComplete }: ExerciseProps<IntroLetterExercise>) {
  const info = LETTERS[exercise.letter];
  const [taps, setTaps] = useState(0);
  const recorded = hasRecording(soundKey(info.id));

  const tap = () => {
    setTaps((t) => t + 1);
    if (recorded) void playRecording(soundKey(info.id));
    else chime();
    if (!completed) {
      onFeedback({ mood: 'happy', text: `Ось яка вона! ${info.shapeHint}` });
      onComplete({ hinted: false, unscored: true, letters: [] });
    }
  };

  return (
    <div className="exercise exercise--intro">
      <button
        type="button"
        key={taps}
        className={`intro-card intro-card--${info.kind} ${taps ? 'intro-card--tapped' : ''}`}
        onClick={tap}
        aria-label="Торкнись букви"
      >
        <span className="intro-card__letters">
          <span className="letter-glyph letter-glyph--hero">{info.id}</span>
          <span className="letter-glyph letter-glyph--hero-lower">{toLower(info.id)}</span>
        </span>
        <span className="intro-card__picture" aria-hidden="true">
          {info.mnemonic.picture}
        </span>
        <span className="intro-card__sparkles" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {!taps && (
          <span className="intro-card__tap" aria-hidden="true">
            👆
          </span>
        )}
      </button>

      {!solo && !recorded && <SayAloud>{info.sound}</SayAloud>}
    </div>
  );
}
