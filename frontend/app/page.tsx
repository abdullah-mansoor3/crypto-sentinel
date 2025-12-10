'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoadingPage } from './components/LoadingSpinner';

interface SupportedCoin {
  symbol: string;
  name: string;
  id: string;
}

interface DataSource {
  name: string;
  type: string;
  description: string;
}

interface Feature {
  id?: string;
  name?: string;
  title?: string;
  description: string;
  route?: string;
  icon?: string;
  highlights?: string[];
  status?: string;
}

interface AboutData {
  name: string;
  tagline: string;
  version: string;
  description: string;
  features: Feature[];
  supported_coins: SupportedCoin[];
  data_sources: DataSource[];
  tech_stack: {
    backend: string[];
    frontend: string[];
    ai_ml?: string[];
    ai?: string[];
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAbout() {
      try {
        const res = await fetch(`${API_BASE}/api/about`);
        if (!res.ok) throw new Error('Failed to fetch about data');
        const data = await res.json();
        setAboutData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchAbout();
  }, []);

  if (loading) return <LoadingPage />;

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center neon-card p-8 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Make sure the backend server is running on port 8000</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-pattern">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="text-center fade-in">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 mb-8 pulse-glow">
              <span className="text-5xl">🛡️</span>
            </div>
            
            {/* Title */}
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {aboutData?.name || 'CryptoSentinel'}
              </span>
            </h1>
            
            {/* Tagline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-6 max-w-2xl mx-auto">
              {aboutData?.tagline}
            </p>
            
            {/* Version badge */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 mb-8">
              v{aboutData?.version}
            </span>
            
            {/* Description */}
            <p className="text-gray-400 max-w-3xl mx-auto mb-12">
              {aboutData?.description}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/technical" className="neon-btn">
                Start Analyzing →
              </Link>
              <Link href="/ai" className="neon-btn neon-btn-purple">
                Try AI Analysis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4 fade-in">
            <span className="neon-text-cyan">Powerful</span> Analysis Tools
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto fade-in-delay-1">
            Everything you need to make informed trading decisions
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(aboutData?.features ?? []).map((feature, index) => {
              // Backend uses "id" for route and "title" for name
              const featureId = feature?.id || '';
              const href = feature?.route || (featureId ? `/${featureId}` : '#');
              const name = feature?.title || feature?.name || `Feature ${index + 1}`;
              const isComingSoon = feature?.status === 'coming_soon';
              
              if (!feature) return null;
              
              return (
                <Link
                  key={`${featureId}-${index}`}
                  href={isComingSoon ? '#' : href}
                  className={`neon-card p-6 group cursor-pointer fade-in-delay-${Math.min(index + 1, 3)} ${isComingSoon ? 'opacity-70' : ''}`}
                >
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon || '✨'}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-200 group-hover:text-cyan-400 transition-colors">
                      {name}
                    </h3>
                    {isComingSoon && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {feature.description || 'Explore detailed analytics'}
                  </p>
                  {feature.highlights && feature.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {feature.highlights.slice(0, 2).map((h, i) => (
                        <li key={i} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="text-cyan-400">•</span> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!isComingSoon && (
                    <div className="mt-4 text-cyan-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      Explore →
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supported Coins Section */}
      <section className="py-20 bg-[#0d1117]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 fade-in">
            <span className="neon-text-purple">Supported</span> Cryptocurrencies
          </h2>
          
          <div className="flex flex-wrap justify-center gap-4">
            {(aboutData?.supported_coins ?? []).map((coin, index) => {
              // Handle both string format and object format {symbol, name, id}
              const symbol = typeof coin === 'string' ? coin : coin?.symbol || '';
              const name = typeof coin === 'string' ? coin : coin?.name || '';
              const displayLabel = name && symbol ? `${name} (${symbol})` : symbol || name || 'Unknown';
              
              const coinIcons: Record<string, string> = {
                BTC: '₿', ETH: 'Ξ', SOL: '◎', XRP: '✕', ADA: '₳',
                DOGE: 'Ð', BNB: '◆', DOT: '●', AVAX: '▲', MATIC: '⬡',
              };
              
              return (
                <div
                  key={`${symbol}-${index}`}
                  className="px-5 py-3 neon-card hover:border-purple-500/50 cursor-default transition-all flex items-center gap-3"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <span className="text-xl text-purple-400">{coinIcons[symbol] || '○'}</span>
                  <span className="font-semibold text-gray-200">{displayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="neon-text-green">Technology</span> Stack
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Backend */}
            <div className="neon-card p-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center">
                <span className="mr-2">⚙️</span> Backend
              </h3>
              <div className="flex flex-wrap gap-2">
                {(aboutData?.tech_stack?.backend ?? []).map((tech, idx) => {
                  const label = typeof tech === 'string' ? tech : JSON.stringify(tech);
                  return (
                    <span key={`${label}-${idx}`} className="px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-full text-sm">
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
            
            {/* Frontend */}
            <div className="neon-card p-6">
              <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center">
                <span className="mr-2">🎨</span> Frontend
              </h3>
              <div className="flex flex-wrap gap-2">
                {(aboutData?.tech_stack?.frontend ?? []).map((tech, idx) => {
                  const label = typeof tech === 'string' ? tech : JSON.stringify(tech);
                  return (
                    <span key={`${label}-${idx}`} className="px-3 py-1 bg-purple-500/10 text-purple-300 rounded-full text-sm">
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
            
            {/* AI/ML */}
            <div className="neon-card p-6">
              <h3 className="text-lg font-semibold text-pink-400 mb-4 flex items-center">
                <span className="mr-2">🤖</span> AI / ML
              </h3>
              <div className="flex flex-wrap gap-2">
                {(aboutData?.tech_stack?.ai_ml ?? aboutData?.tech_stack?.ai ?? []).map((tech, idx) => {
                  const label = typeof tech === 'string' ? tech : JSON.stringify(tech);
                  return (
                    <span key={`${label}-${idx}`} className="px-3 py-1 bg-pink-500/10 text-pink-300 rounded-full text-sm">
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-20 bg-[#0d1117]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-8">
            <span className="neon-text-cyan">Real-Time</span> Data Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {(aboutData?.data_sources ?? []).map((source, idx) => {
              // Handle both string format and object format {name, type, description}
              const name = typeof source === 'string' ? source : source?.name || 'Unknown';
              const type = typeof source === 'string' ? '' : source?.type || '';
              const description = typeof source === 'string' ? '' : source?.description || '';
              
              return (
                <div key={`${name}-${idx}`} className="neon-card p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="font-semibold text-gray-200">{name}</span>
                  </div>
                  {type && (
                    <span className="inline-block px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-full mb-2">
                      {type}
                    </span>
                  )}
                  {description && (
                    <p className="text-xs text-gray-500">{description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <span className="text-2xl">🛡️</span>
              <span className="font-bold text-gray-200">CryptoSentinel</span>
            </div>
            <p className="text-sm text-gray-500">
              Built for educational purposes. Not financial advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
