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
- In real code: **`sort_unstable`** (fastest, default), **`sort`** (stable when needed), `sort_by`/`sort_by_key` for custom orders — never hand-roll.

> [!exercise] Try it yourself
> 1. Implement selection sort (repeatedly find the minimum of the unsorted part and swap it into place).
> 2. Add a counter to `merge` to count "inversions" (pairs out of order) — a classic merge-sort application.
> 3. Sort a `Vec<(&str, u32)>` of (name, age) by age descending, then by name ascending, with `sort_by`.

Merge sort and quicksort are both instances of a deeper pattern. Let's name it: **recursion**, then **divide and conquer**.
