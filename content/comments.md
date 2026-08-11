<h1><span class="h1-kicker">Rust Foundations</span>Comments & Documentation</h1>

Comments are notes in your code that the compiler ignores — they exist for humans. Rust has ordinary comments, but it also has something special: **documentation comments** that automatically become a beautiful, searchable website *and* get tested to make sure your examples actually work. This is one of Rust's most-loved features.

## Ordinary comments

The everyday comment starts with `//` and runs to the end of the line:

```rust
fn main() {
    // This is a line comment. The compiler skips it.
    let speed = 60; // Comments can also sit at the end of a line.
    println!("Speed: {speed}");
}
```

Rust also has block comments with `/* */`, though Rustaceans use them rarely — `//` on each line is the norm:

```rust
fn main() {
    /* This is a block comment.
       It can span multiple lines. */
    println!("Done");
}
```

> [!tip] Rust's block comments nest, unlike C's
> You can put a block comment inside another one and it still works:
> ```rust
> fn main() {
>     /* outer
>        /* inner */
>        still commented out */
>     println!("ok");
> }
> ```
> In C this breaks, because the first `*/` ends the whole comment. In Rust the nesting is tracked properly, so you can comment out a chunk of code that already contains comments. That's the one job block comments are genuinely better at than `//`.

> [!best] Comment the *why*, not the *what*
> Good code shows *what* it does; comments should explain *why*. A comment like `// add 1 to x` next to `x += 1` is noise. A comment like `// retry once: the API occasionally drops the first request` is gold. If you feel the need to explain *what* a line does, consider renaming variables or extracting a well-named function instead.

## Documentation comments

Here's where Rust shines. **Doc comments** use three slashes `///` and support Markdown. They document the item *immediately below* them:

```rust
/// Adds two numbers together.
///
/// # Examples
///
/// ```
/// let result = my_crate::add(2, 3);
/// assert_eq!(result, 5);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
# fn main() {}
```

Run `cargo doc --open` and Rust builds a polished HTML website from these comments — the exact same format as the official standard-library docs.

Those `#` headings aren't arbitrary. The ecosystem has settled on a conventional set, in this order, and readers scan for them:

| Section | Says | Expected when |
|---|---|---|
| `# Examples` | how to actually use it | always — this is the one people read first |
| `# Errors` | what each `Err` variant means | the function returns `Result` |
| `# Panics` | the conditions under which it panics | it can panic (e.g. on an out-of-range index) |
| `# Safety` | what the caller must guarantee | **mandatory** for any `unsafe fn` |
| `# Returns` | the meaning of the return value | only if it isn't obvious from the type |

> [!best] `# Panics` is a promise, and its absence is one too
> When the standard library documents that `Vec::remove` panics if the index is out of bounds, that's a contract. The flip side matters just as much: if your function has no `# Panics` section, callers are entitled to assume it doesn't panic. Auditing your own public functions for undocumented panics is a quick, high-value pass — and `#[deny(clippy::missing_panics_doc)]` will do it for you.

> [!jargon] "Doc comment" vs. "comment"
> A regular **comment** (`//`) is purely for people reading the source. A **doc comment** (`///`) is a comment that is *also* extracted by the `rustdoc` tool to build documentation. Think of `///` as "a comment that becomes a web page."

### The magic: your examples are tested

This is the feature that makes Rustaceans grin. The code inside a ` ``` ` block in a doc comment is compiled and run as a test when you run `cargo test`:

> [!key] Documentation that can never lie
> Because `cargo test` executes your doc examples, **your documentation can never drift out of date**. If you change a function and forget to update its example, the doc test fails and the build breaks. Your examples are guaranteed to be correct, forever. No other mainstream language makes this so effortless.

Since each example must compile as a standalone program, it often needs boilerplate that would only clutter the docs. Prefixing a line with `#` runs it but **hides it from the reader** — which is what that `# fn main() {}` in the example above was doing:

```rust
/// Doubles a number.
///
/// # Examples
///
/// ```
/// # use std::fmt::Debug;      // ← needed to compile, hidden from readers
/// # fn double(n: i32) -> i32 { n * 2 }
/// assert_eq!(double(21), 42); // ← the only line the reader sees
/// ```
pub fn double(n: i32) -> i32 {
    n * 2
}
# fn main() {}
```

You can also control *how* an example is tested, which matters for code that shouldn't actually run:

| Fence tag | Effect |
|---|---|
| ` ``` ` | compile **and** run — the default |
| ` ```no_run ` | compile only; don't execute (network calls, infinite loops) |
| ` ```ignore ` | don't even compile — use sparingly, it rots silently |
| ` ```should_panic ` | the test passes only if the example panics |
| ` ```compile_fail ` | the test passes only if it *fails* to compile |
| ` ```text ` | not Rust at all; just a formatted block |

> [!mistake] Reaching for `ignore` when you mean `no_run`
> `ignore` switches the example off entirely, so it's never compiled and will quietly break as your API changes — exactly the drift that doc tests exist to prevent. If the problem is that the code shouldn't *execute* (it opens a socket, reads a file, or loops forever), use **`no_run`**: it still type-checks against your real API and still fails the build when you change a signature. Reserve `ignore` for pseudocode.

> [!tip] `compile_fail` documents what's *not* allowed
> When a type deliberately rejects something — a typestate builder that won't let you call `send()` too early, or a newtype that can't be added to a bare number — a `compile_fail` example proves it and keeps proving it. It's the only way to make "this is a compile error" a tested claim rather than a comment.

### Documenting the whole module or crate

While `///` documents the item *below* it, the sibling `//!` documents the item *containing* it — typically placed at the top of a file to describe the whole module or crate:

```rust,ignore
//! # My Awesome Crate
//!
//! This crate makes widgets fast and safe.
//! Start with the [`Widget`] type.

/// A single widget.
pub struct Widget;
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Three slashes document the item below, bang-slash documents the enclosing item">
  <style>
    .cm { font: 600 13px var(--font-mono); }
    .cc2 { font: 12px var(--font-sans); fill: var(--text-mute); }
    .arrow2 { stroke: var(--rust-500); stroke-width: 2; fill:none; }
  </style>
  <text x="30" y="30" class="cm" fill="var(--pink)">//! Documents the file / module it's inside ↑</text>
  <path d="M300 22 C 360 22, 360 8, 420 8" class="arrow2"/>
  <text x="30" y="80" class="cm" fill="var(--teal)">/// Documents the item just below ↓</text>
  <path d="M250 88 C 300 88, 300 105, 340 105" class="arrow2"/>
  <text x="30" y="120" class="cm" fill="var(--text)">pub fn important() {}</text>
</svg>
<figcaption><code>///</code> points <b>down</b> at the next item; <code>//!</code> points <b>up</b> at its container.</figcaption>
</figure>

> [!tip] Link between docs
> Inside doc comments you can link to other items with square brackets: `` [`Widget`] `` becomes a clickable link to that type's page. `rustdoc` resolves the path for you. This turns your docs into a richly connected reference.

### Documenting the parts, not just the whole

Doc comments work on almost anything, not only functions. Struct fields, enum variants, and methods each get their own entry in the generated page:

```rust
/// A server configuration.
pub struct Config {
    /// The address to bind to, such as `0.0.0.0`.
    pub host: String,
    /// The port to listen on. Ports below 1024 need root.
    pub port: u16,
}

/// What happened to a job.
pub enum Outcome {
    /// Finished normally.
    Success,
    /// Failed, with the exit code the process returned.
    Failed(i32),
}

fn main() {
    let c = Config { host: "0.0.0.0".into(), port: 8080 };
    println!("{}:{}", c.host, c.port);
    let _ = Outcome::Failed(1);
}
```

This is where documentation pays off most. A field called `port` needs no explanation, but "ports below 1024 need root" is exactly the sort of thing a reader can't guess and will otherwise learn the hard way.

> [!warning] Doc tests don't run in a binary-only crate
> This one surprises everyone. `cargo test` runs doc tests only for **library** targets. If your project is just a `src/main.rs`, your doc examples are compiled as documentation but **never executed as tests** — so the "documentation that can never lie" guarantee silently doesn't apply. The fix is the normal Rust project shape anyway: put your logic in `src/lib.rs` and keep `src/main.rs` as a thin wrapper that calls into it. You get working doc tests, and your code becomes reusable and easier to test in general.

> [!best] Turn on `missing_docs` for anything public
> Add `#![warn(missing_docs)]` at the top of your `lib.rs` and the compiler will point out every public item without a doc comment. It's one line, it costs nothing, and it turns "I'll document it later" into a visible list. Pair it with `cargo doc --document-private-items` while you're working, so you can read your own internal docs too.

## Summary

- **`//`** is a normal line comment; **`/* */`** is a block comment, and unlike C's it **nests** — handy for commenting out code that already has comments.
- Comment the **why**, not the **what** — let clear code speak for itself.
- **`///`** documents the item below it; **`//!`** documents the enclosing module or crate. Both take Markdown.
- Document **fields and enum variants too**, not just functions.
- Use the conventional sections: **`# Examples`**, `# Errors`, `# Panics`, and `# Safety` (required for `unsafe fn`). No `# Panics` section is itself a promise.
- **`cargo doc --open`** turns doc comments into a professional website.
- Examples in doc comments are **run as tests** by `cargo test` — but **only for library targets**, so put your logic in `lib.rs`.
- Prefix a line with **`#`** to include it in the test but hide it from readers. Use **`no_run`** rather than `ignore` when code shouldn't execute.
- **`#![warn(missing_docs)]`** lists every undocumented public item for you.

> [!exercise] Try it yourself
> 1. Add a `///` doc comment with an `# Examples` section to the `square` function you wrote earlier.
> 2. On your machine, run `cargo doc --open` and admire the generated page.
> 3. Put an `assert_eq!` in your example, run `cargo test`, and confirm the doc test runs. Then break the example and watch the test fail.
> 4. Try step 3 in a project created with plain `cargo new` (binary only). Does the doc test run? Now move the function into `src/lib.rs` and try again.
> 5. Document a struct's fields, then run `cargo doc --open` and see where each field's comment appears.
> 6. Add `#![warn(missing_docs)]` to a small library and count the warnings.

You can now write and document code. Let's make it *do* different things depending on the situation — with **control flow**.
