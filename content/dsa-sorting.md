<h1><span class="h1-kicker">Data Structures & Algorithms</span>Sorting Algorithms</h1>

Sorting is the most-studied problem in computer science, and for good reason — sorted data unlocks binary search, deduplication, and countless other efficiencies. This chapter implements the classic sorting algorithms in Rust, from the simple-but-slow to the fast-and-clever, and explains the concepts (stability, in-place) that distinguish them. In real code you'll use `sort()`, but understanding *how* these work is foundational.

## The sorting landscape

| Algorithm | Best | Average | Worst | Space | Stable? |
|-----------|------|---------|-------|-------|---------|
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | ❌ |
| **Merge sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | ✅ |
| **Quicksort** | O(n log n) | O(n log n) | O(n²)* | O(log n) | ❌ |
| Heapsort | O(n log n) | O(n log n) | O(n log n) | O(1) | ❌ |

<small>*Quicksort's O(n²) worst case is rare with good pivot selection.</small>

> [!jargon] Stable vs. in-place
> A **stable** sort preserves the relative order of equal elements (if two items compare equal, the one that came first stays first) — crucial when sorting by multiple keys. An **in-place** sort uses only O(1) extra memory (it rearranges the existing array) rather than allocating a copy. These properties trade off: merge sort is stable but needs O(n) space; quicksort is in-place but not stable.

Stability sounds abstract until you watch it break. Here are 40 records with only three distinct keys, sorted both ways:

```rust
fn main() {
    // (key, original position). Three keys, so plenty of ties.
    let base: Vec<(u32, usize)> = (0..40usize).map(|i| ((i % 3) as u32, i)).collect();

    let mut stable = base.clone();
    stable.sort_by_key(|&(key, _)| key);

    let mut unstable = base.clone();
    unstable.sort_unstable_by_key(|&(key, _)| key);

    let positions = |v: &Vec<(u32, usize)>| v.iter().map(|&(_, i)| i).collect::<Vec<_>>();

    // Within each group of equal keys, are the original positions still ascending?
    let order_kept = |v: &Vec<(u32, usize)>| {
        v.chunk_by(|a, b| a.0 == b.0)
            .all(|group| group.windows(2).all(|w| w[0].1 < w[1].1))
    };

    println!("stable   keeps original order within a key: {}", order_kept(&stable));
    println!("unstable keeps original order within a key: {}", order_kept(&unstable));

    println!("\nfirst 14 original positions after sorting:");
    println!("  stable   {:?}", &positions(&stable)[..14]);
    println!("  unstable {:?}", &positions(&unstable)[..14]);
    println!("\nBoth contain exactly the same elements — only the tie order differs.");
}
```

> [!key] Stability is what makes multi-key sorting work
> Notice where record `0` ends up in the unstable run: eleventh, not first. Harmless if the records are interchangeable — but stability is precisely what lets you sort by several keys with **repeated single-key sorts**. Sort by name, then by department with a *stable* sort, and within each department the names remain alphabetical. Do the same with an unstable sort and the first sort's work is scrambled.
>
> The alternative is to sort once with a compound comparator (`sort_by_key(|r| (r.dept, r.name))`), which is usually clearer and faster. Reach for stability when the earlier ordering came from somewhere you don't control — a database query, a file, a previous processing stage.

## The simple O(n²) sorts

**Insertion sort** builds the sorted portion one element at a time, like sorting a hand of cards. It's O(n²) but genuinely fast on *small* or *nearly-sorted* data — which is why real sorts use it for tiny subarrays:

```rust
fn insertion_sort(arr: &mut [i32]) {
    for i in 1..arr.len() {
        let mut j = i;
        // Slide arr[i] leftward past larger elements into its sorted spot:
        while j > 0 && arr[j - 1] > arr[j] {
            arr.swap(j - 1, j);
            j -= 1;
        }
    }
}

fn main() {
    let mut v = [5, 2, 8, 1, 9, 3];
    insertion_sort(&mut v);
    println!("{v:?}"); // [1, 2, 3, 5, 8, 9]
}
```

## Merge sort: O(n log n), stable

**Merge sort** is [divide and conquer](#/ch/dsa-divide-conquer): split the array in half, sort each half recursively, then *merge* the two sorted halves. It's guaranteed O(n log n) and stable — the reliable workhorse:

```rust
fn merge_sort(arr: &[i32]) -> Vec<i32> {
    if arr.len() <= 1 {
        return arr.to_vec(); // base case: already sorted
    }
    let mid = arr.len() / 2;
    let left = merge_sort(&arr[..mid]);   // divide
    let right = merge_sort(&arr[mid..]);
    merge(&left, &right)                   // combine
}

// Merge two sorted slices into one sorted Vec — the heart of the algorithm.
fn merge(a: &[i32], b: &[i32]) -> Vec<i32> {
    let mut result = Vec::with_capacity(a.len() + b.len());
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i] <= b[j] {            // <= keeps it STABLE
            result.push(a[i]); i += 1;
        } else {
            result.push(b[j]); j += 1;
        }
    }
    result.extend_from_slice(&a[i..]); // whichever has leftovers
    result.extend_from_slice(&b[j..]);
    result
}

fn main() {
    println!("{:?}", merge_sort(&[5, 2, 8, 1, 9, 3, 7])); // [1,2,3,5,7,8,9]
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="Merge sort splits the array down to single elements then merges sorted halves back up">
  <style>
    .msm { font: 600 11px var(--font-mono); fill: var(--text); }
    .msc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .node { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
  </style>
  <rect x="250" y="14" width="140" height="22" class="node"/><text x="262" y="30" class="msm">[5,2,8,1]</text>
  <rect x="140" y="60" width="90" height="22" class="node"/><text x="152" y="76" class="msm">[5,2]</text>
  <rect x="410" y="60" width="90" height="22" class="node"/><text x="422" y="76" class="msm">[8,1]</text>
  <rect x="100" y="106" width="50" height="22" class="node"/><text x="118" y="122" class="msm">5</text>
  <rect x="190" y="106" width="50" height="22" class="node"/><text x="208" y="122" class="msm">2</text>
  <rect x="400" y="106" width="50" height="22" class="node"/><text x="418" y="122" class="msm">8</text>
  <rect x="470" y="106" width="50" height="22" class="node"/><text x="488" y="122" class="msm">1</text>
  <path d="M300 36 L200 58" stroke="var(--text-mute)"/><path d="M340 36 L450 58" stroke="var(--text-mute)"/>
  <path d="M170 82 L130 104" stroke="var(--text-mute)"/><path d="M200 82 L210 104" stroke="var(--text-mute)"/>
  <path d="M440 82 L420 104" stroke="var(--text-mute)"/><path d="M470 82 L490 104" stroke="var(--text-mute)"/>
  <text x="20" y="122" class="msc">split ↓</text>
  <text x="20" y="160" class="msc">merge ↑</text>
  <text x="180" y="160" class="msm" fill="var(--green)">[2,5] + [1,8] → [1,2,5,8]</text>
</svg>
<figcaption>Merge sort: recursively <b>split</b> to single elements, then <b>merge</b> sorted pieces back — always O(n log n).</figcaption>
</figure>

## Quicksort: O(n log n) average, in-place

**Quicksort** picks a *pivot*, partitions the array so smaller elements go left and larger go right, then recurses on each side. It sorts **in place** (O(1) extra) and is usually the fastest in practice, though a bad pivot gives O(n²) worst case:

```rust
fn quicksort(arr: &mut [i32]) {
    if arr.len() <= 1 {
        return;
    }
    let pivot_index = partition(arr);
    let (left, right) = arr.split_at_mut(pivot_index);
    quicksort(left);            // sort elements < pivot
    quicksort(&mut right[1..]); // sort elements > pivot (skip the pivot itself)
}

// Lomuto partition: place the last element as pivot into its final sorted position.
fn partition(arr: &mut [i32]) -> usize {
    let pivot = arr.len() - 1;
    let mut i = 0; // boundary of the "smaller than pivot" region
    for j in 0..pivot {
        if arr[j] <= arr[pivot] {
            arr.swap(i, j);
            i += 1;
        }
    }
    arr.swap(i, pivot); // put the pivot in its place
    i
}

fn main() {
    let mut v = [5, 2, 8, 1, 9, 3, 7];
    quicksort(&mut v);
    println!("{v:?}"); // [1, 2, 3, 5, 7, 8, 9]
}
```

## Breaking the n log n barrier

Every algorithm so far works by **comparing** pairs of elements, and that carries a hard limit.

> [!key] Why no comparison sort can beat Ω(n log n)
> Think of sorting as identifying which of the `n!` possible orderings your input is in. Each comparison has two outcomes, so after `c` comparisons you can distinguish at most `2^c` cases. To pin down one ordering you therefore need `2^c ≥ n!`, which gives `c ≥ log₂(n!) ≈ n log₂ n`. This is an **information-theoretic** bound: it applies to any algorithm that only learns about the data by comparing, no matter how clever, so merge sort and heapsort are asymptotically optimal in that class.
>
> The escape hatch is to stop comparing. If you can compute *where* an element belongs directly from its value, the argument no longer applies — which is exactly what the next three algorithms do.

### Counting sort — O(n + k)

If your values are integers in a small known range, just count how many of each you have:

```rust
/// O(n + k), where k is the size of the value range.
/// No comparisons at all — the value IS the index.
fn counting_sort(values: &[u32], max: u32) -> Vec<u32> {
    let mut counts = vec![0usize; max as usize + 1];
    for &v in values {
        counts[v as usize] += 1;
    }
    let mut out = Vec::with_capacity(values.len());
    for (value, &count) in counts.iter().enumerate() {
        out.extend(std::iter::repeat(value as u32).take(count));
    }
    out
}

/// A *stable* counting sort that keeps whole records, using prefix sums to
/// find each bucket's starting offset. This is the version radix sort needs.
fn counting_sort_stable<T: Copy>(items: &[T], key: impl Fn(&T) -> usize, max_key: usize) -> Vec<T> {
    let mut counts = vec![0usize; max_key + 1];
    for item in items {
        counts[key(item)] += 1;
    }
    // Turn counts into starting offsets.
    let mut running = 0;
    for c in counts.iter_mut() {
        let n = *c;
        *c = running;
        running += n;
    }
    let mut out: Vec<Option<T>> = vec![None; items.len()];
    for item in items {
        let k = key(item);
        out[counts[k]] = Some(*item); // left-to-right placement keeps it stable
        counts[k] += 1;
    }
    out.into_iter().map(|o| o.expect("every slot filled")).collect()
}

fn main() {
    let data = [5u32, 2, 8, 2, 9, 1, 5, 0, 3];
    println!("counting sort {:?}", counting_sort(&data, 9));

    // Stability check: the two 0s and three 1s keep their input order.
    let pairs = [(1u32, 'a'), (1, 'b'), (0, 'c'), (1, 'd'), (0, 'e')];
    println!("stable        {:?}", counting_sort_stable(&pairs, |&(k, _)| k as usize, 1));
}
```

### Radix sort — O(d · (n + k))

Counting sort collapses if the range is huge: sorting three values up to 4,000,000 would allocate four million counters. **Radix sort** fixes that by sorting one *digit* at a time, least-significant first, using a stable counting sort for each pass:

```rust
fn counting_sort_stable<T: Copy>(items: &[T], key: impl Fn(&T) -> usize, max_key: usize) -> Vec<T> {
    let mut counts = vec![0usize; max_key + 1];
    for item in items {
        counts[key(item)] += 1;
    }
    let mut running = 0;
    for c in counts.iter_mut() {
        let n = *c;
        *c = running;
        running += n;
    }
    let mut out: Vec<Option<T>> = vec![None; items.len()];
    for item in items {
        let k = key(item);
        out[counts[k]] = Some(*item);
        counts[k] += 1;
    }
    out.into_iter().map(|o| o.expect("every slot filled")).collect()
}

/// Least-significant-digit radix sort on u32: four stable passes, one per byte.
/// Only ever needs 256 counters, whatever the values are.
fn radix_sort(values: &[u32]) -> Vec<u32> {
    let mut current = values.to_vec();
    for byte in 0..4 {
        current = counting_sort_stable(&current, |&v| ((v >> (byte * 8)) & 0xFF) as usize, 255);
    }
    current
}

/// Bucket sort: scatter into buckets by value, sort each, concatenate.
/// Assumes values are roughly uniform over [0, 1).
fn bucket_sort(values: &[f64], buckets: usize) -> Vec<f64> {
    let mut bins: Vec<Vec<f64>> = vec![Vec::new(); buckets];
    for &v in values {
        let index = ((v * buckets as f64) as usize).min(buckets - 1);
        bins[index].push(v);
    }
    let mut out = Vec::with_capacity(values.len());
    for mut bin in bins {
        bin.sort_by(|a, b| a.partial_cmp(b).expect("no NaN"));
        out.extend(bin);
    }
    out
}

fn main() {
    let wide = [300u32, 5, 70_000, 1, 4_000_000, 42, 999];
    let sorted = radix_sort(&wide);
    println!("radix sort  {sorted:?}");

    let mut reference = wide.to_vec();
    reference.sort_unstable();
    println!("matches std {}", sorted == reference);

    let floats = [0.42, 0.11, 0.97, 0.35, 0.02, 0.71, 0.68];
    println!("bucket sort {:?}", bucket_sort(&floats, 5));
}
```

> [!key] Why radix sort must process the *least* significant digit first
> It looks backwards — surely the most significant digit matters most? But LSD radix relies entirely on each pass being **stable**. After sorting by the last digit, that ordering is preserved *within* each group when you sort by the next digit up. By the final pass, the higher digits dominate and all the lower-digit work still holds beneath them. Start from the most significant digit and each subsequent pass destroys the previous one's ordering, unless you recurse into buckets separately (which is MSD radix — a different, more complex algorithm).

| Sort | Complexity | Needs | Stable | Use when |
|---|---|---|---|---|
| **Counting** | O(n + k) | integer keys, small range `k` | yes (prefix-sum form) | ages, scores, byte values, small enums |
| **Radix (LSD)** | O(d · (n + k)) | fixed-width integer keys | yes | large integer ranges, IDs, fixed-length strings |
| **Bucket** | O(n) average, O(n²) worst | roughly uniform distribution | depends on inner sort | uniform floats in a known range |

> [!warning] Non-comparison sorts fail badly outside their assumptions
> Each of these buys its speed with an assumption, and violating it is expensive rather than merely suboptimal. **Counting sort** allocates `k + 1` counters, so a single value of 4 billion means a 32 GB allocation — it is O(n + k), and `k` can dwarf `n`. **Bucket sort** degrades to O(n²) when the data clusters, because every value lands in one bucket and the inner sort does all the work. **Radix sort** needs a fixed-width key, and handling negative or floating-point values requires bit-twiddling that's easy to get wrong.
>
> They also lose on constant factors more often than people expect: `sort_unstable` is so well optimised that radix sort typically only wins on large arrays of plain integers. Measure before adopting one — see [Benchmarking](#/ch/benchmarking).

## In practice: use `sort` and `sort_unstable`

You now understand the classics — but in real code, **always use the standard library's sort**. It's a highly optimized, adaptive hybrid (a tuned mergesort/`pdqsort`) that beats hand-rolled implementations:

```rust
fn main() {
    let mut v = vec![5, 2, 8, 1, 9, 3];

    v.sort();                          // stable, O(n log n)
    println!("{v:?}");

    v.sort_unstable();                 // not stable, but usually FASTER
    v.sort_by(|a, b| b.cmp(a));         // custom comparator (here: descending)
    v.sort_by_key(|&x| (x % 3, x));     // sort by a derived key
    println!("{v:?}");
}
```

> [!best] `sort` vs `sort_unstable`
> Use **`sort_unstable`** by default — it's typically faster and uses O(1) extra space. Use **`sort`** (stable) only when you need to preserve the order of equal elements (e.g. sorting records by one field while keeping a prior ordering intact). For sorting by a computed key, `sort_by_key` (or the cached `sort_by_cached_key` for expensive keys) is cleanest. Never hand-write a sort for production — `std`'s is faster and correct.

> [!performance] Why merge sort for stability, quicksort for speed
> `std`'s stable `sort` is essentially a merge sort (needs O(n) scratch space but guarantees stability and O(n log n)). `sort_unstable` is a quicksort variant (pattern-defeating quicksort) that's in-place and avoids quicksort's O(n²) trap with clever pivoting. Knowing which underlying algorithm each uses explains their trade-offs — exactly what this chapter taught.

## Summary

- Simple sorts (**bubble, insertion, selection**) are O(n²) — but insertion sort is fast on **small/nearly-sorted** data (used inside real sorts).
- **Merge sort** is O(n log n), **stable**, uses O(n) space — reliable divide-and-conquer.
- **Quicksort** is O(n log n) average, **in-place** (O(log n) stack), usually fastest, with a rare O(n²) worst case.
- **Stable** preserves equal-element order; **in-place** uses O(1) extra memory — merge sort has the first, quicksort the second.
- Stability is what makes **repeated single-key sorts** compose into a multi-key sort. An unstable sort scrambles the earlier ordering.
- **No comparison sort can beat Ω(n log n)** — it takes `log₂(n!)` comparisons to distinguish `n!` orderings. Merge sort and heapsort are optimal in that class.
- **Counting sort** (O(n+k)), **radix sort** (O(d·(n+k))), and **bucket sort** escape the bound by *not comparing* — they compute a position from the value.
- **LSD radix requires each pass to be stable**, which is why it starts from the least significant digit.
- Non-comparison sorts fail hard outside their assumptions: counting sort's `k` can dwarf `n`, bucket sort degrades to O(n²) on clustered data, and `sort_unstable` usually wins on constants anyway.
- In real code: **`sort_unstable`** (fastest, default), **`sort`** (stable when needed), `sort_by`/`sort_by_key` for custom orders — never hand-roll.

> [!exercise] Try it yourself
> 1. Implement selection sort (repeatedly find the minimum of the unsorted part and swap it into place).
> 2. Add a counter to `merge` to count "inversions" (pairs out of order) — a classic merge-sort application.
> 3. Sort a `Vec<(&str, u32)>` of (name, age) by age descending, then by name ascending — once with two stable sorts, once with a single compound key. Which do you prefer, and which is faster?
> 4. Feed `quicksort` an already-sorted array of 10,000 elements. What happens, and which line of `partition` is responsible?
> 5. Fix that by choosing the **median of three** (first, middle, last) as the pivot. Re-run the sorted input.
> 6. Make `counting_sort` handle **negative** values by offsetting by the minimum. What's the new space requirement?
> 7. Change `radix_sort` to process the *most* significant byte first and show that the result is wrong. Which property did you break?
> 8. Time `radix_sort` against `sort_unstable` on 1,000, 100,000, and 10,000,000 random `u32`s. Where is the crossover, if any?
> 9. Run `bucket_sort` on values clustered in `[0.0, 0.1)` and explain the slowdown in terms of the inner sort.

Merge sort and quicksort are both instances of a deeper pattern. Let's name it: **recursion**, then **divide and conquer**.
