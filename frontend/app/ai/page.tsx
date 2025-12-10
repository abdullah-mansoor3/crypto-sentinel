'use client';

import { useState } from 'react';
import CoinSelector from '../components/CoinSelector';
import StatusPill from '../components/StatusPill';
import LoadingSpinner from '../components/LoadingSpinner';

interface AgentResponse {
  agent: string;
  result: {
    analysis?: string;
    recommendation?: string;
    confidence?: number;
    signals?: Array<{
      indicator: string;
      signal: string;
      value: number;
    }>;
    summary?: string;
    risk_level?: string;
    [key: string]: unknown;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const agents = [
  {
    id: 'technical',
    name: 'Technical Analyst',
    icon: '📊',
    description: 'Analyzes price charts, patterns, and technical indicators',
    color: 'cyan',
  },
  {
    id: 'sentiment',
    name: 'Sentiment Analyst',
    icon: '💬',
    description: 'Evaluates market sentiment from news and social media',
    color: 'pink',
  },
  {
    id: 'quant',
    name: 'Quant Analyst',
    icon: '📈',
    description: 'Computes risk metrics and quantitative signals',
    color: 'purple',
  },
  {
    id: 'orchestrator',
    name: 'Master Orchestrator',
    icon: '🎯',
    description: 'Combines all analyses for comprehensive insights',
    color: 'green',
  },
];

export default function AIPage() {
  const [coin, setCoin] = useState('BTC');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'ai'; content: string; agent?: string }>>([]);

  async function runAgent(agentId: string) {
    setLoading(true);
    setError(null);
    setSelectedAgent(agentId);

    const userMessage = `Analyze ${coin} using ${agents.find(a => a.id === agentId)?.name}`;
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const res = await fetch(`${API_BASE}/api/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentId, symbol: coin }),
      });

      if (!res.ok) throw new Error('Failed to run agent');
      const data = await res.json();
      setResponse(data);

      // Format AI response
      const aiContent = formatAgentResponse(data);
      setChatHistory(prev => [...prev, { role: 'ai', content: aiContent, agent: agentId }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${errorMsg}`, agent: agentId }]);
    } finally {
      setLoading(false);
    }
  }

  function formatAgentResponse(data: AgentResponse): string {
    const result = data.result;
    let formatted = '';

    if (result.analysis) {
      formatted += result.analysis + '\n\n';
    }

    if (result.signals && result.signals.length > 0) {
      formatted += '**Signals:**\n';
      result.signals.forEach(s => {
        formatted += `• ${s.indicator}: ${s.signal} (${s.value})\n`;
      });
      formatted += '\n';
    }

    if (result.recommendation) {
      formatted += `**Recommendation:** ${result.recommendation}\n`;
    }

    if (result.confidence) {
      formatted += `**Confidence:** ${(result.confidence * 100).toFixed(0)}%\n`;
    }

    if (result.risk_level) {
      formatted += `**Risk Level:** ${result.risk_level}\n`;
    }

    if (result.summary) {
      formatted += `\n${result.summary}`;
    }

    return formatted || JSON.stringify(result, null, 2);
  }

  function clearChat() {
    setChatHistory([]);
    setResponse(null);
    setSelectedAgent(null);
  }

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 fade-in">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="neon-text-green">AI</span> Analysis
            </h1>
            <p className="text-gray-400">Autonomous agents powered by advanced language models</p>
          </div>
          
          <div className="flex items-center gap-4">
            <CoinSelector selectedCoin={coin} onCoinChange={setCoin} />
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                className="px-4 py-2 bg-[#1e293b] text-gray-400 rounded-lg hover:text-gray-200 transition-colors"
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Selection */}
          <div className="lg:col-span-1 fade-in-delay-1">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Select Agent</h2>
            <div className="space-y-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => runAgent(agent.id)}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    selectedAgent === agent.id
                      ? agent.color === 'cyan' ? 'bg-cyan-500/20 border-cyan-500/50' :
                        agent.color === 'pink' ? 'bg-pink-500/20 border-pink-500/50' :
                        agent.color === 'purple' ? 'bg-purple-500/20 border-purple-500/50' :
                        'bg-green-500/20 border-green-500/50'
                      : 'bg-[#0d1117] hover:bg-[#1e293b]'
                  } border ${
                    selectedAgent === agent.id ? '' : 'border-[#1e293b] hover:border-gray-600'
                  } ${loading && selectedAgent === agent.id ? 'animate-pulse' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{agent.icon}</span>
                    <span className={`font-semibold ${
                      selectedAgent === agent.id
                        ? agent.color === 'cyan' ? 'text-cyan-400' :
                          agent.color === 'pink' ? 'text-pink-400' :
                          agent.color === 'purple' ? 'text-purple-400' :
                          'text-green-400'
                        : 'text-gray-200'
                    }`}>
                      {agent.name}
                    </span>
                    {loading && selectedAgent === agent.id && (
                      <LoadingSpinner size="sm" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{agent.description}</p>
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => runAgent('orchestrator')}
                  disabled={loading}
                  className="w-full neon-btn neon-btn-green text-sm py-3"
                >
                  🎯 Run Full Analysis
                </button>
              </div>
            </div>
          </div>

          {/* Chat / Response Area */}
          <div className="lg:col-span-2 fade-in-delay-2">
            <div className="neon-card h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-[#1e293b]">
                <h2 className="text-lg font-semibold text-gray-200">
                  Analysis Results
                </h2>
                <p className="text-sm text-gray-500">
                  Select an agent to analyze {coin}
                </p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🤖</div>
                      <p className="text-gray-400 mb-2">No analysis yet</p>
                      <p className="text-sm text-gray-500">
                        Select an agent from the left panel to start analyzing {coin}
                      </p>
                    </div>
                  </div>
                ) : (
                  chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-cyan-500/20 border border-cyan-500/30'
                            : 'bg-[#1e293b]'
                        }`}
                      >
                        {msg.role === 'ai' && msg.agent && (
                          <div className="flex items-center gap-2 mb-2">
                            <span>{agents.find(a => a.id === msg.agent)?.icon}</span>
                            <span className="text-xs text-gray-400">
                              {agents.find(a => a.id === msg.agent)?.name}
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-gray-200 whitespace-pre-wrap">
                          {msg.content.split('\n').map((line, i) => {
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return (
                                <p key={i} className="font-semibold text-cyan-400 mt-2">
                                  {line.replace(/\*\*/g, '')}
                                </p>
                              );
                            }
                            if (line.startsWith('•')) {
                              return (
                                <p key={i} className="text-gray-300 ml-2">
                                  {line}
                                </p>
                              );
                            }
                            return <p key={i}>{line}</p>;
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1e293b] p-4 rounded-lg">
                      <div className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span className="text-sm text-gray-400">Analyzing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Response Summary */}
              {response && !loading && (
                <div className="p-4 border-t border-[#1e293b] bg-[#0d1117]/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {response.result.recommendation && (
                        <StatusPill 
                          status={
                            response.result.recommendation.toLowerCase().includes('buy') ? 'bullish' :
                            response.result.recommendation.toLowerCase().includes('sell') ? 'bearish' :
                            'neutral'
                          }
                          text={response.result.recommendation}
                        />
                      )}
                      {response.result.risk_level && (
                        <StatusPill status={response.result.risk_level} />
                      )}
                    </div>
                    {response.result.confidence && (
                      <span className="text-sm text-gray-400">
                        Confidence: {(response.result.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
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
