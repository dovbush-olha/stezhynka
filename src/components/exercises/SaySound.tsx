import { useEffect, useState } from 'react';
import { LETTERS, toLower } from '../../content/alphabet';
import { HINTS, PRAISE, PRAISE_AFTER_HINT, pick } from '../../content/phrases';
import type { SaySoundExercise } from '../../content/types';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording, soundKey } from '../../audio/recordings';
import { SoloRead } from '../SoloRead';
import { AdultPrompt, HintButton, ListenButton, ReadingMarks } from '../ui';
import type { ExerciseProps } from './types';

/**
 * «Як звучить ця буква?» - дитина бачить букву і сама згадує звук, без варіантів на вибір.
 * Вибрати букву, почувши звук, значно легше, ніж згадати звук, побачивши букву, а читання потребує саме другого.
 *
 * Підказки поступові: спершу картинка-асоціація (🦊 - л-л-лисичка), потім запис звука дорослого.
 * Після відповіді звучить запис і з'являється картинка, щоб дитина перевірила себе.
 * З дорослим відповідь іде в повторення букв одразу; сама - через запис, який дорослий послухає потім.
 */
export function SaySound({ exercise, solo, completed, onFeedback, onComplete }: ExerciseProps<SaySoundExercise>) {
  const info = LETTERS[exercise.letter];
  // «кит» для И: звук не на початку слова.
  const startsWithSound = toLower(info.mnemonic.word).startsWith(toLower(info.id));
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

  const finish = (alone: boolean) => {
    const hinted = level > 0 || !alone;
    chime();
    onFeedback({ mood: 'cheer', text: pick(hinted ? PRAISE_AFTER_HINT : PRAISE) });
    // Сама: ніхто не чув, що вона сказала, тож у повторення букв не пишемо - це зробить дорослий за записом.
    onComplete({ hinted, letters: solo ? [] : [{ id: info.id, firstTry: !hinted }] });
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
          {!solo && (
            <AdultPrompt>
              Запитайте: «Як звучить ця буква?» Зачекайте кілька секунд і не підказуйте. Правильно - звук <b>{info.sound}</b>,{' '}
              {info.say}, а не назва букви.
              <span className="adult-prompt__extra">
                Якщо не згадує, натисніть 💡: з’явиться {info.mnemonic.picture} «{info.mnemonic.word}».{' '}
                {startsWithSound ? 'Спитайте, з якого звука починається це слово.' : `Протягніть у ньому цей звук.`}
              </span>
            </AdultPrompt>
          )}
          <div className="exercise__tools">
            {level >= 2 && <ListenButton onPlay={play} />}
            <HintButton onClick={hint} disabled={level >= maxLevel} />
          </div>
          {solo ? <SoloRead text={info.id} say onDone={() => finish(true)} /> : <ReadingMarks say onMark={finish} />}
        </>
      )}
      {completed && recorded && <ListenButton onPlay={play} />}
    </div>
  );
}
