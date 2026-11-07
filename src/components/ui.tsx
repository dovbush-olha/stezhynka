import { useEffect, useState, type ReactNode } from 'react';
import { LETTERS, isLetterId, toUpper } from '../content/alphabet';
import { playRecording, useRecordingKeys } from '../audio/recordings';
import { sayKey } from '../logic/voice';

/** Текст, у якому голосні червоні, а приголосні сині - як у шкільному букварі. */
export function ColoredText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`colored ${className}`}>
      {[...text].map((ch, i) => {
        const up = toUpper(ch);
        const kind = isLetterId(up) ? LETTERS[up].kind : 'other';
        return (
          <span key={i} className={`colored__ch colored__ch--${kind}`}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/** Картка-підказка для дорослого: що сказати вголос. */
export function AdultPrompt({ children }: { children: ReactNode }) {
  return (
    <div className="adult-prompt" role="note">
      <span className="adult-prompt__icon" aria-hidden="true">
        🧑‍🏫
      </span>
      <div className="adult-prompt__body">
        <span className="adult-prompt__label">Дорослому</span>
        <div className="adult-prompt__text">{children}</div>
      </div>
    </div>
  );
}

export function HintButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="hint-button" onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">💡</span> Підказка
    </button>
  );
}

/** Дорослий відмічає, як дитина прочитала. Обидва варіанти - позитивні. */
export function ReadingMarks({ onMark, say = false }: { onMark: (alone: boolean) => void; /** Звук букви, а не читання. */ say?: boolean }) {
  return (
    <div className="reading-marks">
      <span className="reading-marks__label">Дорослому: як вийшло?</span>
      <div className="reading-marks__buttons">
        <button type="button" className="mark mark--alone" onClick={() => onMark(true)}>
          <span aria-hidden="true">⭐</span> {say ? 'Сказала сама' : 'Прочитала сама'}
        </button>
        <button type="button" className="mark mark--together" onClick={() => onMark(false)}>
          <span aria-hidden="true">🤝</span> {say ? 'Підказали' : 'Прочитали разом'}
        </button>
      </div>
    </div>
  );
}

/** Дитина грається сама: позначає, що прочитала вголос. */
export function SoloReadButton({ onDone, say = false }: { onDone: () => void; say?: boolean }) {
  return (
    <button type="button" className="solo-read" onClick={onDone}>
      <span className="solo-read__star" aria-hidden="true">
        ⭐
      </span>
      {say ? 'Сказала!' : 'Прочитала!'}
    </button>
  );
}

/** Велика кнопка «послухати» - відтворює записаний голос дорослого. */
export function ListenButton({ onPlay, big = false }: { onPlay: () => void; big?: boolean }) {
  return (
    <button type="button" className={`listen-button ${big ? 'listen-button--big' : ''}`} onClick={onPlay} aria-label="Послухати">
      <span aria-hidden="true">🔊</span>
    </button>
  );
}

/**
 * «Послухай, як правильно»: голос дорослого читає склад чи слово.
 * Без запису кнопки немає.
 */
export function SayButton({ text, onPlay }: { text: string; onPlay?: () => void }) {
  const keys = useRecordingKeys();
  if (!keys.has(sayKey(text))) return null;
  return (
    <button
      type="button"
      className="listen-button listen-button--small"
      onClick={() => {
        void playRecording(sayKey(text));
        onPlay?.();
      }}
      aria-label="Послухати, як правильно"
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}

const CONFETTI_COLORS = ['#F08A4B', '#7DB46C', '#FFD36E', '#E86A8D', '#C9B6E4', '#7EC4CF'];

export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const [items] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.6,
      rotate: Math.random() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: i % 3,
    })),
  );
  return (
    <div className="confetti" aria-hidden="true">
      {items.map((p, i) => (
        <span
          key={i}
          className={`confetti__piece confetti__piece--${p.shape}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  actions,
}: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{title}</h2>
        {children && <div className="modal__body">{children}</div>}
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
}
