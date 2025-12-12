'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import CoinSelector from '../components/CoinSelector';
import StatusPill from '../components/StatusPill';
import LoadingSpinner from '../components/LoadingSpinner';

// Types for the multi-agent analysis
interface ProgressUpdate {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'agent_complete' | 'final' | 'error' | 'complete';
  agent: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface IndicatorSignal {
  indicator: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

interface KeyLevel {
  level_type: 'support' | 'resistance';
  price: number;
  strength: 'strong' | 'moderate' | 'weak';
}

interface NewsEvent {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
  source?: string;
  published_at?: string;
}

interface ReturnMetrics {
  total_return: number;
  annualized_return: number;
  daily_avg_return: number;
  best_day: number;
  worst_day: number;
}

interface RiskMetrics {
  volatility: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  var_95: number;
  cvar_95: number;
}

interface NewsAnalysis {
  sentiment_summary: string;
  avg_sentiment_score: number;
  overall_sentiment: 'bullish' | 'bearish' | 'neutral';
  top_events: NewsEvent[];
  news_count: number;
}

interface TechnicalAnalysis {
  trend_summary: string;
  overall_trend: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  key_levels: KeyLevel[];
  indicator_signals: IndicatorSignal[];
  current_price: number;
  price_change_pct: number;
}

interface QuantAnalysis {
  risk_summary: string;
  risk_level: 'low' | 'moderate' | 'high' | 'extreme';
  return_metrics: ReturnMetrics;
  risk_metrics: RiskMetrics;
  risk_reward_assessment: string;
}

interface AgentThought {
  agent: string;
  thought: string;
  timestamp: string;
}

interface OrchestratorResult {
  final_analysis: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  risk_level: 'low' | 'moderate' | 'high' | 'extreme';
  news_analysis?: NewsAnalysis;
  technical_analysis?: TechnicalAnalysis;
  quant_analysis?: QuantAnalysis;
  thought_process: AgentThought[];
  coin: string;
  analysis_timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export default function AIPage() {
  const [coin, setCoin] = useState('BTC');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'progress' | 'news' | 'technical' | 'quant' | 'summary'>('progress');
  
  const wsRef = useRef<WebSocket | null>(null);
  const progressEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll progress panel
  useEffect(() => {
    if (progressEndRef.current) {
      progressEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress([]);
    setResult(null);
    setActiveTab('progress');

    // Try WebSocket first for streaming
    try {
      const ws = new WebSocket(`${WS_BASE}/api/agents/ws/analyze`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          coin: coin,
          days: days,
          include_news: true,
          include_technical: true,
          include_quant: true
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data: ProgressUpdate = JSON.parse(event.data);
          
          if (data.type === 'complete') {
            setResult(data.data as unknown as OrchestratorResult);
            setLoading(false);
            setActiveTab('summary');
            ws.close();
          } else if (data.type === 'error') {
            setError(data.message);
            setLoading(false);
          } else {
            setProgress(prev => [...prev, data]);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        // Fallback to HTTP if WebSocket fails
        ws.close();
        runAnalysisHttp();
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

    } catch {
      // Fallback to HTTP
      runAnalysisHttp();
    }
  }, [coin, days]);

  const runAnalysisHttp = async () => {
    try {
      setProgress(prev => [...prev, {
        type: 'thinking',
        agent: 'System',
        message: 'Falling back to HTTP request (no streaming)...',
        timestamp: new Date().toISOString()
      }]);

      const res = await fetch(`${API_BASE}/api/agents/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin: coin,
          days: days,
          include_news: true,
          include_technical: true,
          include_quant: true
        }),
      });

      if (!res.ok) throw new Error('Analysis request failed');
      
      const data = await res.json();
      
      if (data.success && data.data) {
        setResult(data.data as OrchestratorResult);
        setActiveTab('summary');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setProgress([]);
    setResult(null);
    setError(null);
    setActiveTab('progress');
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'text-green-400';
      case 'buy': return 'text-green-300';
      case 'hold': return 'text-yellow-400';
      case 'sell': return 'text-red-300';
      case 'strong_sell': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRecommendationBg = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'bg-green-500/20 border-green-500/50';
      case 'buy': return 'bg-green-500/10 border-green-500/30';
      case 'hold': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'sell': return 'bg-red-500/10 border-red-500/30';
      case 'strong_sell': return 'bg-red-500/20 border-red-500/50';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const formatRecommendation = (rec: string) => {
    return rec.replace('_', ' ').toUpperCase();
  };

  const getAgentIcon = (agent: string) => {
    if (agent.includes('News')) return '📰';
    if (agent.includes('Technical')) return '📊';
    if (agent.includes('Quant')) return '📈';
    if (agent.includes('Orchestrator')) return '🎯';
    return '🤖';
  };

  const getProgressTypeColor = (type: string) => {
    switch (type) {
      case 'thinking': return 'text-cyan-400';
      case 'tool_call': return 'text-purple-400';
      case 'tool_result': return 'text-green-400';
      case 'agent_complete': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 fade-in">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="neon-text-green">AI</span> Analysis
            </h1>
            <p className="text-gray-400">Multi-agent orchestrator powered by LLM</p>
          </div>
          
          <div className="flex items-center gap-4">
            <CoinSelector selectedCoin={coin} onCoinChange={setCoin} />
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-2 bg-[#0d1117] border border-[#1e293b] rounded-lg text-gray-200 text-sm"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls & Progress */}
          <div className="lg:col-span-1 space-y-6 fade-in-delay-1">
            {/* Run Analysis Card */}
            <div className="neon-card p-6">
              <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                🎯 Master Orchestrator
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Runs 3 specialized AI agents to analyze {coin}:
              </p>
              <ul className="text-sm text-gray-500 mb-6 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">📰</span> News Sentiment Agent
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">📊</span> Technical Analysis Agent
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-pink-400">📈</span> Quantitative Metrics Agent
                </li>
              </ul>
              
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="w-full neon-btn neon-btn-green py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Analyzing...
                  </span>
                ) : (
                  '🚀 Run Full Analysis'
                )}
              </button>

              {(progress.length > 0 || result) && (
                <button
                  onClick={clearResults}
                  className="w-full mt-3 px-4 py-2 bg-[#1e293b] text-gray-400 rounded-lg hover:text-gray-200 transition-colors text-sm"
                >
                  Clear Results
                </button>
              )}
            </div>

            {/* Progress Stream */}
            {progress.length > 0 && (
              <div className="neon-card p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Agent Progress</h3>
                <div className="max-h-[300px] overflow-y-auto space-y-2 text-xs">
                  {progress.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 pb-2 border-b border-[#1e293b] last:border-0">
                      <span>{getAgentIcon(p.agent)}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${getProgressTypeColor(p.type)}`}>
                          {p.agent}
                        </div>
                        <div className="text-gray-400 truncate">{p.message}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={progressEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2 fade-in-delay-2">
            <div className="neon-card min-h-[600px] flex flex-col">
              {/* Tabs */}
              {result && (
                <div className="flex border-b border-[#1e293b]">
                  {['summary', 'news', 'technical', 'quant'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as typeof activeTab)}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'text-cyan-400 border-b-2 border-cyan-400'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {tab === 'summary' && '📋 Summary'}
                      {tab === 'news' && '📰 News'}
                      {tab === 'technical' && '📊 Technical'}
                      {tab === 'quant' && '📈 Quant'}
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {!result && !loading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🤖</div>
                      <p className="text-gray-400 mb-2">Ready to analyze {coin}</p>
                      <p className="text-sm text-gray-500">
                        Click &quot;Run Full Analysis&quot; to start the multi-agent pipeline
                      </p>
                    </div>
                  </div>
                )}

                {loading && !result && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <LoadingSpinner size="lg" />
                      <p className="mt-4 text-gray-400">Agents are analyzing {coin}...</p>
                      <p className="text-sm text-gray-500 mt-2">Watch the progress panel for updates</p>
                    </div>
                  </div>
                )}

                {/* Summary Tab */}
                {result && activeTab === 'summary' && (
                  <div className="space-y-6">
                    {/* Recommendation Badge */}
                    <div className={`p-4 rounded-lg border ${getRecommendationBg(result.recommendation)}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Recommendation</div>
                          <div className={`text-2xl font-bold ${getRecommendationColor(result.recommendation)}`}>
                            {formatRecommendation(result.recommendation)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400 mb-1">Confidence</div>
                          <div className="text-2xl font-bold text-gray-200">
                            {(result.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-4">
                        <StatusPill status={result.risk_level} text={`${result.risk_level} risk`} />
                        {result.technical_analysis && (
                          <span className="text-sm text-gray-400">
                            Price: ${result.technical_analysis.current_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Final Analysis */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-3">Analysis Summary</h3>
                      <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {result.final_analysis}
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {result.technical_analysis && (
                        <>
                          <div className="bg-[#1e293b]/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400">Trend</div>
                            <div className={`text-lg font-semibold ${
                              result.technical_analysis.overall_trend === 'bullish' ? 'text-green-400' :
                              result.technical_analysis.overall_trend === 'bearish' ? 'text-red-400' :
                              'text-yellow-400'
                            }`}>
                              {result.technical_analysis.overall_trend.toUpperCase()}
                            </div>
                          </div>
                          <div className="bg-[#1e293b]/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400">Price Change</div>
                            <div className={`text-lg font-semibold ${
                              result.technical_analysis.price_change_pct >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {result.technical_analysis.price_change_pct >= 0 ? '+' : ''}
                              {result.technical_analysis.price_change_pct.toFixed(2)}%
                            </div>
                          </div>
                        </>
                      )}
                      {result.news_analysis && (
                        <div className="bg-[#1e293b]/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Sentiment</div>
                          <div className={`text-lg font-semibold ${
                            result.news_analysis.overall_sentiment === 'bullish' ? 'text-green-400' :
                            result.news_analysis.overall_sentiment === 'bearish' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {result.news_analysis.overall_sentiment.toUpperCase()}
                          </div>
                        </div>
                      )}
                      {result.quant_analysis && (
                        <div className="bg-[#1e293b]/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400">Sharpe Ratio</div>
                          <div className="text-lg font-semibold text-cyan-400">
                            {result.quant_analysis.risk_metrics.sharpe_ratio.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* News Tab */}
                {result && activeTab === 'news' && result.news_analysis && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Sentiment Summary</h3>
                      <p className="text-gray-300">{result.news_analysis.sentiment_summary}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Overall</div>
                        <div className={`text-lg font-semibold ${
                          result.news_analysis.overall_sentiment === 'bullish' ? 'text-green-400' :
                          result.news_analysis.overall_sentiment === 'bearish' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {result.news_analysis.overall_sentiment.toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Score</div>
                        <div className="text-lg font-semibold text-cyan-400">
                          {(result.news_analysis.avg_sentiment_score * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Articles</div>
                        <div className="text-lg font-semibold text-gray-200">
                          {result.news_analysis.news_count}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-3">Top Events</h3>
                      <div className="space-y-3">
                        {result.news_analysis.top_events.map((event, i) => (
                          <div key={i} className="bg-[#1e293b]/30 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-gray-300 text-sm flex-1">{event.title}</p>
                              <StatusPill 
                                status={event.sentiment === 'positive' ? 'bullish' : event.sentiment === 'negative' ? 'bearish' : 'neutral'}
                                text={`${(event.sentiment_score * 100).toFixed(0)}%`}
                              />
                            </div>
                            {event.source && (
                              <div className="text-xs text-gray-500 mt-1">{event.source}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Technical Tab */}
                {result && activeTab === 'technical' && result.technical_analysis && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Trend Summary</h3>
                      <p className="text-gray-300">{result.technical_analysis.trend_summary}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Current Price</div>
                        <div className="text-lg font-semibold text-cyan-400">
                          ${result.technical_analysis.current_price.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Change</div>
                        <div className={`text-lg font-semibold ${
                          result.technical_analysis.price_change_pct >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {result.technical_analysis.price_change_pct >= 0 ? '+' : ''}
                          {result.technical_analysis.price_change_pct.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Trend</div>
                        <div className={`text-lg font-semibold ${
                          result.technical_analysis.overall_trend === 'bullish' ? 'text-green-400' :
                          result.technical_analysis.overall_trend === 'bearish' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {result.technical_analysis.overall_trend.toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Signals</div>
                        <div className="text-lg font-semibold text-gray-200">
                          {result.technical_analysis.indicator_signals.length}
                        </div>
                      </div>
                    </div>

                    {/* Key Levels */}
                    {result.technical_analysis.key_levels.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">Key Levels</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {result.technical_analysis.key_levels.map((level, i) => (
                            <div key={i} className={`rounded-lg p-3 ${
                              level.level_type === 'resistance' 
                                ? 'bg-red-500/10 border border-red-500/30' 
                                : 'bg-green-500/10 border border-green-500/30'
                            }`}>
                              <div className="text-xs text-gray-400 mb-1">
                                {level.level_type.charAt(0).toUpperCase() + level.level_type.slice(1)} ({level.strength})
                              </div>
                              <div className={`text-xl font-semibold ${
                                level.level_type === 'resistance' ? 'text-red-400' : 'text-green-400'
                              }`}>
                                ${level.price.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Indicator Signals */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-3">Indicator Signals</h3>
                      <div className="space-y-2">
                        {result.technical_analysis.indicator_signals.map((signal, i) => (
                          <div key={i} className="bg-[#1e293b]/30 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-200">{signal.indicator}</div>
                              <div className="text-sm text-gray-400">{signal.description}</div>
                            </div>
                            <StatusPill 
                              status={signal.signal}
                              text={signal.value.toFixed(2)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quant Tab */}
                {result && activeTab === 'quant' && result.quant_analysis && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Risk Summary</h3>
                      <p className="text-gray-300">{result.quant_analysis.risk_summary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#1e293b]/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Return Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Return</span>
                            <span className={`font-medium ${
                              result.quant_analysis.return_metrics.total_return >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {result.quant_analysis.return_metrics.total_return >= 0 ? '+' : ''}
                              {result.quant_analysis.return_metrics.total_return.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Annualized</span>
                            <span className="text-gray-200">
                              {result.quant_analysis.return_metrics.annualized_return >= 0 ? '+' : ''}
                              {result.quant_analysis.return_metrics.annualized_return.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Best Day</span>
                            <span className="text-green-400">+{result.quant_analysis.return_metrics.best_day.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Worst Day</span>
                            <span className="text-red-400">{result.quant_analysis.return_metrics.worst_day.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#1e293b]/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Risk Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Volatility</span>
                            <span className="text-gray-200">{result.quant_analysis.risk_metrics.volatility.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Sharpe Ratio</span>
                            <span className="text-cyan-400">{result.quant_analysis.risk_metrics.sharpe_ratio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Max Drawdown</span>
                            <span className="text-red-400">{result.quant_analysis.risk_metrics.max_drawdown.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">VaR (95%)</span>
                            <span className="text-gray-200">{result.quant_analysis.risk_metrics.var_95.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Risk/Reward Assessment</h3>
                      <p className="text-gray-300">{result.quant_analysis.risk_reward_assessment}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg fade-in-delay-3">
          <p className="text-sm text-yellow-400/80">
            ⚠️ <strong>Disclaimer:</strong> AI-generated analysis is for educational purposes only. 
            Always conduct your own research and consult with financial advisors before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
