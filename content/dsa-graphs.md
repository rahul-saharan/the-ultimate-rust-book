<h1><span class="h1-kicker">Data Structures & Algorithms</span>Graphs: Representation</h1>

A **graph** is the most versatile data structure — it models *relationships*: social networks, road maps, web links, dependencies, state machines. A graph is just a set of **vertices** (nodes) connected by **edges**. Before we run algorithms on graphs, we need to *represent* them in memory, and the choice of representation shapes everything that follows. This chapter covers the two main representations and how to model them in Rust.

## The vocabulary

> [!jargon] Graph terms
> A **vertex** (or node) is a point; an **edge** connects two vertices. Edges can be **directed** (one-way, like a Twitter follow) or **undirected** (mutual, like a Facebook friendship), and **weighted** (an edge carries a number — distance, cost) or unweighted. A **path** is a sequence of edges between two vertices; a **cycle** is a path that returns to its start. Trees and linked lists are actually special cases of graphs (a tree is a connected graph with no cycles).

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A small graph and its two representations: adjacency list and adjacency matrix">
  <style>
    .grm { font: 600 11px var(--font-mono); fill: var(--text); }
    .grc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .gnode { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .gm { font: 600 11px var(--font-mono); fill: #fff; }
  </style>
  <circle cx="60" cy="50" r="15" class="gnode"/><text x="55" y="55" class="gm">0</text>
  <circle cx="150" cy="30" r="15" class="gnode"/><text x="145" y="35" class="gm">1</text>
  <circle cx="150" cy="90" r="15" class="gnode"/><text x="145" y="95" class="gm">2</text>
  <circle cx="60" cy="120" r="15" class="gnode"/><text x="55" y="125" class="gm">3</text>
  <line x1="72" y1="44" x2="138" y2="34" stroke="var(--text-mute)"/><line x1="72" y1="56" x2="138" y2="86" stroke="var(--text-mute)"/><line x1="150" y1="45" x2="150" y2="75" stroke="var(--text-mute)"/><line x1="60" y1="65" x2="60" y2="105" stroke="var(--text-mute)"/>
  <text x="250" y="24" class="grc">Adjacency list:</text>
  <text x="250" y="44" class="grm">0 → [1, 2, 3]</text>
  <text x="250" y="62" class="grm">1 → [0, 2]</text>
  <text x="250" y="80" class="grm">2 → [0, 1]</text>
  <text x="250" y="98" class="grm">3 → [0]</text>
  <text x="440" y="24" class="grc">Adjacency matrix:</text>
  <text x="440" y="44" class="grm">  0 1 2 3</text>
  <text x="440" y="62" class="grm">0 0 1 1 1</text>
  <text x="440" y="80" class="grm">1 1 0 1 0</text>
  <text x="440" y="98" class="grm">2 1 1 0 0</text>
  <text x="440" y="116" class="grm">3 1 0 0 0</text>
</svg>
<figcaption>The same graph as an <b>adjacency list</b> (each node's neighbors) and an <b>adjacency matrix</b> (a connection table).</figcaption>
</figure>

## Representation 1: adjacency list

An **adjacency list** stores, for each vertex, a list of its neighbors. It's the most common representation — compact for **sparse** graphs (few edges), which describes most real-world graphs. In Rust, a `Vec<Vec<usize>>` (indexed by vertex) is the simplest form:

```rust
struct Graph {
    adjacency: Vec<Vec<usize>>, // adjacency[u] = neighbors of u
}

impl Graph {
    fn new(vertices: usize) -> Self {
        Graph { adjacency: vec![Vec::new(); vertices] }
    }

    // Undirected edge: add each endpoint to the other's list.
    fn add_edge(&mut self, u: usize, v: usize) {
        self.adjacency[u].push(v);
        self.adjacency[v].push(u); // omit this line for a DIRECTED graph
    }

    fn neighbors(&self, u: usize) -> &[usize] {
        &self.adjacency[u]
    }
}

fn main() {
    let mut g = Graph::new(4);
    g.add_edge(0, 1);
    g.add_edge(0, 2);
    g.add_edge(0, 3);
    g.add_edge(1, 2);

    for u in 0..4 {
        println!("{u} → {:?}", g.neighbors(u));
    }
}
```

For **weighted** graphs, store `(neighbor, weight)` pairs: `Vec<Vec<(usize, u32)>>`. For non-integer vertex ids (strings, etc.), use a `HashMap<T, Vec<T>>`.

## Representation 2: adjacency matrix

An **adjacency matrix** is an n×n grid where `matrix[u][v]` is 1 (or the edge weight) if there's an edge, 0 otherwise. It gives **O(1) edge lookups** ("is there an edge u→v?") but uses **O(n²) memory** regardless of how few edges exist:

```rust
struct MatrixGraph {
    matrix: Vec<Vec<bool>>,
}

impl MatrixGraph {
    fn new(n: usize) -> Self {
        MatrixGraph { matrix: vec![vec![false; n]; n] }
    }
    fn add_edge(&mut self, u: usize, v: usize) {
        self.matrix[u][v] = true;
        self.matrix[v][u] = true; // undirected
    }
    fn has_edge(&self, u: usize, v: usize) -> bool {
        self.matrix[u][v] // O(1) lookup
    }
}

fn main() {
    let mut g = MatrixGraph::new(4);
    g.add_edge(0, 1);
    g.add_edge(2, 3);
    println!("edge 0-1? {}", g.has_edge(0, 1)); // true
    println!("edge 0-2? {}", g.has_edge(0, 2)); // false
}
```

## Representation 3: edge list

There's a third representation the two above don't cover, and several important algorithms want it: just **a list of the edges**, with no per-vertex structure at all.

```rust,ignore
let edges: Vec<(usize, usize, u32)> = vec![
    (0, 1, 344), // from, to, weight
    (0, 2, 464),
    (1, 3, 878),
];
```

That looks too simple to be useful, and for traversal it is — finding a vertex's neighbours means scanning every edge. But when an algorithm processes **edges rather than vertices**, it's exactly the right shape:

| Algorithm | Wants | Why |
|---|---|---|
| [Kruskal's MST](#/ch/dsa-mst) | **edge list** | sorts all edges by weight, then considers each once |
| [Bellman–Ford](#/ch/dsa-shortest-path) | **edge list** | relaxes every edge, V−1 times |
| BFS / DFS | adjacency list | needs a vertex's neighbours repeatedly |
| [Dijkstra](#/ch/dsa-shortest-path) | adjacency list | expands the frontier vertex by vertex |
| [Floyd–Warshall](#/ch/dsa-shortest-path) | **matrix** | updates `dist[i][j]` in place |
| dense edge-existence checks | **matrix** | O(1) lookup |

Converting an adjacency list to an edge list is a one-liner, so it's common to store the list and derive the edges when an algorithm needs them.

## Modelling real data: interning labels to ids

The chapter's `Vec<Vec<usize>>` assumes vertices are already `0..n`, but real data arrives as city names, user IDs, or URLs. The advice "map them to integer ids first" is right — here's what that actually looks like, with weights and both degree directions:

```rust
use std::collections::HashMap;

/// Assigns each distinct label a dense id, so algorithms can use fast Vec indexing.
#[derive(Default)]
struct Vertices {
    ids: HashMap<String, usize>,
    labels: Vec<String>,
}

impl Vertices {
    /// Idempotent: the same label always returns the same id.
    fn id(&mut self, label: &str) -> usize {
        if let Some(&existing) = self.ids.get(label) {
            return existing;
        }
        let next = self.labels.len();
        self.ids.insert(label.to_string(), next);
        self.labels.push(label.to_string());
        next
    }

    fn label(&self, id: usize) -> &str {
        &self.labels[id]
    }

    fn len(&self) -> usize {
        self.labels.len()
    }
}

/// A weighted, directed graph keyed by labels but stored by index.
struct Graph {
    adj: Vec<Vec<(usize, u32)>>,
    vertices: Vertices,
}

impl Graph {
    fn new() -> Self {
        Graph { adj: Vec::new(), vertices: Vertices::default() }
    }

    fn add_edge(&mut self, from: &str, to: &str, weight: u32) {
        let (a, b) = (self.vertices.id(from), self.vertices.id(to));
        // Grow the adjacency list to cover any newly interned vertex.
        while self.adj.len() < self.vertices.len() {
            self.adj.push(Vec::new());
        }
        self.adj[a].push((b, weight));
    }

    fn out_degree(&self, u: usize) -> usize {
        self.adj[u].len()
    }

    /// In-degree costs O(V + E) here — an adjacency list only records
    /// outgoing edges. Store a reverse graph if you need this often.
    fn in_degree(&self, u: usize) -> usize {
        self.adj.iter().flatten().filter(|(to, _)| *to == u).count()
    }

    fn edge_list(&self) -> Vec<(usize, usize, u32)> {
        self.adj
            .iter()
            .enumerate()
            .flat_map(|(u, ns)| ns.iter().map(move |&(v, w)| (u, v, w)))
            .collect()
    }
}

fn main() {
    let mut g = Graph::new();
    g.add_edge("london", "paris", 344);
    g.add_edge("london", "dublin", 464);
    g.add_edge("paris", "berlin", 878);
    g.add_edge("dublin", "london", 464);

    println!("{} vertices", g.vertices.len());
    for u in 0..g.vertices.len() {
        let out: Vec<String> = g.adj[u]
            .iter()
            .map(|(to, w)| format!("{}({w}km)", g.vertices.label(*to)))
            .collect();
        println!("  {:<7} out={} in={}  → {}",
            g.vertices.label(u), g.out_degree(u), g.in_degree(u), out.join(", "));
    }

    println!("\nderived edge list ({} edges):", g.edge_list().len());
    for (u, v, w) in g.edge_list() {
        println!("  {} → {} ({w})", g.vertices.label(u), g.vertices.label(v));
    }
}
```

> [!best] Intern to dense ids, then index — don't run algorithms on a `HashMap` graph
> It's tempting to keep `HashMap<String, Vec<String>>` and be done with it, but every neighbour lookup then costs a string hash, and the `visited` set becomes a `HashSet<String>` instead of a `vec![false; n]`. Interning once up front buys you `Vec` indexing everywhere afterwards — which is often several times faster and lets you use plain arrays for the per-vertex state (`dist`, `visited`, `parent`) that nearly every graph algorithm needs. Keep the label table around so you can translate ids back for output.

> [!mistake] In-degree is expensive in an adjacency list
> An adjacency list records only *outgoing* edges, so `in_degree` above has to scan the entire structure — O(V + E) for one vertex. If your algorithm needs in-degrees repeatedly (topological sort, for instance), build them **once** into a `Vec<usize>` in a single O(V + E) pass, or store a **reverse graph** alongside the forward one. Calling an O(V+E) helper inside a loop over vertices is a classic accidental O(V·E), and it's easy to do because the method looks innocuous.

## Choosing a representation

> [!key] Adjacency list vs. matrix
> | | Adjacency list | Adjacency matrix |
> |---|---|---|
> | Memory | **O(V + E)** — compact | O(V²) — wasteful if sparse |
> | "Are u,v connected?" | O(degree) | **O(1)** |
> | Iterate a node's neighbors | **O(degree)** — efficient | O(V) — must scan a whole row |
> | Best for | **sparse** graphs (most real ones) | **dense** graphs, or frequent edge lookups |
>
> **Default to the adjacency list** — real-world graphs (social networks, road maps, the web) are sparse, so O(V+E) beats O(V²) dramatically, and the algorithms we'll run (BFS, DFS, Dijkstra) iterate neighbors, which lists do best. Reach for a matrix only when the graph is dense or you need constant-time edge existence checks.

"Sparse" and "dense" are vague until you put numbers on them, so here they are:

```rust
use std::mem::size_of;

fn main() {
    println!("Memory for V vertices and E undirected edges (usize = {} bytes)\n",
        size_of::<usize>());
    println!("{:>7} {:>10} {:>9} | {:>12} {:>13} {:>12}",
        "V", "E", "density", "adj list", "Vec<Vec<bool>>", "bit matrix");
    println!("{}", "-".repeat(72));

    for &(v, e) in &[
        (100usize, 300usize),
        (1_000, 5_000),
        (10_000, 50_000),
        (1_000, 400_000),
        (10_000, 10_000_000),
    ] {
        // Each inner Vec has a 24-byte header; an undirected edge is stored twice.
        let list = v * 24 + 2 * e * size_of::<usize>();
        let matrix = v * 24 + v * v; // one byte per bool
        let bits = (v * v + 7) / 8;  // one BIT per possible edge

        let max_edges = v * (v - 1) / 2;
        let density = e as f64 / max_edges as f64 * 100.0;

        let human = |b: usize| {
            if b >= 1 << 20 { format!("{:.1} MB", b as f64 / 1_048_576.0) }
            else if b >= 1024 { format!("{:.1} KB", b as f64 / 1024.0) }
            else { format!("{b} B") }
        };

        println!("{:>7} {:>10} {:>8.2}% | {:>12} {:>13} {:>12}",
            v, e, density, human(list), human(matrix), human(bits));
    }

    println!("\nAt 0.1% density the list uses 1 MB where the matrix needs 96 MB.");
    println!("At 80% density that reverses. A BIT matrix is 8x smaller than");
    println!("Vec<Vec<bool>> and worth it whenever you commit to a matrix.");
}
```

> [!performance] The crossover is far denser than people assume
> A 10,000-vertex graph with 50,000 edges — a perfectly ordinary social or road network — costs **1 MB** as an adjacency list and **96 MB** as a `Vec<Vec<bool>>` matrix. That's not a tuning detail; it's the difference between fitting in cache-friendly memory and not fitting at all. The matrix only wins once the graph is *genuinely* dense (the 80%-density row above), which in practice means small complete-ish graphs, or algorithms like Floyd–Warshall that are O(V³) anyway and so limit you to a few hundred vertices.
>
> One caveat on `Vec<Vec<bool>>`: it wastes a **byte per bool** and scatters `V` separate allocations. If you've decided on a matrix, use a single flat `Vec<bool>` indexed as `[u * n + v]` for locality, or pack it into bits (`Vec<u64>`) for an 8× saving. See [Memory Layout](#/ch/memory-layout).

## Modeling choices in Rust

Rust gives you a few idioms depending on your vertices:

- **Integer vertices `0..n`** → `Vec<Vec<usize>>` (fastest, what we used).
- **Arbitrary vertices** (strings, structs) → `HashMap<T, Vec<T>>`, or map them to integer ids first (often cleaner and faster).
- **Weighted** → store `(neighbor, weight)` tuples.

> [!best] For serious graph work, use `petgraph`
> Hand-rolling graph structures teaches the fundamentals, but for real applications reach for the **`petgraph`** crate. It provides ready-made directed/undirected graphs, plus built-in algorithms (BFS, DFS, Dijkstra, topological sort, strongly-connected components, MST) — all tested and optimized. Understand the representations here so you can *use* petgraph well and pick the right graph type; implement from scratch only to learn or for a tiny special case.

## Summary

- A **graph** = **vertices** connected by **edges**, which may be **directed**/undirected and **weighted**/unweighted — the most general structure (trees and lists are special cases).
- **Adjacency list** (`Vec<Vec<usize>>`): O(V+E) memory, efficient neighbor iteration — the **default** for sparse, real-world graphs.
- **Adjacency matrix**: O(1) edge lookup but O(V²) memory — for **dense** graphs or frequent edge checks. Use a **flat or bit-packed** `Vec`, not `Vec<Vec<bool>>`.
- **Edge list** (`Vec<(u, v, w)>`) is the third representation, and the right one for **Kruskal** and **Bellman–Ford**, which process edges rather than vertices.
- Measured: 10,000 vertices and 50,000 edges is **1 MB** as a list and **96 MB** as a matrix. The crossover is far denser than intuition suggests.
- **Intern arbitrary labels to dense `0..n` ids**, then index with `Vec` everywhere — including the `visited`/`dist`/`parent` arrays every algorithm needs.
- **In-degree is O(V+E) in an adjacency list.** Precompute it once, or keep a reverse graph, rather than calling it in a loop.
- Store `(neighbor, weight)` for weighted graphs; omit the second `push` for directed ones.
- Use **`petgraph`** for production graph work.

> [!exercise] Try it yourself
> 1. Build a *directed* adjacency-list graph (only add the edge one way) and print each node's out-neighbors.
> 2. Add `degree` to the adjacency-list `Graph`, then explain why a *directed* graph needs two different degree methods.
> 3. Convert a small adjacency list to an adjacency matrix and verify `has_edge` matches.
> 4. Replace `Vec<Vec<bool>>` with a flat `Vec<bool>` indexed `[u * n + v]`. Then pack it into `Vec<u64>` and confirm the 8× memory saving.
> 5. Compute **every** vertex's in-degree in a single O(V+E) pass instead of calling `in_degree` per vertex. What was the complexity before, and after?
> 6. Build a **reverse graph** from a directed adjacency list. Which algorithms from [Advanced Graph Algorithms](#/ch/dsa-graph-advanced) need one?
> 7. Add `add_edge` to the interning graph such that inserting the same edge twice is detected. Should a graph allow parallel edges? What about self-loops (`u → u`)?
> 8. Extend the memory table with a `Vec<HashSet<usize>>` representation. What does it buy over `Vec<Vec<usize>>`, and what does it cost?

With a graph in memory, the first thing we want to do is *explore* it. Next: the two fundamental traversals, **BFS and DFS**.
