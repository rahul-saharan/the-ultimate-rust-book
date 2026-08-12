<h1><span class="h1-kicker">Advanced Rust</span>Advanced Types</h1>

Rust's type system has a few more corners worth knowing — tools for clarity, safety, and expressing ideas the ordinary types can't. This chapter collects them: **type aliases** for readability, the **newtype pattern** for stronger typing, the mysterious **never type** `!`, **dynamically sized types**, and **`PhantomData`** for zero-cost type tagging. None are everyday tools, but recognizing them makes advanced code readable.

## Type aliases

A **type alias** gives an existing type a second name with `type`. Unlike a newtype, it's *not* a new type — just a synonym, fully interchangeable with the original:

```rust
type Kilometers = i32; // an alias, NOT a new type

fn main() {
    let distance: Kilometers = 5;
    let plain: i32 = 10;
    // Because Kilometers IS i32, they mix freely:
    println!("{}", distance + plain); // 15
}
```

Aliases shine at taming long, repetitive types:

```rust
// Without an alias, this type appears everywhere and is a mouthful:
type Thunk = Box<dyn Fn() + Send + 'static>;

fn main() {
    let f: Thunk = Box::new(|| println!("I'm a boxed closure"));
    f();
    // std uses this for `std::io::Result<T>` = Result<T, std::io::Error>
}
```

> [!tip] Alias vs. newtype
> Use a **type alias** (`type X = Y`) purely for *readability* — it's the same type, so it adds no safety. Use the **newtype pattern** (`struct X(Y)`) when you want a *distinct* type the compiler enforces. `type Meters = f64` lets you accidentally add meters to seconds; `struct Meters(f64)` does not.

### The `Result` alias — the one you'll write in every crate

Aliases can be **generic**, and that unlocks the single most common pattern in the ecosystem: a crate-wide `Result` that fixes the error type so you never repeat it:

```rust
use std::fmt;

#[derive(Debug)]
pub enum ConfigError {
    Missing(String),
    Invalid { key: String, reason: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing(k) => write!(f, "missing key `{k}`"),
            ConfigError::Invalid { key, reason } => write!(f, "bad value for `{key}`: {reason}"),
        }
    }
}

/// One generic alias, used by every function in the crate.
/// The error type is fixed; `T` still varies.
pub type Result<T> = std::result::Result<T, ConfigError>;

fn get(key: &str) -> Result<String> {          // instead of Result<String, ConfigError>
    match key {
        "host" => Ok("localhost".to_string()),
        _ => Err(ConfigError::Missing(key.to_string())),
    }
}

fn port() -> Result<u16> {                      // …and Result<u16, ConfigError>
    Err(ConfigError::Invalid { key: "port".into(), reason: "not a number".into() })
}

fn main() {
    println!("{:?}", get("host"));
    println!("{}", get("nope").unwrap_err());
    println!("{}", port().unwrap_err());
}
```

This is exactly how `std::io::Result<T>`, `serde_json::Result<T>`, and `anyhow::Result<T>` are defined — each is a one-line generic alias over the standard `Result`.

> [!mistake] Shadowing `Result` is deliberate, but say so
> Declaring `pub type Result<T> = …` **shadows** the prelude's `Result` inside your crate, which is the point — but it surprises readers who see a two-parameter `Result<T, E>` elsewhere and wonder why yours takes one. Two habits keep it civil: note it in your crate docs, and write the full path (`std::result::Result<T, E>`) on the rare occasion you need the original, as the alias definition itself does above.

## The never type `!`

Rust has a type that has **no values at all**, written `!` and called the **never type**. A function returning `!` never returns (it loops forever, panics, or exits). Its superpower: `!` **coerces to any other type**, which is what lets `continue`, `break`, `return`, and `panic!` appear in expressions of any type:

```rust
fn main() {
    let inputs = ["1", "2", "oops", "4"];
    let mut total = 0;

    for s in inputs {
        // Both match arms must have the same type (i32). `continue` has type `!`,
        // which coerces to i32 — so this type-checks:
        let n: i32 = match s.parse() {
            Ok(v) => v,
            Err(_) => continue, // type `!` → coerces to i32
        };
        total += n;
    }
    println!("total of the valid numbers: {total}"); // 1 + 2 + 4 = 7
}
```

> [!jargon] Why `!` is called "never"
> A value of type `!` can *never* exist — so an expression of type `!` represents computation that never produces a value (it diverges). Since it never yields anything, the compiler can safely pretend it's *any* type in context. That's why `let x: i32 = panic!()` compiles: `panic!()` has type `!`, coercible to `i32` (it just never actually returns one).

### Where `!` shows up without you noticing

You've been relying on the never type since chapter one. Because `!` coerces to *any* type, an expression that diverges can sit in a branch that's supposed to produce a value:

```rust
fn parse_or_die(text: &str) -> i32 {
    match text.parse::<i32>() {
        Ok(n) => n,
        // `panic!` has type `!`, which coerces to i32 — so both arms "return i32".
        Err(_) => panic!("not a number: {text}"),
    }
}

fn main() {
    println!("{}", parse_or_die("42"));

    // The same coercion makes all of these legal in value position:
    let x: i32 = if false { 1 } else { return };     // `return` is `!`
    println!("unreachable, but it compiles: {x}");
}
```

`panic!`, `return`, `break`, `continue`, `std::process::exit`, `todo!`, `unimplemented!`, and an infinite `loop {}` all have type `!`. That's why a `let … else` block must diverge, why `todo!()` can stand in for any return type while you're sketching, and why `match` arms that bail out don't break type-checking.

## Dynamically sized types (DSTs)

You met these in the [stack & heap chapter](#/ch/stack-heap): some types don't have a size known at compile time. The two you use constantly are **`str`** (a string of unknown length) and **`[T]`** (a slice of unknown length); trait objects **`dyn Trait`** are DSTs too.

> [!key] DSTs must live behind a pointer
> Because the compiler can't put an unsized value directly on the stack (it wouldn't know how many bytes to reserve), you always handle a DST *behind a pointer* that carries the missing size info: **`&str`**, **`Box<str>`**, **`&[T]`**, **`Box<dyn Trait>`**. That pointer is a *fat pointer* — it stores the address plus the length (for slices/str) or a vtable (for `dyn`). This is why you write `&str`, never bare `str`.

The marker trait **`Sized`** flags types with a known compile-time size (almost everything). Generic functions implicitly require `T: Sized`; to accept a DST, you relax it with the special `?Sized` bound:

```rust
// `?Sized` means "T might be unsized" — so this accepts &str, &[u8], etc.
fn print_it<T: std::fmt::Display + ?Sized>(value: &T) {
    println!("{value}");
}

fn main() {
    print_it("a string slice (unsized str behind &)");
    print_it(&42);
}
```

## `PhantomData`: zero-cost type tags

Sometimes you want a type parameter for *compile-time* purposes without actually storing a value of it. **`PhantomData<T>`** is a zero-sized marker that tells the compiler "pretend I hold a `T`" — useful for type-safe wrappers, units, and state-machine types:

```rust
use std::marker::PhantomData;

struct Meters;
struct Feet;

// A distance tagged with its unit at the type level — but the tag stores nothing.
struct Distance<Unit> {
    value: f64,
    _unit: PhantomData<Unit>,
}

impl<Unit> Distance<Unit> {
    fn new(value: f64) -> Self {
        Distance { value, _unit: PhantomData }
    }
}

fn main() {
    let a: Distance<Meters> = Distance::new(100.0);
    let b: Distance<Feet> = Distance::new(30.0);
    // The compiler treats Distance<Meters> and Distance<Feet> as different types,
    // so you can't accidentally mix them — at ZERO runtime cost (PhantomData is 0 bytes).
    println!("{}m and {}ft", a.value, b.value);
}
```

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="PhantomData adds a type-level tag that occupies zero bytes at runtime">
  <style>
    .atm { font: 600 12px var(--font-mono); fill: var(--text); }
    .atc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .real { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .phantom { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="24" class="atc">Distance&lt;Meters&gt; in memory:</text>
  <rect x="20" y="34" width="120" height="34" class="real"/><text x="34" y="56" class="atm">value: f64</text>
  <rect x="150" y="34" width="180" height="34" class="phantom"/><text x="164" y="56" class="atm">PhantomData&lt;Meters&gt;</text>
  <text x="345" y="56" class="atc">← 0 bytes! (only a compile-time tag)</text>
  <text x="20" y="104" class="atc">Same size as a bare f64 at runtime, but a distinct type the compiler won't let you mix.</text>
</svg>
<figcaption><code>PhantomData</code> carries type information the compiler enforces, while occupying no memory.</figcaption>
</figure>

## Summary

- A **type alias** (`type X = Y`) is a readability synonym — the *same* type; a **newtype** (`struct X(Y)`) is a *distinct* type that adds safety.
- The **never type `!`** is the type with no values, produced by diverging expressions (`panic!`, `continue`, `loop {}`); it **coerces to any type**, which is why those work in any context.
- **Dynamically sized types** (`str`, `[T]`, `dyn Trait`) have no compile-time size and must live behind a (fat) pointer like `&str` or `Box<dyn Trait>`; `Sized` marks known-size types and `?Sized` opts a generic into accepting DSTs.
- **`PhantomData<T>`** is a zero-sized marker that adds a compile-time type tag without storing data — for type-safe units, wrappers, and states.

> [!exercise] Try it yourself
> 1. Create `type Grid = Vec<Vec<i32>>;` and use it to declare and print a small 2D grid.
> 2. Write a function whose `Err` arm uses `panic!` and observe that the `Ok` and `Err` arms unify types thanks to `!`.
> 3. Make a `Tagged<State>` type with `PhantomData<State>` and two unit structs `Locked`/`Unlocked`, and write methods available only on one state.

Types describe data; the next chapter finishes advanced Rust with the callable side — **function pointers and returning closures**.
