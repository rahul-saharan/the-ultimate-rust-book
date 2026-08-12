<h1><span class="h1-kicker">Rust Foundations</span>Functions</h1>

Functions are how you name a piece of work so you can reuse it, test it, and reason about it in isolation. You've already met the most important one — `main` — and used `println!`. Now let's learn to write your own, and along the way meet a small but deep idea that shapes all of Rust: the difference between **statements** and **expressions**.

## Defining and calling functions

You define a function with the `fn` keyword. By convention, function names use `snake_case` (all lowercase, words joined by underscores):

```rust
fn main() {
    println!("Starting up…");
    greet();                 // call the function
    greet();                 // reuse it as often as you like
}

fn greet() {
    println!("Hello from a function! 🦀");
}
```

Notice that `greet` is defined *after* `main`, yet `main` can still call it. Rust doesn't care about the order you define functions — only that they exist somewhere in scope.

## Parameters: passing data in

**Parameters** are the named inputs a function accepts. In Rust you **must** declare the type of every parameter — this is a deliberate design choice that makes functions self-documenting and error messages precise:

```rust
fn main() {
    describe_temperature(-4);
    describe_temperature(25);
}

fn describe_temperature(celsius: i32) {
    if celsius < 0 {
        println!("{celsius}°C — freezing! 🥶");
    } else {
        println!("{celsius}°C — pleasant. 😊");
    }
}
```

Multiple parameters are separated by commas:

```rust
fn main() {
    print_label("apples", 5);
}

fn print_label(item: &str, count: u32) {
    println!("{count} × {item}");
}
```

> [!best] Always annotate parameters — it's not a burden, it's a gift
> Requiring parameter types means the compiler can check every call site and give you crystal-clear errors. It also means anyone reading the function signature instantly knows how to use it, without hunting through the body.

## Return values: passing data out

A function returns a value by declaring the return type after an arrow `->`. The returned value is usually the **last expression** in the body — with *no semicolon*:

```rust
fn main() {
    let sum = add(3, 4);
    println!("3 + 4 = {sum}");
}

fn add(a: i32, b: i32) -> i32 {
    a + b   // no semicolon — this is the return value
}
```

That missing semicolon is not a typo. To understand it, we need the central idea of this chapter.

## Statements vs. expressions

This distinction trips up newcomers, so let's make it vivid.

> [!key] The one rule to remember
> - A **statement** performs an action and returns **nothing** (`()`, the unit type). Example: `let x = 5;`
> - An **expression** evaluates to a **value**. Example: `5 + 3`, `add(1, 2)`, or even an entire `{ }` block.
>
> In Rust, **almost everything is an expression** — and that's what makes the language feel so composable.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="Statements do something and return nothing; expressions evaluate to a value">
  <style>
    .th { font: 700 13px var(--font-sans); }
    .mm { font: 600 12px var(--font-mono); fill: var(--text); }
    .cc { font: 12px var(--font-sans); fill: var(--text-mute); }
    .stmt { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .expr { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="20" width="280" height="130" rx="10" class="stmt"/>
  <text x="36" y="44" class="th" fill="var(--blue)">STATEMENT — does something</text>
  <text x="36" y="72" class="mm">let x = 5;</text>
  <text x="36" y="96" class="mm">let y = 6;</text>
  <text x="36" y="130" class="cc">Ends in ; · evaluates to () · can't</text>
  <text x="36" y="146" class="cc">be assigned: let a = (let b = 1); ❌</text>
  <rect x="340" y="20" width="280" height="130" rx="10" class="expr"/>
  <text x="356" y="44" class="th" fill="var(--rust-600)">EXPRESSION — becomes a value</text>
  <text x="356" y="72" class="mm">5 + 6</text>
  <text x="356" y="96" class="mm">add(1, 2)</text>
  <text x="356" y="120" class="mm">{ let t = 5; t + 1 }</text>
  <text x="356" y="146" class="cc">No trailing ; · has a value you can use</text>
</svg>
<figcaption>Adding a <b>semicolon</b> turns an expression into a statement — throwing its value away.</figcaption>
</figure>

A block `{ }` is an expression too: it evaluates to its last expression. This is idiomatic Rust:

```rust
fn main() {
    let y = {
        let x = 3;
        x + 1        // no semicolon → the block evaluates to 4
    };
    println!("y is {y}"); // 4
}
```

Because blocks are expressions, `if` can produce a value, and so can a function body. That's why `add` ends in `a + b` with no semicolon — the block *is* the return value.

> [!mistake] The accidental semicolon
> This is the #1 beginner error in Rust:
> ```rust,ignore
> fn add(a: i32, b: i32) -> i32 {
>     a + b;   // ❌ the ; makes this a statement returning ()
> }
> // error[E0308]: mismatched types — expected `i32`, found `()`
> ```
> The semicolon discarded the value, so the function returns `()` instead of an `i32`. **Remove the semicolon** on the final line you want to return.

### Early returns with `return`

You *can* return early from anywhere in a function with the `return` keyword — handy for guard clauses:

```rust
fn main() {
    println!("{}", classify(0));
    println!("{}", classify(7));
}

fn classify(n: i32) -> &'static str {
    if n == 0 {
        return "zero"; // early return
    }
    if n > 0 { "positive" } else { "negative" } // final expression
}
```

> [!tip] Idiomatic Rust prefers the final expression
> Use an explicit `return` for early exits (guard clauses at the top of a function). For the normal result, let the last expression be the return value — it reads more cleanly and is the style you'll see across the ecosystem.

## Returning several values

Rust functions return exactly one value — but that value can be a **tuple**, which the caller destructures. This is the idiomatic way to hand back two or three related results:

```rust
/// Returns the minimum, maximum, and sum in one pass.
fn stats(numbers: &[i32]) -> (i32, i32, i32) {
    let mut min = numbers[0];
    let mut max = numbers[0];
    let mut sum = 0;
    for &n in numbers {
        if n < min { min = n; }
        if n > max { max = n; }
        sum += n;
    }
    (min, max, sum) // one tuple, three values
}

fn main() {
    let (low, high, total) = stats(&[3, 9, 1, 7]);
    println!("min={low} max={high} sum={total}");
}
```

Once you're returning more than about three values, or the meaning of each isn't obvious from position, return a [struct](#/ch/structs) instead — `report.max` beats `report.1`.

## Three smaller facts worth knowing

```rust
fn main() {
    // 1. Functions can be NESTED — useful for a helper only one function needs.
    fn outer(n: i32) -> i32 {
        fn double(x: i32) -> i32 { x * 2 }  // private to `outer`'s scope
        double(n) + 1
    }
    println!("{}", outer(5));

    // 2. A function with no `->` returns the unit type `()`.
    fn log(msg: &str) { println!("log: {msg}"); }
    let nothing: () = log("these are equivalent");
    println!("returned {nothing:?}");

    // 3. Functions are VALUES — you can pass one where a function is expected.
    fn square(x: i32) -> i32 { x * x }
    let numbers = [1, 2, 3, 4];
    let squares: Vec<i32> = numbers.iter().map(|&x| square(x)).collect();
    println!("{squares:?}");

    // …or store one in a variable, typed as a function pointer:
    let operation: fn(i32) -> i32 = square;
    println!("{}", operation(9));
}
```

That third point opens a door: functions and [closures](#/ch/closures) are interchangeable in most APIs, and [Function Pointers & Returning Closures](#/ch/advanced-functions) covers the `fn` / `Fn` / `FnMut` / `FnOnce` distinction properly.

> [!note] Functions that never return: the `!` type
> A function annotated `-> !` promises it will *never* hand control back — it loops forever, exits the process, or panics:
> ```rust,ignore
> fn fatal(msg: &str) -> ! {
>     eprintln!("fatal: {msg}");
>     std::process::exit(1);
> }
> ```
> `!` is the **never type**, and because it has no values it can stand in for *any* type — which is why `panic!()` and `return` are legal in a branch that's supposed to produce an `i32`. You saw this with `let … else`, whose `else` block must diverge. See [Advanced Types](#/ch/advanced-types).

## Summary

- Define functions with **`fn`**, name them in `snake_case`, and call them regardless of definition order.
- Every **parameter must have a type annotation** — this makes functions self-documenting and errors precise.
- Declare a return type with **`-> Type`**; the **last expression** (no semicolon) is what's returned.
- **Statements** do something and return `()`; **expressions** evaluate to a value — and blocks, `if`, and function bodies are all expressions.
- A stray **semicolon** on the last line silently changes the return value to `()` — the classic beginner bug.

> [!exercise] Try it yourself
> 1. Write `fn square(n: i32) -> i32` that returns `n * n`. Deliberately add a semicolon after `n * n` and read the error.
> 2. Write `fn celsius_to_fahrenheit(c: f64) -> f64` (the formula is `c * 9.0 / 5.0 + 32.0`) and print a few conversions.
> 3. Assign the result of a block expression to a variable: `let z = { let a = 2; let b = 3; a * b };` and print `z`.

Functions run top to bottom — but real programs need to make decisions and repeat work. Next: **control flow**.
