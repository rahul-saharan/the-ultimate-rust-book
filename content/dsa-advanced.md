<h1><span class="h1-kicker">Data Structures & Algorithms</span>Segment Trees, Fenwick Trees & Beyond</h1>

We close the algorithms course with the structures that power competitive programming and high-performance systems: those that answer **range queries** on changing data. "What's the sum of elements 3 through 8?" is easy — until the data keeps changing and you need thousands of such queries fast. **Fenwick trees** and **segment trees** answer both queries *and* updates in O(log n). This is the advanced finale.

## The range-query problem

Say you have an array and must repeatedly (a) ask for the sum of a range, and (b) update an element. Two naive approaches each fail one side:

| Approach | Range query | Point update |
|----------|-------------|--------------|
| Plain array | O(n) (sum the range) | O(1) |
| Prefix-sum array | **O(1)** | O(n) (rebuild the prefixes) |
| **Fenwick / Segment tree** | **O(log n)** | **O(log n)** |

> [!key] Why we need a special structure
> A prefix-sum array makes range *queries* O(1), but a single *update* forces you to rebuild all following prefixes — O(n). A plain array makes updates O(1) but queries O(n). When you have *both* frequent queries *and* frequent updates, neither works. **Fenwick and segment trees give O(log n) for both** — the balanced answer to the "query-and-update" problem.

## Fenwick tree (Binary Indexed Tree)

The **Fenwick tree** (or *Binary Indexed Tree*, BIT) is a remarkably compact structure — just an array — that supports prefix sums and point updates in O(log n). Its cleverness lies in using the **lowest set bit** of an index to define which range each slot is responsible for:

```rust
struct Fenwick {
    tree: Vec<i64>, // 1-indexed internally
}

impl Fenwick {
    fn new(n: usize) -> Self {
        Fenwick { tree: vec![0; n + 1] }
    }

    // Add `delta` to element `i` (0-indexed). O(log n).
    fn update(&mut self, i: usize, delta: i64) {
        let mut idx = i + 1; // to 1-indexed
        while idx < self.tree.len() {
            self.tree[idx] += delta;
            idx += idx & idx.wrapping_neg(); // jump by the lowest set bit
        }
    }

    // Sum of elements [0, i) — i.e. the first `i` elements. O(log n).
    fn prefix_sum(&self, i: usize) -> i64 {
        let mut idx = i;
        let mut sum = 0;
        while idx > 0 {
            sum += self.tree[idx];
            idx -= idx & idx.wrapping_neg(); // strip the lowest set bit
        }
        sum
    }

    // Sum of the inclusive range [l, r]. O(log n).
    fn range_sum(&self, l: usize, r: usize) -> i64 {
        self.prefix_sum(r + 1) - self.prefix_sum(l)
    }
}

fn main() {
    let values = [3, 2, 5, 1, 4, 6];
    let mut fw = Fenwick::new(values.len());
    for (i, &v) in values.iter().enumerate() {
        fw.update(i, v);
    }

    println!("sum [1..=3] = {}", fw.range_sum(1, 3)); // 2+5+1 = 8
    fw.update(2, 10);                                  // element 2: 5 → 15
    println!("sum [1..=3] = {}", fw.range_sum(1, 3)); // 2+15+1 = 18
}
```

> [!key] The lowest-set-bit magic
> The whole Fenwick tree hinges on `idx & idx.wrapping_neg()`, which isolates the **lowest set bit** (from the [bit-manipulation chapter](#/ch/dsa-bit-manipulation)). Each tree slot `idx` stores the sum of a range whose *length* is that lowest set bit. Walking up (for updates) *adds* it; walking down (for prefix sums) *strips* it. This is why a Fenwick tree touches only O(log n) slots per operation — one per set bit. It's astonishingly little code for what it does.

## Segment tree

A **segment tree** is more general: it stores each array segment's aggregate (sum, min, max, gcd — any *associative* operation) in a binary tree. It handles range queries *and* updates in O(log n), and unlike Fenwick, it easily supports range *minimum*/*maximum*, not just sums:

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A segment tree stores segment sums in a binary tree, with the root covering the whole array">
  <style>
    .adm { font: 600 10px var(--font-mono); fill: #fff; }
    .adc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .adn { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.2; }
  </style>
  <rect x="280" y="14" width="80" height="24" rx="4" class="adn"/><text x="290" y="30" class="adm">[0..4]=11</text>
  <rect x="160" y="60" width="70" height="24" rx="4" class="adn"/><text x="168" y="76" class="adm">[0..2]=5</text>
  <rect x="410" y="60" width="70" height="24" rx="4" class="adn"/><text x="418" y="76" class="adm">[2..4]=6</text>
  <rect x="100" y="110" width="50" height="22" rx="4" class="adn"/><text x="110" y="125" class="adm">3</text>
  <rect x="200" y="110" width="50" height="22" rx="4" class="adn"/><text x="210" y="125" class="adm">2</text>
  <rect x="390" y="110" width="50" height="22" rx="4" class="adn"/><text x="400" y="125" class="adm">5</text>
  <rect x="450" y="110" width="50" height="22" rx="4" class="adn"/><text x="460" y="125" class="adm">1</text>
  <line x1="300" y1="38" x2="195" y2="58" stroke="var(--text-mute)"/><line x1="340" y1="38" x2="445" y2="58" stroke="var(--text-mute)"/>
  <line x1="180" y1="84" x2="125" y2="108" stroke="var(--text-mute)"/><line x1="210" y1="84" x2="225" y2="108" stroke="var(--text-mute)"/>
  <line x1="430" y1="84" x2="415" y2="108" stroke="var(--text-mute)"/><line x1="460" y1="84" x2="475" y2="108" stroke="var(--text-mute)"/>
  <text x="14" y="150" class="adc">Each node stores its segment's aggregate; a range query combines O(log n) nodes.</text>
</svg>
<figcaption>A segment tree: internal nodes hold aggregates of their segments, so any range query touches only O(log n) nodes.</figcaption>
</figure>

Rust's closures make this genuinely elegant: one implementation, generic over *any* associative operation.

```rust
/// A segment tree over any associative operation.
/// `identity` must satisfy combine(identity, x) == x.
struct SegTree<T, F> {
    n: usize,
    tree: Vec<T>,
    identity: T,
    combine: F,
}

impl<T: Copy, F: Fn(T, T) -> T> SegTree<T, F> {
    fn new(values: &[T], identity: T, combine: F) -> Self {
        let n = values.len();
        let mut tree = vec![identity; 2 * n];
        // Leaves occupy tree[n..2n]; node i has children 2i and 2i+1.
        // This "iterative" layout needs no recursion and no padding to a power of two.
        tree[n..2 * n].copy_from_slice(values);
        for i in (1..n).rev() {
            tree[i] = combine(tree[2 * i], tree[2 * i + 1]);
        }
        SegTree { n, tree, identity, combine }
    }

    /// Set position `i`, then repair its ancestors. O(log n).
    fn set(&mut self, i: usize, value: T) {
        let mut idx = i + self.n;
        self.tree[idx] = value;
        while idx > 1 {
            idx /= 2;
            self.tree[idx] = (self.combine)(self.tree[2 * idx], self.tree[2 * idx + 1]);
        }
    }

    /// Combine over the half-open range [l, r). O(log n).
    /// Climbs from both ends, absorbing whole nodes as it goes.
    fn query(&self, l: usize, r: usize) -> T {
        let (mut lo, mut hi) = (l + self.n, r + self.n);
        // Two accumulators, because the operation need not be commutative.
        let (mut left, mut right) = (self.identity, self.identity);
        while lo < hi {
            if lo & 1 == 1 {
                left = (self.combine)(left, self.tree[lo]);
                lo += 1;
            }
            if hi & 1 == 1 {
                hi -= 1;
                right = (self.combine)(self.tree[hi], right);
            }
            lo /= 2;
            hi /= 2;
        }
        (self.combine)(left, right)
    }
}

fn main() {
    let values: Vec<i64> = vec![3, 2, 5, 1, 4, 6];

    // The same structure, three different questions.
    let mut sums = SegTree::new(&values, 0i64, |a, b| a + b);
    let mut mins = SegTree::new(&values, i64::MAX, |a, b| a.min(b));
    let mut maxs = SegTree::new(&values, i64::MIN, |a, b| a.max(b));

    println!("values {values:?}");
    println!("range [1,4)  sum {}  min {}  max {}",
        sums.query(1, 4), mins.query(1, 4), maxs.query(1, 4));

    sums.set(2, 15);
    mins.set(2, 15);
    maxs.set(2, 15);
    println!("\nafter set(2, 15):");
    println!("range [1,4)  sum {}  min {}  max {}",
        sums.query(1, 4), mins.query(1, 4), maxs.query(1, 4));

    // Verify every possible range against a direct computation.
    let mut updated = values.clone();
    updated[2] = 15;
    let mut all_match = true;
    for l in 0..updated.len() {
        for r in l + 1..=updated.len() {
            let slice = &updated[l..r];
            all_match &= sums.query(l, r) == slice.iter().sum::<i64>();
            all_match &= mins.query(l, r) == *slice.iter().min().expect("non-empty");
            all_match &= maxs.query(l, r) == *slice.iter().max().expect("non-empty");
        }
    }
    println!("\nall {} ranges agree with brute force: {all_match}",
        updated.len() * (updated.len() + 1) / 2);

    // Any associative operation works — here, gcd.
    let gcds = SegTree::new(&[12i64, 18, 24, 9], 0, |a, b| {
        let (mut a, mut b) = (a, b);
        while b != 0 { let t = b; b = a % b; a = t; }
        a
    });
    println!("gcd of [12,18,24,9] = {}", gcds.query(0, 4));
}
```

> [!key] The identity element is what makes a generic segment tree possible
> A query combines a handful of node aggregates, but the *number* varies with the range — so you need a starting value that changes nothing. That's the **identity**: `0` for sum, `i64::MAX` for min, `i64::MIN` for max, `1` for product, `0` for gcd (since `gcd(0, x) == x`).
>
> Together, an associative operation and its identity form a **monoid**, and a monoid is exactly what a segment tree requires — nothing more. That's why one implementation handles sum, min, max, gcd, bitwise-or, matrix product, and "leftmost non-zero" without modification. Get the identity wrong (say `0` for min) and every query returns `0`, with no error to hint at why.

> [!mistake] Two accumulators, because the operation may not commute
> Notice `query` keeps `left` and `right` separately and only joins them at the end. For sum and min that's unnecessary — order doesn't matter. But a segment tree over **non-commutative** operations (matrix multiplication, string concatenation, function composition) breaks if you fold everything into one accumulator, because nodes are absorbed out of order as the two pointers climb.
>
> Associativity is required; commutativity is not — and writing the loop with one accumulator quietly assumes both. It works for the common cases and fails for exactly the interesting ones.

> [!key] Fenwick vs. segment tree
> - **Fenwick tree**: tiny, fast, simple — but limited to *invertible* operations (sums, XOR) because range queries subtract prefix results. Use it for **range sums** with point updates.
> - **Segment tree**: more code and memory, but handles *any associative* operation (min, max, gcd, sum) and supports **range updates** with "lazy propagation." Use it when you need range min/max or range modifications.
>
> Rule of thumb: reach for a **Fenwick tree** for range sums (it's the smaller, faster tool); use a **segment tree** when you need min/max/gcd queries or range updates.

## Beyond: a glimpse of the frontier

You've now covered the structures used in ~99% of programming. A few more exist for specialized domains:

### If the data never changes: sparse tables

Both structures above pay O(log n) per query to support *updates*. If your data is **immutable**, you can do better — O(1) queries, at the cost of O(n log n) preprocessing:

```rust
/// Range minimum in O(1) on immutable data. Build is O(n log n).
struct SparseTable {
    /// levels[k][i] = min over the window starting at i of length 2^k.
    levels: Vec<Vec<i64>>,
}

impl SparseTable {
    fn new(values: &[i64]) -> Self {
        let n = values.len();
        let mut levels = vec![values.to_vec()];
        let mut k = 1;
        while (1 << k) <= n {
            let span = 1usize << k;
            let previous = &levels[k - 1];
            // Each window is the min of two half-width windows.
            let row: Vec<i64> = (0..=n - span)
                .map(|i| previous[i].min(previous[i + span / 2]))
                .collect();
            levels.push(row);
            k += 1;
        }
        SparseTable { levels }
    }

    /// Minimum over [l, r) in O(1).
    fn min(&self, l: usize, r: usize) -> i64 {
        let k = (r - l).ilog2() as usize;
        let row = &self.levels[k];
        // Two windows of length 2^k that TOGETHER cover [l, r).
        // They overlap, which is fine for min — but not for sum.
        row[l].min(row[r - (1 << k)])
    }
}

fn main() {
    let values: Vec<i64> = vec![3, 2, 5, 1, 4, 6, 0, 7];
    let table = SparseTable::new(&values);

    println!("values {values:?}");
    println!("min [0,4) = {}", table.min(0, 4));
    println!("min [2,6) = {}", table.min(2, 6));
    println!("min [4,8) = {}", table.min(4, 8));
    println!("min [3,4) = {}   (single element)", table.min(3, 4));

    let all_match = (0..values.len()).all(|l| {
        (l + 1..=values.len())
            .all(|r| table.min(l, r) == *values[l..r].iter().min().expect("non-empty"))
    });
    println!("\nevery range matches brute force: {all_match}");
}
```

> [!key] Overlapping windows are why sparse tables do min but not sum
> The O(1) query works by covering `[l, r)` with **two overlapping** power-of-two windows. That's valid because `min` is **idempotent** — `min(x, x) == x` — so counting the overlap twice changes nothing.
>
> Sum is not idempotent, so the same trick would double-count the overlap. You *can* build a sparse table for sums, but only by using disjoint windows, which costs O(log n) per query and loses the whole advantage. So: **min, max, gcd, and bitwise-and/or work in O(1); sum does not.** Use a prefix-sum array for immutable sums — it's O(1) too, and far simpler.

| Structure | Query | Update | Best for |
|---|---|---|---|
| prefix sums | **O(1)** | O(n) | immutable **sums** |
| sparse table | **O(1)** | ✗ none | immutable **min/max/gcd** (idempotent ops) |
| Fenwick tree | O(log n) | O(log n) | mutable **sums** — smallest and fastest |
| segment tree | O(log n) | O(log n) | mutable **any monoid**, plus range updates |
| segment tree + lazy | O(log n) | O(log n) **per range** | range *modifications* (add x to all of `[l,r)`) |

> [!tip] The advanced frontier
> - **Lazy-propagation segment trees** — apply updates to a whole *range* in O(log n).
> - **Sparse tables** — O(1) range min/max on *immutable* data (shown above).
> - **Suffix arrays / suffix automata** — advanced string queries (all substrings, longest repeated).
> - **Treaps / balanced BSTs with order statistics** — "k-th smallest" queries with updates.
> - **Persistent data structures** — query *past versions* of a structure after updates.
> - **Heavy-light decomposition, link-cut trees** — path queries on trees.
>
> These are competitive-programming and research territory. You'll rarely need them, but knowing they *exist* tells you where to look when a problem demands more than O(log n) range magic.

> [!best] In Rust, know the tools and use crates for the exotic
> Fenwick and segment trees are small and worth being able to write from scratch (they're competitive-programming staples). For the truly advanced structures, don't reinvent them under deadline — crates exist, and for most *real* (non-competitive) software, the [standard collections](#/ch/std-collections-ref) plus the occasional Fenwick tree cover everything. Reach for these advanced structures only when profiling proves you need range queries at scale.

## Summary

- **Range-query problems** (query a range *and* update elements, both frequently) defeat plain and prefix-sum arrays; specialized trees give **O(log n)** for both.
- A **Fenwick tree (BIT)** is a compact array using the **lowest-set-bit** trick for O(log n) prefix sums and point updates — ideal for **range sums**.
- A **segment tree** works for any **monoid**: an associative operation plus an **identity**. One generic implementation handles sum, min, max, gcd, and matrix product — get the identity wrong and every query silently returns it.
- Segment-tree queries need **two accumulators**, because associativity is required but **commutativity is not** — one accumulator quietly breaks non-commutative operations.
- Choose **Fenwick** for range sums (smaller/faster), **segment tree** for min/max/gcd or range updates.
- If the data is **immutable**, a **sparse table** gives O(1) queries — but only for **idempotent** operations, because it covers a range with two *overlapping* windows. Use prefix sums for immutable sums.
- Beyond these lie lazy propagation, suffix structures, persistent structures, and more — specialized tools for when O(log n) range magic isn't enough.

> [!exercise] Try it yourself
> 1. Extend the `Fenwick` tree with a `point_set(i, value)` that sets element `i` to an exact value (hint: update by the delta from its current value — which means you need to read it first).
> 2. Explain why a Fenwick tree can do range *sum* but not range *minimum* (what property does subtraction require?).
> 3. Build a `SegTree` with `identity = 0` and `combine = min`. Query any range and explain the result.
> 4. Use `SegTree` with a non-commutative operation — say 2×2 matrix multiplication. Then rewrite `query` with a single accumulator and find a range where the answer changes.
> 5. Add `range_min` to the sparse table for the *maximum* instead. Which line changes?
> 6. Try to make the sparse table answer range **sums** with the overlapping-window trick, and work out exactly which ranges come out wrong.
> 7. Compare a `SegTree` for sums against the `Fenwick` tree on the same workload: lines of code, memory, and query time for 10⁶ operations.
> 8. Implement `SegTree::first_at_least(value)` — the leftmost index whose prefix sum reaches `value` — by descending the tree in O(log n) rather than binary-searching with O(log² n) queries.

🎉 **That completes the Data Structures & Algorithms course** — from Big-O through graphs, DP, and advanced range structures, all in idiomatic Rust. You now have the algorithmic toolkit of a strong software engineer. The book closes with handy **appendices**: keyword and operator references, derivable traits, a glossary, and a one-page cheat sheet.
