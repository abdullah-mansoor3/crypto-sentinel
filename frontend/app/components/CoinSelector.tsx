'use client';

import { useState } from 'react';

interface CoinSelectorProps {
  selectedCoin: string;
  onCoinChange: (coin: string) => void;
  coins?: string[];
}

const defaultCoins = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK'];

export default function CoinSelector({ selectedCoin, onCoinChange, coins = defaultCoins }: CoinSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const coinIcons: Record<string, string> = {
    BTC: '₿',
    ETH: 'Ξ',
    SOL: '◎',
    XRP: '✕',
    ADA: '₳',
    DOGE: 'Ð',
    DOT: '●',
    AVAX: '▲',
    MATIC: '⬡',
    LINK: '⬢',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-[#0d1117] border border-[#1e293b] rounded-lg hover:border-cyan-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
      >
        <span className="text-xl">{coinIcons[selectedCoin] || '○'}</span>
        <span className="font-semibold text-gray-200">{selectedCoin}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-[#0d1117] border border-[#1e293b] rounded-lg shadow-xl z-50 fade-in overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {coins.map((coin) => (
              <button
                key={coin}
                onClick={() => {
                  onCoinChange(coin);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                  coin === selectedCoin
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-gray-300 hover:bg-[#1e293b]'
                }`}
              >
                <span className="text-lg">{coinIcons[coin] || '○'}</span>
                <span className="font-medium">{coin}</span>
                {coin === selectedCoin && (
                  <svg className="w-4 h-4 ml-auto text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
