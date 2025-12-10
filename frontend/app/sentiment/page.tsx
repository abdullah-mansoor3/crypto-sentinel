'use client';

import { useEffect, useState } from 'react';
import StatusPill from '../components/StatusPill';
import { LoadingPage } from '../components/LoadingSpinner';

interface NewsItem {
  title: string;
  link?: string;
  url?: string;
  published?: string;
  published_at?: string;
  summary?: string;
  source?: string;
  sentiment?: string;
  sentiment_label?: string;
  sentiment_score?: number;
  sentiment_scores?: {
    negative: number;
    neutral: number;
    positive: number;
  };
}

interface NewsData {
  articles: NewsItem[];
  stale_threshold_hours: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SentimentPage() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [limit, setLimit] = useState(20);

  const fetchNews = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/news?limit=${limit}&force=${force}`);
      if (!res.ok) throw new Error('Failed to fetch news data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [limit]);

  const getSentimentLabel = (item: NewsItem): string => {
    return item.sentiment_label || item.sentiment || 'neutral';
  };

  const getSentimentScore = (item: NewsItem): number => {
    return item.sentiment_score || 0.5;
  };

  const filteredNews = data?.articles?.filter((item) => {
    if (filter === 'all') return true;
    return getSentimentLabel(item).toLowerCase() === filter;
  }) || [];

  // Calculate sentiment distribution
  const sentimentCounts = {
    positive: data?.articles?.filter((n) => getSentimentLabel(n).toLowerCase() === 'positive').length || 0,
    neutral: data?.articles?.filter((n) => getSentimentLabel(n).toLowerCase() === 'neutral').length || 0,
    negative: data?.articles?.filter((n) => getSentimentLabel(n).toLowerCase() === 'negative').length || 0,
  };
  const totalNews = data?.articles?.length || 0;

  // Calculate overall sentiment
  const overallSentiment = totalNews > 0 
    ? sentimentCounts.positive > sentimentCounts.negative 
      ? 'positive' 
      : sentimentCounts.negative > sentimentCounts.positive 
        ? 'negative' 
        : 'neutral'
    : 'neutral';

  if (loading && !data) return <LoadingPage />;

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 fade-in">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="neon-text-pink">Sentiment</span> Analysis
            </h1>
            <p className="text-gray-400">AI-powered news sentiment using RoBERTa transformer model</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-4 py-2 bg-[#0d1117] border border-[#1e293b] rounded-lg text-gray-200 focus:outline-none focus:border-pink-500/50"
            >
              <option value={10}>10 Articles</option>
              <option value={20}>20 Articles</option>
              <option value={50}>50 Articles</option>
            </select>
            <button
              onClick={() => fetchNews(true)}
              className="px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-lg text-pink-400 hover:bg-pink-500/20 transition-all flex items-center gap-2"
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
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && data && (
          <div className="fixed top-20 right-4 bg-pink-500/20 border border-pink-500/30 rounded-lg px-4 py-2 flex items-center gap-2 z-50">
            <div className="spinner"></div>
            <span className="text-sm text-pink-300">Analyzing sentiment...</span>
          </div>
        )}

        {data && (
          <>
            {/* Sentiment Overview */}
            <section className="mb-8 fade-in-delay-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Sentiment */}
                <div className="neon-card p-6 lg:col-span-1">
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Overall Sentiment</h3>
                  <div className="text-center py-4">
                    <div className={`text-6xl mb-4 ${
                      overallSentiment === 'positive' ? 'animate-bounce' : ''
                    }`}>
                      {overallSentiment === 'positive' ? '😊' :
                       overallSentiment === 'negative' ? '😟' : '😐'}
                    </div>
                    <StatusPill 
                      status={overallSentiment} 
                      text={overallSentiment.toUpperCase()}
                    />
                    <p className="text-sm text-gray-400 mt-2">
                      Based on {totalNews} articles
                    </p>
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div className="neon-card p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-200 mb-4">Sentiment Distribution</h3>
                  
                  <div className="space-y-4">
                    {/* Positive */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-green-400">Positive</span>
                        <span className="text-sm text-gray-400">
                          {sentimentCounts.positive} / {totalNews} ({totalNews > 0 ? ((sentimentCounts.positive / totalNews) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-700"
                          style={{ width: `${totalNews > 0 ? (sentimentCounts.positive / totalNews) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Neutral */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400">Neutral</span>
                        <span className="text-sm text-gray-400">
                          {sentimentCounts.neutral} / {totalNews} ({totalNews > 0 ? ((sentimentCounts.neutral / totalNews) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-gray-600 to-gray-400 rounded-full transition-all duration-700"
                          style={{ width: `${totalNews > 0 ? (sentimentCounts.neutral / totalNews) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Negative */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-red-400">Negative</span>
                        <span className="text-sm text-gray-400">
                          {sentimentCounts.negative} / {totalNews} ({totalNews > 0 ? ((sentimentCounts.negative / totalNews) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
                          style={{ width: `${totalNews > 0 ? (sentimentCounts.negative / totalNews) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Model Info */}
                  <div className="mt-6 p-3 bg-[#1e293b]/50 rounded-lg">
                    <p className="text-xs text-gray-500">
                      <span className="text-pink-400">Model:</span> cardiffnlp/twitter-roberta-base-sentiment
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Filter Tabs */}
            <section className="mb-6 fade-in-delay-2">
              <div className="flex flex-wrap gap-2">
                {(['all', 'positive', 'neutral', 'negative'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === f
                        ? f === 'positive' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                          f === 'negative' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                          f === 'neutral' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50' :
                          'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                        : 'bg-[#1e293b] text-gray-400 border border-transparent hover:border-gray-600'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-2 text-xs">
                        ({f === 'positive' ? sentimentCounts.positive :
                          f === 'negative' ? sentimentCounts.negative : sentimentCounts.neutral})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* News Feed */}
            <section className="fade-in-delay-3">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">
                Latest News ({filteredNews.length})
              </h2>
              
              {filteredNews.length === 0 ? (
                <div className="neon-card p-12 text-center">
                  <div className="text-4xl mb-4">📰</div>
                  <p className="text-gray-400">No news articles found for this filter</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNews.map((item, index) => {
                    const sentimentLabel = getSentimentLabel(item);
                    const sentimentScore = getSentimentScore(item);
                    const publishedDate = item.published_at || item.published;
                    const link = item.url || item.link || '#';
                    
                    return (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neon-card p-4 group hover:border-pink-500/50 transition-all"
                      >
                        {/* Sentiment Badge */}
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-xs text-gray-500">{item.source || 'News'}</span>
                          <StatusPill status={sentimentLabel} />
                        </div>

                        {/* Title */}
                        <h3 className="font-medium text-gray-200 mb-2 line-clamp-2 group-hover:text-pink-400 transition-colors">
                          {item.title}
                        </h3>

                        {/* Sentiment Score Bar */}
                        {sentimentScore > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Confidence</span>
                              <span>{(sentimentScore * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  sentimentLabel === 'positive' ? 'bg-green-500' :
                                  sentimentLabel === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                                }`}
                                style={{ width: `${sentimentScore * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Probability Breakdown */}
                        {item.sentiment_scores && (
                          <div className="flex gap-1 mb-3">
                            <div
                              className="h-1.5 bg-green-500 rounded-l"
                              style={{ width: `${item.sentiment_scores.positive * 100}%` }}
                              title={`Positive: ${(item.sentiment_scores.positive * 100).toFixed(0)}%`}
                            ></div>
                            <div
                              className="h-1.5 bg-gray-500"
                              style={{ width: `${item.sentiment_scores.neutral * 100}%` }}
                              title={`Neutral: ${(item.sentiment_scores.neutral * 100).toFixed(0)}%`}
                            ></div>
                            <div
                              className="h-1.5 bg-red-500 rounded-r"
                              style={{ width: `${item.sentiment_scores.negative * 100}%` }}
                              title={`Negative: ${(item.sentiment_scores.negative * 100).toFixed(0)}%`}
                            ></div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {publishedDate ? new Date(publishedDate).toLocaleDateString() : 'Recent'}
                          </span>
                          <span className="text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Read more →
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
