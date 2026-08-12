<h1><span class="h1-kicker">Data Structures & Algorithms</span>Heaps & Priority Queues</h1>

A **heap** is a tree-shaped structure that keeps its largest (or smallest) element instantly accessible, with O(log n) insertion and removal. It's the natural way to implement a **priority queue** — "always give me the most important item next" — which powers task schedulers, [Dijkstra's shortest paths](#/ch/dsa-shortest-path), and "top-K" problems. This chapter builds a binary heap from scratch, then shows Rust's `BinaryHeap`.

> [!warning] Two different "heaps" — don't confuse them
> This **heap** is a *data structure* (a tree keeping the max/min on top). It is **not** the *memory heap* from the [stack & heap chapter](#/ch/stack-heap) (the region where dynamic data lives). Same word, unrelated meanings — context tells you which. Here, "heap" always means the data structure.

## The binary heap, stored in an array

A **binary heap** is a *complete* binary tree (every level full except possibly the last, filled left-to-right) with the **heap property**: every parent is ≤ its children (a *min-heap*) or ≥ its children (a *max-heap*). The beautiful trick: because it's complete, we store it in a plain **array** with no pointers — a node at index `i` has its children at `2i+1` and `2i+2`, and its parent at `(i-1)/2`:

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="A min-heap drawn as a tree and its equivalent array representation with index arithmetic">
  <style>
    .hpm { font: 600 11px var(--font-mono); fill: #fff; }
    .hpc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .hnode { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .acell { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .aidx { font: 10px var(--font-mono); fill: var(--text-mute); }
  </style>
  <line x1="140" y1="30" x2="90" y2="70" stroke="var(--text-mute)"/><line x1="140" y1="30" x2="190" y2="70" stroke="var(--text-mute)"/>
  <line x1="90" y1="90" x2="60" y2="125" stroke="var(--text-mute)"/><line x1="90" y1="90" x2="120" y2="125" stroke="var(--text-mute)"/>
  <circle cx="140" cy="25" r="15" class="hnode"/><text x="135" y="30" class="hpm">1</text>
  <circle cx="90" cy="80" r="15" class="hnode"/><text x="85" y="85" class="hpm">3</text>
  <circle cx="190" cy="80" r="15" class="hnode"/><text x="185" y="85" class="hpm">5</text>
  <circle cx="60" cy="135" r="15" class="hnode"/><text x="55" y="140" class="hpm">8</text>
  <circle cx="120" cy="135" r="15" class="hnode"/><text x="115" y="140" class="hpm">4</text>
  <text x="20" y="175" class="hpc">min-heap: parent ≤ children</text>
  <text x="360" y="24" class="hpc">stored as an array:</text>
  <g>
    <rect x="360" y="34" width="40" height="30" class="acell"/><text x="376" y="54" class="hpm" fill="var(--text)">1</text><text x="374" y="78" class="aidx">0</text>
    <rect x="400" y="34" width="40" height="30" class="acell"/><text x="416" y="54" class="hpm" fill="var(--text)">3</text><text x="414" y="78" class="aidx">1</text>
    <rect x="440" y="34" width="40" height="30" class="acell"/><text x="456" y="54" class="hpm" fill="var(--text)">5</text><text x="454" y="78" class="aidx">2</text>
    <rect x="480" y="34" width="40" height="30" class="acell"/><text x="496" y="54" class="hpm" fill="var(--text)">8</text><text x="494" y="78" class="aidx">3</text>
    <rect x="520" y="34" width="40" height="30" class="acell"/><text x="536" y="54" class="hpm" fill="var(--text)">4</text><text x="534" y="78" class="aidx">4</text>
  </g>
  <text x="360" y="115" class="hpc">children of i: 2i+1, 2i+2</text>
  <text x="360" y="133" class="hpc">parent of i: (i-1)/2</text>
  <text x="360" y="160" class="hpc">No pointers needed — pure index math!</text>
</svg>
<figcaption>A complete binary heap maps perfectly onto an array; parent/child links are just index arithmetic.</figcaption>
</figure>

## Building a min-heap

Two operations maintain the heap property: **sift up** (after inserting at the end, bubble the new value up while it's smaller than its parent) and **sift down** (after removing the root, move the last element to the top and push it down while it's larger than a child):

```rust
struct MinHeap {
    data: Vec<i32>,
}

impl MinHeap {
    fn new() -> Self {
        MinHeap { data: Vec::new() }
    }

    // Insert: add at the end, then sift up. O(log n).
    fn push(&mut self, value: i32) {
        self.data.push(value);
        let mut i = self.data.len() - 1;
        while i > 0 {
            let parent = (i - 1) / 2;
            if self.data[i] < self.data[parent] {
                self.data.swap(i, parent); // smaller than parent → bubble up
                i = parent;
            } else {
                break;
            }
        }
    }

    // Remove & return the minimum (the root). O(log n).
    fn pop(&mut self) -> Option<i32> {
        if self.data.is_empty() {
            return None;
        }
        let last = self.data.len() - 1;
        self.data.swap(0, last);       // move last element to the root
        let min = self.data.pop();      // remove the old root (now at the end)

        // Sift the new root down to its correct place:
        let len = self.data.len();
        let mut i = 0;
        loop {
            let (l, r) = (2 * i + 1, 2 * i + 2);
            let mut smallest = i;
            if l < len && self.data[l] < self.data[smallest] { smallest = l; }
            if r < len && self.data[r] < self.data[smallest] { smallest = r; }
            if smallest == i { break; } // heap property restored
            self.data.swap(i, smallest);
            i = smallest;
        }
        min
    }

    fn peek(&self) -> Option<&i32> {
        self.data.first() // the min is always at index 0 — O(1)
    }
}

fn main() {
    let mut heap = MinHeap::new();
    for v in [5, 2, 8, 1, 9, 3] {
        heap.push(v);
    }
    println!("min is {:?}", heap.peek()); // Some(1) — O(1) peek

    // Popping repeatedly yields sorted order — that's "heapsort"!
    let mut sorted = Vec::new();
    while let Some(x) = heap.pop() {
        sorted.push(x);
    }
    println!("{sorted:?}"); // [1, 2, 3, 5, 8, 9]
}
```

## Complexity

| Operation | Cost | Why |
|-----------|------|-----|
| `peek` (min/max) | **O(1)** | always at the root (index 0) |
| `push` | **O(log n)** | sift up at most the tree's height |
| `pop` | **O(log n)** | sift down at most the tree's height |
| build from n items | **O(n)** | heapify is cleverly linear, not O(n log n) |

> [!key] Why a heap, not a sorted array?
> A sorted array also gives O(1) min access — but inserting into it is O(n) (shifting). A heap gives O(1) peek *and* O(log n) insert/remove. That combination is exactly what a **priority queue** needs: a constantly-changing collection where you repeatedly grab the smallest/largest. Full sorting (O(n log n)) is wasteful when you only ever need the current extreme.

## Heapify: building a heap in O(n), not O(n log n)

That table claims building a heap from `n` items is **linear**, which is surprising — surely `n` insertions at O(log n) each must cost O(n log n)? The resolution is that you don't insert them one at a time. You dump every value into the array in any order and then **sift down** each internal node, working from the last one backwards:

```rust
fn sift_down(data: &mut [i32], mut i: usize, swaps: &mut usize) {
    let len = data.len();
    loop {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        let mut smallest = i;
        if l < len && data[l] < data[smallest] { smallest = l; }
        if r < len && data[r] < data[smallest] { smallest = r; }
        if smallest == i { break; } // heap property holds here
        data.swap(i, smallest);
        *swaps += 1;
        i = smallest;
    }
}

/// O(n) heapify. Leaves are already valid heaps, so start at the last
/// INTERNAL node — index len/2 - 1 — and walk backwards to the root.
fn heapify(data: &mut [i32]) -> usize {
    let mut swaps = 0;
    if data.len() < 2 {
        return 0;
    }
    for i in (0..data.len() / 2).rev() {
        sift_down(data, i, &mut swaps);
    }
    swaps
}

/// The obvious alternative: push values one at a time, sifting UP each time.
/// Correct, but does more work.
fn build_by_pushes(values: &[i32]) -> (Vec<i32>, usize) {
    let mut data = Vec::with_capacity(values.len());
    let mut swaps = 0;
    for &v in values {
        data.push(v);
        let mut i = data.len() - 1;
        while i > 0 {
            let parent = (i - 1) / 2;
            if data[i] < data[parent] {
                data.swap(i, parent);
                swaps += 1;
                i = parent;
            } else {
                break;
            }
        }
    }
    (data, swaps)
}

fn is_min_heap(d: &[i32]) -> bool {
    (0..d.len()).all(|i| {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        (l >= d.len() || d[i] <= d[l]) && (r >= d.len() || d[i] <= d[r])
    })
}

fn main() {
    println!("{:>8} | {:>14} | {:>18} | {:>7}", "n", "heapify swaps", "push-by-push swaps", "ratio");
    println!("{}", "-".repeat(56));

    for n in [15usize, 1_000, 10_000, 100_000] {
        // Descending input: the worst case for the push-by-push approach,
        // because every new value has to travel all the way to the root.
        let values: Vec<i32> = (0..n as i32).rev().collect();

        let mut heapified = values.clone();
        let h = heapify(&mut heapified);
        let (pushed, p) = build_by_pushes(&values);

        assert!(is_min_heap(&heapified) && is_min_heap(&pushed));
        println!("{:>8} | {:>14} | {:>18} | {:>6.2}x", n, h, p, p as f64 / h.max(1) as f64);
    }

    println!("\nheapify stays at about n swaps. Push-by-push grows as n log n,");
    println!("so the gap widens with n — that IS the log n factor, made visible.");
}
```

> [!deep] Why sifting down is linear while sifting up is not
> The counting argument is lovely. In a heap of `n` nodes, **half are leaves** and need no work at all; a quarter sit one level above the leaves and can sift down at most 1 step; an eighth can move at most 2, and so on. Total work is therefore bounded by
>
> `n/4 × 1 + n/8 × 2 + n/16 × 3 + … = n × Σ(k / 2^(k+1))`
>
> and that sum **converges to 1** rather than growing with `n`. So heapify is O(n).
>
> Sifting *up* has exactly the opposite shape: the many leaf-level nodes are the ones that may travel the full `log n` distance to the root, so the expensive case applies to the *most numerous* nodes instead of the fewest. Same tree, same swaps-per-level bound, opposite distribution — O(n log n). The lesson generalises: when work per element varies with depth, it matters enormously whether the cheap case or the expensive case is the common one.

> [!best] Use `BinaryHeap::from` — it heapifies
> You don't have to implement this. `BinaryHeap::from(vec)` and `collect()` into a `BinaryHeap` both use the O(n) bottom-up build, whereas pushing in a loop is O(n log n). So when you already have the data, prefer `BinaryHeap::from(values)` over `values.into_iter().for_each(|v| heap.push(v))`. It's a free constant-factor-plus-log-factor win, and the measurement above shows it's a real one at scale, not a theoretical nicety.

## Heapsort: sorting in place with a heap

The chapter's first example popped everything into a *separate* vector. Real **heapsort** needs no extra memory: build a **max**-heap, then repeatedly swap the root to the end of the array and shrink the heap by one. The sorted portion grows from the right while the heap shrinks on the left.

```rust
fn sift_down_max(data: &mut [i32], mut i: usize, len: usize) {
    loop {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        let mut largest = i;
        if l < len && data[l] > data[largest] { largest = l; }
        if r < len && data[r] > data[largest] { largest = r; }
        if largest == i { break; }
        data.swap(i, largest);
        i = largest;
    }
}

/// In-place heapsort: O(n log n) time, O(1) extra space.
fn heapsort(data: &mut [i32]) {
    let n = data.len();
    if n < 2 {
        return;
    }
    // 1. Build a max-heap over the whole slice — O(n).
    for i in (0..n / 2).rev() {
        sift_down_max(data, i, n);
    }
    // 2. Repeatedly move the maximum to its final position.
    for end in (1..n).rev() {
        data.swap(0, end);           // biggest element lands where it belongs
        sift_down_max(data, 0, end); // restore the heap over the shrinking prefix
    }
}

fn main() {
    let mut data = vec![5, 2, 9, 1, 7, 3, 8, 6, 4];
    println!("before {data:?}");
    heapsort(&mut data);
    println!("after  {data:?}");
    println!("sorted: {}", data.windows(2).all(|w| w[0] <= w[1]));

    // Edge cases worth checking on any sort.
    for mut case in [vec![], vec![1], vec![2, 1], vec![3, 3, 3]] {
        heapsort(&mut case);
        println!("{case:?}");
    }
}
```

> [!key] Why heapsort uses a **max**-heap to sort ascending
> This feels backwards at first. The reason is that the heap lives at the *front* of the array and the sorted output accumulates at the *back*. Each step removes the current maximum, and the natural place to park it is the slot just vacated at the end of the heap region — which is exactly where the largest remaining value belongs in ascending order. A min-heap would hand you the smallest element and leave you nowhere useful to put it.

> [!performance] Heapsort is O(1) space but rarely the fastest in practice
> Heapsort's guarantees are excellent — **O(n log n) worst case** (unlike quicksort, which can degrade to O(n²)) and **O(1) extra space** (unlike merge sort's O(n)). Yet Rust's `sort_unstable` uses pattern-defeating quicksort instead, because heapsort's memory access jumps around the array by powers of two and defeats the CPU cache, while quicksort scans linearly. Heapsort earns its place where the worst case genuinely matters — real-time systems, adversarial input — or as the fallback that makes [introsort](#/ch/dsa-sorting) safe. See [Sorting](#/ch/dsa-sorting) for the full comparison.

## In practice: `BinaryHeap`

Rust's [`std::collections::BinaryHeap`](#/ch/other-collections) is a ready-made **max**-heap. For a min-heap, wrap values in `std::cmp::Reverse`:

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

fn main() {
    // Max-heap (default):
    let mut max = BinaryHeap::from([3, 1, 4, 1, 5, 9]);
    println!("max: {:?}", max.pop()); // Some(9)

    // Min-heap via Reverse:
    let mut min = BinaryHeap::new();
    for v in [3, 1, 4, 1, 5, 9] {
        min.push(Reverse(v));
    }
    if let Some(Reverse(smallest)) = min.pop() {
        println!("min: {smallest}"); // 1
    }
}
```

> [!best] Use `BinaryHeap` for priority queues and top-K
> Reach for `BinaryHeap` whenever you need "repeatedly take the most/least important item": event schedulers, [Dijkstra's algorithm](#/ch/dsa-shortest-path), merging sorted streams, or finding the **K largest/smallest** items in a stream (keep a heap of size K — O(n log K), far better than sorting everything). Default is a max-heap; `Reverse` flips it to a min-heap. Implement one from scratch to learn sift-up/down; use `BinaryHeap` in real code.

### A real priority queue: custom `Ord` and top-K

In practice a priority queue rarely holds bare integers — it holds tasks with a priority, and you decide the ordering by implementing `Ord`. Here is that, plus the size-K heap trick:

```rust
use std::cmp::{Ordering, Reverse};
use std::collections::BinaryHeap;

#[derive(Debug, Eq, PartialEq)]
struct Task {
    priority: u8,
    at: u32, // arrival time, for tie-breaking
    name: &'static str,
}

impl Ord for Task {
    fn cmp(&self, other: &Self) -> Ordering {
        // BinaryHeap is a MAX-heap, so "greater" means "served first".
        self.priority
            .cmp(&other.priority)
            // Tie-break: earlier arrival wins. Note the arguments are
            // REVERSED here, because a smaller `at` must compare as greater.
            .then_with(|| other.at.cmp(&self.at))
    }
}

impl PartialOrd for Task {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// The K largest values of a stream, using a size-K MIN-heap.
/// O(n log k) time and O(k) space — you never hold the whole stream.
fn k_largest(stream: impl IntoIterator<Item = i32>, k: usize) -> Vec<i32> {
    let mut heap: BinaryHeap<Reverse<i32>> = BinaryHeap::with_capacity(k);
    for x in stream {
        if heap.len() < k {
            heap.push(Reverse(x));
        } else if let Some(&Reverse(smallest)) = heap.peek() {
            // The heap's smallest is the weakest of our current top K.
            if x > smallest {
                heap.pop();
                heap.push(Reverse(x));
            }
        }
    }
    let mut out: Vec<i32> = heap.into_iter().map(|Reverse(x)| x).collect();
    out.sort_unstable_by(|a, b| b.cmp(a));
    out
}

fn main() {
    let mut queue = BinaryHeap::new();
    queue.push(Task { priority: 1, at: 0, name: "cleanup" });
    queue.push(Task { priority: 9, at: 1, name: "page oncall" });
    queue.push(Task { priority: 5, at: 2, name: "send email" });
    queue.push(Task { priority: 9, at: 3, name: "later page" });

    println!("service order:");
    while let Some(t) = queue.pop() {
        println!("  p{} @{} — {}", t.priority, t.at, t.name);
    }

    let data = vec![7, 2, 9, 4, 1, 8, 3, 10, 5];
    println!("\n3 largest of {data:?} → {:?}", k_largest(data.clone(), 3));
    println!("k larger than the stream → {:?}", k_largest(data, 99));
}
```

> [!key] To find the K **largest**, use a **min**-heap of size K
> This inversion is the part people get wrong. Keep a min-heap holding your current best K. Its root is the *weakest* member — so for each new value you only need one comparison: beat the root, and you evict it; otherwise discard the newcomer. A max-heap would put your strongest element on top, which tells you nothing about who should be evicted.
>
> The win is real: **O(n log k)** time and **O(k)** memory instead of O(n log n) and O(n) for sorting everything. For "top 10 of a billion events", `k = 10` means the heap fits in cache and the stream never has to be stored at all.

> [!mistake] Tie-breaking in the wrong direction
> Look closely at `then_with(|| other.at.cmp(&self.at))` — the arguments are deliberately swapped. Because `BinaryHeap` pops the *greatest* element, any field where **smaller should win** must be compared in reverse. Write it the natural way round and equal-priority tasks come out newest-first, which is usually the opposite of what a scheduler wants. The run above confirms the intended behaviour: both priority-9 tasks come first, and `@1` precedes `@3`.
>
> The other trap is that `Ord` must agree with `Eq`: if `cmp` returns `Equal` for two values, `==` must too. Deriving `PartialEq`/`Eq` while hand-writing `Ord` to ignore a field breaks that contract and gives you a heap that misbehaves in ways no compiler will flag.

> [!tip] `peek_mut` lets you modify the top and re-heapify automatically
> Sometimes you want to *change* the highest-priority item rather than remove it — decreasing a key in Dijkstra, or bumping a deadline. `heap.peek_mut()` hands you a guard that derefs to the top element; when the guard **drops**, the heap sifts it down into its correct new position. It's one of the guard types from [Cell and Lock Guards](#/ch/cell-guards), doing real work in its `Drop`:
> ```rust
> use std::collections::BinaryHeap;
> fn main() {
>     let mut heap = BinaryHeap::from([5, 3, 1]);
>     if let Some(mut top) = heap.peek_mut() {
>         *top = 0; // was the max; now the min
>     } // guard drops here → heap re-sorts
>     println!("{:?}", heap.into_sorted_vec()); // [0, 1, 3]
> }
> ```

## Summary

- A **binary heap** is a complete binary tree with the **heap property** (parent ≤ children for min-heap, ≥ for max-heap), stored in an **array** using index math (children `2i+1`/`2i+2`, parent `(i-1)/2`).
- **peek** is O(1) (root); **push** (sift up) and **pop** (sift down) are O(log n).
- **Heapify is O(n)**: sift *down* every internal node from the last backwards. Sifting *up* n times is O(n log n) — measured at 99,990 vs 1,468,946 swaps for n = 100,000. Half the nodes are leaves needing no work, so the cheap case is the common one.
- **`BinaryHeap::from(vec)` heapifies**; pushing in a loop does not. Prefer it when you already have the data.
- **Heapsort** is in-place O(n log n) with O(1) space, and uses a **max**-heap to sort ascending because the sorted region grows from the back. Rarely the fastest in practice — poor cache locality — but excellent worst-case guarantees.
- For a real priority queue, implement **`Ord`** on your type. Fields where **smaller should win must be compared in reverse**, since `BinaryHeap` pops the greatest.
- To find the K **largest**, keep a size-K **min**-heap: its root is the weakest of your current best, so eviction is one comparison. **O(n log k)** time, **O(k)** space.
- **`peek_mut`** returns a guard that re-sorts the heap when it drops — the way to modify the top in place.

> [!exercise] Try it yourself
> 1. Add `len` and `is_empty` to `MinHeap`, then use it to sort a list by pushing all then popping all.
> 2. Change the heapify loop to run **forwards** (`0..len/2`) instead of backwards. Find an input where the result is not a valid heap, and explain why direction matters.
> 3. Instrument `BinaryHeap::from(vec![...])` against a push loop for 100,000 items by timing both. Does the ratio match the swap-count table?
> 4. Modify `heapsort` to sort **descending**. Which heap do you need now?
> 5. Add a third tie-break to `Task` (say, alphabetical by name) and confirm the ordering you expect. What happens if you get its direction wrong?
> 6. Implement `k_smallest` using a size-K **max**-heap. Which comparison flips?
> 7. Use `peek_mut` to implement `decrease_key`: lower the top element's priority and let the heap re-sort. Why can't you do this with `peek()`?
> 8. Merge `k` sorted vectors into one sorted vector using a heap of size `k`. What's the complexity in terms of `k` and the total element count `n`?

Next, a tree specialized for strings that makes prefix search lightning-fast — the **trie**.
