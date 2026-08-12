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

## Laziness: the consumer pulls, one item at a time

Everything about iterators follows from `next`. An adapter like `map` cannot *do* anything on its own — it only holds a closure and waits to be asked. The consumer at the end of the chain calls `next`, that call travels backwards to the source, and a single item is dragged forward through every stage before the second item is even requested.

<figure class="diagram">
<svg viewBox="0 0 640 224" role="img" aria-label="A chain of source, map, filter and collect: pull requests travel right to left while one item at a time travels left to right through every stage">
  <style>
    .lz-h { font: 700 11.5px var(--font-sans); }
    .lz-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .lz-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .lz-lazy { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .lz-eager { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.8; }
  </style>
  <text x="20" y="16" class="lz-h" fill="var(--text-mute)">lazy — build these all day and nothing happens</text>
  <text x="492" y="16" class="lz-h" fill="var(--rust-500)">eager</text>
  <rect x="20" y="62" width="112" height="38" rx="4" class="lz-lazy"/><text x="34" y="86" class="lz-m">v.iter()</text>
  <rect x="168" y="62" width="112" height="38" rx="4" class="lz-lazy"/><text x="182" y="86" class="lz-m">.map(f)</text>
  <rect x="316" y="62" width="112" height="38" rx="4" class="lz-lazy"/><text x="330" y="86" class="lz-m">.filter(p)</text>
  <rect x="480" y="62" width="140" height="38" rx="4" class="lz-eager"/><text x="494" y="86" class="lz-m">.collect()</text>
  <path d="M478 44 L136 44" stroke="var(--blue)" stroke-width="1.6" stroke-dasharray="5 4" fill="none" marker-end="url(#lz-pull)"/>
  <text x="228" y="38" class="lz-c" fill="var(--blue)">next() — the pull travels backwards</text>
  <path d="M136 118 L476 118" stroke="var(--green)" stroke-width="1.8" fill="none" marker-end="url(#lz-val)"/>
  <text x="216" y="134" class="lz-c" fill="var(--green)">one item travels forwards through every stage</text>
  <text x="20" y="164" class="lz-c">So the order is <tspan font-family="var(--font-mono)">1→f→p</tspan>, then <tspan font-family="var(--font-mono)">2→f→p</tspan> — not "map the whole vector, then filter the whole vector."</text>
  <text x="20" y="182" class="lz-c">Nothing is buffered between stages, so a chain of ten adapters still allocates nothing.</text>
  <text x="20" y="200" class="lz-c">A filtered-out item simply makes the pull continue to the source again for another try.</text>
  <text x="20" y="218" class="lz-c">Drop the chain without consuming it and zero closures ever ran.</text>
  <defs>
    <marker id="lz-pull" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="lz-val" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption>Pull-based evaluation: the consumer asks, and each item is carried through the whole chain before the next one is fetched.</figcaption>
</figure>

`inspect` is the adapter that lets you *watch* this happen — it passes every item through untouched and runs a closure on the way:

```rust
fn main() {
    let v = vec![1, 2, 3];
    let pipeline = v.iter()
        .inspect(|x| println!("  source yields {x}"))
        .map(|x| x * 10)
        .filter(|x| x % 20 != 0)
        .inspect(|x| println!("  survived the filter: {x}"));
    println!("built the chain -- nothing has run yet");
    let out: Vec<i32> = pipeline.collect();
    println!("{out:?}");
}
```

```text
built the chain -- nothing has run yet
  source yields 1
  survived the filter: 10
  source yields 2
  source yields 3
  survived the filter: 30
[10, 30]
```

Item `2` is fetched, multiplied, rejected by the filter, and forgotten before item `3` is ever touched. This is why an unconsumed chain is free, why an infinite source like `(0..)` is safe as long as something limits it, and why `inspect` is the right debugging tool — a `println!` inside a `map` would tell you the same thing but change the closure you were trying to observe.

> [!mistake] An adapter without a consumer is a silent no-op
> `v.iter().map(|x| println!("{x}"));` prints nothing, and the compiler warns that the value is unused. Adapters are lazy: if you want side effects, end the chain with a consumer — `for_each`, `count`, `collect`, or an actual `for` loop.

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

The `std::iter` free functions are the ones people forget, and they replace a surprising amount of hand-written state machinery:

```rust
fn main() {
    // from_fn: a closure IS the iterator -- return None to stop
    let mut n = 1u32;
    let powers: Vec<u32> = std::iter::from_fn(|| { n *= 2; if n < 40 { Some(n) } else { None } }).collect();
    println!("{powers:?}"); // [2, 4, 8, 16, 32]

    // successors: each item computed from the previous one; None ends it
    let s: Vec<u64> = std::iter::successors(Some(1u64), |&x| x.checked_mul(3)).take(5).collect();
    println!("{s:?}"); // [1, 3, 9, 27, 81]

    // repeat_with: like repeat, but for values that can't be cloned (or shouldn't be)
    let mut c = 0;
    let rw: Vec<i32> = std::iter::repeat_with(|| { c += 1; c }).take(3).collect();
    println!("{rw:?}"); // [1, 2, 3]

    // zip as a free function reads better than a.into_iter().zip(b)
    let z: Vec<(i32, char)> = std::iter::zip(1..=3, ['a', 'b', 'c']).collect();
    println!("{z:?}"); // [(1, 'a'), (2, 'b'), (3, 'c')]
}
```

| Free function | Use it when |
|---------------|-------------|
| `iter::from_fn(f)` | you have state in a closure and want an iterator out of it |
| `iter::successors(first, f)` | each item is derived from the previous (doubling, tree parents, `checked_*` walks) |
| `iter::repeat_with(f)` | repeating a value that isn't `Clone`, or that must be *freshly made* each time |
| `iter::once_with(f)` | one item, computed only if actually pulled |
| `iter::zip(a, b)` | pairing two collections without an awkward method chain |
| `iter::empty()` | a typed "no items" to return from one branch of a `match` |

> [!note] `successors` beats a `loop` for "keep going until it overflows"
> `successors(Some(1u64), |&x| x.checked_mul(3))` stops on its own when `checked_mul` returns `None`, because `successors` ends the moment the closure yields `None`. That's an overflow-safe sequence in one line, with no `break` and no `unwrap`.

## The method families

Iterator methods split into **adapters** (lazy — return a new iterator) and **consumers** (eager — produce a final value). Here's the categorized reference:

**Adapters (lazy)** — chain freely, no work until consumed:

| Category | Methods |
|----------|---------|
| Transform | `map`, `filter`, `filter_map`, `flat_map`, `flatten`, `inspect`, `scan`, `map_while` |
| Combine | `zip`, `chain`, `enumerate`, `cycle` |
| Slice | `take`, `skip`, `take_while`, `skip_while`, `step_by`, `rev`, `peekable` |
| Borrow / copy | `copied`, `cloned`, `by_ref` |
| Well-behaved | `fuse` (never yields again after the first `None`) |

**Consumers (eager)** — end the chain and produce a result:

| Category | Methods |
|----------|---------|
| Collect | `collect`, `partition`, `unzip` |
| Reduce | `sum`, `product`, `fold`, `try_fold`, `reduce`, `count`, `last`, `min`, `max`, `min_by_key`, `max_by_key`, `min_by`, `max_by` |
| Search | `find`, `find_map`, `position`, `rposition`, `any`, `all`, `nth` |
| Compare | `eq`, `ne`, `cmp`, `lt`, `gt` (two iterators, element by element) |
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

## Stopping early, and picking up where you left off

Four methods do most of the work that people otherwise write loops for: `by_ref` (consume part of an iterator and keep the rest), `peekable` (look ahead without consuming), `scan` (map with state), and `try_fold` (fold that stops at the first failure).

```rust
fn main() {
    // by_ref: consume part of an iterator, keep the rest
    let mut it = 1..=10;
    let head: Vec<i32> = it.by_ref().take(3).collect();
    let tail: Vec<i32> = it.collect();
    println!("{head:?} then {tail:?}");

    // peekable: look at the next item without consuming it
    let mut p = [1, 1, 2, 2, 2, 3].iter().peekable();
    let mut runs = Vec::new();
    while let Some(&first) = p.next() {
        let mut n = 1;
        while p.peek() == Some(&&first) { p.next(); n += 1; }
        runs.push((first, n));
    }
    println!("{runs:?}");

    // scan: map with state, and Some/None decides whether to keep going
    let running: Vec<i32> = (1..=5).scan(0, |sum, x| { *sum += x; Some(*sum) }).collect();
    println!("{running:?}");
    let until_big: Vec<i32> = (1..=5)
        .scan(0, |sum, x| { *sum += x; if *sum > 6 { None } else { Some(*sum) } })
        .collect();
    println!("{until_big:?}");

    // fold vs try_fold: try_fold stops at the first None/Err
    let nums = [1i32, 2, i32::MAX, 4];
    let mut visited = 0;
    let checked = nums.iter()
        .inspect(|_| visited += 1)
        .try_fold(0i32, |acc, &x| acc.checked_add(x));
    println!("{checked:?} after visiting {visited} of {}", nums.len());
}
```

```text
[1, 2, 3] then [4, 5, 6, 7, 8, 9, 10]
[(1, 2), (2, 3), (3, 1)]
[1, 3, 6, 10, 15]
[1, 3, 6]
None after visiting 3 of 4
```

That last line is the point of `try_fold`: it never looked at `4`. The same short-circuiting powers the search consumers — `find`, `any`, `all`, and `position` are all implemented on top of `try_fold`, which is why `(0..).any(|n| n * n > 50)` terminates on an infinite range.

| Method | Signature idea | Why it exists |
|--------|----------------|---------------|
| `by_ref()` | `&mut I` (which is also an `Iterator`) | lets `take`/`find` consume *part* of an iterator you still need afterwards |
| `peekable()` | adds `.peek() -> Option<&Item>` | parsers and run-length grouping: decide *based on* the next item |
| `scan(init, f)` | `f(&mut state, item) -> Option<B>` | running totals, deltas, any adapter that needs memory |
| `map_while(f)` | `f(item) -> Option<B>` | stop at the first item that fails to convert |
| `fold(init, f)` | `f(acc, item) -> acc` | build one value from all items |
| `try_fold(init, f)` | `f(acc, item) -> Option/Result` | build one value, abandoning the rest on the first failure |
| `try_for_each(f)` | `f(item) -> Result<(), E>` | side effects with `?`-style early exit |

> [!key] `take` consumes the iterator; `by_ref().take()` borrows it
> `it.take(3)` *moves* `it`, so `it` is gone afterwards. `it.by_ref().take(3)` moves only a mutable borrow, so once the borrow ends the original iterator continues from item 4. This is the standard way to read a header off a stream of lines and then process the body.

> [!mistake] `scan` is not `filter_map`
> Returning `None` from a `scan` closure **ends the iterator** — it does not skip that one item. If you want to skip and keep going, that's `filter_map`. If you want to stop, `scan` and `map_while` are your tools.

## Windows and chunks are slice methods, not adapters

Newcomers look for `.windows(2)` on `Iterator` and don't find it — sliding windows would have to buffer, so `std` puts them on `[T]`, where the data is already sitting in memory:

```rust
fn main() {
    let v = [1, 2, 3, 4, 5];

    // On slices: overlapping windows and non-overlapping chunks.
    println!("{:?}", v.windows(2).map(|w| w[1] - w[0]).collect::<Vec<_>>()); // [1, 1, 1, 1]
    println!("{:?}", v.chunks(2).collect::<Vec<_>>());   // [[1, 2], [3, 4], [5]]
    println!("remainder {:?}", v.chunks_exact(2).remainder()); // [5]

    // On any iterator: pair each item with the next via zip + skip.
    let deltas: Vec<i32> = v.iter().zip(v.iter().skip(1)).map(|(a, b)| b - a).collect();
    println!("{deltas:?}"); // [1, 1, 1, 1]
}
```

| Slice method | Yields | Note |
|--------------|--------|------|
| `windows(n)` | overlapping `&[T]` of length `n` | never empty-yields; `n > len` gives no items |
| `chunks(n)` | non-overlapping `&[T]` | the last chunk may be short |
| `chunks_exact(n)` | non-overlapping, all exactly `n` | leftovers via `.remainder()`; faster |
| `rchunks(n)` | chunks from the end | the *first* chunk may be short |
| `split(pred)` / `split_first` | pieces around matching elements | `split_first` gives `(&T, &[T])` |

> [!tip] `zip` with `skip(1)` is the general sliding-pair trick
> It works on any iterator — file lines, database rows, anything not backed by a slice — and costs nothing extra, because both halves pull from the same source lazily. For genuinely general windows, grouping, or sorted output, reach for the `itertools` crate: `std` deliberately leaves out anything that needs to buffer or allocate behind your back.

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
- **`Extend`** — `collection.extend(iter)` appends into an *existing* collection, reusing its allocation instead of building a new one. `FromIterator` creates; `Extend` grows.
- **`FusedIterator`** — a promise that once `next` returns `None` it always will. `.fuse()` enforces it for iterators that don't promise.

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

### Writing `next` by hand — and the two methods worth adding

`next` is the only required method, but two optional ones change how well your iterator plays with the rest of `std`: `size_hint` (so `collect` can allocate exactly once) and `next_back` (so `.rev()` works at all):

```rust
/// Yields lo, lo+1, ... hi-1 -- from either end.
struct Span { lo: u32, hi: u32 }

impl Iterator for Span {
    type Item = u32;
    fn next(&mut self) -> Option<u32> {
        if self.lo >= self.hi { return None; }
        self.lo += 1;
        Some(self.lo - 1)
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        let n = (self.hi - self.lo) as usize;
        (n, Some(n))
    }
}

impl DoubleEndedIterator for Span {
    fn next_back(&mut self) -> Option<u32> {
        if self.lo >= self.hi { return None; }
        self.hi -= 1;
        Some(self.hi)
    }
}

impl ExactSizeIterator for Span {}

fn main() {
    println!("{:?}", Span { lo: 1, hi: 6 }.collect::<Vec<_>>());       // [1, 2, 3, 4, 5]
    println!("{:?}", Span { lo: 1, hi: 6 }.rev().collect::<Vec<_>>()); // [5, 4, 3, 2, 1]
    println!("len {}", Span { lo: 1, hi: 6 }.len());                   // 5 (from ExactSizeIterator)

    let v: Vec<u32> = Span { lo: 1, hi: 6 }.collect();
    println!("capacity {}", v.capacity()); // 5 -- size_hint pre-sized it, no regrowth

    // Both ends chew into the same range until they meet:
    let mut s = Span { lo: 1, hi: 6 };
    println!("{:?} {:?} {:?}", s.next(), s.next_back(), s.collect::<Vec<_>>());
    // Some(1) Some(5) [2, 3, 4]
}
```

`ExactSizeIterator` is an empty `impl` because its `len()` is derived from `size_hint`; you only get to claim it once your hint is exact. And the hint really is load-bearing:

```rust
fn main() {
    let exact: Vec<i32> = (1..=100).collect();
    let filtered: Vec<i32> = (1..=100).filter(|n| n % 2 == 0).collect();
    println!("range    len {} capacity {}", exact.len(), exact.capacity());
    println!("filtered len {} capacity {}", filtered.len(), filtered.capacity());
    println!("hints: {:?} vs {:?}",
        (1..=100).size_hint(),
        (1..=100).filter(|n| n % 2 == 0).size_hint());
}
```

```text
range    len 100 capacity 100
filtered len 50 capacity 64
hints: (100, Some(100)) vs (0, Some(100))
```

A range knows its length exactly, so `collect` allocates once. `filter` can't know how many items survive, so its lower bound drops to `0` and the `Vec` grows by doubling — 50 items land in a capacity-64 buffer after several reallocations. When that matters, `Vec::with_capacity` plus `extend` gives you back control.

> [!best] Make your collection work with `for`, and with `collect`
> Implementing `IntoIterator` for `YourType`, `&YourType`, and `&mut YourType` — and `FromIterator` for `YourType` — is what makes a custom collection feel native. Each one is usually a one-line delegation to the inner `Vec`:

```rust
struct Bag<T> { items: Vec<T> }

impl<T> FromIterator<T> for Bag<T> {
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Self {
        Bag { items: iter.into_iter().collect() }
    }
}

impl<T> IntoIterator for Bag<T> {
    type Item = T;
    type IntoIter = std::vec::IntoIter<T>;
    fn into_iter(self) -> Self::IntoIter { self.items.into_iter() }
}

impl<'a, T> IntoIterator for &'a Bag<T> {
    type Item = &'a T;
    type IntoIter = std::slice::Iter<'a, T>;
    fn into_iter(self) -> Self::IntoIter { self.items.iter() }
}

fn main() {
    let bag: Bag<i32> = (1..=4).collect();  // FromIterator
    for x in &bag { print!("{x} "); }       // &Bag  -> yields &i32
    println!();
    let doubled: Vec<i32> = bag.into_iter().map(|x| x * 2).collect(); // Bag by value -> yields i32
    println!("{doubled:?}"); // [2, 4, 6, 8]
}
```

That is the same trio `Vec` itself offers, and the reason `for x in &v` and `for x in v` both work with different item types. An infinite iterator, incidentally, is just a `next` that never returns `None` — perfectly legal, and the caller's `take`/`take_while` is what makes it finite.

> [!performance] Iterators compile down to the loop you would have written
> Adapters are structs holding closures, and monomorphization plus inlining collapse the whole chain into a single loop with no per-item indirection — often with the bounds check eliminated too, which a hand-rolled `for i in 0..v.len()` with `v[i]` may not achieve. Where a difference remains it usually favours iterators. Write the chain; reach for indices only when a profiler tells you to.

## Summary

- `Iterator` requires only **`next`**; ~70 provided methods build on it.
- Evaluation is **pull-based and lazy**: one item crosses the entire chain before the next is fetched, nothing is buffered between stages, and an unconsumed chain does no work at all.
- **Create** iterators from collections (`iter`/`iter_mut`/`into_iter`), ranges, or `std::iter` helpers (`once`, `repeat`, `empty`, `successors`, `from_fn`, `repeat_with`, `zip`).
- Methods are **adapters** (lazy: `map`, `filter`, `zip`, `take`, `scan`, …) or **consumers** (eager: `collect`, `fold`, `sum`, `find`, `partition`, `unzip`, …).
- **`by_ref`** keeps an iterator alive past a `take`/`find`; **`peekable`** looks ahead; **`scan`** carries state; **`try_fold`** stops at the first failure — and `find`/`any`/`all` are built on it, which is why they terminate on infinite ranges.
- **`windows`/`chunks` are slice methods**, not adapters — for a general sliding pair, `zip` an iterator with `skip(1)`.
- Sibling traits: **`IntoIterator`** (the `for` hook), **`FromIterator`** (the `collect` target), **`Extend`** (append into an existing collection), **`DoubleEndedIterator`** (`rev`), **`ExactSizeIterator`** (`len`).
- When writing your own, add **`size_hint`** so `collect` allocates once, and **`next_back`** so `.rev()` works.
- Return **`impl Iterator`** from functions to keep pipelines lazy and allocation-free.

> [!exercise] Try it yourself
> 1. Use `std::iter::successors` to generate the first 10 powers of two.
> 2. `unzip` a `Vec<(&str, i32)>` of names and scores into two separate vectors.
> 3. Write a function returning `impl Iterator<Item = i32>` that yields the running totals of `1..=5`.
> 4. Use `by_ref` to read the first two lines of a `&str`'s `.lines()` as a header, then collect the remaining lines as the body.
> 5. Use `try_fold` to sum a `&[&str]` of numbers, returning `Err` on the first unparseable entry.
> 6. Write `fn deltas(v: &[i32]) -> Vec<i32>` twice — once with `windows(2)`, once with `zip(skip(1))` — and confirm they agree.
> 7. Give `Span` an `iter_mut`-style sibling: implement `Iterator` for a struct that yields `&mut i32` items from a `&mut Vec<i32>` (hint: delegate to `slice::iter_mut`).
> 8. Add `impl<T> Extend<T> for Bag<T>` and confirm `bag.extend(5..=7)` appends without rebuilding.

Now to input and output — reading and writing bytes and text with **`std::io`**.
