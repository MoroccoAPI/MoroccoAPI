/** No third-party scripts: the playground only sends GET requests to this API's origin. */
export const client = String.raw`
(() => {
  const config = JSON.parse(document.getElementById('docs-config').textContent);
  const w = config.words;
  const form = document.getElementById('request-form');
  const code = document.getElementById('request-code');
  const run = document.getElementById('run');
  const copy = document.getElementById('copy');
  const response = document.getElementById('response-body');
  const status = document.getElementById('response-status');
  const placeholder = document.getElementById('response-placeholder');
  const tabs = [...document.querySelectorAll('[role=tab]')];
  let mode = 'curl';
  let controller;
  let revision = 0;
  let copyTimer;
  let url;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'";

  function update() {
    revision++;
    controller?.abort();
    run.disabled = false;
    document.getElementById('run-label').textContent = w.run;
    let path = config.path;
    const query = new URLSearchParams();
    for (const parameter of config.parameters) {
      const input = form.elements.namedItem(parameter.name);
      const value = input.value.trim();
      if (parameter.in === 'path') path = path.replace('{' + parameter.name + '}', encodeURIComponent(value || '{' + parameter.name + '}'));
      else if (parameter.in === 'query' && value !== '') query.set(parameter.name, value);
    }
    url = new URL(path, location.origin);
    url.search = query.toString();
    renderCode();
    response.hidden = true;
    response.textContent = '';
    placeholder.hidden = false;
    status.textContent = '';
  }

  function renderCode() {
    code.textContent = mode === 'curl'
      ? 'curl ' + quote(url.href)
      : 'const response = await fetch(' + JSON.stringify(url.href) + ');\nif (!response.ok) throw new Error(\x60HTTP \x24{response.status}\x60);\nconst result = await response.json();\nconsole.log(result.data);';
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('invalid', () => {
    document.getElementById('request-parameters').open = true;
  }, true);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    controller?.abort();
    controller = new AbortController();
    const activeController = controller;
    const requestRevision = ++revision;
    run.disabled = true;
    document.getElementById('run-label').textContent = w.loading;
    status.textContent = w.loading;
    status.classList.remove('error');
    const start = performance.now();
    const timeout = setTimeout(() => activeController.abort(), 20000);
    try {
      const result = await fetch(url.href, {signal: activeController.signal, headers: {Accept: 'application/json'}, credentials: 'omit'});
      const text = await result.text();
      if (requestRevision !== revision) return;
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Show non-JSON server errors as text. */ }
      const escaped = escape(pretty);
      response.innerHTML = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g,
        (match, string, colon, literal, number) => '<span class="' + (string ? colon ? 'json-key' : 'json-string' : number ? 'json-number' : 'json-null') + '">' + match + '</span>');
      response.hidden = false;
      placeholder.hidden = true;
      status.textContent = result.status + ' · ' + Math.round(performance.now() - start) + ' ms';
      status.classList.toggle('error', !result.ok);
    } catch (error) {
      if (requestRevision !== revision) return;
      status.textContent = error.name === 'AbortError' ? w.cancelled : w.failed;
      status.classList.add('error');
      response.hidden = true;
      placeholder.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (requestRevision === revision) {
        run.disabled = false;
        document.getElementById('run-label').textContent = w.run;
      }
    }
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      tabs.forEach(item => {
        item.setAttribute('aria-selected', String(item === tab));
        item.tabIndex = item === tab ? 0 : -1;
      });
      code.setAttribute('aria-labelledby', tab.id);
      renderCode();
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = document.documentElement.dir === 'rtl' ? -1 : 1;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? direction : -direction) + tabs.length) % tabs.length;
      tabs[next].click();
      tabs[next].focus();
    });
  });

  copy.addEventListener('click', async () => {
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(code.textContent);
      copy.textContent = w.copied;
    } catch {
      copy.textContent = w.copyFailed;
    }
    copyTimer = setTimeout(() => { copy.textContent = w.copy; }, 2500);
  });

  const search = document.getElementById('resource-search');
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
  search.addEventListener('input', () => {
    const query = normalize(search.value);
    let found = 0;
    document.querySelectorAll('.nav-group').forEach(group => {
      let matches = 0;
      group.querySelectorAll('.endpoint-link').forEach(link => {
        const match = !query || normalize(link.dataset.search).includes(query);
        link.hidden = !match;
        if (match) matches++;
      });
      group.hidden = matches === 0;
      group.open = query ? matches > 0 : false;
      found += matches;
    });
    document.getElementById('no-results').hidden = found !== 0;
  });

  document.getElementById('base-url').textContent = location.origin + '/api/v2';
  update();
})();
`;
