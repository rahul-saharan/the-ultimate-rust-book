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
- The hierarchy (best → worst): **O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)**; the gap between `n log n` and `n²` is enormous at scale.
- Count loops to estimate: one loop → `O(n)`, nested → `O(n²)`, halving → `O(log n)`.
- Distinguish **worst/average/best** case (quote worst), understand **amortized** O(1) (like `Vec::push`), and measure **space** as well as time (the **time–space trade-off**).
- Choosing the right complexity class beats any language or hardware optimization.

> [!exercise] Try it yourself
> 1. What's the Big-O of a function with two *separate* (not nested) loops over the input? What about three nested loops?
> 2. Rewrite an `O(n²)` "does this list contain duplicates?" check as `O(n)` using a `HashSet`, and explain the time–space trade-off.
> 3. Binary search does ~20 steps for a million items. How many for a *billion*? (Hint: log₂.)

With Big-O in hand, let's start building — beginning with the most fundamental structure of all: the **array** (and Rust's `Vec`).
