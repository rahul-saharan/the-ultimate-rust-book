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

> [!key] Fenwick vs. segment tree
> - **Fenwick tree**: tiny, fast, simple — but limited to *invertible* operations (sums, XOR) because range queries subtract prefix results. Use it for **range sums** with point updates.
> - **Segment tree**: more code and memory, but handles *any associative* operation (min, max, gcd, sum) and supports **range updates** with "lazy propagation." Use it when you need range min/max or range modifications.
>
> Rule of thumb: reach for a **Fenwick tree** for range sums (it's the smaller, faster tool); use a **segment tree** when you need min/max/gcd queries or range updates.

## Beyond: a glimpse of the frontier

You've now covered the structures used in ~99% of programming. A few more exist for specialized domains:

> [!tip] The advanced frontier
> - **Lazy-propagation segment trees** — apply updates to a whole *range* in O(log n).
> - **Sparse tables** — O(1) range min/max on *immutable* data (no updates).
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
- A **segment tree** is more general — any associative op (sum/min/max/gcd) and range updates (with lazy propagation) — at the cost of more code.
- Choose **Fenwick** for range sums (smaller/faster), **segment tree** for min/max/gcd or range updates.
- Beyond these lie sparse tables, suffix structures, persistent structures, and more — specialized tools for when O(log n) range magic isn't enough.

> [!exercise] Try it yourself
> 1. Extend the `Fenwick` tree with a `point_set(i, value)` that sets element `i` to an exact value (hint: update by the delta from its current value).
> 2. Explain why a Fenwick tree can do range *sum* but not range *minimum* (what property does subtraction require?).
> 3. Sketch how a segment tree would answer "minimum of elements 2..7" by combining O(log n) node aggregates.

🎉 **That completes the Data Structures & Algorithms course** — from Big-O through graphs, DP, and advanced range structures, all in idiomatic Rust. You now have the algorithmic toolkit of a strong software engineer. The book closes with handy **appendices**: keyword and operator references, derivable traits, a glossary, and a one-page cheat sheet.
