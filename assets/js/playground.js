/* ============================================================================
   playground.js — In-browser Rust compiler.
   Talks to the official Rust Playground (CORS-enabled) so the book runs code
   with zero backend. Powers inline "Run" buttons, an inline editor, and the
   full /playground page.
   ========================================================================== */
window.RB = window.RB || {};
(function (RB) {
  'use strict';

  var EXEC_URL = 'https://play.rust-lang.org/execute';

  RB.pgConfig = { channel: 'stable', mode: 'debug', edition: '2021' };

  /* ---- Compile & run source on the Rust Playground ---- */
  RB.runRust = function (source, opts) {
    opts = opts || {};
    var body = {
      channel: opts.channel || RB.pgConfig.channel,
      mode: opts.mode || RB.pgConfig.mode,
      edition: opts.edition || RB.pgConfig.edition,
      crateType: 'bin',
      tests: !!opts.tests,
      code: source,
      backtrace: false
    };
    return fetch(EXEC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  };

  RB.playgroundUrl = function (source, cfg) {
    cfg = cfg || RB.pgConfig;
    return 'https://play.rust-lang.org/?version=' + cfg.channel +
           '&mode=' + cfg.mode + '&edition=' + cfg.edition +
           '&code=' + encodeURIComponent(source);
  };

  /* ---- Pretty-print compiler output ---- */
  function colorize(text) {
    return RB.escapeHtml(text).split('\n').map(function (ln) {
      if (/^error(\[|:|$)/.test(ln) || /^error(\[E\d+\])/.test(ln)) return '<span class="err-line">' + ln + '</span>';
      if (/^warning(:|$)/.test(ln)) return '<span class="warn-line">' + ln + '</span>';
      return ln;
    }).join('\n');
  }

  function cleanStderr(stderr) {
    // Drop the routine cargo chatter, keep real diagnostics.
    return stderr.split('\n').filter(function (ln) {
      return !/^\s*(Compiling|Finished|Running|Updating|Downloading|Downloaded|Blocking|Locking)\b/.test(ln);
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  RB.renderOutput = function (outEl, result, source) {
    outEl.classList.add('show');
    if (result && result.__network_error) {
      outEl.innerHTML =
        '<div class="out-head"><span class="status-err">⚠ Could not reach the compiler</span></div>' +
        '<pre class="stderr">The in-browser compiler needs an internet connection to ' +
        'play.rust-lang.org. You can still run this snippet directly:\n\n' +
        '<a class="code-btn" href="' + RB.playgroundUrl(source) + '" target="_blank" rel="noopener">▶ Open in Rust Playground ↗</a></pre>';
      return;
    }
    var ok = result.success;
    var stderr = cleanStderr(result.stderr || '');
    var stdout = (result.stdout || '');
    var head = '<div class="out-head">' +
      (ok ? '<span class="status-ok">● Ran successfully</span>'
          : '<span class="status-err">● Compilation failed</span>') +
      (result.exitDetail ? '<span style="color:var(--text-mute)"> · ' + RB.escapeHtml(result.exitDetail) + '</span>' : '') +
      '</div>';
    var bodyHtml = '';
    if (stdout) bodyHtml += '<pre class="stdout">' + RB.escapeHtml(stdout) + '</pre>';
    if (stderr) bodyHtml += '<pre class="stderr">' + colorize(stderr) + '</pre>';
    if (!stdout && !stderr) bodyHtml = '<pre class="stdout">(no output)</pre>';
    outEl.innerHTML = head + bodyHtml;
  };

  /* ---- Wire copy / run / edit buttons inside rendered content ---- */
  RB.wireCodeBlocks = function (root) {
    root.querySelectorAll('.code-block').forEach(function (block) {
      if (block.__wired) return;
      block.__wired = true;

      var pre = block.querySelector('pre');
      var codeEl = block.querySelector('code');
      var runBtn = block.querySelector('.code-btn.run');
      var copyBtn = block.querySelector('.code-btn.copy');
      var editBtn = block.querySelector('.code-btn.edit');
      var outEl = block.querySelector('.code-output');
      var editor = null;

      function currentSource() {
        if (editor) return editor.getValue();
        var raw = block.getAttribute('data-src');
        return raw ? decodeURIComponent(raw) : codeEl.textContent;
      }

      if (copyBtn) copyBtn.addEventListener('click', function () {
        var text = editor ? editor.getValue() : codeEl.textContent;
        RB.copyText(text, copyBtn);
      });

      if (editBtn) editBtn.addEventListener('click', function () {
        if (editor) return;
        var initial = block.getAttribute('data-src') ? decodeURIComponent(block.getAttribute('data-src')) : codeEl.textContent;
        editor = RB.makeEditor(initial, { minRows: Math.min(20, initial.split('\n').length + 1) });
        pre.replaceWith(editor.el);
        pre = editor.el;
        editBtn.textContent = '↺ Reset';
        editBtn.onclick = function () {
          editor.setValue(initial);
        };
        editor.focus();
      });

      if (runBtn) {
        var doRun = function () {
          var src = currentSource();
          runBtn.disabled = true;
          var orig = runBtn.innerHTML;
          runBtn.innerHTML = '<span class="spin"></span> Running';
          if (outEl) { outEl.classList.add('show'); outEl.innerHTML = '<div class="out-head">Compiling on play.rust-lang.org…</div>'; }
          RB.runRust(src).then(function (res) {
            RB.renderOutput(outEl, res, src);
          }).catch(function () {
            RB.renderOutput(outEl, { __network_error: true }, src);
          }).finally(function () {
            runBtn.disabled = false; runBtn.innerHTML = orig;
          });
        };
        runBtn.addEventListener('click', doRun);
        block.addEventListener('keydown', function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doRun(); }
        });
      }
    });
  };

  RB.copyText = function (text, btn) {
    var done = function () {
      if (!btn) return;
      var o = btn.innerHTML; btn.innerHTML = '✓ Copied';
      setTimeout(function () { btn.innerHTML = o; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  };

  /* ========================================================================
     Reusable code editor: transparent <textarea> over a Prism-highlighted
     <pre>, with a line-number gutter. No heavy dependencies.
     ====================================================================== */
  RB.makeEditor = function (initial, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'editor';
    var gutter = document.createElement('div'); gutter.className = 'gutter';
    var pre = document.createElement('pre'); pre.setAttribute('aria-hidden', 'true');
    var code = document.createElement('code'); code.className = 'language-rust';
    pre.appendChild(code);
    var ta = document.createElement('textarea');
    ta.spellcheck = false; ta.autocapitalize = 'off'; ta.setAttribute('autocorrect', 'off');
    ta.value = initial;
    wrap.appendChild(gutter); wrap.appendChild(pre); wrap.appendChild(ta);

    function highlight() {
      var v = ta.value;
      code.innerHTML = RB.escapeHtml(v) + (v.endsWith('\n') ? ' ' : '');
      if (window.Prism) { try { Prism.highlightElement(code); } catch (e) {} }
      var lines = v.split('\n').length;
      var g = '';
      for (var i = 1; i <= lines; i++) g += '<span>' + i + '</span>';
      gutter.innerHTML = g;
    }
    function syncScroll() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; }

    ta.addEventListener('input', highlight);
    ta.addEventListener('scroll', syncScroll);

    /* ---- lightweight autocomplete: keywords, std items & buffer words ---- */
    var AC_WORDS = (
      // keywords
      'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while ' +
      // macros
      'println! print! eprintln! eprint! format! format_args! vec! panic! assert! assert_eq! assert_ne! debug_assert! write! writeln! todo! unimplemented! unreachable! dbg! matches! include_str! include_bytes! env! concat! stringify! ' +
      // core types & smart pointers
      'String str Vec Box Rc Arc Weak RefCell Cell Mutex RwLock Cow Option Some None Result Ok Err HashMap HashSet BTreeMap BTreeSet VecDeque BinaryHeap Duration Instant PhantomData ' +
      // primitives
      'i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 usize isize f32 f64 bool char ' +
      // iterator/collection adapters & consumers
      'iter iter_mut into_iter map filter filter_map flat_map flatten map_while take_while skip_while take skip step_by enumerate zip chain rev cloned copied collect fold reduce scan for_each try_fold ' +
      'sum product count min max min_by max_by min_by_key max_by_key position find find_map any all last nth peekable window windows chunks split ' +
      // Option/Result & common methods
      'unwrap unwrap_or unwrap_or_else unwrap_or_default expect ok_or ok_or_else is_some is_none is_ok is_err and_then or_else map_or map_or_else unwrap_err as_ref as_mut ' +
      'clone to_string to_owned into try_into from try_from parse trim to_uppercase to_lowercase replace split_whitespace lines chars bytes contains starts_with ends_with push push_str pop insert remove get get_mut sort sort_by sort_by_key dedup reverse retain extend drain truncate clear len is_empty capacity with_capacity entry or_insert or_default keys values ' +
      // common traits & derives
      'derive Debug Clone Copy PartialEq Eq PartialOrd Ord Hash Default Display From Into TryFrom TryInto Iterator IntoIterator Fn FnMut FnOnce Drop Deref DerefMut AsRef Send Sync Sized Error ' +
      // std path segments — so `use std::…` completes segment by segment
      'std core alloc collections io fs sync thread time net fmt cmp ops process env path convert borrow rc cell slice iter num f64 f32 prelude ' +
      'spawn sleep swap replace take size_of drop stdin stdout stderr read_line read_to_string ' +
      // extra crates available in the playground (via the Rust Playground) — completes `use <crate>::…`
      'tokio serde serde_json rand regex anyhow thiserror itertools futures chrono ' +
      // common items imported from those crates
      'Deserialize Serialize Serializer Deserializer Rng thread_rng random Regex Captures Context bail anyhow Itertools StreamExt SinkExt Value json Utc DateTime NaiveDate').split(/\s+/);
    var acBox = document.createElement('div');
    acBox.className = 'ac'; acBox.style.display = 'none';
    wrap.appendChild(acBox);
    var acItems = [], acSel = 0, charW = 0;
    function measureCharW() {
      if (charW) return charW;
      var s = document.createElement('span');
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:13.5px/1.6 var(--font-mono)';
      s.textContent = 'MMMMMMMMMM'; wrap.appendChild(s);
      charW = s.getBoundingClientRect().width / 10 || 8; wrap.removeChild(s);
      return charW;
    }
    function curWord() {
      var pos = ta.selectionStart;
      var m = ta.value.slice(0, pos).match(/[A-Za-z_][A-Za-z0-9_]*$/);
      return m ? { word: m[0], start: pos - m[0].length } : null;
    }
    function hideAc() { acBox.style.display = 'none'; acItems = []; }
    // Don't suggest inside string literals or comments.
    function inNoCompleteZone() {
      var pos = ta.selectionStart, v = ta.value;
      var open = v.lastIndexOf('/*', pos);           // inside a block comment?
      if (open !== -1) { var close = v.indexOf('*/', open); if (close === -1 || close >= pos) return true; }
      var line = v.slice(v.lastIndexOf('\n', pos - 1) + 1, pos);
      var inStr = false;                              // scan the current line
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '\\') { i++; continue; }           // skip escaped char
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr && ch === '/' && line[i + 1] === '/') return true; // line comment
      }
      return inStr;                                   // inside a "..." string
    }
    function showAc() {
      if (inNoCompleteZone()) { return hideAc(); }
      var cw = curWord();
      if (!cw || cw.word.length < 1) { return hideAc(); }
      var w = cw.word.toLowerCase();
      var pool = AC_WORDS.concat(ta.value.match(/[A-Za-z_][A-Za-z0-9_]{1,}/g) || []);
      var seen = {}, matches = [];
      for (var i = 0; i < pool.length; i++) {
        var c = pool[i];
        if (c !== cw.word && !seen[c] && c.toLowerCase().indexOf(w) === 0) { seen[c] = 1; matches.push(c); }
      }
      // Rank all prefix matches: shortest first (closest to what was typed), then
      // alphabetically — so std modules & crate names (std, io, tokio, serde…) surface
      // instead of being crowded out by keywords that merely happen to appear earlier.
      matches.sort(function (a, b) { return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); });
      var list = matches.slice(0, 8);
      if (!list.length) { return hideAc(); }
      acItems = list; acSel = 0;
      acBox.innerHTML = list.map(function (c, i) {
        return '<div class="ac-item' + (i === 0 ? ' sel' : '') + '">' + RB.escapeHtml(c) + '</div>';
      }).join('');
      var before = ta.value.slice(0, cw.start);
      var col = cw.start - (before.lastIndexOf('\n') + 1);
      var line = (before.match(/\n/g) || []).length;
      acBox.style.left = (54 + col * measureCharW() - ta.scrollLeft) + 'px';
      acBox.style.top = (16 + (line + 1) * 21.6 - ta.scrollTop + 2) + 'px';
      acBox.style.display = 'block';
    }
    function acAccept() {
      var cw = curWord(); if (!cw) { return; }
      var pick = acItems[acSel];
      ta.value = ta.value.slice(0, cw.start) + pick + ta.value.slice(ta.selectionStart);
      ta.selectionStart = ta.selectionEnd = cw.start + pick.length;
      hideAc(); highlight(); ta.focus();
    }
    ta.addEventListener('input', showAc);
    ta.addEventListener('blur', function () { setTimeout(hideAc, 120); });
    acBox.addEventListener('mousedown', function (e) {
      var item = e.target.closest('.ac-item');
      if (!item) { return; }
      e.preventDefault();
      acSel = [].indexOf.call(acBox.children, item);
      acAccept();
    });
    ta.addEventListener('keydown', function (e) {
      if (acBox.style.display === 'none') { return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopImmediatePropagation();
        acSel = (acSel + (e.key === 'ArrowDown' ? 1 : acItems.length - 1)) % acItems.length;
        [].forEach.call(acBox.children, function (el, i) { el.classList.toggle('sel', i === acSel); });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); e.stopImmediatePropagation(); acAccept();
      } else if (e.key === 'Escape') {
        e.stopImmediatePropagation(); hideAc();
      }
    });

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + 4;
        highlight();
      }
    });

    /* ---- auto-close brackets & quotes (skip ' to avoid Rust lifetime noise) ---- */
    var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', '`': '`' };
    ta.addEventListener('keydown', function (e) {
      var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      // Step over a matching closer/quote that's already there.
      if (s === en && v[s] === e.key && ')]}"`'.indexOf(e.key) >= 0) {
        e.preventDefault(); ta.selectionStart = ta.selectionEnd = s + 1; return;
      }
      var close = PAIRS[e.key];
      if (close) {                                  // type an opener → insert the pair
        e.preventDefault();
        if (s !== en) {                             // wrap the current selection
          ta.value = v.slice(0, s) + e.key + v.slice(s, en) + close + v.slice(en);
          ta.selectionStart = s + 1; ta.selectionEnd = en + 1;
        } else {
          ta.value = v.slice(0, s) + e.key + close + v.slice(s);
          ta.selectionStart = ta.selectionEnd = s + 1;
        }
        highlight(); return;
      }
      // Backspace inside an empty pair removes both characters.
      if (e.key === 'Backspace' && s === en && s > 0 && PAIRS[v[s - 1]] === v[s]) {
        e.preventDefault();
        ta.value = v.slice(0, s - 1) + v.slice(s + 1);
        ta.selectionStart = ta.selectionEnd = s - 1;
        highlight(); return;
      }
    });

    if (opts.minRows) ta.rows = opts.minRows;
    highlight();

    return {
      el: wrap,
      getValue: function () { return ta.value; },
      setValue: function (v) { ta.value = v; highlight(); },
      focus: function () { ta.focus(); }
    };
  };

  /* ========================================================================
     Full /playground page
     ====================================================================== */
  var SAMPLE = [
    'fn main() {',
    '    // Welcome to the in-book Rust playground! 🦀',
    '    // Edit the code and press "Run" (or Ctrl+Enter).',
    '    let crabs = ["🦀", "🦀", "🦀"];',
    '    for (i, c) in crabs.iter().enumerate() {',
    '        println!("Crab #{i} says hello: {c}");',
    '    }',
    '',
    '    let sum: i32 = (1..=100).sum();',
    '    println!("Sum of 1..=100 = {sum}");',
    '}'
  ].join('\n');

  RB.renderPlaygroundPage = function (container) {
    container.innerHTML =
      '<div class="playground-page">' +
        '<div class="pg-toolbar">' +
          '<button class="code-btn run" id="pg-run" type="button">▶ Run</button>' +
          '<button class="code-btn" id="pg-copy" type="button">⧉ Copy</button>' +
          '<span style="flex:1"></span>' +
          '<label>Edition <select id="pg-edition"><option>2021</option><option>2018</option><option>2015</option></select></label>' +
          '<label>Mode <select id="pg-mode"><option value="debug">Debug</option><option value="release">Release</option></select></label>' +
          '<label>Channel <select id="pg-channel"><option>stable</option><option>beta</option><option>nightly</option></select></label>' +
        '</div>' +
        '<div class="pg-body">' +
          '<div class="pg-editor-wrap" id="pg-editor-wrap"></div>' +
          '<div class="pg-output-wrap"><div class="code-output show" id="pg-output" style="max-height:none;border:none;background:transparent">' +
            '<div class="out-head">Output</div><pre class="stdout" style="color:var(--text-mute)">Press ▶ Run to compile and execute your program.</pre>' +
          '</div></div>' +
        '</div>' +
      '</div>';

    var saved = null;
    try { saved = localStorage.getItem('rustbook-pg-code'); } catch (e) {}
    var editor = RB.makeEditor(saved || SAMPLE, {});
    document.getElementById('pg-editor-wrap').appendChild(editor.el);

    var outEl = document.getElementById('pg-output');
    var runBtn = document.getElementById('pg-run');
    var cfg = function () {
      return {
        edition: document.getElementById('pg-edition').value,
        mode: document.getElementById('pg-mode').value,
        channel: document.getElementById('pg-channel').value
      };
    };

    function run() {
      var src = editor.getValue();
      try { localStorage.setItem('rustbook-pg-code', src); } catch (e) {}
      runBtn.disabled = true; var o = runBtn.innerHTML;
      runBtn.innerHTML = '<span class="spin"></span> Running';
      outEl.innerHTML = '<div class="out-head">Compiling on play.rust-lang.org…</div>';
      RB.runRust(src, cfg())
        .then(function (res) { RB.renderOutput(outEl, res, src); })
        .catch(function () { RB.renderOutput(outEl, { __network_error: true }, src); })
        .finally(function () { runBtn.disabled = false; runBtn.innerHTML = o; });
    }

    runBtn.addEventListener('click', run);
    document.getElementById('pg-copy').addEventListener('click', function () {
      RB.copyText(editor.getValue(), this);
    });
    document.getElementById('pg-share').addEventListener('click', function () {
      window.open(RB.playgroundUrl(editor.getValue(), cfg()), '_blank', 'noopener');
    });
    editor.el.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
    // Allow deep-linking code via ?code= or loading a snippet set by a chapter link
    if (RB.pendingPlaygroundCode) { editor.setValue(RB.pendingPlaygroundCode); RB.pendingPlaygroundCode = null; }
    editor.focus();
  };

})(window.RB);
