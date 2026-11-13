/** Стан запису читання вголос у вправі. */
export type ReadAloudPhase = 'idle' | 'starting' | 'recording' | 'hearing';

/** Піктограма й колір круглої кнопки, які дитина впізнає без підпису. */
export type ReadAloudIcon = 'mic' | 'wait' | 'stop' | 'ear';

export interface ReadAloudLook {
  icon: ReadAloudIcon;
  /** Короткий підпис під кнопкою - для дорослого. */
  caption: string;
  /** Кнопку можна натиснути: почати запис або зупинити його. */
  pressable: boolean;
}

const LOOKS: Record<ReadAloudPhase, { icon: ReadAloudIcon; pressable: boolean; caption: { read: string; say: string } }> = {
  idle: { icon: 'mic', pressable: true, caption: { read: 'Натисни й читай уголос', say: 'Натисни й скажи звук' } },
  starting: { icon: 'wait', pressable: false, caption: { read: 'Зачекай…', say: 'Зачекай…' } },
  recording: { icon: 'stop', pressable: true, caption: { read: 'Читай! Коли все - натисни ■', say: 'Кажи! Коли все - натисни ■' } },
  hearing: { icon: 'ear', pressable: false, caption: { read: 'Послухай себе', say: 'Послухай себе' } },
};

/** Вигляд кнопки запису в кожному стані; `say` - дитина каже звук букви, а не читає. */
export function readAloudLook(phase: ReadAloudPhase, say: boolean): ReadAloudLook {
  const { icon, pressable, caption } = LOOKS[phase];
  return { icon, pressable, caption: say ? caption.say : caption.read };
}
