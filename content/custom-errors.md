<h1><span class="h1-kicker">Error Handling</span>Custom Errors, thiserror & anyhow</h1>

`Box<dyn Error>` is a fine catch-all, but sometimes you want callers to be able to *inspect* what went wrong and react differently — "if it's a `NotFound`, show a 404; if it's a `Timeout`, retry." For that you design your **own error type**. This chapter shows how to build one by hand (so you understand the machinery), then introduces the two crates — **`thiserror`** and **`anyhow`** — that make it effortless in practice.

## A custom error type from scratch

An idiomatic Rust error is usually an **enum** with one variant per failure mode. To be a well-behaved error, it should implement two traits: `Display` (a human-readable message) and the standard `Error` trait. Here's a complete, runnable example:

```rust
use std::fmt;

// One variant per way things can go wrong.
#[derive(Debug)]
enum ConfigError {
    Missing(String),
    OutOfRange { field: String, value: i32 },
}

// 1. Display: how the error reads to a human.
impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing(key) => write!(f, "missing config key: {key}"),
            ConfigError::OutOfRange { field, value } =>
                write!(f, "{field} is out of range: {value}"),
        }
    }
}

// 2. The Error trait — marks this as a proper error (empty body is fine here).
impl std::error::Error for ConfigError {}

fn load_port(raw: Option<i32>) -> Result<i32, ConfigError> {
    let port = raw.ok_or(ConfigError::Missing("port".to_string()))?;
    if !(1..=65535).contains(&port) {
        return Err(ConfigError::OutOfRange { field: "port".into(), value: port });
    }
    Ok(port)
}

fn main() {
    for input in [Some(8080), Some(99999), None] {
        match load_port(input) {
            Ok(p) => println!("✅ port = {p}"),
            Err(e) => println!("❌ {e}"), // uses our Display impl
        }
    }
}
```

> [!key] Why implement `Display` + `Error`?
> Implementing **`Display`** gives your error a clean message (used by `{}`, logs, and `?` up the chain). Implementing **`std::error::Error`** makes your type "officially an error," so it slots into `Box<dyn Error>`, works with `?`, and plays nicely with the whole ecosystem. Together they make your type a first-class citizen of Rust error handling.

## Combining error sources with `From`

Remember that `?` auto-converts error types via the `From` trait. If your function calls something that returns a *different* error (say, a `ParseIntError`), you implement `From` to teach `?` how to fold it into your error type:

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum AppError {
    Parse(ParseIntError),
    Empty,
}

// Teach `?` how to turn a ParseIntError into an AppError:
impl From<ParseIntError> for AppError {
    fn from(e: ParseIntError) -> Self {
        AppError::Parse(e)
    }
}

fn parse_first(line: &str) -> Result<i32, AppError> {
    let token = line.split(',').next().ok_or(AppError::Empty)?;
    let n = token.parse::<i32>()?; // ParseIntError auto-converts via From!
    Ok(n)
}

fn main() {
    println!("{:?}", parse_first("42,foo")); // Ok(42)
    println!("{:?}", parse_first("nope"));    // Err(Parse(...))
}
```

That's the whole machinery. It works, and it's good to understand — but writing `Display` and `From` by hand for every error gets repetitive. Enter the crates.

## `thiserror` — custom errors, minus the boilerplate

For **libraries**, the `thiserror` crate generates all that boilerplate from a derive macro. You describe your error; it writes the `Display` and `From` implementations for you:

```rust,ignore
use thiserror::Error; // add with: cargo add thiserror

#[derive(Error, Debug)]
enum AppError {
    #[error("missing config key: {0}")]
    Missing(String),

    #[error("{field} is out of range: {value}")]
    OutOfRange { field: String, value: i32 },

    // #[from] auto-generates the From impl AND the Display "source" wiring:
    #[error("failed to parse a number")]
    Parse(#[from] std::num::ParseIntError),
}
```

The `#[error("…")]` attribute becomes your `Display` message (with `{0}` and `{field}` interpolation), and `#[from]` generates the `From` conversion so `?` just works. It's the exact same behavior you wrote by hand — in a fraction of the code.

> [!best] Use `thiserror` for libraries
> A **library** should expose a precise, structured error type so its *callers* can match on specific failures. `thiserror` gives you that with almost no boilerplate, and adds zero runtime cost. It's the community standard for library error types.

## `anyhow` — effortless errors for applications

For **applications** (binaries — the top-level program), you often don't need callers to distinguish error kinds; you just want to bubble everything up with helpful context and print it. The `anyhow` crate makes that a joy:

```rust,ignore
use anyhow::{Context, Result}; // add with: cargo add anyhow

fn load_settings(path: &str) -> Result<String> { // anyhow::Result<T> = Result<T, anyhow::Error>
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("could not read settings file `{path}`"))?;
    let port: u16 = text.trim().parse()
        .context("settings file must contain a valid port number")?;
    Ok(format!("listening on {port}"))
}

fn main() -> anyhow::Result<()> {
    let msg = load_settings("config.txt")?;
    println!("{msg}");
    Ok(())
}
```

`anyhow::Error` swallows *any* error type (via `?`), and `.context(...)` attaches a human-friendly explanation, producing lovely error chains like:

```text
Error: could not read settings file `config.txt`
Caused by: No such file or directory (os error 2)
```

> [!tip] The rule of thumb: `thiserror` for libraries, `anyhow` for apps
> - **Library?** Use **`thiserror`** to define a structured, matchable error enum — your callers depend on knowing what failed.
> - **Application/binary?** Use **`anyhow`** to propagate any error with rich context — you just need to report failures well, not classify them.
>
> Many real projects use *both*: `thiserror` in the library crates, `anyhow` in the binary that ties them together. This single guideline resolves most "how should I handle errors?" questions. (Both crates work on the in-book playground, by the way — try them in a local project.)

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Choose thiserror for libraries and anyhow for applications">
  <style>
    .eh { font: 700 13px var(--font-sans); }
    .ec { font: 11.5px var(--font-sans); fill: var(--text-mute); }
    .em2 { font: 600 12px var(--font-mono); fill: var(--text); }
    .lib { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .app { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="20" width="290" height="120" rx="10" class="lib"/>
  <text x="36" y="46" class="eh" fill="var(--purple)">📚 Library → thiserror</text>
  <text x="36" y="72" class="ec">Callers need to MATCH on failures.</text>
  <text x="36" y="94" class="em2">#[derive(Error)] enum MyError {…}</text>
  <text x="36" y="120" class="ec">Structured, precise, zero-cost.</text>
  <rect x="330" y="20" width="290" height="120" rx="10" class="app"/>
  <text x="346" y="46" class="eh" fill="var(--rust-600)">🚀 Application → anyhow</text>
  <text x="346" y="72" class="ec">You just need to REPORT failures.</text>
  <text x="346" y="94" class="em2">fn main() -&gt; anyhow::Result&lt;()&gt;</text>
  <text x="346" y="120" class="ec">One error type + .context(…).</text>
</svg>
<figcaption>The community consensus: <b>thiserror</b> for library error types, <b>anyhow</b> for application error flow.</figcaption>
</figure>

## Summary

- A custom error is usually an **enum** with a variant per failure mode, implementing **`Display`** (human message) and **`std::error::Error`** (makes it a real error).
- Implement **`From`** for other error types so **`?`** can auto-convert them into yours.
- **`thiserror`** derives all that boilerplate — the standard for **library** error types that callers match on.
- **`anyhow`** gives applications one easy error type with **`.context(...)`** — the standard for **binaries** that just report failures.
- Rule of thumb: **`thiserror` for libraries, `anyhow` for applications** (and often both together).

> [!exercise] Try it yourself
> 1. Define a `enum MathError { DivByZero, Negative }`, implement `Display` and `Error`, and write `fn checked_sqrt(x: f64) -> Result<f64, MathError>`.
> 2. Add a `From<std::num::ParseIntError>` impl to an error enum and use `?` to parse inside a function returning it.
> 3. In a local project, `cargo add anyhow` and rewrite a function to return `anyhow::Result<T>` with `.context(...)` on a file read.

That completes error handling — you can now write robust Rust that fails gracefully. Next, we level up your ability to write *reusable* code with **generics, traits, and lifetimes**.
