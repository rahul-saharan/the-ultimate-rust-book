<h1><span class="h1-kicker">The Crate Ecosystem</span>itertools: The Adapters std Forgot</h1>

Rust's `Iterator` trait is excellent, and after a while you notice the gaps: there's no `group_by`, no `unique`, no `chunks` over an arbitrary iterator, no way to sort as an expression. `itertools` fills every one of them. It's a zero-dependency, extremely widely used crate that most Rust projects add on day one — and it's available on the Rust Playground, so every example here is runnable.

```toml
[dependencies]
itertools = "0.13"
```

```rust
// One import brings in every adapter, as methods on any Iterator.
use itertools::Itertools;

fn main() {
    let words = ["apple", "banana", "cherry"];
    // `join` on an iterator — std only has it on slices.
    println!("{}", words.iter().join(", "));
}
```

> [!key] `use itertools::Itertools;` is the whole API
> `itertools` works by defining an **extension trait** (the pattern from [Rust Design Patterns](#/ch/idioms-patterns)) implemented for every `Iterator`. So the import isn't a namespace you call into — it's what makes the methods *appear*. If an adapter from this chapter "doesn't exist", the missing `use` is the reason, every time.

## Grouping and deduplicating

The adapters people install itertools for.

```rust
use itertools::Itertools;

fn main() {
    let words = ["apple", "avocado", "banana", "blueberry", "cherry"];

    // into_group_map: build a HashMap<K, Vec<V>> in one expression.
    // Compare with the entry() loop from the collections chapter.
    let by_letter = words
        .iter()
        .map(|w| (w.chars().next().unwrap(), *w))
        .into_group_map();

    for (letter, group) in by_letter.iter().sorted_by_key(|(k, _)| **k) {
        println!("{letter}: {group:?}");
    }

    // into_group_map_by: the same, deriving the key with a closure.
    let by_length = words.iter().into_group_map_by(|w| w.len());
    println!("\nby length: {:?}", by_length.keys().sorted().collect::<Vec<_>>());

    // unique: deduplicate ANY iterator, preserving first-seen order.
    // std has nothing equivalent — Vec::dedup only removes neighbours.
    let nums = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
    println!("\nunique: {:?}", nums.iter().unique().collect::<Vec<_>>());

    // unique_by: dedup on a derived key.
    let people = [("ada", 36), ("grace", 45), ("alan", 36)];
    let one_per_age: Vec<_> = people.iter().unique_by(|(_, age)| *age).collect();
    println!("one per age: {one_per_age:?}");

    // counts: a frequency map in a single call.
    let letters = "mississippi".chars().counts();
    println!("\nletter counts: {:?}", letters.iter().sorted().collect::<Vec<_>>());

    // dedup / dedup_with_count: collapse CONSECUTIVE runs.
    let runs = [1, 1, 1, 2, 2, 3, 1];
    println!("dedup:            {:?}", runs.iter().dedup().collect::<Vec<_>>());
    println!("dedup_with_count: {:?}", runs.iter().dedup_with_count().collect::<Vec<_>>());
}
```

| Adapter | Does | std equivalent |
|---|---|---|
| `unique()` | distinct items, first-seen order | a `HashSet` + `filter` by hand |
| `unique_by(f)` | distinct by a derived key | — |
| `counts()` | `HashMap<T, usize>` frequency map | an `entry()` loop |
| `counts_by(f)` | frequency by a derived key | — |
| `into_group_map()` | `HashMap<K, Vec<V>>` from pairs | an `entry().or_default().push()` loop |
| `into_group_map_by(f)` | the same, key from a closure | — |
| `chunk_by(f)` | group **consecutive** equal-key runs | — |
| `dedup()` | collapse consecutive duplicates | `Vec::dedup` (slices only) |
| `dedup_with_count()` | collapse and report run lengths | — |

> [!best] `counts()` and `into_group_map()` replace the two most common loops in Rust
> Counting occurrences and grouping by key are the [collection recipes](#/ch/collections-recipes) you write most often, and itertools turns each into one expression. `text.split_whitespace().counts()` is a complete word-frequency counter. The std versions are worth knowing — you'll read them in other people's code — but for new code these are shorter and harder to get wrong.

> [!mistake] `chunk_by` needs the input sorted; `into_group_map` does not
> `chunk_by` groups only **consecutive** items with the same key, exactly like Unix `uniq`. On unsorted input it produces many small groups instead of a few large ones — silently, with no error. If you want true grouping, either `sorted_by_key` first or use `into_group_map`, which uses a `HashMap` and doesn't care about order. This is the single most common itertools surprise.

## Sorting as an expression

`Vec::sort` needs a mutable binding. `sorted()` returns an iterator, so it fits in a chain.

```rust
use itertools::Itertools;

fn main() {
    let scores = [("ada", 92), ("grace", 78), ("alan", 92), ("hedy", 85)];

    // No `let mut`, no separate collect-then-sort step.
    let ranked: Vec<_> = scores.iter().sorted_by_key(|(_, s)| std::cmp::Reverse(*s)).collect();
    println!("{ranked:?}");

    // k_smallest / k_largest: O(n log k), not a full sort.
    let nums = [17, 3, 92, 45, 8, 61, 30];
    println!("3 smallest: {:?}", nums.iter().k_smallest(3).collect::<Vec<_>>());
    println!("3 largest:  {:?}", nums.iter().copied().sorted().rev().take(3).collect::<Vec<_>>());

    // min/max in one pass, as an enum that handles the empty and single cases.
    println!("minmax: {:?}", nums.iter().minmax());

    // position_max / position_min: the INDEX of the extreme, not the value.
    println!("index of max: {:?}", nums.iter().position_max());

    // sorted_by with a full comparator, then chained further:
    let top_two_names: Vec<&str> = scores
        .iter()
        .sorted_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)))
        .take(2)
        .map(|(name, _)| *name)
        .collect();
    println!("top two: {top_two_names:?}");
}
```

| Adapter | Does |
|---|---|
| `sorted()` | sort, returning an iterator |
| `sorted_by(cmp)` / `sorted_by_key(f)` | sort with a comparator or key |
| `sorted_unstable_by_key(f)` | the faster, non-stable variant |
| `k_smallest(k)` / `k_largest(k)` | the `k` extremes in O(n log k) |
| `minmax()` | both extremes in one pass, as `MinMaxResult` |
| `position_max()` / `position_min()` | the **index** of the extreme |
| `max_by_key(f)` | std has this, but note `max_set_by_key` for ties |

## Combining and pairing iterators

```rust
use itertools::Itertools;

fn main() {
    // tuple_windows: overlapping tuples, typed — better than slice windows
    // because you get named elements instead of indexing w[0], w[1].
    let temps = [18.0, 21.5, 19.0, 25.0];
    for (a, b) in temps.iter().tuple_windows() {
        println!("change: {:+.1}", b - a);
    }

    // tuples: NON-overlapping fixed-size groups.
    let flat = [1, 2, 3, 4, 5, 6];
    for (a, b, c) in flat.iter().tuples() {
        println!("triple: {a} {b} {c}");
    }

    // cartesian_product: every combination of two iterators.
    let sizes = ["S", "M"];
    let colours = ["red", "blue"];
    let skus: Vec<String> = sizes
        .iter()
        .cartesian_product(colours.iter())
        .map(|(s, c)| format!("{c}-{s}"))
        .collect();
    println!("\nSKUs: {skus:?}");

    // izip!: zip three or more iterators at once. std's zip only takes two,
    // so nesting produces ugly ((a, b), c) tuples.
    let names = ["ada", "grace"];
    let ages = [36, 45];
    let cities = ["London", "New York"];
    for (name, age, city) in itertools::izip!(names, ages, cities) {
        println!("{name}, {age}, {city}");
    }

    // interleave / intersperse
    let a = [1, 3, 5];
    let b = [2, 4, 6];
    println!("\ninterleaved: {:?}", a.iter().interleave(b.iter()).collect::<Vec<_>>());

    // zip_longest: keep going after the shorter side ends.
    use itertools::EitherOrBoth;
    let short = [1, 2];
    let long = [10, 20, 30];
    for pair in short.iter().zip_longest(long.iter()) {
        match pair {
            EitherOrBoth::Both(a, b) => println!("both {a} {b}"),
            EitherOrBoth::Left(a) => println!("only left {a}"),
            EitherOrBoth::Right(b) => println!("only right {b}"),
        }
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 235" role="img" aria-label="Diagram contrasting tuple_windows which overlaps, tuples which does not, and cartesian product which pairs every combination">
  <style>
    .it-h { font: 700 12px var(--font-sans); }
    .it-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .it-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .it-box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .it-g1 { fill: none; stroke: var(--rust-500); stroke-width: 2; }
    .it-g2 { fill: none; stroke: var(--blue); stroke-width: 2; }
    .it-g3 { fill: none; stroke: var(--teal); stroke-width: 2; }
  </style>
  <text x="20" y="18" class="it-h" fill="var(--rust-600)">tuple_windows() — overlapping pairs</text>
  <g class="it-m">
    <rect x="20" y="28" width="40" height="26" class="it-box"/><text x="35" y="46">1</text>
    <rect x="60" y="28" width="40" height="26" class="it-box"/><text x="75" y="46">2</text>
    <rect x="100" y="28" width="40" height="26" class="it-box"/><text x="115" y="46">3</text>
    <rect x="140" y="28" width="40" height="26" class="it-box"/><text x="155" y="46">4</text>
  </g>
  <rect x="17" y="24" width="86" height="16" rx="3" class="it-g1"/>
  <rect x="57" y="42" width="86" height="16" rx="3" class="it-g1"/>
  <rect x="97" y="60" width="86" height="16" rx="3" class="it-g1"/>
  <text x="230" y="46" class="it-m">(1,2) (2,3) (3,4)</text>
  <text x="20" y="104" class="it-h" fill="var(--blue)">tuples() — non-overlapping groups</text>
  <g class="it-m">
    <rect x="20" y="114" width="40" height="26" class="it-box"/><text x="35" y="132">1</text>
    <rect x="60" y="114" width="40" height="26" class="it-box"/><text x="75" y="132">2</text>
    <rect x="100" y="114" width="40" height="26" class="it-box"/><text x="115" y="132">3</text>
    <rect x="140" y="114" width="40" height="26" class="it-box"/><text x="155" y="132">4</text>
  </g>
  <rect x="17" y="111" width="86" height="32" rx="3" class="it-g2"/>
  <rect x="97" y="111" width="86" height="32" rx="3" class="it-g2"/>
  <text x="230" y="132" class="it-m">(1,2) (3,4)</text>
  <text x="20" y="180" class="it-h" fill="var(--teal)">cartesian_product() — every combination</text>
  <g class="it-m">
    <rect x="20" y="190" width="40" height="26" class="it-box"/><text x="33" y="208">S</text>
    <rect x="60" y="190" width="40" height="26" class="it-box"/><text x="73" y="208">M</text>
    <text x="112" y="208" class="it-c">×</text>
    <rect x="130" y="190" width="46" height="26" class="it-box"/><text x="139" y="208">red</text>
    <rect x="176" y="190" width="52" height="26" class="it-box"/><text x="184" y="208">blue</text>
  </g>
  <text x="255" y="208" class="it-m">(S,red) (S,blue) (M,red) (M,blue)</text>
  <text x="20" y="232" class="it-c">All three are lazy — nothing is computed until you consume the iterator.</text>
</svg>
<figcaption><b>tuple_windows</b> slides, <b>tuples</b> partitions, <b>cartesian_product</b> multiplies. Typed tuples mean named bindings instead of <code>w[0]</code>.</figcaption>
</figure>

> [!tip] `tuple_windows()` over `windows()` when you want named elements
> `slice.windows(2)` gives you `&[T]`, so you write `w[0]` and `w[1]` — and the compiler can't tell you if you meant `windows(3)`. `tuple_windows()` gives `(a, b)`, so the arity is in the type and the bindings have names. It also works on **any** iterator, not just slices, so you can use it on a `Lines` reader without collecting first.

## Combinatorics

```rust
use itertools::Itertools;

fn main() {
    let items = ["a", "b", "c"];

    // permutations: ORDER matters. 3P2 = 6.
    println!("permutations of 2:");
    for p in items.iter().permutations(2) {
        print!("{p:?} ");
    }
    println!("\n  count = {}", items.iter().permutations(2).count());

    // combinations: order does NOT matter. 3C2 = 3.
    println!("\ncombinations of 2:");
    for c in items.iter().combinations(2) {
        print!("{c:?} ");
    }
    println!("\n  count = {}", items.iter().combinations(2).count());

    // powerset: every subset, including empty and full. 2^3 = 8.
    println!("\npowerset has {} subsets", items.iter().powerset().count());

    // combinations_with_replacement: repeats allowed.
    println!("with replacement: {}", items.iter().combinations_with_replacement(2).count());
}
```

| Adapter | Yields | Count for n=3, k=2 |
|---|---|---|
| `permutations(k)` | ordered selections | 6 |
| `combinations(k)` | unordered selections | 3 |
| `combinations_with_replacement(k)` | unordered, repeats allowed | 6 |
| `powerset()` | every subset | 8 (2ⁿ) |
| `cartesian_product(other)` | every pair across two iterators | 9 (n×m) |
| `multi_cartesian_product()` | every combination across many iterators | varies |

> [!warning] Combinatorial adapters grow explosively
> `permutations(k)` over 12 items with `k = 12` is 479 million tuples. `powerset()` over 30 items is a billion subsets. These are lazy, so you won't run out of memory immediately — you'll just run for hours. Always bound the input, and prefer `.take(n)` or an early-exiting `.find()` over `.collect()`. If you find yourself needing all permutations of a large set, the real answer is usually a different algorithm — see [Recursion & Backtracking](#/ch/dsa-recursion).

## Chunking, batching and processing

```rust
use itertools::Itertools;

fn main() {
    let ids: Vec<u32> = (1..=10).collect();

    // chunks over ANY iterator (std's chunks is slices only).
    // Note: needs &chunks because the groups borrow from the iterator.
    for batch in &ids.iter().chunks(4) {
        println!("batch: {:?}", batch.collect::<Vec<_>>());
    }

    // process_results: run a fallible pipeline, short-circuiting on the first Err.
    let inputs = ["1", "2", "3"];
    let total: Result<i32, _> = itertools::process_results(
        inputs.iter().map(|s| s.parse::<i32>()),
        |iter| iter.sum(),
    );
    println!("\nsum of parsed: {total:?}");

    let bad = ["1", "oops", "3"];
    let failed: Result<i32, _> = itertools::process_results(
        bad.iter().map(|s| s.parse::<i32>()),
        |iter| iter.sum(),
    );
    println!("with a bad value: {}", failed.is_err());

    // exactly_one: assert an iterator yields precisely one item.
    let single = [42].iter().exactly_one();
    let multiple = [1, 2].iter().exactly_one();
    println!("\nexactly_one on [42]:  ok = {}", single.is_ok());
    println!("exactly_one on [1,2]: ok = {}", multiple.is_ok());

    // at_most_one, and the FoldWhile early-exit fold:
    use itertools::FoldWhile::{Continue, Done};
    let running = [1, 2, 3, 4, 5]
        .iter()
        .fold_while(0, |acc, &x| if acc + x > 6 { Done(acc) } else { Continue(acc + x) })
        .into_inner();
    println!("sum until it would exceed 6: {running}");

    // with_position tells you where you are in the iteration.
    use itertools::Position;
    for (pos, item) in ["a", "b", "c"].iter().with_position() {
        let label = match pos {
            Position::First => "first",
            Position::Middle => "middle",
            Position::Last => "last",
            Position::Only => "only",
        };
        println!("{item} is {label}");
    }
}
```

| Adapter | Use for |
|---|---|
| `chunks(n)` | batching any iterator (not just slices) |
| `process_results(iter, f)` | a fallible pipeline that stops at the first `Err` |
| `exactly_one()` / `at_most_one()` | asserting cardinality, returning `Result` |
| `fold_while(init, f)` | a fold that can stop early |
| `with_position()` | special-casing the first or last item |
| `pad_using(n, f)` | extending a short iterator to length `n` |
| `format(sep)` | lazy `join` — no intermediate `String` |
| `tee()` | consume one iterator twice |
| `peeking_take_while(f)` | `take_while` that doesn't discard the failing item |

> [!performance] `format()` instead of `join()` when writing straight out
> `iter.join(", ")` builds a whole `String`. `iter.format(", ")` returns a lazy `Display` value that writes directly into the formatter — so `println!("{}", nums.iter().format(", "))` produces no intermediate allocation at all. For large collections written to a file or socket, that's a real saving, and it's a drop-in replacement wherever the result goes straight into a `write!`.

> [!mistake] `peeking_take_while` exists because `take_while` eats an item
> `take_while` must *consume* an element to test it, so the first failing item is gone — which breaks the common "parse a run of digits, then continue from the next character" pattern. `peeking_take_while` uses `Peekable` to test without consuming, leaving the boundary item available. If a hand-written tokenizer keeps losing a character, this is why. See [Parsing](#/ch/parsing).

## When not to use itertools

| Situation | Prefer |
|---|---|
| the std adapter already does it | std — one less dependency to justify |
| a plain `for` loop is clearer | the loop; chains can be less readable, not more |
| you need it in `no_std` without alloc | check the feature flags; some adapters need `alloc` |
| a five-adapter chain nobody can follow | intermediate `let` bindings with names |
| grouping a huge dataset | a `HashMap` you control, so you can stream it |

> [!best] Learn the std versions first, reach for itertools second
> Every recipe in this chapter has a std equivalent, usually two or three lines longer. Knowing both means you can read any Rust codebase, and it means you're not adding a dependency to a small crate for one adapter. But for an application, itertools is a well-maintained, dependency-free, extremely stable crate — adding it is not a decision you'll regret.

## Summary

- `itertools` is an **extension trait**: `use itertools::Itertools;` is what makes every adapter appear on any iterator.
- The headline adapters: **`counts()`** (frequency map), **`into_group_map()`** (multimap), **`unique()`** (order-preserving dedup), **`sorted_by_key()`** (sort as an expression).
- **`chunk_by` needs sorted input** (it groups consecutive runs); `into_group_map` doesn't care.
- **`tuple_windows()`** and **`tuples()`** give named tuple bindings instead of `w[0]`, and work on any iterator.
- **`izip!`** zips three or more iterators without nested tuples.
- Combinatorics (`permutations`, `combinations`, `powerset`) is one call away — and grows explosively, so bound your input.
- **`process_results`** runs a fallible pipeline with short-circuiting; **`fold_while`** folds with an early exit; **`with_position`** special-cases first and last.
- **`format(sep)`** is a zero-allocation `join` when the output goes straight into a `write!`.
- Learn the std equivalents first; adopt itertools for applications without hesitation.

> [!exercise] Try it yourself
> 1. Write a one-line word-frequency counter with `counts()`, then print the top three with `sorted_by_key` and `Reverse`.
> 2. Group a list of file names by extension using `into_group_map_by`, then do it again with `chunk_by` on unsorted input. Explain the difference in the output.
> 3. Use `tuple_windows()` to find the largest day-over-day increase in a list of temperatures.
> 4. Generate every two-item combination of five ingredients, then every permutation. Why are the counts different?
> 5. Use `process_results` to sum a list of strings parsed as integers, and confirm it stops at the first invalid entry.
> 6. Take a five-adapter chain you've written and rewrite it with two named intermediate bindings. Which version would you rather review?

Next: keeping expensive values around without a `static mut` — **OnceLock, LazyLock and global state**.
