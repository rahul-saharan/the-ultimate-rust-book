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

> [!best] Always track "visited" — and pick BFS for shortest, DFS for structure
> The one non-negotiable in graph traversal: a **visited set** (or `bool` array). Without it, cycles cause infinite loops. Beyond that: reach for **BFS** when you care about *distance/shortest path*, and **DFS** when you care about *structure* (cycles, ordering, components, "can I get there?"). Both are O(V + E) — they visit every vertex and edge once.

## Complexity

Both BFS and DFS run in **O(V + E)** time (visit each vertex once, examine each edge once) and **O(V)** space (visited set + frontier). That's optimal — you can't explore a graph without looking at its vertices and edges.

## Summary

- **BFS** uses a **queue** to explore **level by level** (nearest first) — it finds **shortest paths in unweighted graphs**.
- **DFS** uses a **stack** (explicit or recursion) to **plunge deep then backtrack** — great for cycles, topological sort, and components.
- They're the **same algorithm**: queue → BFS, stack → DFS; the frontier's priority is the only difference.
- Always use a **visited set** to avoid infinite loops on cycles. Both are **O(V + E)** time, **O(V)** space.

> [!exercise] Try it yourself
> 1. Modify `bfs` to also return each node's **distance** from the start (its BFS level).
> 2. Use BFS to find the shortest path (list of nodes) between two vertices by tracking each node's parent.
> 3. Use DFS to count the number of **connected components** in a graph (run DFS from each unvisited node).

BFS finds shortest paths when every edge counts the same. When edges have different *weights*, we need something smarter — **Dijkstra's algorithm**, next.
