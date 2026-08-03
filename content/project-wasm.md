<h1><span class="h1-kicker">Building Real Projects</span>Project: WebAssembly in the Browser</h1>

Rust doesn't just build servers and CLIs — it runs **in the browser** too, via **WebAssembly (WASM)**. You can write performance-critical logic in Rust, compile it to a `.wasm` module, and call it from JavaScript as easily as any JS function. In this project we'll compile a Rust function to WASM and run it on a web page. (This targets the browser, so it runs on your machine — the code is the guide.)

## What is WebAssembly?

> [!jargon] WebAssembly (WASM)
> **WebAssembly** is a fast, compact binary instruction format that runs in all modern browsers (and beyond) at near-native speed. It's a *compilation target*: languages like Rust, C, and Go compile *to* WASM, which the browser then executes in a secure sandbox alongside JavaScript. It's how you bring heavy computation — image processing, games, cryptography, simulations — to the web without rewriting it in JS.

Rust is one of the *best* languages for WASM: no garbage collector means small, fast modules, and the tooling (`wasm-bindgen`, `wasm-pack`) is excellent.

## Setup

```bash
cargo new --lib wasm-demo && cd wasm-demo
cargo add wasm-bindgen
rustup target add wasm32-unknown-unknown   # the WASM compile target
cargo install wasm-pack                      # the build tool
```

Configure the crate to build a WASM-compatible dynamic library in `Cargo.toml`:

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
```

## Writing WASM-callable Rust

The **`#[wasm_bindgen]`** attribute is the bridge: it makes a Rust function callable from JavaScript, handling the type conversions across the boundary:

```rust,ignore
// src/lib.rs
use wasm_bindgen::prelude::*;

// Exposed to JavaScript as `greet(name)`:
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}, from Rust + WebAssembly! 🦀")
}

// A CPU-heavy function worth doing in Rust rather than JS:
#[wasm_bindgen]
pub fn nth_prime(n: u32) -> u32 {
    let mut count = 0;
    let mut candidate = 1;
    while count < n {
        candidate += 1;
        if is_prime(candidate) {
            count += 1;
        }
    }
    candidate
}

fn is_prime(n: u32) -> bool {
    if n < 2 { return false; }
    (2..=(n as f64).sqrt() as u32).all(|d| n % d != 0)
}
```

## Building and calling from JavaScript

Build the WASM package with one command — it produces the `.wasm` file *and* a JavaScript glue module:

```bash
wasm-pack build --target web
```

Then call your Rust functions from a web page as if they were JavaScript:

```html
<!-- index.html -->
<script type="module">
  import init, { greet, nth_prime } from './pkg/wasm_demo.js';

  async function run() {
    await init();                    // load and initialize the WASM module
    console.log(greet("Ferris"));     // calls Rust!
    console.log("1000th prime:", nth_prime(1000)); // heavy compute in Rust
  }
  run();
</script>
```

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="Rust compiles to a wasm module plus JS glue, which the browser loads and calls">
  <style>
    .wsm { font: 600 11px var(--font-mono); fill: var(--text); }
    .wsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .rs { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .ws { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .js { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="14" y="50" width="130" height="40" class="rs"/><text x="26" y="74" class="wsm">Rust lib.rs</text>
  <rect x="180" y="50" width="150" height="40" class="ws"/><text x="192" y="74" class="wsm">.wasm + JS glue</text>
  <rect x="370" y="50" width="120" height="40" class="js"/><text x="382" y="74" class="wsm">browser JS</text>
  <rect x="520" y="50" width="106" height="40" class="js"/><text x="532" y="74" class="wsm">web page</text>
  <path d="M144 70 L178 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#aws)"/>
  <text x="150" y="44" class="wsc">wasm-pack</text>
  <path d="M330 70 L368 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#aws)"/>
  <text x="332" y="44" class="wsc">import</text>
  <path d="M490 70 L518 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#aws)"/>
  <text x="14" y="122" class="wsc">wasm-pack turns Rust into a WASM module + JS bindings; the page imports and calls them like normal JS.</text>
  <defs><marker id="aws" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>wasm-pack</code> compiles Rust to a <code>.wasm</code> module with JS glue that the browser imports and calls.</figcaption>
</figure>

## When WASM is worth it

> [!best] Use Rust+WASM for the heavy lifting, not the whole app
> WASM shines for **compute-intensive** work in the browser: image/video processing, cryptography, physics/simulation, parsers, game logic, data crunching. Don't rewrite your whole UI in Rust — DOM manipulation from WASM crosses the JS boundary a lot and is often *slower* than plain JS. The sweet spot is a small, hot Rust module doing the number-crunching, called from a JavaScript (or framework) UI. Measure: WASM's win is CPU-bound work, not glue code.

> [!tip] The Rust+WASM ecosystem
> Beyond `wasm-bindgen`/`wasm-pack`: **`js-sys`** and **`web-sys`** give typed bindings to JavaScript and browser APIs (DOM, fetch, canvas, WebGL); **`serde-wasm-bindgen`** passes complex data across the boundary as JS objects; and full frameworks like **Yew**, **Leptos**, and **Dioxus** let you build entire reactive web UIs in Rust (compiling to WASM). Start with `wasm-bindgen` to grasp the fundamentals, then explore a framework if you want to build UIs.

> [!note] WASM runs outside the browser too
> WebAssembly isn't only for web pages. **WASI** (the WebAssembly System Interface) lets WASM run on servers and edge platforms (Cloudflare Workers, Fastly, Fermyon) as a fast, secure, portable sandbox — Rust compiles to WASI targets as well. WASM is increasingly a universal, sandboxed "run anywhere" format, and Rust is a first-class citizen of it.

## Summary

- **WebAssembly (WASM)** is a fast, sandboxed binary format that runs in browsers (and on servers via **WASI**); Rust is a top language for it (no GC → small, fast modules).
- Build a `cdylib` crate, add **`wasm-bindgen`**, and annotate functions with **`#[wasm_bindgen]`** to expose them to JavaScript.
- **`wasm-pack build --target web`** produces the `.wasm` module plus JS glue you `import` and call like normal JS.
- Use Rust+WASM for **compute-heavy** work (image processing, crypto, simulation, game logic), not DOM-heavy glue.
- The ecosystem — **`web-sys`/`js-sys`**, and frameworks like **Yew/Leptos/Dioxus** — scales from a single hot function to a full Rust web UI.

> [!exercise] Try it yourself (locally)
> 1. Build the `greet`/`nth_prime` module with `wasm-pack build --target web` and call it from a simple HTML page.
> 2. Add a Rust function that reverses a string and call it from JS.
> 3. Benchmark `nth_prime(5000)` in Rust/WASM vs. an equivalent JS implementation.

Our final project ventures to the opposite extreme — running Rust on a tiny microcontroller with no operating system at all.
