import { useState } from 'react';
import { usePendingReadings } from '../audio/readings';
import { HELPERS, helperName } from '../content/helpers';
import { personalize } from '../content/child';
import { GREETINGS, pick } from '../content/phrases';
import type { Mission } from '../content/types';
import { COURSE } from '../content/course';
import { Helper } from '../components/Helper';
import { ParentGate } from '../components/ParentGate';
import { ColoredText, Modal } from '../components/ui';
import { isDayEarned, mapMission, missingLetters, recommend } from '../logic/availability';
import { updateSettings } from '../logic/progress';
import { updateProgress, useChild, useProgress } from '../store/progressStore';
import { StarJar } from './MissionPlayer';

interface Props {
  onStart: (mission: Mission | 'practice') => void;
  onParent: () => void;
}

// Пропущена місія - як пройдена, але зірочку дитина ще не заробила.
const STATUS_ICON = { done: '⭐', skipped: '☆', available: '🌱', locked: '🔒', 'needs-letters': '🔒' } as const;

export function Home({ onStart, onParent }: Props) {
  const progress = useProgress();
  const pendingReadings = usePendingReadings().length;
  const { settings } = progress;
  const rec = recommend(progress);
  const child = useChild();
  const [greeting] = useState(() => pick(GREETINGS));
  const [message, setMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [gate, setGate] = useState(false);
  const recommendedId = rec.kind === 'mission' ? rec.mission.id : undefined;

  const tapMission = (m: Mission) => {
    const { playable, availability } = mapMission(progress, m);
    if (playable) return onStart(m);
    if (availability === 'locked') return setMessage('Ця стежка ще попереду. Спершу пройдемо попередню місію!');
    setMessage('Тут живе нова буква. Її відкриє дорослий, коли прийде час.');
  };

  return (
    <div className="screen home">
      <header className="home__header">
        <h1 className="logo">
          <span className="logo__big">Стежинка</span>
          <span className="logo__small">до читання</span>
        </h1>
        <div className="home__controls">
          <button
            type="button"
            className="icon-button"
            onClick={() => updateProgress((s) => updateSettings(s, { theme: settings.theme === 'day' ? 'night' : 'day' }))}
            aria-label={settings.theme === 'day' ? 'Увімкнути ніч' : 'Увімкнути день'}
          >
            {settings.theme === 'day' ? '🌙' : '☀️'}
          </button>
          <button
            type="button"
            className="hold-button"
            onClick={() => setGate(true)}
            aria-label={pendingReadings ? 'Для дорослих: є нові записи читання' : 'Для дорослих'}
          >
            <span aria-hidden="true">🔑</span>
            <span className="hold-button__label">Для дорослих</span>
            {pendingReadings > 0 && <span className="hold-button__dot" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero__helper">
          <button type="button" className="hero__helper-button" onClick={() => setPicker(true)} aria-label="Обрати друга">
            <Helper id={settings.helper} mood={message ? 'thinking' : 'happy'} size={180} />
            <span className="hero__change">🔄 Обрати друга</span>
          </button>
          <p className="bubble bubble--hero" aria-live="polite">
            {message ?? personalize(greeting, child)}
          </p>
        </div>

        <div className="hero__card">
          <div className="hero__card-top">
            {rec.kind === 'mission' ? (
              <span className="pill">
                День {rec.mission.day} · Місія {rec.mission.order}
              </span>
            ) : (
              <span className="pill">Лісова гра</span>
            )}
            <StarJar stars={progress.stars} />
          </div>
          {rec.kind === 'mission' ? (
            <>
              <h2 className="hero__title">{rec.mission.title}</h2>
              {rec.reason === 'repeat' && <p className="hero__note">Пограймо ще раз - так букви запам’ятовуються найкраще!</p>}
              <button type="button" className="big-button big-button--hero" onClick={() => onStart(rec.mission)}>
                {rec.reason === 'repeat' ? 'Ще раз!' : 'Вперед!'} <span aria-hidden="true">🐾</span>
              </button>
            </>
          ) : (
            <>
              <h2 className="hero__title">Повторення в лісі</h2>
              <p className="hero__note">
                {rec.reason === 'all-done'
                  ? 'Усю стежку пройдено! Граймо, щоб букви не забувалися.'
                  : rec.reason === 'review'
                    ? 'Спершу повторимо те, що вже вміємо, а тоді - далі стежкою!'
                    : 'Пограймо з буквами, які вже знаємо!'}
              </p>
              <button type="button" className="big-button big-button--hero" onClick={() => onStart('practice')}>
                Грати <span aria-hidden="true">🍄</span>
              </button>
              {rec.reason === 'needs-letters' && (
                <p className="hero__adult">
                  Для дорослого: наступна місія «{rec.waitingMission.title}» чекає букву {rec.letters.join(', ')}. Відкрийте її в режимі
                  «Для дорослих», коли {child.name} {personalize('{буде готова|буде готовий}', child)}.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="map" aria-label="Лісова мапа">
        <h2 className="section-title">Лісова мапа</h2>
        <ol className="map__days">
          {COURSE.map((day) => {
            const cells = day.missions.map((m) => mapMission(progress, m));
            const dayDone = isDayEarned(progress, day);
            // Буква, яку сховав дорослий. Майбутні дні просто чекають своєї черги.
            const waiting = cells[0].availability === 'needs-letters' ? missingLetters(progress, day.missions[0]) : [];
            return (
              <li key={day.day} className={`map-day ${dayDone ? 'map-day--done' : ''}`}>
                <span className="map-day__stone">
                  <span className="map-day__badge">
                    <ColoredText text={day.badge} />
                  </span>
                  {dayDone && (
                    <span className="map-day__star" aria-hidden="true">
                      ⭐
                    </span>
                  )}
                </span>
                <span className="map-day__label">День {day.day}</span>
                <span className="map-day__missions">
                  {day.missions.map((m, i) => {
                    const { look, earned } = cells[i];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`map-mission map-mission--${look} ${m.id === recommendedId ? 'map-mission--current' : ''}`}
                        onClick={() => tapMission(m)}
                        aria-label={`День ${day.day}, місія ${m.order}: ${m.title}`}
                        title={m.title}
                      >
                        <span aria-hidden="true">{STATUS_ICON[earned ? 'done' : look]}</span>
                      </button>
                    );
                  })}
                </span>
                {waiting.length > 0 && <span className="map-day__waiting">чекає {waiting.join(', ')}</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="album" aria-label="Мої лісові друзі">
        <h2 className="section-title">Мої лісові друзі</h2>
        {progress.stickers.length ? (
          <ul className="album__list">
            {progress.stickers.map((s) => (
              <li key={s}>
                <button type="button" className="album__sticker" aria-label="Наліпка">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="album__empty">Пройди першу місію - і тут з’явиться перший друг!</p>
        )}
      </section>

      {gate && <ParentGate onPass={onParent} onClose={() => setGate(false)} />}

      {picker && (
        <Modal title="Хто піде з тобою в ліс?" onClose={() => setPicker(false)} actions={null}>
          <div className="helper-picker">
            {HELPERS.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`helper-picker__item ${settings.helper === h.id ? 'helper-picker__item--active' : ''}`}
                onClick={() => {
                  updateProgress((s) => updateSettings(s, { helper: h.id }));
                  setPicker(false);
                  setMessage(`Привіт! Я ${helperName(h.id).toLocaleLowerCase('uk-UA')}. Ходімо разом!`);
                }}
              >
                <Helper id={h.id} mood={settings.helper === h.id ? 'happy' : 'idle'} size={96} />
                <span>{h.name}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
