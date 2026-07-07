import BottomNav from '../components/BottomNav';
import ProgressBar from '../components/ProgressBar';
import { activeBoss, bossWeaknesses, bossSkills } from '../data/mockData';
import type { Screen } from '../types';

interface Props { onNavigate: (s: Screen) => void; }

const severityClass: Record<string, string> = {
  Critical:    'severity-critical',
  Weak:        'severity-weak',
  Vulnerable:  'severity-vulnerable',
};

export default function BossBattle({ onNavigate }: Props) {
  return (
    <>
      <div className="page">
        {/* Top Bar */}
        <div className="top-bar">
          <button className="top-bar-back" onClick={() => onNavigate('dashboard')}>
            <span className="icon">arrow_back</span>
          </button>
          <span className="top-bar-title">Boss Encounter</span>
          <span className="level-badge">Novice Explorer</span>
          <button className="icon-btn"><span className="icon">settings</span></button>
        </div>

        {/* Boss Display */}
        <div className="boss-display">
          <div className="boss-emoji">🦹</div>
          <div style={{ width: '100%', marginBottom: 4 }}>
            <div className="boss-hp-label">
              <span style={{ color: 'var(--tertiary)', fontWeight: 700 }}>HP {activeBoss.hpPercent}%</span>
              &nbsp;·&nbsp;The Silent Guardian of Pressure
            </div>
            <ProgressBar value={activeBoss.hpPercent} variant="error" height={12} />
          </div>
          <div className="boss-subtitle" style={{ marginBottom: 8 }}>
            {activeBoss.subtitle} · {activeBoss.reading}
          </div>
        </div>

        {/* Weaknesses */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Boss Weaknesses</span>
          </div>
          <div className="weakness-grid">
            {bossWeaknesses.map(w => (
              <div key={w.label} className="weakness-card">
                <div className="weakness-icon-wrap">
                  <span className="icon">{w.icon}</span>
                </div>
                <span className="weakness-label">{w.label}</span>
                <span className={`severity-badge ${severityClass[w.severity]}`}>{w.severity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Combat Skills</span>
          </div>
          <div className="skill-grid">
            {bossSkills.map(s => (
              <div key={s.name} className="skill-card">
                <div className="skill-icon-wrap">
                  <span className="icon">{s.icon}</span>
                </div>
                <div className="skill-name">{s.name}</div>
                <div className="skill-effect">{s.effect}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="cta-wrap">
          <button className="cta-btn" onClick={() => onNavigate('dashboard')}>
            Start Treatment Plan
          </button>
        </div>
      </div>

      <BottomNav active="boss" onNavigate={onNavigate} />
    </>
  );
}
