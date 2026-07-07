interface Props {
  value: number;
  max?: number;
  variant?: 'primary' | 'secondary' | 'error' | 'success';
  height?: number;
}

export default function ProgressBar({ value, max = 100, variant = 'primary', height = 10 }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="progress-bar-track" style={{ height }}>
      <div
        className={`progress-bar-fill fill-${variant}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
