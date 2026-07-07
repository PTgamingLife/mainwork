import { useState } from 'react';
import type { Screen } from './types';
import Dashboard from './screens/Dashboard';
import BossBattle from './screens/BossBattle';
import Inventory from './screens/Inventory';
import Profile from './screens/Profile';

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');

  const navigate = (s: Screen) => setScreen(s);

  return (
    <div className="app-shell">
      <div className="phone-frame">
        {screen === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {screen === 'boss'      && <BossBattle onNavigate={navigate} />}
        {screen === 'inventory' && <Inventory  onNavigate={navigate} />}
        {screen === 'profile'   && <Profile    onNavigate={navigate} />}
      </div>
    </div>
  );
}
