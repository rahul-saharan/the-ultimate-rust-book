<h1><span class="h1-kicker">The Standard Library, Deep</span>String, str & Text Types</h1>

The [Strings chapter](#/ch/strings) covered UTF-8 and the `String`/`&str` split. This reference goes wider: the full family of text types (`String`, `str`, `OsString`, `CString`, `Cow`), the method cheat-sheet you'll use daily, and parsing. When you need to *do something* with text, the recipe is here.

## The text-type family

Rust has several string types because "text" means different things in different contexts. You'll use the first two constantly and the rest occasionally:

| Type | Owned/Borrowed | Encoding | Use for |
|------|----------------|----------|---------|
| `String` | owned | UTF-8 | growable text you own |
| `&str` | borrowed | UTF-8 | a view into text (params, literals) |
| `OsString` / `&OsStr` | owned / borrowed | OS-native | filenames/env from the OS (may not be UTF-8) |
| `CString` / `&CStr` | owned / borrowed | null-terminated bytes | passing strings to C ([FFI](#/ch/ffi)) |
| `Cow<str>` | either | UTF-8 | "borrow if possible, own only if I must" |
| `Box<str>` | owned | UTF-8 | a `String` with no spare capacity (compact) |

> [!key] The `String`/`&str` relationship is the pattern
> `String` : `&str` :: `PathBuf` : `&Path` :: `OsString` : `&OsStr` :: `Vec<T>` : `&[T]`. Every "owned vs borrowed" pair in Rust follows this shape — an owned, growable container and a borrowed view into it. Learn it once and all of std's type pairs make sense: **own to store and build, borrow to read and pass**.

## The everyday method cheat-sheet

```rust
fn main() {
    let s = "  Hello, World!  ";

    // Trimming & case
    println!("{:?}", s.trim());               // "Hello, World!"
    println!("{}", "MiXeD".to_lowercase());    // "mixed"
    println!("{}", "yell".to_uppercase());     // "YELL"

    // Searching
    println!("{}", s.contains("World"));        // true
    println!("{}", s.trim().starts_with("Hello")); // true
    println!("{:?}", s.find("World"));          // Some(9) — byte index

    // Replacing & splitting
    println!("{}", "a-b-c".replace('-', "/"));  // "a/b/c"
    let parts: Vec<&str> = "a,b,c".split(',').collect();
    println!("{parts:?}");                       // ["a", "b", "c"]
    println!("{}", parts.join(" + "));           // "a + b + c"

    // Building
    let joined = ["x", "y", "z"].concat();       // "xyz"
    println!("{joined}");
}
```

| Task | Method(s) |
|------|-----------|
| Remove whitespace | `trim`, `trim_start`, `trim_end` |
| Change case | `to_lowercase`, `to_uppercase` |
| Search | `contains`, `starts_with`, `ends_with`, `find`, `rfind` |
| Split | `split`, `splitn`, `split_whitespace`, `lines` |
| Join | `[..].join(sep)`, `[..].concat()` |
| Replace | `replace`, `replacen` |
| Slice by char | `.chars()`, `.char_indices()`, `.bytes()` |
| Length / empty | `.len()` (bytes!), `.is_empty()`, `.chars().count()` |
| Grow | `push`, `push_str`, `+`, `format!` |

## Parsing text into other types

The **`parse`** method (from the `FromStr` trait) turns text into numbers, booleans, IP addresses, and any type that implements `FromStr` — returning a `Result`:

```rust
use std::net::IpAddr;

fn main() {
    let n: i32 = "42".parse().unwrap();
    let pi: f64 = "3.14".parse().unwrap();
    let flag: bool = "true".parse().unwrap();
    let ip: IpAddr = "127.0.0.1".parse().unwrap();

    println!("{n} {pi} {flag} {ip}");

    // parse returns a Result, so handle failure properly:
    match "not a number".parse::<i32>() {
        Ok(v) => println!("got {v}"),
        Err(e) => println!("parse failed: {e}"),
    }
}
```

> [!tip] The target type drives `parse`
> `parse` is generic over its return type, so Rust needs to know what you want: annotate the binding (`let n: i32 = "5".parse()?`) or use the turbofish (`"5".parse::<i32>()`). Implement **`FromStr`** for your own type and it too gains `.parse()` for free — a clean way to build a value from a string.

## `Cow`: borrow when you can, own when you must

**`Cow`** (*clone-on-write*) is a clever type that holds *either* a borrow *or* an owned value. It lets a function avoid allocating in the common case (no change needed) while still being able to produce an owned result when it must modify:

```rust
use std::borrow::Cow;

// Returns the input unchanged (borrowed, no allocation) OR a fixed copy (owned):
fn sanitize(input: &str) -> Cow<str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_")) // had to change it → allocate
    } else {
        Cow::Borrowed(input)                 // already clean → no allocation!
    }
}

fn main() {
    println!("{}", sanitize("already_clean")); // borrowed — zero allocation
    println!("{}", sanitize("needs fixing"));  // owned — "needs_fixing"
}
```

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="Cow holds either a borrowed reference or an owned value, allocating only when needed">
  <style>
    .cwm { font: 600 12px var(--font-mono); fill: var(--text); }
    .cwc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bor2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .own2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="cwm">Cow&lt;str&gt; =</text>
  <rect x="120" y="12" width="230" height="34" rx="8" class="bor2"/><text x="134" y="34" class="cwm">Borrowed(&amp;str) — no allocation</text>
  <text x="360" y="34" class="cwc">(the common, cheap case)</text>
  <rect x="120" y="56" width="230" height="34" rx="8" class="own2"/><text x="134" y="78" class="cwm">Owned(String) — allocates</text>
  <text x="360" y="78" class="cwc">(only when it had to change)</text>
</svg>
<figcaption><code>Cow</code> avoids allocation when no change is needed, yet can own a result when it is.</figcaption>
</figure>

> [!best] Use `Cow` for "usually unchanged" text APIs
> Functions like "escape this string if it has special characters" or "normalize this path" often leave the input untouched. Returning `Cow<str>` means the caller pays for an allocation **only** in the rare case a change was needed — otherwise it's a free borrow. It's a favorite optimization in parsing and text-processing libraries.

## Summary

- The text family follows the **owned/borrowed** pattern: `String`/`&str` (UTF-8, everyday), `OsString`/`OsStr` (OS-native, filenames), `CString`/`CStr` (C FFI), `Cow<str>` (borrow-or-own), `Box<str>` (compact owned).
- The daily toolkit: `trim`, case conversion, `contains`/`find`, `split`/`join`, `replace`, `chars`/`bytes`, `push_str`/`format!`.
- **`parse`** (via `FromStr`) converts text into numbers, bools, IPs, and your own types — returning a `Result`; the target type drives it.
- **`Cow<str>`** holds a borrow *or* an owned value, allocating only when a change is required — ideal for "usually unchanged" APIs.

> [!exercise] Try it yourself
> 1. Take `"  The Quick Brown Fox  "`, trim it, lowercase it, split into words, and join with `-`.
> 2. Parse `"3.5"`, `"100"`, and `"true"` into `f64`, `i32`, and `bool`, handling a bad input with `match`.
> 3. Write a `fn shout(s: &str) -> Cow<str>` that uppercases only if the string isn't already all-uppercase (borrowing otherwise).

Next in the reference: measuring and working with **time and durations**.
