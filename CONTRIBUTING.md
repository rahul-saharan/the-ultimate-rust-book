# Contributing to The Ultimate Rust Book

Thanks for your interest in improving the book! Contributions of all kinds are welcome — fixing a
typo, clarifying an explanation, improving a diagram, adding a missing chapter, or reporting a bug.
This guide explains how the project is put together and how to make changes.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). And because the
book is licensed under [CC BY-SA 4.0](LICENSE), any contribution you submit is offered under that
same license — so the work stays open for everyone. Please only contribute material you have the
right to license this way (your own writing, or content that is already CC BY-SA compatible).

## How the project works

There is no build step. The book is a static single-page app that loads Markdown chapters at
runtime and renders them in the browser:

- `index.html` is the app shell.
- `toc.json` is the table of contents — it defines every chapter, its order, and its metadata.
- `content/*.md` holds one Markdown file per chapter.
- `assets/js/` contains the router, the Markdown-to-HTML renderer, and the live Rust playground.
- `assets/css/style.css` is the design system.
- `assets/vendor/` holds the vendored libraries (marked, Prism, Mermaid).
- `data/search-index.json` is a generated full-text search index.
- `tools/` has two Node scripts: one to compile-check code, one to rebuild the search index.

When you add a chapter, you write a Markdown file and add an entry to `toc.json`. That's it — there
is nothing to compile or bundle.

## Prerequisites

You'll need:

- **A recent Rust toolchain** (`rustup`, `rustc`, `cargo`) — used to compile-check the code examples.
  Install from [rustup.rs](https://rustup.rs).
- **Node.js** (v18 or newer) — used to run the two helper scripts in `tools/`.
- **Python 3** — the simplest way to run a local development server (any static file server works).

## Setting up a development server

The book loads chapters with `fetch()`, which browsers block on the `file://` protocol, so you must
serve the files over HTTP while working. Any static server will do; the simplest is Python's:

```bash
# from the repository root
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Edit a file in `content/` and refresh the page to
see your changes — no rebuild required.

Alternatives, if you prefer:

```bash
npx serve            # Node
php -S localhost:8000 # PHP
```

> Tip: disable the browser's disk cache (open DevTools and check "Disable cache" on the Network tab)
> so refreshes always show your latest edits.

## Adding a new chapter

1. **Read the author guide.** Open [`AUTHOR_GUIDE.md`](AUTHOR_GUIDE.md) — it defines the house style, the
   callout syntax, the code-block conventions (including hidden setup lines), and how to draw
   theme-aware SVG and Mermaid diagrams. Skim `content/ownership.md` as a concrete reference; it is
   the gold-standard example every chapter follows.

2. **Create the Markdown file.** Add `content/<your-chapter-id>.md`. Start the file with the H1
   heading in this exact form (the kicker is the part name):

   ```html
   <h1><span class="h1-kicker">Part Name</span>Your Chapter Title</h1>
   ```

   Do not add level/time badges or prev/next links — the app adds those automatically.

3. **Register it in `toc.json`.** Add an entry to the relevant part's `chapters` array:

   ```json
   {
     "id": "your-chapter-id",
     "title": "Your Chapter Title",
     "file": "your-chapter-id.md",
     "level": "beginner",
     "time": "10 min",
     "summary": "One sentence describing the chapter.",
     "keywords": "space separated terms for search"
   }
   ```

   `level` is one of `beginner`, `intermediate`, or `advanced`. The `id` is what appears in the URL
   (`#/ch/your-chapter-id`) and is used for cross-links between chapters.

4. **Regenerate the search index** so your chapter is searchable:

   ```bash
   node tools/build-search-index.js
   ```

5. **Verify your code compiles** (see below), then preview it in the dev server.

## Editing an existing chapter

Just edit the Markdown file in `content/`. If you change headings or prose, regenerate the search
index (`node tools/build-search-index.js`) so search stays accurate. Refresh the browser to preview.

## Callout syntax

Callouts are written as GitHub-style alert blockquotes:

```markdown
> [!tip] Optional Title
> Body text goes here.
```

Available types: `tip`, `note`, `warning`, `key`, `jargon`, `best`, `mistake`, `deep`,
`performance`, `history`, `exercise`. Aim for a handful per chapter — enough to guide the reader,
not so many that they become noise.

## Runnable code blocks

- Any ` ```rust ` block that contains `fn main` automatically gets a **Run** button.
- Prefix a line with `# ` to include it when the code runs but hide it from the reader — handy for
  `use` statements and boilerplate.
- Tag a block ` ```rust,ignore ` to suppress the Run button, for fragments or code that is meant to
  fail to compile.
- Keep runnable examples small, self-contained, and correct.

## Verifying code

**Every runnable code block must compile.** A helper script extracts each one and compiles it with
your local `rustc`, mirroring exactly the rule the app uses to decide which blocks get a Run button:

```bash
node tools/verify-code.js                 # check every chapter
node tools/verify-code.js ownership vectors  # check specific chapters
```

Snippets that use common crates (tokio, serde, rand, regex, anyhow, thiserror, itertools) are
compiled inside `tools/verify-project`, which mirrors the crates available on the Rust Playground, so
those examples are also runnable in the browser. Please make sure `verify-code.js` reports zero
failures before opening a pull request.

## Style guidelines

- Write in plain, warm English addressed to "you". Explain each technical term in parentheses the
  first time it appears.
- Prefer concrete examples over abstract definitions.
- Include at least one visual (a Mermaid diagram or an inline SVG figure) per chapter, using the
  theme CSS variables so it works in both light and dark mode.
- End each teaching chapter with a `## Summary` and a closing `> [!exercise]` callout.
- Cross-link related chapters with hash links, e.g. `[ownership](#/ch/ownership)`.

The author guide ([`AUTHOR_GUIDE.md`](AUTHOR_GUIDE.md)) is the authoritative reference for all of this.

## Submitting changes

1. Fork the repository and create a branch for your change.
2. Make your edits, then run both checks:
   ```bash
   node tools/verify-code.js
   node tools/build-search-index.js
   ```
3. Preview locally with `python3 -m http.server 8000` and confirm your chapter renders, the code
   runs, and search finds it.
4. Commit with a clear message describing what you changed and why.
5. Open a pull request. Describe the change and mention any chapters added or edited.

## Reporting issues

If you find a mistake in the text, a code example that doesn't compile, or a rendering bug, please
open an issue with the chapter id, what you expected, and what happened. Screenshots help for
rendering problems.

---

Thanks again for helping make this the best free Rust book on the web.

Maintained by Rahul Saharan.
