<h1><span class="h1-kicker">Rust Foundations</span>Variables & Mutability</h1>

In most languages, a variable is just a box you can put anything into, whenever you like. Rust takes a more thoughtful stance: by default, once you give a variable a value, that value **can't change**. This might sound restrictive, but it's one of the quiet superpowers that makes Rust code so reliable. Let's see why.

## Variables are immutable by default

You create a variable with the `let` keyword:

```rust
fn main() {
    let apples = 5;
    println!("I have {apples} apples.");
}
```

Now watch what happens if we try to change `apples`:

```rust,ignore
fn main() {
    let apples = 5;
    apples = 6; // ❌ error!
    println!("{apples}");
}
```

The compiler stops us with a famously clear message:

```text
error[E0384]: cannot assign twice to immutable variable `apples`
 --> src/main.rs:3:5
  |
2 |     let apples = 5;
  |         ------ first assignment to `apples`
3 |     apples = 6;
  |     ^^^^^^^^^^ cannot assign twice to immutable variable
help: consider making this binding mutable: `let mut apples = 5;`
```

> [!jargon] Immutable / mutable
> **Immutable** means "cannot be changed after it's set." **Mutable** means "can be changed." In Rust, values are immutable unless you explicitly ask for the opposite. (Notice the compiler even told you exactly how to fix it — Rust's error messages are like a helpful colleague.)

> [!key] Why default to immutable?
> When a value can't change out from under you, whole classes of bugs vanish — you never have to wonder "who modified this, and when?" It also lets the compiler optimize more aggressively and makes multithreaded code safe. **Immutability is a feature, not a limitation.**

## Making a variable mutable with `mut`

When you genuinely need to change a value, opt in with `mut`:

```rust
fn main() {
    let mut score = 0;
    println!("Starting score: {score}");

    score = 10;
    score += 5;
    println!("Final score: {score}");
}
```

That single `mut` keyword documents your intent — anyone reading the code instantly sees "this value is expected to change."

> [!best] Reach for `mut` only when you mean it
> Start every variable immutable. Add `mut` the moment the compiler (or your logic) tells you the value must change. This habit keeps most of your program's state predictable and makes the parts that *do* change stand out clearly.

## Constants

A **constant** is a value that is bound to a name and can *never* be mutable — not even with `mut`. You declare one with `const` instead of `let`, you **must** annotate its type, and by convention you name it in `SCREAMING_SNAKE_CASE`:

```rust
fn main() {
    const MAX_PLAYERS: u32 = 100_000;
    const PI: f64 = 3.14159;
    println!("Up to {MAX_PLAYERS} players; pi ≈ {PI}");
}
```

Constants differ from immutable `let` bindings in three ways:

| | `const` | immutable `let` |
|---|---------|-----------------|
| Type annotation | **Required** | Optional (inferred) |
| Can use `mut`? | Never | Never |
| Computed when? | **At compile time** | At run time |
| Where allowed? | Anywhere, even outside functions | Inside a function/block |

> [!tip] Use constants for the "magic numbers" of your program
> Any fixed value with meaning — a maximum, a conversion factor, a URL — deserves a named `const`. `const SECONDS_PER_DAY: u32 = 60 * 60 * 24;` is far clearer than seeing `86400` scattered through your code, and you can change it in one place.

### `const` vs `static`

Rust has a second kind of global, and the difference is *where the value lives*:

```rust
const MAX_RETRIES: u32 = 3;          // inlined at each use site
static APP_NAME: &str = "rustbook";  // one fixed memory location

fn main() {
    println!("{APP_NAME} retries up to {MAX_RETRIES} times");

    // A `static` has a real address you can take; a `const` does not
    // (it has no single location — it's copied in wherever it appears).
    println!("APP_NAME lives at {:p}", &APP_NAME);

    // Both are usable in a const context, e.g. an array length:
    let attempts = [0u8; MAX_RETRIES as usize];
    println!("tracking {} attempts", attempts.len());
}
```

| | `const` | `static` |
|---|---|---|
| Storage | **inlined** — copied into every use site | **one fixed address** for the whole program |
| Can take `&` of it? | not meaningfully | yes, and it's `'static` |
| Mutable version? | never | `static mut`, which needs `unsafe` — [avoid it](#/ch/unsafe) |
| Use for | plain values: limits, conversion factors | large data, or when identity/address matters |

Default to **`const`**. Reach for `static` when the value is large enough that copying it everywhere would bloat the binary, or when you need a stable address. For mutable global state, use neither — use an atomic, a `Mutex`, or [`OnceLock`/`LazyLock`](#/ch/lazy-statics).

## Shadowing: reuse a name with a fresh value

Rust lets you declare a **new** variable with the same name as a previous one. The new declaration *shadows* (hides) the old one. This isn't mutation — it's creating a brand-new variable that happens to reuse the name:

```rust
fn main() {
    let x = 5;
    let x = x + 1;      // a new x, shadowing the old; value is 6
    let x = x * 2;      // another new x; value is 12
    println!("x is {x}"); // 12
}
```

The key difference from `mut` is that shadowing creates a genuinely new binding, so **you can even change the type**:

```rust
fn main() {
    let spaces = "   ";        // spaces is a string (&str)
    let spaces = spaces.len(); // a NEW spaces — now a number (usize)!
    println!("There were {spaces} spaces.");
}
```

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="Shadowing creates new bindings while mut reuses one binding">
  <style>
    .t-sh { font: 600 13px var(--font-sans); fill: var(--text); }
    .m-sh { font: 600 12px var(--font-mono); fill: var(--text); }
    .cap-sh { font: 12px var(--font-sans); fill: var(--text-mute); }
    .box-sh { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .newbox-sh { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="t-sh" fill="var(--purple)">Shadowing — 3 separate bindings</text>
  <rect x="20" y="30" width="90" height="30" class="newbox-sh"/><text x="35" y="50" class="m-sh">x = 5</text>
  <rect x="130" y="30" width="90" height="30" class="newbox-sh"/><text x="140" y="50" class="m-sh">x = 6</text>
  <rect x="240" y="30" width="90" height="30" class="newbox-sh"/><text x="250" y="50" class="m-sh">x = 12</text>
  <text x="20" y="80" class="cap-sh">Each `let x` builds a new box. Type may change.</text>
  <text x="20" y="130" class="t-sh" fill="var(--blue)">mut — one binding, changed in place</text>
  <rect x="20" y="140" width="90" height="30" class="box-sh"/><text x="30" y="160" class="m-sh">x: 5→6→12</text>
  <text x="130" y="160" class="cap-sh">One box, overwritten. Type is fixed.</text>
</svg>
<figcaption><b>Shadowing</b> makes new variables that reuse a name; <b>mut</b> changes one variable in place.</figcaption>
</figure>

> [!mistake] Shadowing is not the same as `mut`
> With `mut`, the type is locked in: `let mut spaces = "   "; spaces = spaces.len();` **fails**, because you can't put a number into a string variable. Shadowing works because `let spaces = ...` creates a *new* variable. Use shadowing when you want to transform a value into a new form (often a new type); use `mut` when you're updating the same value over time.

## Scope: where a variable lives

A variable exists from its `let` until the end of the enclosing **block** (`{ … }`), and shadowing respects those boundaries — a shadow inside a block disappears with the block:

```rust
fn main() {
    let x = 5;

    {
        // A new scope. This `x` shadows the outer one, but only in here.
        let x = x * 10;
        println!("inner x = {x}");   // 50
    }

    println!("outer x = {x}");        // 5 — the inner shadow is gone

    // Blocks are expressions, so they can produce a value:
    let label = {
        let score = 87;
        if score >= 80 { "pass" } else { "fail" }
    };
    println!("label = {label}");
    // `score` no longer exists here — it ended with the block.
}
```

This is more than a naming rule: when a variable goes out of scope, its value is **dropped** and any heap memory it owns is freed. That's the foundation the whole [ownership](#/ch/ownership) chapter builds on.

## Two smaller things you'll hit immediately

```rust
fn main() {
    // 1. Deferred initialization — declare now, assign once later.
    //    The compiler verifies it's always set before it's read.
    let verdict;
    let temperature = 30;
    if temperature > 25 {
        verdict = "warm";
    } else {
        verdict = "cool";
    }
    println!("it is {verdict}");

    // 2. An underscore prefix silences the "unused variable" warning
    //    when a name exists for documentation, or to satisfy a pattern.
    let _unused_for_now = compute();
    let (_, second) = (1, 2);
    println!("second = {second}");
}

fn compute() -> i32 { 42 }
```

> [!mistake] `let x;` without a later assignment, or with two
> Deferred initialization is allowed, but the compiler is strict about it: reading `x` on a path where it was never assigned is `error[E0381]: used binding is possibly-uninitialized`, and assigning twice to a non-`mut` binding is `error[E0384]: cannot assign twice to immutable variable`. Both are the same guarantee in different clothes — an immutable binding gets exactly one value, on every path. There is no such thing as an uninitialized variable you can read in safe Rust.

## Summary

- Variables made with `let` are **immutable by default** — a deliberate design that prevents bugs.
- Opt into change with **`let mut`**; it signals intent and keeps mutable state visible.
- **`const`** defines compile-time constants that must have a type annotation and are named in `SCREAMING_SNAKE_CASE`.
- **Shadowing** (`let x = ...` again) creates a new variable with the same name and *can change the type* — different from `mut`, which reuses one binding of a fixed type.

> [!exercise] Try it yourself
> 1. Create an immutable `let`, try to reassign it, and read the compiler error. Then add `mut` to fix it.
> 2. Write `const FREEZING_F: f64 = 32.0;` and print it.
> 3. Use shadowing to take a string `let input = "42";`, then `let input = input.len();`, and print the length. Now try to do the same with `mut` instead and see why it fails.

Now that you can name values, let's explore what *kinds* of values Rust offers — its **data types**.
