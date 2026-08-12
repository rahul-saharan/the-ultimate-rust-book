<h1><span class="h1-kicker">Functional Rust</span>The Iterator Adapters Cookbook</h1>

Now that you understand *how* iterators work, this chapter is your **recipe book**: the most useful adapters and consumers, each with a tiny runnable example. Bookmark it — when you think "how do I transform this list?", the answer is almost always one line here. Every snippet runs; edit and experiment freely.

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="A pipeline: filter keeps the even numbers, then map multiplies each by ten">
  <style>
    .iam { font: 600 12px var(--font-mono); fill: var(--text); }
    .iac { font: 11px var(--font-sans); fill: var(--text-mute); }
    .st0 { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .st1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .st2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="40" width="150" height="34" rx="8" class="st0"/><text x="30" y="62" class="iam">[1,2,3,4,5,6]</text>
  <text x="176" y="36" class="iac">.filter(even)</text>
  <path d="M166 57 L250 57" stroke="var(--blue)" stroke-width="2" marker-end="url(#aia)"/>
  <rect x="256" y="40" width="110" height="34" rx="8" class="st1"/><text x="272" y="62" class="iam">[2,4,6]</text>
  <text x="380" y="36" class="iac">.map(×10)</text>
  <path d="M368 57 L452 57" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#aia)"/>
  <rect x="458" y="40" width="160" height="34" rx="8" class="st2"/><text x="474" y="62" class="iam">[20,40,60]</text>
  <defs><marker id="aia" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>Every recipe below is one link in a pipeline like this — chain them freely.</figcaption>
</figure>

## Transforming

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5, 6];

    // map: apply a function to every item
    let doubled: Vec<i32> = v.iter().map(|x| x * 2).collect();
    println!("map:        {doubled:?}");

    // filter: keep only items matching a predicate
    let evens: Vec<&i32> = v.iter().filter(|&&x| x % 2 == 0).collect();
    println!("filter:     {evens:?}");

    // filter_map: transform AND filter in one step (keep the Some values)
    let parsed: Vec<i32> = ["1", "nope", "3"].iter()
        .filter_map(|s| s.parse::<i32>().ok())
        .collect();
    println!("filter_map: {parsed:?}");

    // flat_map / flatten: turn nested things into one flat stream
    let words: Vec<&str> = ["a b", "c d"].iter().flat_map(|s| s.split(' ')).collect();
    println!("flat_map:   {words:?}");
    let flat: Vec<i32> = vec![vec![1, 2], vec![3, 4]].into_iter().flatten().collect();
    println!("flatten:    {flat:?}");
}
```

## Combining streams

```rust
fn main() {
    // enumerate: pair each item with its index
    for (i, c) in ['a', 'b', 'c'].iter().enumerate() {
        print!("({i}:{c}) ");
    }
    println!();

    // zip: pair up two iterators, stopping at the shorter one
    let names = ["Ana", "Ben", "Cy"];
    let ages = [30, 25, 40];
    let people: Vec<(&str, i32)> = names.iter().copied().zip(ages).collect();
    println!("zip:   {people:?}");

    // chain: run one iterator, then another
    let all: Vec<i32> = (1..=3).chain(7..=9).collect();
    println!("chain: {all:?}");
}
```

## Slicing the stream

```rust
fn main() {
    // take / skip: grab or drop a number of items
    let middle: Vec<i32> = (1..=10).skip(3).take(4).collect();
    println!("skip+take:  {middle:?}"); // [4, 5, 6, 7]

    // step_by: every Nth item
    let evens: Vec<i32> = (0..=10).step_by(2).collect();
    println!("step_by:    {evens:?}");

    // take_while / skip_while: based on a condition, not a count
    let ascending: Vec<i32> = [1, 2, 3, 99, 1].iter().copied()
        .take_while(|&x| x < 10).collect();
    println!("take_while: {ascending:?}"); // [1, 2, 3]

    // rev: reverse (needs a double-ended iterator)
    let backwards: Vec<i32> = (1..=5).rev().collect();
    println!("rev:        {backwards:?}");
}
```

## Reducing to a single value

```rust
fn main() {
    let v = vec![3, 1, 4, 1, 5, 9, 2, 6];

    println!("sum:      {}", v.iter().sum::<i32>());
    println!("product:  {}", (1..=5).product::<i32>());
    println!("count>3:  {}", v.iter().filter(|&&x| x > 3).count());
    println!("max:      {:?}", v.iter().max());
    println!("min:      {:?}", v.iter().min());

    // max_by_key: the item that maximizes some key
    let words = ["hi", "banana", "cat"];
    println!("longest:  {:?}", words.iter().max_by_key(|s| s.len()));

    // fold: general-purpose accumulation (start value + combining closure)
    let concat = ["a", "b", "c"].iter().fold(String::new(), |acc, s| acc + s);
    println!("fold:     {concat}");

    // reduce: like fold but uses the first item as the start (returns Option)
    println!("reduce:   {:?}", v.iter().copied().reduce(|a, b| a.max(b)));
}
```

## Searching & testing

```rust
fn main() {
    let v = vec![10, 20, 30, 40];

    println!("any >25:   {}", v.iter().any(|&x| x > 25));   // true
    println!("all >5:    {}", v.iter().all(|&x| x > 5));    // true
    println!("find >25:  {:?}", v.iter().find(|&&x| x > 25)); // Some(30)
    println!("position:  {:?}", v.iter().position(|&x| x == 30)); // Some(2)
}
```

> [!performance] Short-circuiting saves work
> `any`, `all`, `find`, and `position` **stop as soon as they know the answer** — `any` returns `true` at the first match without scanning the rest. Combined with laziness, this means `(1..).map(expensive).find(|x| cond(x))` only does as much work as needed, even over an infinite range. Put cheap filters before expensive maps to skip work early.

## Splitting & stateful adapters

```rust
fn main() {
    // partition: split into two collections by a predicate
    let (evens, odds): (Vec<i32>, Vec<i32>) = (1..=8).partition(|x| x % 2 == 0);
    println!("partition: {evens:?} / {odds:?}");

    // scan: like fold, but yields each intermediate result (running totals)
    let running: Vec<i32> = [1, 2, 3, 4].iter()
        .scan(0, |sum, &x| { *sum += x; Some(*sum) })
        .collect();
    println!("scan:      {running:?}"); // [1, 3, 6, 10]

    // peekable: look at the next item without consuming it
    let mut it = [1, 1, 2, 3].iter().peekable();
    let mut firsts = vec![];
    while let Some(&x) = it.next() {
        if it.peek() != Some(&&x) { firsts.push(x); } // keep last of each run
    }
    println!("peekable:  {firsts:?}");
}
```

## Windows & chunks (on slices)

These are *slice* methods (not iterator adapters), but they're indispensable for sequence problems:

```rust
fn main() {
    let v = [1, 2, 3, 4, 5];

    // windows(n): every overlapping run of n elements
    for w in v.windows(2) {
        print!("{w:?} "); // [1,2] [2,3] [3,4] [4,5]
    }
    println!();

    // chunks(n): non-overlapping groups of n
    for c in v.chunks(2) {
        print!("{c:?} "); // [1,2] [3,4] [5]
    }
    println!();
}
```

## Collecting into different types

`collect` builds whatever collection the target type asks for — and can even turn a stream of `Result`s into a single `Result`:

```rust
use std::collections::{HashMap, HashSet};

fn main() {
    let pairs = vec![("a", 1), ("b", 2), ("a", 3)];

    let map: HashMap<&str, i32> = pairs.iter().cloned().collect();
    println!("into HashMap: {:?}", map.get("b"));

    let set: HashSet<i32> = [1, 2, 2, 3, 3, 3].into_iter().collect();
    println!("unique count: {}", set.len()); // 3

    // collect a stream of Results into Result<Vec<_>, _> — fails fast on any Err
    let all_ok: Result<Vec<i32>, _> = ["1", "2", "3"].iter().map(|s| s.parse::<i32>()).collect();
    println!("all_ok:  {all_ok:?}"); // Ok([1, 2, 3])
    let has_err: Result<Vec<i32>, _> = ["1", "x", "3"].iter().map(|s| s.parse::<i32>()).collect();
    println!("has_err: {}", has_err.is_err()); // true
}
```

> [!tip] The `Result`-collecting trick is a hidden gem
> `iter.map(fallible).collect::<Result<Vec<_>, _>>()` runs a fallible operation over every item and gives you **either** all the successes as a `Vec` **or** the first error — no manual loop, no early-return boilerplate. It's one of the most satisfying one-liners in Rust.

## Four things that catch everyone

The adapters themselves are easy; these are the friction points:

```rust
fn main() {
    let words = vec!["3", "14", "oops", "15"];

    // 1. A chain with no consumer does NOTHING — and warns.
    //    words.iter().map(|w| println!("{w}"));   // ⚠ unused `Map` that must be used
    //    Add a consumer (for_each, collect, sum…) or use a `for` loop.
    words.iter().for_each(|w| print!("{w} "));
    println!();

    // 2. `collect()` needs to know the target type. Annotate the binding
    //    or use a turbofish — the error is "type annotations needed".
    let lengths: Vec<usize> = words.iter().map(|w| w.len()).collect();
    let joined = words.iter().copied().collect::<Vec<&str>>().join("-");
    println!("{lengths:?} {joined}");

    // 3. `cloned()` vs `copied()`: same job, but copied() only accepts Copy
    //    types and signals "this is cheap". Prefer it when it applies.
    let nums = [1, 2, 3];
    let a: Vec<i32> = nums.iter().copied().collect();
    let b: Vec<i32> = nums.iter().cloned().collect();
    println!("{a:?} {b:?}");

    // 4. Collecting into Result short-circuits on the first Err —
    //    the single most useful collect trick in the language.
    let all_ok: Result<Vec<i32>, _> = vec!["1", "2", "3"].iter().map(|s| s.parse::<i32>()).collect();
    let has_bad: Result<Vec<i32>, _> = words.iter().map(|s| s.parse::<i32>()).collect();
    println!("{all_ok:?}");
    println!("{:?}", has_bad.is_err());
}
```

That last one deserves emphasis: `Iterator<Item = Result<T, E>>` collects into `Result<Vec<T>, E>` — you get either every value or the first error, with no manual loop. The same works for `Option`, and `partition()` splits successes from failures when you'd rather keep both.

One more worth internalising: **`sum()` and `product()` need to know their output type**, and they panic on overflow in debug builds just like `+` does:

```rust
fn main() {
    let nums = [1i32, 2, 3, 4];

    // The turbofish tells `sum` what to accumulate into:
    println!("{}", nums.iter().sum::<i32>());
    let total: i64 = nums.iter().map(|&n| n as i64).sum(); // widen first for big sums
    println!("{total}");

    // `checked_sum` doesn't exist — fold with checked_add when overflow is possible:
    let safe = nums.iter().try_fold(0i32, |acc, &n| acc.checked_add(n));
    println!("{safe:?}");
}
```

> [!tip] When std runs out, reach for `itertools`
> A handful of genuinely useful adapters aren't in the standard library: `chunk_by` (group consecutive equal items), `unique`, `sorted`, `join` on any iterator, `cartesian_product`, `tuple_windows`, and `itertools::izip!` for zipping three or more. They live in the [itertools](#/ch/itertools) crate, which is pre-loaded in this book's playground. Also worth knowing: **`by_ref()`** lets you consume part of an iterator and then keep using the rest — `let first: Vec<_> = it.by_ref().take(3).collect();` leaves `it` positioned at the fourth element.

## Quick reference

| Adapter (lazy) | Does | Consumer (eager) | Produces |
|----------------|------|------------------|----------|
| `map(f)` | transform each item | `collect()` | a collection |
| `filter(p)` | keep matching items | `sum()` / `product()` | a number |
| `filter_map(f)` | transform + keep `Some` | `count()` | how many |
| `flat_map(f)` / `flatten()` | un-nest | `min()` / `max()` | `Option<item>` |
| `enumerate()` | add indices | `max_by_key(k)` | `Option<item>` |
| `zip(other)` | pair up two streams | `fold(init, f)` | one accumulated value |
| `chain(other)` | concatenate | `reduce(f)` | `Option<value>` |
| `take(n)` / `skip(n)` | slice by count | `for_each(f)` | nothing (side effects) |
| `take_while` / `skip_while` | slice by condition | `any(p)` / `all(p)` | `bool` |
| `step_by(n)` / `rev()` | stride / reverse | `find(p)` / `position(p)` | `Option` |
| `scan(s, f)` | stateful transform | `partition(p)` | two collections |

## Summary

- **Transform** with `map`, `filter`, `filter_map`, `flat_map`/`flatten`.
- **Combine** with `enumerate`, `zip`, `chain`.
- **Slice** the stream with `take`, `skip`, `step_by`, `take_while`, `skip_while`, `rev`.
- **Reduce** with `sum`, `product`, `count`, `min`/`max`, `fold`, `reduce`; **search** with `any`, `all`, `find`, `position` (all short-circuit).
- **Split** with `partition`, carry state with `scan`, look ahead with `peekable`.
- **`collect`** builds any collection — including turning a stream of `Result`s into one `Result`.

> [!exercise] Try it yourself
> 1. From `1..=100`, take the numbers divisible by 3, square them, and sum the first five (`filter` + `map` + `take` + `sum`).
> 2. Given `vec!["10", "20", "oops", "40"]`, use `filter_map` to sum only the values that parse as numbers.
> 3. Use `zip` and `map` to compute the dot product of `[1,2,3]` and `[4,5,6]` (`1*4 + 2*5 + 3*6 = 32`).
> 4. Use `collect::<Result<Vec<_>, _>>()` to parse `["1","2","3"]` into a `Vec<i32>`, then try it with a bad value.

You now write Rust the way experts do — with expressive, zero-cost iterator pipelines. Next, we make sure our code *works* and *stays* working: **testing**.
