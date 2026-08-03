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
- **Adjacency matrix** (`Vec<Vec<bool>>`): O(1) edge lookup but O(V²) memory — for **dense** graphs or frequent edge checks.
- Model integer vertices with a `Vec`, arbitrary ones with a `HashMap` (or map to ids); store `(neighbor, weight)` for weighted graphs.
- Use **`petgraph`** for production graph work.

> [!exercise] Try it yourself
> 1. Build a *directed* adjacency-list graph (only add the edge one way) and print each node's out-neighbors.
> 2. Add a `degree(&self, u: usize) -> usize` method (number of neighbors) to the adjacency-list `Graph`.
> 3. Convert a small adjacency list to an adjacency matrix and verify `has_edge` matches.

With a graph in memory, the first thing we want to do is *explore* it. Next: the two fundamental traversals, **BFS and DFS**.
