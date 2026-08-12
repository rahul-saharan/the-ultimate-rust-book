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

## Bellman-Ford: negative weights, and seeing Dijkstra fail

**Bellman-Ford** simply relaxes *all* edges V−1 times. Slower than Dijkstra, but it tolerates **negative edge weights** and can **detect negative cycles** (if an edge can still be relaxed after V−1 rounds, a negative cycle exists).

The chapter has told you twice that Dijkstra breaks on negative weights. Here is that failure, on three vertices:

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

/// Textbook Dijkstra with a SETTLED set: once popped, a vertex is final.
fn dijkstra_settled(adj: &[Vec<(usize, i64)>], start: usize) -> Vec<i64> {
    let n = adj.len();
    let mut dist = vec![i64::MAX; n];
    let mut settled = vec![false; n];
    dist[start] = 0;
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0i64, start)));

    while let Some(Reverse((d, u))) = heap.pop() {
        if settled[u] {
            continue;
        }
        settled[u] = true; // declared final, never reconsidered
        for &(v, w) in &adj[u] {
            if !settled[v] && d + w < dist[v] {
                dist[v] = d + w;
                heap.push(Reverse((d + w, v)));
            }
        }
    }
    dist
}

/// The lazy-deletion version from earlier in the chapter, for comparison.
fn dijkstra_lazy(adj: &[Vec<(usize, i64)>], start: usize) -> Vec<i64> {
    let mut dist = vec![i64::MAX; adj.len()];
    dist[start] = 0;
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0i64, start)));
    while let Some(Reverse((d, u))) = heap.pop() {
        if d > dist[u] {
            continue;
        }
        for &(v, w) in &adj[u] {
            if d + w < dist[v] {
                dist[v] = d + w;
                heap.push(Reverse((d + w, v)));
            }
        }
    }
    dist
}

/// Bellman-Ford over an EDGE LIST. Returns None if a reachable negative cycle exists.
fn bellman_ford(n: usize, edges: &[(usize, usize, i64)], start: usize) -> Option<Vec<i64>> {
    let mut dist = vec![i64::MAX; n];
    dist[start] = 0;

    // V-1 rounds suffice: a shortest path uses at most V-1 edges.
    for _ in 0..n.saturating_sub(1) {
        let mut changed = false;
        for &(u, v, w) in edges {
            if dist[u] != i64::MAX && dist[u] + w < dist[v] {
                dist[v] = dist[u] + w;
                changed = true;
            }
        }
        if !changed {
            break; // converged early — common in practice
        }
    }

    // One extra pass: any further improvement proves a negative cycle.
    for &(u, v, w) in edges {
        if dist[u] != i64::MAX && dist[u] + w < dist[v] {
            return None;
        }
    }
    Some(dist)
}

fn main() {
    // 0→2 costs 1, 0→1 costs 2, 1→2 costs -5.
    // The true distance to 2 is 2 + (-5) = -3, but 2 gets POPPED FIRST at d=1
    // and settled, before vertex 1 ever reveals the shortcut.
    let adj: Vec<Vec<(usize, i64)>> = vec![vec![(2, 1), (1, 2)], vec![(2, -5)], vec![]];
    let edges = [(0usize, 2usize, 1i64), (0, 1, 2), (1, 2, -5)];

    println!("0→2 (1), 0→1 (2), 1→2 (-5)   — true distance to 2 is -3\n");
    println!("Dijkstra, settled set : {:?}   ← WRONG", dijkstra_settled(&adj, 0));
    println!("Dijkstra, lazy delete : {:?}", dijkstra_lazy(&adj, 0));
    println!("Bellman-Ford          : {:?}", bellman_ford(3, &edges, 0).unwrap());

    // A negative cycle: 0→1 (1), 1→2 (-1), 2→1 (-1) — you can loop downward forever.
    let cyclic = [(0usize, 1usize, 1i64), (1, 2, -1), (2, 1, -1)];
    println!("\nnegative cycle → {:?}", bellman_ford(3, &cyclic, 0));
}
```

> [!warning] Lazy deletion accidentally papers over negative weights — don't rely on it
> Look closely at that output: the **settled-set** Dijkstra reports `1` for vertex 2 when the answer is `-3`, exactly as the theory predicts. But the **lazy-deletion** version — the one earlier in this chapter, and the idiomatic Rust formulation — gets it *right*. That's not because Dijkstra handles negative weights; it's because re-pushing on every improvement lets it revisit a vertex it already popped, quietly turning it into something closer to Bellman-Ford.
>
> This is a trap rather than a feature. Once vertices can be re-processed, the **O((V+E) log V) bound no longer holds** — a vertex may be popped many times, and on adversarial graphs the work grows far beyond the guarantee. So "my Dijkstra gave the right answer on a graph with one negative edge" tells you nothing about the next graph. If negative weights are possible, use Bellman-Ford and get both correctness *and* a predictable bound.

> [!key] Why V−1 rounds, and why one more detects a cycle
> A shortest path visits each vertex at most once, so it uses at most **V−1 edges**. Each Bellman-Ford round is guaranteed to finalise at least one more edge of every shortest path, so V−1 rounds settle them all. That's the entire correctness argument.
>
> The cycle check falls out for free: if a V-th pass can *still* improve something, then some path is using ≥ V edges, which means it repeats a vertex — a cycle — and it only helped because that cycle has negative total weight. Note this detects cycles **reachable from the start**; to find them anywhere, run from a virtual source connected to every vertex.

## Floyd-Warshall: every pair, in a triple loop

When you need the distance between *all* pairs, Floyd-Warshall is remarkable for how little code it takes — three nested loops with the outer one over the *intermediate* vertex:

```rust
/// All-pairs shortest paths. O(V³) time, O(V²) space.
fn floyd_warshall(n: usize, edges: &[(usize, usize, i64)]) -> Vec<Vec<i64>> {
    // Not i64::MAX — we add two of these together, so leave headroom.
    const INF: i64 = i64::MAX / 4;

    let mut dist = vec![vec![INF; n]; n];
    for i in 0..n {
        dist[i][i] = 0;
    }
    for &(u, v, w) in edges {
        dist[u][v] = dist[u][v].min(w); // min() handles parallel edges
    }

    // k MUST be the outermost loop: "paths allowed to route through 0..=k".
    for k in 0..n {
        for i in 0..n {
            for j in 0..n {
                if dist[i][k] + dist[k][j] < dist[i][j] {
                    dist[i][j] = dist[i][k] + dist[k][j];
                }
            }
        }
    }
    dist
}

fn main() {
    // 0→1 (3), 1→2 (1), 0→2 (7), 2→3 (2), 3→0 (1)
    let edges = [(0usize, 1usize, 3i64), (1, 2, 1), (0, 2, 7), (2, 3, 2), (3, 0, 1)];
    let dist = floyd_warshall(4, &edges);

    println!("all-pairs shortest distances:");
    print!("     ");
    for j in 0..4 {
        print!("{j:>4}");
    }
    println!();
    for (i, row) in dist.iter().enumerate() {
        print!("  {i}: ");
        for d in row {
            print!("{d:>4}");
        }
        println!();
    }
    println!("\n0→2 is 4 via vertex 1 (3+1), not the direct edge's 7.");
    println!("A negative cycle shows up as a negative value on the diagonal.");
}
```

> [!mistake] Getting the loop order wrong, and using `i64::MAX` for infinity
> Two bugs bite everyone here. First, **`k` must be the outermost loop**. The algorithm is a dynamic program over "which vertices am I allowed to route through", and putting `k` inside means you use partially-computed results — producing answers that are *plausible but wrong*, which is the worst kind. Second, using `i64::MAX` as infinity **overflows** the moment you compute `dist[i][k] + dist[k][j]` for two unreachable pairs; in debug that panics, in release it wraps to a large negative number and corrupts everything. Use a sentinel with headroom (`i64::MAX / 4`) or check for `INF` before adding.

## A\*: Dijkstra with a sense of direction

**A\*** ("A-star") is Dijkstra plus a **heuristic** — an estimate of the remaining distance to the goal. Instead of prioritising by distance-so-far `g`, it prioritises by `g + h(v)`, so the search leans toward the target rather than expanding evenly in all directions. It's the algorithm behind GPS navigation and game pathfinding.

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

/// A* over a 4-connected grid. `true` in the grid means a wall.
/// Set `use_heuristic = false` and it degenerates to plain Dijkstra,
/// which is the cleanest way to see what the heuristic buys.
fn astar(
    grid: &[Vec<bool>],
    start: (usize, usize),
    goal: (usize, usize),
    use_heuristic: bool,
) -> (Option<u32>, usize) {
    let (h, w) = (grid.len(), grid[0].len());

    // Manhattan distance: admissible on a 4-connected grid because you can
    // never reach the goal in fewer than that many unit steps.
    let estimate = |(r, c): (usize, usize)| {
        if use_heuristic {
            (r.abs_diff(goal.0) + c.abs_diff(goal.1)) as u32
        } else {
            0
        }
    };

    let mut best = vec![vec![u32::MAX; w]; h];
    let mut heap = BinaryHeap::new();
    best[start.0][start.1] = 0;
    heap.push(Reverse((estimate(start), 0u32, start)));
    let mut expanded = 0;

    while let Some(Reverse((_priority, g, (r, c)))) = heap.pop() {
        if (r, c) == goal {
            return (Some(g), expanded);
        }
        if g > best[r][c] {
            continue; // stale entry, same as in Dijkstra
        }
        expanded += 1;

        for &(nr, nc) in &[(r.wrapping_sub(1), c), (r + 1, c), (r, c.wrapping_sub(1)), (r, c + 1)] {
            if nr >= h || nc >= w || grid[nr][nc] {
                continue; // off-grid (wrapping_sub gives a huge value) or a wall
            }
            let next_g = g + 1;
            if next_g < best[nr][nc] {
                best[nr][nc] = next_g;
                // The heap is ordered by g + h, but we carry g separately.
                heap.push(Reverse((next_g + estimate((nr, nc)), next_g, (nr, nc))));
            }
        }
    }
    (None, expanded)
}

fn main() {
    // A 15×15 grid with a wall down column 7, with one gap at row 7.
    let (h, w) = (15usize, 15usize);
    let mut grid = vec![vec![false; w]; h];
    for r in 0..h {
        if r != 7 {
            grid[r][7] = true;
        }
    }

    let (start, goal) = ((0usize, 0usize), (14usize, 14usize));
    let (d_len, d_exp) = astar(&grid, start, goal, false); // heuristic off
    let (a_len, a_exp) = astar(&grid, start, goal, true);

    println!("path length : Dijkstra {d_len:?}, A* {a_len:?}   (must agree)");
    println!("expansions  : Dijkstra {d_exp}, A* {a_exp}");
    println!("A* did {:.0}% of the work for the same answer", a_exp as f64 / d_exp as f64 * 100.0);

    // Seal the gap: no path exists.
    let mut sealed = vec![vec![false; w]; h];
    for r in 0..h {
        sealed[r][7] = true;
    }
    println!("\nwith the gap sealed: {:?}", astar(&sealed, start, goal, true).0);
}
```

> [!key] A\* is only correct if the heuristic never overestimates
> The heuristic must be **admissible**: `h(v)` must never exceed the true remaining distance to the goal. Manhattan distance qualifies on a 4-connected grid because no path can beat one unit step per unit of grid distance. Overestimate — say by using Euclidean distance on a grid where diagonal moves are forbidden — and A\* will happily return a path that isn't shortest, with no warning.
>
> Two useful degenerate cases anchor the idea: with `h = 0` A\* *is* Dijkstra (which is how the comparison above works), and with a perfect `h` it walks straight to the goal. Everything useful sits between. Note the modest gain here — 77% of Dijkstra's expansions — because an open grid gives the heuristic little to exploit; on a long road network with a good estimate, A\* routinely explores a small fraction of the graph.

## Summary

- The **shortest path problem** finds the cheapest route through a **weighted** graph.
- **Dijkstra's algorithm** (source → all, **non-negative** weights) greedily settles the nearest node using a **min-heap**, relaxing neighbors — O((V+E) log V). Remember the **stale-entry skip**.
- Dijkstra with a **settled set** provably fails on negative edges. The **lazy-deletion** version often returns the right answer anyway — by re-processing vertices, which silently voids its complexity bound. Don't mistake that for support.
- **Bellman-Ford** relaxes every edge **V−1** times (a shortest path uses at most V−1 edges), then one extra pass detects **negative cycles**. O(V·E), and it takes an **edge list**.
- **Floyd-Warshall** is a triple loop for all pairs, O(V³). The **`k` loop must be outermost**, and your infinity sentinel needs headroom — `i64::MAX` overflows when two are added.
- **A\*** is Dijkstra prioritised by `g + h`. It's only correct if the heuristic is **admissible** (never overestimates). `h = 0` gives you Dijkstra; a perfect `h` walks straight to the goal.
- **BFS** already solves the unweighted case in O(V+E).

> [!exercise] Try it yourself
> 1. Extend `dijkstra` to also return each node's **predecessor**, then reconstruct the actual shortest *path* (not just distance) to a target.
> 2. Build a small weighted graph and confirm Dijkstra finds a cheaper indirect route over a costly direct edge.
> 3. Explain, in one sentence, why Dijkstra can give wrong answers on graphs with negative edge weights.
> 4. Find your own three-vertex graph where the settled-set Dijkstra is wrong. What has to be true about the order vertices are popped?
> 5. Add a `rounds_used` counter to `bellman_ford` and observe the early exit. On what shape of graph does it need all V−1 rounds?
> 6. Modify `bellman_ford` to **return the negative cycle** it found, not just `None`. (Hint: keep a predecessor array and walk it back from the edge that still relaxed.)
> 7. Move Floyd-Warshall's `k` loop to the innermost position and find a graph where the answer becomes wrong. Why is it wrong rather than merely slower?
> 8. Extend Floyd-Warshall with a `next[i][j]` matrix so you can reconstruct the actual path, not just its length.
> 9. Change A\*'s heuristic to `manhattan * 2` — deliberately inadmissible — and find a grid where it returns a non-shortest path.
> 10. Run the A\* comparison on a grid with a long winding corridor instead of one wall. Does the heuristic help more or less than 77%? Explain.

Sometimes we don't want the shortest path between two points, but the cheapest way to connect *everything* — that's the **minimum spanning tree**, next.
