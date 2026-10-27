/* 靜態網站的頁內搜尋：在瀏覽器裡標出命中的字，產生摘要、上一筆／下一筆與各分頁命中數。
   全部用 textContent 與 DOM 建立，不把搜尋字串當 HTML。必須排在 reader.js 前面執行。 */
(() => {
  const reader = document.querySelector('[data-document-version]');
  if (!reader) return;
  const params = new URLSearchParams(location.search);
  const tabId = reader.dataset.tabId;
  const isIndex = reader.hasAttribute('data-document-index');

  // 舊網址 /document?tab=...：轉到新的分頁網址
  const legacy = params.get('tab');
  if (isIndex && legacy && legacy !== tabId) {
    const link = Array.from(reader.querySelectorAll('.reader-directory > nav a')).find(a => a.getAttribute('href').endsWith('/document/' + legacy + '/'));
    if (link) {
      params.delete('tab');
      location.replace(link.getAttribute('href') + (params.toString() ? '?' + params : '') + location.hash);
      return;
    }
  }

  const query = (params.get('q') || '').trim().slice(0, 120);
  if (!query) return;
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const withQuery = path => path + '?' + new URLSearchParams({q: query});
  const make = (tag, props, text) => {
    const element = Object.assign(document.createElement(tag), props || {});
    if (text !== undefined) element.textContent = text;
    return element;
  };

  // 1. 標出本頁命中：只看看得到的段落（空的黑歷史編號不算），每段原文接起來找
  const matches = [];
  reader.querySelectorAll('[data-source-body] section[data-reader-section]').forEach(section => {
    const nodes = [];
    let text = '';
    section.querySelectorAll('[data-source-block]').forEach(block => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        nodes.push({node, start: text.length});
        text += node.data;
      }
    });
    for (const found of text.matchAll(pattern)) {
      if (found[0]) matches.push({nodes, text, start: found.index, end: found.index + found[0].length, id: 'match-' + (matches.length + 1)});
    }
  });
  const pieces = new Map();
  matches.forEach(match => {
    let first = true;
    match.nodes.forEach(({node, start}) => {
      const from = Math.max(match.start, start), to = Math.min(match.end, start + node.data.length);
      if (from >= to) return;
      if (!pieces.has(node)) pieces.set(node, []);
      pieces.get(node).push({from: from - start, to: to - start, id: match.id, first});
      first = false;
    });
  });
  pieces.forEach((list, node) => {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    list.forEach(piece => {
      if (piece.from > cursor) fragment.append(node.data.slice(cursor, piece.from));
      const mark = make('mark', {}, node.data.slice(piece.from, piece.to));
      mark.dataset.sourceMatch = piece.id;
      if (piece.first) { mark.id = piece.id; mark.tabIndex = -1; }
      fragment.append(mark);
      cursor = piece.to;
    });
    if (cursor < node.data.length) fragment.append(node.data.slice(cursor));
    node.replaceWith(fragment);
  });
  // 搜尋時 18+／私人欄位也展開，命中的字才看得到
  reader.querySelectorAll('details[data-sensitive]').forEach(details => { details.open = true; });

  // 2. 搜尋工具：填回關鍵字、命中數、清除、摘要
  const tools = reader.querySelector('[data-reader-tools]');
  const form = tools && tools.querySelector('.reader-search');
  let result = null;
  if (tools) {
    tools.open = true;
    const hint = tools.querySelector('summary span:last-child');
    if (hint) hint.textContent = matches.length + ' 處命中';
  }
  if (form) {
    const input = form.querySelector('input[name="q"]');
    if (input) { input.value = query; input.setAttribute('aria-describedby', 'reader-search-result'); }
    const controls = form.querySelector('.reader-search-controls');
    if (controls) controls.append(make('a', {className: 'reader-search-clear', href: location.pathname}, '清除'));
    result = make('p', {id: 'reader-search-result', className: 'reader-search-result'}, matches.length ? '找到 ' + matches.length + ' 處「' + query + '」，點摘要直接前往原文。' : '這頁沒有找到「' + query + '」，你可以改用其他詞或切換分頁。');
    result.setAttribute('role', 'status');
    const added = [result];
    if (matches.length) {
      const list = make('ol', {className: 'reader-search-previews'});
      list.setAttribute('aria-label', '命中段落預覽');
      matches.slice(0, 40).forEach((match, index) => {
        const from = Math.max(0, match.start - 38), to = Math.min(match.text.length, match.end + 60);
        const link = make('a', {href: '#' + match.id});
        link.dataset.matchLink = String(index);
        link.append(match.text.slice(from, match.start), make('strong', {className: 'reader-snippet-hit'}, match.text.slice(match.start, match.end)), match.text.slice(match.end, to));
        const item = make('li');
        item.append(link);
        list.append(item);
      });
      added.push(list);
      if (matches.length > 40) added.push(make('p', {className: 'reader-search-result'}, '這裡顯示前40處摘要，原文保留全部搜尋標記。'));
    }
    form.after(...added);
  }

  // 3. 上一筆／下一筆（reader.js 會接手）
  const body = reader.querySelector('[data-source-body]');
  if (matches.length && body) {
    const nav = make('nav', {className: 'reader-match-navigation'});
    nav.setAttribute('aria-label', '搜尋命中定位');
    const previous = make('a', {href: '#' + matches[matches.length - 1].id}, '上一筆');
    previous.setAttribute('data-match-prev', '');
    const position = make('span', {}, '共 ' + matches.length + ' 筆');
    position.setAttribute('data-match-position', '');
    position.setAttribute('aria-live', 'polite');
    const next = make('a', {href: '#' + matches[0].id}, '下一筆');
    next.setAttribute('data-match-next', '');
    nav.append(previous, position, next);
    body.before(nav);
  }

  // 4. 換分頁時帶著關鍵字
  reader.querySelectorAll('.reader-directory > nav a, .reader-tab-chips a').forEach(link => { link.href = withQuery(link.getAttribute('href')); });

  // 5. 各分頁命中數；從 /document/ 搜尋而本頁沒有命中時，直接跳到第一個有命中的分頁
  fetch(reader.dataset.searchUrl, {credentials: 'same-origin'})
    .then(response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
    .then(data => {
      const counts = data.tabs.map(tab => Object.assign({}, tab, {count: tab.id === tabId ? matches.length : (tab.text.match(pattern) || []).length}));
      const found = counts.filter(tab => tab.count);
      if (isIndex && !matches.length && found.length) { location.replace(withQuery(found[0].path)); return; }
      if (!found.length || !result) return;
      const nav = make('nav', {className: 'reader-matching-tabs'});
      nav.setAttribute('aria-label', '其他分頁的搜尋結果');
      found.forEach(tab => {
        const link = make('a', {href: withQuery(tab.path)}, tab.title + '（' + tab.count + ' 處）');
        if (tab.id === tabId) link.setAttribute('aria-current', 'page');
        nav.append(link);
      });
      result.after(nav);
    })
    .catch(() => { /* 只少了其他分頁的命中數，本頁搜尋照常 */ });
})();
