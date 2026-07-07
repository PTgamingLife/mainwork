import BottomNav from '../components/BottomNav';
import { healthStats, ledgerEntries } from '../data/mockData';
import type { Screen, HealthStat } from '../types';

interface Props { onNavigate: (s: Screen) => void; }

const chartHeights = [30, 45, 35, 55, 40, 60, 50];

function rarityClass(rarity: HealthStat['rarity']) {
  const map: Record<HealthStat['rarity'], string> = {
    'Exotic Rarity':  'rarity-exotic',
    'Common Rarity':  'rarity-common',
    'Masterwork':     'rarity-masterwork',
    'Sturdy':         'rarity-sturdy',
    'Cursed?':        'rarity-cursed',
  };
  return map[rarity];
}

function statusClass(status: HealthStat['status']) {
  const map: Record<HealthStat['status'], string> = {
    'Excellent':       'status-excellent',
    'Healthy':         'status-healthy',
    'Needs Attention': 'status-warning',
    'Restored':        'status-restored',
  };
  return map[status];
}

export default function Inventory({ onNavigate }: Props) {
  return (
    <>
      <div className="page">
        {/* Top Bar */}
        <div className="top-bar">
          <span className="icon icon-md" style={{ color: 'var(--primary)' }}>inventory_2</span>
          <span className="top-bar-title">Adventurer's Inventory</span>
          <button className="icon-btn"><span className="icon">settings</span></button>
        </div>

        {/* Map of Vitality */}
        <div className="section">
          <div className="vitality-map">
            <div className="vitality-map-title">Map of Vitality</div>
            <div className="vitality-map-sub">The Journey of Data · Last moon cycle</div>
            <div className="vitality-chart">
              {chartHeights.map((h, i) => (
                <div
                  key={i}
                  className={`chart-bar${i === chartHeights.length - 1 ? ' today' : ''}`}
                  style={{ height: h }}
                  title={i === chartHeights.length - 1 ? 'Today' : `Day ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Health Stats */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Stat Attributes</span>
          </div>
          <div className="stat-card-list">
            {healthStats.map(stat => (
              <div key={stat.id} className={`stat-card${stat.rarity === 'Cursed?' ? ' cursed' : ''}`}>
                <div className="stat-card-icon-wrap">
                  <span className="icon icon-md">{stat.icon}</span>
                </div>
                <div className="stat-card-body">
                  <div className="stat-card-real">{stat.realName}</div>
                  <div className="stat-card-game">{stat.gameName}</div>
                  <div className="stat-card-value">{stat.value}</div>
                </div>
                <div className="stat-card-right">
                  <span className={`rarity-badge ${rarityClass(stat.rarity)}`}>{stat.rarity}</span>
                  <span className={`status-badge ${statusClass(stat.status)}`}>{stat.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="add-btn">
              <span className="icon">add_circle</span>
              Identify New Attribute
            </button>
          </div>
        </div>

        {/* Quest Ledger */}
        <div className="section" style={{ paddingBottom: 16 }}>
          <div className="section-header">
            <span className="section-title">Quest Ledger</span>
          </div>
          <div className="ledger-list">
            {ledgerEntries.map((entry, i) => (
              <div key={i} className="ledger-item">
                <span className="ledger-date">{entry.date}</span>
                <span className="ledger-desc">{entry.description}</span>
                <span className="ledger-xp">+{entry.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="inventory" onNavigate={onNavigate} />
    </>
  );
}
