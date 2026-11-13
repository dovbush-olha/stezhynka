import { useId, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, guessVocative, tidyName, type Child, type Gender } from '../content/child';

interface Props {
  initial: Child | null;
  submitLabel: string;
  onSave: (child: Child) => void;
  /** Кнопка внизу на всю ширину (знайомство) чи компактна (налаштування). */
  big?: boolean;
  /** Кнопка неактивна, доки дорослий нічого не змінив: для правки вже збереженого імені. */
  requireChange?: boolean;
}

/** Ім'я дитини, хлопчик чи дівчинка і як до неї звертатися. */
export function ChildForm({ initial, submitLabel, onSave, big = false, requireChange = false }: Props) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [vocative, setVocative] = useState(initial?.vocative ?? '');
  /** Поки дорослий не правив звертання сам, воно підлаштовується під ім'я. */
  const [vocativeEdited, setVocativeEdited] = useState(Boolean(initial && initial.vocative !== guessVocative(initial.name, initial.gender)));

  const autoVocative = (n: string, g: Gender | null) => (g ? guessVocative(tidyName(n), g) : tidyName(n));
  const changeName = (n: string) => {
    setName(n);
    if (!vocativeEdited) setVocative(autoVocative(n, gender));
  };
  const changeGender = (g: Gender) => {
    setGender(g);
    if (!vocativeEdited) setVocative(autoVocative(name, g));
  };

  const cleanName = tidyName(name);
  const cleanVocative = tidyName(vocative) || cleanName;
  const ready = cleanName !== '' && gender !== null;
  const unchanged =
    requireChange &&
    initial !== null &&
    initial.name === cleanName && initial.gender === gender && initial.vocative === cleanVocative;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onSave({ name: cleanName, vocative: cleanVocative, gender });
  };

  return (
    <form className="child-form" onSubmit={submit}>
      <label className="child-form__field" htmlFor={`${id}-name`}>
        <b>Як звати дитину?</b>
      </label>
      <input
        id={`${id}-name`}
        className="text-input"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        placeholder="Ім'я"
        onChange={(e) => changeName(e.target.value)}
      />

      <div className="child-form__field">
        <b id={`${id}-gender`}>Хто читатиме?</b>
        <small>Щоб друг у лісі казав «ти сама прочитала» чи «ти сам прочитав».</small>
      </div>
      <div className="segmented" role="radiogroup" aria-labelledby={`${id}-gender`}>
        {(
          [
            ['girl', '👧 Дівчинка'],
            ['boy', '👦 Хлопчик'],
          ] as const
        ).map(([g, label]) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={gender === g}
            className={`segmented__item ${gender === g ? 'segmented__item--active' : ''}`}
            onClick={() => changeGender(g)}
          >
            {label}
          </button>
        ))}
      </div>

      {cleanName && gender && (
        <>
          <label className="child-form__field" htmlFor={`${id}-voc`}>
            <b>Як до {gender === 'girl' ? 'неї' : 'нього'} звертатися?</b>
            <small>Друг вітатиметься: «Привіт, {cleanVocative}!» Якщо звучить не так, виправте.</small>
          </label>
          <input
            id={`${id}-voc`}
            className="text-input"
            value={vocative}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            autoCapitalize="words"
            onChange={(e) => {
              setVocative(e.target.value);
              setVocativeEdited(true);
            }}
          />
        </>
      )}

      <button
        type="submit"
        className={big ? 'big-button child-form__submit' : 'big-button big-button--small child-form__submit child-form__submit--compact'}
        disabled={!ready || unchanged}
      >
        {submitLabel}
      </button>
    </form>
  );
}
