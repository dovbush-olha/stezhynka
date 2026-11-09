import { ChildForm } from '../components/ChildForm';
import { Helper } from '../components/Helper';
import { updateSettings } from '../logic/progress';
import { updateProgress, useProgress } from '../store/progressStore';

/** Перший запуск: дорослий каже, хто гратиметься. */
export function Welcome() {
  const { helper } = useProgress().settings;
  return (
    <div className="screen welcome">
      <h1 className="logo welcome__logo">
        <span className="logo__big">Стежинка</span>
        <span className="logo__small">до читання</span>
      </h1>
      <div className="page welcome__page">
        <Helper id={helper} mood="happy" size={130} className="welcome__helper" />
        <h2 className="welcome__title">Давайте познайомимось!</h2>
        <p className="welcome__text">
          Тут дитина разом з лісовим другом вчиться читати українською: від букв і звуків до складів і перших слів. Для дорослих
          є окремий розділ з порадами і налаштуваннями.
        </p>
        <ChildForm initial={null} submitLabel="Почати 🐾" big onSave={(child) => updateProgress((s) => updateSettings(s, { child }))} />
        <p className="welcome__privacy">Ім'я та прогрес зберігаються лише на цьому пристрої й нікуди не надсилаються.</p>
      </div>
    </div>
  );
}
