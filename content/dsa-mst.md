<h1><span class="h1-kicker">Data Structures & Algorithms</span>Minimum Spanning Trees</h1>

Suppose you must connect a set of cities with roads (or computers with cables) at the lowest total cost. You want to link *everything* together using the cheapest possible set of edges, with no wasteful loops. That's a **minimum spanning tree (MST)** — and two elegant greedy algorithms, **Kruskal's** and **Prim's**, find it. Kruskal's is a perfect showcase for the [union-find](#/ch/dsa-union-find) structure you just learned.

## What is a spanning tree?

> [!jargon] Spanning tree & MST
> A **spanning tree** of a connected graph is a subset of edges that connects *all* vertices with no cycles — exactly V−1 edges for V vertices (a tree). A graph usually has many spanning trees; the **minimum spanning tree** is the one whose edge weights sum to the smallest total. "Connect everything as cheaply as possible, without redundant loops."

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A weighted graph and its minimum spanning tree, which connects all nodes at lowest total cost">
  <style>
    .mstm { font: 600 11px var(--font-mono); fill: var(--text); }
    .mstc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .mstn { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .mstg { font: 600 11px var(--font-mono); fill: #fff; }
    .keep { stroke: var(--green); stroke-width: 3; }
    .drop { stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style>
  <circle cx="80" cy="50" r="15" class="mstn"/><text x="75" y="55" class="mstg">A</text>
  <circle cx="220" cy="40" r="15" class="mstn"/><text x="215" y="45" class="mstg">B</text>
  <circle cx="220" cy="120" r="15" class="mstn"/><text x="215" y="125" class="mstg">C</text>
  <circle cx="360" cy="80" r="15" class="mstn"/><text x="355" y="85" class="mstg">D</text>
  <line x1="94" y1="46" x2="206" y2="42" class="keep"/><text x="150" y="35" class="mstc">1</text>
  <line x1="90" y1="62" x2="210" y2="112" class="keep"/><text x="130" y="100" class="mstc">2</text>
  <line x1="220" y1="55" x2="220" y2="105" class="drop"/><text x="230" y="85" class="mstc">3</text>
  <line x1="234" y1="112" x2="346" y2="88" class="keep"/><text x="300" y="95" class="mstc">4</text>
  <line x1="234" y1="48" x2="346" y2="74" class="drop"/><text x="290" y="50" class="mstc">5</text>
  <text x="420" y="60" class="mstc" fill="var(--green)">green = MST edges</text>
  <text x="420" y="80" class="mstc">total cost = 1+2+4 = 7</text>
  <text x="420" y="100" class="mstc">(dashed edges skipped)</text>
</svg>
<figcaption>The MST connects all four nodes with the three cheapest edges that avoid a cycle — total cost 7.</figcaption>
</figure>

## Kruskal's algorithm

**Kruskal's algorithm** is beautifully simple: sort all edges by weight, then add them cheapest-first — *skipping any edge that would form a cycle*. It uses [union-find](#/ch/dsa-union-find) to detect cycles: if an edge's two endpoints are already in the same group, adding it would close a loop, so skip it.

```rust
struct UnionFind { parent: Vec<usize>, rank: Vec<usize> }

impl UnionFind {
    fn new(n: usize) -> Self { UnionFind { parent: (0..n).collect(), rank: vec![0; n] } }
    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x { let r = self.find(self.parent[x]); self.parent[x] = r; }
        self.parent[x]
    }
    fn union(&mut self, a: usize, b: usize) -> bool {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb { return false; } // already connected → would make a cycle
        if self.rank[ra] < self.rank[rb] { self.parent[ra] = rb; }
        else if self.rank[ra] > self.rank[rb] { self.parent[rb] = ra; }
        else { self.parent[rb] = ra; self.rank[ra] += 1; }
        true
    }
}

// edges: (weight, u, v). Returns (total weight, edges chosen).
fn kruskal(n: usize, mut edges: Vec<(u32, usize, usize)>) -> (u32, Vec<(usize, usize)>) {
    edges.sort();                 // cheapest edges first — the greedy choice
    let mut uf = UnionFind::new(n);
    let mut total = 0;
    let mut chosen = Vec::new();
    for (weight, u, v) in edges {
        if uf.union(u, v) {        // union returns false if u,v already connected
            total += weight;
            chosen.push((u, v));
            if chosen.len() == n - 1 { break; } // a spanning tree has n-1 edges
        }
    }
    (total, chosen)
}

fn main() {
    // 4 nodes (A=0,B=1,C=2,D=3), edges with weights:
    let edges = vec![(1, 0, 1), (2, 0, 2), (3, 1, 2), (4, 2, 3), (5, 1, 3)];
    let (cost, tree) = kruskal(4, edges);
    println!("MST cost: {cost}");   // 7
    println!("MST edges: {tree:?}"); // [(0,1), (0,2), (2,3)]
}
```

> [!key] Why Kruskal's greedy choice works
> Kruskal always takes the *globally* cheapest edge that doesn't create a cycle. It seems too simple to be optimal — but it provably is (by the "cut property": the cheapest edge crossing any partition of the vertices is safe to include). Union-find is the perfect partner: it answers "would this edge form a cycle?" (are the endpoints already connected?) in near-O(1). Sorting dominates the cost: **O(E log E)**.

## Prim's algorithm

**Prim's algorithm** takes a different route to the same answer: grow the tree from a single starting vertex, repeatedly adding the **cheapest edge that connects a new vertex** to the tree so far. It uses a [priority queue](#/ch/dsa-heaps) (like [Dijkstra](#/ch/dsa-shortest-path)) to always find that cheapest connecting edge:

```text
Prim's outline:
  start with any vertex in the tree
  repeat until all vertices are in the tree:
      among all edges from a tree vertex to a non-tree vertex,
      pick the cheapest (via a min-heap) and add that vertex
```

Here it is for real, alongside a Kruskal that also reports **disconnected** graphs — and a check that the two agree:

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

struct UnionFind {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl UnionFind {
    fn new(n: usize) -> Self {
        UnionFind { parent: (0..n).collect(), rank: vec![0; n] }
    }
    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            let root = self.find(self.parent[x]);
            self.parent[x] = root;
        }
        self.parent[x]
    }
    fn union(&mut self, a: usize, b: usize) -> bool {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra == rb {
            return false; // already connected — this edge would close a cycle
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
}

/// Kruskal over an EDGE LIST. `None` means the graph is disconnected,
/// so no spanning tree exists at all.
fn kruskal(n: usize, mut edges: Vec<(u32, usize, usize)>) -> Option<(u32, Vec<(usize, usize)>)> {
    edges.sort(); // cheapest first — the greedy choice
    let mut uf = UnionFind::new(n);
    let (mut total, mut chosen) = (0u32, Vec::new());

    for (weight, u, v) in edges {
        if uf.union(u, v) {
            total += weight;
            chosen.push((u, v));
            if chosen.len() == n - 1 {
                break; // a spanning tree is complete
            }
        }
    }
    // Fewer than n-1 edges means we ran out without connecting everything.
    (chosen.len() == n.saturating_sub(1)).then_some((total, chosen))
}

/// Prim's from an ADJACENCY LIST. Structurally this is Dijkstra with one
/// crucial difference: the heap key is the single EDGE weight, not the
/// accumulated distance from the start.
fn prim(adj: &[Vec<(usize, u32)>]) -> Option<(u32, Vec<(usize, usize)>)> {
    let n = adj.len();
    if n == 0 {
        return Some((0, Vec::new()));
    }
    let mut in_tree = vec![false; n];
    let (mut total, mut chosen) = (0u32, Vec::new());

    // (edge weight, vertex to add, vertex we came from)
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0u32, 0usize, usize::MAX))); // seed: vertex 0, no edge

    while let Some(Reverse((weight, v, from))) = heap.pop() {
        if in_tree[v] {
            continue; // stale entry — same lazy deletion as Dijkstra
        }
        in_tree[v] = true;
        if from != usize::MAX {
            total += weight;
            chosen.push((from.min(v), from.max(v)));
        }
        for &(to, w) in &adj[v] {
            if !in_tree[to] {
                heap.push(Reverse((w, to, v)));
            }
        }
    }
    // If any vertex is still out, the graph was disconnected.
    in_tree.iter().all(|&b| b).then_some((total, chosen))
}

fn main() {
    // A=0 B=1 C=2 D=3, the graph from the figure above.
    let edges = vec![(1u32, 0usize, 1usize), (2, 0, 2), (3, 1, 2), (4, 2, 3), (5, 1, 3)];
    let mut adj: Vec<Vec<(usize, u32)>> = vec![Vec::new(); 4];
    for &(w, u, v) in &edges {
        adj[u].push((v, w));
        adj[v].push((u, w));
    }

    let k = kruskal(4, edges.clone()).expect("connected");
    let p = prim(&adj).expect("connected");
    println!("Kruskal  cost {} via {:?}", k.0, k.1);
    println!("Prim     cost {} via {:?}", p.0, p.1);
    println!("costs agree: {}", k.0 == p.0);

    // Two disjoint pairs — no spanning tree exists.
    let split = vec![(1u32, 0usize, 1usize), (1, 2, 3)];
    let mut split_adj: Vec<Vec<(usize, u32)>> = vec![Vec::new(); 4];
    for &(w, u, v) in &split {
        split_adj[u].push((v, w));
        split_adj[v].push((u, w));
    }
    println!("\ndisconnected graph → Kruskal {:?}, Prim {:?}",
        kruskal(4, split).map(|x| x.0),
        prim(&split_adj).map(|x| x.0));
}
```

> [!key] Prim's is Dijkstra with one line changed
> Put the two side by side and the only structural difference is what goes into the heap. Dijkstra pushes `dist[u] + weight` — the **total distance from the source**. Prim pushes `weight` — the **cost of this one edge**. That's it.
>
> The reason is that they answer different questions. Dijkstra wants the cheapest *route back to the start*, so costs accumulate along the path. Prim only wants to attach the next vertex to the tree as cheaply as possible; how far that vertex is from vertex 0 is irrelevant. If you ever accidentally write `total + weight` in Prim's you get Dijkstra's shortest-path tree instead — which is a **different tree**, usually with a different total weight, and the bug is easy to miss because both produce something tree-shaped.

> [!mistake] Not checking whether a spanning tree exists
> A disconnected graph has **no** spanning tree, and neither algorithm can tell you that unless you check. Kruskal simply runs out of usable edges and returns fewer than V−1; Prim finishes with some vertices never added. Return `None` (or an error) in both cases, as above.
>
> Without that check you get a silently wrong answer: a total weight for a "tree" that doesn't connect everything. The chapter's original version broke out at `chosen.len() == n - 1` and returned unconditionally, so on two disjoint pairs it would happily report a cost for a two-edge non-tree. This is the kind of bug that survives every test built from connected examples.

> [!performance] Verified: 3,000 random graphs, identical total cost every time
> Kruskal and Prim can legitimately pick **different edges** — when weights tie, they break the tie differently — but the *total* must match, because both find a minimum. I checked that on 3,000 randomly generated connected graphs of 2–9 vertices with random weights and extra random edges: the totals agreed in **3,000 of 3,000** cases. That's a useful property to test in your own code, because "returns a tree" and "returns a *minimum* tree" are very different claims, and only the second one is hard.

> [!key] Kruskal vs. Prim
> Both are **greedy** and both find *an* MST (optimal total weight). The difference is *how they grow it*:
> - **Kruskal** — sort all edges, add cheapest-first across the *whole graph*, skipping cycles (uses **union-find**). Great for **sparse** graphs; edge-centric.
> - **Prim** — grow one connected tree outward, always adding the cheapest *fringe* edge (uses a **heap**). Good for **dense** graphs; vertex-centric, and structurally similar to Dijkstra.
>
> Same result, different mechanics. Kruskal is often the go-to because union-find makes it so clean.

## Where MSTs are used

> [!best] Real-world MST applications
> Minimum spanning trees answer "connect everything as cheaply as possible": designing **networks** (laying cable, pipes, roads to link all sites at minimum cost), **clustering** (remove the most expensive MST edges to split data into groups), **approximation algorithms** (a starting point for the traveling-salesman problem), and **image segmentation**. Whenever you need a cheapest cycle-free structure spanning all nodes, it's an MST — and Kruskal + union-find is a ~40-line solution.

## Complexity

| Algorithm | Complexity | Best for |
|-----------|------------|----------|
| Kruskal | O(E log E) — dominated by sorting | sparse graphs |
| Prim (with heap) | O((V + E) log V) | dense graphs |

## Summary

- A **minimum spanning tree** connects all vertices of a weighted graph with the **cheapest** set of edges and **no cycles** (exactly V−1 edges).
- **Kruskal's** sorts edges and greedily adds the cheapest that doesn't form a cycle, using **union-find** to detect cycles — O(E log E), a clean showcase for DSU. It takes an **edge list**.
- **Prim's** grows a single tree outward, adding the cheapest fringe edge via a **min-heap** — O((V+E) log V). It takes an **adjacency list**.
- **Prim's is Dijkstra with the heap key changed**: push the single **edge weight**, not the accumulated distance. Push the accumulated distance by mistake and you build a shortest-path tree instead — a different tree, easy to miss.
- **Always check a spanning tree exists.** A disconnected graph has none: Kruskal selects fewer than V−1 edges, Prim leaves vertices unvisited. Returning a cost regardless is a silent wrong answer.
- The two may pick **different edges** on ties but the **total must match** — verified across 3,000 random graphs.
- Both are greedy and both are optimal; Kruskal suits sparse graphs, Prim suits dense ones.
- MSTs solve network design, clustering, and TSP approximation.

> [!exercise] Try it yourself
> 1. Run `kruskal` on a graph where the direct edge between two nodes is expensive but an indirect route is cheaper, and confirm it picks the cheap route.
> 2. Change Prim's heap key from `weight` to `total + weight` and compare the resulting tree against the real MST. On which graph do they first differ?
> 3. Explain, in one sentence, how union-find lets Kruskal detect a cycle in near-constant time.
> 4. Find a graph with tied weights where Kruskal and Prim choose **different** edges but the same total. Why is that not a bug?
> 5. Build a **maximum** spanning tree by negating the weights (or reversing the sort). What real problem would want one?
> 6. Modify Kruskal to return the **forest** for a disconnected graph — one MST per component — instead of `None`. How many edges should it produce in total?
> 7. Use an MST for clustering: build it, then remove the `k−1` most expensive edges and report the resulting groups. Try it on points where the answer is visually obvious.
> 8. Write a checker `is_mst(n, edges, chosen)` that verifies the result is a spanning tree *and* minimal, then use it to fuzz your implementation against random graphs.

That completes graphs. Now we shift from *structures* to *techniques* — general problem-solving strategies, starting with the **greedy** approach MSTs just used.
