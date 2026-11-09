import { useCallback, useEffect, useState } from 'react';
import type { Mission } from './content/types';
import { suspendAudio, tap } from './audio/audio';
import { loadReadings } from './audio/readings';
import { loadRecordingKeys } from './audio/recordings';
import { ForestBackground } from './components/ForestBackground';
import { buildPracticeMission, makeRng } from './logic/generate';
import { todayISO } from './logic/progress';
import { Home } from './screens/Home';
import { MissionPlayer } from './screens/MissionPlayer';
import { Parent } from './screens/Parent';
import { Welcome } from './screens/Welcome';
import { getProgress, useProgress } from './store/progressStore';

type Screen =
  | { name: 'home' }
  | { name: 'parent' }
  | { name: 'mission'; mission: Mission; practice: boolean; back: 'home' | 'parent'; run: number };

function resolveMission(m: Mission | 'practice'): { mission: Mission; practice: boolean } {
  if (m !== 'practice') return { mission: m, practice: false };
  return { mission: buildPracticeMission(getProgress(), todayISO(), makeRng(`practice-${Date.now()}`)), practice: true };
}

/** Звук на натискання кнопок і пауза звуку, коли телефон заблоковано. */
function useTapSounds() {
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const button = (e.target as HTMLElement | null)?.closest('button');
      if (button && !button.disabled) tap();
    };
    const onVisibility = () => suspendAudio(document.hidden);
    window.addEventListener('pointerdown', onPointer);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { settings } = useProgress();
  useTapSounds();

  useEffect(() => {
    void loadRecordingKeys();
    void loadReadings();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', settings.theme === 'night' ? '#1B1F3F' : '#FFF1DC');
  }, [settings.theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const start = useCallback(
    (m: Mission | 'practice', back: 'home' | 'parent') => setScreen({ name: 'mission', ...resolveMission(m), back, run: Date.now() }),
    [],
  );

  return (
    <>
      <ForestBackground night={settings.theme === 'night'} />
      <div className="app">
        {!settings.child && <Welcome />}
        {settings.child && screen.name === 'home' && <Home onStart={(m) => start(m, 'home')} onParent={() => setScreen({ name: 'parent' })} />}
        {settings.child && screen.name === 'parent' && <Parent onBack={() => setScreen({ name: 'home' })} onStart={(m) => start(m, 'parent')} />}
        {settings.child && screen.name === 'mission' && (
          <MissionPlayer
            key={screen.run}
            mission={screen.mission}
            onExit={() => setScreen(screen.back === 'home' ? { name: 'home' } : { name: 'parent' })}
            onRepeat={() => start(screen.practice ? 'practice' : screen.mission, screen.back)}
          />
        )}
      </div>
    </>
  );
}
