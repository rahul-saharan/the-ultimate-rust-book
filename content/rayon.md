<h1><span class="h1-kicker">Fearless Concurrency</span>Data Parallelism with Rayon</h1>

Everything so far has been *manual* concurrency — you spawn threads and coordinate them yourself. But an enormous fraction of real parallel work is just "do this same thing to every item in a big collection, using all my cores." For that, the **`rayon`** crate is magic: you change `.iter()` to `.par_iter()` and your loop runs in parallel — safely, with no other changes. This chapter shows the easiest performance win in Rust.

> [!note] `rayon` is a crate — add it with `cargo add rayon`
> Unlike threads, channels, and atomics (which are in `std`), Rayon lives on crates.io. The examples below need `rayon` in your `Cargo.toml`, so they're marked as illustrative rather than runnable in the in-book playground. On your own machine, `cargo add rayon` and they compile and fly.

## Parallelism by changing one word

Here's a sequential computation and its parallel twin. Spot the difference:

```rust,ignore
use rayon::prelude::*;

fn main() {
    let numbers: Vec<u64> = (1..=1_000_000).collect();

    // Sequential — one core:
    let sum: u64 = numbers.iter().map(|&n| n * n).sum();

    // Parallel — ALL cores. The ONLY change is iter → par_iter:
    let par_sum: u64 = numbers.par_iter().map(|&n| n * n).sum();

    println!("{sum} == {par_sum}");
}
```

That's the whole idea. `par_iter()` gives you a **parallel iterator** with the same adapters you already know — `map`, `filter`, `sum`, `collect`, `reduce` — but Rayon automatically splits the work across your CPU cores and combines the results.

> [!key] Why this is safe (and why only Rust can do it so casually)
> Turning a sequential loop parallel is a data-race minefield in most languages. Rust makes it trivial because the [`Send`/`Sync`](#/ch/send-sync) rules already guarantee your closure and data are thread-safe — **if `.par_iter()` compiles, it's free of data races**, exactly like hand-written threads. Rayon leans entirely on the ownership system you've already learned. The safety isn't Rayon's; it's the language's.

## The parallel iterator toolbox

Rayon mirrors the standard iterator API, so your existing knowledge transfers directly:

```rust,ignore
use rayon::prelude::*;

fn main() {
    let data: Vec<i32> = (1..=100).collect();

    // filter + map + collect, in parallel:
    let evens_doubled: Vec<i32> = data
        .par_iter()
        .filter(|&&n| n % 2 == 0)
        .map(|&n| n * 2)
        .collect();

    // parallel reduce (like fold, but combinable across threads):
    let product: i64 = (1..=20i64).into_par_iter().reduce(|| 1, |a, b| a * b);

    // parallel find and any:
    let found = data.par_iter().find_any(|&&n| n > 50);

    println!("{}, {product}, {found:?}", evens_doubled.len());
}
```

| Sequential | Rayon parallel |
|------------|----------------|
| `v.iter()` | `v.par_iter()` |
| `v.iter_mut()` | `v.par_iter_mut()` |
| `v.into_iter()` | `v.into_par_iter()` |
| `(0..n)` | `(0..n).into_par_iter()` |
| `.fold(init, f)` | `.reduce(\|\| init, f)` |
| `.find(p)` | `.find_any(p)` |

## Parallel `for_each` and mutation

To run a side-effecting operation on every item in parallel, use `par_iter_mut().for_each(...)` — Rayon guarantees each element goes to exactly one thread, so mutating in place is safe:

```rust,ignore
use rayon::prelude::*;

fn main() {
    let mut data: Vec<i32> = (1..=1000).collect();

    // Square every element, in parallel, in place:
    data.par_iter_mut().for_each(|n| *n *= *n);

    println!("first few: {:?}", &data[..5]); // [1, 4, 9, 16, 25]
}
```

## `join`: fork two tasks

For "do these two independent things at once," Rayon's `join` runs two closures in parallel and waits for both — the primitive behind divide-and-conquer algorithms like parallel quicksort:

```rust,ignore
use rayon::join;

fn sum_slice(s: &[i64]) -> i64 {
    if s.len() <= 1000 {
        s.iter().sum() // small enough — just do it sequentially
    } else {
        let mid = s.len() / 2;
        // Split, and sum both halves IN PARALLEL, then combine:
        let (left, right) = join(|| sum_slice(&s[..mid]), || sum_slice(&s[mid..]));
        left + right
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Rayon splits a big collection across all CPU cores using a work-stealing thread pool">
  <style>
    .rym { font: 600 12px var(--font-mono); fill: var(--text); }
    .ryc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .whole { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .core { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="220" y="14" width="200" height="30" class="whole"/><text x="234" y="34" class="rym">1,000,000 items</text>
  <rect x="20" y="80" width="130" height="30" class="core"/><text x="34" y="100" class="rym">core 1: 0..250k</text>
  <rect x="180" y="80" width="130" height="30" class="core"/><text x="194" y="100" class="rym">core 2: 250..500k</text>
  <rect x="340" y="80" width="130" height="30" class="core"/><text x="354" y="100" class="rym">core 3: 500..750k</text>
  <rect x="500" y="80" width="120" height="30" class="core"/><text x="514" y="100" class="rym">core 4: 750k+</text>
  <path d="M280 44 L110 78" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#ary)"/>
  <path d="M300 44 L250 78" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#ary)"/>
  <path d="M340 44 L400 78" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#ary)"/>
  <path d="M360 44 L555 78" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#ary)"/>
  <text x="20" y="140" class="ryc">Rayon's work-stealing pool splits the data across cores and balances the load automatically.</text>
  <defs><marker id="ary" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Rayon automatically divides work across a <b>work-stealing</b> thread pool sized to your CPU.</figcaption>
</figure>

## Measure it: the one-word change, timed

Rayon's whole pitch is that `iter()` → `par_iter()` is the entire diff. Here it is with numbers, including the case where parallelism **loses**:

```rust
use rayon::prelude::*;
use std::time::Instant;

/// Deliberately expensive per-item work.
fn heavy(n: u64) -> u64 {
    let mut acc = n;
    for _ in 0..300 {
        acc = acc.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    }
    acc >> 33
}

fn main() {
    println!("cores available: {}\n", rayon::current_num_threads());

    // ── Real work: parallelism wins ──
    let data: Vec<u64> = (0..200_000).collect();

    let t = Instant::now();
    let seq: u64 = data.iter().map(|&n| heavy(n)).sum();
    let seq_ms = t.elapsed().as_millis();

    let t = Instant::now();
    let par: u64 = data.par_iter().map(|&n| heavy(n)).sum();
    let par_ms = t.elapsed().as_millis();

    println!("HEAVY work over 200k items");
    println!("  sequential : {seq_ms:>5} ms");
    println!("  parallel   : {par_ms:>5} ms");
    println!("  identical results: {}", seq == par);

    // ── Trivial work: the overhead dominates ──
    let small: Vec<u64> = (0..2_000).collect();

    let t = Instant::now();
    let s2: u64 = small.iter().map(|&n| n + 1).sum();
    let seq_us = t.elapsed().as_micros();

    let t = Instant::now();
    let p2: u64 = small.par_iter().map(|&n| n + 1).sum();
    let par_us = t.elapsed().as_micros();

    println!("\nTRIVIAL work over 2k items");
    println!("  sequential : {seq_us:>5} µs");
    println!("  parallel   : {par_us:>5} µs   ← often SLOWER");
    println!("  identical results: {}", s2 == p2);
}
```

> [!performance] Parallelism isn't free — use it for real work
> The second half of that program is the important one. Splitting a collection, dispatching to the pool, and joining the results costs real time; when the per-item work is a single addition, that overhead is *all* you measure, and `par_iter` loses to a plain loop — sometimes by a lot.
>
> Rayon pays off when **items × per-item cost** is large: image processing, simulations, hashing, parsing millions of records. It's a poor fit for short collections, trivial operations, or anything I/O-bound (that's [async](#/ch/async-intro), not Rayon — parallel `.await` doesn't exist here).
>
> Because the change is one word, **measuring is nearly free** — so measure rather than assume, and remember the debug/release gap: run these comparisons with `--release`, since debug builds distort both sides. See [Benchmarking & Profiling](#/ch/benchmarking) for doing it properly with criterion.

> [!key] Why the results are always identical
> Notice both halves assert `seq == par`. That isn't luck — Rayon's `sum`, `reduce`, and `collect` are **deterministic**: `collect` preserves the original order regardless of which thread computed which element, and reductions are applied in a fixed tree order. So switching to `par_iter` cannot silently reorder your output.
>
> The exception is anything genuinely order-dependent: `for_each` runs in arbitrary order, and `reduce` with a **non-associative** operation (floating-point addition, notably) can give slightly different results from the sequential version because the grouping changes. If exact float reproducibility matters, keep that reduction sequential.

> [!best] Rayon vs. threads vs. async
> - **Rayon** → *data parallelism*: the same CPU-bound computation over many items ("use all my cores for this loop").
> - **`std::thread`** → a few long-lived, distinct tasks you coordinate manually.
> - **async** (next part) → *concurrency* for I/O-bound waiting (thousands of network connections), not raw CPU crunching.
>
> Reach for Rayon whenever you catch yourself thinking "this loop is embarrassingly parallel."

## Summary

- **Rayon** turns sequential iterators into parallel ones by changing `.iter()` → **`.par_iter()`** (add it with `cargo add rayon`).
- Parallel iterators support the familiar adapters (`map`, `filter`, `sum`, `collect`, `reduce`, `for_each`) and split work across all cores via a **work-stealing** thread pool.
- It's **safe by construction** — Rayon relies on Rust's `Send`/`Sync` rules, so a compiling `par_iter` has no data races.
- **`join`** forks two tasks in parallel — the basis of divide-and-conquer algorithms.
- Parallelism has overhead: use it for **CPU-heavy work on large data**, and measure. Use Rayon for data parallelism, threads for distinct tasks, async for I/O.

> [!exercise] Try it yourself (in a local project with `cargo add rayon`)
> 1. Sum the squares of `1..=10_000_000` with `.iter()` and `.par_iter()`, timing both with `Instant`.
> 2. Use `par_iter_mut().for_each(...)` to normalize a large `Vec<f64>` (divide each by the max) in parallel.
> 3. Write a parallel `count_primes(n)` that checks each number in `2..n` for primality using `par_iter().filter(...).count()`.

You've mastered CPU parallelism. But a huge class of programs spends its time *waiting* — for the network, the disk, a database. Handling thousands of those efficiently is the job of **async Rust**, the next part.
