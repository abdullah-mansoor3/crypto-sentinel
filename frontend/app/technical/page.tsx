'use client';

import { useEffect, useRef, useState } from 'react';
import CoinSelector from '../components/CoinSelector';
import MetricCard from '../components/MetricCard';
import StatusPill from '../components/StatusPill';
import { LoadingPage, LoadingCard } from '../components/LoadingSpinner';

interface OHLCVData {
  timestamp: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

interface IndicatorData {
  ema?: Record<string, (number | null)[]>;  // {"10": [], "20": [], "50": []}
  rsi?: (number | null)[];
  macd?: {
    macd: (number | null)[];
    signal: (number | null)[];
    hist: (number | null)[];  // Backend uses "hist" not "histogram"
  };
  bbands?: {
    upper: (number | null)[];
    mid: (number | null)[];  // Backend uses "mid" not "middle"
    lower: (number | null)[];
  };
}

interface TechnicalData {
  ohlcv: OHLCVData;
  indicators: IndicatorData;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const indicatorOptions = [
  { key: 'ema20', label: 'EMA (20)', color: '#22c55e' },
  { key: 'ema50', label: 'EMA (50)', color: '#f59e0b' },
  { key: 'ema100', label: 'EMA (100)', color: '#ec4899' },
  { key: 'ema200', label: 'EMA (200)', color: '#8b5cf6' },
  { key: 'rsi', label: 'RSI (14)', color: '#06b6d4' },
  { key: 'macd', label: 'MACD', color: '#f97316' },
  { key: 'bbands', label: 'Bollinger Bands', color: '#a855f7' },
];

export default function TechnicalPage() {
  const [coin, setCoin] = useState('BTC');
  const [days, setDays] = useState(90);
  const [data, setData] = useState<TechnicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<Record<string, boolean>>({
    ema20: true,
    ema50: true,
    ema100: false,
    ema200: false,
    rsi: true,
    macd: true,
    bbands: false,
  });
  
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);
  const [chartLoaded, setChartLoaded] = useState(false);

  // Load Chart.js
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as unknown as { Chart: unknown }).Chart) {
      setChartLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => setChartLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const indicators = Object.entries(activeIndicators)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(',');
        
        const res = await fetch(
          `${API_BASE}/api/data?symbol=${coin}&days=${days}&indicators=${indicators}`
        );
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [coin, days, activeIndicators]);

  // Render chart
  useEffect(() => {
    if (!chartLoaded || !chartRef.current || !data?.ohlcv) return;

    const Chart = (window as unknown as { Chart: new (ctx: CanvasRenderingContext2D, config: unknown) => { destroy: () => void } }).Chart;
    if (!Chart) return;

    if (chartInstance.current) {
      (chartInstance.current as { destroy: () => void }).destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = data.ohlcv.timestamp.map((ts) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    interface Dataset {
      label: string;
      data: (number | null)[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      fill: boolean;
      tension: number;
      yAxisID: string;
      pointRadius: number;
      borderDash?: number[];
    }

    const datasets: Dataset[] = [
      {
        label: `${coin} Price`,
        data: data.ohlcv.close,
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
      },
    ];

    // Add EMA (20)
    if (activeIndicators.ema20 && data.indicators?.ema?.['20']) {
      datasets.push({
        label: 'EMA (20)',
        data: data.indicators.ema['20'],
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
      });
    }

    // Add EMA (50)
    if (activeIndicators.ema50 && data.indicators?.ema?.['50']) {
      datasets.push({
        label: 'EMA (50)',
        data: data.indicators.ema['50'],
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
      });
    }

    // Add EMA (100)
    if (activeIndicators.ema100 && data.indicators?.ema?.['100']) {
      datasets.push({
        label: 'EMA (100)',
        data: data.indicators.ema['100'],
        borderColor: '#ec4899',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
      });
    }

    // Add EMA (200)
    if (activeIndicators.ema200 && data.indicators?.ema?.['200']) {
      datasets.push({
        label: 'EMA (200)',
        data: data.indicators.ema['200'],
        borderColor: '#8b5cf6',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
      });
    }

    // Add Bollinger Bands
    if (activeIndicators.bbands && data.indicators?.bbands) {
      datasets.push(
        {
          label: 'BB Upper',
          data: data.indicators.bbands.upper,
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          borderWidth: 1,
          fill: false,
          tension: 0.4,
          yAxisID: 'y',
          pointRadius: 0,
          borderDash: [5, 5],
        },
        {
          label: 'BB Middle',
          data: data.indicators.bbands.mid,  // Backend uses "mid" not "middle"
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          fill: false,
          tension: 0.4,
          yAxisID: 'y',
          pointRadius: 0,
        },
        {
          label: 'BB Lower',
          data: data.indicators.bbands.lower,
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          borderWidth: 1,
          fill: false,
          tension: 0.4,
          yAxisID: 'y',
          pointRadius: 0,
          borderDash: [5, 5],
        }
      );
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', usePointStyle: true, padding: 20 },
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e0e0e0',
            bodyColor: '#94a3b8',
            borderColor: '#00f0ff',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context: { dataset: { label: string }; parsed: { y: number } }) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label.includes('Price')) {
                  return `${label}: $${value?.toLocaleString()}`;
                }
                if (label.includes('BB')) {
                  return `${label}: $${value?.toLocaleString()}`;
                }
                if (label.includes('EMA')) {
                  return `${label}: $${value?.toLocaleString()}`;
                }
                return `${label}: ${value?.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(30, 41, 59, 0.5)' },
            ticks: { color: '#64748b' },
          },
          y: {
            position: 'right',
            grid: { color: 'rgba(30, 41, 59, 0.5)' },
            ticks: {
              color: '#64748b',
              callback: (value: number | string) => '$' + Number(value).toLocaleString(),
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, [chartLoaded, data, activeIndicators, coin]);

  const toggleIndicator = (key: string) => {
    setActiveIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Get latest values
  const latestPrice = data?.ohlcv?.close?.[data.ohlcv.close.length - 1];
  const previousPrice = data?.ohlcv?.close?.[data.ohlcv.close.length - 2];
  const priceChange = latestPrice && previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;
  
  const latestRSI = data?.indicators?.rsi?.[data.indicators.rsi.length - 1];
  const latestMACD = data?.indicators?.macd;
  
  const rsiStatus = latestRSI ? (latestRSI > 70 ? 'bearish' : latestRSI < 30 ? 'bullish' : 'neutral') : 'neutral';

  if (loading && !data) return <LoadingPage />;

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 fade-in relative z-30">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="neon-text-cyan">Technical</span> Analysis
            </h1>
            <p className="text-gray-400">Real-time price charts with technical indicators</p>
          </div>
          
          <div className="flex items-center gap-4 relative z-40">
            <CoinSelector selectedCoin={coin} onCoinChange={setCoin} />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 bg-[#0d1117] border border-[#1e293b] rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>1 Year</option>
            </select>
            <button
              onClick={() => {
                setLoading(true);
                fetch(
                  `${API_BASE}/api/data?symbol=${coin}&days=${days}&force=true`
                )
                  .then((res) => res.json())
                  .then((json) => setData(json))
                  .catch((err) => setError(err.message))
                  .finally(() => setLoading(false));
              }}
              className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-2"
              title="Refresh data (bypass cache)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg fade-in">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-in-delay-1">
          <MetricCard
            title="Current Price"
            value={latestPrice ? `$${latestPrice.toLocaleString()}` : '--'}
            trend={priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'neutral'}
            subtitle={`${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
            color="cyan"
          />
          <MetricCard
            title="24h High"
            value={data?.ohlcv?.high ? `$${Math.max(...data.ohlcv.high.slice(-24)).toLocaleString()}` : '--'}
            color="green"
          />
          <MetricCard
            title="24h Low"
            value={data?.ohlcv?.low ? `$${Math.min(...data.ohlcv.low.slice(-24)).toLocaleString()}` : '--'}
            color="red"
          />
          <MetricCard
            title="Volume"
            value={data?.ohlcv?.volume ? `$${(data.ohlcv.volume[data.ohlcv.volume.length - 1] / 1e9).toFixed(2)}B` : '--'}
            color="purple"
          />
        </div>

        {/* Chart Section */}
        <div className="neon-card p-6 mb-8 fade-in-delay-2">
          {/* Header with Timeframe */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-200">{coin}/USD</h3>
              <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                {days}D Timeframe
              </span>
            </div>
            {data?.ohlcv?.timestamp && (
              <span className="text-xs text-gray-500">
                Last update: {new Date(data.ohlcv.timestamp[data.ohlcv.timestamp.length - 1]).toLocaleString()}
              </span>
            )}
          </div>
          
          {/* Indicator Toggles */}
          <div className="flex flex-wrap gap-2 mb-6">
            {indicatorOptions.map((ind) => (
              <button
                key={ind.key}
                onClick={() => toggleIndicator(ind.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeIndicators[ind.key]
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-[#1e293b] text-gray-400 border border-transparent hover:border-gray-600'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: ind.color }}
                ></span>
                {ind.label}
              </button>
            ))}
          </div>

          {/* Price Chart */}
          <div className="h-[400px] relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/50 z-10">
                <div className="spinner"></div>
              </div>
            )}
            <canvas ref={chartRef}></canvas>
          </div>

          {/* Volume Chart */}
          {data?.ohlcv?.volume && (
            <div className="mt-4 pt-4 border-t border-[#1e293b]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Volume</h4>
                <span className="text-xs text-gray-500">
                  Avg: ${((data.ohlcv.volume.reduce((a, b) => a + b, 0) / data.ohlcv.volume.length) / 1e9).toFixed(2)}B
                </span>
              </div>
              <div className="h-[80px] flex items-end gap-[1px]">
                {data.ohlcv.volume.slice(-60).map((vol, idx, arr) => {
                  const maxVol = Math.max(...arr);
                  const height = maxVol > 0 ? (vol / maxVol) * 100 : 0;
                  const prevClose = data.ohlcv.close[data.ohlcv.close.length - arr.length + idx - 1];
                  const currClose = data.ohlcv.close[data.ohlcv.close.length - arr.length + idx];
                  const isGreen = currClose >= prevClose;
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        backgroundColor: isGreen ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                        minHeight: '2px',
                      }}
                      title={`$${(vol / 1e9).toFixed(2)}B`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* RSI Chart */}
          {activeIndicators.rsi && data?.indicators?.rsi && (
            <div className="mt-4 pt-4 border-t border-[#1e293b]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-medium text-gray-400">RSI (14)</h4>
                  <StatusPill status={rsiStatus} />
                </div>
                <span className={`text-sm font-bold ${
                  latestRSI && latestRSI > 70 ? 'text-red-400' :
                  latestRSI && latestRSI < 30 ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {latestRSI?.toFixed(1) || '--'}
                </span>
              </div>
              <div className="h-[100px] relative">
                {/* Overbought/Oversold zones */}
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex-[30] bg-red-500/10 border-b border-red-500/30"></div>
                  <div className="flex-[40] bg-transparent"></div>
                  <div className="flex-[30] bg-green-500/10 border-t border-green-500/30"></div>
                </div>
                {/* RSI Line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    points={data.indicators.rsi.slice(-60).map((val, idx, arr) => {
                      const x = arr.length > 1 ? (idx / (arr.length - 1)) * 100 : 50;
                      const y = 100 - (val || 50);
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                </svg>
                {/* Hover zones for tooltips */}
                <div className="absolute inset-0 flex">
                  {data.indicators.rsi.slice(-60).map((val, idx, arr) => (
                    <div
                      key={idx}
                      className="flex-1 cursor-crosshair"
                      title={`RSI: ${val?.toFixed(1) || '--'}${val && val > 70 ? ' (Overbought)' : val && val < 30 ? ' (Oversold)' : ''}`}
                    />
                  ))}
                </div>
                {/* 70/30 level labels */}
                <div className="absolute right-1 top-[30%] text-xs text-red-400/70">70</div>
                <div className="absolute right-1 bottom-[30%] text-xs text-green-400/70">30</div>
              </div>
            </div>
          )}

          {/* MACD Chart */}
          {activeIndicators.macd && data?.indicators?.macd && (
            <div className="mt-4 pt-4 border-t border-[#1e293b]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-medium text-gray-400">MACD</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>MACD</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span>Signal</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-green-400"></span>Histogram</span>
                  </div>
                </div>
                <span className={`text-sm font-bold ${
                  (latestMACD?.hist?.[latestMACD.hist.length - 1] ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {latestMACD?.hist?.[latestMACD.hist.length - 1]?.toFixed(2) || '--'}
                </span>
              </div>
              <div className="h-[120px] relative group">
                {/* Zero line */}
                <div className="absolute left-0 right-0 top-1/2 border-t border-gray-600/50"></div>
                
                {/* MACD Histogram Bars */}
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-full flex items-center gap-[1px]">
                    {data.indicators.macd.hist.slice(-60).map((val, idx) => {
                      const maxAbsHist = Math.max(...data.indicators.macd!.hist.slice(-60).map(v => Math.abs(v || 0)));
                      const normalizedHeight = maxAbsHist > 0 ? ((val || 0) / maxAbsHist) * 50 : 0;
                      const isPositive = (val || 0) >= 0;
                      const macdVal = data.indicators.macd!.macd.slice(-60)[idx];
                      const signalVal = data.indicators.macd!.signal.slice(-60)[idx];
                      return (
                        <div
                          key={idx}
                          className="flex-1 relative cursor-crosshair"
                          style={{ height: '100%' }}
                          title={`MACD: ${macdVal?.toFixed(2) || '--'} | Signal: ${signalVal?.toFixed(2) || '--'} | Hist: ${val?.toFixed(2) || '--'}`}
                        >
                          <div
                            className={`absolute left-0 right-0 ${isPositive ? 'bottom-1/2' : 'top-1/2'} hover:opacity-80 transition-opacity`}
                            style={{
                              height: `${Math.abs(normalizedHeight)}%`,
                              backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
                            }}
                          ></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* MACD and Signal Lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* MACD Line */}
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    points={(() => {
                      const sliced = data.indicators.macd!.macd.slice(-60);
                      const maxAbsVal = Math.max(...sliced.map(v => Math.abs(v || 0)));
                      return sliced.map((val, idx) => {
                        const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                        const y = maxAbsVal > 0 ? 50 - ((val || 0) / maxAbsVal) * 40 : 50;
                        return `${x},${y}`;
                      }).join(' ');
                    })()}
                  />
                  {/* Signal Line */}
                  <polyline
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    points={(() => {
                      const macdSliced = data.indicators.macd!.macd.slice(-60);
                      const signalSliced = data.indicators.macd!.signal.slice(-60);
                      const maxAbsVal = Math.max(...macdSliced.map(v => Math.abs(v || 0)));
                      return signalSliced.map((val, idx) => {
                        const x = signalSliced.length > 1 ? (idx / (signalSliced.length - 1)) * 100 : 50;
                        const y = maxAbsVal > 0 ? 50 - ((val || 0) / maxAbsVal) * 40 : 50;
                        return `${x},${y}`;
                      }).join(' ');
                    })()}
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* RSI & MACD Details Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-delay-3 mt-8">
          {/* RSI Details */}
          {activeIndicators.rsi && (
            <div className="neon-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-200">RSI Analysis</h3>
                <StatusPill status={rsiStatus} />
              </div>
              <div className="flex items-end gap-4">
                <span className={`text-4xl font-bold ${
                  latestRSI && latestRSI > 70 ? 'text-red-400' :
                  latestRSI && latestRSI < 30 ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {latestRSI?.toFixed(1) || '--'}
                </span>
                <div className="text-sm text-gray-400 pb-1">
                  {latestRSI && latestRSI > 70 ? 'Overbought zone' :
                   latestRSI && latestRSI < 30 ? 'Oversold zone' : 'Neutral zone'}
                </div>
              </div>
              {/* RSI Gauge */}
              <div className="mt-4 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${latestRSI || 0}%`,
                    backgroundColor: latestRSI && latestRSI > 70 ? '#ef4444' :
                                     latestRSI && latestRSI < 30 ? '#22c55e' : '#06b6d4',
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0 (Oversold)</span>
                <span>50</span>
                <span>100 (Overbought)</span>
              </div>
            </div>
          )}

          {/* MACD Details */}
          {activeIndicators.macd && latestMACD && (
            <div className="neon-card p-6">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">MACD Analysis</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">MACD Line</p>
                  <p className="text-xl font-bold text-cyan-400">
                    {latestMACD.macd?.[latestMACD.macd.length - 1]?.toFixed(2) || '--'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Signal Line</p>
                  <p className="text-xl font-bold text-orange-400">
                    {latestMACD.signal?.[latestMACD.signal.length - 1]?.toFixed(2) || '--'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Histogram</p>
                  <p className={`text-xl font-bold ${
                    (latestMACD.hist?.[latestMACD.hist.length - 1] ?? 0) > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {latestMACD.hist?.[latestMACD.hist.length - 1]?.toFixed(2) || '--'}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#1e293b]/50 rounded-lg">
                <p className="text-sm text-gray-400">
                  {(latestMACD.hist?.[latestMACD.hist.length - 1] ?? 0) > 0
                    ? '📈 Bullish momentum - MACD above signal line'
                    : '📉 Bearish momentum - MACD below signal line'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
