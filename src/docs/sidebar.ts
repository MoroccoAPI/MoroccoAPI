export const sidebarInit = String.raw`
(() => {
  let preference;
  try { preference = localStorage.getItem('moroccoapi-sidebar'); } catch {}
  document.documentElement.dataset.sidebar = preference === 'collapsed' ? 'collapsed' : 'expanded';
})();`;

export const sidebarClient = String.raw`
(() => {
  const w = JSON.parse(document.getElementById('docs-config').textContent).words;
  const root = document.documentElement;
  const menu = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('drawer-backdrop');
  const search = document.getElementById('resource-search');
  const narrow = matchMedia('(max-width: 1100px)');

  function updateButton(open) {
    const label = open ? w.hideSidebar : w.showSidebar;
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', label);
    menu.setAttribute('title', label);
  }

  function setDrawer(open, restoreFocus = true) {
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      search.focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (restoreFocus) menu.focus();
    }
    updateButton(narrow.matches ? open : root.dataset.sidebar !== 'collapsed');
  }

  menu.addEventListener('click', () => {
    if (narrow.matches) {
      setDrawer(!sidebar.classList.contains('is-open'));
    } else {
      const preference = root.dataset.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
      root.dataset.sidebar = preference;
      try { localStorage.setItem('moroccoapi-sidebar', preference); } catch {}
      updateButton(preference === 'expanded');
    }
  });
  document.getElementById('menu-close').addEventListener('click', () => setDrawer(false));
  backdrop.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', event => {
    if (!narrow.matches || !sidebar.classList.contains('is-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
    if (event.key === 'Tab') {
      const focusable = [...sidebar.querySelectorAll('a, input, button, summary')].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  narrow.addEventListener('change', () => setDrawer(false, false));
  setDrawer(false, false);
})();`;
