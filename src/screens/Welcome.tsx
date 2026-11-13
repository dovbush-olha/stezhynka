import { useState } from 'react';
import { personalize, type Child } from '../content/child';
import { COURSE_STAGES, isVowelStage } from '../content/course';
import { RestoreButton } from '../components/Backup';
import { ChildForm } from '../components/ChildForm';
import { ColoredText } from '../components/ui';
import { Helper } from '../components/Helper';
import { applyKnownLetters, type KnownChoice, type KnownChoices } from '../logic/path';
import { LETTER_STATUS_LABEL, todayISO, updateSettings } from '../logic/progress';
import { updateProgress, useProgress } from '../store/progressStore';

/** Перший запуск: дорослий каже, хто гратиметься і які букви дитина вже знає. */
export function Welcome() {
  const { helper } = useProgress().settings;
  const [child, setChild] = useState<Child | null>(null);
  const [step, setStep] = useState<'name' | 'letters'>('name');
  // Відповіді про букви живуть тут, а не в кроці букв: повернувшись змінити ім'я, дорослий їх не втратить.
  const [choices, setChoices] = useState<KnownChoices>({});
  const begin = (c: Child, chosen: KnownChoices) =>
    updateProgress((s) => applyKnownLetters(updateSettings(s, { child: c }), chosen, todayISO()));

  return (
    <div className="screen welcome">
      <h1 className="logo welcome__logo">
        <span className="logo__big">Стежинка</span>
        <span className="logo__small">до читання</span>
      </h1>
      <div className="page welcome__page">
        <Helper id={helper} mood="happy" size={130} className="welcome__helper" />
        {child && step === 'letters' ? (
          <KnownLetters
            child={child}
            choices={choices}
            onChoose={(stageId, c) => setChoices((prev) => ({ ...prev, [stageId]: c }))}
            onBack={() => setStep('name')}
            onDone={(chosen) => begin(child, chosen)}
          />
        ) : (
          <>
            <h2 className="welcome__title">Давайте познайомимось!</h2>
            <p className="welcome__text">
              Тут дитина разом з лісовим другом вчиться читати українською: від букв і звуків до складів і перших слів. Для
              дорослих є окремий розділ з порадами і налаштуваннями.
            </p>
            <ChildForm
              initial={child}
              submitLabel="Далі 🐾"
              big
              onSave={(c) => {
                setChild(c);
                setStep('letters');
              }}
            />
            <div className="welcome__restore">
              <span>Уже гралися на іншому телефоні?</span>
              <RestoreButton label="📂 Завантажити прогрес з файлу" className="text-button" />
            </div>
          </>
        )}
        <p className="welcome__privacy">Ім'я та прогрес зберігаються лише на цьому пристрої й нікуди не надсилаються.</p>
      </div>
    </div>
  );
}

const CHOICES: [KnownChoice, string][] = [
  ['unknown', 'Ще не знає'],
  ['knows', LETTER_STATUS_LABEL.knows],
  ['confident', LETTER_STATUS_LABEL.confident],
];

/**
 * Нова родина одразу позначає знайомі букви, і стежка починається з першої незнайомої.
 * Ті самі правила, що й у розділі «Для дорослих»: «Знає впевнено» пропускає всі місії букви,
 * «Знає» - лише день знайомства з нею.
 */
function KnownLetters({
  child,
  choices,
  onChoose,
  onBack,
  onDone,
}: {
  child: Child;
  choices: KnownChoices;
  onChoose: (stageId: string, choice: KnownChoice) => void;
  onBack: () => void;
  onDone: (choices: KnownChoices) => void;
}) {
  const t = (text: string) => personalize(text, child);
  return (
    <div className="known-letters">
      <h2 className="welcome__title">{t('Які букви {name} вже знає?')}</h2>
      <p className="welcome__text">
        {t(
          'Якщо {name} вже вчить букви в школі, позначте знайомі. «Знає впевнено» - місії цієї букви пропустимо; «Знає» - пропустимо лише знайомство з буквою, а читання складів і слів з нею лишиться.',
        )}
      </p>
      <div className="known-letters__list">
        {COURSE_STAGES.map((stage) => {
          const vowels = isVowelStage(stage);
          const value = choices[stage.id] ?? 'unknown';
          return (
            <div key={stage.id} className="known-row">
              <span className="known-row__letters">
                <ColoredText text={stage.letters.join(vowels ? ' ' : '')} />
                {vowels && <small>голосні</small>}
              </span>
              <div className="segmented" role="radiogroup" aria-label={vowels ? 'Голосні' : `Буква ${stage.letters.join(', ')}`}>
                {CHOICES.map(([c, label]) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={value === c}
                    className={`segmented__item segmented__item--${c === 'unknown' ? 'learning' : c} ${value === c ? 'segmented__item--active' : ''}`}
                    onClick={() => onChoose(stage.id, c)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="known-letters__note">У голосних спільні місії, тож «Знає» для них лише позначає букви й нічого не пропускає.</p>
      <button type="button" className="big-button child-form__submit" onClick={() => onDone(choices)}>
        Почати 🐾
      </button>
      <div className="known-letters__links">
        <button type="button" className="text-button" onClick={onBack}>
          ← Змінити ім’я
        </button>
        <button type="button" className="text-button" onClick={() => onDone({})}>
          Почати з початку
        </button>
      </div>
    </div>
  );
}
