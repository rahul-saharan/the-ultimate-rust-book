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

## Complexity summary

| Algorithm | Data | Time | Notes |
|-----------|------|------|-------|
| Linear search | any | O(n) | works unsorted; simple |
| Binary search | **sorted** | O(log n) | halves the range each step |
| `HashMap` lookup | hashed | O(1) avg | when you need repeated key lookups |

## Summary

- **Linear search** (O(n)) checks every element — the only option for **unsorted** data; it's what `iter().position()`/`find()` do.
- **Binary search** (O(log n)) halves a **sorted** range each step — ~20 steps for a million elements; requires sorted data or it returns garbage.
- Use **`slice::binary_search`** (returns `Ok(idx)`/`Err(insert_pos)`) and **`slice::partition_point`** (lower/upper bound) in real code.
- **Binary search on the answer** extends the idea to any *monotonic* condition — finding a threshold value in O(log n) checks.
- For repeated exact lookups, a **`HashMap`** (O(1) average) may beat sorting + binary search.

> [!exercise] Try it yourself
> 1. Implement binary search recursively (instead of the loop) and confirm it matches.
> 2. Use `partition_point` to find the first element strictly greater than a value.
> 3. Use "binary search on the answer" to find the smallest integer `x` such that `x * (x+1) / 2 >= 100`.

Finding things is easier when they're sorted — so next we tackle the algorithms that *do* the sorting.
