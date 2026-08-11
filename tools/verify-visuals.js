#!/usr/bin/env node
/*
 * verify-visuals.js — check every figure in the book actually renders.
 *
 * Companion to verify-code.js: that one compiles Rust, this one validates
 * diagrams. Both are needed, because a broken figure still compiles fine.
 *
 *   node tools/verify-visuals.js            # check every chapter
 *   node tools/verify-visuals.js box refcell # check specific chapters
 *
 * Exits 1 if any ERROR is found (warnings don't fail the build).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

// The app renders markdown with this exact vendored copy of marked, so we use
// it too — that's the only way to see what the browser will really get.
global.window = {};
let marked;
try {
  marked = require(path.join(ROOT, 'assets', 'vendor', 'marked.min.js'));
} catch (e) {
  console.error('Could not load assets/vendor/marked.min.js:', e.message);
  process.exit(1);
}

const toc = JSON.parse(fs.readFileSync(path.join(ROOT, 'toc.json'), 'utf8'));
const chapters = toc.parts.flatMap(p => p.chapters);

const only = process.argv.slice(2);
const targets = only.length ? chapters.filter(c => only.includes(c.id)) : chapters;
if (only.length && targets.length !== only.length) {
  const missing = only.filter(id => !chapters.some(c => c.id === id));
  console.error('Unknown chapter id(s):', missing.join(', '));
  process.exit(1);
}

const errors = [];
const warnings = [];
const add = (list, id, fig, msg) => list.push({ id, fig, msg });

/* ---- helpers ---------------------------------------------------------- */

// Numbers appearing as a given attribute on a given tag.
function attrs(svg, tag, names) {
  const out = [];
  const re = new RegExp('<' + tag + '\\b([^>]*)>', 'g');
  let m;
  while ((m = re.exec(svg))) {
    const bag = {};
    for (const n of names) {
      const v = new RegExp('\\b' + n + '\\s*=\\s*"([^"]*)"').exec(m[1]);
      if (v) bag[n] = v[1];
    }
    out.push(bag);
  }
  return out;
}

function checkSvg(id, figNo, svg) {
  /* --- viewBox --- */
  const vb = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
  if (!vb) {
    add(errors, id, figNo, 'svg has no viewBox');
    return;
  }
  const [, , vbW, vbH] = vb[1].trim().split(/[\s,]+/).map(Number);
  // Other widths scale fine via max-width:100%, so width is not worth warning about.

  /* --- explicit width/height defeat responsive scaling --- */
  const openTag = /<svg\b[^>]*>/.exec(svg)[0];
  if (/\bwidth\s*=/.test(openTag) || /\bheight\s*=/.test(openTag)) {
    add(warnings, id, figNo, 'svg sets width/height attributes; use viewBox only');
  }

  /* --- accessibility --- */
  if (!/role\s*=\s*"img"/.test(openTag)) add(warnings, id, figNo, 'svg missing role="img"');
  if (!/aria-label\s*=/.test(openTag)) add(warnings, id, figNo, 'svg missing aria-label');

  /* --- hex colours break one of the two themes.
   * Pure white/black are excluded: they're deliberately used for text sitting on
   * a fixed accent fill, where the contrast holds in both themes. */
  const hex = (svg.replace(/<!--[\s\S]*?-->/g, '')
    .match(/(?:fill|stroke|color)\s*[:=]\s*"?(#[0-9a-fA-F]{3,8})/g) || [])
    .map(s => (/#[0-9a-fA-F]+/.exec(s) || [])[0].toLowerCase())
    .filter(c => !['#fff', '#ffffff', '#000', '#000000'].includes(c));
  if (hex.length) {
    add(warnings, id, figNo, `hardcoded colour(s) ${[...new Set(hex)].join(', ')} — use var(--…) so both themes work`);
  }

  /* --- marker / gradient ids: dangling refs and collisions --- */
  const defined = [];
  let dm;
  const defRe = /<(?:marker|linearGradient|radialGradient|pattern|clipPath|mask|filter|symbol)\b[^>]*\bid\s*=\s*"([^"]+)"/g;
  while ((dm = defRe.exec(svg))) defined.push(dm[1]);
  const refs = [...new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]))];
  for (const r of refs) {
    if (!defined.includes(r)) add(errors, id, figNo, `references url(#${r}) but no such id is defined in this svg`);
  }

  /* --- geometry outside the viewBox is silently clipped --- */
  const over = [];
  for (const r of attrs(svg, 'rect', ['x', 'y', 'width', 'height'])) {
    const right = Number(r.x || 0) + Number(r.width || 0);
    const bottom = Number(r.y || 0) + Number(r.height || 0);
    if (right > vbW + 0.5) over.push(`rect right edge ${right} > ${vbW}`);
    if (bottom > vbH + 0.5) over.push(`rect bottom edge ${bottom} > ${vbH}`);
  }
  for (const t of attrs(svg, 'text', ['x', 'y'])) {
    if (Number(t.y) > vbH + 0.5) over.push(`text y=${t.y} > ${vbH}`);
    if (Number(t.x) > vbW + 0.5) over.push(`text x=${t.x} > ${vbW}`);
  }
  for (const c of attrs(svg, 'circle', ['cx', 'cy', 'r'])) {
    if (Number(c.cy || 0) + Number(c.r || 0) > vbH + 0.5) over.push(`circle bottom > ${vbH}`);
  }
  if (over.length) {
    add(errors, id, figNo, 'content outside the viewBox will be clipped: ' + [...new Set(over)].join('; '));
  }

  return defined;
}

function checkMermaid(id, figNo, src) {
  const isStateOrClass = /^\s*(stateDiagram(-v2)?|classDiagram)/m.test(src);
  const bareStyle = /^\s*style\s+\S+/m.test(src);
  if (isStateOrClass && bareStyle) {
    add(errors, id, figNo,
      'a bare `style` statement is not supported in stateDiagram/classDiagram and breaks the render — use classDef + class');
  }
  if (/^\s*sequenceDiagram/m.test(src) && bareStyle) {
    add(errors, id, figNo, 'sequenceDiagram has no per-node styling; remove the `style` statement');
  }
}

/* ---- main ------------------------------------------------------------- */

const perChapter = [];

for (const ch of targets) {
  const file = path.join(CONTENT, ch.file);
  if (!fs.existsSync(file)) {
    add(errors, ch.id, '-', `toc.json points at content/${ch.file}, which does not exist`);
    continue;
  }
  const md = fs.readFileSync(file, 'utf8');
  const before = errors.length + warnings.length;

  /* 1. Mermaid blocks (source form). */
  [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].forEach((m, i) => checkMermaid(ch.id, 'mermaid' + (i + 1), m[1]));

  /* 2. Inline SVG figures (source form). */
  const figs = [...md.matchAll(/<figure class="diagram">[\s\S]*?<\/figure>/g)].map(m => m[0]);
  const allIds = [];
  figs.forEach((fig, i) => {
    const figNo = 'fig' + (i + 1);
    if (!/<figcaption>/.test(fig)) add(warnings, ch.id, figNo, 'figure has no <figcaption>');
    const svgMatch = /<svg[\s\S]*?<\/svg>/.exec(fig);
    if (!svgMatch) {
      add(errors, ch.id, figNo, 'figure.diagram contains no <svg>');
      return;
    }
    const ids = checkSvg(ch.id, figNo, svgMatch[0]) || [];
    ids.forEach(x => allIds.push({ id: x, figNo }));
  });

  /* Duplicate ids across figures on the same page collide silently. */
  const seen = new Map();
  for (const { id: mid, figNo } of allIds) {
    if (seen.has(mid)) {
      add(errors, ch.id, figNo, `marker/gradient id "${mid}" is already used in ${seen.get(mid)} — give each a unique suffix`);
    } else seen.set(mid, figNo);
  }

  /* 3. THE BIG ONE: render through marked and confirm no <p> lands inside an
   *    <svg>. A blank line inside the figure ends the HTML block, marked wraps
   *    the rest in <p>, and the browser hoists that out of the SVG — silently
   *    deleting everything after it. */
  let html;
  try {
    html = marked.parse(md);
  } catch (e) {
    add(errors, ch.id, '-', 'markdown failed to parse: ' + e.message);
    html = '';
  }
  [...html.matchAll(/<figure[\s\S]*?<\/figure>/g)].forEach((m, i) => {
    const fig = m[0];
    let idx = -1;
    while ((idx = fig.indexOf('<p>', idx + 1)) !== -1) {
      const insideSvg = fig.lastIndexOf('<svg', idx) > fig.lastIndexOf('</svg>', idx);
      if (insideSvg) {
        add(errors, ch.id, 'fig' + (i + 1),
          'a blank line inside the figure truncates the svg (marked injects <p>) — remove all blank lines between <svg> and </svg>');
        break;
      }
    }
  });

  const found = errors.length + warnings.length - before;
  perChapter.push({ id: ch.id, figs: figs.length, mermaid: (md.match(/```mermaid/g) || []).length, issues: found });
}

/* ---- report ----------------------------------------------------------- */

const totalFigs = perChapter.reduce((a, c) => a + c.figs + c.mermaid, 0);
process.stdout.write(`Checked ${totalFigs} figures across ${perChapter.length} chapters.\n`);

process.stdout.write('\n=== PER-CHAPTER ===\n');
for (const c of perChapter) {
  if (!c.figs && !c.mermaid) {
    process.stdout.write(`⚠️  ${c.id}: no visuals at all\n`);
  } else if (c.issues) {
    process.stdout.write(`❌ ${c.id}: ${c.figs} svg + ${c.mermaid} mermaid, ${c.issues} issue(s)\n`);
  }
}
if (!perChapter.some(c => c.issues || (!c.figs && !c.mermaid))) {
  process.stdout.write('✅ every chapter clean\n');
}

if (errors.length) {
  process.stdout.write(`\n=== ${errors.length} ERROR(S) — these break rendering ===\n`);
  for (const e of errors) process.stdout.write(`  ❌ ${e.id} [${e.fig}] ${e.msg}\n`);
}
if (warnings.length) {
  process.stdout.write(`\n=== ${warnings.length} WARNING(S) — style/consistency ===\n`);
  for (const w of warnings) process.stdout.write(`  ⚠️  ${w.id} [${w.fig}] ${w.msg}\n`);
}

process.stdout.write(`\n=== SUMMARY: ${totalFigs} figures, ${errors.length} error(s), ${warnings.length} warning(s). ===\n`);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'visualcheck-'));
const report = path.join(TMP, 'report.json');
fs.writeFileSync(report, JSON.stringify({ totalFigs, errors, warnings, perChapter }, null, 2));
process.stdout.write(`Report: ${report}\n`);

process.exit(errors.length ? 1 : 0);
