<h1><span class="h1-kicker">Functional Rust</span>Closures</h1>

A **closure** is an anonymous function you can save in a variable or pass to another function — and, crucially, it can **capture** (remember and use) variables from the surrounding code where it's defined. Closures are everywhere in idiomatic Rust: sorting with a custom key, transforming iterators, handling events, spawning threads. They feel like magic at first; this chapter shows exactly how they work.

## Closure syntax

A closure's parameters go between vertical bars `| |`, followed by its body. Compare it to a regular function:

```rust
fn main() {
    // A function:
    fn add_one_fn(x: i32) -> i32 { x + 1 }

    // The same thing as a closure stored in a variable:
    let add_one = |x: i32| -> i32 { x + 1 };

    // Types are usually inferred, so it's normally this short:
    let add_one_short = |x| x + 1;

    println!("{}", add_one_fn(5));
    println!("{}", add_one(5));
    println!("{}", add_one_short(5));
}
```

> [!jargon] Closure
> A **closure** is an inline, unnamed function that can "close over" — capture — variables from its environment. That capturing ability is the key difference from a plain function, which can only use its parameters and globals.

## The superpower: capturing the environment

Here's what makes closures special. Unlike a function, a closure can *use variables from the scope around it* without them being passed as parameters:

```rust
fn main() {
    let multiplier = 3;

    // This closure captures `multiplier` from the surrounding scope:
    let multiply = |x| x * multiplier;

    println!("{}", multiply(5));  // 15
    println!("{}", multiply(10)); // 30
}
```

The closure "remembers" `multiplier`. A regular `fn` cannot do this — it has no access to the enclosing scope.

## How closures capture: three modes

A closure captures each variable in the *least intrusive* way that works — mirroring the ownership rules you already know: borrow immutably, borrow mutably, or take ownership.

<figure class="diagram">
<svg viewBox="0 0 640 175" role="img" aria-label="Closures capture by immutable reference, mutable reference, or by value">
  <style>
    .clh { font: 700 12px var(--font-sans); }
    .clm { font: 600 11px var(--font-mono); fill: var(--text); }
    .clc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .c1 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .c2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .c3 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="16" y="18" width="196" height="140" rx="10" class="c1"/>
  <text x="30" y="42" class="clh" fill="var(--green)">Borrow &amp; (Fn)</text>
  <text x="30" y="66" class="clc">Only reads a variable.</text>
  <text x="30" y="88" class="clm">let p = || println!("{s}");</text>
  <text x="30" y="118" class="clc">Can be called many times.</text>
  <text x="30" y="136" class="clc">Original stays usable.</text>
  <rect x="224" y="18" width="196" height="140" rx="10" class="c2"/>
  <text x="238" y="42" class="clh" fill="var(--blue)">Borrow &amp;mut (FnMut)</text>
  <text x="238" y="66" class="clc">Modifies a variable.</text>
  <text x="238" y="88" class="clm">let mut f = || v.push(1);</text>
  <text x="238" y="118" class="clc">Needs `mut` to call.</text>
  <text x="238" y="136" class="clc">Exclusive borrow while alive.</text>
  <rect x="432" y="18" width="192" height="140" rx="10" class="c3"/>
  <text x="446" y="42" class="clh" fill="var(--rust-600)">Move (FnOnce)</text>
  <text x="446" y="66" class="clc">Takes ownership.</text>
  <text x="446" y="88" class="clm">let c = move || drop(s);</text>
  <text x="446" y="118" class="clc">Great for threads.</text>
  <text x="446" y="136" class="clc">Original is moved away.</text>
</svg>
<figcaption>A closure borrows what it can and only takes ownership when it must — or when you force it with <code>move</code>.</figcaption>
</figure>

```rust
fn main() {
    // 1. Immutable borrow — just reads `name`:
    let name = String::from("Ferris");
    let greet = || println!("Hello, {name}!");
    greet();
    println!("{name} is still usable here"); // ✅ only borrowed

    // 2. Mutable borrow — changes `count`:
    let mut count = 0;
    let mut increment = || { count += 1; };
    increment();
    increment();
    println!("count = {count}"); // 2

    // 3. Move — takes ownership (essential for threads):
    let data = String::from("owned data");
    let consume = move || println!("I own: {data}");
    consume();
    // println!("{data}"); // ❌ data was moved into the closure
}
```

> [!tip] Use `move` to send data into threads
> The `move` keyword forces a closure to *take ownership* of everything it captures. You'll need it constantly when spawning threads (`thread::spawn(move || …)`), because the new thread might outlive the current function, so it can't borrow — it must own. We'll see this in the [threads chapter](#/ch/threads).

## The three closure traits: Fn, FnMut, FnOnce

Every closure automatically implements one or more of three traits, based on *how it uses* its captures. This is how functions declare what kind of closure they accept:

| Trait | The closure… | Can be called… |
|-------|--------------|----------------|
| **`FnOnce`** | consumes its captures (moves them out) | at least once |
| **`FnMut`** | mutably borrows its captures | many times, needs `mut` |
| **`Fn`** | only immutably borrows (or copies) | many times, freely |

They nest: every `Fn` is also `FnMut` and `FnOnce`; every `FnMut` is also `FnOnce`. So `Fn` is the most permissive to *require*, `FnOnce` the most permissive to *accept*.

```rust
// Accepts any closure that can be called (once is enough):
fn call_once<F: FnOnce() -> String>(f: F) -> String {
    f()
}

// Accepts a closure it can call repeatedly:
fn call_twice<F: Fn()>(f: F) {
    f();
    f();
}

fn main() {
    let owned = String::from("hi");
    println!("{}", call_once(move || owned)); // moves `owned` out — FnOnce

    let greeting = String::from("hello");
    call_twice(|| println!("{greeting}"));    // just reads — Fn
}
```

> [!key] You rarely name these traits yourself
> When you pass a closure to `map`, `filter`, `sort_by`, or `thread::spawn`, *those* functions specify the right bound (`Fn`, `FnMut`, or `FnOnce`); the compiler figures out which trait your closure satisfies and checks it fits. You mostly need to *understand* the traits to read signatures and decode the occasional error — you seldom write the bounds unless you're building your own higher-order function.

## Closures with iterators

The place you'll use closures most is with iterators, transforming collections declaratively:

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5, 6];

    let even_squares: Vec<i32> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0) // closure: keep evens
        .map(|&x| x * x)          // closure: square them
        .collect();

    println!("{even_squares:?}"); // [4, 16, 36]
}
```

That's a preview of the [next chapter](#/ch/iterators) — closures and iterators are a match made in heaven.

## Returning closures

A function can return a closure. Because each closure has a unique, unnameable type, you return it as `impl Fn(...)` (one concrete closure) or `Box<dyn Fn(...)>` (when the type must be dynamic):

```rust
// Returns a closure that adds `n` to its argument:
fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n // `move` so the returned closure owns `n`
}

fn main() {
    let add_five = make_adder(5);
    let add_ten = make_adder(10);
    println!("{}", add_five(100)); // 105
    println!("{}", add_ten(100));  // 110
}
```

> [!note] Closures vs. function pointers
> A plain function can be passed where a closure is expected (`fn` implements all three traits). And a closure that captures *nothing* can even coerce to a function pointer `fn(i32) -> i32`. So `[1,2,3].iter().map(|&x| double(x))` and `.map(double)` can both work. Closures are the more general tool; reach for a named `fn` when there's nothing to capture and a name aids clarity.

## Summary

- A **closure** is an anonymous function (`|args| body`) that can **capture** variables from its surrounding scope.
- It captures in the least-intrusive way: **immutable borrow**, **mutable borrow**, or **by value** — and **`move`** forces ownership (essential for threads).
- Closures implement **`Fn`** (reads), **`FnMut`** (mutates), and/or **`FnOnce`** (consumes); functions use these as bounds to say what they accept.
- You mostly *use* closures with higher-order functions (`map`, `filter`, `sort_by`, `spawn`) rather than naming the traits yourself.
- Return closures with **`impl Fn(...)`** or **`Box<dyn Fn(...)>`**.

> [!exercise] Try it yourself
> 1. Write a closure that captures a `Vec<i32>` and returns its sum; call it, then check whether the vector is still usable (and why).
> 2. Write `fn make_multiplier(factor: i32) -> impl Fn(i32) -> i32` and build a `triple` closure from it.
> 3. Use `sort_by_key` with a closure to sort `vec!["ccc", "a", "bb"]` by string length.

Closures are one half of Rust's functional toolkit. The other — and one of the most beautiful, efficient features in the language — is the **iterator**.
