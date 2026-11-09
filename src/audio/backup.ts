import { BACKUP_APP, BACKUP_FORMAT, backupFileName, base64ToBytes, bytesToBase64, type Backup } from '../logic/backup';
import type { ProgressState } from '../logic/progress';
import { replaceProgress } from '../store/progressStore';
import { tx, txAll } from './db';
import { loadReadings } from './readings';
import { loadRecordingKeys } from './recordings';

interface StoredReading {
  id: string;
  text: string;
  at: string;
  blob: Blob;
}

async function encode(blob: Blob) {
  return { type: blob.type, data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
}

const decode = (a: { type: string; data: string }) => new Blob([base64ToBytes(a.data)], { type: a.type });

/** Усе з цього пристрою - в один файл. */
export async function createBackupFile(progress: ProgressState): Promise<File> {
  const [keys, blobs, readings] = await Promise.all([
    tx<IDBValidKey[]>('recordings', 'readonly', (s) => s.getAllKeys()),
    tx<Blob[]>('recordings', 'readonly', (s) => s.getAll()),
    tx<StoredReading[]>('readings', 'readonly', (s) => s.getAll()),
  ]);
  const backup: Backup = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    savedAt: new Date().toISOString(),
    progress,
    recordings: await Promise.all(blobs.map(async (b, i) => ({ key: String(keys[i]), ...(await encode(b)) }))),
    readings: await Promise.all(readings.map(async ({ id, text, at, blob }) => ({ id, text, at, ...(await encode(blob)) }))),
  };
  return new File([JSON.stringify(backup)], backupFileName(progress.settings.child), { type: 'application/json' });
}

/**
 * Віддає файл дорослому. На телефоні - через «Поділитися» (iPhone не завантажує файли з іконки на екрані),
 * на комп'ютері - звичайне завантаження. false - дорослий передумав.
 */
export async function deliverFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Поділитися не вийшло - пробуємо завантажити.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Замінює все на цьому пристрої вмістом файлу. */
export async function restoreBackup(backup: Backup) {
  await txAll('recordings', (s) => {
    s.clear();
    for (const r of backup.recordings) s.put(decode(r), r.key);
  });
  await txAll('readings', (s) => {
    s.clear();
    for (const r of backup.readings) s.put({ id: r.id, text: r.text, at: r.at, blob: decode(r) } satisfies StoredReading);
  });
  replaceProgress(backup.progress);
  await Promise.all([loadRecordingKeys(), loadReadings()]);
}
