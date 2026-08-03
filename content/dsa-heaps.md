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

## Summary

- A **binary heap** is a complete binary tree with the **heap property** (parent ≤ children for min-heap, ≥ for max-heap), stored in an **array** using index math (children `2i+1`/`2i+2`, parent `(i-1)/2`).
- **peek** is O(1) (root); **push** (sift up) and **pop** (sift down) are O(log n); building from n items is O(n).
- It's the ideal **priority queue** — better than a sorted array for a constantly-changing "give me the extreme" workload.
- Rust's **`BinaryHeap`** is a max-heap; use **`Reverse`** for a min-heap. Great for scheduling, Dijkstra, and top-K.
- Popping everything yields sorted order — that's **heapsort** (O(n log n), in-place).

> [!exercise] Try it yourself
> 1. Add a `len` and `is_empty` to `MinHeap`, then use it to sort a list by pushing all then popping all.
> 2. Use `BinaryHeap` to find the 3 largest numbers in `[7,2,9,4,1,8,3]` (pop three times).
> 3. Use a size-K min-heap (`BinaryHeap<Reverse<_>>`) to find the K *largest* elements of a stream in O(n log K).

Next, a tree specialized for strings that makes prefix search lightning-fast — the **trie**.
