'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div
        className={`${sizeClasses[size]} border-[#1e293b] border-t-cyan-400 rounded-full animate-spin`}
      />
      {text && (
        <p className="text-sm text-gray-400 animate-pulse">{text}</p>
      )}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="neon-card p-6 animate-pulse">
      <div className="h-4 bg-[#1e293b] rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-[#1e293b] rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-[#1e293b] rounded w-2/3"></div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-[#1e293b] rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-4 border-t-purple-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}></div>
        </div>
        <p className="text-gray-400 animate-pulse">Loading data...</p>
      </div>
    </div>
  );
}
