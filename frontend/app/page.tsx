"use client";

import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function DashboardPage() {
  const [symbol, setSymbol] = useState("BTC");
  const [indicator, setIndicator] = useState("ema");
  const [loading, setLoading] = useState(false);
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const indRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const indChartRef = useRef<any>(null);

  useEffect(() => {
    // load Chart.js from CDN
    if (typeof window === "undefined") return;
    if ((window as any).Chart) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  async function fetchData(sym: string) {
    setLoading(true);
    try {
      const url = `${API_BASE}/api/data?symbol=${encodeURIComponent(sym)}&days=90`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderCharts(data);
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  }

  function renderCharts(payload: any) {
    if (!payload || !payload.ohlcv) return;
    const ts = payload.ohlcv.timestamp;
    const close = payload.ohlcv.close.map((v: any) => (v === null ? null : Number(v)));

    const labels = ts;

    // wait for Chart
    if (typeof (window as any).Chart === "undefined") {
      setTimeout(() => renderCharts(payload), 200);
      return;
    }

    const Chart = (window as any).Chart;

    // destroy existing
    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch (e) {}
      chartRef.current = null;
    }
    if (indChartRef.current) {
      try { indChartRef.current.destroy(); } catch (e) {}
      indChartRef.current = null;
    }

    // base dataset
    const base = { label: "Close", data: close, borderColor: "black", backgroundColor: "black", tension: 0 };

    if (indicator === "ema" && payload.indicators?.ema) {
      const datasets = [base];
      const colors = ["#1f77b4", "#ff7f0e", "#2ca02c"];
      Object.keys(payload.indicators.ema).forEach((p: string, idx: number) => {
        const arr = payload.indicators.ema[p].map((v: any) => (v === null ? null : Number(v)));
        datasets.push({ label: `EMA ${p}`, data: arr, borderColor: colors[idx % colors.length], backgroundColor: "transparent", tension: 0 });
      });
      chartRef.current = new Chart(mainRef.current, { type: "line", data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else if (indicator === "bbands" && payload.indicators?.bbands) {
      const mid = payload.indicators.bbands.mid.map((v: any) => (v === null ? null : Number(v)));
      const upper = payload.indicators.bbands.upper.map((v: any) => (v === null ? null : Number(v)));
      const lower = payload.indicators.bbands.lower.map((v: any) => (v === null ? null : Number(v)));
      const datasets = [base, { label: "BB Upper", data: upper, borderColor: "red", backgroundColor: "transparent" }, { label: "BB Mid", data: mid, borderColor: "orange", backgroundColor: "transparent" }, { label: "BB Lower", data: lower, borderColor: "red", backgroundColor: "transparent" }];
      chartRef.current = new Chart(mainRef.current, { type: "line", data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else {
      // price only
      chartRef.current = new Chart(mainRef.current, { type: "line", data: { labels, datasets: [base] }, options: { scales: { x: { display: true }, y: { display: true } } } });
    }

    if (indicator === "macd" && payload.indicators?.macd) {
      const macd = payload.indicators.macd.macd.map((v: any) => (v === null ? null : Number(v)));
      const signal = payload.indicators.macd.signal.map((v: any) => (v === null ? null : Number(v)));
      const hist = payload.indicators.macd.hist.map((v: any) => (v === null ? null : Number(v)));
      const datasets = [ { type: 'bar', label: 'MACD Hist', data: hist, backgroundColor: '#7f7f7f' }, { type: 'line', label: 'MACD', data: macd, borderColor: '#1f77b4', pointRadius: 0 }, { type: 'line', label: 'Signal', data: signal, borderColor: '#ff7f0e', pointRadius: 0 } ];
      indChartRef.current = new Chart(indRef.current, { type: 'bar', data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else if (indicator === 'rsi' && payload.indicators?.rsi) {
      const rsiArr = payload.indicators.rsi.map((v: any) => (v === null ? null : Number(v)));
      indChartRef.current = new Chart(indRef.current, { type: 'line', data: { labels, datasets: [ { label: 'RSI', data: rsiArr, borderColor: '#9467bd', pointRadius: 0 } ] }, options: { scales: { x: { display: true }, y: { min: 0, max: 100 } } } });
    }
  }

  useEffect(() => { fetchData(symbol); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Crypto Sentinel — Dashboard</h1>
      <div className="flex gap-4 mb-4">
        <select value={symbol} onChange={(e) => { setSymbol(e.target.value); fetchData(e.target.value); }} className="border px-2 py-1">
          <option>BTC</option>
          <option>ETH</option>
          <option>SOL</option>
          <option>BNB</option>
          <option>XRP</option>
          <option>ADA</option>
          <option>DOGE</option>
        </select>
        <select value={indicator} onChange={(e) => setIndicator(e.target.value)} className="border px-2 py-1">
          <option value="ema">EMA (overlay)</option>
          <option value="macd">MACD (below)</option>
          <option value="rsi">RSI (below)</option>
          <option value="bbands">Bollinger Bands (overlay)</option>
        </select>
        <button onClick={() => fetchData(symbol)} className="bg-blue-600 text-white px-3 py-1 rounded">Refresh</button>
        {loading && <span className="ml-2">Loading…</span>}
      </div>

      <div>
        <canvas ref={mainRef} style={{ width: '100%', height: 300 }} />
      </div>
      <div className="mt-4">
        <canvas ref={indRef} style={{ width: '100%', height: 150 }} />
      </div>
    </div>
  );
}
