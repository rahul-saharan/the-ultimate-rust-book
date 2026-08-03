<h1><span class="h1-kicker">Structuring Data</span>Pattern Matching & match</h1>

Pattern matching is where Rust feels like a superpower. The `match` expression compares a value against a series of **patterns** and runs the code for the first one that fits — a bit like a supercharged `switch` statement that can also *destructure* data (pull it apart into its pieces) and that the compiler forces you to make **exhaustive**. Combined with enums, it's the backbone of clean, correct Rust.

## `match`: the exhaustive switch

A `match` takes a value and a list of **arms**. Each arm is a `pattern => code` pair. Rust checks the patterns top to bottom and runs the first match:

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter,
}

fn value_in_cents(coin: &Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25,
    }
}

fn main() {
    println!("A dime is worth {} cents", value_in_cents(&Coin::Dime));
}
```

> [!key] `match` must be exhaustive
> You **must** handle every possible case — the compiler checks this. Delete the `Coin::Quarter` arm above and Rust refuses to compile: *"pattern `Quarter` not covered."* This is a feature, not a nuisance: when you later add a new coin, the compiler marches you to every `match` that needs updating. **Whole categories of "I forgot a case" bugs become impossible.**

Because `match` is an **expression**, every arm produces a value and the whole `match` evaluates to one:

```rust
fn main() {
    let dice = 4;
    let outcome = match dice {
        1 => "worst roll",
        6 => "best roll",
        _ => "somewhere in between",
    };
    println!("{outcome}");
}
```

## Binding to the data inside

When a pattern matches, it can **bind** the data inside a variant to a variable you name. This is how you extract values from enums:

```rust
#[derive(Debug)]
enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(radius) => 3.14159 * radius * radius, // bind the radius
        Shape::Rectangle(w, h) => w * h,                    // bind width & height
    }
}

fn main() {
    println!("{:.2}", area(&Shape::Circle(2.0)));
    println!("{:.2}", area(&Shape::Rectangle(3.0, 4.0)));
}
```

Matching on `Option<T>` is the everyday version of this — bind the value in `Some`, handle `None`:

```rust
fn increment(x: Option<i32>) -> Option<i32> {
    match x {
        Some(n) => Some(n + 1),
        None => None,
    }
}

fn main() {
    println!("{:?}", increment(Some(5))); // Some(6)
    println!("{:?}", increment(None));    // None
}
```

## The catch-all: `_` and named bindings

You don't always want to list every value. Use `_` as a wildcard for "anything else," or bind the leftover to a name if you need it:

```rust
fn main() {
    let dice = 9;
    match dice {
        3 => println!("move forward 3"),
        7 => println!("lucky seven!"),
        other => println!("move forward {other}"), // binds anything else
    }

    match dice {
        1 => println!("one"),
        _ => println!("not one — value ignored"), // _ = ignore the value
    }
}
```

## Powerful pattern features

Patterns can do far more than match a single value. Here's the toolbox you'll reach for constantly.

**Ranges** match a span of values with `..=`:

```rust
fn main() {
    let n = 7;
    match n {
        0 => println!("zero"),
        1..=5 => println!("small (1–5)"),
        6..=10 => println!("medium (6–10)"),
        _ => println!("large"),
    }
}
```

**Or-patterns** (`|`) match several possibilities in one arm, and **`@` bindings** capture the value while also testing it:

```rust
fn main() {
    let key = 'k';
    match key {
        'a' | 'e' | 'i' | 'o' | 'u' => println!("vowel"),
        c @ 'a'..='z' => println!("consonant '{c}'"), // bind AND range-test
        _ => println!("not a lowercase letter"),
    }
}
```

**Match guards** add an `if` condition to an arm for logic patterns alone can't express:

```rust
fn main() {
    let point = (0, -3);
    match point {
        (0, 0) => println!("at the origin"),
        (x, y) if x == y => println!("on the diagonal"),
        (0, y) => println!("on the y-axis at {y}"),
        (x, 0) => println!("on the x-axis at {x}"),
        (x, y) => println!("at ({x}, {y})"),
    }
}
```

**Destructuring** pulls structs and tuples apart directly in the pattern:

```rust
struct Point { x: i32, y: i32 }

fn main() {
    let p = Point { x: 0, y: 7 };
    match p {
        Point { x: 0, y } => println!("on the y-axis at {y}"),
        Point { x, y: 0 } => println!("on the x-axis at {x}"),
        Point { x, y } => println!("elsewhere at ({x}, {y})"),
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="A value flows through match arms top to bottom until one pattern fits">
  <style>
    .fm { font: 600 12px var(--font-mono); fill: var(--text); }
    .fc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .arm { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .hit { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
  </style>
  <rect x="20" y="20" width="120" height="34" rx="8" fill="var(--rust-100)" stroke="var(--rust-400)" stroke-width="1.5"/>
  <text x="34" y="42" class="fm">value = 7</text>
  <rect x="200" y="10" width="200" height="26" rx="6" class="arm"/><text x="212" y="28" class="fm">0 =&gt; …</text><text x="410" y="28" class="fc">no</text>
  <rect x="200" y="44" width="200" height="26" rx="6" class="arm"/><text x="212" y="62" class="fm">1..=5 =&gt; …</text><text x="410" y="62" class="fc">no</text>
  <rect x="200" y="78" width="200" height="26" rx="6" class="hit"/><text x="212" y="96" class="fm">6..=10 =&gt; …</text><text x="410" y="96" class="fc" fill="var(--green)">✓ match! run this</text>
  <rect x="200" y="112" width="200" height="26" rx="6" class="arm"/><text x="212" y="130" class="fm">_ =&gt; …</text><text x="410" y="130" class="fc">(skipped)</text>
  <path d="M140 37 C 170 37, 170 91, 198 91" stroke="var(--rust-500)" stroke-width="2" fill="none"/>
  <text x="20" y="165" class="fc">Arms are tested top to bottom; the FIRST matching pattern wins, and the rest are skipped.</text>
</svg>
<figcaption><code>match</code> tries each arm in order and runs the first whose pattern fits the value.</figcaption>
</figure>

## `if let`: match one pattern concisely

When you only care about *one* pattern and want to ignore the rest, a full `match` is verbose. `if let` is the shortcut:

```rust
fn main() {
    let config_max: Option<u8> = Some(3);

    // Verbose match…
    match config_max {
        Some(max) => println!("max is {max}"),
        None => {}
    }

    // …becomes a tidy if let:
    if let Some(max) = config_max {
        println!("max is {max}");
    } else {
        println!("no max configured");
    }
}
```

## `while let` and `let ... else`

**`while let`** keeps looping as long as a pattern matches — perfect for draining a collection:

```rust
fn main() {
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("popped {top}");
    }
}
```

**`let ... else`** binds a pattern or bails out — great for early returns that keep your happy path un-indented:

```rust
fn first_char_upper(s: &str) -> char {
    let Some(c) = s.chars().next() else {
        return '?'; // the pattern didn't match; must diverge (return/panic/break)
    };
    c.to_ascii_uppercase()
}

fn main() {
    println!("{}", first_char_upper("rust")); // R
    println!("{}", first_char_upper(""));     // ?
}
```

> [!best] Choose the lightest tool that fits
> Use **`match`** when you handle several cases (and want exhaustiveness). Use **`if let`** when you care about one case. Use **`while let`** to loop until a pattern stops matching. Use **`let ... else`** to extract-or-return. Reaching for the right one keeps code both correct and readable.

> [!tip] Patterns are everywhere
> Patterns aren't just for `match`. Every `let` uses one (`let (a, b) = pair;`), as do function parameters (`fn dist((x, y): (f64, f64))`) and `for` loops (`for (i, v) in iter.enumerate()`). Once you see patterns, you see them everywhere in Rust.

## Summary

- **`match`** compares a value to **patterns** top-to-bottom and runs the first fit; it must be **exhaustive**, so you can never forget a case.
- Patterns **bind** inner data (`Some(n)`, `Shape::Circle(r)`), so `match` both branches *and* extracts.
- Rich features: **`_`** wildcard, named catch-alls, **ranges** (`1..=5`), **or-patterns** (`|`), **`@` bindings**, and **guards** (`if …`).
- **Destructuring** pulls apart tuples and structs directly in patterns.
- **`if let`**, **`while let`**, and **`let … else`** are lighter tools for the common one-pattern cases.

> [!exercise] Try it yourself
> 1. Write a `match` over `Option<i32>` that prints the number doubled, or `"nothing"` for `None`.
> 2. Match an integer with ranges: `"negative"`, `"zero"`, `"small (1–9)"`, `"big"`. Add a guard for even vs. odd in the "big" case.
> 3. Rewrite a two-arm `match` on an `Option` as an `if let`/`else`. Then drain a `vec![…]` with `while let Some(x) = v.pop()`.

You can now define types (structs, enums) and inspect them (patterns). The last piece of modeling data is giving your types *behavior* — that's what **methods** do.
