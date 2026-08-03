<h1><span class="h1-kicker">The Standard Library, Deep</span>The Iterator Trait Reference</h1>

The [Iterator chapter](#/ch/iterators) taught the concept and the [Cookbook](#/ch/iterator-adapters) showed recipes. This reference rounds out `std::iter`: the trait itself, the many ways to *create* iterators, the full categorized method list, and the sibling traits (`DoubleEndedIterator`, `FromIterator`) that make it all tick. Consider it your one-page map of `std::iter`.

## The trait, and its one required method

```rust,ignore
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // ...plus ~70 provided methods, all built on next()
}
```

Implement `next` and you inherit everything else. That's the design lesson worth repeating: a huge, ergonomic API from **one** required method plus default implementations.

## Ways to create an iterator

```rust
use std::collections::HashMap;

fn main() {
    // From collections (the three flavors):
    let v = vec![1, 2, 3];
    let _by_ref = v.iter();       // &T
    let _owned = v.clone().into_iter(); // T
    // From ranges:
    let _r = (1..=5);             // ranges ARE iterators
    // From a HashMap:
    let m = HashMap::from([("a", 1), ("b", 2)]);
    let _pairs = m.iter();        // (&K, &V)

    // Handy constructors from std::iter:
    let ones: Vec<i32> = std::iter::repeat(1).take(3).collect(); // [1,1,1]
    let counts: Vec<i32> = (0..).step_by(10).take(3).collect();   // [0,10,20]
    let one: Vec<i32> = std::iter::once(42).collect();            // [42]
    let none: Vec<i32> = std::iter::empty().collect();            // []
    println!("{ones:?} {counts:?} {one:?} {none:?}");
}
```

| Constructor | Produces |
|-------------|----------|
| `.iter()` / `.iter_mut()` / `.into_iter()` | over a collection (by `&`, `&mut`, or value) |
| `a..b`, `a..=b`, `a..` | a numeric range (also an iterator) |
| `std::iter::once(x)` | a single item |
| `std::iter::repeat(x)` | `x` forever (pair with `.take(n)`) |
| `std::iter::empty()` | nothing |
| `std::iter::successors(seed, f)` | a lazy sequence from a seed function |

## The method families

Iterator methods split into **adapters** (lazy — return a new iterator) and **consumers** (eager — produce a final value). Here's the categorized reference:

**Adapters (lazy)** — chain freely, no work until consumed:

| Category | Methods |
|----------|---------|
| Transform | `map`, `filter`, `filter_map`, `flat_map`, `flatten`, `inspect`, `scan` |
| Combine | `zip`, `chain`, `enumerate`, `cycle` |
| Slice | `take`, `skip`, `take_while`, `skip_while`, `step_by`, `rev`, `peekable` |

**Consumers (eager)** — end the chain and produce a result:

| Category | Methods |
|----------|---------|
| Collect | `collect`, `partition`, `unzip` |
| Reduce | `sum`, `product`, `fold`, `reduce`, `count`, `last`, `min`, `max`, `min_by_key`, `max_by_key` |
| Search | `find`, `find_map`, `position`, `any`, `all`, `nth` |
| Run | `for_each`, `try_for_each` |

```rust
fn main() {
    let words = ["apple", "fig", "banana", "kiwi"];

    // A few less-common but handy ones:
    println!("{:?}", words.iter().min_by_key(|w| w.len())); // Some("fig")
    println!("{:?}", words.iter().position(|&w| w == "banana")); // Some(2)
    let (short, long): (Vec<&&str>, Vec<&&str>) = words.iter().partition(|w| w.len() <= 4);
    println!("{short:?} / {long:?}");

    // unzip splits an iterator of pairs into two collections:
    let pairs = vec![(1, 'a'), (2, 'b'), (3, 'c')];
    let (nums, chars): (Vec<i32>, Vec<char>) = pairs.into_iter().unzip();
    println!("{nums:?} {chars:?}");
}
```

## Sibling traits worth knowing

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Iterator plus related traits: DoubleEndedIterator, ExactSizeIterator, FromIterator, IntoIterator">
  <style>
    .itm2 { font: 600 11px var(--font-mono); fill: var(--text); }
    .itc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .core3 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 2; }
    .sib { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="230" y="18" width="180" height="34" class="core3"/><text x="252" y="40" class="itm2">Iterator (next)</text>
  <rect x="14" y="90" width="150" height="40" class="sib"/><text x="24" y="110" class="itm2">DoubleEnded</text><text x="24" y="126" class="itc2">next_back(), rev()</text>
  <rect x="176" y="90" width="150" height="40" class="sib"/><text x="186" y="110" class="itm2">ExactSize</text><text x="186" y="126" class="itc2">len()</text>
  <rect x="338" y="90" width="150" height="40" class="sib"/><text x="348" y="110" class="itm2">IntoIterator</text><text x="348" y="126" class="itc2">for-loop hook</text>
  <rect x="500" y="90" width="130" height="40" class="sib"/><text x="510" y="110" class="itm2">FromIterator</text><text x="510" y="126" class="itc2">collect() target</text>
  <path d="M300 52 L100 88" stroke="var(--blue)" stroke-width="1.2"/>
  <path d="M310 52 L250 88" stroke="var(--blue)" stroke-width="1.2"/>
  <path d="M330 52 L410 88" stroke="var(--blue)" stroke-width="1.2"/>
  <path d="M350 52 L560 88" stroke="var(--blue)" stroke-width="1.2"/>
</svg>
<figcaption>The <code>Iterator</code> ecosystem: reverse iteration, known length, the <code>for</code>-loop hook, and the <code>collect</code> target.</figcaption>
</figure>

- **`IntoIterator`** — the trait `for x in thing` desugars to (`thing.into_iter()`). Implement it and your type works in `for` loops.
- **`FromIterator`** — the trait that makes `collect()` work; implement it so `iter.collect::<YourType>()` is possible.
- **`DoubleEndedIterator`** — supports `next_back()`, enabling `.rev()` and `.rfind()`.
- **`ExactSizeIterator`** — knows its exact remaining `len()` (lets `collect` pre-size).

> [!tip] `collect` is powered by `FromIterator` — and turbofish tells it what to build
> `collect()` can build a `Vec`, `String`, `HashMap`, `HashSet`, `BTreeMap`, even `Result<Vec<_>, E>` — because each implements `FromIterator`. Since the target type is what selects the impl, you either annotate the binding (`let v: Vec<_> = …`) or use the turbofish (`…collect::<Vec<_>>()`). If `collect` ever fails to compile with "type annotations needed," that's the fix.

## Custom iterators, revisited

Implementing `Iterator` for your own type unlocks the whole toolbox. A common pattern is returning `impl Iterator` from a function to hide a complex chain:

```rust
// Return an iterator without naming its (complex) concrete type:
fn even_squares(limit: u32) -> impl Iterator<Item = u32> {
    (1..=limit).filter(|n| n % 2 == 0).map(|n| n * n)
}

fn main() {
    let result: Vec<u32> = even_squares(6).collect();
    println!("{result:?}"); // [4, 16, 36]
}
```

> [!best] Return `impl Iterator` to keep pipelines lazy across function boundaries
> When a function produces a sequence, return **`impl Iterator<Item = T>`** rather than collecting into a `Vec`. The caller then decides whether to iterate lazily, `take` a few, or `collect` — and no intermediate allocation happens unless they ask for it. It's more flexible *and* often faster than returning a `Vec`.

## Summary

- `Iterator` requires only **`next`**; ~70 provided methods build on it.
- **Create** iterators from collections (`iter`/`iter_mut`/`into_iter`), ranges, or `std::iter` helpers (`once`, `repeat`, `empty`, `successors`).
- Methods are **adapters** (lazy: `map`, `filter`, `zip`, `take`, …) or **consumers** (eager: `collect`, `fold`, `sum`, `find`, `partition`, `unzip`, …).
- Sibling traits: **`IntoIterator`** (the `for` hook), **`FromIterator`** (the `collect` target), **`DoubleEndedIterator`** (`rev`), **`ExactSizeIterator`** (`len`).
- Return **`impl Iterator`** from functions to keep pipelines lazy and allocation-free.

> [!exercise] Try it yourself
> 1. Use `std::iter::successors` to generate the first 10 powers of two.
> 2. `unzip` a `Vec<(&str, i32)>` of names and scores into two separate vectors.
> 3. Write a function returning `impl Iterator<Item = i32>` that yields the running totals of `1..=5`.

Now to input and output — reading and writing bytes and text with **`std::io`**.
