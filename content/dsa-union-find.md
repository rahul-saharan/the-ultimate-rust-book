<h1><span class="h1-kicker">Data Structures & Algorithms</span>Union-Find / Disjoint Set</h1>

**Union-Find** (also called a **Disjoint Set Union**, or DSU) answers one deceptively powerful question incredibly fast: *"are these two things in the same group?"* — while letting you merge groups on the fly. It's the secret weapon behind [Kruskal's minimum spanning tree](#/ch/dsa-mst), cycle detection, network connectivity, and image segmentation. With two small optimizations, its operations run in *nearly constant* amortized time.

## The problem it solves

Imagine elements that start in their own separate groups, and you repeatedly:
- **union(a, b)** — merge the groups containing `a` and `b`, and
- **find(a)** — ask which group `a` belongs to (so **connected(a, b)** = same group?).

A naive approach (storing a group id per element and relabeling on every union) makes union O(n). Union-Find does far better by representing each group as a **tree**, where every element points toward a *root* that identifies the group:

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Union-find groups shown as trees where each element points to a representative root">
  <style>
    .ufm { font: 600 12px var(--font-mono); fill: #fff; }
    .ufc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ufn { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .ufr { fill: var(--green); stroke: var(--green); stroke-width: 2; }
  </style>
  <text x="14" y="24" class="ufc">Two groups, each a tree with a representative root (green):</text>
  <circle cx="120" cy="60" r="16" class="ufr"/><text x="115" y="65" class="ufm">0</text>
  <circle cx="80" cy="115" r="16" class="ufn"/><text x="75" y="120" class="ufm">1</text>
  <circle cx="160" cy="115" r="16" class="ufn"/><text x="155" y="120" class="ufm">2</text>
  <line x1="110" y1="72" x2="86" y2="102" stroke="var(--text-mute)"/><line x1="130" y1="72" x2="154" y2="102" stroke="var(--text-mute)"/>
  <circle cx="420" cy="60" r="16" class="ufr"/><text x="415" y="65" class="ufm">3</text>
  <circle cx="420" cy="115" r="16" class="ufn"/><text x="415" y="120" class="ufm">4</text>
  <line x1="420" y1="76" x2="420" y2="99" stroke="var(--text-mute)"/>
  <text x="120" y="150" class="ufc">find(1) = find(2) = 0 → same group</text>
  <text x="380" y="150" class="ufc">find(4) = 3</text>
</svg>
<figcaption>Each group is a tree; every element's root is its group's representative. Same root ⇒ same group.</figcaption>
</figure>

## The two crucial optimizations

The tree idea alone isn't enough — trees can get tall. Two optimizations make Union-Find nearly O(1):

> [!key] Path compression + union by rank
> - **Path compression**: during `find`, point every node you visit *directly* at the root, flattening the tree so future `find`s are instant.
> - **Union by rank** (or size): when merging, attach the *shorter* tree under the *taller* one, so trees stay shallow.
>
> Together, these make each operation run in **O(α(n))** amortized time, where α is the inverse Ackermann function — a value so slow-growing it's ≤ 4 for any conceivable input. In practice, that's **effectively constant time**. Neither optimization alone gets you there; both together are the magic.

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="Before path compression a chain of nodes points up to the root; after finding a node, every node on the path points directly at the root, flattening the tree">
  <style>
    .pc-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .pc-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pc-h { font: 700 12px var(--font-sans); }
    .node { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .root { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <text x="14" y="18" class="pc-h" fill="var(--text-mute)">Before find(D): a tall chain</text>
  <circle cx="80" cy="40" r="16" class="root"/><text x="75" y="45" class="pc-b">A</text>
  <circle cx="80" cy="85" r="16" class="node"/><text x="75" y="90" class="pc-b">B</text>
  <circle cx="80" cy="130" r="16" class="node"/><text x="75" y="135" class="pc-b">C</text>
  <circle cx="80" cy="172" r="14" class="node"/><text x="75" y="177" class="pc-b">D</text>
  <path d="M80 158 L80 101" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pca)"/>
  <path d="M80 114 L80 56" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pca)"/>
  <path d="M80 69 L80 56" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pca)"/>
  <text x="300" y="18" class="pc-h" fill="var(--green)">After find(D): flattened — all point to root A</text>
  <circle cx="440" cy="45" r="16" class="root"/><text x="435" y="50" class="pc-b">A</text>
  <circle cx="360" cy="130" r="16" class="node"/><text x="355" y="135" class="pc-b">B</text>
  <circle cx="440" cy="130" r="16" class="node"/><text x="435" y="135" class="pc-b">C</text>
  <circle cx="520" cy="130" r="16" class="node"/><text x="515" y="135" class="pc-b">D</text>
  <path d="M368 116 L432 61" stroke="var(--rust-500)" stroke-width="1.3" marker-end="url(#pcb)"/>
  <path d="M440 114 L440 61" stroke="var(--rust-500)" stroke-width="1.3" marker-end="url(#pcb)"/>
  <path d="M512 116 L448 61" stroke="var(--rust-500)" stroke-width="1.3" marker-end="url(#pcb)"/>
  <text x="300" y="176" class="pc-c">every node visited now points straight at the root → future finds are O(1)</text>
  <defs>
    <marker id="pca" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="pcb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption><b>Path compression</b>: one <code>find</code> re-points every node on the path directly to the root, so the tree stays almost flat.</figcaption>
</figure>

## The implementation

```rust
struct UnionFind {
    parent: Vec<usize>, // parent[i] = i's parent (or itself if it's a root)
    rank: Vec<usize>,   // an upper bound on each tree's height
}

impl UnionFind {
    // Every element starts in its own group (parent = itself).
    fn new(n: usize) -> Self {
        UnionFind {
            parent: (0..n).collect(),
            rank: vec![0; n],
        }
    }

    // Find the root of x's group, compressing the path on the way.
    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            let root = self.find(self.parent[x]);
            self.parent[x] = root; // PATH COMPRESSION: point x straight at the root
        }
        self.parent[x]
    }

    // Merge the groups of a and b. Returns false if already in the same group.
    fn union(&mut self, a: usize, b: usize) -> bool {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return false; // already connected — no merge (useful for cycle detection!)
        }
        // UNION BY RANK: hang the shorter tree under the taller one.
        if self.rank[ra] < self.rank[rb] {
            self.parent[ra] = rb;
        } else if self.rank[ra] > self.rank[rb] {
            self.parent[rb] = ra;
        } else {
            self.parent[rb] = ra;
            self.rank[ra] += 1; // equal ranks → one grows taller
        }
        true
    }

    fn connected(&mut self, a: usize, b: usize) -> bool {
        self.find(a) == self.find(b)
    }
}

fn main() {
    let mut uf = UnionFind::new(6); // elements 0..6, all separate

    uf.union(0, 1);
    uf.union(2, 3);
    uf.union(1, 3); // now {0,1,2,3} are all one group

    println!("0 & 3 connected? {}", uf.connected(0, 3)); // true
    println!("0 & 5 connected? {}", uf.connected(0, 5)); // false
    println!("union(0,1) again: {}", uf.union(0, 1));     // false (already together)
}
```

## Proving the optimizations matter

"Effectively constant time" is a strong claim. Here it is measured — the same 20,000 unions in an adversarial order, with each optimization switched on and off:

```rust
struct Dsu {
    parent: Vec<usize>,
    rank: Vec<usize>,
    compress: bool,
    by_rank: bool,
    steps: u64, // how many parent pointers we followed in total
}

impl Dsu {
    fn new(n: usize, compress: bool, by_rank: bool) -> Self {
        Dsu { parent: (0..n).collect(), rank: vec![0; n], compress, by_rank, steps: 0 }
    }

    /// Iterative find — no recursion, so a deep chain can't overflow the stack.
    fn find(&mut self, x: usize) -> usize {
        let mut root = x;
        while self.parent[root] != root {
            root = self.parent[root];
            self.steps += 1;
        }
        if self.compress {
            // Second pass: re-point everything on the path straight at the root.
            let mut cur = x;
            while self.parent[cur] != root {
                let next = self.parent[cur];
                self.parent[cur] = root;
                cur = next;
            }
        }
        root
    }

    fn union(&mut self, a: usize, b: usize) -> bool {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return false;
        }
        if !self.by_rank {
            self.parent[ra] = rb; // naive: pick a direction arbitrarily
            return true;
        }
        if self.rank[ra] < self.rank[rb] {
            self.parent[ra] = rb;
        } else if self.rank[ra] > self.rank[rb] {
            self.parent[rb] = ra;
        } else {
            self.parent[rb] = ra;
            self.rank[ra] += 1;
        }
        true
    }

    fn max_depth(&self) -> usize {
        (0..self.parent.len())
            .map(|mut x| {
                let mut d = 0;
                while self.parent[x] != x {
                    x = self.parent[x];
                    d += 1;
                }
                d
            })
            .max()
            .unwrap_or(0)
    }
}

fn main() {
    let n = 20_000usize;
    println!("{n} elements. Unions are issued as (0,1), (0,2), (0,3), … which is");
    println!("the worst order for a naive DSU: it builds one long chain.\n");
    println!("{:<26} {:>10} {:>14}", "configuration", "max depth", "find steps");
    println!("{}", "-".repeat(52));

    for &(compress, by_rank, name) in &[
        (false, false, "neither optimization"),
        (false, true, "union by rank only"),
        (true, false, "path compression only"),
        (true, true, "both (the real thing)"),
    ] {
        let mut dsu = Dsu::new(n, compress, by_rank);
        for i in 1..n {
            dsu.union(0, i);
        }
        for i in 0..n {
            dsu.find(i); // one query per element
        }
        println!("{:<26} {:>10} {:>14}", name, dsu.max_depth(), dsu.steps);
    }
    println!("\nWithout either, the structure degenerates to a linked list and the");
    println!("total work is quadratic. With both, every node points at the root.");
}
```

> [!performance] 400 million steps versus 20 thousand
> The unoptimized version follows **399,960,001** parent pointers to answer 20,000 queries, with a maximum depth of 19,999 — it has become a linked list, and the total work is O(n²). Adding *either* optimization collapses that to a depth of **1** and roughly 20,000–80,000 steps: a factor of five thousand to twenty thousand.
>
> One honesty note about this particular experiment: because every union here goes through the same root, **union by rank alone** already flattens it, so this input doesn't separate the two optimizations from each other. Other adversarial orders do — union by rank alone can still leave O(log n) depth, and path compression alone can too. The theoretical **O(α(n))** guarantee requires *both*. What the table does show unambiguously is that omitting them both is catastrophic, not merely slower.

> [!warning] Prefer the iterative `find` — the recursive one can overflow
> The implementation earlier in this chapter uses recursion, which is elegant and matches how the algorithm is usually written. But it recurses once per level of the tree, and an un-optimized (or adversarially built) DSU can be tens of thousands of levels deep — exactly the case the table above constructs. That's a stack overflow, and it aborts the process rather than panicking cleanly.
>
> The `find` above avoids it entirely: walk to the root in a loop, then walk again to re-point. Two passes, no recursion, same complexity. There's also **path halving**, a one-pass variant that sets each node's parent to its *grandparent* as it climbs — slightly less flattening per call, but often faster in practice because it touches memory once instead of twice.

## A more useful DSU: sizes and component counts

Two small additions make union-find far more practical: track each group's **size**, and maintain a running **count** of groups. Both come almost free, and union by size works just as well as union by rank.

```rust
/// Union by SIZE — the size is useful information in its own right.
struct Dsu {
    parent: Vec<usize>,
    size: Vec<usize>,
    groups: usize, // maintained, so counting is O(1)
}

impl Dsu {
    fn new(n: usize) -> Self {
        Dsu { parent: (0..n).collect(), size: vec![1; n], groups: n }
    }

    fn find(&mut self, x: usize) -> usize {
        let mut root = x;
        while self.parent[root] != root {
            root = self.parent[root];
        }
        let mut cur = x;
        while self.parent[cur] != root {
            let next = self.parent[cur];
            self.parent[cur] = root;
            cur = next;
        }
        root
    }

    fn union(&mut self, a: usize, b: usize) -> bool {
        let (mut ra, mut rb) = (self.find(a), self.find(b));
        if ra == rb {
            return false;
        }
        // Attach the smaller group under the larger one.
        if self.size[ra] < self.size[rb] {
            std::mem::swap(&mut ra, &mut rb);
        }
        self.parent[rb] = ra;
        self.size[ra] += self.size[rb];
        self.groups -= 1;
        true
    }

    fn connected(&mut self, a: usize, b: usize) -> bool {
        self.find(a) == self.find(b)
    }

    /// Size of the group containing x.
    fn group_size(&mut self, x: usize) -> usize {
        let root = self.find(x);
        self.size[root]
    }

    /// O(1) — no scan needed, because union maintains it.
    fn group_count(&self) -> usize {
        self.groups
    }
}

fn main() {
    let mut dsu = Dsu::new(10);
    println!("10 elements → {} groups", dsu.group_count());
    for &(a, b) in &[(0, 1), (2, 3), (1, 3), (4, 5), (6, 7), (7, 8)] {
        dsu.union(a, b);
        println!("  union({a},{b}) → {} groups", dsu.group_count());
    }

    println!("\nconnected(0,3)  {}", dsu.connected(0, 3));
    println!("connected(0,5)  {}", dsu.connected(0, 5));
    println!("group_size(0)   {}   (0,1,2,3)", dsu.group_size(0));
    println!("group_size(6)   {}   (6,7,8)", dsu.group_size(6));
    println!("group_size(9)   {}   (alone)", dsu.group_size(9));

    // Cycle detection: `union` returning false means "already connected".
    println!("\nadding a triangle 0-1, 1-2, 2-0:");
    let mut tri = Dsu::new(3);
    for &(a, b) in &[(0, 1), (1, 2), (2, 0)] {
        if tri.union(a, b) {
            println!("  edge ({a},{b}) added");
        } else {
            println!("  edge ({a},{b}) would close a CYCLE");
        }
    }
}
```

> [!best] Maintain the group count in `union`, don't recount
> Counting distinct roots means calling `find` on every element — O(n·α(n)) each time you ask. But every successful `union` reduces the group count by exactly one, so a single `groups` field kept up to date answers it in **O(1)**. It's the same principle as the `passing` counter in the [tries chapter](#/ch/dsa-tries): if a query is asked often, maintain its answer during mutation instead of computing it on demand. Just remember the corollary — a maintained field must be updated on *every* path that changes the structure, or it drifts silently.

> [!note] Union by size or union by rank? Either is fine
> Rank is an upper bound on tree height; size is the number of elements. Both give the same O(α(n)) guarantee, and in practice they perform almost identically. Prefer **size** when the count is useful to you anyway — "how big is this connected component?" is a common question, and rank can't answer it. Prefer **rank** when you want the smaller integer (ranks stay under log n, sizes go up to n), which occasionally matters for memory.

## Where union-find shines

> [!key] The killer applications
> Union-Find is the right tool whenever you're tracking **dynamic connectivity** — groups that merge over time:
> - **[Kruskal's MST](#/ch/dsa-mst)**: add edges cheapest-first, using union-find to skip edges that would form a cycle (both endpoints already connected).
> - **Cycle detection** in an undirected graph: if an edge connects two already-connected nodes, it closes a cycle.
> - **Connected components**: after unioning all edges, count distinct roots.
> - **Network/friendship connectivity**, **percolation**, and **image segmentation** (merging adjacent similar pixels).
>
> If a problem involves "merge these two groups" and "are these in the same group?", reach for union-find.

## Complexity

| Operation | Naive | With both optimizations |
|-----------|-------|-------------------------|
| find | O(n) | **O(α(n)) ≈ O(1)** |
| union | O(n) | **O(α(n)) ≈ O(1)** |
| connected | O(n) | **O(α(n)) ≈ O(1)** |

> [!best] It's tiny — memorize it
> Union-Find is one of the highest-value-per-line data structures in existence: ~25 lines gives you near-constant-time connectivity. It's a staple of competitive programming and shows up in real systems (Kruskal's algorithm, filesystem checks, compilers' type unification). Unlike balanced trees, it's *easy* to implement correctly in Rust — a plain `Vec<usize>` with no borrow-checker drama. Worth having in your back pocket.

## Summary

- **Union-Find (DSU)** tracks a partition of elements into disjoint groups, supporting **union** (merge groups) and **find**/**connected** (same group?).
- Each group is a **tree**; every element points toward its group's **root** (representative).
- **Path compression** (flatten during `find`) + **union by rank** (attach shorter under taller) give **~O(1) amortized** (inverse-Ackermann) operations. The theoretical bound needs **both**.
- Measured: with neither optimization, 20,000 queries cost **400 million** pointer hops at depth 19,999. With them, **20,000** hops at depth 1.
- Prefer the **iterative `find`** — the recursive version overflows the stack on a deep tree, which is exactly the case a missing optimization creates. **Path halving** is a one-pass alternative.
- Track **size** rather than rank when you want `group_size`, and maintain a **`groups` counter** in `union` so counting components is O(1) instead of O(n·α(n)).
- It powers **Kruskal's MST**, **cycle detection**, **connected components**, and dynamic-connectivity problems generally.
- It's small, fast, and borrow-checker-friendly (just a `Vec<usize>`) — a great one to memorize.

> [!exercise] Try it yourself
> 1. Add a `largest_group(&mut self) -> usize` returning the size of the biggest component, in O(1).
> 2. Use union-find to detect whether adding edges `[(0,1),(1,2),(2,0)]` to a graph forms a cycle (the third edge should).
> 3. Implement `find_halving` (point each node at its grandparent while climbing) and compare its step count against two-pass compression on the 20,000-element benchmark.
> 4. Build the adversarial input where **union by rank alone** still leaves depth O(log n). What union order achieves that?
> 5. Union 200,000 elements with *neither* optimization, then call the **recursive** `find`. Explain what happens and why the iterative version survives.
> 6. Remove the `self.groups -= 1` line and write a `group_count` that scans instead. Time both at n = 100,000.
> 7. Union-find cannot **split** a group. Why not — what would `undo(a, b)` have to reverse? Look up "DSU with rollback" and describe what it gives up to support it.
> 8. Extend the DSU with a **parity** bit per element (`same` or `opposite` group) so it can answer "is this graph bipartite?" as edges arrive.

We've built the core data structures. Next we turn to the richest problem domain of all — **graphs**.
