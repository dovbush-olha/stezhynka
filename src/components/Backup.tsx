import { useRef, useState } from 'react';
import { createBackupFile, deliverFile, restoreBackup } from '../audio/backup';
import { BackupError, parseBackup, type Backup } from '../logic/backup';
import { getProgress } from '../store/progressStore';
import { Modal } from './ui';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

function formatSaved(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Скільки пройдено - щоб дорослий упізнав, той це файл чи ні. */
function describe(backup: Backup): string {
  const { progress } = backup;
  const missions = Object.keys(progress.missions).length;
  const parts = [
    progress.settings.child ? progress.settings.child.name : null,
    `зірочок: ${progress.stars}`,
    `пройдено місій: ${missions}`,
    backup.recordings.length ? `записів вашого голосу: ${backup.recordings.length}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Кнопка «Завантажити з файлу» з підтвердженням. */
export function RestoreButton({ label, className, onDone }: { label: string; className: string; onDone?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof BackupError ? e.message : 'Не вдалося прочитати файл.' });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setStatus({ kind: 'busy' });
    try {
      await restoreBackup(pending);
      setPending(null);
      setStatus({ kind: 'done', text: 'Готово! Прогрес перенесено.' });
      onDone?.();
    } catch {
      setStatus({ kind: 'error', text: 'Не вдалося записати дані на цей пристрій. Спробуйте ще раз.' });
    }
  };

  const hasProgress = Object.keys(getProgress().missions).length > 0 || getProgress().stars > 0;

  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {status.kind === 'error' && <p className="backup__error">{status.text}</p>}
      {status.kind === 'done' && <p className="backup__done">{status.text}</p>}
      {pending && (
        <Modal
          title="Перенести прогрес з файлу?"
          onClose={() => setPending(null)}
          actions={
            <>
              <button type="button" className="text-button" onClick={() => setPending(null)}>
                Скасувати
              </button>
              <button type="button" className="big-button big-button--small" disabled={status.kind === 'busy'} onClick={() => void restore()}>
                {status.kind === 'busy' ? 'Переношу…' : 'Перенести'}
              </button>
            </>
          }
        >
          <p>
            Файл від {formatSaved(pending.savedAt) || 'невідомої дати'}: {describe(pending)}.
          </p>
          {hasProgress && <p className="warning">Те, що зараз є на цьому пристрої, заміниться даними з файлу.</p>}
        </Modal>
      )}
    </>
  );
}

/** Розділ «Перенести на інший телефон» у налаштуваннях. */
export function BackupPanel() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const save = async () => {
    setStatus({ kind: 'busy' });
    try {
      const file = await createBackupFile(getProgress());
      const sent = await deliverFile(file);
      setStatus(sent ? { kind: 'done', text: `Файл «${file.name}» готовий. Збережіть його у «Файли» або надішліть собі.` } : { kind: 'idle' });
    } catch {
      setStatus({ kind: 'error', text: 'Не вдалося зібрати файл. Спробуйте ще раз.' });
    }
  };

  return (
    <section className="panel backup">
      <h2 className="panel__title">Перенести на інший телефон</h2>
      <p className="panel__hint">
        Прогрес, ім'я, налаштування і записи голосу зберігаються лише на цьому пристрої. Щоб перенести їх на інший телефон
        (або на нову іконку на екрані), збережіть файл тут, а там натисніть «Завантажити з файлу».
      </p>
      <div className="backup__buttons">
        <button type="button" className="big-button big-button--small" disabled={status.kind === 'busy'} onClick={() => void save()}>
          {status.kind === 'busy' ? 'Збираю файл…' : '💾 Зберегти прогрес у файл'}
        </button>
        <RestoreButton label="📂 Завантажити з файлу" className="text-button" />
      </div>
      {status.kind === 'done' && <p className="backup__done">{status.text}</p>}
      {status.kind === 'error' && <p className="backup__error">{status.text}</p>}
    </section>
  );
}
