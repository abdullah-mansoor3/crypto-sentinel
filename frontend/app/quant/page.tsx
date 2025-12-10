'use client';

import { useEffect, useState } from 'react';
import CoinSelector from '../components/CoinSelector';
import MetricCard from '../components/MetricCard';
import StatusPill from '../components/StatusPill';
import { LoadingPage } from '../components/LoadingSpinner';

interface QuantMetrics {
  symbol: string;
  days: number;
  volatility: {
    rolling_std: {
      values: Record<string, (number | null)[]>;
      latest_30d: number | null;
      level: string;
    };
    atr: {
      values: (number | null)[];
      latest: number | null;
      trend: string;
    };
  };
  trend: {
    adx: {
      values: (number | null)[];
      latest: number;
      strength: string;
    };
  };
  market_structure: {
    regime: {
      current: string;
      probabilities: Record<string, number>;
    };
    obv: {
      values: number[];
      trend: string;
      volume_confirms_price: boolean;
    };
  };
  risk_liquidity: {
    sharpe: {
      value: number;
      quality: string;
    };
    liquidity: {
      ratio?: number;
      level: string;
      avg_volume_24h?: number;
    };
    vatr: {
      value: number;
      label: string;
    };
  };
  formulas: Record<string, string>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const formulaDescriptions: Record<string, string> = {
  rolling_volatility: 'Standard deviation of daily returns over a rolling window',
  atr: 'Average True Range - measures market volatility using high, low, and close prices',
  adx: 'Average Directional Index - measures trend strength regardless of direction',
  market_regime: 'Classification based on volatility levels and trend strength',
  obv: 'On-Balance Volume - cumulative volume indicator showing buying/selling pressure',
  sharpe_ratio: 'Risk-adjusted return measure comparing excess return to volatility',
  vatr: 'Volatility-Adjusted True Range - ATR normalized by recent price',
};

export default function QuantPage() {
  const [coin, setCoin] = useState('BTC');
  const [days, setDays] = useState(180);
  const [data, setData] = useState<QuantMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuant() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/quant?symbol=${coin}&days=${days}`);
        if (!res.ok) throw new Error('Failed to fetch quant metrics');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchQuant();
  }, [coin, days]);

  if (loading && !data) return <LoadingPage />;

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 fade-in relative z-50">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="neon-text-purple">Quantitative</span> Finance
            </h1>
            <p className="text-gray-400">Advanced metrics for risk assessment and market analysis</p>
          </div>
          
          <div className="flex items-center gap-4 relative z-50">
            <CoinSelector selectedCoin={coin} onCoinChange={setCoin} />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 bg-[#0d1117] border border-[#1e293b] rounded-lg text-gray-200 focus:outline-none focus:border-purple-500/50"
            >
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>1 Year</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && data && (
          <div className="fixed top-20 right-4 bg-purple-500/20 border border-purple-500/30 rounded-lg px-4 py-2 flex items-center gap-2 z-50">
            <div className="spinner"></div>
            <span className="text-sm text-purple-300">Updating...</span>
          </div>
        )}

        {data && (
          <>
            {/* Volatility Section */}
            <section className="mb-8 fade-in-delay-1">
              <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
                <span className="mr-2">📊</span> Volatility Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Rolling Volatility (30d)"
                  value={data.volatility?.rolling_std?.latest_30d != null ? `${(data.volatility.rolling_std.latest_30d * 100).toFixed(2)}%` : '--'}
                  subtitle={data.volatility?.rolling_std?.level || 'Calculating...'}
                  formula={data.formulas?.rolling_volatility || 'σ = √(Σ(r - μ)² / n)'}
                  color="cyan"
                />
                <MetricCard
                  title="Volatility Level"
                  value={data.volatility?.rolling_std?.level?.toUpperCase() || '--'}
                  subtitle="Classification"
                  formula="Based on 30-day rolling std"
                  color="cyan"
                />
                <MetricCard
                  title="ATR"
                  value={data.volatility?.atr?.latest != null ? `$${data.volatility.atr.latest.toLocaleString()}` : '--'}
                  subtitle="Average True Range"
                  formula={data.formulas?.atr || 'ATR = EMA(TR, 14)'}
                  color="orange"
                />
                <MetricCard
                  title="ATR Trend"
                  value={data.volatility?.atr?.trend?.toUpperCase() || '--'}
                  subtitle="Direction"
                  formula="Rising = increasing volatility"
                  color="orange"
                />
              </div>

              {/* ATR Chart */}
              {data.volatility?.atr?.values && data.volatility.atr.values.length > 0 && (data.volatility.atr.values.filter(v => v !== null).length >= 2) && (
                <div className="neon-card p-6 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-200">ATR History</h3>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      data.volatility.atr.trend === 'rising' ? 'bg-red-500/20 text-red-400' :
                      data.volatility.atr.trend === 'falling' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {data.volatility.atr.trend?.toUpperCase() || 'STABLE'}
                    </span>
                  </div>
                  <div className="h-[120px] relative">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(100,116,139,0.2)" strokeDasharray="4"/>
                      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(100,116,139,0.2)" strokeDasharray="4"/>
                      <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(100,116,139,0.2)" strokeDasharray="4"/>
                      
                      {/* ATR Line with gradient */}
                      <defs>
                        <linearGradient id="atrGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path
                        d={(() => {
                          const allValues = data.volatility!.atr!.values.filter(v => v !== null) as number[];
                          const sliced = allValues.slice(-60);
                          if (sliced.length < 2) return '';
                          const maxVal = Math.max(...sliced);
                          const minVal = Math.min(...sliced);
                          const range = maxVal - minVal || 1;
                          const points = sliced.map((val, idx) => {
                            const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                            const y = 100 - ((val - minVal) / range) * 80 - 10;
                            return `${x},${y}`;
                          });
                          return `M${points.join(' L')} L100,100 L0,100 Z`;
                        })()}
                        fill="url(#atrGradient)"
                      />
                      <polyline
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        points={(() => {
                          const allValues = data.volatility!.atr!.values.filter(v => v !== null) as number[];
                          const sliced = allValues.slice(-60);
                          if (sliced.length < 2) return '';
                          const maxVal = Math.max(...sliced);
                          const minVal = Math.min(...sliced);
                          const range = maxVal - minVal || 1;
                          return sliced.map((val, idx) => {
                            const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                            const y = 100 - ((val - minVal) / range) * 80 - 10;
                            return `${x},${y}`;
                          }).join(' ');
                        })()}
                      />
                    </svg>
                    {/* Hover zones for tooltips */}
                    <div className="absolute inset-0 flex">
                      {(() => {
                        const allValues = data.volatility!.atr!.values.filter(v => v !== null) as number[];
                        const sliced = allValues.slice(-60);
                        return sliced.map((val, idx) => (
                          <div
                            key={idx}
                            className="flex-1 cursor-crosshair"
                            title={`ATR: $${val?.toLocaleString() || '--'}`}
                          />
                        ));
                      })()}
                    </div>
                    {/* Current value label */}
                    <div className="absolute right-2 top-2 text-sm font-bold text-orange-400">
                      ${data.volatility.atr.latest?.toLocaleString() || '--'}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Trend Strength Section */}
            <section className="mb-8 fade-in-delay-2">
              <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
                <span className="mr-2">📈</span> Trend Analysis
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ADX Card */}
                <div className="neon-card neon-card-purple p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 group cursor-help">
                        ADX (Average Directional Index)
                        <span className="ml-1 text-xs text-gray-500">ⓘ</span>
                      </h3>
                      <p className="text-xs text-gray-500">
                        Formula: ADX = SMA(|+DI - -DI| / (+DI + -DI), 14) × 100
                      </p>
                    </div>
                    <StatusPill status={data.trend?.adx?.strength || 'unknown'} />
                  </div>
                  
                  <div className="flex items-end gap-4 mb-4">
                    <span className="text-5xl font-bold text-purple-400">
                      {data.trend?.adx?.latest?.toFixed(1) || '--'}
                    </span>
                    <div className="pb-2 text-sm text-gray-400">
                      {data.trend?.adx?.strength === 'strong' ? 'Strong trend' :
                       data.trend?.adx?.strength === 'medium' ? 'Moderate trend' : 'Weak/No trend'}
                    </div>
                  </div>

                  {/* ADX Gauge */}
                  <div className="relative h-3 bg-[#1e293b] rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute h-full bg-gradient-to-r from-gray-500 via-yellow-500 to-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(data.trend?.adx?.latest || 0, 100)}%` }}
                    ></div>
                    {/* Threshold markers */}
                    <div className="absolute top-0 bottom-0 w-px bg-gray-600" style={{ left: '20%' }}></div>
                    <div className="absolute top-0 bottom-0 w-px bg-gray-600" style={{ left: '40%' }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Weak (&lt;20)</span>
                    <span>Medium (20-40)</span>
                    <span>Strong (&gt;40)</span>
                  </div>

                  {/* ADX Chart */}
                  {data.trend?.adx?.values && data.trend.adx.values.length > 0 && (data.trend.adx.values.filter(v => v !== null).length >= 2) && (
                    <div className="mt-4 h-[100px] relative">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Threshold zones */}
                        <rect x="0" y="0" width="100" height="60" fill="rgba(34,197,94,0.05)"/>
                        <rect x="0" y="60" width="100" height="20" fill="rgba(234,179,8,0.05)"/>
                        <rect x="0" y="80" width="100" height="20" fill="rgba(239,68,68,0.05)"/>
                        {/* Threshold lines at 40 and 20 */}
                        <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(234,179,8,0.4)" strokeDasharray="4"/>
                        <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(239,68,68,0.4)" strokeDasharray="4"/>
                        
                        {/* ADX Line */}
                        <polyline
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          points={(() => {
                            const allValues = data.trend!.adx!.values.filter(v => v !== null) as number[];
                            const sliced = allValues.slice(-60);
                            if (sliced.length < 2) return '';
                            return sliced.map((val, idx) => {
                              const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                              const y = 100 - Math.min(val, 100);
                              return `${x},${y}`;
                            }).join(' ');
                          })()}
                        />
                      </svg>
                      {/* Hover zones for tooltips */}
                      <div className="absolute inset-0 flex">
                        {(() => {
                          const allValues = data.trend!.adx!.values.filter(v => v !== null) as number[];
                          const sliced = allValues.slice(-60);
                          return sliced.map((val, idx) => (
                            <div
                              key={idx}
                              className="flex-1 cursor-crosshair"
                              title={`ADX: ${val?.toFixed(1) || '--'}${val && val >= 40 ? ' (Strong)' : val && val >= 20 ? ' (Medium)' : ' (Weak)'}`}
                            />
                          ));
                        })()}
                      </div>
                      {/* Threshold labels */}
                      <div className="absolute left-1 top-[58%] text-xs text-yellow-500/60">40</div>
                      <div className="absolute left-1 top-[78%] text-xs text-red-500/60">20</div>
                    </div>
                  )}

                  {/* Trend Interpretation */}
                  <div className="mt-4 p-3 bg-[#1e293b]/50 rounded-lg">
                    <p className="text-sm text-gray-400">
                      {(data.trend?.adx?.latest || 0) >= 40 
                        ? '🔥 Strong trending market - good for trend-following strategies'
                        : (data.trend?.adx?.latest || 0) >= 20
                        ? '📊 Moderate trend - proceed with caution'
                        : '⚠️ Weak/No trend - consider range-bound strategies'}
                    </p>
                  </div>
                </div>

                {/* Market Regime Card */}
                <div className="neon-card neon-card-green p-6">
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Market Structure</h3>
                  
                  <div className="space-y-4">
                    {/* Regime */}
                    <div className="p-4 bg-[#1e293b]/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Market Regime</span>
                        <StatusPill status={data.market_structure?.regime?.current || 'unknown'} />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Based on volatility percentile and ADX trend strength
                      </p>
                      {/* Regime Probabilities */}
                      {data.market_structure?.regime?.probabilities && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(data.market_structure.regime.probabilities).map(([regime, prob]) => (
                            <div key={regime} className="flex justify-between text-gray-500">
                              <span className="capitalize">{regime.replace('_', ' ')}</span>
                              <span className="text-cyan-400">{((prob as number) * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* OBV Trend */}
                    <div className="p-4 bg-[#1e293b]/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">OBV Trend</span>
                        <StatusPill status={data.market_structure?.obv?.trend || 'flat'} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Volume confirms price:</span>
                        <span className={`font-medium ${data.market_structure?.obv?.volume_confirms_price ? 'text-green-400' : 'text-yellow-400'}`}>
                          {data.market_structure?.obv?.volume_confirms_price ? 'Yes ✓' : 'No ✗'}
                        </span>
                      </div>
                      
                      {/* OBV Chart */}
                      {data.market_structure?.obv?.values && data.market_structure.obv.values.length > 0 && (data.market_structure.obv.values.filter(v => v !== null).length >= 2) && (
                        <div className="mt-3 h-[80px] relative">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="obvGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            <path
                              d={(() => {
                                const allValues = data.market_structure!.obv!.values.filter(v => v !== null) as number[];
                                const sliced = allValues.slice(-60);
                                if (sliced.length < 2) return '';
                                const maxVal = Math.max(...sliced);
                                const minVal = Math.min(...sliced);
                                const range = maxVal - minVal || 1;
                                const points = sliced.map((val, idx) => {
                                  const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                                  const y = 100 - ((val - minVal) / range) * 80 - 10;
                                  return `${x},${y}`;
                                });
                                return `M${points.join(' L')} L100,100 L0,100 Z`;
                              })()}
                              fill="url(#obvGradient)"
                            />
                            <polyline
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                              points={(() => {
                                const allValues = data.market_structure!.obv!.values.filter(v => v !== null) as number[];
                                const sliced = allValues.slice(-60);
                                if (sliced.length < 2) return '';
                                const maxVal = Math.max(...sliced);
                                const minVal = Math.min(...sliced);
                                const range = maxVal - minVal || 1;
                                return sliced.map((val, idx) => {
                                  const x = sliced.length > 1 ? (idx / (sliced.length - 1)) * 100 : 50;
                                  const y = 100 - ((val - minVal) / range) * 80 - 10;
                                  return `${x},${y}`;
                                }).join(' ');
                              })()}
                            />
                          </svg>
                          {/* Hover zones for tooltips */}
                          <div className="absolute inset-0 flex">
                            {(() => {
                              const allValues = data.market_structure!.obv!.values.filter(v => v !== null) as number[];
                              const sliced = allValues.slice(-60);
                              return sliced.map((val, idx) => (
                                <div
                                  key={idx}
                                  className="flex-1 cursor-crosshair"
                                  title={`OBV: ${val?.toLocaleString() || '--'}`}
                                />
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Risk & Liquidity Section */}
            <section className="mb-8 fade-in-delay-3">
              <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
                <span className="mr-2">⚠️</span> Risk & Liquidity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="neon-card p-6 col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-200 cursor-help group">
                      Sharpe Ratio
                      <span className="ml-1 text-xs text-gray-500">ⓘ</span>
                    </h3>
                    <StatusPill 
                      status={(data.risk_liquidity?.sharpe?.value ?? 0) > 1 ? 'positive' : (data.risk_liquidity?.sharpe?.value ?? 0) < 0 ? 'negative' : 'neutral'} 
                      text={data.risk_liquidity?.sharpe?.quality || 'calculating'}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Formula: SR = (R_p - R_f) / σ_p
                  </p>
                  <div className="flex items-end gap-4">
                    <span className={`text-5xl font-bold ${
                      (data.risk_liquidity?.sharpe?.value ?? 0) > 1 ? 'text-green-400' :
                      (data.risk_liquidity?.sharpe?.value ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {data.risk_liquidity?.sharpe?.value?.toFixed(2) || '--'}
                    </span>
                    <div className="pb-2 text-sm text-gray-400">
                      {(data.risk_liquidity?.sharpe?.value ?? 0) > 2 ? 'Excellent risk-adjusted returns' :
                       (data.risk_liquidity?.sharpe?.value ?? 0) > 1 ? 'Good risk-adjusted returns' :
                       (data.risk_liquidity?.sharpe?.value ?? 0) > 0 ? 'Acceptable risk-adjusted returns' :
                       'Poor risk-adjusted returns'}
                    </div>
                  </div>
                </div>

                <MetricCard
                  title="VATR"
                  value={data.risk_liquidity?.vatr?.value != null ? data.risk_liquidity.vatr.value.toFixed(2) : '--'}
                  subtitle={data.risk_liquidity?.vatr?.label || 'Volatility-Adjusted'}
                  formula="VATR = ADX / (Volatility × 100)"
                  color="pink"
                />
                <MetricCard
                  title="Liquidity"
                  value={data.risk_liquidity?.liquidity?.level?.toUpperCase() || '--'}
                  subtitle={data.risk_liquidity?.liquidity?.ratio != null ? `Ratio: ${(data.risk_liquidity.liquidity.ratio * 100).toFixed(2)}%` : 'Estimated'}
                  formula="Volume / Market Cap ratio"
                  color="green"
                />
              </div>
            </section>

            {/* Formulas Reference */}
            <section className="fade-in-delay-3">
              <div className="neon-card p-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                  <span className="mr-2">📐</span> Formula Reference
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(data.formulas || {}).map(([key, formula]) => (
                    <div key={key} className="p-3 bg-[#1e293b]/50 rounded-lg">
                      <p className="text-xs text-purple-400 font-medium mb-1">
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <code className="text-xs text-cyan-300 font-mono break-all">
                        {formula}
                      </code>
                      {formulaDescriptions[key] && (
                        <p className="text-xs text-gray-500 mt-2">
                          {formulaDescriptions[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
