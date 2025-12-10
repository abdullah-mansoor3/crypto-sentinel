'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  formula?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'cyan' | 'purple' | 'green' | 'orange' | 'pink' | 'red';
  className?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  formula,
  icon,
  trend,
  color = 'cyan',
  className = '',
}: MetricCardProps) {
  const colorClasses = {
    cyan: {
      border: 'hover:border-cyan-500/50',
      glow: 'hover:shadow-cyan-500/10',
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    purple: {
      border: 'hover:border-purple-500/50',
      glow: 'hover:shadow-purple-500/10',
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    green: {
      border: 'hover:border-green-500/50',
      glow: 'hover:shadow-green-500/10',
      text: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    orange: {
      border: 'hover:border-orange-500/50',
      glow: 'hover:shadow-orange-500/10',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    pink: {
      border: 'hover:border-pink-500/50',
      glow: 'hover:shadow-pink-500/10',
      text: 'text-pink-400',
      bg: 'bg-pink-500/10',
    },
    red: {
      border: 'hover:border-red-500/50',
      glow: 'hover:shadow-red-500/10',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  };

  const colors = colorClasses[color];

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : '';

  return (
    <div
      className={`group relative neon-card p-4 ${colors.border} ${colors.glow} hover:shadow-lg transition-all duration-300 ${className}`}
    >
      {/* Header with title and formula tooltip */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {icon && <span className={`text-lg ${colors.text}`}>{icon}</span>}
          <h3 className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors cursor-help">
            {title}
            {formula && (
              <span className="ml-1 text-xs text-gray-500">ⓘ</span>
            )}
          </h3>
        </div>
        {trend && (
          <span className={`text-sm font-semibold ${trendColor}`}>{trendIcon}</span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl font-bold ${colors.text}`}>{value}</span>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
      </div>

      {/* Formula tooltip on hover */}
      {formula && (
        <div className="absolute bottom-full left-0 right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <div className="bg-[#1e293b] border border-cyan-500/30 rounded-lg p-3 shadow-xl mx-2">
            <p className="text-xs text-gray-400 mb-1">Formula:</p>
            <code className="text-xs text-cyan-300 font-mono break-all">{formula}</code>
          </div>
        </div>
      )}
    </div>
  );
}
