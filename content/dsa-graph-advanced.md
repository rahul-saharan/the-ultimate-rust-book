<h1><span class="h1-kicker">Data Structures &amp; Algorithms</span>Advanced Graph Algorithms</h1>

[Traversal](#/ch/dsa-graph-traversal) tells you *what's reachable*. [Shortest paths](#/ch/dsa-shortest-path) tell you *how far*. This chapter answers a different family of questions about a graph's **structure**: which parts are mutually reachable, which single edge or vertex would break it apart, whether you can walk every edge exactly once — and, remarkably, how to solve a whole class of logic puzzles by turning them into a graph.

Every algorithm here is built on one idea you already have: depth-first search, with a little extra bookkeeping.

## The one idea behind almost all of it: lowlink

Run a DFS and number each vertex as you first reach it — call that `tin[v]` (time in). Now track a second number, **`low[v]`**: the smallest `tin` reachable from `v`'s subtree, including by following *one* back edge upward.

That single extra value answers a surprising number of structural questions.

<figure class="diagram">
<svg viewBox="0 0 640 260" role="img" aria-label="A DFS tree with tree edges and one back edge, showing how the lowlink value propagates upward and how comparing lowlink with the entry time identifies a bridge">
  <style>
    .ll-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .ll-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .ll-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .ll-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .ll-cut { fill: var(--red-soft); stroke: var(--red); stroke-width: 2; }
    .ll-tree { stroke: var(--border-strong); stroke-width: 1.6; }
    .ll-back { stroke: var(--blue); stroke-width: 1.6; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="16" class="ll-h">DFS tree — solid edges are tree edges, dashed is a back edge</text>
  <circle cx="70" cy="46" r="15" class="ll-n"/><text x="65" y="50" class="ll-m">0</text>
  <text x="92" y="43" class="ll-c">tin 0</text><text x="92" y="55" class="ll-c">low 0</text>
  <line x1="70" y1="61" x2="70" y2="87" class="ll-tree"/>
  <circle cx="70" cy="102" r="15" class="ll-n"/><text x="65" y="106" class="ll-m">1</text>
  <text x="92" y="99" class="ll-c">tin 1</text><text x="92" y="111" class="ll-c">low 0</text>
  <line x1="70" y1="117" x2="70" y2="143" class="ll-tree"/>
  <circle cx="70" cy="158" r="15" class="ll-cut"/><text x="65" y="162" class="ll-m">2</text>
  <text x="92" y="155" class="ll-c">tin 2</text><text x="92" y="167" class="ll-c">low 0</text>
  <path d="M85 152 C 140 130, 140 60, 85 46" class="ll-back" fill="none"/>
  <text x="146" y="100" class="ll-c" fill="var(--blue)">back edge 2→0</text>
  <text x="146" y="114" class="ll-c" fill="var(--blue)">pulls low down to 0</text>
  <line x1="70" y1="173" x2="70" y2="199" class="ll-tree" stroke="var(--red)"/>
  <circle cx="70" cy="214" r="15" class="ll-n"/><text x="65" y="218" class="ll-m">3</text>
  <text x="92" y="211" class="ll-c">tin 3</text><text x="92" y="223" class="ll-c">low 3</text>
  <text x="146" y="218" class="ll-c" fill="var(--red)">low[3] = 3 &gt; tin[2] = 2 → edge 2–3 is a BRIDGE</text>
  <text x="330" y="16" class="ll-h">What each comparison means</text>
  <text x="330" y="40" class="ll-m" fill="var(--red)">low[child] &gt; tin[v]</text>
  <text x="330" y="54" class="ll-c">nothing in the child's subtree can reach v or above,</text>
  <text x="330" y="68" class="ll-c">so the edge v–child is a <tspan font-weight="700">bridge</tspan></text>
  <text x="330" y="94" class="ll-m" fill="var(--rust-600)">low[child] ≥ tin[v]</text>
  <text x="330" y="108" class="ll-c">the child's subtree can reach v at best, so removing v</text>
  <text x="330" y="122" class="ll-c">disconnects it — v is an <tspan font-weight="700">articulation point</tspan></text>
  <text x="330" y="148" class="ll-m" fill="var(--green)">low[v] == tin[v]</text>
  <text x="330" y="162" class="ll-c">v cannot reach above itself, so v roots a</text>
  <text x="330" y="176" class="ll-c">complete <tspan font-weight="700">strongly connected component</tspan></text>
  <text x="330" y="206" class="ll-c">Three structural properties, one DFS, one extra array.</text>
  <text x="330" y="220" class="ll-c">The only difference is which comparison you make</text>
  <text x="330" y="234" class="ll-c">and whether the graph is directed.</text>
</svg>
<figcaption>The <b>lowlink</b> value — how far back up the DFS tree a subtree can reach — is the engine behind bridges, articulation points, and strongly connected components alike.</figcaption>
</figure>

> [!key] `tin` vs `low` in one sentence each
> **`tin[v]`** is *when* the DFS first reached `v`. **`low[v]`** is the earliest `tin` that `v`'s subtree can reach. If a subtree can reach *above* its entry point, there's an alternative route around it — it's part of a cycle. If it can't, the edge or vertex you came in through is the only way in, which makes it critical.

## Strongly connected components

In a **directed** graph, two vertices are in the same *strongly connected component* (SCC) if each can reach the other. Contracting each SCC to a single node always yields a DAG — the **condensation** — which is why SCCs are the first step in so many directed-graph algorithms.

> [!jargon] Strongly vs weakly connected
> **Strongly connected** means mutual reachability *respecting edge directions*. **Weakly connected** means the graph would be connected if you ignored the directions. `0 → 1` is weakly connected but not strongly, because there's no way back from `1`.

Two algorithms dominate, and it's worth knowing both because they trade differently.

### Tarjan: one pass

Tarjan's algorithm finds every SCC in a **single** DFS, using lowlink plus a stack of "vertices whose component isn't finished yet". When `low[v] == tin[v]`, `v` is the root of an SCC, and everything above it on the stack belongs to it.

```rust
struct Tarjan<'a> {
    adj: &'a [Vec<usize>],
    tin: Vec<usize>,
    low: Vec<usize>,
    on_stack: Vec<bool>,
    stack: Vec<usize>,
    timer: usize,
    components: Vec<Vec<usize>>,
}

impl<'a> Tarjan<'a> {
    fn run(adj: &'a [Vec<usize>]) -> Vec<Vec<usize>> {
        let n = adj.len();
        let mut t = Tarjan {
            adj,
            tin: vec![usize::MAX; n],
            low: vec![0; n],
            on_stack: vec![false; n],
            stack: Vec::new(),
            timer: 0,
            components: Vec::new(),
        };
        for v in 0..n {
            if t.tin[v] == usize::MAX {
                t.dfs(v);
            }
        }
        t.components
    }

    fn dfs(&mut self, v: usize) {
        self.tin[v] = self.timer;
        self.low[v] = self.timer;
        self.timer += 1;
        self.stack.push(v);
        self.on_stack[v] = true;

        for i in 0..self.adj[v].len() {
            let to = self.adj[v][i];
            if self.tin[to] == usize::MAX {
                self.dfs(to);
                self.low[v] = self.low[v].min(self.low[to]); // tree edge
            } else if self.on_stack[to] {
                // Back edge to a vertex still in the current component.
                // Note we use tin[to], not low[to] — crucial for correctness.
                self.low[v] = self.low[v].min(self.tin[to]);
            }
            // An edge to a finished component is ignored entirely.
        }

        if self.low[v] == self.tin[v] {
            let mut component = Vec::new();
            loop {
                let w = self.stack.pop().unwrap();
                self.on_stack[w] = false;
                component.push(w);
                if w == v { break; }
            }
            component.sort_unstable();
            self.components.push(component);
        }
    }
}

fn main() {
    // 0→1→2→0 is a cycle;  2→3;  3→4→5→3 is a cycle;  5→6 is a sink.
    let adj = vec![
        vec![1],    // 0
        vec![2],    // 1
        vec![0, 3], // 2
        vec![4],    // 3
        vec![5],    // 4
        vec![3, 6], // 5
        vec![],     // 6
    ];

    let mut sccs = Tarjan::run(&adj);
    sccs.sort();
    println!("{sccs:?}");
    println!("{} components", sccs.len());
}
```

> [!mistake] Using `low[to]` instead of `tin[to]` on a back edge
> This is the single most common Tarjan bug, and it's insidious because the algorithm still *looks* right and gives correct answers on many graphs. On a back edge to a vertex still on the stack you must take `min(low[v], tin[to])` — the *entry time* of the target, not its lowlink. Using `low[to]` can propagate a value from a different branch and merge two components that should stay separate. Test any implementation against a graph with two adjacent cycles, as the example above has.

### Kosaraju: two passes, easier to believe

Kosaraju runs DFS twice: once on the graph to get finishing order, then on the **reversed** graph in reverse finishing order. Each tree in the second pass is exactly one SCC.

```rust
fn kosaraju(adj: &[Vec<usize>]) -> Vec<Vec<usize>> {
    let n = adj.len();

    // Pass 1: record vertices by DFS finish time.
    fn finish_order(v: usize, adj: &[Vec<usize>], seen: &mut Vec<bool>, order: &mut Vec<usize>) {
        seen[v] = true;
        for &to in &adj[v] {
            if !seen[to] { finish_order(to, adj, seen, order); }
        }
        order.push(v); // pushed only after all descendants
    }
    let mut order = Vec::with_capacity(n);
    let mut seen = vec![false; n];
    for v in 0..n {
        if !seen[v] { finish_order(v, adj, &mut seen, &mut order); }
    }

    // Reverse every edge.
    let mut rev = vec![Vec::new(); n];
    for v in 0..n {
        for &to in &adj[v] { rev[to].push(v); }
    }

    // Pass 2: collect on the reversed graph, latest finisher first.
    fn collect(v: usize, rev: &[Vec<usize>], comp: &mut Vec<usize>, id: usize, acc: &mut Vec<usize>) {
        comp[v] = id;
        acc.push(v);
        for &to in &rev[v] {
            if comp[to] == usize::MAX { collect(to, rev, comp, id, acc); }
        }
    }
    let mut comp = vec![usize::MAX; n];
    let mut components = Vec::new();
    for &v in order.iter().rev() {
        if comp[v] == usize::MAX {
            let mut acc = Vec::new();
            collect(v, &rev, &mut comp, components.len(), &mut acc);
            acc.sort_unstable();
            components.push(acc);
        }
    }
    components
}

fn main() {
    let adj = vec![vec![1], vec![2], vec![0, 3], vec![4], vec![5], vec![3, 6], vec![]];
    let mut sccs = kosaraju(&adj);
    sccs.sort();
    println!("{sccs:?}");

    // Kosaraju's second pass numbers components in reverse topological order
    // of the condensation — handy when you need that ordering anyway.
    println!("components in reverse topological order of the condensation");
}
```

| | Tarjan | Kosaraju |
|---|---|---|
| DFS passes | **1** | 2 |
| Needs the reversed graph | no | **yes** (extra O(V+E) memory) |
| Complexity | O(V + E) | O(V + E) |
| Constant factor | faster in practice | ~2× the work |
| Component order produced | reverse topological | reverse topological |
| Easier to reason about | no | **yes** |
| Extra state | `tin`, `low`, stack, `on_stack` | one order array |

> [!best] Learn Kosaraju, ship Tarjan
> Kosaraju is far easier to convince yourself of: "finish times, then reverse the graph" is two familiar steps. Tarjan is a single pass with subtle invariants. So understand the problem with Kosaraju, and use Tarjan in code you care about — it's one traversal and needs no reversed copy of the graph. If you only ever remember one, remember Kosaraju; a correct slow answer beats a fast wrong one.

## Bridges and articulation points

Now the **undirected** case. A **bridge** is an edge whose removal increases the number of connected components. An **articulation point** (or cut vertex) is a vertex whose removal does the same. Both fall straight out of lowlink — they're the "single points of failure" in a network.

```rust
struct Cut<'a> {
    adj: &'a [Vec<usize>],
    tin: Vec<usize>,
    low: Vec<usize>,
    timer: usize,
    bridges: Vec<(usize, usize)>,
    articulation: Vec<usize>,
}

impl<'a> Cut<'a> {
    fn run(adj: &'a [Vec<usize>]) -> (Vec<(usize, usize)>, Vec<usize>) {
        let n = adj.len();
        let mut c = Cut {
            adj,
            tin: vec![usize::MAX; n],
            low: vec![0; n],
            timer: 0,
            bridges: Vec::new(),
            articulation: Vec::new(),
        };
        for v in 0..n {
            if c.tin[v] == usize::MAX {
                c.dfs(v, usize::MAX);
            }
        }
        c.bridges.sort_unstable();
        c.articulation.sort_unstable();
        c.articulation.dedup();
        (c.bridges, c.articulation)
    }

    fn dfs(&mut self, v: usize, parent: usize) {
        self.tin[v] = self.timer;
        self.low[v] = self.timer;
        self.timer += 1;
        let mut children = 0;

        for i in 0..self.adj[v].len() {
            let to = self.adj[v][i];
            if to == parent {
                continue; // don't walk straight back up the tree edge
            }
            if self.tin[to] != usize::MAX {
                // Back edge: it can lift our lowlink.
                self.low[v] = self.low[v].min(self.tin[to]);
            } else {
                self.dfs(to, v);
                self.low[v] = self.low[v].min(self.low[to]);

                // Strictly greater: the subtree can't even reach v.
                if self.low[to] > self.tin[v] {
                    self.bridges.push((v.min(to), v.max(to)));
                }
                // Greater or equal: the subtree can reach v at best.
                // The root is special-cased below.
                if self.low[to] >= self.tin[v] && parent != usize::MAX {
                    self.articulation.push(v);
                }
                children += 1;
            }
        }

        // The DFS root is an articulation point only with 2+ DFS children.
        if parent == usize::MAX && children > 1 {
            self.articulation.push(v);
        }
    }
}

fn main() {
    // 0–1–2–0 forms a triangle; then 2–3 and 3–4 hang off it in a line.
    let adj = vec![
        vec![1, 2],    // 0
        vec![0, 2],    // 1
        vec![0, 1, 3], // 2
        vec![2, 4],    // 3
        vec![3],       // 4
    ];

    let (bridges, articulation) = Cut::run(&adj);
    println!("bridges           {bridges:?}");
    println!("articulation pts  {articulation:?}");
    println!();
    println!("No edge of the triangle is a bridge — each has a way around.");
    println!("Removing vertex 2 isolates 3 and 4; removing 3 isolates 4.");
}
```

> [!key] Bridge uses `>`, articulation point uses `>=`
> The two conditions differ by one character, and the reason is precise. For an **edge** to be critical, the child's subtree must not reach `v` *or anything above it* — so `low[child] > tin[v]`. For the **vertex** `v` to be critical, it's enough that the subtree can't get *past* `v` — reaching `v` itself is fine, since removing `v` still cuts it off. Hence `low[child] >= tin[v]`. Get these the wrong way round and you'll report every bridge endpoint as an articulation point.

> [!warning] The DFS root needs its own rule
> The root of a DFS tree has no parent, so the `low[child] >= tin[v]` test would flag it whenever it has any child at all — which is wrong. The root is an articulation point **only if it has two or more children in the DFS tree**, because that means its subtrees are otherwise unconnected. Forgetting this special case is the second-most-common bug in this algorithm, after mishandling the parent edge.

> [!mistake] Parallel edges break the `to == parent` check
> Skipping the parent by *vertex* is fine for a simple graph, but if two vertices are joined by two distinct edges, neither is a bridge — yet the check skips both and reports one. When your graph can have parallel edges, track the **edge id** you arrived on and skip that instead of the parent vertex. The same fix makes the Eulerian code below work, which is why it stores ids.

## Eulerian paths: walk every edge exactly once

An **Eulerian circuit** uses every edge exactly once and returns to the start; an **Eulerian path** does the same without returning. Whether one exists is decided purely by counting degrees:

| Graph | Eulerian circuit | Eulerian path |
|---|---|---|
| undirected | every vertex has **even** degree | exactly **0 or 2** odd-degree vertices |
| directed | `in == out` for every vertex | one vertex with `out−in = 1`, one with `in−out = 1`, rest equal |
| both | edges must form **one** connected component | same |

**Hierholzer's algorithm** finds one in O(V + E): walk forward consuming edges until stuck, then unwind, emitting vertices as you back out.

```rust
/// Returns a walk using every edge exactly once, or None if none exists.
fn eulerian_path(n: usize, edges: &[(usize, usize)]) -> Option<Vec<usize>> {
    let m = edges.len();
    // Store (neighbour, edge id) so parallel edges are handled correctly.
    let mut adj: Vec<Vec<(usize, usize)>> = vec![Vec::new(); n];
    for (id, &(a, b)) in edges.iter().enumerate() {
        adj[a].push((b, id));
        adj[b].push((a, id));
    }

    // Degree test: 0 odd vertices → circuit, 2 → path, anything else → no.
    let odd: Vec<usize> = (0..n).filter(|&v| adj[v].len() % 2 == 1).collect();
    if odd.len() != 0 && odd.len() != 2 {
        return None;
    }
    // A path must start at an odd vertex; a circuit can start anywhere with edges.
    let start = if odd.len() == 2 { odd[0] } else { (0..n).find(|&v| !adj[v].is_empty())? };

    let mut used = vec![false; m];
    let mut iter = vec![0usize; n]; // how far through each adjacency list we are
    let mut stack = vec![start];
    let mut path = Vec::with_capacity(m + 1);

    while let Some(&v) = stack.last() {
        // Skip edges already consumed — this is what keeps it linear overall.
        while iter[v] < adj[v].len() && used[adj[v][iter[v]].1] {
            iter[v] += 1;
        }
        if iter[v] == adj[v].len() {
            path.push(v); // stuck: emit on the way back out
            stack.pop();
        } else {
            let (to, id) = adj[v][iter[v]];
            used[id] = true;
            stack.push(to);
        }
    }

    // If the edges weren't all in one component we never consumed them all.
    if path.len() != m + 1 {
        return None;
    }
    path.reverse();
    Some(path)
}

fn main() {
    // A square: every degree is 2 → Eulerian circuit.
    println!("square      {:?}", eulerian_path(4, &[(0, 1), (1, 2), (2, 3), (3, 0)]));

    // A path 0–1–2: vertices 0 and 2 are odd → Eulerian path, not a circuit.
    println!("line        {:?}", eulerian_path(3, &[(0, 1), (1, 2)]));

    // A star with three leaves: three odd vertices → impossible.
    println!("3-star      {:?}", eulerian_path(4, &[(0, 1), (0, 2), (0, 3)]));

    // Two disjoint edges: degrees are fine, but the graph isn't connected.
    println!("disjoint    {:?}", eulerian_path(4, &[(0, 1), (2, 3)]));
}
```

> [!history] The problem that started graph theory
> In 1736 Euler was asked whether one could cross all seven bridges of Königsberg exactly once. He proved it impossible by noticing that only the *degree* of each landmass matters — every visit to a landmass uses two bridges, one in and one out, so more than two odd-degree landmasses makes the walk impossible. Königsberg had four. That argument invented graph theory, and the degree condition in the table above is literally Euler's.

> [!note] Eulerian is easy, Hamiltonian is not
> Eulerian walks visit every **edge** once and are solvable in linear time. **Hamiltonian** paths visit every **vertex** once and are NP-complete — no known polynomial algorithm. The two problems sound almost identical and sit on opposite sides of the tractability line, which is one of the more surprising facts in the field. If a problem asks you to visit every *vertex* once, expect to need backtracking, DP over bitmasks ([bit manipulation](#/ch/dsa-bit-manipulation)), or an approximation.

## 2-SAT: logic as a graph

Here's the most surprising application. Given a boolean formula that is an AND of clauses, each clause an OR of exactly **two** literals, is there an assignment making it true? General SAT is NP-complete, but this restricted form is solvable in **linear time** — by building a graph.

The trick: the clause `(a ∨ b)` is logically identical to two implications, `¬a → b` and `¬b → a`. Build a graph with two vertices per variable (`x` and `¬x`), add those implication edges, and find the SCCs.

> [!key] `x` and `¬x` in the same SCC means unsatisfiable
> If `x` implies `¬x` *and* `¬x` implies `x`, both are forced true simultaneously — a contradiction, so the formula has no solution. Otherwise a solution always exists, and you read it off the condensation: set each variable to whichever of `x` / `¬x` comes **later** in topological order. That works because an implication can never lead from a later component to an earlier one.

```rust
struct TwoSat {
    n: usize,
    adj: Vec<Vec<usize>>,
    rev: Vec<Vec<usize>>,
}

impl TwoSat {
    fn new(n: usize) -> Self {
        TwoSat { n, adj: vec![Vec::new(); 2 * n], rev: vec![Vec::new(); 2 * n] }
    }

    /// Node 2v is "v is false", node 2v+1 is "v is true".
    fn node(v: usize, value: bool) -> usize {
        2 * v + usize::from(value)
    }

    fn implies(&mut self, from: usize, to: usize) {
        self.adj[from].push(to);
        self.rev[to].push(from);
    }

    /// Add the clause (a == va) OR (b == vb).
    fn or(&mut self, a: usize, va: bool, b: usize, vb: bool) {
        // If a isn't va, then b must be vb — and symmetrically.
        let (na, nb) = (Self::node(a, !va), Self::node(b, vb));
        self.implies(na, nb);
        let (nb2, na2) = (Self::node(b, !vb), Self::node(a, va));
        self.implies(nb2, na2);
    }

    fn solve(&self) -> Option<Vec<bool>> {
        let m = 2 * self.n;

        // Kosaraju over the implication graph.
        fn pass1(v: usize, adj: &[Vec<usize>], seen: &mut Vec<bool>, order: &mut Vec<usize>) {
            seen[v] = true;
            for &to in &adj[v] {
                if !seen[to] { pass1(to, adj, seen, order); }
            }
            order.push(v);
        }
        let mut order = Vec::with_capacity(m);
        let mut seen = vec![false; m];
        for v in 0..m {
            if !seen[v] { pass1(v, &self.adj, &mut seen, &mut order); }
        }

        fn pass2(v: usize, rev: &[Vec<usize>], comp: &mut Vec<usize>, id: usize) {
            comp[v] = id;
            for &to in &rev[v] {
                if comp[to] == usize::MAX { pass2(to, rev, comp, id); }
            }
        }
        let mut comp = vec![usize::MAX; m];
        let mut id = 0;
        for &v in order.iter().rev() {
            if comp[v] == usize::MAX {
                pass2(v, &self.rev, &mut comp, id);
                id += 1;
            }
        }

        // Read off the assignment.
        let mut assignment = vec![false; self.n];
        for v in 0..self.n {
            if comp[2 * v] == comp[2 * v + 1] {
                return None; // x and !x forced together → contradiction
            }
            // Component ids increase along topological order, so the larger id
            // is the later component — that's the value we choose.
            assignment[v] = comp[2 * v + 1] > comp[2 * v];
        }
        Some(assignment)
    }
}

fn main() {
    // (x0 ∨ x1) ∧ (¬x0 ∨ x1) ∧ (¬x0 ∨ ¬x1)
    // The only assignment satisfying all three is x0 = false, x1 = true.
    let mut sat = TwoSat::new(2);
    sat.or(0, true, 1, true);
    sat.or(0, false, 1, true);
    sat.or(0, false, 1, false);

    match sat.solve() {
        Some(a) => println!("satisfiable: x0 = {}, x1 = {}", a[0], a[1]),
        None => println!("unsatisfiable"),
    }

    // (x ∨ x) ∧ (¬x ∨ ¬x) says x must be both true and false.
    let mut contradiction = TwoSat::new(1);
    contradiction.or(0, true, 0, true);
    contradiction.or(0, false, 0, false);
    println!("contradiction → {:?}", contradiction.solve());
}
```

> [!best] Recognising a 2-SAT problem is the hard part
> The algorithm is short; spotting that a problem *is* 2-SAT is the skill. The tell-tale shape: every item has exactly **two** options, and the constraints are all pairwise — "these two can't both be chosen", "if this one is A then that one must be B", "at least one of this pair". Scheduling with two rooms, 2-colouring with exclusions, and placing items on one of two sides all reduce to it. The moment an item has **three** choices, 2-SAT no longer applies and the problem is generally NP-hard.

## Complexity summary

| Algorithm | Time | Space | Graph | Answers |
|---|---|---|---|---|
| Tarjan SCC | O(V + E) | O(V) | directed | strongly connected components |
| Kosaraju SCC | O(V + E) | O(V + E) | directed | the same, needs a reversed copy |
| bridges | O(V + E) | O(V) | undirected | critical edges |
| articulation points | O(V + E) | O(V) | undirected | critical vertices |
| Hierholzer | O(V + E) | O(V + E) | either | an Eulerian path/circuit |
| 2-SAT | O(V + E) | O(V + E) | implication graph | a satisfying assignment |

Every one is **linear**. That's the payoff of the lowlink idea: structural questions that sound like they'd need to try many possibilities each collapse into a single traversal.

> [!warning] All of these recurse — mind the stack
> Every algorithm in this chapter is written recursively because that's how they're clearest, but a graph with 10⁶ vertices in a long chain will overflow the stack, exactly as in [tree algorithms](#/ch/dsa-tree-algorithms). For production use on large graphs, convert the DFS to an explicit stack machine, or run it on a thread created with `std::thread::Builder::new().stack_size(256 * 1024 * 1024)`. Competitive-programming submissions hit this constantly.

## Summary

- **`low[v]`** — the earliest entry time reachable from `v`'s subtree — is the engine behind nearly every algorithm here.
- **SCCs**: **Tarjan** in one pass (use it), **Kosaraju** in two with a reversed graph (understand it). Contracting SCCs gives a **DAG**.
- In Tarjan, a back edge must use **`tin[to]`, not `low[to]`** — the classic silent bug.
- **Bridge**: `low[child] > tin[v]`. **Articulation point**: `low[child] >= tin[v]`, plus the special rule that the **DFS root** needs 2+ children.
- With **parallel edges**, skip the arriving **edge id**, not the parent vertex.
- **Eulerian** walks exist based purely on **degree parity** (plus connectivity) and are found in linear time by **Hierholzer**. Hamiltonian paths, which sound similar, are NP-complete.
- **2-SAT** becomes a graph problem: each clause is two implications, and it's satisfiable unless some `x` and `¬x` share an SCC. Linear time.
- Every algorithm here is **O(V + E)** — and every one recurses, so watch the stack on large inputs.

> [!exercise] Try it yourself
> 1. Run Tarjan on a DAG. How many components do you get, and why?
> 2. Deliberately change Tarjan's back-edge line to `min(low[v], low[to])`. Find a graph where the answer becomes wrong.
> 3. Build the **condensation**: contract each SCC to one node and produce the resulting DAG's adjacency list. Then [topologically sort](#/ch/dsa-graph-traversal) it.
> 4. Modify `Cut` to return **2-edge-connected components** — the pieces left after deleting every bridge.
> 5. Add a second edge between vertices 2 and 3 in the bridge example. Does the code still say 2–3 is a bridge? Fix it with edge ids.
> 6. Extend `eulerian_path` to **directed** graphs using the in/out-degree conditions from the table.
> 7. Model this with 2-SAT: six people, each assigned to one of two teams, with a list of pairs who must be split and pairs who must be together.

That's the structural toolkit. Next we return to algorithm design paradigms and the patterns that let you recognise which tool a new problem needs.
