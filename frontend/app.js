document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reqForm');
  const methodEl = document.getElementById('method');
  const pathEl = document.getElementById('path');
  const headersEl = document.getElementById('headers');
  const bodyEl = document.getElementById('body');

  const statusEl = document.getElementById('status');
  const respHeadersEl = document.getElementById('respHeaders');
  const respBodyEl = document.getElementById('respBody');
  const copyBtn = document.getElementById('copyResp');
  const clearBtn = document.getElementById('clear');
  const symbolSelect = document.getElementById('symbolSelect');
  const indicatorSelect = document.getElementById('indicatorSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const mainCanvas = document.getElementById('mainChart');
  const indicatorCanvas = document.getElementById('indicatorChart');

  // load Chart.js dynamically
  const chartScript = document.createElement('script');
  chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  document.head.appendChild(chartScript);

  let mainChart = null;
  let indicatorChart = null;

  function makeLineDataset(label, data, color = 'blue', yAxis = 'y') {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      parsing: false,
      yAxisID: yAxis,
      tension: 0,
      pointRadius: 0,
    };
  }

  async function fetchTechnical(symbol = 'BTC', days = 90) {
    const url = new URL(buildUrl(`/api/data`));
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('days', String(days));
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`Fetch error ${resp.status}`);
    return resp.json();
  }

  function renderCharts(payload, indicatorKey) {
    if (!payload || !payload.ohlcv) return;
    const ts = payload.ohlcv.timestamp;
    const close = payload.ohlcv.close;

    // prepare labels and numeric arrays
    const labels = ts;
    const priceArr = close.map(v => (v === null ? null : Number(v)));

    // wait for Chart to be loaded
    if (typeof Chart === 'undefined') {
      setTimeout(() => renderCharts(payload, indicatorKey), 200);
      return;
    }

    // destroy existing
    if (mainChart) mainChart.destroy();
    if (indicatorChart) indicatorChart.destroy();

    // base close dataset
    const baseDatasets = [{ label: 'Close', data: priceArr, borderColor: 'black', backgroundColor: 'black', tension: 0, pointRadius: 0 }];

    const indicators = payload.indicators || {};
    if (indicatorKey === 'ema' && indicators.ema) {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c'];
      const datasets = baseDatasets.slice();
      const periods = Object.keys(indicators.ema);
      periods.forEach((p, idx) => {
        const arr = indicators.ema[p].map(v => (v === null ? null : Number(v)));
        datasets.push({ label: `EMA ${p}`, data: arr, borderColor: colors[idx % colors.length], backgroundColor: colors[idx % colors.length], tension: 0, pointRadius: 0 });
      });
      mainChart = new Chart(mainCanvas, { type: 'line', data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else if (indicatorKey === 'bbands' && indicators.bbands) {
      const mid = indicators.bbands.mid.map(v => (v === null ? null : Number(v)));
      const upper = indicators.bbands.upper.map(v => (v === null ? null : Number(v)));
      const lower = indicators.bbands.lower.map(v => (v === null ? null : Number(v)));
      const datasets = baseDatasets.slice();
      datasets.push({ label: 'BB Upper', data: upper, borderColor: 'red', backgroundColor: 'transparent', tension: 0, pointRadius: 0 });
      datasets.push({ label: 'BB Mid', data: mid, borderColor: 'orange', backgroundColor: 'transparent', tension: 0, pointRadius: 0 });
      datasets.push({ label: 'BB Lower', data: lower, borderColor: 'red', backgroundColor: 'transparent', tension: 0, pointRadius: 0 });
      mainChart = new Chart(mainCanvas, { type: 'line', data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else if (indicatorKey === 'macd' && indicators.macd) {
      const macd = indicators.macd.macd.map(v => (v === null ? null : Number(v)));
      const signal = indicators.macd.signal.map(v => (v === null ? null : Number(v)));
      const hist = indicators.macd.hist.map(v => (v === null ? null : Number(v)));
      // top chart remains price
      mainChart = new Chart(mainCanvas, { type: 'line', data: { labels, datasets: baseDatasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
      // indicator chart: histogram + lines
      const datasets = [ { type: 'bar', label: 'MACD Hist', data: hist, backgroundColor: '#7f7f7f' }, { type: 'line', label: 'MACD', data: macd, borderColor: '#1f77b4', pointRadius: 0 }, { type: 'line', label: 'Signal', data: signal, borderColor: '#ff7f0e', pointRadius: 0 } ];
      indicatorChart = new Chart(indicatorCanvas, { type: 'bar', data: { labels, datasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    } else if (indicatorKey === 'rsi' && indicators.rsi) {
      const rsiArr = indicators.rsi.map(v => (v === null ? null : Number(v)));
      mainChart = new Chart(mainCanvas, { type: 'line', data: { labels, datasets: baseDatasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
      indicatorChart = new Chart(indicatorCanvas, { type: 'line', data: { labels, datasets: [ { label: 'RSI', data: rsiArr, borderColor: '#9467bd', pointRadius: 0 } ] }, options: { scales: { x: { display: true }, y: { min: 0, max: 100 } } } });
    } else {
      // default: just price
      mainChart = new Chart(mainCanvas, { type: 'line', data: { labels, datasets: baseDatasets }, options: { scales: { x: { display: true }, y: { display: true } } } });
    }
  }

  async function loadAndRender(symbol) {
    try {
      const payload = await fetchTechnical(symbol);
      renderCharts(payload, indicatorSelect.value);
    } catch (err) {
      console.error('Failed to load technical data', err);
      alert('Failed to load technical data: ' + err.message);
    }
  }

  // initial load
  loadAndRender(symbolSelect.value || 'BTC');

  // UI events
  symbolSelect.addEventListener('change', () => loadAndRender(symbolSelect.value));
  indicatorSelect.addEventListener('change', () => loadAndRender(symbolSelect.value));
  refreshBtn.addEventListener('click', () => loadAndRender(symbolSelect.value));

  function buildUrl(path) {
    path = path.trim();
    if (!path) return window.location.origin + '/';
    if (path.startsWith('/')) return window.location.origin + path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    // fallback: treat as relative
    return window.location.origin + '/' + path;
  }

  async function sendRequest(e) {
    if (e) e.preventDefault();
    const method = methodEl.value.toUpperCase();
    const rawPath = pathEl.value || '/';
    const url = buildUrl(rawPath);

    let headers = {};
    try {
      const htxt = headersEl.value.trim();
      headers = htxt ? JSON.parse(htxt) : {};
    } catch (err) {
      alert('Headers must be valid JSON. Example: {"Content-Type":"application/json"}');
      return;
    }

    let body = bodyEl.value;
    // Avoid sending body with GET/HEAD
    const hasBody = !['GET', 'HEAD'].includes(method);
    let fetchOptions = { method, headers };

    if (hasBody && body) {
      // If Content-Type not set, default to JSON
      const lcKeys = Object.keys(headers).map(k => k.toLowerCase());
      if (!lcKeys.includes('content-type')) {
        headers['Content-Type'] = 'application/json';
      }
      fetchOptions.body = body;
    }

    statusEl.textContent = 'Status: ⏳';
    respHeadersEl.textContent = '—';
    respBodyEl.textContent = '—';

    try {
      const resp = await fetch(url, fetchOptions);
      statusEl.textContent = `Status: ${resp.status} ${resp.statusText}`;

      // headers
      const hdrs = {};
      resp.headers.forEach((v,k) => hdrs[k] = v);
      respHeadersEl.textContent = JSON.stringify(hdrs, null, 2);

      // body
      const contentType = resp.headers.get('content-type') || '';
      const text = await resp.text();
      if (contentType.includes('application/json')) {
        try {
          const j = JSON.parse(text);
          respBodyEl.textContent = JSON.stringify(j, null, 2);
        } catch (err) {
          respBodyEl.textContent = text;
        }
      } else {
        respBodyEl.textContent = text || '—';
      }
    } catch (err) {
      statusEl.textContent = 'Status: Error';
      respBodyEl.textContent = String(err);
      respHeadersEl.textContent = '—';
    }
  }

  form.addEventListener('submit', sendRequest);
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(respBodyEl.textContent || '')?.catch(()=>{});
  });
  clearBtn.addEventListener('click', () => {
    statusEl.textContent = 'Status: —';
    respHeadersEl.textContent = '—';
    respBodyEl.textContent = '—';
  });

  // quick sample: press Ctrl+Enter to send
  bodyEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') sendRequest();
  });
});
