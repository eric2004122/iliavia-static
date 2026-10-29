/* 管理員的「更新網站」按鈕：用管理員自己的 GitHub 權杖觸發 GitHub Actions 重新讀取 Google 文件並發布。
   權杖只存在這個瀏覽器（勾「記住」才放 localStorage，否則只到關閉分頁為止），只送往 api.github.com。 */
(() => {
  const root = document.querySelector('[data-admin-update]');
  const form = document.querySelector('[data-admin-token-form]');
  if (!root || !form) return;
  const KEY = 'avia-github-token';
  const {repo, workflow, ref, stateUrl} = root.dataset;
  const status = root.querySelector('[data-admin-status]');
  const run = root.querySelector('[data-admin-run]');
  const link = root.querySelector('[data-admin-run-link]');
  const updated = root.querySelector('[data-admin-updated]');
  const input = form.querySelector('[data-admin-token-input]');
  const remember = form.querySelector('[data-admin-remember]');
  const token = {
    get() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch (_) { return ''; } },
    set(value, keep) {
      try {
        sessionStorage.setItem(KEY, value);
        if (keep) localStorage.setItem(KEY, value); else localStorage.removeItem(KEY);
      } catch (_) { /* 無痕模式等不能存的情況：只影響這一頁 */ }
    },
    clear() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (_) { /* 忽略 */ } },
  };
  const say = text => { status.textContent = text; };
  const time = iso => new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date(iso));
  const showUpdated = () => fetch(stateUrl, {cache: 'no-store', credentials: 'same-origin'})
    .then(response => response.ok ? response.json() : null)
    .then(state => { if (state && state.last_success) updated.textContent = time(state.last_success); })
    .catch(() => { updated.textContent = '暫時讀不到'; });
  showUpdated();
  try { remember.checked = Boolean(localStorage.getItem(KEY)); } catch (_) { /* 忽略 */ }
  if (!repo) { form.hidden = true; return; }

  class AuthError extends Error {}
  async function github(path, options = {}) {
    const response = await fetch('https://api.github.com/repos/' + repo + path, Object.assign({}, options, {
      cache: 'no-store',
      headers: Object.assign({Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + token.get()}, options.headers || {}),
    }));
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new AuthError(String(response.status));
    if (!response.ok) throw new Error(String(response.status));
    return response.status === 204 ? null : response.json();
  }
  const latestRun = async () => (await github('/actions/workflows/' + workflow + '/runs?per_page=1')).workflow_runs[0] || null;
  const STEPS = {queued: '排隊中…', requested: '排隊中…', waiting: '等待中…', pending: '等待中…', in_progress: '正在讀取 Google 文件並產生網站…'};
  const failure = error => error instanceof AuthError
    ? '權杖沒有這個網站的權限、打錯了或已經過期，請照下方說明重新建立並儲存。'
    : '暫時連不到 GitHub，請稍後再試。';
  const describe = item => item.status !== 'completed'
    ? (STEPS[item.status] || '處理中…')
    : item.conclusion === 'success'
      ? '上一次更新成功（' + time(item.updated_at) + '）。'
      : '上一次更新沒有成功（' + time(item.updated_at) + '），可以點「在 GitHub 看進度」看原因，或再按一次。';

  function ready() {
    const has = Boolean(token.get());
    run.disabled = !has;
    if (!has) { say('先在下方貼上 GitHub 權杖，就能按「更新網站」。'); return; }
    latestRun().then(item => {
      if (!item) { say('還沒有更新紀錄，可以按「更新網站」。'); return; }
      link.href = item.html_url; link.hidden = false; say(describe(item));
    }).catch(error => say(failure(error)));
  }

  let timer;
  async function follow(previousId) {
    clearTimeout(timer);
    try {
      const item = await latestRun();
      if (!item || item.id === previousId) { say('已送出，等 GitHub 開始…'); timer = setTimeout(() => follow(previousId), 4000); return; }
      link.href = item.html_url; link.hidden = false;
      if (item.status !== 'completed') { say(STEPS[item.status] || '處理中…'); timer = setTimeout(() => follow(previousId), 8000); return; }
      run.disabled = false;
      if (item.conclusion === 'success') { say('更新完成！重新整理網站就會看到最新內容。'); showUpdated(); }
      else say(describe(item));
    } catch (error) { run.disabled = false; say(failure(error)); }
  }

  run.addEventListener('click', async () => {
    run.disabled = true;
    say('正在送出更新…');
    try {
      const previous = await latestRun();
      await github('/actions/workflows/' + workflow + '/dispatches', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ref})});
      follow(previous ? previous.id : null);
    } catch (error) { run.disabled = false; say(failure(error)); }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!/^[A-Za-z0-9_]{20,255}$/.test(value)) { say('權杖格式看起來不對，請複製 github_pat_ 開頭的整串再貼一次。'); return; }
    token.set(value, remember.checked);
    input.value = '';
    say('已儲存，正在確認權限…');
    ready();
  });
  form.querySelector('[data-admin-forget]').addEventListener('click', () => {
    token.clear(); remember.checked = false; link.hidden = true; ready();
  });
  remember.addEventListener('change', () => { const value = token.get(); if (value) token.set(value, remember.checked); });
  ready();
})();
