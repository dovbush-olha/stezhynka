import { useEffect, useState } from 'react';
import { HINTS, PRAISE, PRAISE_READING_ALONE, PRAISE_READING_TOGETHER, TRY_AGAIN, pick } from '../../content/phrases';
import type { BuildWordExercise } from '../../content/types';
import { getWord, isPhrase, syllablesOf, wordsOf } from '../../content/words';
import { chime } from '../../audio/audio';
import { hasRecording, playRecording } from '../../audio/recordings';
import { sayKey } from '../../logic/voice';
import { makeRng, shuffle } from '../../logic/generate';
import { ReadAloud } from '../ReadAloud';
import { ColoredText, HintButton, ListenButton } from '../ui';
import { caseText } from '../text';
import { toLower } from '../../content/alphabet';
import type { ExerciseProps } from './types';

interface Tile {
  id: number;
  text: string;
}

/**
 * Склади слово чи фразу зі складів по порядку, а потім прочитай.
 * Що складати, підказує записаний голос або однозначна картинка.
 * Фраза складається слово за словом, між словами - широкий проміжок.
 */
export function BuildWord({ exercise, seed, readingCase, readingCheck, completed, onFeedback, onComplete }: ExerciseProps<BuildWordExercise>) {
  const word = getWord(exercise.word);
  const parts = syllablesOf(word);
  const groups = wordsOf(word);
  // Номер першого складу кожного слова - щоб розкласти віконця по словах.
  const offsets = groups.map((_, w) => groups.slice(0, w).reduce((n, g) => n + g.length, 0));
  const phrase = isPhrase(word);
  const [tiles] = useState<Tile[]>(() =>
    shuffle(
      [...parts, ...exercise.distractors].map((text, id) => ({ id, text })),
      makeRng(seed),
    ),
  );
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [glow, setGlow] = useState(false);
  const show = (t: string) => caseText(t, readingCase);
  const showPicture = word.clear;
  // Слово звучить записаним голосом, і його можна послухати ще раз.
  const voiced = hasRecording(sayKey(word.text));
  const listen = () => void playRecording(sayKey(word.text));

  useEffect(() => {
    if (!voiced || completed) return;
    const t = window.setTimeout(() => void playRecording(sayKey(word.text)), 500);
    return () => window.clearTimeout(t);
  }, [voiced, completed, word.text]);

  // Довга фраза: сім і більше складів разом із зайвими або склад із чотирьох букв («Вовк»).
  // На телефоні звичайні віконця й склади зайняли б по три рядки, тож вони менші (див. play.css).
  const compact = phrase && (tiles.length > 6 || tiles.some((t) => t.text.length > 3));
  const built = placed.length === parts.length;
  const expected = parts[placed.length];
  // «Лі» і «лі» - той самий склад (у «Лілі» обидва; великими буквами їх і не розрізниш).
  const fits = (tile: Tile) => expected !== undefined && toLower(tile.text) === toLower(expected);
  const glowTile = glow && !built ? tiles.find((t) => !placed.includes(t.id) && fits(t))?.id : undefined;

  const tap = (tile: Tile) => {
    if (built || placed.includes(tile.id)) return;
    if (fits(tile)) {
      const next = [...placed, tile.id];
      setPlaced(next);
      setGlow(false);
      if (next.length === parts.length) {
        chime();
        onFeedback({ mood: 'happy', text: phrase ? HINTS.buildPhraseDone : HINTS.buildDone });
      } else {
        // Склали ціле слово фрази - кажемо, що далі нове слово.
        const wordDone = offsets.includes(next.length);
        onFeedback({ mood: 'happy', text: wordDone ? HINTS.buildNextWord : HINTS.buildMore });
      }
    } else {
      setShake(tile.id);
      window.setTimeout(() => setShake(null), 500);
      const m = mistakes + 1;
      setMistakes(m);
      if (m >= 2) setGlow(true);
      onFeedback({ mood: 'thinking', text: m >= 2 ? HINTS.buildGlow : `${pick(TRY_AGAIN)} ${HINTS.buildNext}` });
    }
  };

  const hint = () => {
    setGlow(true);
    setMistakes((m) => Math.max(m, 1));
    onFeedback({ mood: 'thinking', text: HINTS.buildGlow });
  };

  const mark = (alone: boolean) => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(alone ? PRAISE_READING_ALONE : PRAISE_READING_TOGETHER) });
    onComplete({ hinted: mistakes > 0 || !alone, reading: { text: word.text, alone } });
  };

  const recorded = () => {
    chime();
    onFeedback({ mood: 'cheer', text: pick(PRAISE) });
    onComplete({ hinted: mistakes > 0 });
  };

  return (
    <div className={['exercise exercise--build', phrase && 'exercise--phrase', compact && 'exercise--compact'].filter(Boolean).join(' ')}>
      {(showPicture || voiced) && !completed && (
        <div className="build__prompt">
          {showPicture && (
            <div className="picture-prompt" aria-label={phrase ? 'Що тут написано?' : 'Яке це слово?'}>
              <span>{word.picture}</span>
            </div>
          )}
          {voiced && !built && <ListenButton onPlay={listen} big={!showPicture} />}
        </div>
      )}

      <div
        className={['word-slots', phrase && 'word-slots--phrase', built && 'word-slots--built', completed && 'word-slots--revealed']
          .filter(Boolean)
          .join(' ')}
      >
        {groups.map((g, w) => (
          <span key={w} className="word-slots__word">
            {g.map((_, j) => {
              const i = offsets[w] + j;
              const tile = tiles.find((t) => t.id === placed[i]);
              return (
                <span
                  key={i}
                  className={`word-slot ${tile ? 'word-slot--filled' : ''} ${i === placed.length && !built ? 'word-slot--next' : ''}`}
                >
                  {tile && <ColoredText text={show(tile.text)} className="reading-text reading-text--tile" />}
                </span>
              );
            })}
          </span>
        ))}
        {completed && (
          <span className="word-reveal word-reveal--inline" aria-live="polite">
            <span className="word-reveal__picture">{word.picture}</span>
          </span>
        )}
      </div>

      {!built && (
        <>
          <div className="tile-pool">
            {tiles.map((t) => {
              const used = placed.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={[
                    'syllable-tile',
                    used && 'syllable-tile--used',
                    shake === t.id && 'syllable-tile--shake',
                    glowTile === t.id && 'syllable-tile--glow',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => tap(t)}
                  disabled={used}
                  aria-label={`Склад ${t.text}`}
                >
                  <ColoredText text={show(t.text)} className="reading-text reading-text--tile" />
                </button>
              );
            })}
          </div>
          <div className="exercise__tools">
            <HintButton onClick={hint} disabled={glow} />
          </div>
        </>
      )}

      {built && !completed && (
        <ReadAloud text={word.text} check={readingCheck} expected={`«${word.split}»`} onRecorded={recorded} onMark={mark} />
      )}
      {completed && word.note && readingCheck === 'adult' && <p className="word-note">{word.note}</p>}
    </div>
  );
}
