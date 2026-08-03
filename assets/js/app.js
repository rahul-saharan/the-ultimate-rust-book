/* ============================================================================
   app.js — The Ultimate Rust Book application shell.
   Hash router, sidebar, search, theme, reading progress, mobile nav.
   ========================================================================== */
window.RB = window.RB || {};
(function (RB) {
  'use strict';

  var state = {
    toc: null,
    flat: [],            // flat ordered list of chapters {..., partTitle, index}
    byId: {},
    searchIndex: [],
    visited: loadVisited(),
    bookmarks: loadBookmarks()
  };

  var el = {
    content: null, navTree: null, tocRight: null,
    sidebar: null, backdrop: null,
    searchOverlay: null, searchInput: null, searchResults: null,
    progressBar: null, progressLabel: null, toast: null
  };

  /* ---------------- storage helpers ---------------- */
  function loadVisited() {
    try { return new Set(JSON.parse(localStorage.getItem('rustbook-visited') || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveVisited() {
    try { localStorage.setItem('rustbook-visited', JSON.stringify([].concat(Array.from(state.visited)))); } catch (e) {}
  }
  function loadBookmarks() {
    try { return new Set(JSON.parse(localStorage.getItem('rustbook-bookmarks') || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveBookmarks() {
    try { localStorage.setItem('rustbook-bookmarks', JSON.stringify([].concat(Array.from(state.bookmarks)))); } catch (e) {}
  }
  function setLast(id) { try { localStorage.setItem('rustbook-last', id); } catch (e) {} }
  function getLast() { try { return localStorage.getItem('rustbook-last'); } catch (e) { return null; } }

  RB.toast = function (msg) {
    el.toast.textContent = msg; el.toast.classList.add('show');
    clearTimeout(RB.toast._t);
    RB.toast._t = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  };

  /* ---------------- TOC / sidebar ---------------- */
  function buildFlat() {
    var idx = 0;
    state.toc.parts.forEach(function (part) {
      (part.chapters || []).forEach(function (ch) {
        ch.partTitle = part.title;
        ch.index = idx++;
        state.flat.push(ch);
        state.byId[ch.id] = ch;
      });
    });
  }

  function buildSidebar() {
    var html = '';
    var n = 0;
    state.toc.parts.forEach(function (part) {
      html += '<div class="nav-part">' + RB.escapeHtml(part.title) + '</div>';
      (part.chapters || []).forEach(function (ch) {
        n++;
        var num = ch.appendix ? ch.appendix : n;
        html += '<a class="nav-chapter" data-id="' + ch.id + '" href="#/ch/' + ch.id + '">' +
          '<span class="ch-num">' + num + '</span>' +
          '<span class="ch-title">' + RB.escapeHtml(ch.title) + '</span></a>';
      });
    });
    el.navTree.innerHTML = html;
  }

  function updateProgress() {
    var total = state.flat.length || 1;
    var done = 0;
    state.flat.forEach(function (c) { if (state.visited.has(c.id)) done++; });
    var pct = Math.round((done / total) * 100);
    el.progressBar.style.width = pct + '%';
    el.progressLabel.textContent = pct + '% · ' + done + '/' + total;
  }

  function setActiveNav(id) {
    el.navTree.querySelectorAll('.nav-chapter').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === id);
    });
    var active = el.navTree.querySelector('.nav-chapter.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- search ---------------- */
  function buildSearchIndex() {
    state.searchIndex = state.flat.map(function (ch) {
      return {
        title: ch.title, crumb: ch.partTitle, route: '#/ch/' + ch.id,
        text: ((ch.summary || '') + ' ' + (ch.keywords || '') + ' ' + ch.title).toLowerCase()
      };
    });
    // Optionally merge a richer prebuilt full-text index if present.
    fetch('data/search-index.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (extra) {
        if (extra && extra.length) {
          state.searchIndex = state.searchIndex.concat(extra.map(function (e) {
            return { title: e.title, crumb: e.crumb, route: e.route, text: (e.text || '').toLowerCase() };
          }));
        }
      }).catch(function () {});
  }

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { el.searchResults.innerHTML = '<div class="search-empty">Type to search across every chapter…</div>'; return; }
    var terms = q.split(/\s+/);
    var hits = [];
    state.searchIndex.forEach(function (e) {
      var score = 0;
      terms.forEach(function (t) {
        if (e.title.toLowerCase().indexOf(t) >= 0) score += 5;
        if (e.text.indexOf(t) >= 0) score += 1;
      });
      if (score > 0) hits.push({ e: e, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 20);
    if (!hits.length) { el.searchResults.innerHTML = '<div class="search-empty">No results for “' + RB.escapeHtml(q) + '”.</div>'; return; }
    el.searchResults.innerHTML = hits.map(function (h, i) {
      return '<a class="search-result' + (i === 0 ? ' sel' : '') + '" href="' + h.e.route + '">' +
        '<div class="sr-title">' + highlight(h.e.title, terms) + '</div>' +
        '<div class="sr-crumb">' + RB.escapeHtml(h.e.crumb || '') + '</div></a>';
    }).join('');
  }
  function highlight(text, terms) {
    var out = RB.escapeHtml(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function openSearch() {
    el.searchOverlay.classList.add('show');
    el.searchInput.value = '';
    runSearch('');
    setTimeout(function () { el.searchInput.focus(); }, 30);
  }
  function closeSearch() { el.searchOverlay.classList.remove('show'); }

  /* ---------------- rendering pages ---------------- */
  function showLoader() {
    el.content.innerHTML = '<div class="page-loader"><div style="text-align:center"><div class="crab">🦀</div>Loading…</div></div>';
  }

  function renderHome() {
    document.title = 'The Ultimate Rust Book — Learn Rust, Visually';
    var featured = state.flat.slice(0, 4);
    var paths = [
      { c: 'var(--green)', lvl: 'Beginner', t: 'Never written Rust?', d: 'Start at Getting Started and walk through ownership — the one idea that makes Rust click.', route: state.flat[0] ? '#/ch/' + state.flat[0].id : '#/' },
      { c: 'var(--blue)', lvl: 'Intermediate', t: 'Know the basics?', d: 'Jump to traits, generics, error handling, iterators, and smart pointers.', route: '#/ch/traits' },
      { c: 'var(--purple)', lvl: 'Advanced', t: 'Going deep?', d: 'Master async, unsafe, macros, concurrency, and the data-structures course.', route: '#/ch/async-intro' }
    ];
    el.content.innerHTML =
      '<section class="hero">' +
        '<div class="ferris">🦀</div>' +
        '<h1>The Ultimate <span class="grad">Rust</span> Book</h1>' +
        '<p class="tagline">A free, colorful, visual journey from your first <code>println!</code> to async, unsafe, macros, and a complete data-structures &amp; algorithms course — with a Rust compiler built right into the page.</p>' +
        '<div class="cta">' +
          (state.flat[0] ? '<a class="btn btn-primary" href="#/ch/' + state.flat[0].id + '">Start reading →</a>' : '') +
          '<a class="btn btn-ghost" href="#/playground">▶ Open the Playground</a>' +
        '</div>' +
      '</section>' +
      '<div class="feature-grid">' +
        feature('🎨', 'Visual &amp; colorful', 'Diagrams for ownership, memory, lifetimes and more — concepts you can <em>see</em>, not just read.') +
        feature('▶️', 'Runnable everywhere', 'Every example has a Run button. Edit the code and execute it live, no install required.') +
        feature('🧠', 'Truly complete', 'Fundamentals → advanced, the standard library, the best crates, async, and all the classic algorithms.') +
      '</div>' +
      '<h2 style="border:none">Choose your path</h2>' +
      '<div class="path-grid">' + paths.map(function (p) {
        return '<a class="path-card" style="--c:' + p.c + '" href="' + p.route + '">' +
          '<div class="lvl">' + p.lvl + '</div><h4>' + p.t + '</h4><p style="color:var(--text-soft);margin:.4em 0 0">' + p.d + '</p></a>';
      }).join('') + '</div>' +
      '<h2>Jump back in</h2>' +
      '<div class="path-grid">' + featured.map(function (ch) {
        return '<a class="path-card" style="--c:var(--rust-500)" href="#/ch/' + ch.id + '">' +
          '<div class="lvl">' + RB.escapeHtml(ch.partTitle) + '</div><h4>' + RB.escapeHtml(ch.title) + '</h4>' +
          '<p style="color:var(--text-soft);margin:.4em 0 0">' + RB.escapeHtml(ch.summary || '') + '</p></a>';
      }).join('') + '</div>' +
      footer();
    el.tocRight.innerHTML = '';                                  // clear any leftover chapter TOC
    document.querySelector('.content-wrap').classList.add('is-home'); // full width, no TOC column
    setActiveNav(null);
    window.scrollTo(0, 0);
  }
  function feature(icon, title, body) {
    return '<div class="feature-card"><div class="fi">' + icon + '</div><h3>' + title + '</h3><p>' + body + '</p></div>';
  }
  function footer() {
    return '<footer class="site-footer">🦀 The Ultimate Rust Book — a free, interactive guide to learning Rust. ' +
      'Every example runs live on the ' +
      '<a href="https://play.rust-lang.org" target="_blank" rel="noopener">Rust Playground</a>.' +
      '<br>Created by <strong>Rahul Saharan</strong>.' +
      '<br><span class="footer-fine">An independent, unofficial guide — not affiliated with or endorsed by the Rust Foundation. ' +
      '&ldquo;Rust&rdquo; is a trademark of the Rust Foundation, used descriptively. Content licensed under CC BY-SA 4.0.</span></footer>';
  }

  function renderPlayground() {
    document.title = 'Rust Playground — The Ultimate Rust Book';
    setActiveNav(null);
    document.querySelector('.content-wrap').classList.add('is-playground');
    RB.renderPlaygroundPage(el.content);
    // Hide right toc on playground
    el.tocRight.innerHTML = '';
  }

  function renderChapter(id) {
    var ch = state.byId[id];
    document.querySelector('.content-wrap').classList.remove('is-playground');
    if (!ch) { renderMissing(id); return; }
    showLoader();
    setActiveNav(id);
    document.title = ch.title + ' — The Ultimate Rust Book';

    fetch('content/' + ch.file, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('404'); return r.text(); })
      .then(function (md) {
        var html = RB.renderMarkdown(md);
        el.content.innerHTML =
          '<div class="chapter-meta">' +
            '<span class="badge level-' + (ch.level || 'beginner') + '">' + levelIcon(ch.level) + ' ' + capitalize(ch.level || 'beginner') + '</span>' +
            (ch.time ? '<span class="badge">⏱ ' + RB.escapeHtml(ch.time) + '</span>' : '') +
            '<span class="badge">📚 ' + RB.escapeHtml(ch.partTitle) + '</span>' +
            '<button class="bookmark-btn" id="bookmark-btn" type="button"></button>' +
          '</div>' +
          '<div id="chapter-body"></div>';
        var body = document.getElementById('chapter-body');
        body.innerHTML = html;
        var toc = RB.enhance(body);
        buildRightToc(toc);
        body.insertAdjacentHTML('beforeend', chapterNav(ch));
        wireBookmarkButton(id);
        state.visited.add(id); saveVisited(); setLast(id); updateProgress();
        // scroll to anchor if present
        var anchor = (location.hash.split('#')[2]);
        if (anchor) { var t = document.getElementById(anchor); if (t) t.scrollIntoView(); else window.scrollTo(0, 0); }
        else window.scrollTo(0, 0);
        setupScrollSpy();
      })
      .catch(function () { renderComingSoon(ch); });
  }

  function renderComingSoon(ch) {
    el.tocRight.innerHTML = '';
    el.content.innerHTML =
      '<div class="chapter-meta"><span class="badge level-' + (ch.level || 'beginner') + '">' + capitalize(ch.level || 'beginner') + '</span>' +
      '<span class="badge">📚 ' + RB.escapeHtml(ch.partTitle) + '</span></div>' +
      '<h1>' + RB.escapeHtml(ch.title) + '</h1>' +
      '<div class="callout note"><p class="callout-title">Chapter in progress</p>' +
      '<p>This chapter is written and being finalised. In the meantime, here is what it will cover:</p>' +
      (ch.summary ? '<p><em>' + RB.escapeHtml(ch.summary) + '</em></p>' : '') + '</div>' +
      chapterNav(ch);
    RB.enhance(el.content);
  }

  function renderMissing(id) {
    el.content.innerHTML = '<h1>Page not found</h1><p>No chapter with id <code>' + RB.escapeHtml(id) + '</code>.</p>' +
      '<p><a href="#/">← Back to home</a></p>';
    el.tocRight.innerHTML = '';
  }

  function chapterNav(ch) {
    var prev = state.flat[ch.index - 1];
    var next = state.flat[ch.index + 1];
    return '<nav class="chapter-nav">' +
      (prev ? '<a class="prev" href="#/ch/' + prev.id + '"><div class="dir">← Previous</div><div class="title">' + RB.escapeHtml(prev.title) + '</div></a>'
            : '<a class="prev disabled"></a>') +
      (next ? '<a class="next" href="#/ch/' + next.id + '"><div class="dir">Next →</div><div class="title">' + RB.escapeHtml(next.title) + '</div></a>'
            : '<a class="next disabled"></a>') +
      '</nav>';
  }

  function buildRightToc(toc) {
    if (!toc || !toc.length) { el.tocRight.innerHTML = ''; return; }
    el.tocRight.innerHTML = '<h4>On this page</h4>' + toc.map(function (t) {
      return '<a href="#" data-slug="' + t.slug + '" class="lvl-' + t.level + '">' + RB.escapeHtml(t.text) + '</a>';
    }).join('');
    el.tocRight.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(a.getAttribute('data-slug'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  var scrollSpyHandler = null;
  function setupScrollSpy() {
    if (scrollSpyHandler) window.removeEventListener('scroll', scrollSpyHandler);
    var links = [].slice.call(el.tocRight.querySelectorAll('a'));
    if (!links.length) return;
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('data-slug')); });
    scrollSpyHandler = function () {
      var y = window.scrollY + 100, current = 0;
      heads.forEach(function (h, i) { if (h && h.offsetTop <= y) current = i; });
      links.forEach(function (a, i) { a.classList.toggle('active', i === current); });
    };
    window.addEventListener('scroll', scrollSpyHandler, { passive: true });
    scrollSpyHandler();
  }

  function levelIcon(l) { return l === 'advanced' ? '🔴' : l === 'intermediate' ? '🔵' : '🟢'; }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------- bookmarks + progress page ---------------- */
  function wireBookmarkButton(id) {
    var btn = document.getElementById('bookmark-btn');
    if (!btn) return;
    function sync() {
      var on = state.bookmarks.has(id);
      btn.classList.toggle('on', on);
      btn.textContent = on ? '🔖 Bookmarked' : '🔖 Bookmark';
    }
    sync();
    btn.addEventListener('click', function () {
      if (state.bookmarks.has(id)) { state.bookmarks.delete(id); RB.toast('Bookmark removed'); }
      else { state.bookmarks.add(id); RB.toast('Bookmarked — see it on your Progress page'); }
      saveBookmarks(); sync();
    });
  }

  function chapterRow(ch, withRemove) {
    var vis = state.visited.has(ch.id);
    return '<div class="prog-item">' +
      '<a class="pi-link" href="#/ch/' + ch.id + '">' +
        '<span class="pi-dot' + (vis ? ' done' : '') + '" title="' + (vis ? 'Read' : 'Not read yet') + '"></span>' +
        '<span class="pi-title">' + RB.escapeHtml(ch.title) + '</span>' +
        '<span class="pi-part">' + RB.escapeHtml(ch.partTitle) + '</span>' +
      '</a>' +
      (withRemove ? '<button class="pi-rm" data-id="' + ch.id + '" type="button" title="Remove bookmark" aria-label="Remove bookmark">✕</button>' : '') +
      '</div>';
  }

  function renderProgress() {
    document.title = 'Your Progress — The Ultimate Rust Book';
    setActiveNav(null);
    el.tocRight.innerHTML = '';
    document.querySelector('.content-wrap').classList.add('is-home'); // full width, single column

    var total = state.flat.length || 1;
    var done = 0;
    state.flat.forEach(function (c) { if (state.visited.has(c.id)) done++; });
    var pct = Math.round((done / total) * 100);
    var last = getLast();
    var lastCh = last && state.byId[last];
    var bookmarks = [].concat(Array.from(state.bookmarks)).map(function (id) { return state.byId[id]; }).filter(Boolean);
    var readChapters = state.flat.filter(function (c) { return state.visited.has(c.id); });

    var partRows = state.toc.parts.map(function (part) {
      var chs = part.chapters || [];
      var d = 0;
      chs.forEach(function (c) { if (state.visited.has(c.id)) d++; });
      var p = chs.length ? Math.round((d / chs.length) * 100) : 0;
      return '<div class="part-prog-row">' +
        '<span class="pp-name">' + RB.escapeHtml(part.title) + '</span>' +
        '<span class="mini-bar"><i style="width:' + p + '%"></i></span>' +
        '<span class="pp-count">' + d + '/' + chs.length + '</span>' +
        '</div>';
    }).join('');

    var continueBtn = lastCh
      ? '<a class="btn btn-primary" href="#/ch/' + lastCh.id + '">Continue: ' + RB.escapeHtml(lastCh.title) + ' →</a>'
      : (state.flat[0] ? '<a class="btn btn-primary" href="#/ch/' + state.flat[0].id + '">Start reading →</a>' : '');

    el.content.innerHTML =
      '<div class="progress-page">' +
        '<h1>Your learning progress</h1>' +
        '<p style="color:var(--text-soft);margin-top:-.4em">Saved in this browser — no account needed. Pick up where you left off, revisit your bookmarks, or start fresh.</p>' +

        '<div class="prog-hero">' +
          '<div class="prog-ring">' + pct + '%</div>' +
          '<div class="prog-hero-main">' +
            '<div class="prog-bar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="prog-stat">' + done + ' of ' + total + ' chapters read</div>' +
            continueBtn +
          '</div>' +
        '</div>' +

        '<h2>🔖 Bookmarks</h2>' +
        (bookmarks.length
          ? '<div class="prog-list">' + bookmarks.map(function (ch) { return chapterRow(ch, true); }).join('') + '</div>'
          : '<p class="prog-empty">No bookmarks yet. Open any chapter and press <strong>🔖 Bookmark</strong> to save your current spot here.</p>') +

        '<h2>Progress by part</h2>' +
        '<div class="part-prog">' + partRows + '</div>' +

        '<h2>Chapters read (' + readChapters.length + ')</h2>' +
        (readChapters.length
          ? '<div class="prog-list">' + readChapters.map(function (ch) { return chapterRow(ch, false); }).join('') + '</div>'
          : '<p class="prog-empty">You haven\'t finished any chapters yet — they\'ll appear here as you read.</p>') +

        '<h2>Reset</h2>' +
        '<div class="prog-actions">' +
          '<button class="btn btn-ghost" id="reset-progress" type="button">Reset reading progress</button>' +
          '<button class="btn btn-ghost" id="clear-bookmarks" type="button">Clear bookmarks</button>' +
          '<button class="btn btn-danger" id="reset-all" type="button">Reset everything</button>' +
        '</div>' +
        '<p class="prog-empty">Resetting clears data in this browser only and can\'t be undone.</p>' +
        footer() +
      '</div>';

    window.scrollTo(0, 0);

    // wire remove-bookmark buttons
    el.content.querySelectorAll('.pi-rm').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        state.bookmarks.delete(b.getAttribute('data-id'));
        saveBookmarks();
        renderProgress();
      });
    });
    // wire reset controls
    var rp = document.getElementById('reset-progress');
    if (rp) rp.addEventListener('click', function () {
      if (confirm('Reset your reading progress? Your bookmarks will be kept.')) {
        state.visited = new Set(); saveVisited();
        try { localStorage.removeItem('rustbook-last'); } catch (e) {}
        updateProgress(); renderProgress(); RB.toast('Reading progress reset');
      }
    });
    var cb = document.getElementById('clear-bookmarks');
    if (cb) cb.addEventListener('click', function () {
      if (confirm('Remove all bookmarks?')) {
        state.bookmarks = new Set(); saveBookmarks();
        renderProgress(); RB.toast('Bookmarks cleared');
      }
    });
    var ra = document.getElementById('reset-all');
    if (ra) ra.addEventListener('click', function () {
      if (confirm('Reset EVERYTHING — reading progress and bookmarks?')) {
        state.visited = new Set(); state.bookmarks = new Set();
        saveVisited(); saveBookmarks();
        try { localStorage.removeItem('rustbook-last'); } catch (e) {}
        updateProgress(); renderProgress(); RB.toast('Everything reset');
      }
    });
  }

  /* ---------------- router ---------------- */
  function route() {
    closeSearch();
    closeSidebar();
    // Reset the full-width playground layout on every navigation; only the
    // playground route re-enables it.
    var cw = document.querySelector('.content-wrap');
    if (cw) cw.classList.remove('is-playground', 'is-home');
    var hash = location.hash || '#/';
    var parts = hash.replace(/^#\//, '').split('#')[0].split('/');
    var page = parts[0] || '';
    if (page === '' ) return renderHome();
    if (page === 'playground') return renderPlayground();
    if (page === 'progress') return renderProgress();
    if (page === 'ch') return renderChapter(parts[1]);
    renderHome();
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    function sync() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.textContent = dark ? '☀️' : '🌙';
    }
    sync();
    btn.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('rustbook-theme', next); } catch (e) {}
      sync();
      if (RB.reRenderMermaidTheme) RB.reRenderMermaidTheme();
    });
  }

  /* ---------------- mobile sidebar ---------------- */
  function openSidebar() { el.sidebar.classList.add('open'); el.backdrop.classList.add('show'); }
  function closeSidebar() { el.sidebar.classList.remove('open'); el.backdrop.classList.remove('show'); }

  /* ---------------- init ---------------- */
  function cacheEls() {
    el.content = document.getElementById('content');
    el.navTree = document.getElementById('nav-tree');
    el.tocRight = document.getElementById('toc-right');
    el.sidebar = document.getElementById('sidebar');
    el.backdrop = document.getElementById('sidebar-backdrop');
    el.searchOverlay = document.getElementById('search-overlay');
    el.searchInput = document.getElementById('search-input');
    el.searchResults = document.getElementById('search-results');
    el.progressBar = document.getElementById('progress-bar');
    el.progressLabel = document.getElementById('progress-label');
    el.toast = document.getElementById('toast');
  }

  function wireEvents() {
    document.getElementById('menu-toggle').addEventListener('click', function () {
      el.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    el.backdrop.addEventListener('click', closeSidebar);
    document.getElementById('header-search').addEventListener('click', openSearch);
    document.getElementById('search-trigger').addEventListener('focus', openSearch);
    el.searchOverlay.addEventListener('click', function (e) { if (e.target === el.searchOverlay) closeSearch(); });
    el.searchInput.addEventListener('input', function () { runSearch(this.value); });
    el.searchResults.addEventListener('click', function (e) {
      var a = e.target.closest('.search-result'); if (a) closeSearch();
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); return; }
      if (e.key === '/' && !/input|textarea/i.test((e.target.tagName || ''))) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Escape') closeSearch();
      if (el.searchOverlay.classList.contains('show')) {
        var all = [].slice.call(el.searchResults.querySelectorAll('.search-result'));
        if (!all.length) return;
        var sel = el.searchResults.querySelector('.search-result.sel');
        var i = Math.max(0, all.indexOf(sel));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var next = e.key === 'ArrowDown' ? (i + 1) % all.length : (i - 1 + all.length) % all.length;
          if (sel) sel.classList.remove('sel');
          all[next].classList.add('sel');
          all[next].scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter') {
          var s = el.searchResults.querySelector('.search-result.sel') || all[0];
          if (s) { location.hash = s.getAttribute('href'); closeSearch(); }
        }
      }
    });
    window.addEventListener('hashchange', route);
  }

  function boot() {
    cacheEls();
    initTheme();
    wireEvents();
    fetch('toc.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (toc) {
        state.toc = toc;
        var repoLink = document.getElementById('repo-link');
        if (repoLink) {
          // Show the ⭐ GitHub link only once a real repo URL is set in toc.json;
          // otherwise hide it (no repo yet → no broken link).
          if (toc.repo && /^https?:\/\//.test(toc.repo) && toc.repo !== 'https://github.com') {
            repoLink.href = toc.repo;
          } else {
            repoLink.style.display = 'none';
          }
        }
        buildFlat();
        buildSidebar();
        buildSearchIndex();
        updateProgress();
        route();
      })
      .catch(function (err) {
        el.content.innerHTML = '<h1>Could not load the book</h1>' +
          '<div class="callout warning"><p class="callout-title">Serve over HTTP</p>' +
          '<p>The book loads its chapters with <code>fetch()</code>, which browsers block on the <code>file://</code> protocol. ' +
          'Run a local server from the project folder, e.g. <code>python3 -m http.server</code>, then open ' +
          '<code>http://localhost:8000</code>. On GitHub Pages it just works.</p></div>' +
          '<pre>' + RB.escapeHtml(String(err)) + '</pre>';
        console.error(err);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.RB);
