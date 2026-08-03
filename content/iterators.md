<h1><span class="h1-kicker">Functional Rust</span>Iterators</h1>

Iterators are how Rust processes sequences — and they're a highlight of the language. They let you express "for each item, do this, keep those, add them up" as a clear, readable pipeline instead of a tangle of index loops. Best of all, they're a **zero-cost abstraction**: this elegant, high-level style compiles down to code as fast as a hand-written loop. Once iterators click, you'll write Rust in a whole new way.

## What an iterator is

An **iterator** is any type that produces a sequence of values, one at a time, on demand. The entire concept is captured by one small trait:

```rust,ignore
trait Iterator {
    type Item;                          // the type of thing produced
    fn next(&mut self) -> Option<Self::Item>; // give the next item, or None when done
}
```

That's it. Call `next()` to get `Some(item)`, again for the next, and eventually `None` to signal "I'm empty." Everything else — `map`, `filter`, `sum`, and dozens more — is built on top of this one method via default implementations.

```rust
fn main() {
    let v = vec![10, 20, 30];
    let mut iter = v.iter(); // create an iterator

    println!("{:?}", iter.next()); // Some(10)
    println!("{:?}", iter.next()); // Some(20)
    println!("{:?}", iter.next()); // Some(30)
    println!("{:?}", iter.next()); // None — exhausted
}
```

You rarely call `next()` by hand, though — that's what `for` loops and adapters do for you.

## Three ways to iterate: `iter`, `iter_mut`, `into_iter`

Which one you choose decides whether you get shared references, mutable references, or owned values — ownership again, applied to iteration:

```rust
fn main() {
    let v = vec![1, 2, 3];

    for x in v.iter() {      // yields &i32 — borrows, read-only
        print!("{x} ");
    }
    println!();

    let mut v2 = vec![1, 2, 3];
    for x in v2.iter_mut() { // yields &mut i32 — borrows mutably
        *x *= 10;
    }
    println!("{v2:?}");      // [10, 20, 30]

    for x in v.into_iter() { // yields i32 — takes ownership, consumes v
        print!("{x} ");
    }
    println!();
    // v is gone now — into_iter consumed it
}
```

| Method | Yields | Effect on the collection |
|--------|--------|--------------------------|
| `iter()` | `&T` | Borrows; collection still usable |
| `iter_mut()` | `&mut T` | Mutably borrows; lets you modify in place |
| `into_iter()` | `T` | Consumes; collection is moved away |

> [!tip] `for x in &v` is `v.iter()` in disguise
> A `for` loop just calls one of these under the hood: `for x in &v` uses `iter()`, `for x in &mut v` uses `iter_mut()`, and `for x in v` uses `into_iter()`. Knowing this explains exactly what you get in the loop body — a reference or an owned value.

## Lazy by design

Here's the concept that surprises newcomers and unlocks iterators' power:

> [!key] Iterators are lazy — nothing happens until you consume them
> Building an iterator pipeline does **no work**. `v.iter().map(|x| x * 2)` doesn't multiply anything — it just *describes* a computation. The work only happens when a **consumer** (like `collect`, `sum`, or a `for` loop) pulls values through. This laziness is what lets the compiler fuse the whole chain into one tight loop, and why you can build pipelines over infinite sequences without hanging.

```rust
fn main() {
    let v = vec![1, 2, 3];

    // This line does NOTHING yet — map is lazy:
    let doubled = v.iter().map(|x| {
        println!("  multiplying {x}"); // won't print until consumed
        x * 2
    });

    println!("Pipeline built. Now consuming:");
    let result: Vec<i32> = doubled.collect(); // NOW the closure runs
    println!("{result:?}");
}
```

## Adapters vs. consumers

Iterator methods come in two families, and telling them apart is the key mental model:

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="Adapters transform one iterator into another lazily; a consumer at the end triggers the work">
  <style>
    .ith { font: 700 12px var(--font-sans); }
    .itm { font: 600 11px var(--font-mono); fill: var(--text); }
    .itc { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .src { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .adp { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .con { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="46" width="90" height="40" rx="8" class="src"/><text x="26" y="70" class="itm">.iter()</text>
  <rect x="120" y="46" width="110" height="40" rx="8" class="adp"/><text x="134" y="70" class="itm">.filter(…)</text>
  <rect x="246" y="46" width="100" height="40" rx="8" class="adp"/><text x="260" y="70" class="itm">.map(…)</text>
  <rect x="362" y="46" width="120" height="40" rx="8" class="con"/><text x="376" y="70" class="itm">.collect()</text>
  <path d="M104 66 L118 66" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#ait)"/>
  <path d="M230 66 L244 66" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#ait)"/>
  <path d="M346 66 L360 66" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#ait)"/>
  <text x="120" y="112" class="itc">ADAPTERS — lazy, return a new iterator</text>
  <text x="120" y="128" class="itc">(build the recipe; do no work yet)</text>
  <text x="366" y="112" class="itc">CONSUMER — eager</text>
  <text x="366" y="128" class="itc">(pulls values, does the work)</text>
  <defs><marker id="ait" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><b>Adapters</b> chain lazily to describe a pipeline; a single <b>consumer</b> at the end runs it.</figcaption>
</figure>

- **Adapters** (like `map`, `filter`, `take`) transform an iterator into another iterator. They're lazy — chain as many as you like for free.
- **Consumers** (like `collect`, `sum`, `count`, `for_each`, `fold`) actually pull the values and produce a final result. They're what make the work happen.

```rust
fn main() {
    let numbers = 1..=10; // a range is an iterator!

    // adapters (map, filter) then a consumer (sum):
    let sum_of_even_squares: i32 = numbers
        .filter(|n| n % 2 == 0) // adapter: keep evens
        .map(|n| n * n)         // adapter: square them
        .sum();                 // consumer: add them up

    println!("{sum_of_even_squares}"); // 4+16+36+64+100 = 220
}
```

The most common consumer is **`collect`**, which gathers items into a collection. It's remarkably flexible — the target type tells it what to build:

```rust
use std::collections::HashMap;

fn main() {
    let words = vec!["one", "two", "three"];

    let lengths: Vec<usize> = words.iter().map(|w| w.len()).collect();
    println!("{lengths:?}"); // [3, 3, 5]

    // Build a HashMap of word → length:
    let map: HashMap<&str, usize> = words.iter().map(|&w| (w, w.len())).collect();
    println!("{:?}", map.get("three")); // Some(5)
}
```

## The payoff: zero-cost

You might worry that all this chaining is slower than a plain loop. It isn't:

> [!performance] As fast as a hand-written loop
> Because iterators are lazy and heavily inlined, the compiler fuses `iter().filter().map().sum()` into a single loop with no intermediate collections and no overhead — the exact machine code you'd write by hand, often *faster* (the compiler can vectorize it). This is Rust's "zero-cost abstraction" promise in action: **write it the clear, high-level way, get the fast, low-level result.** Prefer iterator chains to manual index loops — they're clearer *and* at least as fast.

## Implementing `Iterator` for your own type

Because the trait is so small, you can make anything iterable by implementing `next`. Here's a counter that counts 1 to 5:

```rust
struct Counter { count: u32 }

impl Iterator for Counter {
    type Item = u32;
    fn next(&mut self) -> Option<u32> {
        if self.count < 5 {
            self.count += 1;
            Some(self.count)
        } else {
            None
        }
    }
}

fn main() {
    let counter = Counter { count: 0 };
    // Once you implement next(), you get ALL the adapters for free:
    let total: u32 = counter.filter(|x| x % 2 == 1).sum();
    println!("sum of odd counts: {total}"); // 1 + 3 + 5 = 9
}
```

Implement one method (`next`) and you inherit `map`, `filter`, `sum`, `collect`, and dozens more — the power of default trait methods.

## Summary

- An **iterator** produces items one at a time via a single method, `next() -> Option<Item>`.
- Choose **`iter()`** (`&T`), **`iter_mut()`** (`&mut T`), or **`into_iter()`** (`T`) depending on whether you want to read, modify, or consume.
- Iterators are **lazy**: **adapters** (`map`, `filter`, …) build a pipeline and do nothing; a **consumer** (`collect`, `sum`, `for_each`, …) runs it.
- **`collect`** is the versatile consumer — the target type decides what collection it builds.
- Iterator chains are a **zero-cost abstraction** — as fast as hand-written loops. Prefer them to manual indexing.
- Implement **`next`** and your own type gains the entire iterator toolbox for free.

> [!exercise] Try it yourself
> 1. Use a chain to compute the sum of squares of the odd numbers in `1..=20`.
> 2. `collect` the uppercase versions of `vec!["a", "b", "c"]` into a `Vec<String>` (hint: `.map(|s| s.to_uppercase())`).
> 3. Implement `Iterator` for a `Fibonacci` struct that yields the Fibonacci sequence, then `.take(10).collect::<Vec<_>>()`.

You've met the two players — closures and iterators. Next, a hands-on **cookbook** of the most useful iterator adapters, with a recipe for every common task.
