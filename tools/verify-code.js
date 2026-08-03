#!/usr/bin/env node
/* ============================================================================
   verify-code.js — Extract every RUNNABLE Rust block from the book's content
   and compile it with the local rustc, exactly mirroring the app's rules for
   which blocks get a "Run" button. Reports any block that fails to compile.

   Usage:
     node tools/verify-code.js                 # verify all chapters
     node tools/verify-code.js ownership vectors   # only these chapter ids
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rustcheck-'));
const EDITION = '2021';
const CONCURRENCY = 8;
// Crates available in tools/verify-project (mirrors common Rust Playground crates).
// Blocks referencing these compile inside that cargo project instead of bare rustc.
const PROJECT = path.join(ROOT, 'tools', 'verify-project');
const KNOWN_CRATES = ['tokio', 'futures', 'serde', 'serde_json', 'rand', 'regex', 'anyhow', 'thiserror', 'itertools'];
const CRATE_RE = new RegExp('\\b(' + KNOWN_CRATES.join('|') + ')\\b');
function needsProject(src) { return CRATE_RE.test(src); }

// ---- mirror of app markdown.js processCode(): reconstruct runnable source ----
function processBlock(raw, info) {
  info = (info || '').trim();
  const parts = info.split(/[ ,]+/).filter(Boolean);
  const lang = (parts.shift() || 'text').toLowerCase();
  const flags = {};
  parts.forEach(p => { const m = p.match(/^(?:file|filename)=(.+)$/); if (!m) flags[p.toLowerCase()] = true; });
  const lines = raw.replace(/\n$/, '').split('\n');
  const source = [];
  for (const ln of lines) {
    if (/^#(\s|$)/.test(ln)) source.push(ln.replace(/^#\s?/, ''));
    else if (/^##/.test(ln)) source.push(ln.replace(/^#/, ''));
    else source.push(ln);
  }
  const isRust = (lang === 'rust' || lang === 'rs');
  const src = source.join('\n');
  const hasMain = /fn\s+main\s*\(/.test(src);
  const runnable = isRust && !flags.ignore && !flags.norun && !flags.no_run && !flags.noplayground && (hasMain || flags.runnable);
  // `rust,test` blocks (test modules) aren't given a Run button by the app,
  // but we still compile-check them here with `--test`.
  const checkAsTest = isRust && !!flags.test && !flags.ignore;
  return { runnable, checkAsTest, source: src, lang, flags };
}

// ---- extract fenced code blocks from markdown ----
function extractBlocks(md) {
  const blocks = [];
  const re = /(^|\n)(`{3,})([^\n]*)\n([\s\S]*?)\n\2(?=\n|$)/g;
  let m;
  while ((m = re.exec(md))) {
    blocks.push({ info: m[3].trim(), body: m[4] });
  }
  return blocks;
}

function run(cmd, args) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout, stderr: stderr || (err ? String(err) : '') });
    });
  });
}

async function pLimit(items, n, fn) {
  const results = []; let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

(async () => {
  const only = process.argv.slice(2);
  let files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  if (only.length) files = files.filter(f => only.includes(f.replace(/\.md$/, '')));

  const jobs = [];
  for (const file of files) {
    const id = file.replace(/\.md$/, '');
    const md = fs.readFileSync(path.join(CONTENT, file), 'utf8');
    extractBlocks(md).forEach((b, idx) => {
      const p = processBlock(b.body, b.info);
      if (p.runnable || p.checkAsTest) {
        const rsPath = path.join(TMP, `${id}__${idx}.rs`);
        fs.writeFileSync(rsPath, p.source);
        jobs.push({ id, idx, rsPath, info: b.info, asTest: p.checkAsTest, source: p.source, project: needsProject(p.source) });
      }
    });
  }

  const rustcJobs = jobs.filter(j => !j.project);
  const projectJobs = jobs.filter(j => j.project);
  process.stdout.write(`Compiling ${jobs.length} runnable Rust blocks from ${files.length} chapters (${rustcJobs.length} via rustc, ${projectJobs.length} via cargo project, edition ${EDITION})…\n`);

  // Bare rustc jobs — run in parallel.
  const rustcResults = await pLimit(rustcJobs, CONCURRENCY, async (j) => {
    const outPath = path.join(TMP, `${j.id}__${j.idx}.out`);
    const args = j.asTest
      ? ['--edition', EDITION, '--test', '-A', 'warnings', j.rsPath, '-o', outPath]
      : ['--edition', EDITION, '--crate-type', 'bin', '-A', 'warnings', j.rsPath, '-o', outPath];
    const r = await run('rustc', args);
    return { ...j, ok: r.ok, stderr: r.stderr };
  });

  // Crate-dependent jobs — compile inside the cargo project, sequentially (cargo locks).
  const projectResults = [];
  const binDir = path.join(PROJECT, 'src', 'bin');
  for (const j of projectJobs) {
    const binName = ('chk_' + j.id + '_' + j.idx).replace(/[^A-Za-z0-9_]/g, '_');
    const binPath = path.join(binDir, binName + '.rs');
    fs.writeFileSync(binPath, j.source);
    const r = await run('cargo', ['build', '--quiet', '--bin', binName, '--manifest-path', path.join(PROJECT, 'Cargo.toml')]);
    fs.unlinkSync(binPath);
    projectResults.push({ ...j, ok: r.ok, stderr: r.stderr });
  }

  const results = [...rustcResults, ...projectResults];

  const fails = results.filter(r => !r.ok);
  const byChapter = {};
  for (const r of results) { (byChapter[r.id] = byChapter[r.id] || { ok: 0, fail: 0 }); r.ok ? byChapter[r.id].ok++ : byChapter[r.id].fail++; }

  process.stdout.write('\n=== PER-CHAPTER ===\n');
  Object.keys(byChapter).sort().forEach(id => {
    const c = byChapter[id];
    process.stdout.write(`${c.fail ? '❌' : '✅'} ${id}: ${c.ok} ok${c.fail ? ', ' + c.fail + ' FAIL' : ''}\n`);
  });

  if (fails.length) {
    process.stdout.write(`\n=== ${fails.length} FAILURES ===\n`);
    for (const f of fails) {
      const firstErrors = (f.stderr || '').split('\n').filter(l => /^error/.test(l)).slice(0, 3).join(' | ');
      process.stdout.write(`\n--- ${f.id} block #${f.idx} (info: "${f.info}")\n${firstErrors || (f.stderr || '').slice(0, 300)}\n`);
    }
  }

  const total = results.length, ok = total - fails.length;
  process.stdout.write(`\n=== SUMMARY: ${ok}/${total} runnable blocks compile. ${fails.length} failing. ===\n`);
  // machine-readable report
  fs.writeFileSync(path.join(TMP, 'report.json'), JSON.stringify({ total, ok, fails: fails.map(f => ({ id: f.id, idx: f.idx, info: f.info, err: f.stderr })) }, null, 2));
  process.stdout.write(`Report: ${path.join(TMP, 'report.json')}\n`);
  process.exit(fails.length ? 1 : 0);
})();
