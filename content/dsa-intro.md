<h1><span class="h1-kicker">Data Structures & Algorithms</span>Big-O & How to Think About Algorithms</h1>

Welcome to the algorithms course — a complete tour of the data structures and algorithms every programmer should know, implemented in idiomatic Rust. Before we build anything, we need a way to *talk about* efficiency: how does an algorithm's cost grow as the data grows? That's **Big-O notation**, and this chapter makes it intuitive. Master it and you'll make good performance decisions everywhere in your career.

## Why we measure growth, not seconds

A stopwatch tells you an algorithm took 3ms *on your machine, with that input, today*. Useless for comparing algorithms. What we really want to know is: **how does the cost scale as the input grows?** If you double the data, does the work double? Quadruple? Stay the same? That *shape of growth* is what determines whether your program handles a thousand items or a billion.

> [!key] Big-O describes growth, ignoring constants
> **Big-O notation** describes how an algorithm's time (or space) grows relative to input size `n`, as `n` gets large — ignoring constant factors and lower-order terms. `O(n)` means "work grows proportionally to `n`"; `O(n²)` means "quadruple the data → 16× the work." We drop constants (`O(2n)` = `O(n)`) because we care about the *shape* of growth, not machine-specific details. It's the universal language for "will this scale?"

## The complexity hierarchy

Here are the growth rates you'll meet, from best to worst:

<figure class="diagram">
<svg viewBox="0 0 640 260" role="img" aria-label="Big-O growth curves from O(1) flat to O(n squared) steep">
  <style>
    .bgm { font: 600 11px var(--font-mono); }
    .bgc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .axis { stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <line x1="50" y1="220" x2="600" y2="220" class="axis"/>
  <line x1="50" y1="220" x2="50" y2="20" class="axis"/>
  <text x="300" y="245" class="bgc">input size n →</text>
  <text x="10" y="120" class="bgc" transform="rotate(-90 15 120)">operations →</text>
  <!-- O(1) -->
  <path d="M50 210 L600 210" stroke="var(--green)" stroke-width="2.5" fill="none"/>
  <text x="605" y="212" class="bgm" fill="var(--green)">O(1)</text>
  <!-- O(log n) -->
  <path d="M50 205 Q 200 180, 600 165" stroke="var(--teal)" stroke-width="2.5" fill="none"/>
  <text x="560" y="150" class="bgm" fill="var(--teal)">O(log n)</text>
  <!-- O(n) -->
  <path d="M50 218 L600 90" stroke="var(--blue)" stroke-width="2.5" fill="none"/>
  <text x="605" y="90" class="bgm" fill="var(--blue)">O(n)</text>
  <!-- O(n log n) -->
  <path d="M50 218 Q 350 120, 560 45" stroke="var(--purple)" stroke-width="2.5" fill="none"/>
  <text x="500" y="40" class="bgm" fill="var(--purple)">O(n log n)</text>
  <!-- O(n^2) -->
  <path d="M50 220 Q 220 200, 330 30" stroke="var(--red)" stroke-width="2.5" fill="none"/>
  <text x="340" y="30" class="bgm" fill="var(--red)">O(n²)</text>
</svg>
<figcaption>As <code>n</code> grows, the curves diverge dramatically — the difference between <code>O(n log n)</code> and <code>O(n²)</code> is the difference between "instant" and "hangs".</figcaption>
</figure>

| Big-O | Name | Example | For n = 1,000,000 |
|-------|------|---------|-------------------|
| **O(1)** | constant | array index, HashMap lookup | 1 op |
| **O(log n)** | logarithmic | binary search | ~20 ops |
| **O(n)** | linear | scanning a list | 1,000,000 ops |
| **O(n log n)** | linearithmic | good sorting (mergesort) | ~20,000,000 ops |
| **O(n²)** | quadratic | nested loops, bubble sort | 1,000,000,000,000 ops 😱 |
| **O(2ⁿ)** | exponential | brute-force subsets | astronomically huge |

> [!key] The gulf between O(n log n) and O(n²)
> For a million items, an `O(n log n)` algorithm does ~20 million operations (a blink); an `O(n²)` algorithm does a *trillion* (minutes to hours). This is why "which algorithm?" matters far more than "which language?" or "how fast is my CPU?". Picking the right complexity class is the single biggest performance lever you have.

### O, Ω, and Θ — the three you'll see written down

Big-O is an **upper** bound, and that's all it claims. Two siblings complete the picture, and you'll meet them in papers, textbooks, and interview questions:

| Notation | Says | Read as |
|---|---|---|
| **O(f)** | grows *no faster* than `f` | an upper bound — "at most" |
| **Ω(f)** | grows *no slower* than `f` | a lower bound — "at least" |
| **Θ(f)** | both at once | a tight bound — "exactly this shape" |

Strictly, insertion sort is `Θ(n²)` in the worst case and `Θ(n)` in the best, so saying it's `O(n²)` is true but loose — it's also `O(n³)`, which is technically correct and useless. In practice everyone says "O" and means "Θ of the worst case", and this book follows that convention.

> [!note] Why the base of the logarithm never matters
> You'll see `O(log n)` without a base, and that's not sloppiness. Changing base only multiplies by a constant — `log₂ n = log₁₀ n / log₁₀ 2` ≈ `3.32 × log₁₀ n` — and Big-O discards constants. So `O(log₂ n)`, `O(log₁₀ n)`, and `O(ln n)` are the *same class*. When it matters concretely (like "how many steps does binary search take?") the base is 2, because each step halves the search space.

### What complexity can you afford?

This is the most practical table in the chapter. Assuming roughly 10⁸ simple operations per second — a reasonable rule of thumb for compiled Rust — here's the largest `n` each class can handle in about a second:

| If `n` is up to… | You need at most | Typical approach |
|---|---|---|
| 10–12 | O(n!) | brute-force permutations |
| ~25 | O(2ⁿ) | subset enumeration, bitmask DP |
| ~500 | O(n³) | Floyd–Warshall, matrix chain DP |
| ~5,000 | O(n²) | nested loops, simple DP tables |
| ~10⁶ | O(n log n) | sorting, heaps, divide and conquer |
| ~10⁸ | O(n) | a single pass, counting, hashing |
| unbounded | O(log n) / O(1) | binary search, direct indexing |

Read it backwards and it becomes a design tool: **the input size tells you which complexity you're allowed**, which in turn narrows the algorithm enormously. If a problem says `n ≤ 20`, an exponential solution is *expected*. If it says `n ≤ 10⁶`, anything quadratic is out before you write a line.

## Seeing it in code

Let's make the classes concrete. Each function has a different growth rate:

```rust
// O(1) — constant: one operation regardless of input size.
fn first(v: &[i32]) -> Option<&i32> {
    v.first()
}

// O(n) — linear: touches each element once.
fn sum(v: &[i32]) -> i32 {
    let mut total = 0;
    for &x in v { total += x; } // n iterations
    total
}

// O(n²) — quadratic: a loop inside a loop.
fn has_duplicate_slow(v: &[i32]) -> bool {
    for i in 0..v.len() {
        for j in (i + 1)..v.len() { // n × n comparisons
            if v[i] == v[j] { return true; }
        }
    }
    false
}

fn main() {
    let data = vec![3, 1, 4, 1, 5];
    println!("first: {:?}", first(&data));
    println!("sum: {}", sum(&data));
    println!("has duplicate: {}", has_duplicate_slow(&data));
}
```

That `has_duplicate_slow` is `O(n²)` — fine for 5 elements, catastrophic for a million. Using a `HashSet` turns it into `O(n)`:

```rust
use std::collections::HashSet;

// O(n) — one pass, O(1) set lookups.
fn has_duplicate_fast(v: &[i32]) -> bool {
    let mut seen = HashSet::new();
    for &x in v {
        if !seen.insert(x) { // insert returns false if already present
            return true;
        }
    }
    false
}

fn main() {
    println!("{}", has_duplicate_fast(&[1, 2, 3, 2])); // true
}
```

Same result, wildly different scaling — the essence of algorithm design.

## Watching the growth happen

Talk of "quadruple the work" is abstract until you see the numbers. Rather than time a stopwatch — which is noisy and machine-dependent — count the operations exactly:

```rust
fn log2_floor(n: u64) -> u64 {
    (u64::BITS - n.leading_zeros()) as u64
}

fn ops_linear(n: u64) -> u64 { n }
fn ops_nlogn(n: u64) -> u64 { n * log2_floor(n) }
/// A nested loop over every unordered pair does n(n-1)/2 comparisons.
fn ops_quadratic(n: u64) -> u64 { n * (n - 1) / 2 }

fn main() {
    println!("{:>10} | {:>6} | {:>10} | {:>12} | {:>16}",
        "n", "log n", "n", "n log n", "n(n-1)/2");
    println!("{}", "-".repeat(66));
    for &n in &[10u64, 100, 1_000, 10_000, 100_000, 1_000_000] {
        println!("{:>10} | {:>6} | {:>10} | {:>12} | {:>16}",
            n, log2_floor(n), ops_linear(n), ops_nlogn(n), ops_quadratic(n));
    }

    println!("\nWhat happens each time you DOUBLE the input:");
    println!("{:>10} | {:>14} | {:>14} | {:>10}", "n", "n log n ops", "quadratic ops", "quad ratio");
    let mut prev = 0u64;
    for &n in &[1_000u64, 2_000, 4_000, 8_000] {
        let q = ops_quadratic(n);
        let ratio = if prev == 0 {
            String::from("-")
        } else {
            format!("{:.2}x", q as f64 / prev as f64)
        };
        println!("{:>10} | {:>14} | {:>14} | {:>10}", n, ops_nlogn(n), q, ratio);
        prev = q;
    }
    println!("\nQuadratic work multiplies by exactly 4 each doubling (2² = 4),");
    println!("while n log n barely more than doubles. That gap is everything.");
}
```

At `n = 1,000,000` the quadratic column reads **499,999,500,000** against `n log n`'s **20,000,000** — a factor of 25,000. No amount of faster hardware closes that.

> [!performance] Measure operations, not milliseconds, when comparing algorithms
> Wall-clock timing is the right tool for *tuning a specific implementation* (see [Benchmarking](#/ch/benchmarking)), but it's a poor way to compare *complexity classes*. Timings wobble with CPU frequency scaling, cache state, and other processes — I've seen the same quadratic-vs-linear comparison report ratios of 3.0× and 6.1× on consecutive runs when the true answer is 4×. Counting operations is deterministic, reproducible, and machine-independent. Use timings to confirm a real speedup; use counting to understand *why* it's there.

## Deriving complexity from code

The rules in the summary work, but real code needs a little care. Four shapes cover almost everything:

```rust,ignore
// 1. Sequential loops ADD, and the larger wins.
for x in &v { /* O(n) */ }
for x in &v { /* O(n) */ }
// O(n) + O(n) = O(2n) = O(n)   ← not O(n²)

// 2. Nested loops MULTIPLY.
for i in 0..n {
    for j in 0..n { /* O(1) */ }
}
// O(n × n) = O(n²)

// 3. A dependent inner loop is still quadratic.
for i in 0..n {
    for j in i..n { /* runs n-i times */ }
}
// n + (n-1) + … + 1 = n(n+1)/2 = O(n²)   ← the ½ is a constant, so it drops

// 4. Halving (or doubling) is logarithmic.
let mut k = n;
while k > 1 { k /= 2; }
// O(log n)
```

> [!mistake] Assuming nesting always means O(n²)
> Two nested loops are only quadratic when **both** run proportionally to `n`. These are not:
> ```rust,ignore
> for i in 0..n {
>     for j in 0..10 { }        // inner is CONSTANT → O(10n) = O(n)
> }
>
> for i in 0..n {
>     let mut k = n;
>     while k > 1 { k /= 2; }   // inner is O(log n) → O(n log n)
> }
> ```
> Conversely, a *single* loop can hide quadratic behaviour if the body isn't O(1) — `for x in &v { if other.contains(&x) { } }` is `O(n·m)`, because `contains` on a slice scans. **Always ask what the body costs**, not just how many loops you can see.

## Rust-specific costs worth memorizing

Complexity analysis only works if you know what the standard library actually does. These are the ones that surprise people:

| Looks cheap | Actually | Use instead |
|---|---|---|
| `vec.remove(0)` | **O(n)** — shifts every element | `VecDeque::pop_front` — O(1) |
| `vec.insert(0, x)` | **O(n)** | `VecDeque::push_front` — O(1) |
| `vec.contains(&x)` | **O(n)** — linear scan | `HashSet::contains` — O(1) |
| `slice.iter().position(..)` | **O(n)** | a `HashMap` index, if repeated |
| `s.chars().nth(i)` | **O(i)** — UTF-8 has no random access | iterate once, or index bytes |
| `format!` / `+` in a loop | O(n²) total — reallocates each time | `String::push_str`, or `with_capacity` |
| `vec.clone()` inside a loop | O(n) each time | borrow, or hoist the clone out |
| `sort()` then `binary_search` once | O(n log n) for a single lookup | just `iter().find()` — O(n) |
| `HashMap` iteration order | unspecified | `BTreeMap` if you need order |
| `vec.push` | **amortized** O(1) | `with_capacity(n)` to avoid regrowth |

> [!best] The two questions that catch most complexity bugs
> **First: what is inside the loop?** A method call that looks atomic — `contains`, `remove(0)`, `chars().nth()`, `clone()` — may itself be O(n), silently turning your linear pass quadratic. This is by far the most common real-world cause of "it worked on test data and hung in production".
>
> **Second: what does `n` actually count?** Complexity over "the number of users" and over "the number of orders per user" are different questions, and `O(n·m)` is not `O(n²)` unless the two really do grow together. Naming your variables in the analysis — `O(users × orders)` — keeps you honest and often reveals which one to index.

## Best, worst, and average case

An algorithm's complexity can differ by scenario. **Worst case** (the guarantee — usually what we quote) is the ceiling; **average case** is typical; **best case** is the lucky path. For example, searching a list for an item is `O(1)` best case (it's first), `O(n)` worst case (it's last or absent).

> [!jargon] Amortized complexity
> Some operations are usually cheap but occasionally expensive. Pushing to a [`Vec`](#/ch/vectors) is `O(1)` almost always, but *sometimes* triggers an `O(n)` reallocation. Averaged over many pushes, the cost is still `O(1)` — we call this **amortized O(1)**. It means "cheap on average, even if one call in a while is pricey." `Vec::push` and `HashMap::insert` are amortized O(1).

## Space complexity too

Big-O also measures **memory**. An algorithm that builds a copy of the input uses `O(n)` extra space; one that works in place uses `O(1)`. There's often a **time–space trade-off**: our `has_duplicate_fast` spends `O(n)` memory (the `HashSet`) to save time. Choosing where to sit on that trade-off is a core skill.

> [!best] How to analyze an algorithm quickly
> 1. **Count the loops over the input.** One loop → `O(n)`. A loop inside a loop → `O(n²)`.
> 2. **Halving each step → `O(log n)`** (binary search, balanced trees).
> 3. **`O(n log n)`** is the signature of good comparison sorts and divide-and-conquer.
> 4. **Drop constants and lower terms**: `O(3n + 5)` → `O(n)`; `O(n² + n)` → `O(n²)`.
> 5. **State the worst case** unless told otherwise, and note the **space** cost too.
>
> With practice you'll read a function and see its Big-O at a glance — the goal of this whole course.

## Summary

- **Big-O** describes how work grows with input size `n`, ignoring constants — the language for "will it scale?"
- **O** is an upper bound, **Ω** a lower bound, **Θ** a tight one. Everyone writes O and means Θ of the worst case.
- The **base of a logarithm never matters** in Big-O — it's only a constant factor.
- The hierarchy (best → worst): **O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)**; the gap between `n log n` and `n²` is enormous at scale.
- **Input size dictates allowed complexity**: `n ≤ 25` invites exponential, `n ≤ 5,000` allows quadratic, `n ≈ 10⁶` demands `O(n log n)` or better. Use the table above as a design tool.
- Count loops to estimate: sequential loops **add**, nested loops **multiply**, halving gives `O(log n)`. But a dependent inner loop (`for j in i..n`) is still quadratic, and a constant inner loop is not.
- **Ask what's inside the loop.** `vec.contains`, `vec.remove(0)`, `chars().nth()`, and `clone()` are all O(n) and quietly make a linear pass quadratic.
- Distinguish **worst/average/best** case (quote worst), understand **amortized** O(1) (like `Vec::push`), and measure **space** as well as time (the **time–space trade-off**).
- **Count operations, not milliseconds**, when comparing complexity classes — timings are too noisy to see the shape.
- Choosing the right complexity class beats any language or hardware optimization.

> [!exercise] Try it yourself
> 1. What's the Big-O of a function with two *separate* (not nested) loops over the input? What about three nested loops?
> 2. Rewrite an `O(n²)` "does this list contain duplicates?" check as `O(n)` using a `HashSet`, and explain the time–space trade-off.
> 3. Binary search does ~20 steps for a million items. How many for a *billion*? (Hint: log₂.)
> 4. Run the operation-counting program and extend it with an `O(n³)` column. At what `n` does it pass a trillion operations?
> 5. Write a function that builds a `String` by `push_str` in a loop, and another using `format!` reassignment (`s = format!("{s}{x}")`). Explain why the second is O(n²).
> 6. Time `vec.remove(0)` in a loop against `VecDeque::pop_front` for 100,000 elements. Predict the ratio before you measure.
> 7. A problem states `n ≤ 18` and asks for the best route visiting every city. What complexity is the setter expecting, and why is that a hint about the *technique*?

With Big-O in hand, let's start building — beginning with the most fundamental structure of all: the **array** (and Rust's `Vec`).
