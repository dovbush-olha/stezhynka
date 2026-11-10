import { getProgress } from '../store/progressStore';

/**
 * Усі звуки синтезуються в браузері (Web Audio) - без файлів і без синтезатора мовлення.
 * Звуки букв говорить дорослий наживо або власним записом (див. recordings.ts).
 */
let ctx: AudioContext | undefined;
let sfxBus: GainNode | undefined;

function audio(): AudioContext | undefined {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(ctx.destination);
    }
    // iOS після мікрофона чи дзвінка лишає контекст «interrupted», а не «suspended».
    if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine', out?: AudioNode) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(out ?? sfxBus!);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

let micOpen = false;
const sfxOn = () => getProgress().settings.sounds && !micOpen;

/**
 * Поки відкритий мікрофон, звуки застосунку мовчать: інакше «бульбашка» від дотику
 * чи дзвіночок потрапляють у запис. Те, що вже звучить, глушимо одразу.
 */
export function setMicOpen(open: boolean) {
  micOpen = open;
  if (!ctx || !sfxBus) return;
  sfxBus.gain.cancelScheduledValues(ctx.currentTime);
  sfxBus.gain.setValueAtTime(open ? 0 : 1, ctx.currentTime);
}

/** М'яка «бульбашка» на кожне натискання: короткий тон, що швидко ковзає вгору. */
export function tap() {
  if (!sfxOn()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(820, t + 0.05);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  osc.connect(g).connect(sfxBus!);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** Дзвіночок за правильну відповідь. */
export function chime() {
  if (!sfxOn()) return;
  tone(1047, 0, 0.5, 0.09);
  tone(1568, 0.09, 0.6, 0.07);
  tone(2093, 0.18, 0.7, 0.04);
}

/** Зірочка летить у баночку. */
export function sparkle() {
  if (!sfxOn()) return;
  [1760, 2217, 2637].forEach((f, i) => tone(f, i * 0.05, 0.25, 0.025));
}

/** Свято в кінці місії. */
export function fanfare() {
  if (!sfxOn()) return;
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.6, 0.07, 'triangle'));
}

/** Пауза, коли вкладку сховано (телефон заблоковано). */
export function suspendAudio(hidden: boolean) {
  if (!ctx) return;
  if (hidden) void ctx.suspend();
  else void ctx.resume();
}
