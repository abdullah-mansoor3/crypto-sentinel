"use client";

import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function DashboardPage() {
  const [symbol, setSymbol] = useState("BTC");
  const [indicator, setIndicator] = useState("ema");
  const [indicatorSet, setIndicatorSet] = useState<Record<string, boolean>>({ ema: true, macd: false, rsi: false, bbands: false });
  const [overlay, setOverlay] = useState<string>("ema");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const indRef = useRef<HTMLCanvasElement | null>(null);
  const macdRef = useRef<HTMLCanvasElement | null>(null);
  const rsiRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const indChartRef = useRef<any>(null);
  const macdChartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const [cache, setCache] = useState<Record<string, any>>({});
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    // load Chart.js from CDN
    if (typeof window === "undefined") return;
    if ((window as any).Chart) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    s.async = true;
    document.head.appendChild(s);
    // also load zoom/pan plugin and register when available
    const s2 = document.createElement("script");
    s2.src = "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js";
    s2.async = true;
    s2.onload = () => {
      try {
        const Chart = (window as any).Chart;
        const plugin = (window as any).chartjsPluginZoom || (window as any).ChartZoom || (window as any).zoomPlugin;
        if (Chart && plugin) {
          try { Chart.register(plugin); } catch (e) { /* ignore */ }
        }
      } catch (e) {}
    };
    document.head.appendChild(s2);
  }, []);

  async function fetchData(sym: string, force: boolean = false) {
    setLoading(true);
    setError(null);
    try {
      // if cached and not forcing, use cache
      const cacheKey = `${sym}`;
      if (!force && cache[cacheKey]) {
        renderCharts(cache[cacheKey], overlay, indicatorSet);
        return;
      }

      let url = `${API_BASE}/api/data?symbol=${encodeURIComponent(sym)}&days=180`;
  if (force) url += `&force=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // cache payload per symbol
  setCache((c) => ({ ...c, [cacheKey]: data }));
      renderCharts(data, overlay, indicatorSet);
    } catch (err) {
      // Do not expose internal errors to the user. Show a generic message.
      setError("something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function renderCharts(payload: any, overlayKey?: string, indicators?: Record<string, boolean>) {
    if (!payload || !payload.ohlcv) return;
    const ts = payload.ohlcv.timestamp;
    const close = payload.ohlcv.close.map((v: any) => (v === null ? null : Number(v)));

    const labels = ts;

    // wait for Chart
    if (typeof (window as any).Chart === "undefined") {
      setTimeout(() => renderCharts(payload, overlayKey, indicators), 200);
      return;
    }

    const Chart = (window as any).Chart;
    
    // ensure zoom plugin is registered (may have loaded before or after Chart)
    try {
      const plugin = (window as any).chartjsPluginZoom || (window as any).ChartZoom || (window as any).zoomPlugin || (window as any).chartjs_plugin_zoom;
      if (Chart && plugin) {
        try { Chart.register(plugin); } catch (e) { /* ignore registration errors */ }
      }
    } catch (e) {
      // ignore
    }

    // destroy existing
    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch (e) {}
      chartRef.current = null;
    }
    if (indChartRef.current) {
      try { indChartRef.current.destroy(); } catch (e) {}
      indChartRef.current = null;
    }

    // base dataset (subtle color for dark background)
    const base = { label: "Close", data: close, borderColor: "#e6e6e6", backgroundColor: "transparent", tension: 0.35, pointRadius: 0, borderWidth: 1, spanGaps: true };

    // Build overlay datasets and extra overlays based on indicatorSet and overlayKey
    const datasets: any[] = [ base ];
  const colors = { ema: ['#60a5fa', '#fb923c', '#34d399'], bbands: ['#ef4444', '#f59e0b', '#10b981'] };

        if (overlayKey === 'ema' && payload.indicators?.ema) {
      Object.keys(payload.indicators.ema).forEach((p: string, idx: number) => {
        const arr = payload.indicators.ema[p].map((v: any) => (v === null ? null : Number(v)));
        datasets.push({ label: `EMA ${p}`, data: arr, borderColor: colors.ema[idx % colors.ema.length], backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 1, spanGaps: true });
      });
    } else if (overlayKey === 'bbands' && payload.indicators?.bbands) {
      const mid = payload.indicators.bbands.mid.map((v: any) => (v === null ? null : Number(v)));
      const upper = payload.indicators.bbands.upper.map((v: any) => (v === null ? null : Number(v)));
      const lower = payload.indicators.bbands.lower.map((v: any) => (v === null ? null : Number(v)));
      datasets.push({ label: 'BB Upper', data: upper, borderColor: colors.bbands[0], backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 1, spanGaps: true });
      datasets.push({ label: 'BB Mid', data: mid, borderColor: colors.bbands[1], backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 1, spanGaps: true });
      datasets.push({ label: 'BB Lower', data: lower, borderColor: colors.bbands[2], backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, borderWidth: 1, spanGaps: true });
    }

    // Main chart with dark theme friendly colors and limited height + animation
    chartRef.current = new Chart(mainRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        animation: { duration: 600, easing: 'easeOutQuart' },
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { display: true, ticks: { color: '#9ca3af', display: false } },
          y: { display: true, ticks: { color: '#9ca3af' } }
        },
        plugins: {
          legend: { labels: { color: '#cbd5e1' } },
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (ctx: any) => {
                if (!ctx || !ctx[0]) return '';
                const idx = ctx[0].dataIndex;
                try { return new Date(labels[idx]).toLocaleString(); } catch (e) { return String(labels[idx]); }
              },
              label: (ctx: any) => {
                return `${ctx.dataset.label}: ${ctx.formattedValue}`;
              },
              afterBody: (ctx: any) => {
                if (!ctx || !ctx[0]) return [];
                const idx = ctx[0].dataIndex;
                const o = payload.ohlcv || {};
                const parts: string[] = [];
                try {
                  parts.push(`Open: ${o.open[idx]}`);
                  parts.push(`High: ${o.high[idx]}`);
                  parts.push(`Low: ${o.low[idx]}`);
                  parts.push(`Close: ${o.close[idx]}`);
                  parts.push(`Volume: ${o.volume ? o.volume[idx] : 'n/a'}`);
                } catch (e) {}
                // include a few indicator values if present
                try {
                  if (payload.indicators?.rsi) parts.push(`RSI: ${payload.indicators.rsi[idx]}`);
                  if (payload.indicators?.macd) parts.push(`MACD: ${payload.indicators.macd.macd[idx]} / Sig: ${payload.indicators.macd.signal[idx]}`);
                } catch (e) {}
                return parts;
              }
            }
          }
        },
      }
    });

    // MACD chart (separate canvas)
    if ((indicators && indicators.macd) && payload.indicators?.macd) {
      // destroy previous macd chart if any
      if (macdChartRef.current) {
        try { macdChartRef.current.destroy(); } catch (e) {}
        macdChartRef.current = null;
      }
      const macd = payload.indicators.macd.macd.map((v: any) => (v === null ? null : Number(v)));
      const signal = payload.indicators.macd.signal.map((v: any) => (v === null ? null : Number(v)));
      const hist = payload.indicators.macd.hist.map((v: any) => (v === null ? null : Number(v)));
      const datasets2 = [ { type: 'bar', label: 'MACD Hist', data: hist, backgroundColor: '#7f7f7f' }, { type: 'line', label: 'MACD', data: macd, borderColor: '#60a5fa', pointRadius: 0, borderWidth: 1, tension: 0.35 }, { type: 'line', label: 'Signal', data: signal, borderColor: '#fb923c', pointRadius: 0, borderWidth: 1, tension: 0.35 } ];
      macdChartRef.current = new Chart(macdRef.current, { type: 'bar', data: { labels, datasets: datasets2 }, options: { maintainAspectRatio: false, animation: { duration: 500 }, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { title: (ctx: any) => { if (!ctx || !ctx[0]) return ''; const idx = ctx[0].dataIndex; try { return new Date(labels[idx]).toLocaleString(); } catch (e) { return String(labels[idx]); } }, label: (ctx: any) => `${ctx.dataset.label}: ${ctx.formattedValue}` } } }, scales: { x: { ticks: { display: false } } } } });
    } else {
      if (macdChartRef.current) { try { macdChartRef.current.destroy(); } catch (e) {} macdChartRef.current = null; }
    }

    // RSI chart (separate canvas)
    if ((indicators && indicators.rsi) && payload.indicators?.rsi) {
      if (rsiChartRef.current) {
        try { rsiChartRef.current.destroy(); } catch (e) {}
        rsiChartRef.current = null;
      }
      const rsiArr = payload.indicators.rsi.map((v: any) => (v === null ? null : Number(v)));
      rsiChartRef.current = new Chart(rsiRef.current, { type: 'line', data: { labels, datasets: [ { label: 'RSI', data: rsiArr, borderColor: '#9467bd', pointRadius: 0, borderWidth: 1, tension: 0.35 } ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { title: (ctx: any) => { if (!ctx || !ctx[0]) return ''; const idx = ctx[0].dataIndex; try { return new Date(labels[idx]).toLocaleString(); } catch (e) { return String(labels[idx]); } }, label: (ctx: any) => `${ctx.dataset.label}: ${ctx.formattedValue}` } } }, scales: { x: { ticks: { display: false } }, y: { min: 0, max: 100 } } } });
    } else {
      if (rsiChartRef.current) { try { rsiChartRef.current.destroy(); } catch (e) {} rsiChartRef.current = null; }
    }
  }

  useEffect(() => { fetchData(symbol); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // when overlay or indicatorSet changes, re-render charts from cache if available
  useEffect(() => {
    const cached = cache[symbol];
    if (cached) {
      renderCharts(cached, overlay, indicatorSet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, indicatorSet]);

  // keep checkboxes in sync when overlay dropdown changes
  useEffect(() => {
    setIndicatorSet((s) => {
      const next = { ...s };
      if (overlay === 'bbands') {
        next.bbands = true;
        next.ema = false;
      } else if (overlay === 'ema') {
        next.ema = true;
        next.bbands = false;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  // fetch news on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/news?limit=5`);
        if (res.ok) {
          const j = await res.json();
          // support either an object { articles: [...] } or an array response
          let items: any[] = [];
          if (Array.isArray(j)) items = j;
          else if (Array.isArray(j.articles)) items = j.articles;
          else if (Array.isArray(j.data)) items = j.data;
          // normalize fields
          items = items.map((it: any) => ({ id: it.id || it.url || Math.random().toString(36).slice(2), title: it.title || it.document || it.text || '', url: it.url || it.link || '', published_at: it.published_at || it.published || '', sentiment: it.sentiment || 'neutral' }));
          setNews(items);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#071026] text-white p-6">
      <nav className="flex items-center justify-between mb-6">
        <div className="text-xl font-bold">Crypto Sentinel</div>
        <div className="flex gap-4">
          <a className="text-sm text-zinc-300" href="#">Dashboard</a>
          <a className="text-sm text-zinc-300" href="#news">News</a>
          <a className="text-sm text-zinc-300" href="#about">About</a>
        </div>
      </nav>

      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Technical Analysis</h1>
      </header>

      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <select value={symbol} onChange={(e) => { const s = e.target.value; setSymbol(s); const key = `${s}`; if (!cache[key]) { fetchData(s); } else { renderCharts(cache[key], overlay, indicatorSet); } }} className="border px-2 py-1 bg-zinc-900 text-white">
            <option>BTC</option>
            <option>ETH</option>
            <option>SOL</option>
            <option>BNB</option>
            <option>XRP</option>
            <option>ADA</option>
            <option>DOGE</option>
          </select>

          
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <label className="mr-2">Indicators:</label>
            {['ema','macd','rsi','bbands'].map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!indicatorSet[k]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    // enforce mutual exclusion: bbands <-> ema for overlays
                    setIndicatorSet((s) => {
                      const next = { ...s, [k]: checked };
                      if (k === 'bbands' && checked) {
                        next.ema = false;
                        setOverlay('bbands');
                      }
                      if (k === 'ema' && checked) {
                        next.bbands = false;
                        setOverlay('ema');
                      }
                      // if user unchecked an overlay checkbox, and it was the active overlay, clear overlay
                      if ((k === 'bbands' || k === 'ema') && !checked) {
                        if (overlay === k) setOverlay('none');
                      }
                      return next;
                    });
                  }}
                />
                <span className="ml-1">{k.toUpperCase()}</span>
              </label>
            ))}
          </div>

        </div>
      </div>

      <div className="flex justify-center mb-4">
        <button onClick={() => fetchData(symbol, true)} className="bg-blue-600 text-white px-4 py-2 rounded">Refresh Chart</button>
        {loading && <span className="ml-2 text-sm">Loading…</span>}
      </div>
      {error && <div className="text-red-400 mb-4">{error}</div>}


      <div style={{ height: 460, background: '#071026', padding: 10, borderRadius: 8, boxShadow: '0 6px 18px rgba(2,6,23,0.6)' }}>
        <canvas ref={mainRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="mt-4 grid gap-2">
        <div style={{ height: 120 }}>
          <canvas ref={macdRef} style={{ width: '100%', height: '100%' }} />
        </div>
        <div style={{ height: 120 }}>
          <canvas ref={rsiRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      <section id="news" className="mt-8 bg-[#051227] p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Latest News & Sentiment</h2>
        <div className="grid gap-3">
          {news.slice(0, 5).map((n) => (
            <a key={n.id} href={n.url || '#'} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#072033] rounded hover:bg-[#083246] transition">
              <div className="flex justify-between items-start">
                <div className="font-medium">{n.title}</div>
                <div className={`px-2 py-1 rounded text-sm ${n.sentiment==='positive' ? 'bg-green-600' : n.sentiment==='negative' ? 'bg-red-600' : 'bg-gray-600'}`}>{n.sentiment}</div>
              </div>
              <div className="text-xs text-zinc-400 mt-1">{new Date(n.published_at).toLocaleString()}</div>
            </a>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={async () => { const res = await fetch(`${API_BASE}/api/news?limit=50`); if (res.ok) { const j = await res.json(); setNews(j.articles || []); } }} className="px-3 py-1 bg-zinc-700 rounded">View all</button>
        </div>
      </section>
    </div>
  );
}
