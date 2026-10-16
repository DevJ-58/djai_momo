import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';

export function StatCard({
  label,
  value,
  change,
  description,
  trend = 'up',
  icon,
}: {
  label: string;
  value: string;
  change?: string;
  description?: string;
  trend?: 'up' | 'down';
  icon: ReactNode;
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="stat-card">
      <div className="stat-topline">
        <span className="stat-icon">{icon}</span>
        {change && (
          <span className={`stat-change trend-${trend}`}>
            <TrendIcon size={16} aria-hidden="true" />{change}
          </span>
        )}
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {description && <p className="stat-description">{description}</p>}
    </Card>
  );
}
