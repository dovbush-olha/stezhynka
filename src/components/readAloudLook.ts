/** Стан запису читання вголос у вправі. */
export type ReadAloudPhase = 'idle' | 'starting' | 'recording' | 'hearing';

/** Піктограма й колір круглої кнопки, які дитина впізнає без підпису. */
export type ReadAloudIcon = 'mic' | 'wait' | 'stop' | 'ear';

/** Що робить дотик до кнопки: почати запис чи зупинити його. */
export type ReadAloudAction = 'start' | 'stop';

export interface ReadAloudLook {
  icon: ReadAloudIcon;
  /** Короткий підпис під кнопкою - для дорослого. */
  caption: string;
  /** Опис кнопки для читалки екрана: той самий підпис, лише «стоп» словом, а не значком. */
  label: string;
  /** Що робить дотик; немає - кнопка не натискається. */
  action?: ReadAloudAction;
}

/** Значок «стоп» у підписі - такий самий, як на кнопці. */
const STOP = '■';

const LOOKS: Record<ReadAloudPhase, { icon: ReadAloudIcon; action?: ReadAloudAction; caption: { read: string; say: string } }> = {
  idle: { icon: 'mic', action: 'start', caption: { read: 'Натисни й читай уголос', say: 'Натисни й скажи звук' } },
  starting: { icon: 'wait', caption: { read: 'Зачекай…', say: 'Зачекай…' } },
  recording: {
    icon: 'stop',
    action: 'stop',
    caption: { read: `Читай! Коли все - натисни ${STOP}`, say: `Кажи! Коли все - натисни ${STOP}` },
  },
  hearing: { icon: 'ear', caption: { read: 'Послухай себе', say: 'Послухай себе' } },
};

/** Вигляд кнопки запису в кожному стані; `say` - дитина каже звук букви, а не читає. */
export function readAloudLook(phase: ReadAloudPhase, say: boolean): ReadAloudLook {
  const { icon, action, caption } = LOOKS[phase];
  const text = say ? caption.say : caption.read;
  return { icon, action, caption: text, label: text.replace(STOP, '«стоп»') };
}
