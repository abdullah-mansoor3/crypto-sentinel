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
