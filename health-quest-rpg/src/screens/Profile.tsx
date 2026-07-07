import BottomNav from '../components/BottomNav';
import { playerProfile, achievements } from '../data/mockData';
import type { Screen } from '../types';

interface Props { onNavigate: (s: Screen) => void; }

const profileStats = [
  { label: 'Strength', subLabel: 'BMI', value: String(playerProfile.bmi), icon: 'fitness_center' },
  { label: 'Agility',  subLabel: 'Cardio', value: playerProfile.cardio, icon: 'directions_run' },
  { label: 'Vitality', subLabel: 'Sleep', value: `${playerProfile.sleepHours}hrs`, icon: 'bedtime' },
  { label: 'Intellect',subLabel: 'Focus', value: playerProfile.focus, icon: 'psychology' },
];

const menuItems = [
  { label: 'Account Settings', icon: 'manage_accounts', danger: false },
  { label: 'Notifications',    icon: 'notifications_active', danger: false },
  { label: 'Help & Support',   icon: 'quiz', danger: false },
  { label: 'Abandon Quest',    icon: 'logout', danger: true },
];

export default function Profile({ onNavigate }: Props) {
  return (
    <>
      <div className="page">
        {/* Top Bar */}
        <div className="top-bar">
          <span className="top-bar-title">Character Profile</span>
          <button className="icon-btn"><span className="icon">settings</span></button>
        </div>

        {/* Profile Hero */}
        <div className="profile-hero">
          <div className="avatar">⚔️</div>
          <div className="profile-name">{playerProfile.name}</div>
          <div className="profile-title">{playerProfile.title}</div>
          <div className="profile-level">LVL {playerProfile.level}</div>
        </div>

        {/* RPG Stats Grid */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Adventurer Stats</span>
          </div>
          <div className="profile-stat-grid">
            {profileStats.map(s => (
              <div key={s.label} className="profile-stat-card">
                <div className="profile-stat-icon">
                  <span className="icon">{s.icon}</span>
                </div>
                <div className="profile-stat-name">{s.label}</div>
                <div className="profile-stat-label">{s.subLabel}</div>
                <div className="profile-stat-value">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trophy Hall */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Trophy Hall</span>
            <button
              className="section-meta"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}
            >
              View All →
            </button>
          </div>
          <div className="trophy-grid">
            {achievements.map(a => (
              <div key={a.id} className={`trophy-item${a.unlocked ? '' : ' locked'}`}>
                <div className="trophy-icon-wrap">
                  <span className="icon">{a.unlocked ? a.icon : 'lock'}</span>
                </div>
                <span className="trophy-name">{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Menu */}
        <div className="section" style={{ paddingBottom: 16 }}>
          <div className="section-header">
            <span className="section-title">Adventurer's Options</span>
          </div>
          <div className="menu-list" style={{ background: 'var(--surface-container-low)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--outline-variant)' }}>
            {menuItems.map(item => (
              <button key={item.label} className={`menu-item${item.danger ? ' danger' : ''}`}>
                <span className="menu-item-icon">
                  <span className="icon">{item.icon}</span>
                </span>
                <span className="menu-item-label">{item.label}</span>
                <span className="menu-item-chevron">
                  <span className="icon icon-sm">chevron_right</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="profile" onNavigate={onNavigate} />
    </>
  );
}
