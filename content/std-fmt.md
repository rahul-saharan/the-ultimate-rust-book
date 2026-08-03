<h1><span class="h1-kicker">The Standard Library, Deep</span>Formatting: Display, Debug & format!</h1>

You've used `println!` and `format!` since chapter one. This reference unpacks the formatting system behind them: the mini-language inside `{}`, the difference between `Display` and `Debug`, and how to implement custom formatting for your own types. It's a small syntax with a lot of power.

## The formatting macros

All the formatting macros share the same syntax; they differ only in *where* the output goes:

| Macro | Output goes to |
|-------|----------------|
| `format!` | a new `String` (returns it) |
| `println!` / `print!` | stdout (with/without newline) |
| `eprintln!` / `eprint!` | stderr |
| `write!` / `writeln!` | any `impl Write` (a file, a buffer) |

```rust
fn main() {
    let name = "Ferris";
    let count = 3;
    let s = format!("{name} has {count} friends"); // build a String
    println!("{s}");
    eprintln!("this line goes to stderr");
}
```

## The `{}` mini-language

Inside the braces you can name the value, pad it, align it, set precision, and choose a representation. The full form is `{name:fill alignment width.precision type}`:

```rust
fn main() {
    let pi = 3.14159265;

    println!("{pi:.2}", );           // "3.14"    — 2 decimal places
    println!("{:8.2}", pi);           // "    3.14" — width 8, right-aligned
    println!("{:<8}|", "left");        // "left    |" — left-align in width 8
    println!("{:>8}|", "right");       // "   right|" — right-align
    println!("{:^8}|", "mid");         // "  mid   |" — center
    println!("{:*^10}", "hi");         // "****hi****" — fill with '*'
    println!("{:+}", 42);              // "+42"      — always show sign
    println!("{:08.2}", pi);           // "00003.14" — zero-pad

    // Number bases:
    println!("{:b}", 255);             // "11111111" — binary
    println!("{:o}", 255);             // "377"      — octal
    println!("{:x} {:X}", 255, 255);   // "ff FF"    — hex (lower/upper)
    println!("{:#x}", 255);            // "0xff"     — with 0x prefix
}
```

| Spec | Effect | Example |
|------|--------|---------|
| `{:.N}` | N decimal places / max chars | `{:.2}` → `3.14` |
| `{:N}` | minimum width N | `{:5}` |
| `{:<}` `{:>}` `{:^}` | left / right / center align | `{:^10}` |
| `{:0N}` | zero-pad to width N | `{:08}` |
| `{:+}` | always show sign | `+42` |
| `{:b}` `{:o}` `{:x}` `{:e}` | binary / octal / hex / scientific | `{:x}` |
| `{:#…}` | "alternate" form (`0x`, pretty `{:#?}`) | `{:#x}` |

> [!tip] Positional and named arguments
> Besides inline `{var}`, you can reference arguments by **position** (`{0} {1} {0}`) or by **name** (`{width}`), and even use an argument as the width/precision at runtime with `{:.*}` or `{:width$}`:
> ```rust
> fn main() {
>     let w = 10;
>     println!("{:>width$}", "hi", width = w); // right-align in a runtime width
>     println!("{0} {1} {0}", "a", "b");        // "a b a"
> }
> ```

## `Display` vs `Debug`

Two traits control how a type is formatted, for two different audiences:

> [!key] `Display` is for users, `Debug` is for programmers
> - **`Display`** (`{}`) is a clean, human-facing representation — what you'd show an end user. There's no `#[derive]`; you write it yourself because only you know the "nice" format.
> - **`Debug`** (`{:?}`) is a developer-facing representation for debugging and logging — usually **derived** with `#[derive(Debug)]`. Use `{:#?}` for a pretty, indented version.
>
> A `String` shows its text via `Display` (`{}`) but shows quotes via `Debug` (`{:?}` → `"text"`). Derive `Debug` on nearly every type; implement `Display` only where a user-facing format makes sense.

```rust
#[derive(Debug)] // gives us {:?} for free
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 3, y: 4 };
    println!("{p:?}");   // Point { x: 3, y: 4 }  — Debug
    println!("{p:#?}");  // pretty multi-line Debug
    // println!("{p}");  // ❌ won't compile — no Display impl (see below)
}
```

## Implementing `Display` for your type

To make your type printable with `{}`, implement `Display` — write into the provided `Formatter` with `write!`:

```rust
use std::fmt;

struct Temperature {
    celsius: f64,
}

impl fmt::Display for Temperature {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        // Define the human-facing representation:
        write!(f, "{:.1}°C", self.celsius)
    }
}

fn main() {
    let t = Temperature { celsius: 21.567 };
    println!("It's {t} today.");            // "It's 21.6°C today."
    println!("Formatted: {}", format!("{t}"));
}
```

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="Display produces a clean user-facing string; Debug produces a developer-facing one">
  <style>
    .fmm { font: 600 12px var(--font-mono); fill: var(--text); }
    .fmc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .disp { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .dbg { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="20" y="24" width="290" height="80" rx="10" class="disp"/>
  <text x="36" y="48" class="fmm" fill="var(--green)">{}  →  Display</text>
  <text x="36" y="72" class="fmc">For USERS. Hand-written.</text>
  <text x="36" y="92" class="fmc">"21.6°C"</text>
  <rect x="330" y="24" width="290" height="80" rx="10" class="dbg"/>
  <text x="346" y="48" class="fmm" fill="var(--blue)">{:?} → Debug</text>
  <text x="346" y="72" class="fmc">For PROGRAMMERS. #[derive].</text>
  <text x="346" y="92" class="fmc">Temperature { celsius: 21.567 }</text>
</svg>
<figcaption>Two traits, two audiences: <code>Display</code> for polished user output, <code>Debug</code> for developer insight.</figcaption>
</figure>

> [!best] Derive `Debug` everywhere; implement `Display` deliberately
> Put `#[derive(Debug)]` on essentially every struct and enum — it costs nothing and makes debugging, logging, and testing (`assert_eq!` prints values via `Debug`) vastly easier. Implement **`Display`** only for types with a meaningful user-facing string (errors, domain values like money or temperature, IDs). Implementing `Display` also gives you `.to_string()` for free (via a blanket impl).

## Summary

- The formatting macros (`format!`, `println!`, `write!`, …) share one `{}` mini-language and differ only in destination.
- `{}` supports **width, alignment, fill, precision, sign, and bases** (`{:.2}`, `{:^10}`, `{:08}`, `{:#x}`), plus **positional/named** args and runtime widths.
- **`Display`** (`{}`) is the clean, user-facing format you **write by hand**; **`Debug`** (`{:?}`, `{:#?}`) is the developer format you **derive**.
- Implement `Display` by writing into the `Formatter` with `write!`; it also grants `.to_string()`.
- **Derive `Debug` on nearly everything**; add `Display` only where a human-readable representation is meaningful.

> [!exercise] Try it yourself
> 1. Print `1234.56789` with two decimals, zero-padded to width 12, and again in scientific notation (`{:e}`).
> 2. Print the number `3735928559` in hex with a `0x` prefix.
> 3. Implement `Display` for a `struct Money { cents: u64 }` that prints like `$12.34`.

That completes the standard-library deep dive. `std` is powerful, but Rust's real reach comes from its ecosystem — next, we survey the **crates** every Rust developer should know, starting with how to choose them.
