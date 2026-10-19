/** Apply the saved or system theme before the first paint; storage may be blocked. */
export const themeInit = String.raw`
(() => {
  let preference;
  try { preference = localStorage.getItem('moroccoapi-theme'); } catch {}
  document.documentElement.dataset.theme = preference === 'light' || preference === 'dark'
    ? preference : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();`;

export const themeClient = String.raw`
(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  let chosen;
  try { chosen = localStorage.getItem('moroccoapi-theme'); } catch {}
  let manual = chosen === 'light' || chosen === 'dark';
  const buttons = document.querySelectorAll('.theme-toggle');
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    buttons.forEach(button => {
      const dark = theme === 'dark';
      const label = dark ? button.dataset.lightLabel : button.dataset.darkLabel;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(dark));
      button.querySelector('.theme-text').textContent = label;
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111c18' : '#ffffff');
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    manual = true;
    try { localStorage.setItem('moroccoapi-theme', next); } catch {}
    apply(next);
  }));
  media.addEventListener('change', event => { if (!manual) apply(event.matches ? 'dark' : 'light'); });
  apply(document.documentElement.dataset.theme);
})();`;

export const themeStyles = `
.theme-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;min-width:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:14px;cursor:pointer;flex-shrink:0}
.theme-toggle:hover{background:var(--mint)}.theme-toggle svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.theme-toggle:focus-visible{outline:3px solid var(--green);outline-offset:3px}
.sun-icon{display:none}[data-theme=dark] .sun-icon{display:block}[data-theme=dark] .moon-icon{display:none}
@media(max-width:850px){.theme-text{display:none}}
`;

export function themeButton(lightLabel: string, darkLabel: string): string {
  // Labels are supplied by our static translation catalogues.
  return `<button type="button" class="theme-toggle" data-light-label="${lightLabel}" data-dark-label="${darkLabel}" aria-label="${darkLabel}" title="${darkLabel}" aria-pressed="false"><svg class="moon-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 13.2A9 9 0 0 1 10.8 3.3a9 9 0 1 0 9.9 9.9Z"/></svg><svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg><span class="theme-text">${darkLabel}</span></button>`;
}
