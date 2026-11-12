import { useEffect, useState } from 'react';
import { LETTERS, toLower } from '../../content/alphabet';
import { HINTS, PRAISE, PRAISE_AFTER_HINT, pick } from '../../content/phrases';
import type { SaySoundExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording, soundKey } from '../../audio/recordings';
import { ReadAloud } from '../ReadAloud';
import { HintButton, ListenButton } from '../ui';
import type { ExerciseProps } from './types';

/**
 * «Як звучить ця буква?» - дитина бачить букву і сама згадує звук, без варіантів на вибір.
 * Вибрати букву, почувши звук, значно легше, ніж згадати звук, побачивши букву, а читання потребує саме другого.
 *
 * Підказки поступові: спершу картинка-асоціація (🦊 - л-л-лисичка), потім запис звука дорослого.
 * Після відповіді звучить запис і з'являється картинка, щоб дитина перевірила себе.
 * Дорослий поруч - відповідь іде в повторення букв одразу; із записом - коли дорослий послухає його потім.
 */
export function SaySound({ exercise, readingCheck, completed, onFeedback, onComplete }: ExerciseProps<SaySoundExercise>) {
  const info = LETTERS[exercise.letter];
  // «кит» для И: звук не на початку слова.
  const glyph = exercise.letterCase === 'lower' ? toLower(info.id) : info.id;
  const recorded = hasRecording(soundKey(info.id));
  const play = () => void playRecording(soundKey(info.id));
  const [level, setLevel] = useState(0);
  const showPicture = level >= 1 || completed;
  const maxLevel = recorded ? 2 : 1;

  // Після відповіді - почути, як правильно: так дитина сама перевіряє себе.
  useEffect(() => {
    if (!completed || !recorded) return;
    const t = window.setTimeout(() => void playRecording(soundKey(info.id)), 400);
    return () => window.clearTimeout(t);
  }, [completed, recorded, info.id]);

  const hint = () => {
    const next = Math.min(maxLevel, level + 1);
    setLevel(next);
    if (next === 1) onFeedback({ mood: 'thinking', text: HINTS.saySoundPicture });
    else {
      play();
      onFeedback({ mood: 'thinking', text: HINTS.listenAgain });
    }
  };

  const praise = (hinted: boolean) => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(hinted ? PRAISE_AFTER_HINT : PRAISE) });
  };

  const mark = (alone: boolean) => {
    const hinted = level > 0 || !alone;
    praise(hinted);
    onComplete({ hinted, letters: [{ id: info.id, firstTry: !hinted }] });
  };

  // Записано: ще ніхто не чув, що сказала дитина, тож у повторення букв піде відмітка дорослого за записом.
  const saved = () => {
    const hinted = level > 0;
    praise(hinted);
    onComplete({ hinted, letters: [] });
  };

  return (
    <div className="exercise exercise--say">
      <div className="say-row">
        <div className="sample-card" aria-label="Буква">
          <span className="sample-card__tag">🗣️ Як звучить?</span>
          <span className="letter-glyph letter-glyph--sample">{glyph}</span>
        </div>
        {showPicture && (
          <div className="word-reveal" aria-live="polite">
            <span className="word-reveal__picture" aria-hidden="true">
              {info.mnemonic.picture}
            </span>
          </div>
        )}
      </div>

      {!completed && (
        <>
          <div className="exercise__tools">
            {level >= 2 && <ListenButton onPlay={play} />}
            <HintButton onClick={hint} disabled={level >= maxLevel} />
          </div>
          <ReadAloud text={info.id} say check={readingCheck} expected={`${info.sound} - ${info.say}`} onRecorded={saved} onMark={mark} />
        </>
      )}
      {completed && recorded && <ListenButton onPlay={play} />}
    </div>
  );
}
