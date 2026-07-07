import type { Screen } from '../types';

interface Props {
  active: Screen;
  onNavigate: (s: Screen) => void;
}

const items: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'dashboard', icon: 'home',          label: 'Home' },
  { screen: 'boss',      icon: 'swords',         label: 'Quests' },
  { screen: 'inventory', icon: 'inventory_2',    label: 'Inventory' },
  { screen: 'profile',   icon: 'person',         label: 'Profile' },
];

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      {items.map(({ screen, icon, label }) => (
        <button
          key={screen}
          className={`nav-item${active === screen ? ' active' : ''}`}
          onClick={() => onNavigate(screen)}
        >
          <span className="icon">{icon}</span>
          <span className="nav-item-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
