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
- **Path compression** (flatten during `find`) + **union by rank** (attach shorter under taller) give **~O(1) amortized** (inverse-Ackermann) operations.
- It powers **Kruskal's MST**, **cycle detection**, **connected components**, and dynamic-connectivity problems generally.
- It's small, fast, and borrow-checker-friendly (just a `Vec<usize>`) — a great one to memorize.

> [!exercise] Try it yourself
> 1. Add a `count_groups(&mut self) -> usize` that counts how many distinct roots remain.
> 2. Use union-find to detect whether adding edges `[(0,1),(1,2),(2,0)]` to a graph forms a cycle (the third edge should).
> 3. Track group **sizes** instead of ranks ("union by size") and add a `group_size(x)` method.

We've built the core data structures. Next we turn to the richest problem domain of all — **graphs**.
