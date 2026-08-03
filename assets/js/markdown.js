/* ============================================================================
   markdown.js — Markdown → rich HTML for The Ultimate Rust Book
   Handles: runnable code blocks (with hidden setup lines), Manning-style
   callouts, mermaid diagrams, heading anchors, jargon terms, smart links.
   ========================================================================== */
window.RB = window.RB || {};
(function (RB) {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  RB.escapeHtml = escapeHtml;

  RB.slugify = function (t) {
    return String(t).toLowerCase().trim()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  };

  var LANG_LABEL = {
    rust: 'Rust', rs: 'Rust', bash: 'Shell', sh: 'Shell', shell: 'Shell',
    toml: 'TOML', json: 'JSON', text: 'Text', console: 'Console', output: 'Output'
  };

  /* ---- Split a code block into visible display + full runnable source ----
     mdbook conventions:
       "# foo"  -> hidden line (compiled but not shown)
       "##foo"  -> a literal line beginning with '#'
     Info string flags: ignore | norun | noplayground | runnable | edition2021
     and file=Cargo.toml to show a filename tab.                              */
  RB.processCode = function (raw, info) {
    info = (info || '').trim();
    var parts = info.split(/[ ,]+/).filter(Boolean);
    var lang = (parts.shift() || 'text').toLowerCase();
    var flags = {}, filename = null;
    parts.forEach(function (p) {
      var m = p.match(/^(?:file|filename)=(.+)$/);
      if (m) filename = m[1]; else flags[p.toLowerCase()] = true;
    });

    var lines = raw.replace(/\n$/, '').split('\n');
    var display = [], source = [];
    lines.forEach(function (ln) {
      if (/^#(\s|$)/.test(ln)) {
        source.push(ln.replace(/^#\s?/, ''));           // hidden: run only
      } else if (/^##/.test(ln)) {
        var t = ln.replace(/^#/, '');                    // literal '#...'
        display.push(t); source.push(t);
      } else {
        display.push(ln); source.push(ln);
      }
    });

    var isRust = (lang === 'rust' || lang === 'rs');
    var src = source.join('\n');
    var hasMain = /fn\s+main\s*\(/.test(src);
    var runnable = isRust && !flags.ignore && !flags.norun && !flags.noplayground &&
                   (hasMain || flags.runnable);
    return {
      display: display.join('\n'), source: src, runnable: runnable,
      lang: isRust ? 'rust' : lang, flags: flags, filename: filename, hasMain: hasMain
    };
  };

  /* ---- Build the code-block widget HTML ---- */
  function codeWidget(raw, info) {
    var c = RB.processCode(raw, info);

    if (c.lang === 'mermaid') {
      return '<div class="mermaid-figure"><div class="mermaid">' +
             escapeHtml(raw.replace(/\n$/, '')) + '</div></div>';
    }

    var label = c.filename
      ? '<span class="filename">' + escapeHtml(c.filename) + '</span>'
      : '<span class="lang">' + (LANG_LABEL[c.lang] || c.lang) + '</span>';

    var runBtn = c.runnable
      ? '<button class="code-btn run" type="button" title="Compile &amp; run (Ctrl+Enter)">▶ Run</button>'
      : '';
    var editBtn = c.runnable
      ? '<button class="code-btn edit" type="button" title="Edit this code">✎ Edit</button>' : '';

    var srcAttr = c.runnable ? ' data-src="' + encodeURIComponent(c.source) + '"' : '';
    return '' +
      '<div class="code-block" data-lang="' + c.lang + '"' + (c.runnable ? ' data-runnable="1"' : '') + srcAttr + '>' +
        '<div class="code-toolbar-top">' +
          '<span class="dots"><i></i><i></i><i></i></span>' + label +
          '<span class="spacer"></span>' + editBtn +
          '<button class="code-btn copy" type="button" title="Copy">⧉ Copy</button>' + runBtn +
        '</div>' +
        '<pre><code class="language-' + c.lang + '">' + escapeHtml(c.display) + '</code></pre>' +
        (c.runnable ? '<div class="code-output" aria-live="polite"></div>' : '') +
      '</div>';
  }

  /* ---- Configure marked ---- */
  function configureMarked() {
    if (!window.marked) return;
    var renderer = {
      code: function (codeArg, infoArg) {
        var raw, info;
        if (codeArg && typeof codeArg === 'object') { raw = codeArg.text; info = codeArg.lang || ''; }
        else { raw = codeArg; info = infoArg || ''; }
        return codeWidget(raw, info);
      }
    };
    marked.use({ gfm: true, breaks: false, renderer: renderer });
  }

  RB.renderMarkdown = function (md) {
    if (!window.marked) return '<pre>' + escapeHtml(md) + '</pre>';
    if (!configureMarked._done) { configureMarked(); configureMarked._done = true; }    
    return marked.parse(md);
  };

  /* ---- Transform GitHub-style alert blockquotes into callouts ----
     > [!tip] Optional Title
     > body...                                                              */
  var ALERT_TYPES = {
    tip: 'Tip', note: 'Note', warning: 'Warning', caution: 'Warning',
    important: 'Key Idea', key: 'Key Idea', jargon: 'Jargon Buster',
    best: 'Best Practice', mistake: 'Common Mistake', deep: 'Deep Dive',
    performance: 'Performance', perf: 'Performance', history: 'History',
    exercise: 'Try It Yourself'
  };
  var ALERT_CLASS = {
    tip: 'tip', note: 'note', warning: 'warning', caution: 'warning',
    important: 'key', key: 'key', jargon: 'jargon-box', best: 'best',
    mistake: 'mistake', deep: 'deep', performance: 'performance', perf: 'performance',
    history: 'history', exercise: 'exercise'
  };

  function transformCallouts(root) {
    root.querySelectorAll('blockquote').forEach(function (bq) {
      var first = bq.querySelector('p');
      if (!first) return;
      var html = first.innerHTML;
      var m = html.match(/^\s*\[!(\w+)\]\s*(.*?)(<br\s*\/?>|\n|$)/i);
      if (!m) return;
      var type = m[1].toLowerCase();
      if (!ALERT_CLASS[type]) return;
      var title = (m[2] || '').trim() || ALERT_TYPES[type];

      var div = document.createElement('div');
      div.className = 'callout ' + ALERT_CLASS[type];
      // Remove the "[!type] title" prefix from the first paragraph
      first.innerHTML = html.replace(/^\s*\[!\w+\]\s*.*?(<br\s*\/?>|\n)/i, '')
                            .replace(/^\s*\[!\w+\]\s*.*$/i, '');
      div.innerHTML = '<p class="callout-title">' + title + '</p>';
      while (bq.firstChild) {
        var node = bq.firstChild;
        if (node.nodeType === 1 && node.tagName === 'P' && !node.textContent.trim() && !node.querySelector('img,code')) {
          bq.removeChild(node); continue;
        }
        div.appendChild(node);
      }
      bq.parentNode.replaceChild(div, bq);
    });
  }

  /* ---- Add ids + anchor to headings; return TOC list ---- */
  function processHeadings(root) {
    var toc = [], used = {};
    root.querySelectorAll('h2, h3').forEach(function (h) {
      var base = RB.slugify(h.textContent);
      var slug = base, i = 2;
      while (used[slug]) slug = base + '-' + (i++);
      used[slug] = true;
      h.id = slug;
      toc.push({ level: h.tagName === 'H2' ? 2 : 3, text: h.textContent, slug: slug });
    });
    return toc;
  }

  /* ---- Make external links open in a new tab ---- */
  function processLinks(root) {
    root.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (/^https?:\/\//.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    });
  }

  var mermaidLoading = null;
  function ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (mermaidLoading) return mermaidLoading;
    mermaidLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'assets/vendor/mermaid.min.js';
      s.onload = function () { resolve(window.mermaid); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return mermaidLoading;
  }

  function renderMermaid(root) {
    var blocks = root.querySelectorAll('.mermaid');
    if (!blocks.length) return;
    // Cache the original source so diagrams can be re-drawn when the theme changes.
    blocks.forEach(function (b) {
      if (!b.hasAttribute('data-src-cache')) b.setAttribute('data-src-cache', b.textContent);
    });
    ensureMermaid().then(function (mermaid) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'loose',
        theme: dark ? 'dark' : 'default',
        themeVariables: { primaryColor: '#f96316', primaryBorderColor: '#c2360c',
          lineColor: dark ? '#8592a3' : '#6b7280', fontFamily: 'inherit' }
      });
      try { mermaid.run({ nodes: blocks }); } catch (e) { console.warn('mermaid', e); }
    }).catch(function () {/* offline: leave source visible */});
  }

  /* ---- Master enhancer: run after inserting rendered HTML ---- */
  RB.enhance = function (root) {
    transformCallouts(root);
    var toc = processHeadings(root);
    processLinks(root);
    if (window.Prism) { try { Prism.highlightAllUnder(root); } catch (e) {} }
    renderMermaid(root);
    if (RB.wireCodeBlocks) RB.wireCodeBlocks(root);
    return toc;
  };

  RB.reRenderMermaidTheme = function () {
    // On theme switch, restore each rendered diagram's source and re-draw it
    // with the now-current theme so it stays visible in both light and dark.
    var done = document.querySelectorAll('.mermaid[data-processed]');
    if (!done.length) return;
    done.forEach(function (el) {
      var src = el.getAttribute('data-src-cache');
      if (src) { el.removeAttribute('data-processed'); el.textContent = src; }
    });
    renderMermaid(document);
  };

})(window.RB);
