# The Ultimate Rust Book 🦀

A free, visual guide to Rust that goes from your first `println!` all the way to async, unsafe,
macros, the standard library, the popular crates, and a complete data-structures & algorithms
course. Every code example is runnable in the browser against the real Rust compiler.

The whole thing is a static site (HTML + CSS + vanilla JS, no build step, no backend), so you can
host it on GitHub Pages, or anywhere else that serves files, in a couple of minutes.

## What's inside

The book is 160 chapters organized into 22 parts, taking a reader from complete beginner to
advanced:

- **Getting started and foundations** — installation, Cargo, variables, types, functions, control flow.
- **Ownership** — the borrow checker, references, slices, and the stack/heap memory model.
- **Structuring code** — structs, enums, pattern matching, methods, modules, and packages.
- **Everyday Rust** — collections, error handling, generics, traits, lifetimes, closures, iterators,
  testing, and smart pointers.
- **Idioms & design patterns** — newtypes, builders, typestates, RAII guards, the conversion traits,
  API guidelines, anti-patterns, and error-handling strategy.
- **Systems programming** — fearless concurrency, async/await, and advanced topics (unsafe, macros, FFI,
  editions, const generics).
- **The standard library** — a deep reference to the modules you use most.
- **The crate ecosystem** — serde, tokio, clap, axum, sqlx, reqwest, regex, tracing, rand, chrono,
  itertools, ratatui, and more.
- **Tooling & workflow** — the Cargo toolbox, build scripts, feature flags, debugging, cross-compilation.
- **Performance & production** — profiling, memory layout, deployment, CI/CD, and observability.
- **Real projects** — a CLI tool, a web service, WebAssembly, and embedded Rust.
- **A complete data-structures & algorithms course** — 29 chapters, from Big-O to graphs, dynamic
  programming, network flow, geometry, and advanced range structures, all in idiomatic Rust.
- **Appendices** — keywords, operators, derivable traits, a glossary, and a one-page cheat sheet.

Every runnable code example is compile-checked against the real Rust compiler, so the code in the
book actually works.

## Features

- **Beginner-friendly, plain English.** Every technical term is explained in parentheses the moment
  it appears, with tip / note / warning / key-idea callouts throughout.
- **Visual.** Theme-aware SVG diagrams and Mermaid flowcharts for ownership, memory, borrowing,
  data structures, and more.
- **Runnable everywhere.** Every example has a Run button that compiles and executes on the official
  [Rust Playground](https://play.rust-lang.org) — no install needed. Readers can also edit any
  snippet and run their own version.
- **A built-in playground** page with a full editor and edition/mode/channel selectors.
- **Instant full-text search** (press `/` or `Ctrl`+`K`).
- **Light and dark themes**, reading-progress tracking, keyboard navigation, and a mobile layout.
- **Self-contained.** All libraries (marked, Prism, Mermaid) are vendored locally — no CDN, so it
  works offline and won't break when a CDN changes.

## Hosting it on GitHub Pages

From inside this folder:

```bash
git init && git add -A && git commit -m "The Ultimate Rust Book"
gh repo create my-rust-book --public --source=. --push
```

Then go to the repo's **Settings → Pages**, set the source to the `main` branch, `/ (root)`, and
save. The book will be live at `https://<username>.github.io/my-rust-book/`.

It also deploys as-is to Netlify, Vercel, Cloudflare Pages, or Amazon S3 — just upload the folder.

## Previewing locally

The book loads its chapters with `fetch()`, which browsers block on the `file://` protocol, so open
it over HTTP:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The Run button needs an internet connection (it calls play.rust-lang.org), but nothing else does,
and there is no backend to run. Offline, every chapter still reads fine and Run falls back to an
"Open in Playground" link.

## Project structure

```text
rust-book/
├── index.html            # the single-page app shell
├── 404.html              # SPA redirect for deep links on GitHub Pages
├── .nojekyll             # tell GitHub Pages to serve files as-is
├── LICENSE               # CC BY-SA 4.0
├── AUTHOR_GUIDE.md       # rules for creating a chapter
├── CONTRIBUTING.md       # how to contribute
├── CODE_OF_CONDUCT.md    # Contributor Covenant
├── THIRD-PARTY-NOTICES.md# licenses of the vendored libraries
├── .github/workflows/    # CI: compile-checks every code example
├── toc.json              # the table of contents (edit to reorder/add chapters)
├── assets/
│   ├── css/style.css     # the design system (light/dark, callouts, code, diagrams)
│   ├── js/
│   │   ├── app.js        # router, sidebar, search, theme, progress
│   │   ├── markdown.js   # markdown to rich HTML (callouts, runnable code, mermaid)
│   │   └── playground.js # the live Rust compiler and editor
│   └── vendor/           # marked, Prism, Mermaid (vendored, no CDN)
├── content/
│   └── *.md              # one Markdown file per chapter
├── data/search-index.json# generated full-text search index
└── tools/
    ├── verify-code.js        # compile-check every runnable snippet with rustc
    └── build-search-index.js # regenerate the search index
```

## Writing and editing chapters

Chapters are plain Markdown in `content/`, listed in `toc.json`. To add or edit one:

1. Read [`AUTHOR_GUIDE.md`](AUTHOR_GUIDE.md) for the house style, callout syntax, code-block
   conventions (including hidden setup lines), and how to draw theme-aware diagrams.
   `content/ownership.md` is the reference example.
2. Write your Markdown file and add or update its entry in `toc.json`.
3. Regenerate the search index: `node tools/build-search-index.js`.

### Callout syntax

Callouts are written as GitHub-style alert blockquotes:

```markdown
> [!tip] Optional Title
> Body text...
```

Available types: `tip`, `note`, `warning`, `key`, `jargon`, `best`, `mistake`, `deep`,
`performance`, `history`, `exercise`.

### Runnable code blocks

Any ` ```rust ` block containing `fn main` gets a Run button. Prefix a line with `# ` to include it
when running but hide it from the reader (useful for `use` statements). Tag fragments or
intentionally-failing code with ` ```rust,ignore ` to suppress the Run button.

## Verifying code

Every runnable Rust snippet in the book is compile-checked against a local `rustc`:

```bash
node tools/verify-code.js            # check every chapter
node tools/verify-code.js ownership  # check specific chapters
```

Snippets that depend on common crates (tokio, futures, serde, serde_json, rand, regex, anyhow,
thiserror, itertools) are compiled inside `tools/verify-project`, which mirrors the crates available
on the Rust Playground.

## Contributing

Contributions are very welcome — fixing typos, clarifying explanations, improving diagrams, or
adding whole new chapters. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guidelines,
including the house style, how the project is structured, and the pull-request workflow.

The short version for contributors:

1. Install a Rust toolchain ([rustup.rs](https://rustup.rs)), Node.js, and Python 3.
2. Start a development server from the repository root and open `http://localhost:8000`:
   ```bash
   python3 -m http.server 8000
   ```
   The book loads chapters with `fetch()`, so it must be served over HTTP — opening `index.html`
   directly from disk will not work. Edit a file in `content/` and refresh to see your changes.
3. Add or edit chapters as described in the [Writing and editing chapters](#writing-and-editing-chapters)
   section above, following [`AUTHOR_GUIDE.md`](AUTHOR_GUIDE.md).
4. Before opening a pull request, run both checks and make sure they pass:
   ```bash
   node tools/verify-code.js         # every runnable code block must compile
   node tools/build-search-index.js  # keep search up to date
   ```

## Tech

Vanilla JS single-page app, [marked](https://marked.js.org) for Markdown,
[Prism](https://prismjs.com) for syntax highlighting, [Mermaid](https://mermaid.js.org) for
diagrams, and the [Rust Playground](https://play.rust-lang.org) API for the live compiler.

## License

This project — the written chapters, code examples, and website code — is licensed under the
**Creative Commons Attribution-ShareAlike 4.0 International License** ([CC BY-SA 4.0](LICENSE)).
You are free to share and adapt it, even commercially, as long as you **credit the author** and
**keep any derivative works under this same license**, so the book always stays open. See
[LICENSE](LICENSE) for the full text.

Bundled third-party libraries (marked, Prism, Mermaid) are MIT-licensed — see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

### Credits & attribution

Some introductory examples and explanations follow the teaching conventions of *The Rust Programming
Language* (the official book by Steve Klabnik, Carol Nichols, and the Rust community), which is
dual-licensed under **MIT** and **Apache 2.0**. Where examples are adapted from it (such as the
`IpAddr`/`Message` enums and the grep-style CLI project), credit goes to its authors under those
licenses — see <https://github.com/rust-lang/book>.

### Trademarks & disclaimer

This is an **independent, unofficial** learning resource. It is **not affiliated with, endorsed by,
or sponsored by** the Rust Foundation or the Rust project. "Rust" and "Cargo" are trademarks of the
Rust Foundation and are used here **descriptively** (nominative fair use) to refer to the language and
its tooling, in line with the Rust trademark policy. "Ferris" the crab mascot is in the public domain
(CC0).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to
uphold it.

---

Created by Rahul Saharan.
