<h1><span class="h1-kicker">The Crate Ecosystem</span>anyhow & thiserror in Depth</h1>

The [custom errors chapter](#/ch/custom-errors) introduced these two crates; this chapter is the practical deep-dive. Together, **anyhow** and **thiserror** are how virtually all modern Rust handles errors. The one-line rule — *thiserror for libraries, anyhow for applications* — is worth internalizing, and this chapter shows exactly how to wield each. (Both are on the in-book playground, so these examples run.)

## thiserror: structured errors for libraries

**thiserror** eliminates the boilerplate of custom error types. You declare an error `enum`, annotate each variant with a message, and it generates the `Display` and `Error` implementations — plus `From` conversions via `#[from]`:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum DataError {
    #[error("record {0} was not found")]
    NotFound(u32),

    #[error("invalid field '{field}': {reason}")]
    Invalid { field: String, reason: String },

    // #[from] auto-generates From<ParseIntError> AND chains the source error:
    #[error("failed to parse a number")]
    Parse(#[from] std::num::ParseIntError),
}

fn lookup(id: &str) -> Result<u32, DataError> {
    let id: u32 = id.parse()?; // ParseIntError auto-converts to DataError::Parse
    if id == 0 {
        return Err(DataError::NotFound(id));
    }
    if id > 100 {
        return Err(DataError::Invalid { field: "id".into(), reason: "too large".into() });
    }
    Ok(id * 10)
}

fn main() {
    for input in ["5", "0", "999", "abc"] {
        match lookup(input) {
            Ok(v) => println!("'{input}' -> {v}"),
            Err(e) => println!("'{input}' -> error: {e}"),
        }
    }
}
```

> [!key] Why libraries want a structured error type
> A **library** returns errors to *other code* that may need to react differently to each failure ("if it's `NotFound`, return a 404; if it's `Parse`, log and retry"). So a library should expose a precise **enum** callers can `match` on. thiserror gives you that with almost no boilerplate — the `#[error("...")]` messages become `Display`, and `#[from]` wires up `?` conversions. Zero runtime cost, full structure.

The `#[error("...")]` format strings can reference tuple fields (`{0}`) and named fields (`{field}`), and `#[from]` on a field both generates the `From` impl and records that error as the *source* (so error chains print nicely).

## anyhow: easy errors for applications

**anyhow** takes the opposite stance: in an *application*, you usually don't need callers to distinguish error kinds — you just want to propagate any error upward with helpful context and print it well. `anyhow::Result<T>` accepts *any* error via `?`, and `.context()` adds a human-readable layer:

```rust
use anyhow::{Context, Result, bail, ensure};

fn parse_port(raw: &str) -> Result<u16> {
    // Any error type auto-converts into anyhow::Error via `?`:
    let port: u16 = raw.parse()
        .with_context(|| format!("'{raw}' is not a valid port number"))?;

    // `ensure!` returns an error if a condition fails:
    ensure!(port >= 1024, "port {port} is reserved; use 1024 or higher");

    // `bail!` returns an error early:
    if port == 8080 {
        bail!("port 8080 is already taken");
    }
    Ok(port)
}

fn main() {
    for input in ["3000", "80", "8080", "abc"] {
        match parse_port(input) {
            Ok(p) => println!("'{input}' -> OK, port {p}"),
            Err(e) => println!("'{input}' -> {e}"),
        }
    }
}
```

anyhow's toolkit:

| Tool | Does |
|------|------|
| `anyhow::Result<T>` | shorthand for `Result<T, anyhow::Error>` |
| `?` | converts *any* error into `anyhow::Error` |
| `.context("...")` / `.with_context(\|\| ...)` | attach an explanatory layer |
| `bail!("...")` | return an error early (like `return Err(...)`) |
| `ensure!(cond, "...")` | return an error if the condition is false |
| `anyhow!("...")` | construct an ad-hoc error value |

> [!key] Context turns cryptic errors into a helpful story
> anyhow's `.context(...)` builds an **error chain**: the low-level cause plus your high-level explanation. A bare `No such file or directory` becomes:
> ```text
> Error: failed to load the user's config
> Caused by: No such file or directory (os error 2)
> ```
> Adding context at each layer as an error bubbles up produces a breadcrumb trail that makes debugging production failures dramatically easier — for a one-line effort per `?`.

### Printing an anyhow error properly

The chain only appears if you print it the right way — and the difference catches people out:

```rust
use anyhow::{Context, Result};

fn read_setting() -> Result<i32> {
    "not-a-number"
        .parse::<i32>()
        .context("parsing the `retries` setting")
        .context("loading application config")
}

fn main() {
    let err = read_setting().unwrap_err();

    println!("--- {{}}  (top layer only) ---");
    println!("{err}");

    println!("\n--- {{:#}}  (single line, all layers) ---");
    println!("{err:#}");

    println!("\n--- {{:?}}  (the report you want from main) ---");
    println!("{err:?}");
}
```

| Format | Produces |
|---|---|
| `{}` | just the outermost context — for a user-facing one-liner |
| `{:#}` | every layer joined with `: ` — good for a log line |
| `{:?}` | the full multi-line report with `Caused by:` — **and a backtrace if enabled** |

> [!tip] Return `anyhow::Result` from `main` and let it do the printing
> `fn main() -> anyhow::Result<()>` prints the `{:?}` report automatically and exits non-zero. That's the whole error-handling story for most CLIs:
> ```rust,ignore
> fn main() -> anyhow::Result<()> {
>     let config = load_config().context("starting up")?;
>     run(config)
> }
> ```
> Set `RUST_BACKTRACE=1` and the report gains a backtrace captured at the point the error was *created* — far more useful than one from where it was printed. This needs no code changes; anyhow captures it when the env var is set.

### Recovering a typed error from `anyhow`

The usual objection to `anyhow` is "I've thrown away the type." You haven't — it's erased from the *signature*, not destroyed. `downcast_ref` gets it back when you need to branch on one specific case:

```rust
use anyhow::{Context, Result};
use std::num::ParseIntError;

fn parse(raw: &str) -> Result<i32> {
    raw.parse::<i32>().context("parsing the input")
}

fn main() {
    let err = parse("abc").unwrap_err();

    // Ask: was the root cause a ParseIntError?
    if let Some(pe) = err.downcast_ref::<ParseIntError>() {
        println!("recovered the typed error: {pe}");
    }

    // Or walk the whole chain:
    for (i, cause) in err.chain().enumerate() {
        println!("  {i}: {cause}");
    }
}
```

> [!best] Use it as an escape hatch, not a design
> If you find yourself downcasting in more than one or two places, that's the signal your *application* has grown a genuine domain-error type — promote those cases to a `thiserror` enum and keep `anyhow` for the truly unexpected. A common mature shape is both at once: `thiserror` enums in the library layers, `anyhow` at the top of `main`, and `?` converting between them automatically.

## The decision, cemented

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="thiserror for libraries with structured errors; anyhow for applications that report errors">
  <style>
    .ath { font: 700 12px var(--font-sans); }
    .atm { font: 600 11px var(--font-mono); fill: var(--text); }
    .atc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .lib2 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .app2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="16" y="18" width="300" height="120" rx="10" class="lib2"/>
  <text x="30" y="42" class="ath" fill="var(--purple)">📚 Library → thiserror</text>
  <text x="30" y="66" class="atc">Callers need to MATCH on failures.</text>
  <text x="30" y="88" class="atm">#[derive(Error)] enum E { … }</text>
  <text x="30" y="110" class="atc">Structured, precise, matchable.</text>
  <text x="30" y="128" class="atc">Each variant a distinct, handleable case.</text>
  <rect x="330" y="18" width="296" height="120" rx="10" class="app2"/>
  <text x="344" y="42" class="ath" fill="var(--rust-600)">🚀 Application → anyhow</text>
  <text x="344" y="66" class="atc">You just need to REPORT failures.</text>
  <text x="344" y="88" class="atm">fn main() -> anyhow::Result<()></text>
  <text x="344" y="110" class="atc">One error type + .context(…).</text>
  <text x="344" y="128" class="atc">Bubble everything up with a good message.</text>
</svg>
<figcaption>The community consensus, one more time: <b>thiserror</b> in libraries, <b>anyhow</b> in binaries.</figcaption>
</figure>

> [!best] Use both together in a real project
> The mature pattern in a multi-crate project: your **library crates** define precise error enums with **thiserror**, and your top-level **binary** uses **anyhow** to collect errors from all of them, add context, and report to the user. thiserror errors implement `std::error::Error`, so anyhow swallows them via `?` automatically. Library authors get structure; application authors get ergonomics — no conflict.

> [!mistake] Don't put anyhow in a library's public API
> `anyhow::Error` is a great *application* error, but returning it from a **library's** public functions forces every caller to depend on anyhow and robs them of the ability to match specific failures. Keep library APIs returning a **concrete error type** (thiserror). Use anyhow *inside* application code and library internals, not on a library's public boundary.

## Summary

- **thiserror** derives `Display`, `Error`, and `From` for a structured error **enum** — the standard for **libraries** whose callers `match` on failures. Use `#[error("...")]` for messages and `#[from]` for `?` conversions.
- **anyhow** provides one catch-all `anyhow::Error` that absorbs any error via `?`, plus **`.context()`**, `bail!`, `ensure!`, and `anyhow!` — the standard for **applications** that report failures.
- **`.context()`** builds readable error chains (cause + explanation) — a huge debugging aid for little effort.
- Real projects use **both**: thiserror in library crates, anyhow in the binary; thiserror errors flow into anyhow via `?`.
- **Never** expose `anyhow::Error` in a library's public API — return a concrete type instead.

> [!exercise] Try it yourself
> 1. Define a thiserror `enum FileError` with `NotFound(String)` and a `#[from]` `std::io::Error` variant.
> 2. Write an anyhow function that parses two numbers and `.context()`s each parse with a helpful message.
> 3. Use `ensure!` and `bail!` to validate an input and observe the error messages.

Next: fetching data over HTTP from your programs with **reqwest**.
