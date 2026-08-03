<h1><span class="h1-kicker">Error Handling</span>Recoverable Errors: Result & Option</h1>

Most errors aren't bugs — they're just *life*. A file might not exist. A user might type "banana" where you wanted a number. A server might be briefly unreachable. These are **recoverable** errors: expected situations your program should handle gracefully, not crash on. Rust models them not with exceptions, but with two ordinary enums baked into the type system — **`Result`** and **`Option`** — and the result (pun intended) is error handling that's impossible to forget.

## `Result`: success or failure, in the type

Any operation that can fail returns a **`Result<T, E>`** — an enum with two variants:

```rust,ignore
enum Result<T, E> {
    Ok(T),   // success, carrying a value of type T
    Err(E),  // failure, carrying an error of type E
}
```

Because the *possibility of failure is right there in the return type*, you can't accidentally ignore it. Here's parsing a string into a number, which might fail:

```rust
fn main() {
    let good: Result<i32, _> = "42".parse();
    let bad: Result<i32, _> = "oops".parse();

    println!("{good:?}"); // Ok(42)
    println!("{bad:?}");  // Err(ParseIntError { .. })
}
```

## Handling a `Result` with `match`

The most explicit way to deal with a `Result` is `match` — you handle success and failure side by side:

```rust
fn main() {
    let input = "57";

    match input.parse::<i32>() {
        Ok(number) => println!("Success! Doubled: {}", number * 2),
        Err(error) => println!("Couldn't parse '{input}': {error}"),
    }
}
```

> [!key] Errors as values, not exceptions
> In many languages an error *throws* — it invisibly jumps out of your function and can appear anywhere, so you're never quite sure what might fail. In Rust an error is just a **return value**. Failure is visible in the function's signature, checked by the compiler, and handled with the same tools as any other value. No hidden control flow, no forgotten `catch`.

## `Option`: present or absent

You met `Option<T>` with enums — it's `Result`'s sibling for when something might simply be *missing*, with no error to report:

```rust,ignore
enum Option<T> {
    Some(T), // there is a value
    None,    // there isn't
}
```

Use **`Result`** when a failure has a *reason* worth reporting (why did parsing fail?); use **`Option`** when absence needs no explanation (the list was empty; the key wasn't there):

```rust
fn main() {
    let numbers = vec![1, 2, 3];

    match numbers.first() { // returns Option<&i32>
        Some(first) => println!("first is {first}"),
        None => println!("the list is empty"),
    }
}
```

## The combinator toolkit — handling without `match`

Writing a full `match` for every fallible call gets tedious. Both `Option` and `Result` come with dozens of **combinators** (methods that transform or extract the value), letting you handle the common cases in a single expressive line.

```rust
fn main() {
    // unwrap_or: give a default on failure/absence
    let count: i32 = "not a number".parse().unwrap_or(0);
    println!("count = {count}"); // 0

    // map: transform the success value, leave errors untouched
    let doubled = "21".parse::<i32>().map(|n| n * 2);
    println!("{doubled:?}"); // Ok(42)

    // unwrap_or_else: compute the default lazily
    let value = "x".parse::<i32>().unwrap_or_else(|_| -1);
    println!("{value}"); // -1

    // is_ok / is_some: just ask
    println!("{}", "5".parse::<i32>().is_ok()); // true
}
```

Here are the combinators you'll use most (they exist on both `Option` and `Result`, with small naming differences):

| Method | Does |
|--------|------|
| `unwrap_or(default)` | Value, or `default` on `None`/`Err` |
| `unwrap_or_else(\|e\| …)` | Value, or a computed default |
| `unwrap_or_default()` | Value, or the type's default (`0`, `""`, …) |
| `map(\|v\| …)` | Transform the inner success value |
| `and_then(\|v\| …)` | Chain another fallible operation |
| `ok_or(err)` | Convert `Option` → `Result` |
| `ok()` | Convert `Result` → `Option` (discard the error) |
| `is_ok()` / `is_some()` | Boolean check |

> [!best] Prefer combinators and `match` over `.unwrap()`
> `.unwrap()` and `.expect()` extract the value but **panic** on failure — so they turn a *recoverable* error back into a *crash*, defeating the whole point. Save them for tests and quick prototypes. In real code, use `match`, `if let`, or combinators like `unwrap_or`, `map`, and `and_then`. The next chapter adds the **`?` operator**, which makes propagating errors upward beautifully concise.

## `if let` for the one case you care about

When you only want to act on success (or only on `Some`), `if let` is tidier than `match`:

```rust
fn main() {
    let config: Option<&str> = Some("dark-mode");

    if let Some(setting) = config {
        println!("Applying setting: {setting}");
    }

    // Combine with else for a fallback:
    let port: Result<u16, _> = "8080".parse();
    if let Ok(p) = port {
        println!("Listening on port {p}");
    } else {
        println!("Invalid port; using default 3000");
    }
}
```

## When to use which — the decision

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Decision guide: panic for bugs, Result for failures with reasons, Option for plain absence">
  <style>
    .dh { font: 600 12px var(--font-sans); fill: var(--text); }
    .dc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dm { font: 600 12px var(--font-mono); }
    .b1 { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .b2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .b3 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="dh">"Something might go wrong here." Which tool?</text>
  <rect x="20" y="40" width="195" height="130" rx="10" class="b1"/>
  <text x="34" y="64" class="dm" fill="var(--red)">panic! / unwrap</text>
  <text x="34" y="90" class="dc">The error means MY CODE</text>
  <text x="34" y="106" class="dc">IS WRONG (a bug).</text>
  <text x="34" y="130" class="dc">e.g. impossible state,</text>
  <text x="34" y="146" class="dc">broken invariant.</text>

  <rect x="225" y="40" width="195" height="130" rx="10" class="b2"/>
  <text x="239" y="64" class="dm" fill="var(--rust-600)">Result&lt;T, E&gt;</text>
  <text x="239" y="90" class="dc">Failure with a REASON</text>
  <text x="239" y="106" class="dc">the caller should handle.</text>
  <text x="239" y="130" class="dc">e.g. file missing, parse</text>
  <text x="239" y="146" class="dc">failed, network error.</text>

  <rect x="430" y="40" width="190" height="130" rx="10" class="b3"/>
  <text x="444" y="64" class="dm" fill="var(--blue)">Option&lt;T&gt;</text>
  <text x="444" y="90" class="dc">Plain ABSENCE, no</text>
  <text x="444" y="106" class="dc">reason needed.</text>
  <text x="444" y="130" class="dc">e.g. empty list, key not</text>
  <text x="444" y="146" class="dc">found, optional field.</text>
</svg>
<figcaption>Bug → <b>panic</b>. Failure worth explaining → <b>Result</b>. Simple "nothing here" → <b>Option</b>.</figcaption>
</figure>

## Summary

- **Recoverable** errors are modeled as **values**, not exceptions: **`Result<T, E>`** (`Ok`/`Err`) for failures, **`Option<T>`** (`Some`/`None`) for absence.
- Because failure is in the **return type**, the compiler ensures you can't silently ignore it — no hidden control flow.
- Handle them explicitly with **`match`**/**`if let`**, or concisely with **combinators** (`unwrap_or`, `map`, `and_then`, `ok_or`, …).
- Avoid **`.unwrap()`/`.expect()`** in real code — they turn recoverable errors into panics; keep them for tests and prototypes.
- Choose by intent: **panic** for bugs, **`Result`** for failures with a reason, **`Option`** for plain absence.

> [!exercise] Try it yourself
> 1. Write `fn safe_divide(a: f64, b: f64) -> Option<f64>` returning `None` when `b == 0.0`; handle both cases with `match`.
> 2. Parse `"123"` and `"abc"` into `i32`, using `unwrap_or(-1)` for each, and print the results.
> 3. Chain combinators: take `"20"`, `parse::<i32>()`, then `map(|n| n * 3)`, then `unwrap_or(0)`.

Handling errors with `match` everywhere can get verbose when one function calls another that calls another. Rust's answer is a single, elegant character: the **`?` operator**.
