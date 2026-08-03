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

Run `cargo doc --open` and Rust builds a polished HTML website from these comments — the exact same format as the official standard-library docs. Your `# Examples`, `# Panics`, and `# Errors` sections render as proper headings.

> [!jargon] "Doc comment" vs. "comment"
> A regular **comment** (`//`) is purely for people reading the source. A **doc comment** (`///`) is a comment that is *also* extracted by the `rustdoc` tool to build documentation. Think of `///` as "a comment that becomes a web page."

### The magic: your examples are tested

This is the feature that makes Rustaceans grin. The code inside a ` ``` ` block in a doc comment is compiled and run as a test when you run `cargo test`:

> [!key] Documentation that can never lie
> Because `cargo test` executes your doc examples, **your documentation can never drift out of date**. If you change a function and forget to update its example, the doc test fails and the build breaks. Your examples are guaranteed to be correct, forever. No other mainstream language makes this so effortless.

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

## Summary

- **`//`** is a normal line comment; **`/* */`** is a block comment (rarely used in Rust).
- Comment the **why**, not the **what** — let clear code speak for itself.
- **`///`** writes a documentation comment (in Markdown) for the item below it; **`//!`** documents the enclosing module or crate.
- **`cargo doc --open`** turns doc comments into a professional website.
- Code examples in doc comments are **run as tests** by `cargo test`, so your documentation stays correct automatically.

> [!exercise] Try it yourself
> 1. Add a `///` doc comment with an `# Examples` section to the `square` function you wrote earlier.
> 2. On your machine, run `cargo doc --open` and admire the generated page.
> 3. Put an `assert_eq!` in your example, run `cargo test`, and confirm the doc test runs. Then break the example and watch the test fail.

You can now write and document code. Let's make it *do* different things depending on the situation — with **control flow**.
