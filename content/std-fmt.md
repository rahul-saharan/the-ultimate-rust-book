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

### The whole grammar, in order

Those pieces have a fixed order, and every one of them is optional:

<figure class="diagram">
<svg viewBox="0 0 640 268" role="img" aria-label="The format specification in order: argument, then colon, then fill, alignment, sign, alternate hash, zero flag, width, dot precision, and type, followed by the closing brace; with three worked examples">
  <style>
    .fs-h { font: 700 11px var(--font-sans); fill: var(--text-mute); }
    .fs-n { font: 600 10px var(--font-sans); fill: var(--text); }
    .fs-v { font: 9px var(--font-mono); fill: var(--text-mute); }
    .fs-m { font: 600 11.5px var(--font-mono); fill: var(--text); }
    .fs-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .fs-b { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .fs-a { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="16" class="fs-h">the order is fixed; every part is optional</text>
  <text x="20" y="46" class="fs-m">{</text>
  <rect x="30" y="30" width="62" height="22" rx="3" class="fs-a"/><text x="40" y="45" class="fs-n">argument</text>
  <text x="96" y="46" class="fs-m">:</text>
  <rect x="106" y="30" width="46" height="22" rx="3" class="fs-b"/><text x="118" y="45" class="fs-n">fill</text>
  <rect x="154" y="30" width="54" height="22" rx="3" class="fs-b"/><text x="162" y="45" class="fs-n">align</text>
  <rect x="210" y="30" width="46" height="22" rx="3" class="fs-b"/><text x="222" y="45" class="fs-n">sign</text>
  <rect x="258" y="30" width="30" height="22" rx="3" class="fs-b"/><text x="269" y="45" class="fs-m">#</text>
  <rect x="290" y="30" width="30" height="22" rx="3" class="fs-b"/><text x="301" y="45" class="fs-m">0</text>
  <rect x="322" y="30" width="52" height="22" rx="3" class="fs-b"/><text x="330" y="45" class="fs-n">width</text>
  <rect x="376" y="30" width="74" height="22" rx="3" class="fs-b"/><text x="384" y="45" class="fs-n">.precision</text>
  <rect x="452" y="30" width="46" height="22" rx="3" class="fs-b"/><text x="464" y="45" class="fs-n">type</text>
  <text x="502" y="46" class="fs-m">}</text>
  <text x="30" y="70" class="fs-v">name / 0,1,2 / empty</text>
  <text x="106" y="70" class="fs-v">any char</text>
  <text x="154" y="70" class="fs-v">&lt; ^ &gt;</text>
  <text x="210" y="70" class="fs-v">+</text>
  <text x="258" y="70" class="fs-v">alt</text>
  <text x="290" y="70" class="fs-v">pad</text>
  <text x="322" y="70" class="fs-v">N or N$</text>
  <text x="376" y="70" class="fs-v">.N .N$ .*</text>
  <text x="452" y="70" class="fs-v">? x b o e</text>
  <text x="20" y="104" class="fs-h">worked examples</text>
  <text x="20" y="128" class="fs-m">"{:&gt;8.2}"</text><text x="140" y="128" class="fs-c">with 3.14159 →</text><text x="250" y="128" class="fs-m">"    3.14"</text><text x="360" y="128" class="fs-c">width 8, right, 2 decimals</text>
  <text x="20" y="152" class="fs-m">"{:*^10}"</text><text x="140" y="152" class="fs-c">with "hi" →</text><text x="250" y="152" class="fs-m">"****hi****"</text><text x="360" y="152" class="fs-c">fill '*', centred</text>
  <text x="20" y="176" class="fs-m">"{:+08.2}"</text><text x="140" y="176" class="fs-c">with 3.14159 →</text><text x="250" y="176" class="fs-m">"+0003.14"</text><text x="360" y="176" class="fs-c">sign, zero-pad, precision</text>
  <text x="20" y="200" class="fs-m">"{:#010b}"</text><text x="140" y="200" class="fs-c">with 42 →</text><text x="250" y="200" class="fs-m">"0b00101010"</text><text x="360" y="200" class="fs-c">prefix counts toward width</text>
  <text x="20" y="224" class="fs-m">"{:&gt;w$.p$}"</text><text x="140" y="224" class="fs-c">w and p from args →</text><text x="290" y="224" class="fs-c">width and precision decided at runtime</text>
  <text x="20" y="250" class="fs-c">Fill without an alignment is ignored, so <tspan font-family="var(--font-mono)">{:*10}</tspan> is an error — write <tspan font-family="var(--font-mono)">{:*&gt;10}</tspan>.</text>
  <text x="20" y="264" class="fs-c">To print a literal brace, double it: <tspan font-family="var(--font-mono)">{{</tspan> and <tspan font-family="var(--font-mono)">}}</tspan>.</text>
</svg>
<figcaption>The format specification, left to right: argument, fill, alignment, sign, <code>#</code>, <code>0</code>, width, precision, type.</figcaption>
</figure>

```rust
fn main() {
    let v = 42;
    let pi = 3.14159265;
    let w = 12;
    let p = 3;

    // Every part of the spec, filled from arguments at runtime:
    println!("[{:>width$.prec$}]", pi, width = w, prec = p);
    println!("[{:>1$.2$}]", pi, w, p);                 // positional width/precision
    println!("[{:.*}]", 4, pi);                        // .* takes precision from the NEXT arg
    println!("[{:>w$}]", "hi", w = 6);
    println!("[{:-^w$}]", v, w = 9);                   // fill '-', centered

    // Escaping braces
    println!("{{literal braces}} around {v}");

    // Precision on a string TRUNCATES it
    println!("[{:.3}] [{:8.3}]", "truncated", "truncated");

    // Sign, alternate, zero-padding interact
    println!("[{:+}] [{:+.2}] [{:08.2}] [{:+08.2}]", v, pi, pi, pi);
    println!("[{:#b}] [{:#o}] [{:#x}] [{:#X}]", v, v, v, v);
    println!("[{:#010b}] [{:#06x}]", v, v);            // prefix counts toward the width
    println!("[{:e}] [{:E}] [{:.2e}]", 1234.5678, 1234.5678, 1234.5678);
}
```

```text
[       3.142]
[       3.142]
[3.1416]
[    hi]
[---42----]
{literal braces} around 42
[tru] [tru     ]
[+42] [+3.14] [00003.14] [+0003.14]
[0b101010] [0o52] [0x2a] [0x2A]
[0b00101010] [0x002a]
[1.2345678e3] [1.2345678E3] [1.23e3]
```

| Part | Written as | Notes |
|---|---|---|
| argument | `{}`, `{0}`, `{name}`, `{x}` (inline capture) | positional and named may be mixed; inline capture needs a variable of that name |
| fill | any character, **before** the alignment | ignored — in fact an error — without an alignment |
| alignment | `<` left, `^` centre, `>` right | default is left for most types, **right for numbers** |
| sign | `+` | forces a sign on positives; there is no `-` flag |
| alternate | `#` | `0x`/`0o`/`0b` prefixes, and pretty `{:#?}` |
| zero-pad | `0` | pads *after* the sign (`+0003.14`), unlike a fill character |
| width | `8`, `w$`, `1$` | a **minimum**; never truncates |
| precision | `.2`, `.p$`, `.*` | decimals for floats, **max length** for strings |
| type | none, `?`, `x`, `X`, `b`, `o`, `e`, `E`, `p` | `?` selects `Debug`; `x?`/`X?` give hex-formatted `Debug` |

> [!mistake] Width is a minimum; precision is what truncates
> `{:5}` on `"hello world"` prints all eleven characters — width never cuts anything off. If you want "at most 20 characters", that's *precision*: `{:.20}`. And the two combine as you'd hope: `{:20.20}` gives exactly twenty columns. On numbers, precision means decimal places instead, so the same spec means different things depending on what you pass — which is also why a custom `Display` impl has to decide which meaning applies to it.

> [!tip] Positional and named arguments
> Besides inline `{var}`, you can reference arguments by **position** (`{0} {1} {0}`) or by **name** (`{width}`), and even use an argument as the width/precision at runtime with `{:.*}` or `{:width$}`:
> ```rust
> fn main() {
>     let w = 10;
>     println!("{:>width$}", "hi", width = w); // right-align in a runtime width
>     println!("{0} {1} {0}", "a", "b");        // "a b a"
> }
> ```

### Numbers, floats, and the surprises

```rust
fn main() {
    // Float Display vs Debug differ for whole numbers
    let one = 1.0f64;
    println!("Display {} vs Debug {:?}", one, one);
    println!("0.1+0.2 = {} / {:?}", 0.1 + 0.2, 0.1 + 0.2);
    println!("halfway rounding: {:.0} {:.0} {:.0} {:.0}", 0.5, 1.5, 2.5, 3.5);
    println!("special: {} {} {} {:?}", f64::NAN, f64::INFINITY, -f64::INFINITY, f64::NAN);

    // Debug escapes strings and chars; Display doesn't
    println!("{:?} {:?} {:?}", "quote \" and \n newline", 'a', '\t');

    // Width applies to Display for &str -- but Debug for a str ignores it,
    // while Debug for a container passes it down to the INNER values.
    println!("Display [{:>10}] Debug [{:>10?}]", "ab", "ab");
    println!("Debug of Some: [{:>10?}] of a tuple: [{:>10?}]", Some(1), (1, 2));

    // Pretty Debug nests and adds trailing commas
    println!("{:#?}", vec![(1, "one")]);
}
```

```text
Display 1 vs Debug 1.0
0.1+0.2 = 0.30000000000000004 / 0.30000000000000004
halfway rounding: 0 2 2 4
special: NaN inf -inf NaN
"quote \" and \n newline" 'a' '\t'
Display [        ab] Debug ["ab"]
Debug of Some: [Some(         1)] of a tuple: [(         1,          2)]
[
    (
        1,
        "one",
    ),
]
```

Four things there are worth pinning down. **`1.0` prints as `1` under `Display` and `1.0` under `Debug`** — so `Debug` is the one that tells you a value is a float, which matters in logs. **`{:.0}` rounds half-to-even**: `0.5` and `2.5` both go *down* to an even digit, `1.5` and `3.5` go up. **`{}` on a float never lies about precision** — `0.1 + 0.2` prints all seventeen digits rather than a tidy `0.3`, because `Display` for floats prints the shortest string that round-trips back to the same bits. And **width behaves differently under `Debug`**: `&str`'s `Debug` ignores it entirely, while `Option`'s and tuples' `Debug` hand it down to each inner value, producing the strange `Some(         1)`. If you want a padded debug representation, format it first (`format!("{v:?}")`) and pad *that*.

> [!note] `std` has no thousands separators, no locales, and no currency
> There is no `{:,}` for `1,234,567`, no locale-aware decimal comma, and no currency formatting — deliberately, because those are locale policy rather than number formatting. Write a small helper (insert a separator every three digits from the right) or use `num-format`; for full internationalisation, `icu` is the serious answer. The same goes for dates, which is why `chrono`/`time` own that job as the [time chapter](#/ch/std-time) described.

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

### Honouring the caller's format spec

The `write!(f, …)` impl above works, but it quietly ignores everything the caller asked for: `{t:>12}` won't pad, `{t:.3}` won't change the decimals. That's because `write!` writes *through* the `Formatter` without consulting its flags. Reading them is the difference between a toy impl and one that behaves like a built-in type:

```rust
use std::fmt::{self, Write as _};

struct Tag(&'static str);

// Text-like value: f.pad does everything -- width, fill, alignment, and
// precision-as-truncation, exactly as &str behaves.
impl fmt::Display for Tag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.pad(&format!("#{}", self.0))
    }
}

struct Temp { c: f64 }

// Numeric value where precision means DECIMALS, so f.pad would double-apply it.
// Read the flags and lay the text out by hand.
impl fmt::Display for Temp {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let unit = if f.alternate() { " degrees Celsius" } else { "°C" };
        let text = format!("{:.*}{}", f.precision().unwrap_or(1), self.c, unit);
        let len = text.chars().count();
        match f.width() {
            Some(w) if w > len => {
                let pad = w - len;
                let (left, right) = match f.align().unwrap_or(fmt::Alignment::Right) {
                    fmt::Alignment::Left => (0, pad),
                    fmt::Alignment::Right => (pad, 0),
                    fmt::Alignment::Center => (pad / 2, pad - pad / 2),
                };
                for _ in 0..left { f.write_char(f.fill())?; }
                f.write_str(&text)?;
                for _ in 0..right { f.write_char(f.fill())?; }
                Ok(())
            }
            _ => f.write_str(&text),
        }
    }
}

fn main() {
    println!("pad: [{}] [{:>10}] [{:*^10}] [{:.4}]",
             Tag("rust"), Tag("rust"), Tag("rust"), Tag("rustacean"));
    let t = Temp { c: 21.567 };
    println!("manual: [{t}] [{t:>12}] [{t:*^12}] [{t:<12}]");
    println!("manual: precision [{t:.3}] alternate [{t:#}] both [{t:>24.2}]");
}
```

```text
pad: [#rust] [     #rust] [**#rust***] [#rus]
manual: [21.6°C] [      21.6°C] [***21.6°C***] [21.6°C      ]
manual: precision [21.567°C] alternate [21.6 degrees Celsius] both [                 21.57°C]
```

| `Formatter` method | Tells you / does |
|---|---|
| `f.pad(&str)` | applies width, fill, alignment **and precision-as-truncation** — the whole job, for text-like values |
| `f.write_str` / `f.write_char` / `write!(f, …)` | writes raw, honouring **nothing** |
| `f.width()` → `Option<usize>` | the requested minimum width |
| `f.precision()` → `Option<usize>` | decimals, or max length — your type decides which |
| `f.fill()` → `char`, `f.align()` → `Option<Alignment>` | for laying out padding yourself |
| `f.alternate()` → `bool` | the caller wrote `#` |
| `f.sign_plus()` / `f.sign_minus()` | the caller wrote `+` / `-` |
| `f.pad_integral(is_nonneg, prefix, digits)` | the numeric equivalent of `pad`: handles sign, `0x`-style prefix, and zero-padding |
| `f.debug_struct/tuple/list/set/map` | `Debug` builders that get `{:#?}` right for free |

> [!key] `f.pad` for text, `f.pad_integral` for numbers, by hand only if neither fits
> Almost every `Display` impl should end in one of the first two. `f.pad(&text)` makes your type respect `{:>10}` and `{:.5}` exactly like a `&str`; `f.pad_integral` does the same for integer-like types including the `#` prefix and `0` padding. Write the padding loop yourself only when *precision means something other than truncation* for your type — as with the temperature above, where it means decimal places. If your impl ignores the flags entirely, callers will discover it the day they try to line your values up in a column.

### `Debug` by hand, with the builders

Sometimes derived `Debug` is too noisy (a struct with a 4 KB buffer field) or too revealing (a password). Implement it yourself with the builders, which handle both `{:?}` and `{:#?}` for you:

```rust
use std::fmt;

struct Config { name: String, token: String, retries: u32 }

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Config")
            .field("name", &self.name)
            .field("token", &"<redacted>")      // never log secrets
            .field("retries", &self.retries)
            .finish()
    }
}

struct Ids(Vec<u32>);

impl fmt::Debug for Ids {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(self.0.iter()).finish()
    }
}

fn main() {
    let c = Config { name: "api".into(), token: "hunter2".into(), retries: 3 };
    println!("{c:?}");
    println!("{c:#?}");
    println!("{:?}", Ids(vec![1, 2, 3]));
}
```

```text
Config { name: "api", token: "<redacted>", retries: 3 }
Config {
    name: "api",
    token: "<redacted>",
    retries: 3,
}
[1, 2, 3]
```

> [!best] Hand-write `Debug` to redact secrets
> `#[derive(Debug)]` on a struct holding a password, API token, or session cookie means one stray `tracing::info!("{config:?}")` writes it to your logs — a real and common incident. Implement `Debug` with `debug_struct` and substitute `&"<redacted>"` for those fields, or wrap the value in a newtype whose `Debug` prints nothing useful. `finish_non_exhaustive()` adds a `..` when you're deliberately omitting fields.

## Beyond the macros: `format_args!` and `dbg!`

```rust
use std::fmt;

fn log(level: &str, args: fmt::Arguments<'_>) {
    println!("[{level}] {args}");          // no String was created by the caller
}

macro_rules! info {
    ($($arg:tt)*) => { log("info", format_args!($($arg)*)) };
}

fn main() {
    info!("user {} logged in after {:.1}s", "ana", 0.42);

    // dbg! prints file:line, the expression, and its value to stderr -- and
    // RETURNS the value, so it drops into an expression without restructuring it.
    let n = dbg!(2 + 3) * 10;
    println!("n = {n}");
}
```

```text
[info] user ana logged in after 0.4s
n = 50
```

(`dbg!` writes `[src/main.rs:16:13] 2 + 3 = 5` to **stderr**, so it doesn't appear in the stdout above — and the line number is naturally yours, not mine.)

| Tool | Use |
|---|---|
| `format_args!(…)` | build a `fmt::Arguments` and pass it on — **no allocation**, which is how every logging macro works |
| `write!(&mut s, …)` | format into an existing `String`/`Vec<u8>` instead of a fresh one |
| `dbg!(expr)` | print `file:line`, the expression source, and the `Debug` value to stderr; returns the value |
| `.to_string()` | free from any `Display` impl, via a blanket `ToString` |
| `{:?}` on `&dyn Error` / `anyhow::Error` | the report form — see [custom errors](#/ch/custom-errors) |

> [!performance] `format!` allocates; `format_args!` doesn't
> `format!` builds a new `String` every call, so `log(&format!("{x}"))` allocates even when the log level is disabled and the string is thrown away. Taking `fmt::Arguments` instead — via `format_args!` — defers the formatting to whoever actually writes it, which is why `log`/`tracing` macros are cheap when a level is off. The same reasoning applies inside `Display` impls: prefer `write!(f, …)` over building a `String` and writing that, unless you need `f.pad` (which needs the assembled text).

> [!best] Derive `Debug` everywhere; implement `Display` deliberately
> Put `#[derive(Debug)]` on essentially every struct and enum — it costs nothing and makes debugging, logging, and testing (`assert_eq!` prints values via `Debug`) vastly easier. Implement **`Display`** only for types with a meaningful user-facing string (errors, domain values like money or temperature, IDs). Implementing `Display` also gives you `.to_string()` for free (via a blanket impl).

## Summary

- The formatting macros (`format!`, `println!`, `write!`, …) share one `{}` mini-language and differ only in destination.
- The spec order is fixed: **argument, fill, align, sign, `#`, `0`, width, `.precision`, type** — all optional, with `{{`/`}}` to escape braces and `w$`/`.p$`/`.*` for runtime values.
- **Width is a minimum and never truncates; precision truncates strings and sets decimals on floats.** A fill character without an alignment is an error.
- Float quirks worth remembering: `1.0` is `1` under `Display` but `1.0` under `Debug`; `{:.0}` rounds **half-to-even**; `{}` prints the shortest round-tripping form, so `0.1+0.2` shows all its digits.
- `Debug` handles width inconsistently — ignored for `&str`, passed *inward* by `Option` and tuples — so pad `format!("{v:?}")` instead.
- **`Display`** (`{}`) is the user-facing format you **write by hand** (and it grants `.to_string()`); **`Debug`** (`{:?}`, `{:#?}`) is the developer format you **derive**.
- A `Display` impl that only calls `write!(f, …)` **ignores the caller's spec**. End with **`f.pad`** (text-like) or **`f.pad_integral`** (integer-like), and read `f.width()`/`f.precision()`/`f.alternate()` when neither fits.
- Hand-write `Debug` with **`f.debug_struct`/`debug_list`** to get `{:#?}` free — and to **redact secrets** that `#[derive(Debug)]` would happily log.
- **`format_args!` allocates nothing**, which is why logging macros take `fmt::Arguments`; `dbg!(expr)` prints `file:line` plus the value to stderr and returns the value.
- `std` has **no thousands separators, locales, or currency** — that's `num-format`/`icu` territory.

> [!exercise] Try it yourself
> 1. Print `1234.56789` with two decimals, zero-padded to width 12, and again in scientific notation (`{:e}`).
> 2. Print the number `3735928559` in hex with a `0x` prefix.
> 3. Implement `Display` for a `struct Money { cents: u64 }` that prints like `$12.34`.
> 4. Make that `Money` impl honour `{:>12}` and `{:*^12}` by ending in `f.pad`, and confirm three alignments line up in a column.
> 5. Print a table of ten rows with a runtime column width (`{:w$}`) computed from the longest value.
> 6. Write `fn commas(n: u64) -> String` that formats `1234567` as `1,234,567`, then compare your output with `{:?}` on the same number.
> 7. Implement `Debug` for a `Credentials { user, password }` that redacts the password, and prove `{:#?}` still indents correctly.
> 8. Write a `log!` macro that takes `format_args!` and only formats when a `LEVEL` constant is high enough — then check that a disabled call allocates nothing.

That completes the standard-library deep dive. `std` is powerful, but Rust's real reach comes from its ecosystem — next, we survey the **crates** every Rust developer should know, starting with how to choose them.
