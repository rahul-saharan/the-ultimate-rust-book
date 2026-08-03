<h1><span class="h1-kicker">Data Structures & Algorithms</span>Shortest Paths: Dijkstra, Bellman-Ford & A*</h1>

[BFS](#/ch/dsa-graph-traversal) finds the shortest path when every edge costs the same. But real graphs have **weighted** edges — roads have lengths, networks have latencies, flights have prices. Finding the cheapest route through a weighted graph is the **shortest path problem**, and its star algorithm is **Dijkstra's**. This chapter implements Dijkstra and surveys its cousins Bellman-Ford and A*.

## Dijkstra's algorithm

**Dijkstra's algorithm** finds the shortest distance from a start vertex to all others in a graph with **non-negative** edge weights. The idea: repeatedly pick the closest unvisited vertex, and use it to *relax* (improve) the tentative distances of its neighbors. A [min-heap / priority queue](#/ch/dsa-heaps) makes "pick the closest" efficient:

```rust
use std::collections::BinaryHeap;
use std::cmp::Reverse;

// adjacency[u] = list of (neighbor, edge_weight). Returns shortest distance to each node.
fn dijkstra(adjacency: &[Vec<(usize, u32)>], start: usize) -> Vec<u32> {
    let n = adjacency.len();
    let mut dist = vec![u32::MAX; n];
    dist[start] = 0;

    // Min-heap of (distance, node) — Reverse turns the max-heap into a min-heap.
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0u32, start)));

    while let Some(Reverse((d, u))) = heap.pop() {
        if d > dist[u] {
            continue; // stale entry — we already found a shorter path to u
        }
        // Relax each neighbor:
        for &(v, weight) in &adjacency[u] {
            let new_dist = d + weight;
            if new_dist < dist[v] {
                dist[v] = new_dist;       // found a shorter path to v
                heap.push(Reverse((new_dist, v)));
            }
        }
    }
    dist
}

fn main() {
    // 0→1 (4), 0→2 (1), 2→1 (2), 1→3 (1), 2→3 (5)
    let adj = vec![
        vec![(1, 4), (2, 1)],
        vec![(3, 1)],
        vec![(1, 2), (3, 5)],
        vec![],
    ];
    println!("{:?}", dijkstra(&adj, 0)); // [0, 3, 1, 4]
    // Cheapest 0→1 is 0→2→1 (1+2=3), not the direct 0→1 (4)!
}
```

Notice the result: the cheapest way from 0 to 1 is *not* the direct edge (weight 4), but the detour `0 → 2 → 1` (weight 1 + 2 = 3). Dijkstra finds these non-obvious optimal routes automatically.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="Dijkstra picks the closest unvisited node from a priority queue and relaxes its neighbors">
  <style>
    .spm { font: 600 11px var(--font-mono); fill: var(--text); }
    .spc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .spn { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .spg { font: 600 11px var(--font-mono); fill: #fff; }
  </style>
  <circle cx="80" cy="80" r="16" class="spn"/><text x="75" y="85" class="spg">0</text>
  <circle cx="280" cy="40" r="16" class="spn"/><text x="275" y="45" class="spg">1</text>
  <circle cx="280" cy="120" r="16" class="spn"/><text x="275" y="125" class="spg">2</text>
  <circle cx="480" cy="80" r="16" class="spn"/><text x="475" y="85" class="spg">3</text>
  <line x1="94" y1="72" x2="266" y2="47" stroke="var(--text-mute)"/><text x="160" y="50" class="spc">4</text>
  <line x1="94" y1="88" x2="266" y2="113" stroke="var(--text-mute)"/><text x="160" y="115" class="spc">1</text>
  <line x1="280" y1="56" x2="280" y2="104" stroke="var(--text-mute)"/><text x="290" y="85" class="spc">2</text>
  <line x1="294" y1="47" x2="466" y2="72" stroke="var(--text-mute)"/><text x="380" y="50" class="spc">1</text>
  <text x="60" y="150" class="spc">Cheapest 0→1 = 0→2→1 (1+2=3), beating the direct edge (4). Dijkstra finds it.</text>
</svg>
<figcaption>Dijkstra greedily settles the nearest node, relaxing neighbors — discovering that detours can be cheaper.</figcaption>
</figure>

> [!key] Why the priority queue, and why non-negative weights
> Dijkstra always expands the **closest** unsettled node next — a [priority queue](#/ch/dsa-heaps) gives that in O(log n). Once a node is popped with its final distance, it's *settled* forever. This correctness relies on **non-negative weights**: with negative edges, a longer-looking path could later become cheaper, breaking the "settled forever" guarantee. For negative weights, you need Bellman-Ford (below).

> [!mistake] The "stale entry" check is essential
> Our heap may contain *outdated* `(distance, node)` entries — we push a new one each time we find a shorter path, without removing the old. The line `if d > dist[u] { continue; }` skips these stale entries when they surface. Omit it and you'll re-process nodes and get wrong or slow results. This lazy-deletion pattern (push updates, skip stale pops) is the standard, clean way to write Dijkstra with a binary heap.

## The complexity

With a binary heap and adjacency list, Dijkstra runs in **O((V + E) log V)** — efficient for sparse graphs. Each edge may trigger one heap push (O(log V)), and each vertex is settled once.

## The family of shortest-path algorithms

Dijkstra isn't the only tool — pick based on the graph:

| Algorithm | Handles | Finds | Complexity |
|-----------|---------|-------|------------|
| **BFS** | unweighted | source → all | O(V + E) |
| **Dijkstra** | non-negative weights | source → all | O((V+E) log V) |
| **Bellman-Ford** | **negative** weights | source → all | O(V·E) |
| **A\*** | non-negative + a heuristic | source → **one target** | often much faster than Dijkstra |
| **Floyd-Warshall** | any (incl. negative) | **all pairs** | O(V³) |

> [!key] Choosing a shortest-path algorithm
> - **Unweighted?** Use [**BFS**](#/ch/dsa-graph-traversal) — simplest and O(V+E).
> - **Non-negative weights, one source → all?** **Dijkstra** — the workhorse.
> - **Negative edges possible?** **Bellman-Ford** (slower, but handles them and detects negative cycles).
> - **One specific target and you have a good distance estimate (a heuristic)?** **A\*** — Dijkstra guided toward the goal, often dramatically faster (it's how game pathfinding and GPS routing work).
> - **Need every pair's distance?** **Floyd-Warshall** (a tiny triple-loop) for small graphs.

## A word on A* and Bellman-Ford

**A\*** ("A-star") is Dijkstra plus a **heuristic** — an estimate of the remaining distance to the goal (e.g. straight-line distance on a map). By prioritizing nodes that seem closer to the target, it explores far fewer nodes than Dijkstra when you only need *one* destination. It's the algorithm behind GPS navigation and game AI pathfinding.

**Bellman-Ford** simply relaxes *all* edges V−1 times. Slower than Dijkstra, but it tolerates **negative edge weights** and can **detect negative cycles** (if an edge can still be relaxed after V−1 rounds, a negative cycle exists).

## Summary

- The **shortest path problem** finds the cheapest route through a **weighted** graph.
- **Dijkstra's algorithm** (source → all, **non-negative** weights) greedily settles the nearest node using a **min-heap**, relaxing neighbors — O((V+E) log V). Remember the **stale-entry skip**.
- With **negative** weights, use **Bellman-Ford** (O(V·E), detects negative cycles); for a single target with a good estimate, use **A\*** (heuristic-guided Dijkstra); for **all pairs**, Floyd-Warshall.
- **BFS** already solves the unweighted case in O(V+E).

> [!exercise] Try it yourself
> 1. Extend `dijkstra` to also return each node's **predecessor**, then reconstruct the actual shortest *path* (not just distance) to a target.
> 2. Build a small weighted graph and confirm Dijkstra finds a cheaper indirect route over a costly direct edge.
> 3. Explain, in one sentence, why Dijkstra can give wrong answers on graphs with negative edge weights.

Sometimes we don't want the shortest path between two points, but the cheapest way to connect *everything* — that's the **minimum spanning tree**, next.
