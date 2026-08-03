#!/usr/bin/env node
/* ============================================================================
   build-search-index.js — Generate data/search-index.json for full-text search.
   Reads every authored chapter, strips markdown/HTML to plain text, and emits
   one entry per chapter plus one per H2 section (so results can deep-link).
   Run after adding or editing chapters:  node tools/build-search-index.js
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const toc = JSON.parse(fs.readFileSync(path.join(ROOT, 'toc.json'), 'utf8'));

function slugify(t) {
  return String(t).toLowerCase().trim()
    .replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
}

// Strip a markdown/HTML chapter down to readable plain text.
function toPlainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')     // inline SVG
    .replace(/<[^>]+>/g, ' ')                  // remaining HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links → keep text
    .replace(/[#>*_`~|-]+/g, ' ')              // markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = [];
let chaptersIndexed = 0;

toc.parts.forEach(part => {
  (part.chapters || []).forEach(ch => {
    const file = path.join(ROOT, 'content', ch.file);
    if (!fs.existsSync(file)) return; // skip unwritten chapters
    const md = fs.readFileSync(file, 'utf8');
    chaptersIndexed++;

    // Whole-chapter entry (full text)
    entries.push({
      title: ch.title,
      crumb: part.title,
      route: '#/ch/' + ch.id,
      text: (ch.summary + ' ' + (ch.keywords || '') + ' ' + toPlainText(md)).toLowerCase().slice(0, 4000)
    });

    // Per-H2 section entries for deep-linking
    const sectionRe = /(^|\n)##\s+([^\n#][^\n]*)/g;
    let m;
    while ((m = sectionRe.exec(md))) {
      const heading = m[2].replace(/<[^>]+>/g, '').trim();
      if (!heading || /^summary$/i.test(heading)) continue;
      // grab a snippet of text following the heading
      const after = md.slice(m.index + m[0].length, m.index + m[0].length + 600);
      entries.push({
        title: ch.title + ' › ' + heading,
        crumb: part.title,
        route: '#/ch/' + ch.id + '#' + slugify(heading),
        text: (heading + ' ' + toPlainText(after)).toLowerCase().slice(0, 800)
      });
    }
  });
});

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify(entries));
console.log(`Indexed ${chaptersIndexed} chapters → ${entries.length} search entries (${(fs.statSync(path.join(ROOT,'data','search-index.json')).size/1024).toFixed(1)} KB).`);
console.log('Wrote data/search-index.json');
