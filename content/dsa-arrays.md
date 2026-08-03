<h1><span class="h1-kicker">Data Structures & Algorithms</span>Arrays, Vectors & Dynamic Arrays</h1>

The array is the most fundamental data structure — a block of elements laid out contiguously in memory. Rust gives you fixed-size arrays (`[T; N]`) and the growable `Vec<T>`, which *is* a dynamic array. Because arrays are so simple and cache-friendly, they're the backbone of countless algorithms. This chapter covers how they work under the hood and the essential array techniques (two pointers, sliding window) you'll reuse constantly.

## Contiguous memory = speed

> [!key] Why arrays are fast: cache locality
> An array stores its elements **side by side** in one block of memory. This gives two superpowers: (1) **O(1) random access** — the address of element `i` is just `start + i × size`, one arithmetic step; and (2) **cache locality** — modern CPUs load memory in chunks, so iterating a contiguous array feeds the cache perfectly, often 10×+ faster than chasing scattered pointers (as in a linked list). "Use a `Vec`" is good default advice largely *because* of this.

```rust
fn main() {
    let arr = [10, 20, 30, 40, 50];
    // O(1) access — no scanning, just address arithmetic:
    println!("{}", arr[3]); // 40

    // A Vec is a dynamic array — contiguous, but growable:
    let mut v = vec![1, 2, 3];
    v.push(4);        // amortized O(1)
    println!("{v:?}");
}
```

## The cost of each operation

| Operation | Array / Vec | Why |
|-----------|-------------|-----|
| Access by index | **O(1)** | direct address arithmetic |
| Update by index | **O(1)** | same |
| Push/pop at **end** | **O(1)** amortized | may reallocate occasionally |
| Insert/remove at **front/middle** | **O(n)** | must shift all following elements |
| Search (unsorted) | **O(n)** | must scan |
| Search (sorted) | **O(log n)** | binary search |

> [!key] The array trade-off
> Arrays are unbeatable for **indexing** and **iteration**, but **inserting or removing in the middle is O(n)** — every later element must shift over. If your workload is "add/remove at arbitrary positions a lot," an array isn't ideal (though it's often *still* faster than a linked list thanks to cache locality — measure!). If it's "index and iterate," the array wins hands down.

## How dynamic arrays grow

You saw this in the [Vectors chapter](#/ch/vectors): a `Vec` tracks **length** and **capacity**. When it fills up, it allocates a bigger buffer (typically **doubling**) and moves the elements. Doubling is the key to *amortized* O(1) pushes:

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="A dynamic array doubles its capacity when full, keeping pushes amortized O(1)">
  <style>
    .dam { font: 600 11px var(--font-mono); fill: var(--text); }
    .dac { font: 11px var(--font-sans); fill: var(--text-mute); }
    .u { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .f { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 3 2; }
  </style>
  <text x="14" y="24" class="dac">cap 2 (full) → push → cap 4 → … → cap 8:</text>
  <g class="dam">
    <rect x="14" y="34" width="26" height="24" class="u"/><rect x="40" y="34" width="26" height="24" class="u"/>
    <text x="80" y="51" class="dac">→</text>
    <rect x="100" y="34" width="26" height="24" class="u"/><rect x="126" y="34" width="26" height="24" class="u"/><rect x="152" y="34" width="26" height="24" class="u"/><rect x="178" y="34" width="26" height="24" class="f"/>
    <text x="216" y="51" class="dac">→</text>
    <rect x="236" y="34" width="26" height="24" class="u"/><rect x="262" y="34" width="26" height="24" class="u"/><rect x="288" y="34" width="26" height="24" class="u"/><rect x="314" y="34" width="26" height="24" class="u"/><rect x="340" y="34" width="26" height="24" class="u"/><rect x="366" y="34" width="26" height="24" class="f"/><rect x="392" y="34" width="26" height="24" class="f"/><rect x="418" y="34" width="26" height="24" class="f"/>
  </g>
  <text x="14" y="96" class="dac">Doubling means reallocations get rarer as the array grows, so the average push stays O(1).</text>
  <text x="14" y="116" class="dac">Know the size ahead? Vec::with_capacity(n) skips the intermediate growth entirely.</text>
</svg>
<figcaption>Doubling capacity on growth amortizes the occasional O(n) reallocation to O(1) per push.</figcaption>
</figure>

## Technique 1: two pointers

Many array problems that *look* like they need `O(n²)` nested loops can be solved in `O(n)` with **two pointers** moving toward each other (or in the same direction). Classic example: find two numbers in a *sorted* array that sum to a target:

```rust
// Two pointers: O(n) time, O(1) space — no nested loop needed.
fn two_sum_sorted(arr: &[i32], target: i32) -> Option<(usize, usize)> {
    let (mut lo, mut hi) = (0usize, arr.len().wrapping_sub(1));
    while lo < hi {
        let sum = arr[lo] + arr[hi];
        if sum == target {
            return Some((lo, hi));
        } else if sum < target {
            lo += 1; // need a bigger sum → move the low pointer up
        } else {
            hi -= 1; // need a smaller sum → move the high pointer down
        }
    }
    None
}

fn main() {
    let sorted = [1, 3, 4, 6, 8, 11];
    println!("{:?}", two_sum_sorted(&sorted, 10)); // Some((2, 3)) → 4 + 6
    println!("{:?}", two_sum_sorted(&sorted, 100)); // None
}
```

> [!key] Two pointers turns O(n²) into O(n)
> Whenever you'd otherwise compare *pairs* of elements with a double loop — and the array is sorted or you can process from both ends — the two-pointer technique collapses it to a single pass. Watch for it in problems about pairs, palindromes, merging, and partitioning. It's one of the highest-leverage patterns in algorithm interviews and real code alike.

## Technique 2: sliding window

For problems about *contiguous subarrays* ("max sum of any 3 consecutive elements", "longest substring without repeats"), a **sliding window** avoids recomputing overlapping work. Slide a window across the array, adding the new element and removing the old one in O(1):

```rust
// Max sum of any window of size k — O(n) instead of O(n·k).
fn max_window_sum(arr: &[i32], k: usize) -> Option<i32> {
    if k == 0 || arr.len() < k {
        return None;
    }
    let mut window: i32 = arr[..k].iter().sum(); // first window
    let mut best = window;
    for i in k..arr.len() {
        window += arr[i] - arr[i - k]; // slide: add new, drop oldest — O(1)
        best = best.max(window);
    }
    Some(best)
}

fn main() {
    println!("{:?}", max_window_sum(&[2, 1, 5, 1, 3, 2], 3)); // Some(9) → 5+1+3
}
```

## In-place operations

Working *in place* (mutating the array without extra space) keeps space at `O(1)`. Rust's slice methods make many of these one-liners — and the standard library is highly optimized, so prefer it over hand-rolling:

```rust
fn main() {
    let mut v = vec![5, 2, 8, 1, 9, 3];

    v.sort();                          // in-place sort, O(n log n)
    v.reverse();                       // in-place reverse, O(n)
    v.dedup();                         // remove consecutive duplicates
    let idx = v.binary_search(&8);     // O(log n) on sorted data (after sort)
    v.rotate_left(2);                  // shift elements, O(n)
    println!("{v:?}  found 8 at {idx:?}");
}
```

> [!best] Reach for `std` slice methods before writing your own
> Rust's slice API (`sort`, `sort_unstable`, `binary_search`, `partition_point`, `rotate_left`, `windows`, `chunks`, `iter().position()`) covers most array algorithms with battle-tested, optimized code. Implement an algorithm from scratch to *learn* it (as we do in this course), but in real code, use `std` — it's faster and correct. `sort_unstable` is often the fastest general sort when you don't need stability.

## Summary

- Arrays/`Vec` store elements **contiguously**, giving **O(1)** indexing and excellent **cache locality** — the reason they're the default collection.
- The trade-off: **insert/remove in the middle is O(n)** (shifting); a dynamic array **doubles capacity** on growth for **amortized O(1)** pushes (pre-size with `with_capacity`).
- **Two pointers** collapses many pair/palindrome/partition problems from `O(n²)` to `O(n)`.
- **Sliding window** solves contiguous-subarray problems in `O(n)` by adding/removing at the edges in O(1).
- Prefer **`std` slice methods** (`sort`, `binary_search`, `rotate_left`, …) for real work — they're optimized and correct.

> [!exercise] Try it yourself
> 1. Use two pointers to reverse an array in place (swap ends, move inward) — no `.reverse()`.
> 2. Use a sliding window to find the length of the longest run of consecutive equal elements.
> 3. Given a sorted array with duplicates, remove the duplicates in place and return the new length (two pointers).

Next, two structures built *on top of* arrays that impose useful discipline on how you add and remove: **stacks and queues**.
