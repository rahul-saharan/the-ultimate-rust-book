<h1><span class="h1-kicker">Data Structures & Algorithms</span>Graph Traversal: BFS & DFS</h1>

Once you have a graph, the fundamental operation is *visiting every reachable vertex*. There are two ways to do it, and they're the foundation of almost every graph algorithm: **breadth-first search (BFS)** explores level by level (nearest first), and **depth-first search (DFS)** plunges deep down one path before backtracking. Beautifully, they're the *same algorithm* — the only difference is a queue vs. a stack.

## BFS: explore in waves

**Breadth-first search** visits the start node, then all its neighbors, then all *their* unvisited neighbors, rippling outward level by level. It uses a **queue** ([`VecDeque`](#/ch/dsa-stack-queue)) and a "visited" set to avoid revisiting:

```rust
use std::collections::{VecDeque, HashSet};

fn bfs(adjacency: &[Vec<usize>], start: usize) -> Vec<usize> {
    let mut visited = HashSet::new();
    let mut order = Vec::new();
    let mut queue = VecDeque::new();

    queue.push_back(start);
    visited.insert(start);

    while let Some(node) = queue.pop_front() { // FIFO → level by level
        order.push(node);
        for &next in &adjacency[node] {
            if visited.insert(next) { // insert returns false if already present
                queue.push_back(next);
            }
        }
    }
    order
}

fn main() {
    // 0—1, 0—2, 1—3, 2—3, 3—4
    let adj = vec![vec![1, 2], vec![0, 3], vec![0, 3], vec![1, 2, 4], vec![3]];
    println!("BFS from 0: {:?}", bfs(&adj, 0)); // 0, then 1 & 2, then 3, then 4
}
```

> [!key] BFS finds the shortest path in unweighted graphs
> Because BFS explores in order of *distance from the start* (all nodes 1 edge away, then 2 edges away, …), the first time it reaches a node is via a **shortest path** (fewest edges). This makes BFS the go-to for "fewest steps" problems: shortest route in a maze, degrees of separation in a social network, minimum moves in a puzzle. Track each node's parent (or distance) during BFS to reconstruct the actual path.

### Distances, paths, and multiple sources

Knowing a shortest path *exists* is rarely enough — you want the path itself. Record each vertex's **parent** as you discover it, then walk backwards from the goal:

```rust
use std::collections::VecDeque;

/// BFS recording both distance and parent for every reachable vertex.
/// `None` means "not reachable from `start`".
fn bfs_paths(adj: &[Vec<usize>], start: usize) -> (Vec<Option<u32>>, Vec<Option<usize>>) {
    let n = adj.len();
    let mut dist = vec![None; n];
    let mut parent = vec![None; n];
    let mut queue = VecDeque::from([start]);
    dist[start] = Some(0);

    while let Some(u) = queue.pop_front() {
        for &v in &adj[u] {
            // `dist[v].is_none()` doubles as the visited check.
            if dist[v].is_none() {
                dist[v] = Some(dist[u].expect("u was reached") + 1);
                parent[v] = Some(u);
                queue.push_back(v);
            }
        }
    }
    (dist, parent)
}

/// Rebuild the path by walking parents backwards from the goal.
fn path_to(parent: &[Option<usize>], start: usize, goal: usize) -> Option<Vec<usize>> {
    let mut path = vec![goal];
    let mut current = goal;
    while current != start {
        current = parent[current]?; // None → goal is unreachable
        path.push(current);
    }
    path.reverse();
    Some(path)
}

/// Multi-source BFS: seed the queue with every source at distance 0.
/// Answers "distance to the NEAREST source" for every vertex, in one pass.
fn multi_source_bfs(adj: &[Vec<usize>], sources: &[usize]) -> Vec<Option<u32>> {
    let mut dist = vec![None; adj.len()];
    let mut queue = VecDeque::new();
    for &s in sources {
        dist[s] = Some(0);
        queue.push_back(s);
    }
    while let Some(u) = queue.pop_front() {
        for &v in &adj[u] {
            if dist[v].is_none() {
                dist[v] = Some(dist[u].expect("u was reached") + 1);
                queue.push_back(v);
            }
        }
    }
    dist
}

/// Connected components, using DFS from each unvisited vertex.
fn components(adj: &[Vec<usize>]) -> Vec<Vec<usize>> {
    let mut seen = vec![false; adj.len()];
    let mut out = Vec::new();
    for start in 0..adj.len() {
        if seen[start] {
            continue;
        }
        let mut component = Vec::new();
        let mut stack = vec![start];
        seen[start] = true;
        while let Some(u) = stack.pop() {
            component.push(u);
            for &v in &adj[u] {
                if !seen[v] {
                    seen[v] = true;
                    stack.push(v);
                }
            }
        }
        component.sort_unstable();
        out.push(component);
    }
    out
}

fn main() {
    // 0—1, 0—2, 1—3, 2—3, 3—4, plus a separate pair 5—6.
    let adj = vec![
        vec![1, 2], vec![0, 3], vec![0, 3], vec![1, 2, 4], vec![3],
        vec![6], vec![5],
    ];

    let (dist, parent) = bfs_paths(&adj, 0);
    println!("distances from 0  {dist:?}");
    println!("path 0 → 4        {:?}", path_to(&parent, 0, 4));
    println!("path 0 → 6        {:?}  (other component)", path_to(&parent, 0, 6));

    println!("\nnearest of {{0, 5}} {:?}", multi_source_bfs(&adj, &[0, 5]));
    println!("components        {:?}", components(&adj));
}
```

> [!best] Multi-source BFS costs the same as single-source — use it instead of looping
> "How far is each cell from the nearest exit?" tempts you to run a BFS per exit and take the minimum, which is O(sources × (V+E)). Push **every** source into the queue at distance 0 instead and one BFS answers it in O(V+E) total. The correctness argument is the same as ordinary BFS: the queue still holds vertices in non-decreasing distance order, so the first time you reach a vertex is still via a shortest path — just from *whichever* source is closest. It's the standard solution for "rotting oranges", "distance to nearest water", and multi-exit maze problems.

> [!tip] Let `dist` double as your visited set
> Notice `bfs_paths` has no separate `visited` collection: `dist[v].is_none()` already means "not yet reached". One array, one source of truth, and no chance of the two disagreeing. The version at the top of this chapter uses a `HashSet` — for integer vertices in `0..n`, a `Vec<Option<u32>>` or `vec![false; n]` is both faster and simpler. Reach for a `HashSet` only when vertices aren't dense integers, which is exactly what [interning](#/ch/dsa-graphs) avoids.

## DFS: plunge deep, then backtrack

**Depth-first search** follows one path as far as it can, then backtracks and tries another. It uses a **stack** — either an explicit one, or the call stack via recursion. Here's the explicit-stack version (safe from stack overflow on huge graphs):

```rust
fn dfs(adjacency: &[Vec<usize>], start: usize) -> Vec<usize> {
    let mut visited = vec![false; adjacency.len()];
    let mut order = Vec::new();
    let mut stack = vec![start];

    while let Some(node) = stack.pop() { // LIFO → go deep
        if visited[node] {
            continue;
        }
        visited[node] = true;
        order.push(node);
        // Push neighbors (reversed, so we visit them in natural order):
        for &next in adjacency[node].iter().rev() {
            if !visited[next] {
                stack.push(next);
            }
        }
    }
    order
}

fn main() {
    let adj = vec![vec![1, 2], vec![0, 3], vec![0, 3], vec![1, 2, 4], vec![3]];
    println!("DFS from 0: {:?}", dfs(&adj, 0));
}
```

The recursive version is often cleaner (but risks stack overflow on very deep graphs):

```rust
fn dfs_recursive(adj: &[Vec<usize>], node: usize, visited: &mut Vec<bool>, order: &mut Vec<usize>) {
    visited[node] = true;
    order.push(node);
    for &next in &adj[node] {
        if !visited[next] {
            dfs_recursive(adj, next, visited, order);
        }
    }
}

fn main() {
    let adj = vec![vec![1, 2], vec![0, 3], vec![0, 3], vec![1, 2, 4], vec![3]];
    let mut visited = vec![false; adj.len()];
    let mut order = Vec::new();
    dfs_recursive(&adj, 0, &mut visited, &mut order);
    println!("DFS: {:?}", order);
}
```

## The key insight: same algorithm, different container

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="BFS uses a queue and explores level by level; DFS uses a stack and goes deep">
  <style>
    .gtm { font: 600 11px var(--font-mono); fill: var(--text); }
    .gtc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .gth { font: 700 12px var(--font-sans); }
    .bfsn { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .dfsn { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="16" width="300" height="150" rx="10" class="bfsn"/>
  <text x="28" y="40" class="gth" fill="var(--blue)">BFS — QUEUE (FIFO)</text>
  <text x="28" y="64" class="gtc">Explores level by level (nearest first).</text>
  <text x="28" y="84" class="gtm">queue.pop_front()</text>
  <text x="28" y="112" class="gtc">✅ shortest path (unweighted)</text>
  <text x="28" y="132" class="gtc">✅ "fewest steps" problems</text>
  <text x="28" y="152" class="gtc">uses more memory (wide frontier)</text>
  <rect x="326" y="16" width="300" height="150" rx="10" class="dfsn"/>
  <text x="340" y="40" class="gth" fill="var(--rust-600)">DFS — STACK (LIFO)</text>
  <text x="340" y="64" class="gtc">Plunges deep, then backtracks.</text>
  <text x="340" y="84" class="gtm">stack.pop()</text>
  <text x="340" y="112" class="gtc">✅ cycle detection, topological sort</text>
  <text x="340" y="132" class="gtc">✅ connected components, path exists?</text>
  <text x="340" y="152" class="gtc">less memory; risk of deep recursion</text>
</svg>
<figcaption>BFS and DFS are the <b>same</b> traversal — swap the queue for a stack and level-order becomes depth-first.</figcaption>
</figure>

> [!key] Queue → BFS, Stack → DFS
> Look at the two loops: they're *identical* except BFS uses `pop_front` (a queue) and DFS uses `pop` (a stack). That single choice — take the *oldest* frontier node (breadth) vs. the *newest* (depth) — is the entire difference. Understanding this unifies a whole family of algorithms: change what the frontier prioritizes and you get BFS, DFS, or (with a priority queue) [Dijkstra](#/ch/dsa-shortest-path).

## What traversals are good for

| Task | Use | Why |
|------|-----|-----|
| Shortest path (unweighted) | **BFS** | reaches nodes in distance order |
| Does a path exist? / reachability | either | both visit all reachable nodes |
| Connected components | either | traverse from each unvisited node |
| Cycle detection | **DFS** | track nodes on the current path |
| Topological sort (task ordering) | **DFS** | post-order gives the ordering |
| Maze / puzzle "fewest moves" | **BFS** | shortest in steps |

## Cycle detection — and why direction changes the algorithm

The table above promises DFS finds cycles. It does, but **directed and undirected graphs need different rules**, and using the wrong one silently gives wrong answers.

```rust
#[derive(Clone, Copy, PartialEq)]
enum Mark {
    Unseen,
    InProgress, // on the current DFS path
    Done,       // fully explored
}

/// DIRECTED: a cycle exists iff DFS finds an edge back to a vertex that is
/// still IN PROGRESS — i.e. still on the path we're currently walking.
fn has_cycle_directed(adj: &[Vec<usize>]) -> bool {
    fn visit(u: usize, adj: &[Vec<usize>], mark: &mut Vec<Mark>) -> bool {
        mark[u] = Mark::InProgress;
        for &v in &adj[u] {
            let state = mark[v]; // copy out so `mark` isn't borrowed below
            if state == Mark::InProgress {
                return true; // a back edge — cycle found
            }
            if state == Mark::Unseen && visit(v, adj, mark) {
                return true;
            }
            // Done: already explored and led nowhere cyclic. Skip it.
        }
        mark[u] = Mark::Done;
        false
    }
    let mut mark = vec![Mark::Unseen; adj.len()];
    (0..adj.len()).any(|u| mark[u] == Mark::Unseen && visit(u, adj, &mut mark))
}

/// UNDIRECTED: skip the edge you arrived on, then ANY edge to an
/// already-seen vertex closes a cycle.
fn has_cycle_undirected(adj: &[Vec<usize>]) -> bool {
    fn visit(u: usize, parent: usize, adj: &[Vec<usize>], seen: &mut Vec<bool>) -> bool {
        seen[u] = true;
        for &v in &adj[u] {
            if v == parent {
                continue; // don't count walking straight back
            }
            if seen[v] || visit(v, u, adj, seen) {
                return true;
            }
        }
        false
    }
    let mut seen = vec![false; adj.len()];
    (0..adj.len()).any(|u| !seen[u] && visit(u, usize::MAX, adj, &mut seen))
}

fn main() {
    // Directed: 0→1→3, 0→2→3, 3→4 — a dependency DAG.
    let dag = vec![vec![1, 2], vec![3], vec![3], vec![4], vec![]];
    // The same edges plus 4→0, closing a loop.
    let cyclic = vec![vec![1, 2], vec![3], vec![3], vec![4], vec![0]];
    println!("directed DAG    cycle? {}", has_cycle_directed(&dag));
    println!("directed + 4→0  cycle? {}", has_cycle_directed(&cyclic));

    // Undirected: a tree, then the same graph with one extra edge.
    let tree = vec![vec![1, 2], vec![0], vec![0, 3], vec![2]];
    let looped = vec![vec![1, 2], vec![0, 3], vec![0, 3], vec![1, 2]];
    println!("\nundirected tree   cycle? {}", has_cycle_undirected(&tree));
    println!("undirected looped cycle? {}", has_cycle_undirected(&looped));

    // Now the trap:
    println!("\ndirected algorithm on the undirected TREE: {}", has_cycle_directed(&tree));
    println!("  ← wrong! A tree has no cycle.");
}
```

> [!mistake] Using the directed algorithm on an undirected graph reports cycles everywhere
> The run above ends with `has_cycle_directed` claiming a **tree** contains a cycle. It isn't a bug in the algorithm — it's a category error. An undirected edge `0—1` is stored as `0→1` *and* `1→0`, so the directed algorithm walks `0→1`, then sees `1→0` pointing back at a vertex still in progress, and correctly reports a 2-cycle in the *directed* graph it was handed. Every single undirected edge looks like a cycle.
>
> The undirected version fixes this by skipping the edge it arrived on. But note *that* has its own limitation: skipping by **parent vertex** breaks with parallel edges, where two distinct edges join the same pair and genuinely do form a cycle. Track the arriving **edge id** instead when that's possible — the same fix as in [Advanced Graph Algorithms](#/ch/dsa-graph-advanced).

## Topological sort: ordering by dependency

The other application the table promises. Given a DAG of "X must happen before Y", produce a valid order. There are two standard algorithms, and it's worth knowing both because they fail differently:

```rust
use std::collections::VecDeque;

#[derive(Clone, Copy, PartialEq)]
enum Mark { Unseen, InProgress, Done }

/// DFS post-order, reversed. Returns None if a cycle makes ordering impossible.
fn topo_dfs(adj: &[Vec<usize>]) -> Option<Vec<usize>> {
    fn visit(u: usize, adj: &[Vec<usize>], mark: &mut Vec<Mark>, out: &mut Vec<usize>) -> bool {
        mark[u] = Mark::InProgress;
        for &v in &adj[u] {
            let state = mark[v];
            if state == Mark::InProgress {
                return false; // cycle — no valid order exists
            }
            if state == Mark::Unseen && !visit(v, adj, mark, out) {
                return false;
            }
        }
        mark[u] = Mark::Done;
        out.push(u); // post-order: pushed only after all dependents
        true
    }

    let mut mark = vec![Mark::Unseen; adj.len()];
    let mut out = Vec::new();
    for u in 0..adj.len() {
        if mark[u] == Mark::Unseen && !visit(u, adj, &mut mark, &mut out) {
            return None;
        }
    }
    out.reverse(); // post-order is backwards
    Some(out)
}

/// Kahn's algorithm: repeatedly take a vertex with no remaining dependencies.
/// This is BFS over in-degrees — and it detects cycles by counting.
fn topo_kahn(adj: &[Vec<usize>]) -> Option<Vec<usize>> {
    let n = adj.len();

    // One O(V+E) pass for all in-degrees — see the note in the graphs chapter.
    let mut in_degree = vec![0usize; n];
    for u in 0..n {
        for &v in &adj[u] {
            in_degree[v] += 1;
        }
    }

    let mut queue: VecDeque<usize> = (0..n).filter(|&u| in_degree[u] == 0).collect();
    let mut out = Vec::with_capacity(n);

    while let Some(u) = queue.pop_front() {
        out.push(u);
        for &v in &adj[u] {
            in_degree[v] -= 1;
            if in_degree[v] == 0 {
                queue.push_back(v); // its last dependency just cleared
            }
        }
    }

    // If a cycle exists, its vertices never reach in-degree 0.
    (out.len() == n).then_some(out)
}

fn main() {
    let dag = vec![vec![1, 2], vec![3], vec![3], vec![4], vec![]];
    println!("topo via DFS  {:?}", topo_dfs(&dag));
    println!("topo via Kahn {:?}", topo_kahn(&dag));
    println!("(both valid — a DAG usually has several correct orders)");

    let cyclic = vec![vec![1, 2], vec![3], vec![3], vec![4], vec![0]];
    println!("\nwith a cycle:");
    println!("topo via DFS  {:?}", topo_dfs(&cyclic));
    println!("topo via Kahn {:?}", topo_kahn(&cyclic));
}
```

> [!key] Why reversed post-order is a valid topological order
> In DFS post-order, a vertex is emitted only *after* everything reachable from it. So in the post-order list, every vertex appears **before** its own prerequisites — precisely backwards. Reverse it and each vertex now precedes everything that depends on it, which is the definition of a topological order. This is the same postorder-is-dependency-order idea that powers [tree DP](#/ch/dsa-tree-algorithms), and it's why a DAG's reverse post-order shows up all over compiler and build-system code.

| | DFS post-order | Kahn's algorithm |
|---|---|---|
| Frontier | recursion / stack | queue of in-degree-0 vertices |
| Detects a cycle by | finding an in-progress vertex | producing fewer than V vertices |
| Extra state | 3-state marks | an in-degree array |
| Recursion depth | O(V) — can overflow | none, fully iterative |
| Natural by-product | — | tells you *which* vertices are in the cycle (those left out) |
| Easy to make deterministic | harder | swap the queue for a `BinaryHeap` → lexicographically smallest order |

> [!best] Prefer Kahn's when the input might be adversarial or huge
> Both are O(V+E), so pick on other grounds. Kahn's is **iterative**, so a 10⁶-vertex chain won't overflow the stack the way the DFS version will. It also degrades more usefully: when a cycle exists, the vertices *missing* from its output are exactly the ones tangled in cycles, which makes for a far better error message than "cycle detected". Swap its `VecDeque` for a `BinaryHeap<Reverse<usize>>` and you get the lexicographically smallest valid order — the standard requirement when a build tool must be reproducible.

> [!best] Always track "visited" — and pick BFS for shortest, DFS for structure
> The one non-negotiable in graph traversal: a **visited set** (or `bool` array). Without it, cycles cause infinite loops. Beyond that: reach for **BFS** when you care about *distance/shortest path*, and **DFS** when you care about *structure* (cycles, ordering, components, "can I get there?"). Both are O(V + E) — they visit every vertex and edge once.

## Complexity

Both BFS and DFS run in **O(V + E)** time (visit each vertex once, examine each edge once) and **O(V)** space (visited set + frontier). That's optimal — you can't explore a graph without looking at its vertices and edges.

## Summary

- **BFS** uses a **queue** to explore **level by level** (nearest first) — it finds **shortest paths in unweighted graphs**.
- **DFS** uses a **stack** (explicit or recursion) to **plunge deep then backtrack** — great for cycles, topological sort, and components.
- They're the **same algorithm**: queue → BFS, stack → DFS; the frontier's priority is the only difference.
- Record a **parent** array during BFS to reconstruct the actual path, not just its length.
- **Multi-source BFS** costs the same as single-source: seed every source at distance 0 and one pass gives each vertex its distance to the *nearest* one.
- Let **`dist` double as the visited set** — one array, no chance of the two disagreeing.
- **Cycle detection differs by direction.** Directed needs a three-state mark (a cycle is an edge to an *in-progress* vertex); undirected skips the arriving edge. Using the directed version on an undirected graph reports a cycle for **every edge**.
- **Topological sort**: reversed DFS post-order, or **Kahn's algorithm** over in-degrees. Prefer Kahn's — it's iterative (no stack overflow) and the vertices missing from its output are exactly the ones in cycles.
- Always use a **visited set** to avoid infinite loops on cycles. Both are **O(V + E)** time, **O(V)** space.

> [!exercise] Try it yourself
> 1. Modify `bfs` to also return each node's **distance** from the start (its BFS level).
> 2. Extend `path_to` to return *all* shortest paths between two vertices, not just one. What must you store instead of a single parent?
> 3. Use DFS to count the number of **connected components** in a graph (run DFS from each unvisited node).
> 4. Run `has_cycle_directed` on an undirected graph stored with both directions, and confirm it reports a cycle for a simple two-vertex edge. Explain why in one sentence.
> 5. Make `has_cycle_undirected` correct for **parallel edges** by tracking the arriving edge id rather than the parent vertex.
> 6. Modify `topo_kahn` to *return* the vertices involved in cycles when no ordering exists, instead of `None`.
> 7. Swap Kahn's `VecDeque` for a `BinaryHeap<Reverse<usize>>` and confirm you get the lexicographically smallest valid order.
> 8. Use BFS to test whether a graph is **bipartite** by 2-colouring it — colour each vertex opposite to its parent and fail on a same-colour edge.
> 9. Build a 10⁶-vertex path graph and run both topological sorts. Which one survives, and why?

BFS finds shortest paths when every edge counts the same. When edges have different *weights*, we need something smarter — **Dijkstra's algorithm**, next.
