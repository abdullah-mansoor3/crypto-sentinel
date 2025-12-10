'use client';

interface StatusPillProps {
  status: 'bullish' | 'bearish' | 'neutral' | 'ranging' | 'positive' | 'negative' | string;
  text?: string;
}

export default function StatusPill({ status, text }: StatusPillProps) {
  const normalizedStatus = status.toLowerCase();
  
  const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
    bullish: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
    positive: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
    bearish: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    negative: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    neutral: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
    ranging: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    trending: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
    accumulation: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
    distribution: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
    high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    medium: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
    strong: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
    weak: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  };

  const style = statusStyles[normalizedStatus] || statusStyles.neutral;
  const displayText = text || status;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border} transition-all hover:scale-105`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')} mr-2`}></span>
      {displayText.charAt(0).toUpperCase() + displayText.slice(1)}
    </span>
  );
}
