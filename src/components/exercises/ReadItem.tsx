import { useState } from 'react';
import { PRAISE, PRAISE_READING_ALONE, PRAISE_READING_TOGETHER, pick, readSplitHintFor } from '../../content/phrases';
import type { ReadSyllableExercise, ReadWordExercise } from '../../content/types';
import { getWord } from '../../content/words';
import { chime } from '../../audio/audio';
import { ReadAloud } from '../ReadAloud';
import { ColoredText, HintButton, SayButton } from '../ui';
import { caseText, glide } from '../text';
import { Syllable, SyllableSplit } from './SyllableSplit';
import type { ExerciseProps } from './types';

type Props = ExerciseProps<ReadSyllableExercise | ReadWordExercise>;

/**
 * Прочитай склад / слово. Картинка слова - тільки після читання.
 * Слово ділиться на склади з дужками, а склад показує, як його тягнути разом («л-л-ла»), -
 * одразу або після «Підказка», як обрав дорослий. Склад не ділимо на окремі букви:
 * так дитина звикає читати «л… а…», а треба злито.
 * Послухати, як правильно, - це підказка: так і рахуємо.
 */
export function ReadItem({ exercise, readingCase, readingCheck, openHints, completed, onFeedback, onComplete }: Props) {
  const isWord = exercise.kind === 'read-word';
  const text = isWord ? exercise.word : exercise.syllable;
  const word = isWord ? getWord(exercise.word) : undefined;
  const [hint, setHint] = useState(false);
  const [listened, setListened] = useState(false);
  const split = hint || openHints;
  const helped = hint || listened;
  const show = (t: string) => caseText(t, readingCase);
  const listen = () => setListened(true);

  const showHint = () => {
    setHint(true);
    onFeedback({ mood: 'thinking', text: readSplitHintFor(exercise) });
  };

  const mark = (alone: boolean) => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(alone ? PRAISE_READING_ALONE : PRAISE_READING_TOGETHER) });
    onComplete({ hinted: helped || !alone, reading: { text, alone } });
  };

  // Читання записано: у журнал воно потрапить, коли дорослий послухає запис і відмітить.
  const recorded = () => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(PRAISE) });
    onComplete({ hinted: helped });
  };

  return (
    <div className={`exercise exercise--read ${isWord ? 'exercise--read-word' : ''}`}>
      <div className={`read-card ${completed && word ? 'read-card--revealed' : ''}`}>
        {!split || completed ? (
          <ColoredText text={show(text)} className={`reading-text ${isWord ? 'reading-text--word' : 'reading-text--syllable'} ${text.length > 6 ? 'reading-text--long' : ''}`} />
        ) : word ? (
          <SyllableSplit entry={word} readingCase={readingCase} speak onSpeak={listen} />
        ) : (
          <span className="syl-hint">
            <Syllable text={text} readingCase={readingCase} big speak onSpeak={listen} />
            <span className="syl-hint__glide">{glide(text)}</span>
          </span>
        )}

        {completed && word && (
          <div className="word-reveal" aria-live="polite">
            <span className="word-reveal__picture">{word.picture}</span>
          </div>
        )}
      </div>

      {!completed && (
        <>
          <div className="exercise__tools">
            {split ? <SayButton text={text} onPlay={listen} /> : <HintButton onClick={showHint} />}
          </div>
          {/* Підказка дорослому повторює поділ на склади, тож з'являється разом із ним: дитина бачить її теж. */}
          <ReadAloud
            text={text}
            check={readingCheck}
            expected={split ? `«${word ? word.split : glide(text)}»` : undefined}
            onRecorded={recorded}
            onMark={mark}
          />
        </>
      )}
      {completed && word?.note && readingCheck === 'adult' && <p className="word-note">{word.note}</p>}
    </div>
  );
}
