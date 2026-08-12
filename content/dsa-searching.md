<h1><span class="h1-kicker">Data Structures & Algorithms</span>Searching Algorithms</h1>

Finding an element in a collection is one of the most common operations in all of programming. The approach depends entirely on whether the data is **sorted**. Unsorted? You must check everything — **linear search**, O(n). Sorted? You can be dramatically smarter — **binary search**, O(log n). This chapter covers both and the powerful "binary search on the answer" idea.

## Linear search: O(n)

When data is unsorted, there's no shortcut — you check each element until you find the target (or run out). This is what `iter().position()` / `iter().find()` do:

```rust
fn linear_search(arr: &[i32], target: i32) -> Option<usize> {
    for (i, &value) in arr.iter().enumerate() {
        if value == target {
            return Some(i); // found — stop early
        }
    }
    None
}

fn main() {
    let data = [4, 2, 7, 1, 9, 3];
    println!("{:?}", linear_search(&data, 7)); // Some(2)
    println!("{:?}", linear_search(&data, 5)); // None
    // The idiomatic std equivalent:
    println!("{:?}", data.iter().position(|&x| x == 9)); // Some(4)
}
```

Linear search is O(n) but has one virtue: it works on **any** data, sorted or not. For small or unsorted collections, it's the right (and only) choice.

## Binary search: O(log n)

If the data is **sorted**, binary search is transformative. Check the middle element; if it's not the target, you know which *half* to discard — halving the search space every step. A million elements? ~20 comparisons. A billion? ~30.

```rust
fn binary_search(arr: &[i32], target: i32) -> Option<usize> {
    let (mut lo, mut hi) = (0, arr.len()); // hi is exclusive
    while lo < hi {
        let mid = lo + (hi - lo) / 2; // avoids overflow vs (lo + hi) / 2
        if arr[mid] == target {
            return Some(mid);
        } else if arr[mid] < target {
            lo = mid + 1;  // target is in the right half
        } else {
            hi = mid;      // target is in the left half
        }
    }
    None
}

fn main() {
    let sorted = [1, 3, 5, 7, 9, 11, 13];
    println!("{:?}", binary_search(&sorted, 9));  // Some(4)
    println!("{:?}", binary_search(&sorted, 8));  // None
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Binary search halves the search range each step, checking the middle element">
  <style>
    .bsm { font: 600 11px var(--font-mono); fill: var(--text); }
    .bsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .live { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .dead { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; opacity: .5; }
    .mid { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 2; }
  </style>
  <text x="14" y="22" class="bsc">Searching for 9 in [1,3,5,7,9,11,13]:</text>
  <g class="bsm">
    <text x="14" y="46" class="bsc">step 1:</text>
    <rect x="70" y="32" width="34" height="22" class="live"/><rect x="104" y="32" width="34" height="22" class="live"/><rect x="138" y="32" width="34" height="22" class="live"/><rect x="172" y="32" width="34" height="22" class="mid"/><rect x="206" y="32" width="34" height="22" class="live"/><rect x="240" y="32" width="34" height="22" class="live"/><rect x="274" y="32" width="34" height="22" class="live"/>
    <text x="182" y="48">7</text><text x="320" y="48" class="bsc">mid=7 &lt; 9 → go right</text>
    <text x="14" y="82" class="bsc">step 2:</text>
    <rect x="70" y="68" width="34" height="22" class="dead"/><rect x="104" y="68" width="34" height="22" class="dead"/><rect x="138" y="68" width="34" height="22" class="dead"/><rect x="172" y="68" width="34" height="22" class="dead"/><rect x="206" y="68" width="34" height="22" class="live"/><rect x="240" y="68" width="34" height="22" class="mid"/><rect x="274" y="68" width="34" height="22" class="live"/>
    <text x="250" y="84">11</text><text x="320" y="84" class="bsc">mid=11 &gt; 9 → go left</text>
    <text x="14" y="118" class="bsc">step 3:</text>
    <rect x="206" y="104" width="34" height="22" class="mid"/>
    <text x="216" y="120">9</text><text x="320" y="120" class="bsc">found! ✅ (3 steps, not 7)</text>
  </g>
</svg>
<figcaption>Each comparison discards half the remaining elements — that's why it's O(log n).</figcaption>
</figure>

> [!warning] Binary search requires SORTED data
> Binary search's magic depends entirely on the data being **sorted** — it uses order to decide which half to discard. Run it on unsorted data and it returns wrong answers, not errors. If your data isn't already sorted and you search only once, a linear scan is cheaper than sorting first. Sort up front only when you'll search *many* times.

## Use the standard library

Rust's slice has `binary_search` built in (and it's what you should use in real code). It returns `Result`: `Ok(index)` if found, `Err(insert_position)` if not — the `Err` telling you *where* the element would go, which is often useful:

```rust
fn main() {
    let sorted = [1, 3, 5, 7, 9];

    println!("{:?}", sorted.binary_search(&7)); // Ok(3)
    println!("{:?}", sorted.binary_search(&6)); // Err(3) — would insert at index 3

    // partition_point: the boundary where a predicate flips false — great for
    // "first element ≥ x" / lower-bound queries:
    let idx = sorted.partition_point(|&x| x < 6);
    println!("first element ≥ 6 is at index {idx}"); // 3
}
```

> [!best] `binary_search` and `partition_point` cover most needs
> Prefer **`slice::binary_search`** for exact lookups and **`slice::partition_point`** for "lower/upper bound" queries (first element satisfying a condition). The `Err(pos)` from `binary_search` doubles as "where to insert to keep it sorted" — handy for maintaining a sorted `Vec`. Implement binary search by hand once to understand it (as above); then use `std`.

### The four boundary queries — where duplicates bite

`binary_search` has a problem the moment your data contains **duplicates**: it returns *some* matching index, and which one is unspecified. Almost every real question is a boundary question instead — and all four reduce to `partition_point`:

```rust
/// First index whose value is >= x  (the classic "lower bound").
fn first_ge(a: &[i32], x: i32) -> usize {
    a.partition_point(|&v| v < x)
}

/// First index whose value is > x  (the classic "upper bound").
/// Note the only change: `<` becomes `<=`.
fn first_gt(a: &[i32], x: i32) -> usize {
    a.partition_point(|&v| v <= x)
}

fn last_lt(a: &[i32], x: i32) -> Option<usize> {
    first_ge(a, x).checked_sub(1) // None when nothing is smaller
}

fn last_le(a: &[i32], x: i32) -> Option<usize> {
    first_gt(a, x).checked_sub(1)
}

/// How many times x appears — the gap between the two bounds.
fn count_equal(a: &[i32], x: i32) -> usize {
    first_gt(a, x) - first_ge(a, x)
}

/// The hand-written lower bound, so you can see the loop shape.
/// Note there is NO early return on equality — that's what makes it a boundary
/// search rather than an existence check.
fn lower_bound(a: &[i32], x: i32) -> usize {
    let (mut lo, mut hi) = (0usize, a.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if a[mid] < x {
            lo = mid + 1;
        } else {
            hi = mid; // keep mid as a candidate
        }
    }
    lo
}

fn main() {
    let a = [1, 3, 3, 3, 5, 7, 7, 9];
    println!("array {a:?}\n");
    for x in [3, 4, 7, 0, 10] {
        println!(
            "x={x:>2}  first_ge {}  first_gt {}  last_lt {:?}  last_le {:?}  count {}",
            first_ge(&a, x), first_gt(&a, x), last_lt(&a, x), last_le(&a, x), count_equal(&a, x)
        );
    }
    println!("\nhand-written lower_bound agrees with partition_point everywhere: {}",
        (0..12).all(|x| lower_bound(&a, x) == first_ge(&a, x)));
}
```

| You want | Use | On `[1,3,3,3,5,7,7,9]` with x=3 |
|---|---|---|
| does it exist? | `binary_search(&x).is_ok()` | `true` |
| **first** index ≥ x | `partition_point(\|v\| v < x)` | 1 |
| **first** index > x | `partition_point(\|v\| v <= x)` | 4 |
| last index < x | `first_ge - 1` | 0 |
| last index ≤ x | `first_gt - 1` | 3 |
| how many equal x | `first_gt - first_ge` | 3 |
| the whole equal run | `first_ge..first_gt` | `1..4` |

> [!key] `partition_point` is the primitive; everything else is a predicate change
> All four boundaries are the *same* search with a different predicate — `v < x` versus `v <= x` is the entire difference between lower and upper bound. Rather than memorising four loops, remember one: **`partition_point` returns the index where the predicate stops being true.** The predicate must be monotonic (all `true` then all `false`), which for sorted data any comparison against a fixed `x` satisfies.
>
> Notice too that `lower_bound` has **no early return on equality**. Finding `x` isn't the goal — locating the *boundary* is — so a match must keep searching leftward. Adding an `if a[mid] == x { return mid }` breaks it, and is the most common way people accidentally turn a boundary search back into an existence check.

> [!history] The overflow bug that shipped everywhere for two decades
> That `lo + (hi - lo) / 2` isn't stylistic. Writing `(lo + hi) / 2` overflows when both are large — and this exact bug sat in Java's `Arrays.binarySearch` for nine years, in the JDK, affecting arrays over 2³⁰ elements. Jon Bentley's *Programming Pearls* had published the broken version too. In Rust, `usize` overflow **panics in debug and wraps in release**, so the wrapped version produces a nonsense `mid` and either a wrong answer or an out-of-bounds panic. Prefer `lo + (hi - lo) / 2`, or just use `partition_point`, which gets it right for you.

## Binary search on the answer

A powerful generalization: binary search doesn't only search *arrays* — it searches any **monotonic** space. If "is X feasible?" is false up to some threshold and true after (or vice versa), you can binary-search for the threshold. This solves problems like "minimum capacity to ship in D days" or "smallest x with x² ≥ n":

```rust
// Integer square root via binary search on the answer — O(log n).
fn isqrt(n: u64) -> u64 {
    let (mut lo, mut hi) = (0u64, n + 1);
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if mid.saturating_mul(mid) <= n {
            lo = mid + 1; // mid is feasible; look for a bigger one
        } else {
            hi = mid;
        }
    }
    lo - 1
}

fn main() {
    println!("{}", isqrt(16)); // 4
    println!("{}", isqrt(17)); // 4
    println!("{}", isqrt(99)); // 9
}
```

> [!tip] Recognize "binary search on the answer"
> Whenever a problem asks for the *minimum/maximum value that satisfies some condition*, and the condition is **monotonic** (once true, stays true as the value grows), you can binary-search the value range — turning an O(n) or worse scan into O(log n) checks. It's one of the most powerful and least obvious applications of binary search.

`isqrt` is the toy version. Here is the shape you'll actually meet: a question whose answer isn't in any array, with a **feasibility check** you write yourself.

```rust
/// How many days are needed if each day can carry at most `capacity`?
/// Packages must ship in order, so this is a simple greedy scan.
fn days_needed(weights: &[u32], capacity: u32) -> u32 {
    let mut days = 1;
    let mut load = 0;
    for &w in weights {
        if load + w > capacity {
            days += 1;
            load = 0;
        }
        load += w;
    }
    days
}

/// Smallest capacity that ships everything within `days`.
/// The search space is capacities, not array indices.
fn min_capacity(weights: &[u32], days: u32) -> u32 {
    // The bounds matter: below the heaviest package nothing is feasible,
    // and the total always is (one enormous day).
    let mut lo = *weights.iter().max().expect("non-empty");
    let mut hi = weights.iter().sum::<u32>();

    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if days_needed(weights, mid) <= days {
            hi = mid; // feasible — try smaller
        } else {
            lo = mid + 1; // infeasible — must go bigger
        }
    }
    lo
}

/// Binary search over a CONTINUOUS range needs a different loop condition:
/// floats never converge to lo == hi, so iterate a fixed number of times.
fn cube_root(target: f64) -> f64 {
    let (mut lo, mut hi) = (0.0f64, target.max(1.0));
    for _ in 0..100 {
        // 100 halvings is far more than f64's ~52 bits of mantissa.
        let mid = (lo + hi) / 2.0;
        if mid * mid * mid < target {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    lo
}

fn main() {
    let weights = [1u32, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    println!("weights {weights:?}");
    for days in [1u32, 2, 3, 5, 10] {
        let capacity = min_capacity(&weights, days);
        println!("  within {days:>2} days → capacity {capacity:>2}  (actually uses {})",
            days_needed(&weights, capacity));
    }

    println!("\ncube_root(27) = {:.10}", cube_root(27.0));
    println!("cube_root(2)  = {:.10}", cube_root(2.0));
}
```

> [!key] The recipe: monotonic predicate, then search the *answer* space
> Three steps turn a hard optimisation question into a binary search:
> 1. **Write a feasibility check** — `days_needed(capacity) <= days`. It can be as slow as O(n); you only call it O(log range) times.
> 2. **Confirm it's monotonic** — a bigger capacity never needs *more* days. This is the step to actually verify; without monotonicity, binary search is meaningless.
> 3. **Bound the answer space** — here, the heaviest package (nothing smaller can work) up to the total (always works).
>
> The result is O(n log(range)) instead of trying every capacity. The tell-tale phrasing is "minimum X such that…" or "maximum X such that…", and it shows up constantly: allocating resources, rate limits, "split an array into k parts minimising the largest part", scheduling.

> [!mistake] Binary searching floats with `while lo < hi` never terminates
> Integer binary search ends because the range shrinks to nothing. Floats don't behave that way — `(lo + hi) / 2` can equal `lo` or `hi` exactly once they're adjacent representable values, and `lo < hi` stays true forever. Two correct patterns: **iterate a fixed number of times** (100 halvings exhausts an `f64`'s precision, as above), or loop `while hi - lo > epsilon` with an epsilon appropriate to your scale. The fixed-count version is preferable because it can't loop forever no matter what you feed it, and 100 iterations is still trivially fast.

## Complexity summary

| Algorithm | Data | Time | Notes |
|-----------|------|------|-------|
| Linear search | any | O(n) | works unsorted; simple |
| Binary search | **sorted** | O(log n) | halves the range each step |
| `HashMap` lookup | hashed | O(1) avg | when you need repeated key lookups |

## Summary

- **Linear search** (O(n)) checks every element — the only option for **unsorted** data; it's what `iter().position()`/`find()` do.
- **Binary search** (O(log n)) halves a **sorted** range each step — ~20 steps for a million elements; requires sorted data or it returns garbage.
- With **duplicates**, `binary_search` returns an unspecified match. Use boundaries instead: **`partition_point`** is the one primitive, and `v < x` vs `v <= x` is the entire difference between lower and upper bound.
- The equal run is `first_ge..first_gt`, and its length is the count. A boundary search must **not** early-return on equality.
- Always write `lo + (hi - lo) / 2` — `(lo + hi) / 2` overflows, as it did in the JDK for nine years.
- **Binary search on the answer**: write a feasibility check, **verify it's monotonic**, bound the answer space. Turns "minimum X such that…" into O(n log range).
- **Floats need a fixed iteration count**, not `while lo < hi` — that loop never terminates on continuous ranges.
- Use **`slice::binary_search`** (returns `Ok(idx)`/`Err(insert_pos)`) and **`slice::partition_point`** in real code.
- For repeated exact lookups, a **`HashMap`** (O(1) average) may beat sorting + binary search.

> [!exercise] Try it yourself
> 1. Implement binary search recursively (instead of the loop) and confirm it matches.
> 2. Add `if a[mid] == x { return mid }` to `lower_bound` and find an input where it now returns the wrong index.
> 3. Use "binary search on the answer" to find the smallest integer `x` such that `x * (x+1) / 2 >= 100`.
> 4. Use `binary_search`'s `Err(pos)` to insert into a sorted `Vec` while keeping it sorted. What's the total cost per insertion, and why isn't it O(log n)?
> 5. Write `equal_range(a, x) -> Range<usize>` returning the whole run of equal values, then use it to count occurrences in O(log n).
> 6. Change `min_capacity`'s lower bound from `max()` to `0`. Does it still work? What about starting `hi` at `max()` instead of the sum?
> 7. Take a problem where the predicate is **not** monotonic — say "is there a subarray summing to exactly X?" — and explain why binary search can't apply.
> 8. Implement **exponential (galloping) search**: for an unbounded or very large sorted range, double an index until you overshoot, then binary-search that window. When does this beat plain binary search?
> 9. Rewrite `cube_root` with `while hi - lo > 1e-12`. Find a `target` where your epsilon is too small to ever be reached.

Finding things is easier when they're sorted — so next we tackle the algorithms that *do* the sorting.
