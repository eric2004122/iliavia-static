/* Local reader controls; all source text remains server-rendered and escaped. */
(() => {
  const reader = document.querySelector('[data-document-version]');
  if (!reader) return;
  const tools = reader.querySelector('[data-reader-tools]');
  const smallScreen = window.matchMedia('(max-width: 850px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manuallyToggled = false;
  tools?.querySelector('summary')?.addEventListener('click', () => { manuallyToggled = true; });
  const adaptTools = () => {
    if (!tools || manuallyToggled) return;
    const query = reader.querySelector('input[name="q"]')?.value;
    tools.open = Boolean(query) || !smallScreen.matches;
  };
  adaptTools();
  smallScreen.addEventListener?.('change', adaptTools);

  const marks = Array.from(reader.querySelectorAll('[data-source-body] mark[id]'));
  const counter = reader.querySelector('[data-match-position]');
  const previous = reader.querySelector('[data-match-prev]');
  const next = reader.querySelector('[data-match-next]');
  let current = -1;
  function selectMatch(index, move = true) {
    if (!marks.length) return;
    current = (index + marks.length) % marks.length;
    reader.querySelectorAll('mark.is-current-match').forEach(mark => mark.classList.remove('is-current-match'));
    const target = marks[current];
    reader.querySelectorAll('[data-source-match]').forEach(mark => {
      if (mark.dataset.sourceMatch === target.id) mark.classList.add('is-current-match');
    });
    if (counter) counter.textContent = (current + 1) + ' / ' + marks.length + ' 筆';
    if (previous) previous.href = '#' + marks[(current - 1 + marks.length) % marks.length].id;
    if (next) next.href = '#' + marks[(current + 1) % marks.length].id;
    if (move) {
      if (tools && smallScreen.matches) tools.open = false;
      target.focus({preventScroll: true});
      target.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center'});
      const url = new URL(location.href);
      url.hash = target.id;
      history.replaceState(history.state, '', url);
    }
  }
  function plainClick(event) {
    return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  }
  previous?.addEventListener('click', event => {
    if (!plainClick(event)) return;
    event.preventDefault();
    selectMatch(current < 0 ? marks.length - 1 : current - 1);
  });
  next?.addEventListener('click', event => {
    if (!plainClick(event)) return;
    event.preventDefault();
    selectMatch(current + 1);
  });
  reader.querySelectorAll('[data-match-link]').forEach(link => {
    link.addEventListener('click', event => {
      if (!plainClick(event)) return;
      event.preventDefault();
      selectMatch(Number(link.dataset.matchLink));
    });
  });
  if (marks.length) {
    let hash = '';
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { /* Keep the first match. */ }
    const initial = marks.findIndex(mark => mark.id === hash);
    selectMatch(initial >= 0 ? initial : 0, false);
  }

  const tocLinks = Array.from(reader.querySelectorAll('[data-toc-link]'));
  if ('IntersectionObserver' in window && tocLinks.length) {
    const observer = new IntersectionObserver(entries => {
      const seen = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!seen.length) return;
      const id = seen[0].target.id;
      tocLinks.forEach(link => {
        if (link.getAttribute('href') === '#' + id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin: '-135px 0px -55% 0px', threshold: 0});
    reader.querySelectorAll('[data-reader-section]').forEach(section => observer.observe(section));
  }

  const notice = reader.querySelector('[data-reader-update]');
  const status = reader.querySelector('[data-reader-status]');
  reader.querySelector('[data-reader-refresh]')?.addEventListener('click', () => location.reload());
  let timer;
  let outdated = false;
  async function check() {
    if (document.hidden) return;
    try {
      const response = await fetch(reader.dataset.documentStateUrl, {cache: 'no-store', credentials: 'same-origin'});
      if (!response.ok) return;
      const state = await response.json();
      if (state.last_success) {
        const parsed = new Date(state.last_success);
        if (!Number.isNaN(parsed.valueOf())) {
          const time = reader.querySelector('[data-sync-time]');
          if (time) {
            time.dateTime = state.last_success;
            time.textContent = new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(parsed);
          }
        }
      }
      if (state.available && state.version !== reader.dataset.documentVersion) {
        outdated = true;
        if (notice) notice.hidden = false;
        if (status) status.textContent = '共編筆記有新內容，可查看變更的分頁與段落，再更新這一頁。';
        clearInterval(timer);
      }
    } catch (_) { /* Keep the complete last snapshot when offline. */ }
  }
  function start() {
    clearInterval(timer);
    if (!outdated) timer = setInterval(check, 15000);
    check();
  }
  start();
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
