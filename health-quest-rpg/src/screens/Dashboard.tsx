import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import ProgressBar from '../components/ProgressBar';
import { quests as initialQuests, activeBoss, playerProfile } from '../data/mockData';
import type { Screen } from '../types';

interface Props { onNavigate: (s: Screen) => void; }

export default function Dashboard({ onNavigate }: Props) {
  const [quests, setQuests] = useState(initialQuests);

  const completed = quests.filter(q => q.completed).length;

  function toggleQuest(id: string) {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, completed: !q.completed } : q));
  }

  return (
    <>
      <div className="page">
        {/* Top Bar */}
        <div className="top-bar">
          <span className="icon icon-md" style={{ color: 'var(--primary)' }}>shield</span>
          <span className="top-bar-title">Novice Explorer</span>
          <span className="level-badge">Level {playerProfile.level - 9}</span>
          <button className="icon-btn"><span className="icon">settings</span></button>
        </div>

        {/* Hero Banner */}
        <div className="hero-banner">
          <div className="hero-name">{playerProfile.name}</div>
          <div className="hero-sub">{playerProfile.title}</div>
        </div>

        {/* Vitality & Wisdom Stats */}
        <div className="stat-row">
          <div className="stat-chip">
            <div className="stat-chip-label">Vitality</div>
            <div style={{ marginBottom: 6 }}>
              <ProgressBar value={playerProfile.vitality} max={playerProfile.maxVitality} variant="secondary" height={6} />
            </div>
            <div className="stat-chip-value">
              {playerProfile.vitality}<span>/{playerProfile.maxVitality}</span>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-label">Wisdom</div>
            <div style={{ marginBottom: 6 }}>
              <ProgressBar value={playerProfile.wisdom} variant="primary" height={6} />
            </div>
            <div className="stat-chip-value">
              {playerProfile.wisdom}<span>%</span>
            </div>
          </div>
        </div>

        {/* Daily Quests */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Daily Quests</span>
            <span className="section-meta">{completed}/{quests.length} Completed</span>
          </div>
          <div className="quest-list">
            {quests.map(quest => (
              <div
                key={quest.id}
                className={`quest-item${quest.completed ? ' completed' : ''}`}
                onClick={() => toggleQuest(quest.id)}
              >
                <div className={`quest-icon-wrap${quest.completed ? ' completed' : ''}`}>
                  <span className="icon">{quest.icon}</span>
                </div>
                <span className="quest-title">{quest.title}</span>
                {quest.completed
                  ? <span className="icon quest-check">check_circle</span>
                  : <span className="quest-exp">+{quest.exp} EXP</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Active Boss */}
        <div className="section" style={{ paddingBottom: 16 }}>
          <div className="section-header">
            <span className="section-title">Active Boss</span>
          </div>
          <div className="boss-card">
            {activeBoss.urgent && (
              <div className="urgent-badge">
                <span className="icon icon-sm">warning</span>
                URGENT
              </div>
            )}
            <div className="boss-name">{activeBoss.name}</div>
            <div className="boss-reading">{activeBoss.subtitle} · {activeBoss.reading}</div>
            <button className="battle-btn" onClick={() => onNavigate('boss')}>
              BATTLE NOW
            </button>
          </div>
        </div>
      </div>

      <BottomNav active="dashboard" onNavigate={onNavigate} />
    </>
  );
}
