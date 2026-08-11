<h1><span class="h1-kicker">Data Structures & Algorithms</span>Network Flow & Matching</h1>

Some problems are secretly the same problem. "What's the maximum data rate through this network?" "How many workers can I assign to jobs they're qualified for?" "What's the cheapest set of links to cut to disconnect these two servers?" "Can this schedule be satisfied?" All four are **network flow**, and one algorithm answers all of them.

Flow is the most powerful item in the algorithms toolkit precisely because so many problems reduce to it. The trick is learning to recognize them.

## The problem

A **flow network** is a directed graph where each edge has a **capacity**. You want to push as much as possible from a **source** to a **sink**, subject to two rules:

1. **Capacity**: flow on an edge never exceeds its capacity.
2. **Conservation**: at every node except the source and sink, flow in equals flow out.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="A flow network with a source, two intermediate nodes and a sink, showing capacities and a bottleneck">
  <style>
    .fl-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .fl-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .fl-h { font: 700 12px var(--font-sans); }
    .fl-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.8; }
    .fl-s { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
    .fl-t { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .fl-e { stroke: var(--text-mute); stroke-width: 2; fill: none; }
    .fl-bn { stroke: var(--red); stroke-width: 3; fill: none; }
  </style>
  <circle cx="60" cy="120" r="24" class="fl-s"/><text x="52" y="125" class="fl-m">s</text>
  <circle cx="230" cy="60" r="24" class="fl-n"/><text x="224" y="65" class="fl-m">a</text>
  <circle cx="230" cy="180" r="24" class="fl-n"/><text x="224" y="185" class="fl-m">b</text>
  <circle cx="400" cy="60" r="24" class="fl-n"/><text x="394" y="65" class="fl-m">c</text>
  <circle cx="400" cy="180" r="24" class="fl-n"/><text x="394" y="185" class="fl-m">d</text>
  <circle cx="560" cy="120" r="24" class="fl-t"/><text x="553" y="125" class="fl-m">t</text>
  <path d="M82 108 L208 70" class="fl-e" marker-end="url(#arr-fl)"/><text x="130" y="78" class="fl-m">10</text>
  <path d="M82 132 L208 170" class="fl-e" marker-end="url(#arr-fl)"/><text x="130" y="168" class="fl-m">10</text>
  <path d="M254 60 L376 60" class="fl-bn" marker-end="url(#arr-fl2)"/><text x="292" y="50" class="fl-m" fill="var(--red)">4 ← bottleneck</text>
  <path d="M254 180 L376 180" class="fl-e" marker-end="url(#arr-fl)"/><text x="308" y="172" class="fl-m">9</text>
  <path d="M248 78 L382 164" class="fl-e" marker-end="url(#arr-fl)"/><text x="300" y="128" class="fl-m">6</text>
  <path d="M422 70 L538 108" class="fl-e" marker-end="url(#arr-fl)"/><text x="470" y="80" class="fl-m">10</text>
  <path d="M422 170 L538 132" class="fl-bn" marker-end="url(#arr-fl2)"/><text x="462" y="166" class="fl-m" fill="var(--red)">10 ← bottleneck</text>
  <text x="20" y="24" class="fl-h">Maximum flow s → t is 14, not 20 — a→c caps the upper route at 4, and d→t caps the lower at 10.</text>
  <text x="20" y="222" class="fl-c">Max-flow min-cut: the maximum flow equals the total capacity of the cheapest set of edges whose removal disconnects s from t.</text>
  <defs>
    <marker id="arr-fl" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="arr-fl2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--red)"/></marker>
  </defs>
</svg>
<figcaption>Flow is limited by <b>bottlenecks</b>, not by the source's total outgoing capacity. The max-flow min-cut theorem says the limit is exactly the cheapest cut.</figcaption>
</figure>

## The key idea: residual graphs

The algorithm is simple — repeatedly find any path from source to sink with spare capacity and push flow along it. What makes it *correct* is one non-obvious addition: every time you push flow forward, you add the same amount of capacity **backwards**.

> [!key] Backward edges let the algorithm undo its own mistakes
> A greedy algorithm that just pushes flow down paths can get stuck: an early choice saturates an edge that a better solution needed. The **residual graph** fixes this. Pushing `f` units along `u → v` reduces that edge's remaining capacity by `f` *and* increases the reverse edge `v → u` by `f`. A later augmenting path can then travel "backwards" along `v → u`, which effectively **cancels** part of the earlier decision and reroutes it. That single trick is why a simple greedy loop provably reaches the true maximum.

## Edmonds–Karp: max flow

Ford–Fulkerson says "find any augmenting path". Edmonds–Karp says "find the *shortest* one, with BFS" — which bounds the runtime at O(V·E²) regardless of the capacities.

```rust
use std::collections::VecDeque;

/// A flow network stored as a capacity matrix. Simple and correct;
/// use adjacency lists for large sparse graphs.
struct FlowNetwork {
    n: usize,
    /// capacity[u][v] — the REMAINING capacity of u → v (the residual graph).
    capacity: Vec<Vec<i64>>,
    adj: Vec<Vec<usize>>,
}

impl FlowNetwork {
    fn new(n: usize) -> Self {
        FlowNetwork { n, capacity: vec![vec![0; n]; n], adj: vec![Vec::new(); n] }
    }

    fn add_edge(&mut self, u: usize, v: usize, cap: i64) {
        if self.capacity[u][v] == 0 && self.capacity[v][u] == 0 {
            // Record adjacency in BOTH directions so BFS can traverse
            // the backward residual edges too.
            self.adj[u].push(v);
            self.adj[v].push(u);
        }
        self.capacity[u][v] += cap;
    }

    /// BFS for the shortest augmenting path. Returns the parent array if
    /// the sink is reachable through edges with spare capacity.
    fn bfs(&self, s: usize, t: usize) -> Option<Vec<usize>> {
        let mut parent = vec![usize::MAX; self.n];
        parent[s] = s;
        let mut queue = VecDeque::from([s]);

        while let Some(u) = queue.pop_front() {
            for &v in &self.adj[u] {
                // Only follow edges that still have room.
                if parent[v] == usize::MAX && self.capacity[u][v] > 0 {
                    parent[v] = u;
                    if v == t {
                        return Some(parent);
                    }
                    queue.push_back(v);
                }
            }
        }
        None
    }

    fn max_flow(&mut self, s: usize, t: usize) -> i64 {
        let mut total = 0;

        // Keep augmenting until no path with spare capacity remains.
        while let Some(parent) = self.bfs(s, t) {
            // 1. Find the bottleneck along the path.
            let mut bottleneck = i64::MAX;
            let mut v = t;
            while v != s {
                let u = parent[v];
                bottleneck = bottleneck.min(self.capacity[u][v]);
                v = u;
            }

            // 2. Push that much, and open the same amount backwards.
            let mut v = t;
            while v != s {
                let u = parent[v];
                self.capacity[u][v] -= bottleneck;
                self.capacity[v][u] += bottleneck; // ← the residual edge
                v = u;
            }

            total += bottleneck;
        }
        total
    }

    /// After max_flow, the min cut is the edges from the source side
    /// (still reachable in the residual graph) to the sink side.
    fn min_cut(&self, s: usize, original: &[Vec<i64>]) -> Vec<(usize, usize, i64)> {
        // Everything reachable from s in the RESIDUAL graph is the source side.
        let mut reachable = vec![false; self.n];
        reachable[s] = true;
        let mut queue = VecDeque::from([s]);
        while let Some(u) = queue.pop_front() {
            for &v in &self.adj[u] {
                if !reachable[v] && self.capacity[u][v] > 0 {
                    reachable[v] = true;
                    queue.push_back(v);
                }
            }
        }

        let mut cut = Vec::new();
        for u in 0..self.n {
            for v in 0..self.n {
                if reachable[u] && !reachable[v] && original[u][v] > 0 {
                    cut.push((u, v, original[u][v]));
                }
            }
        }
        cut
    }
}

fn main() {
    // The network from the diagram: s=0, a=1, b=2, c=3, d=4, t=5
    let mut net = FlowNetwork::new(6);
    net.add_edge(0, 1, 10);
    net.add_edge(0, 2, 10);
    net.add_edge(1, 3, 4);   // the bottleneck
    net.add_edge(1, 4, 6);
    net.add_edge(2, 4, 9);
    net.add_edge(3, 5, 10);
    net.add_edge(4, 5, 10);

    let original = net.capacity.clone();
    let flow = net.max_flow(0, 5);
    println!("maximum flow = {flow}");

    let cut = net.min_cut(0, &original);
    let cut_total: i64 = cut.iter().map(|(_, _, c)| c).sum();
    println!("minimum cut  = {cut_total} (must equal the max flow)");
    for (u, v, c) in &cut {
        println!("  cut edge {u} → {v} (capacity {c})");
    }
    assert_eq!(flow, cut_total);
}
```

> [!key] Max-flow min-cut: the same number, two questions
> The maximum flow from `s` to `t` is *exactly equal* to the minimum total capacity you must remove to disconnect them. That's not a coincidence — it's a theorem, and it's enormously useful. It means one algorithm answers both "how much can I push through?" and "where is the weakest point?" After running max flow, the cut is just "everything still reachable from `s` in the residual graph, on one side; everything else on the other."

## Bipartite matching

Here's flow's most common disguise. Given workers and jobs, with edges showing who is qualified for what, how many can you pair up? Model it as a flow network with unit capacities and the answer falls out.

<figure class="diagram">
<svg viewBox="0 0 640 230" role="img" aria-label="A bipartite graph of workers and jobs converted into a flow network with a super source and super sink and unit capacities">
  <style>
    .bp-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .bp-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bp-h { font: 700 12px var(--font-sans); }
    .bp-w { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.8; }
    .bp-j { fill: var(--teal-soft); stroke: var(--teal); stroke-width: 1.8; }
    .bp-s { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
    .bp-t { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .bp-e { stroke: var(--text-mute); stroke-width: 1.5; fill: none; }
  </style>
  <text x="20" y="18" class="bp-h">Add a super-source and super-sink, all capacities 1 → max flow = maximum matching</text>
  <circle cx="55" cy="115" r="20" class="bp-s"/><text x="48" y="120" class="bp-m">s</text>
  <circle cx="205" cy="55" r="18" class="bp-w"/><text x="197" y="60" class="bp-m">w1</text>
  <circle cx="205" cy="115" r="18" class="bp-w"/><text x="197" y="120" class="bp-m">w2</text>
  <circle cx="205" cy="175" r="18" class="bp-w"/><text x="197" y="180" class="bp-m">w3</text>
  <circle cx="400" cy="55" r="18" class="bp-j"/><text x="394" y="60" class="bp-m">j1</text>
  <circle cx="400" cy="115" r="18" class="bp-j"/><text x="394" y="120" class="bp-m">j2</text>
  <circle cx="400" cy="175" r="18" class="bp-j"/><text x="394" y="180" class="bp-m">j3</text>
  <circle cx="555" cy="115" r="20" class="bp-t"/><text x="549" y="120" class="bp-m">t</text>
  <path d="M74 105 L186 60" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M76 115 L186 115" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M74 125 L186 170" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M223 55 L381 55" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M220 65 L384 108" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M222 108 L383 62" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M223 175 L381 175" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M220 165 L384 122" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M418 55 L537 105" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M418 115 L534 115" class="bp-e" marker-end="url(#arr-bp)"/>
  <path d="M418 175 L537 125" class="bp-e" marker-end="url(#arr-bp)"/>
  <text x="100" y="205" class="bp-c">cap 1 each</text>
  <text x="250" y="205" class="bp-c">the qualification edges</text>
  <text x="450" y="205" class="bp-c">cap 1 each</text>
  <text x="20" y="226" class="bp-c">Unit capacity on the source and sink edges is what enforces "each worker one job, each job one worker".</text>
  <defs><marker id="arr-bp" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Any bipartite matching becomes a flow problem: <b>unit capacities</b> from a super-source and to a super-sink enforce the one-to-one constraint automatically.</figcaption>
</figure>

In practice you don't need the full flow machinery — Kuhn's algorithm finds augmenting paths directly with DFS, in O(V·E):

```rust
/// Maximum bipartite matching by Kuhn's algorithm.
/// `adj[left]` lists the right-hand nodes that `left` can be matched to.
struct Matcher {
    adj: Vec<Vec<usize>>,
    n_right: usize,
    /// match_right[r] = the left node matched to r, or None.
    match_right: Vec<Option<usize>>,
}

impl Matcher {
    fn new(n_left: usize, n_right: usize) -> Self {
        Matcher { adj: vec![Vec::new(); n_left], n_right, match_right: vec![None; n_right] }
    }

    fn add_edge(&mut self, left: usize, right: usize) {
        self.adj[left].push(right);
    }

    /// Try to find an augmenting path from `left`. If a right node is taken,
    /// recursively ask its current partner to move elsewhere.
    fn try_match(&mut self, left: usize, seen: &mut Vec<bool>) -> bool {
        let candidates = self.adj[left].clone();
        for right in candidates {
            if seen[right] {
                continue;
            }
            seen[right] = true;

            match self.match_right[right] {
                None => {
                    // Free — take it.
                    self.match_right[right] = Some(left);
                    return true;
                }
                Some(other) => {
                    // Taken — can its owner move? This is the augmenting path.
                    if self.try_match(other, seen) {
                        self.match_right[right] = Some(left);
                        return true;
                    }
                }
            }
        }
        false
    }

    fn maximum_matching(&mut self) -> usize {
        let mut count = 0;
        for left in 0..self.adj.len() {
            let mut seen = vec![false; self.n_right];
            if self.try_match(left, &mut seen) {
                count += 1;
            }
        }
        count
    }

    fn pairs(&self) -> Vec<(usize, usize)> {
        self.match_right
            .iter()
            .enumerate()
            .filter_map(|(r, &l)| l.map(|l| (l, r)))
            .collect()
    }
}

fn main() {
    let workers = ["ada", "grace", "alan"];
    let jobs = ["frontend", "backend", "devops"];

    let mut m = Matcher::new(workers.len(), jobs.len());
    m.add_edge(0, 0); // ada:   frontend
    m.add_edge(0, 1); // ada:   backend
    m.add_edge(1, 0); // grace: frontend
    m.add_edge(2, 1); // alan:  backend
    m.add_edge(2, 2); // alan:  devops

    let size = m.maximum_matching();
    println!("matched {size} of {} workers", workers.len());
    for (l, r) in m.pairs() {
        println!("  {} → {}", workers[l], jobs[r]);
    }

    // A case where greedy would fail but augmenting paths succeed:
    // two workers who can only do the same single job.
    let mut tight = Matcher::new(2, 1);
    tight.add_edge(0, 0);
    tight.add_edge(1, 0);
    println!("\n2 workers, 1 shared job → matching of {}", tight.maximum_matching());
}
```

> [!key] Augmenting paths are why greedy isn't enough
> Assign `ada → frontend` greedily and `grace` — who can *only* do frontend — is stranded, giving a matching of 2. The augmenting-path search fixes it: when `grace` finds frontend taken, it asks `ada` to move, `ada` finds backend free, and both are matched. This "ask the incumbent to move" recursion is exactly the residual-backward-edge idea from flow, in a different costume. Recognizing that the two are the same algorithm is the real lesson of this chapter.

## Recognizing a flow problem

This is the genuinely difficult skill. The reductions are mechanical once you spot them.

| Problem | Reduction |
|---|---|
| assign workers to jobs | bipartite matching; unit capacities |
| maximum edge-disjoint paths s→t | max flow with **all capacities 1** |
| maximum vertex-disjoint paths | split each node into `in`/`out` joined by a capacity-1 edge |
| minimum edges to disconnect s and t | min cut with unit capacities |
| a node has its own capacity limit | **node splitting**: `v_in → v_out` with that capacity |
| several sources or sinks | add a **super-source** / **super-sink** with infinite edges |
| each edge has a *minimum* flow too | flow with lower bounds — transform to a feasibility problem |
| minimum path cover of a DAG | `n` − (maximum bipartite matching) |
| maximum independent set in a bipartite graph | `n` − (maximum matching), by König's theorem |
| project selection with profits and prerequisites | min cut ("project selection" / closure problem) |
| image segmentation into foreground/background | min cut |
| scheduling with deadlines and resources | flow with time-expanded nodes |
| cheapest way to route a required volume | **min-cost max-flow** |

> [!best] Node splitting is the transformation you'll reach for most
> Flow constrains *edges*, not nodes. When a problem limits a node instead — "this router can forward at most 5 units", "each intersection handles 100 cars" — split it: replace `v` with `v_in` and `v_out`, route every incoming edge to `v_in`, every outgoing edge from `v_out`, and connect `v_in → v_out` with capacity equal to the node's limit. All flow through `v` must now cross that one edge. The same trick gives you vertex-disjoint paths, with capacity 1.

> [!mistake] Forgetting that undirected edges need capacity in both directions
> An undirected edge with capacity `c` is **not** one directed edge — it's `add_edge(u, v, c)` *and* `add_edge(v, u, c)`. Model it as a single directed edge and you'll silently compute a smaller max flow, because half the routes don't exist. This is easy to miss because the code compiles and produces a plausible-looking number.

## Dinic's algorithm

Edmonds–Karp is O(V·E²), which is too slow for large graphs. **Dinic's** algorithm groups augmenting paths into "phases" by BFS level, then saturates many paths per phase with DFS — O(V²·E) in general, and **O(E·√V)** on unit-capacity graphs, which makes it the standard choice for bipartite matching at scale.

| Algorithm | Complexity | Use when |
|---|---|---|
| Ford–Fulkerson (any path) | O(E · max_flow) | never — capacities can make it arbitrarily slow |
| **Edmonds–Karp** (BFS) | O(V·E²) | small graphs; simplest correct implementation |
| **Dinic's** | O(V²·E) | the general-purpose default |
| Dinic's on unit capacities | O(E·√V) | bipartite matching, disjoint paths |
| Push–relabel | O(V²·√E) | very dense graphs |
| **Hopcroft–Karp** | O(E·√V) | bipartite matching specifically |
| Kuhn's (DFS augmenting) | O(V·E) | bipartite matching, small and simple |
| min-cost max-flow (SPFA) | O(V·E·flow) | when edges have costs as well as capacities |

> [!warning] Ford–Fulkerson's complexity depends on the *capacity values*
> With an unlucky graph and capacities of 1,000,000, "find any augmenting path" can take a million iterations that each push a single unit — and with irrational capacities it may not terminate at all. Edmonds–Karp's only change is using **BFS** to pick the shortest augmenting path, and that alone makes the bound depend on the graph's size rather than its numbers. It's a good illustration that the choice of a seemingly minor sub-step can change an algorithm's complexity class.

> [!performance] Use adjacency lists, not a capacity matrix, for large graphs
> The matrix implementation above is O(V²) memory and makes each BFS O(V²) — fine for a few hundred nodes, hopeless for a hundred thousand. The production representation stores edges in a flat `Vec<Edge>` where each edge knows the index of its reverse partner, so pushing flow is `edges[i].cap -= f; edges[i ^ 1].cap += f;` — pairing edges at adjacent even/odd indices makes the reverse lookup a single XOR. That's how every competitive-programming Dinic implementation is written.

## Min-cost max-flow

When edges have a **cost** per unit as well as a capacity, you want the cheapest way to achieve maximum flow. The algorithm is the same shape, with Bellman–Ford (or Dijkstra with potentials) replacing BFS so it finds the *cheapest* augmenting path rather than the shortest.

| Problem | Model |
|---|---|
| assign workers to jobs, minimizing total cost | min-cost matching (the assignment problem) |
| ship goods from warehouses to shops cheaply | min-cost flow, costs = shipping rates |
| schedule jobs on machines, minimizing lateness | min-cost flow with time nodes |
| the assignment problem specifically | Hungarian algorithm — O(V³), often simpler |

## Complexity summary

| Problem | Algorithm | Time |
|---|---|---|
| max flow | Edmonds–Karp | O(V·E²) |
| max flow | Dinic's | O(V²·E) |
| max flow, unit capacities | Dinic's | O(E·√V) |
| min cut | max flow, then one BFS | same as max flow |
| bipartite matching | Kuhn's | O(V·E) |
| bipartite matching | Hopcroft–Karp | O(E·√V) |
| max edge-disjoint paths | max flow, unit capacities | O(E·√V) |
| min vertex cover (bipartite) | König: `V` − max matching | O(E·√V) |
| max independent set (bipartite) | `V` − max matching | O(E·√V) |
| min-cost max-flow | SPFA-based | O(V·E·flow) |
| assignment problem | Hungarian | O(V³) |

## Summary

- A **flow network** has edge capacities; max flow pushes as much as possible from source to sink under capacity and conservation constraints.
- **Residual backward edges** are the crucial idea: pushing `f` forward opens `f` backwards, letting later paths undo earlier choices. That's what makes a greedy loop provably optimal.
- **Edmonds–Karp** = Ford–Fulkerson with BFS, which makes the complexity depend on graph size rather than capacity *values*.
- **Max-flow min-cut**: the maximum flow equals the minimum cut capacity, so one run answers both "how much fits?" and "where's the weak point?"
- **Bipartite matching is flow in disguise** — unit capacities from a super-source and to a super-sink enforce one-to-one pairing. Kuhn's augmenting-path DFS is O(V·E) and short.
- Learn the **reductions**: node splitting for node capacities, super-source/sink for multiple endpoints, unit capacities for disjoint paths, min cut for project selection and segmentation.
- Undirected edges need capacity added in **both** directions.
- Use **Dinic's** with adjacency lists (and the `i ^ 1` reverse-edge trick) for anything large; **min-cost max-flow** when edges have prices.

> [!exercise] Try it yourself
> 1. Run the max-flow example, then add an edge `b → c` with capacity 5 and predict the new maximum before running it.
> 2. Set every capacity in the example network to 1 and compute the max flow. What does that number mean about the graph?
> 3. Add a node capacity of 3 to node `a` using the node-splitting transformation, and confirm the max flow drops accordingly.
> 4. Extend the bipartite matcher to report which workers were left unmatched, and explain why they couldn't be paired.
> 5. Model this as flow: three warehouses with stock levels, four shops with demands, and shipping links between some pairs. Can all demand be met?
> 6. Prove to yourself that max-flow equals min-cut on the example by listing every s-t cut and checking that 14 is the smallest.

Next, a chapter that ties the whole DSA course together — **interview preparation and problem-solving patterns**.
