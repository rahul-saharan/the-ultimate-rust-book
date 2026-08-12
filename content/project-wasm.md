<h1><span class="h1-kicker">Building Real Projects</span>Project: WebAssembly in the Browser</h1>

Rust doesn't just build servers and CLIs — it runs **in the browser** too, via **WebAssembly (WASM)**. You can write performance-critical logic in Rust, compile it to a `.wasm` module, and call it from JavaScript as easily as any JS function. In this project we'll compile a Rust function to WASM and run it on a web page. (This targets the browser, so it runs on your machine — the code is the guide.)

## What is WebAssembly?

> [!jargon] WebAssembly (WASM)
> **WebAssembly** is a fast, compact binary instruction format that runs in all modern browsers (and beyond) at near-native speed. It's a *compilation target*: languages like Rust, C, and Go compile *to* WASM, which the browser then executes in a secure sandbox alongside JavaScript. It's how you bring heavy computation — image processing, games, cryptography, simulations — to the web without rewriting it in JS.

Rust is one of the *best* languages for WASM: no garbage collector means small, fast modules, and the tooling (`wasm-bindgen`, `wasm-pack`) is excellent.

## First, when is this actually worth it?

"Rust in the browser is faster than JavaScript" is repeated a lot and is only *sometimes* true. Modern JavaScript engines JIT-compile hot numeric loops to machine code that is genuinely competitive. Here are two algorithms, each implemented identically in Rust and in JavaScript, with the same checksums to prove they do the same work:

| Workload | Rust (native, `-O`) | JavaScript (Node 22 / V8) | Ratio |
|---|---|---|---|
| Mandelbrot, 600×400, 500 iterations — `f64` math | 93 ms | 95 ms | **~1×** |
| FNV-1a hash of 10 MB — **64-bit integer** math | 11 ms | 514 ms | **~45×** |

The float loop is a tie. V8 compiles that inner loop to roughly the instructions `rustc` emits, and both produce checksum `26506217`. The hash is a rout — not because JS is badly optimised, but because **JavaScript has no 64-bit integers**: numbers are doubles, so correct 64-bit arithmetic has to go through `BigInt`, which allocates. Rust's `u64` is one machine instruction.

That's the honest shape of the decision. WASM's advantages are:

- **Types JS doesn't have**: `u64`/`i64`, precise integer overflow behaviour, packed structs, `u8` buffers without per-element boxing.
- **Predictable performance**: no JIT warm-up, no deoptimisation cliff when a shape changes, no GC pauses mid-frame. A game loop that must hit 16 ms every frame cares more about the *worst* frame than the average.
- **Reusing code that already exists** in Rust or C — image codecs, compression, cryptography, parsers, physics engines, SQLite. Porting that to JS is the alternative, and it isn't free.
- **Memory control**: you own a linear buffer and can lay data out exactly as you want.

And the costs: a build step, a module to download and instantiate, and a boundary that charges you for every string and every array copy — which is where most naive ports lose their winnings.

> [!note] What that benchmark does and doesn't tell you
> Those numbers are **native Rust versus Node's V8**, measured on one machine — not in-browser WASM versus in-browser JS. In-browser WASM typically lands within a small factor of native for this kind of tight loop (it's the same compiler backend, minus some SIMD and with sandboxing checks), so the *shape* of the comparison holds, but you should reproduce it for your own workload before making a decision. The last exercise in this chapter has you do exactly that, in a real browser.

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
crate-type = ["cdylib", "rlib"]     # cdylib for wasm; rlib so `cargo test` still works

[dependencies]
wasm-bindgen = "0.2"
console_error_panic_hook = "0.1"     # turn panics into readable console errors

[dev-dependencies]
wasm-bindgen-test = "0.3"            # for `wasm-pack test`

[profile.release]
opt-level = "s"                      # optimise for size; "3" for speed, "z" for smallest
lto = true                           # whole-program optimisation: smaller and faster
codegen-units = 1
```

That `"rlib"` matters more than it looks: with it, the crate is still a normal Rust library, so `cargo test` compiles and runs your logic **on the host** with no browser and no WASM toolchain involved. Which leads to the way to structure one of these projects.

## Structure: pure logic inside, a thin shell outside

The single most useful discipline in a WASM project is keeping `#[wasm_bindgen]` out of your logic. Write ordinary Rust that knows nothing about JavaScript, then add a shell that exposes it. The logic stays testable, benchmarkable, and portable; only the shell needs a browser.

Here is the pure half of a fractal renderer — plain Rust, no attributes, runnable anywhere:

```rust
/// Pure logic: no wasm_bindgen, no JS types. Testable with plain `cargo test`.
pub struct Fractal {
    width: usize,
    height: usize,
    pixels: Vec<u8>,          // RGBA, 4 bytes per pixel
}

impl Fractal {
    pub fn new(width: usize, height: usize) -> Self {
        Self { width, height, pixels: vec![0; width * height * 4] }
    }

    /// Renders into the existing buffer -- no allocation per frame.
    pub fn render(&mut self, center_x: f64, center_y: f64, scale: f64, max_iter: u32) {
        for py in 0..self.height {
            for px in 0..self.width {
                let cx = center_x + scale * (px as f64 / self.width as f64 - 0.5);
                let cy = center_y + scale * (py as f64 / self.height as f64 - 0.5);
                let i = escape_time(cx, cy, max_iter);
                let shade = if i == max_iter { 0 } else { (255 * i / max_iter) as u8 };
                let o = (py * self.width + px) * 4;
                self.pixels[o] = shade;
                self.pixels[o + 1] = shade / 2;
                self.pixels[o + 2] = 255 - shade;
                self.pixels[o + 3] = 255;          // opaque
            }
        }
    }

    pub fn pixels(&self) -> &[u8] { &self.pixels }
}

fn escape_time(cx: f64, cy: f64, max_iter: u32) -> u32 {
    let (mut x, mut y) = (0.0, 0.0);
    let mut i = 0;
    while x * x + y * y <= 4.0 && i < max_iter {
        let xt = x * x - y * y + cx;
        y = 2.0 * x * y + cy;
        x = xt;
        i += 1;
    }
    i
}

fn main() {
    let mut f = Fractal::new(320, 200);
    let t = std::time::Instant::now();
    f.render(-0.5, 0.0, 3.0, 300);
    println!("rendered {}x{} in {:?}", 320, 200, t.elapsed());
    println!("buffer is {} bytes, every pixel opaque: {}",
             f.pixels().len(), f.pixels().chunks(4).all(|p| p[3] == 255));
    println!("centre pixel RGBA: {:?}", &f.pixels()[(100 * 320 + 160) * 4..][..4]);

    // The same logic is testable on the host -- no browser involved.
    assert_eq!(escape_time(0.0, 0.0, 100), 100);      // origin never escapes
    assert!(escape_time(2.0, 2.0, 100) < 5);          // far outside escapes at once
    println!("host-side assertions passed");
}
```

```text
rendered 320x200 in 12.623294ms
buffer is 256000 bytes, every pixel opaque: true
centre pixel RGBA: [0, 0, 255, 255]
host-side assertions passed
```

Now the shell. Note what it adds: the `#[wasm_bindgen]` attributes, a panic hook, and — the important part — a `pixels_ptr()` that hands JavaScript the *address* of the buffer instead of a copy of it:

```rust,ignore
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct FractalView(Fractal);      // wraps the pure type above

#[wasm_bindgen]
impl FractalView {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> FractalView {
        console_error_panic_hook::set_once();     // panics become readable console errors
        FractalView(Fractal::new(width, height))
    }

    pub fn render(&mut self, cx: f64, cy: f64, scale: f64, max_iter: u32) {
        self.0.render(cx, cy, scale, max_iter);
    }

    /// The address of the pixel buffer inside WASM linear memory.
    /// JS builds a Uint8ClampedArray *over* it -- no copy, ever.
    pub fn pixels_ptr(&self) -> *const u8 { self.0.pixels().as_ptr() }
    pub fn pixels_len(&self) -> usize { self.0.pixels().len() }
}
```

> [!best] Keep `#[wasm_bindgen]` in one file and out of your logic
> Every `#[wasm_bindgen]` type drags in JS-boundary machinery and can only be exercised from a browser. Confine it to `lib.rs` as a thin adapter over plain Rust modules, and you get three things: `cargo test` runs your real logic in milliseconds on the host, the same crate can also power a CLI or a server, and porting to a different frontend (or to WASI) touches one file. It's the same hexagonal-architecture instinct as keeping SQL out of your domain types.

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

Beyond free functions, `#[wasm_bindgen]` handles most of what you'd want to expose:

```rust,ignore
use wasm_bindgen::prelude::*;

// A struct becomes a JS class: `new Counter()`, `c.increment()`, `c.value`.
#[wasm_bindgen]
pub struct Counter { value: i32 }

#[wasm_bindgen]
impl Counter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Counter { Counter { value: 0 } }

    pub fn increment(&mut self) { self.value += 1; }

    #[wasm_bindgen(getter)]                     // reads as `c.value` in JS
    pub fn value(&self) -> i32 { self.value }
}

// Result<T, JsValue>: Err becomes a thrown JS exception, catchable with try/catch.
#[wasm_bindgen]
pub fn parse_port(text: &str) -> Result<u16, JsValue> {
    text.trim().parse::<u16>()
        .map_err(|e| JsValue::from_str(&format!("bad port {text:?}: {e}")))
}

// Option<T> maps to `T | undefined`; Vec<u8> arrives in JS as a Uint8Array (copied).
#[wasm_bindgen]
pub fn first_word(text: &str) -> Option<String> {
    text.split_whitespace().next().map(str::to_owned)
}

// Logging: web_sys gives typed bindings to console, DOM, fetch, canvas, WebGL...
#[wasm_bindgen]
pub fn log_from_rust(msg: &str) {
    web_sys::console::log_1(&JsValue::from_str(msg));
}
```

## The boundary: what crossing it costs

Rust and JavaScript don't share a heap. WASM gets a flat block of bytes called **linear memory**, and every value that moves between the two has to be translated. Numbers are free; anything with a shape is not:

<figure class="diagram">
<svg viewBox="0 0 640 274" role="img" aria-label="The JavaScript heap and WebAssembly linear memory are separate: numbers pass in registers for free, strings and arrays are copied across, and a pointer plus length lets JavaScript view WASM memory directly with no copy">
  <style>
    .bd-h { font: 700 11px var(--font-sans); }
    .bd-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .bd-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .bd-js { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
    .bd-w { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.6; }
    .bd-mem { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="30" y="16" class="bd-h" fill="var(--blue)">JavaScript heap</text>
  <text x="430" y="16" class="bd-h" fill="var(--rust-500)">WASM linear memory</text>
  <rect x="20" y="24" width="180" height="150" rx="6" class="bd-js"/>
  <rect x="420" y="24" width="200" height="150" rx="6" class="bd-w"/>
  <text x="32" y="44" class="bd-c">GC'd objects, UTF-16 strings</text>
  <text x="432" y="44" class="bd-c">one flat ArrayBuffer of bytes</text>
  <rect x="432" y="54" width="176" height="18" class="bd-mem"/><text x="440" y="67" class="bd-m">pixels: Vec&lt;u8&gt;</text>
  <rect x="432" y="76" width="176" height="18" class="bd-mem"/><text x="440" y="89" class="bd-m">other allocations…</text>
  <line x1="310" y1="24" x2="310" y2="174" stroke="var(--text-mute)" stroke-width="1.3" stroke-dasharray="4 4"/>
  <text x="252" y="120" class="bd-c" transform="rotate(-90 252 120)">the boundary</text>
  <path d="M204 108 L416 108" stroke="var(--green)" stroke-width="1.7" marker-end="url(#bd-a)"/>
  <text x="214" y="102" class="bd-c" fill="var(--green)">f64 / i32 / u32 — passed as-is, free</text>
  <path d="M204 134 L416 134" stroke="var(--rust-500)" stroke-width="1.7" marker-end="url(#bd-a2)"/>
  <text x="214" y="128" class="bd-c" fill="var(--rust-500)">&amp;str / Vec&lt;u8&gt; / JsValue — COPIED, and strings re-encoded</text>
  <path d="M416 160 L206 160" stroke="var(--blue)" stroke-width="1.7" stroke-dasharray="5 3" marker-end="url(#bd-a3)"/>
  <text x="214" y="154" class="bd-c" fill="var(--blue)">ptr + len → JS views the same bytes, no copy</text>
  <text x="20" y="198" class="bd-c">Zero-copy pattern: <tspan font-family="var(--font-mono)">new Uint8ClampedArray(wasm.memory.buffer, view.pixels_ptr(), view.pixels_len())</tspan></text>
  <text x="20" y="214" class="bd-c">Caveat: any WASM allocation can <tspan font-style="italic">grow</tspan> linear memory, which replaces the ArrayBuffer and detaches your view —</text>
  <text x="20" y="228" class="bd-c">so re-create the view after anything that may allocate, or allocate the buffer once up front and never resize it.</text>
  <text x="20" y="250" class="bd-c">A per-frame <tspan font-family="var(--font-mono)">String</tspan> return means one allocation, one UTF-8→UTF-16 conversion and one copy <tspan font-style="italic">every frame</tspan>.</text>
  <text x="20" y="264" class="bd-c">Chatty boundaries are where naive ports lose to plain JavaScript.</text>
  <defs>
    <marker id="bd-a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="bd-a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="bd-a3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
  </defs>
</svg>
<figcaption>Two separate memories: numbers cross for free, strings and vectors are copied, and a pointer plus length lets JS read WASM's bytes in place.</figcaption>
</figure>

| Rust type | JS side | Cost per crossing |
|---|---|---|
| `i32`, `u32`, `f32`, `f64` | `number` | free — passed in a register |
| `u64`, `i64` | `BigInt` | cheap, but JS-side arithmetic on it is slow |
| `bool`, `char` | `boolean`, single-char `string` | trivial |
| `&str`, `String` | `string` | **copy + UTF-8 ⇄ UTF-16 re-encode** |
| `&[u8]`, `Vec<u8>` | `Uint8Array` | **copy** (both directions) |
| `*const u8` + length | `Uint8Array` over `memory.buffer` | **zero copy** — the pattern for pixel and audio buffers |
| `#[wasm_bindgen] struct` | a JS class holding a pointer | free; the object stays in WASM |
| `Result<T, JsValue>` | value or a thrown exception | as its `T` |
| `Option<T>` | `T \| undefined` | as its `T` |
| `JsValue` | any JS value | an opaque handle — every access is a boundary call |

> [!performance] Cross the boundary rarely, with big payloads
> A function called once per frame with a `f64` argument that renders a million pixels into a buffer JS already has a view on is the ideal shape. The anti-pattern is the mirror image: a function called a million times per frame, each call passing a string. If you find yourself doing DOM work from Rust, remember every `web_sys` call is a boundary crossing plus a JS call — which is exactly why "rewrite the UI in WASM" often measures *slower* than the JS it replaced. Batch: pass one array instead of N numbers, return one buffer instead of N strings, and keep state inside the WASM struct rather than shuttling it back and forth.

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

That page will *not* work if you open it with `file://` — ES modules and WASM both require HTTP. Serve the directory:

```bash
python3 -m http.server 8080     # then open http://localhost:8080
# or: npx serve .  /  cargo install basic-http-server && basic-http-server .
```

| `wasm-pack build --target …` | Produces | Use for |
|---|---|---|
| `web` | an ES module you `import` directly | plain pages, Vite/Rollup with `?url` imports |
| `bundler` (default) | a module for webpack/bundler resolution | npm-based apps |
| `nodejs` | CommonJS `require` | Node scripts, server-side |
| `no-modules` | a plain `<script>` global | quick demos, no module system |

Add `--release` (the default for `wasm-pack build`) or `--dev` for fast, unoptimised builds while iterating, and `--out-dir pkg` to control where the output lands.

### Putting the zero-copy buffer on a canvas

This is the payoff for `pixels_ptr()`: JavaScript wraps WASM's own bytes in a view and hands them to the canvas. No copy per frame, no allocation per frame:

```html
<script type="module">
  import init, { FractalView } from './pkg/wasm_demo.js';

  const wasm = await init();                 // the WASM instance, incl. its memory
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const view = new FractalView(canvas.width, canvas.height);

  let scale = 3.0;
  function frame() {
    view.render(-0.5, 0.0, scale, 300);      // one boundary crossing, four numbers

    // A view OVER wasm memory -- not a copy of it.
    const bytes = new Uint8ClampedArray(
      wasm.memory.buffer, view.pixels_ptr(), view.pixels_len());
    ctx.putImageData(new ImageData(bytes, canvas.width, canvas.height), 0, 0);

    scale *= 0.99;
    requestAnimationFrame(frame);
  }
  frame();
</script>
```

> [!warning] A detached view is the classic zero-copy bug
> Building the `Uint8ClampedArray` **inside** the frame function, as above, is deliberate. If WASM allocates and linear memory has to grow, the engine replaces the underlying `ArrayBuffer` and every existing view of it becomes *detached* — reads then throw `TypeError: Cannot perform Construct on a detached ArrayBuffer`, or silently see zeros. Either re-create the view after any call that might allocate (cheap: it's just a pointer and a length), or allocate your buffers once at startup and never resize them. This bug reliably appears the first time a user resizes the window.

## Debugging and testing

A WASM panic without a hook prints `unreachable executed` and nothing else, which is why `console_error_panic_hook::set_once()` belongs in every constructor or an `init` function — with it, you get the real panic message, file, and line in the browser console.

```rust,ignore
// tests/web.rs -- runs in a real browser via `wasm-pack test --headless --chrome`
use wasm_bindgen_test::*;
wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn parses_a_port() {
    assert_eq!(parse_port(" 8080 ").unwrap(), 8080);
    assert!(parse_port("nope").is_err());
}
```

| Problem | Tool |
|---|---|
| a panic with no message | `console_error_panic_hook::set_once()` |
| logging from Rust | `web_sys::console::log_1(&value.into())`, or the `tracing-wasm` crate |
| test the logic | `cargo test` — the host build, thanks to `crate-type = ["cdylib", "rlib"]` |
| test the JS boundary | `wasm-pack test --headless --chrome` (or `--firefox`, `--node`) |
| module is too big | `opt-level = "z"`, `lto = true`, `wasm-opt -Oz` (bundled with `wasm-pack`), and `twiggy` to see *what* is big |
| what's in my `.wasm`? | `twiggy top pkg/*.wasm`, `wasm-objdump`, `wasm2wat` |

> [!performance] Where module size actually goes
> A trivially small Rust function does not produce a trivially small module: formatting machinery (`format!`, `Display`, panic messages) and anything touching `std::collections` pulls in real code, so a hello-world module lands in the tens of kilobytes before optimisation. The levers, in order of payoff: `lto = true` and `opt-level = "z"` in `[profile.release]`; letting `wasm-pack` run `wasm-opt`; avoiding `format!`/panic messages on hot paths (`panic = "abort"` and `unwrap_unchecked` are the aggressive end); and checking with `twiggy` rather than guessing. Also serve `.wasm` with `Content-Encoding: gzip` or `br` — the format compresses extremely well, so the wire size is often a third of the file size.

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
- **WASM is not automatically faster than JS.** Measured here: an identical `f64` Mandelbrot loop was a **tie** with V8, while 64-bit integer hashing was **~45× faster** in Rust — because JavaScript has no `u64`. Reach for WASM for types JS lacks, predictable frame times, memory control, and code you already have.
- Build a **`crate-type = ["cdylib", "rlib"]`** crate so `cargo test` still runs your logic on the host, add **`wasm-bindgen`**, and expose functions, structs (as JS classes), `Result<T, JsValue>` (as exceptions), and `Option<T>` with **`#[wasm_bindgen]`**.
- **Keep `#[wasm_bindgen]` in one thin shell file** over pure Rust logic — testable, portable, and reusable outside the browser.
- **`wasm-pack build --target web`** produces the `.wasm` plus JS glue; the page must be served over **HTTP**, not `file://`.
- Numbers cross the boundary free; **strings and `Vec`s are copied** (strings re-encoded). Return a **pointer + length** and build a `Uint8Array` over `wasm.memory.buffer` for zero-copy pixel/audio buffers — re-creating the view after anything that may grow memory, or it *detaches*.
- **Cross rarely with big payloads.** Chatty boundaries — especially DOM work from Rust — are how ports end up slower than the JS they replaced.
- Debug with **`console_error_panic_hook`** (otherwise a panic is just `unreachable executed`), test logic with `cargo test` and the boundary with `wasm-pack test --headless`, and shrink with `lto`/`opt-level = "z"`/`wasm-opt`, inspecting with `twiggy`.
- The ecosystem — **`web-sys`/`js-sys`**, and frameworks like **Yew/Leptos/Dioxus** — scales from a single hot function to a full Rust web UI.

> [!exercise] Try it yourself (locally)
> 1. Build the `greet`/`nth_prime` module with `wasm-pack build --target web` and call it from a page served over HTTP.
> 2. Add a Rust function that reverses a string and call it from JS.
> 3. Run the pure `Fractal` logic from this chapter with `cargo test` and a `#[test]` that asserts the buffer is fully opaque — with no WASM toolchain involved.
> 4. Wire `FractalView` to a canvas with the zero-copy `Uint8ClampedArray` view and animate the zoom.
> 5. Break it on purpose: allocate a large `Vec` inside a render call, keep the view outside the frame loop, and observe the detached-buffer error.
> 6. Expose a `Counter` struct as a JS class and drive it from a button, then add a `parse_port` that throws on bad input and catch it with `try/catch`.
> 7. Measure the boundary: time one call that hashes a 10 MB `Uint8Array` versus 10,000 calls that each hash 1 KB, and explain the gap.
> 8. Reproduce this chapter's benchmark table **in the browser**: the same Mandelbrot and FNV-1a in WASM and in JS, timed with `performance.now()`. Do your ratios match mine?

Our final project ventures to the opposite extreme — running Rust on a tiny microcontroller with no operating system at all.
