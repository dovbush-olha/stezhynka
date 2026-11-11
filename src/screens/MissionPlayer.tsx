import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { helperName } from '../content/helpers';
import { personalize } from '../content/child';
import { INSTRUCTIONS, PHRASE_BUILD_INSTRUCTION } from '../content/phrases';
import type { Mission } from '../content/types';
import { fanfare, sparkle } from '../audio/audio';
import { hasRecording, soundKey } from '../audio/recordings';
import { ExerciseView } from '../components/exercises/ExerciseView';
import type { HelperFeedback } from '../components/exercises/types';
import { Helper } from '../components/Helper';
import { plural } from '../components/text';
import { ColoredText, Confetti } from '../components/ui';
import { exerciseResult, finishMission, missionExercises } from '../logic/missionRun';
import { applyExerciseResult, todayISO, type ExerciseResult, type MissionSummary } from '../logic/progress';
import { sayKey } from '../logic/voice';
import { getWord, isPhrase } from '../content/words';
import type { LetterId } from '../content/alphabet';
import { getProgress, updateProgress, useChild, useProgress } from '../store/progressStore';

interface Props {
  mission: Mission;
  onExit: () => void;
  onRepeat: () => void;
}

type Phase = 'intro' | 'play' | 'done';

const GOAL_LABEL = { learn: 'Вчимося', reinforce: 'Закріплюємо', practice: 'Повторюємо' } as const;

export function MissionPlayer({ mission, onExit, onRepeat }: Props) {
  const progress = useProgress();
  const { readingCase, helper, mode, openHints } = progress.settings;
  const child = useChild();
  const solo = mode === 'solo';
  const [runId] = useState(() => `${mission.id}-${Date.now()}`);

  const exercises = useMemo(
    () =>
      missionExercises(getProgress(), mission, todayISO(), runId, {
        hasSound: (l) => hasRecording(soundKey(l)),
        hasSay: (text) => hasRecording(sayKey(text)),
      }),
    [mission, runId],
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [feedback, setFeedback] = useState<HelperFeedback | null>(null);
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  /** Букви, які відкрилися самі, бо цією місією пройдено все до наступної букви плану. */
  const [opened, setOpened] = useState<LetterId[]>([]);

  const current = exercises[index];
  const completed = results.length > index;
  const buildsPhrase = current?.kind === 'build-word' && isPhrase(getWord(current.word));
  const bubble = personalize(feedback?.text ?? (buildsPhrase ? PHRASE_BUILD_INSTRUCTION : current ? INSTRUCTIONS[current.kind] : ''), child);
  const mood = feedback?.mood ?? 'idle';

  const handleComplete = (result: ExerciseResult) => {
    if (completed) return;
    const r = exerciseResult(current, result);
    setResults((prev) => [...prev, r]);
    updateProgress((s) => applyExerciseResult(s, r, todayISO()));
    window.setTimeout(sparkle, 650);
  };

  const next = () => {
    if (index + 1 < exercises.length) {
      setIndex(index + 1);
      setFeedback(null);
      return;
    }
    const done = finishMission(getProgress(), mission, results, todayISO());
    updateProgress(() => done.state);
    setSummary(done.summary);
    setOpened(done.opened);
    setPhase('done');
    fanfare();
  };

  if (phase === 'intro') {
    return (
      <div className="screen mission-intro">
        <TopBar onExit={onExit} stars={progress.stars} />
        <div className="page page--center mission-intro__page">
          <Helper id={helper} mood="happy" size={170} className="mission-intro__helper" />
          <span className="pill">{mission.day ? `День ${mission.day} · ${GOAL_LABEL[mission.goal]}` : GOAL_LABEL[mission.goal]}</span>
          <h1 className="mission-intro__title">{mission.title}</h1>
          <p className="mission-intro__count">
            {exercises.length} {plural(exercises.length, 'завдання', 'завдання', 'завдань')} · {helperName(helper)} вже чекає!
          </p>
          <button type="button" className="big-button" onClick={() => setPhase('play')}>
            Вперед! <span aria-hidden="true">🐾</span>
          </button>
          {!solo && (
            <details className="adult-note">
              <summary>Порада для дорослого</summary>
              <p>{personalize(mission.adultNote, child)}</p>
              <p>
                {personalize(
                  'Звуки вимовляйте саме як звуки ([м], а не «ем»). Помилки - це нормально: підказки допоможуть, а ви відмічаєте, чи {name} {прочитала сама|прочитав сам}. Зупинитися можна будь-коли.',
                  child,
                )}
              </p>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done' && summary) {
    return (
      <div className="screen mission-done">
        <Confetti />
        <div className="page page--center mission-done__page">
          <div className="sticker-reveal">
            <span className="sticker-reveal__glow" aria-hidden="true" />
            <span className="sticker-reveal__emoji">{mission.sticker}</span>
          </div>
          <h1 className="mission-done__title">Ура! Місію пройдено!</h1>
          <p className="mission-done__text">+{results.length} ⭐ і новий лісовий друг в альбомі!</p>
          {opened.length > 0 && (
            <p className="mission-done__new">
              <span aria-hidden="true">🔓</span> Відкрилася нова стежка з {plural(opened.length, 'буквою', 'буквами', 'буквами')}{' '}
              <ColoredText text={opened.join(', ')} />!
            </p>
          )}
          <button type="button" className="big-button" onClick={onExit}>
            До лісової мапи <span aria-hidden="true">🗺️</span>
          </button>
          <button type="button" className="text-button" onClick={onRepeat}>
            Пограти ще раз
          </button>
          {summary.scored > 0 && !solo && (
            <p className="mission-done__adult">
              Для дорослого: {summary.readTotal > 0 && personalize(`{сама прочитала|сам прочитав} ${summary.readAlone} з ${summary.readTotal}; `, child)}
              підказки знадобилися у {summary.hinted} з {summary.scored} завдань.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen player">
      <TopBar onExit={onExit} stars={progress.stars}>
        <ol className="trail" aria-label={`Завдання ${index + 1} з ${exercises.length}`}>
          {exercises.map((_, i) => (
            <li
              key={i}
              className={`trail__step ${i < results.length ? 'trail__step--done' : ''} ${i === index && !completed ? 'trail__step--current' : ''}`}
            />
          ))}
        </ol>
      </TopBar>

      <div className="player__stage">
        <div className="page player__page" key={index}>
          <ExerciseView
            exercise={current}
            seed={`${runId}-${index}`}
            readingCase={readingCase}
            solo={solo}
            openHints={openHints}
            completed={completed}
            onFeedback={setFeedback}
            onComplete={handleComplete}
          />
          {completed && <FlyingStar key={`star-${index}`} />}
        </div>

        <div className="player__helper">
          <Helper id={helper} mood={mood} size={128} key={`${index}-${mood}`} />
          <p className={`bubble bubble--${mood}`} aria-live="polite">
            {bubble}
          </p>
        </div>
      </div>

      <div className="player__footer">
        {completed && (
          <button type="button" className="big-button big-button--next" onClick={next}>
            {index + 1 < exercises.length ? 'Далі' : 'Завершити'} <span aria-hidden="true">➜</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TopBar({ onExit, stars, children }: { onExit: () => void; stars: number; children?: ReactNode }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-button" onClick={onExit} aria-label="Додому">
        🏠
      </button>
      <div className="topbar__middle">{children}</div>
      <StarJar stars={stars} />
    </header>
  );
}

export function StarJar({ stars }: { stars: number }) {
  return (
    <span className="star-jar" id="star-jar" aria-label={`Зірочок: ${stars}`}>
      <span className="star-jar__icon" aria-hidden="true">
        ⭐
      </span>
      <span key={stars} className="star-jar__count">
        {stars}
      </span>
    </span>
  );
}

/** Зірочка вилітає зі сторінки і летить у баночку вгорі. */
function FlyingStar() {
  const ref = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const jar = document.getElementById('star-jar');
    if (!el || !jar) return;
    const a = el.getBoundingClientRect();
    const b = jar.getBoundingClientRect();
    setStyle({
      ['--dx' as string]: `${b.left + b.width / 2 - (a.left + a.width / 2)}px`,
      ['--dy' as string]: `${b.top + b.height / 2 - (a.top + a.height / 2)}px`,
    });
  }, []);
  return (
    <span ref={ref} className={`flying-star ${style ? 'flying-star--go' : ''}`} style={style ?? undefined} aria-hidden="true">
      ⭐
    </span>
  );
}
