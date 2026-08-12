<h1><span class="h1-kicker">Data Structures &amp; Algorithms</span>Tree Algorithms: Traversal, LCA & Tree DP</h1>

You know how to *build* trees — [binary search trees](#/ch/dsa-trees), [balanced trees](#/ch/dsa-balanced-trees), [heaps](#/ch/dsa-heaps), and [tries](#/ch/dsa-tries). This chapter is about what you *do* with them. Traversal is the foundation almost every tree problem is built on, and once you have it, a small set of techniques — lowest common ancestor, diameter, serialization, and tree DP — covers the overwhelming majority of tree questions you'll ever meet.

## Why traversal order is the whole game

Visiting every node is easy. The *order* you visit them in is what makes an algorithm correct, and there are only four orders worth knowing:

<figure class="diagram">
<svg viewBox="0 0 640 300" role="img" aria-label="One binary tree shown four times with the visit order for preorder, inorder, postorder and level-order traversal marked on each node">
  <style>
    .tt-h { font: 700 11.5px var(--font-sans); }
    .tt-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .tt-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .tt-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .tt-e { stroke: var(--border-strong); stroke-width: 1.2; }
    .tt-o { font: 700 9.5px var(--font-mono); fill: var(--rust-600); }
  </style>
  <text x="20" y="16" class="tt-h" fill="var(--rust-600)">preorder — node, left, right</text>
  <circle cx="80" cy="38" r="12" class="tt-n"/><text x="76" y="42" class="tt-m">1</text><text x="95" y="34" class="tt-o">①</text>
  <line x1="70" y1="47" x2="50" y2="63" class="tt-e"/><line x1="90" y1="47" x2="110" y2="63" class="tt-e"/>
  <circle cx="46" cy="72" r="12" class="tt-n"/><text x="42" y="76" class="tt-m">2</text><text x="22" y="70" class="tt-o">②</text>
  <circle cx="114" cy="72" r="12" class="tt-n"/><text x="110" y="76" class="tt-m">3</text><text x="129" y="70" class="tt-o">⑤</text>
  <line x1="38" y1="81" x2="24" y2="97" class="tt-e"/><line x1="54" y1="81" x2="68" y2="97" class="tt-e"/>
  <line x1="122" y1="81" x2="136" y2="97" class="tt-e"/>
  <circle cx="20" cy="106" r="12" class="tt-n"/><text x="16" y="110" class="tt-m">4</text><text x="0" y="126" class="tt-o">③</text>
  <circle cx="72" cy="106" r="12" class="tt-n"/><text x="68" y="110" class="tt-m">5</text><text x="66" y="130" class="tt-o">④</text>
  <circle cx="140" cy="106" r="12" class="tt-n"/><text x="136" y="110" class="tt-m">6</text><text x="134" y="130" class="tt-o">⑥</text>
  <text x="20" y="150" class="tt-m" fill="var(--rust-600)">1 2 4 5 3 6</text>
  <text x="20" y="164" class="tt-c">copy a tree · serialize</text>
  <text x="340" y="16" class="tt-h" fill="var(--green)">inorder — left, node, right</text>
  <circle cx="400" cy="38" r="12" class="tt-n"/><text x="396" y="42" class="tt-m">1</text><text x="415" y="34" class="tt-o">④</text>
  <line x1="390" y1="47" x2="370" y2="63" class="tt-e"/><line x1="410" y1="47" x2="430" y2="63" class="tt-e"/>
  <circle cx="366" cy="72" r="12" class="tt-n"/><text x="362" y="76" class="tt-m">2</text><text x="342" y="70" class="tt-o">②</text>
  <circle cx="434" cy="72" r="12" class="tt-n"/><text x="430" y="76" class="tt-m">3</text><text x="449" y="70" class="tt-o">⑤</text>
  <line x1="358" y1="81" x2="344" y2="97" class="tt-e"/><line x1="374" y1="81" x2="388" y2="97" class="tt-e"/>
  <line x1="442" y1="81" x2="456" y2="97" class="tt-e"/>
  <circle cx="340" cy="106" r="12" class="tt-n"/><text x="336" y="110" class="tt-m">4</text><text x="320" y="126" class="tt-o">①</text>
  <circle cx="392" cy="106" r="12" class="tt-n"/><text x="388" y="110" class="tt-m">5</text><text x="386" y="130" class="tt-o">③</text>
  <circle cx="460" cy="106" r="12" class="tt-n"/><text x="456" y="110" class="tt-m">6</text><text x="454" y="130" class="tt-o">⑥</text>
  <text x="340" y="150" class="tt-m" fill="var(--green)">4 2 5 1 3 6</text>
  <text x="340" y="164" class="tt-c">BST → sorted order</text>
  <text x="20" y="196" class="tt-h" fill="var(--blue)">postorder — left, right, node</text>
  <circle cx="80" cy="218" r="12" class="tt-n"/><text x="76" y="222" class="tt-m">1</text><text x="95" y="214" class="tt-o">⑥</text>
  <line x1="70" y1="227" x2="50" y2="243" class="tt-e"/><line x1="90" y1="227" x2="110" y2="243" class="tt-e"/>
  <circle cx="46" cy="252" r="12" class="tt-n"/><text x="42" y="256" class="tt-m">2</text><text x="22" y="250" class="tt-o">③</text>
  <circle cx="114" cy="252" r="12" class="tt-n"/><text x="110" y="256" class="tt-m">3</text><text x="129" y="250" class="tt-o">⑤</text>
  <line x1="38" y1="261" x2="24" y2="277" class="tt-e"/><line x1="54" y1="261" x2="68" y2="277" class="tt-e"/>
  <line x1="122" y1="261" x2="136" y2="277" class="tt-e"/>
  <circle cx="20" cy="286" r="12" class="tt-n"/><text x="16" y="290" class="tt-m">4</text><text x="0" y="277" class="tt-o">①</text>
  <circle cx="72" cy="286" r="12" class="tt-n"/><text x="68" y="290" class="tt-m">5</text><text x="86" y="292" class="tt-o">②</text>
  <circle cx="140" cy="286" r="12" class="tt-n"/><text x="136" y="290" class="tt-m">6</text><text x="154" y="292" class="tt-o">④</text>
  <text x="180" y="230" class="tt-m" fill="var(--blue)">4 5 2 6 3 1</text>
  <text x="180" y="244" class="tt-c">delete a tree · evaluate</text>
  <text x="180" y="258" class="tt-c">an expression · tree DP</text>
  <text x="340" y="196" class="tt-h" fill="var(--purple)">level-order — row by row (BFS)</text>
  <text x="340" y="218" class="tt-m" fill="var(--purple)">[1] [2 3] [4 5 6]</text>
  <text x="340" y="238" class="tt-c">shortest path in an unweighted tree,</text>
  <text x="340" y="252" class="tt-c">per-level answers, printing a tree.</text>
  <text x="340" y="272" class="tt-c">Uses a <tspan font-family="var(--font-mono)">VecDeque</tspan>, not recursion —</text>
  <text x="340" y="286" class="tt-c">the only one of the four that needs a queue.</text>
</svg>
<figcaption>The three depth-first orders differ <b>only</b> in where you visit the node relative to its children. Level-order is the odd one out: it needs a queue.</figcaption>
</figure>

> [!key] The three depth-first orders are one line apart
> Preorder, inorder, and postorder are the *same* recursive function with the "visit" statement moved. Put it before both recursive calls and you have preorder; between them, inorder; after them, postorder. That's the entire difference. Once you see this, you never have to memorize them again — you just ask *when do I need this node's value: before I know about its children, or after?*

| Order | Visit sequence | Reach for it when |
|---|---|---|
| **Preorder** | node → left → right | copying/cloning a tree, serializing, exploring top-down |
| **Inorder** | left → node → right | a BST — this yields **sorted** order |
| **Postorder** | left → right → node | you need children's results first: heights, sizes, deleting, tree DP |
| **Level-order** | row by row | shortest path, per-depth answers, printing |

## The four traversals, implemented

This book favours an **arena** (a `Vec` of nodes with `usize` indices) over `Option<Box<Node>>` for trees — no reference counting, better cache locality, and no borrow-checker fights. See [Designing Your Own Data Structures](#/ch/dsa-design) for why.

```rust
use std::collections::VecDeque;

struct Tree {
    nodes: Vec<Node>,
}

struct Node {
    val: i32,
    left: Option<usize>,
    right: Option<usize>,
}

impl Tree {
    fn new() -> Self {
        Tree { nodes: Vec::new() }
    }

    fn add(&mut self, val: i32) -> usize {
        self.nodes.push(Node { val, left: None, right: None });
        self.nodes.len() - 1
    }

    fn link(&mut self, parent: usize, left: Option<usize>, right: Option<usize>) {
        self.nodes[parent].left = left;
        self.nodes[parent].right = right;
    }

    // --- The three depth-first orders. Spot the single moved line. ---

    fn preorder(&self, n: Option<usize>, out: &mut Vec<i32>) {
        if let Some(i) = n {
            out.push(self.nodes[i].val); // visit FIRST
            self.preorder(self.nodes[i].left, out);
            self.preorder(self.nodes[i].right, out);
        }
    }

    fn inorder(&self, n: Option<usize>, out: &mut Vec<i32>) {
        if let Some(i) = n {
            self.inorder(self.nodes[i].left, out);
            out.push(self.nodes[i].val); // visit BETWEEN
            self.inorder(self.nodes[i].right, out);
        }
    }

    fn postorder(&self, n: Option<usize>, out: &mut Vec<i32>) {
        if let Some(i) = n {
            self.postorder(self.nodes[i].left, out);
            self.postorder(self.nodes[i].right, out);
            out.push(self.nodes[i].val); // visit LAST
        }
    }

    /// Inorder without recursion, using an explicit stack.
    /// This is the shape every iterative traversal takes: walk left as far as
    /// you can, then pop and turn right.
    fn inorder_iterative(&self, root: Option<usize>) -> Vec<i32> {
        let mut out = Vec::new();
        let mut stack = Vec::new();
        let mut cur = root;
        while cur.is_some() || !stack.is_empty() {
            while let Some(i) = cur {
                stack.push(i);
                cur = self.nodes[i].left;
            }
            let i = stack.pop().unwrap();
            out.push(self.nodes[i].val);
            cur = self.nodes[i].right;
        }
        out
    }

    /// Level-order, grouped per level. The `for _ in 0..q.len()` is the trick:
    /// it freezes the current row's length before we push the next row.
    fn level_order(&self, root: Option<usize>) -> Vec<Vec<i32>> {
        let mut levels = Vec::new();
        let mut q: VecDeque<usize> = root.into_iter().collect();
        while !q.is_empty() {
            let mut level = Vec::new();
            for _ in 0..q.len() {
                let i = q.pop_front().unwrap();
                level.push(self.nodes[i].val);
                if let Some(l) = self.nodes[i].left { q.push_back(l); }
                if let Some(r) = self.nodes[i].right { q.push_back(r); }
            }
            levels.push(level);
        }
        levels
    }

    /// Height, which is just postorder: you need both children before you answer.
    fn height(&self, n: Option<usize>) -> u32 {
        match n {
            None => 0,
            Some(i) => 1 + self.height(self.nodes[i].left).max(self.height(self.nodes[i].right)),
        }
    }
}

fn main() {
    //        1
    //      /   \
    //     2     3
    //    / \     \
    //   4   5     6
    let mut t = Tree::new();
    let (n4, n5, n6) = (t.add(4), t.add(5), t.add(6));
    let n2 = t.add(2);
    let n3 = t.add(3);
    let n1 = t.add(1);
    t.link(n2, Some(n4), Some(n5));
    t.link(n3, None, Some(n6));
    t.link(n1, Some(n2), Some(n3));

    let root = Some(n1);
    let mut v = Vec::new();
    t.preorder(root, &mut v);
    println!("preorder        {v:?}");
    v.clear();
    t.inorder(root, &mut v);
    println!("inorder         {v:?}");
    v.clear();
    t.postorder(root, &mut v);
    println!("postorder       {v:?}");
    println!("inorder (iter)  {:?}", t.inorder_iterative(root));
    println!("level order     {:?}", t.level_order(root));
    println!("height          {}", t.height(root));
}
```

> [!performance] All four are O(n) time; they differ in *space*
> Every traversal visits each node once, so time is always **O(n)**. The interesting cost is memory. A recursive depth-first traversal uses **O(h)** stack frames, where `h` is the height — fine for a balanced tree (`h ≈ log n`), but a degenerate tree of 100,000 nodes in a line means 100,000 frames and a **stack overflow**. Level-order uses **O(w)** for the queue, where `w` is the widest level — which for a complete tree is about `n/2`. So depth-first is cheaper on wide trees, breadth-first on deep ones.

> [!mistake] Deep recursion overflows the stack, and Rust won't warn you
> Rust does not do tail-call optimization, and the default main-thread stack is 8 MB. A recursive traversal over a skewed tree — one built by inserting sorted data into an unbalanced BST — will abort with `stack overflow` rather than panicking cleanly. Fixes, in order of preference: use the **iterative** version with an explicit `Vec` as a stack; keep the tree **balanced** ([balanced trees](#/ch/dsa-balanced-trees)); or spawn a thread with a bigger stack via `std::thread::Builder::new().stack_size(64 * 1024 * 1024)`.

## Lowest common ancestor

Given two nodes, which is the deepest node that is an ancestor of both? This underpins "distance between two nodes", subtree queries, and a great many interview problems.

The naive approach walks up from both nodes — **O(h)** per query, which is fine for a handful of queries. When you need to answer many, **binary lifting** preprocesses the tree in **O(n log n)** and then answers each query in **O(log n)**.

The idea: store, for every node, its ancestor `2⁰` steps up, `2¹` steps up, `2²` steps up, and so on. Any jump of `k` levels is then a sum of powers of two — the same trick as binary representation.

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Binary lifting stores each node's ancestors at power-of-two distances, so a jump of any length is composed from those jumps, and the two nodes are then raised together until their ancestors match">
  <style>
    .bl-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .bl-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .bl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .bl-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .bl-hi { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
  </style>
  <text x="20" y="16" class="bl-h">Step 1 — level the two nodes, using power-of-two jumps</text>
  <rect x="20" y="26" width="46" height="20" rx="3" class="bl-n"/><text x="30" y="40" class="bl-m">d=0</text>
  <rect x="20" y="50" width="46" height="20" rx="3" class="bl-n"/><text x="30" y="64" class="bl-m">d=1</text>
  <rect x="20" y="74" width="46" height="20" rx="3" class="bl-n"/><text x="30" y="88" class="bl-m">d=2</text>
  <rect x="20" y="98" width="46" height="20" rx="3" class="bl-n"/><text x="30" y="112" class="bl-m">d=3</text>
  <rect x="20" y="122" width="46" height="20" rx="3" class="bl-hi"/><text x="30" y="136" class="bl-m">d=4</text>
  <text x="76" y="136" class="bl-c">a is 3 deeper than b → 3 = 2¹ + 2⁰ → two jumps, not three steps</text>
  <text x="76" y="112" class="bl-c">up[a][1] lifts 2 levels</text>
  <text x="76" y="88" class="bl-c">up[a][0] lifts 1 level</text>
  <text x="20" y="168" class="bl-h">Step 2 — raise both together, largest jump first, while their ancestors differ</text>
  <text x="20" y="186" class="bl-c">If <tspan font-family="var(--font-mono)">up[a][k] != up[b][k]</tspan> the LCA is still higher, so jump. When no jump is safe, <tspan font-family="var(--font-mono)">up[a][0]</tspan> is the answer.</text>
</svg>
<figcaption>Binary lifting turns an <b>O(h)</b> walk into <b>O(log n)</b> jumps, by precomputing ancestors at every power-of-two distance.</figcaption>
</figure>

```rust
struct Lca {
    up: Vec<Vec<usize>>, // up[v][k] = the ancestor 2^k levels above v
    depth: Vec<u32>,
    log: usize,
}

impl Lca {
    fn new(adj: &[Vec<usize>], root: usize) -> Self {
        let n = adj.len();
        let log = (usize::BITS - n.next_power_of_two().leading_zeros()) as usize;
        let mut up = vec![vec![root; log + 1]; n];
        let mut depth = vec![0u32; n];

        // Iterative DFS, so a deep tree can't overflow the stack.
        let mut stack = vec![(root, root)];
        let mut seen = vec![false; n];
        while let Some((v, parent)) = stack.pop() {
            if seen[v] { continue; }
            seen[v] = true;
            up[v][0] = parent;
            // Each jump of 2^k is two jumps of 2^(k-1).
            for k in 1..=log {
                up[v][k] = up[up[v][k - 1]][k - 1];
            }
            for &to in &adj[v] {
                if !seen[to] {
                    depth[to] = depth[v] + 1;
                    stack.push((to, v));
                }
            }
        }
        Lca { up, depth, log }
    }

    fn query(&self, mut a: usize, mut b: usize) -> usize {
        // 1. Bring the deeper node up to the shallower one's level.
        if self.depth[a] < self.depth[b] {
            std::mem::swap(&mut a, &mut b);
        }
        let mut diff = self.depth[a] - self.depth[b];
        let mut k = 0;
        while diff > 0 {
            if diff & 1 == 1 { a = self.up[a][k]; }
            diff >>= 1;
            k += 1;
        }
        if a == b { return a; } // one was an ancestor of the other

        // 2. Rise together, biggest jumps first, staying strictly below the LCA.
        for k in (0..=self.log).rev() {
            if self.up[a][k] != self.up[b][k] {
                a = self.up[a][k];
                b = self.up[b][k];
            }
        }
        self.up[a][0]
    }

    /// Distance between two nodes falls straight out of the LCA.
    fn distance(&self, a: usize, b: usize) -> u32 {
        let l = self.query(a, b);
        self.depth[a] + self.depth[b] - 2 * self.depth[l]
    }
}

fn main() {
    //      0
    //    /   \
    //   1     2
    //  / \     \
    // 3   4     5
    let adj = vec![
        vec![1, 2],    // 0
        vec![0, 3, 4], // 1
        vec![0, 5],    // 2
        vec![1],       // 3
        vec![1],       // 4
        vec![2],       // 5
    ];
    let lca = Lca::new(&adj, 0);

    println!("lca(3, 4) = {}", lca.query(3, 4)); // 1 — siblings
    println!("lca(3, 5) = {}", lca.query(3, 5)); // 0 — different subtrees
    println!("lca(5, 2) = {}", lca.query(5, 2)); // 2 — one is the other's ancestor
    println!("lca(3, 3) = {}", lca.query(3, 3)); // 3 — a node is its own ancestor

    println!("distance(3, 5) = {}", lca.distance(3, 5)); // 3-1-0-2-5 = 4
}
```

| Approach | Preprocess | Per query | Use when |
|---|---|---|---|
| walk up from both | none | O(h) | a handful of queries, or `h` is tiny |
| **binary lifting** | O(n log n) | **O(log n)** | many queries — the default choice |
| Euler tour + sparse table | O(n log n) | O(1) | enormous query counts |
| offline Tarjan (union-find) | O(n α(n)) | amortized | all queries known up front |

## Diameter: the longest path in a tree

The diameter is the greatest distance between any two nodes. There's a beautiful two-pass trick: **BFS from anywhere to find the farthest node, then BFS from *that* node.** The second search's farthest distance *is* the diameter.

```rust
use std::collections::VecDeque;

/// Returns (farthest node from `start`, its distance).
fn farthest(adj: &[Vec<usize>], start: usize) -> (usize, u32) {
    let mut dist = vec![u32::MAX; adj.len()];
    let mut q = VecDeque::from([start]);
    dist[start] = 0;
    let mut best = (start, 0);

    while let Some(v) = q.pop_front() {
        if dist[v] > best.1 {
            best = (v, dist[v]);
        }
        for &to in &adj[v] {
            if dist[to] == u32::MAX {
                dist[to] = dist[v] + 1;
                q.push_back(to);
            }
        }
    }
    best
}

fn diameter(adj: &[Vec<usize>]) -> (usize, usize, u32) {
    let (a, _) = farthest(adj, 0); // pass 1: any start will do
    let (b, d) = farthest(adj, a); // pass 2: from the extreme point
    (a, b, d)
}

fn main() {
    let adj = vec![
        vec![1, 2],    // 0
        vec![0, 3, 4], // 1
        vec![0, 5],    // 2
        vec![1],       // 3
        vec![1],       // 4
        vec![2],       // 5
    ];
    let (a, b, d) = diameter(&adj);
    println!("diameter runs {a} … {b}, length {d}"); // 3 … 5, length 4
}
```

> [!deep] Why two passes are enough
> The claim is that the farthest node from *any* starting point must be an endpoint of some diameter. Suppose it weren't: then the path from your start to that node and the true diameter would have to branch apart somewhere, and you could splice the two to build a path longer than the diameter — a contradiction, since the diameter is by definition the longest. This argument holds for trees because there is exactly **one** path between any two nodes. It does **not** hold for general graphs with cycles, so don't reuse this trick there.

## Serialize and deserialize

To store a tree in a file or send it over a network you need a flat encoding you can rebuild from. Preorder with explicit **null markers** is the standard answer, and it round-trips exactly:

```rust
#[derive(Debug, PartialEq)]
struct Node {
    val: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}

impl Node {
    fn leaf(val: i32) -> Box<Node> {
        Box::new(Node { val, left: None, right: None })
    }
}

/// Preorder, writing `#` for an absent child. The markers are what make the
/// encoding unambiguous — without them you cannot tell shape from values.
fn serialize(n: &Option<Box<Node>>, out: &mut String) {
    match n {
        None => out.push_str("#,"),
        Some(b) => {
            out.push_str(&b.val.to_string());
            out.push(',');
            serialize(&b.left, out);
            serialize(&b.right, out);
        }
    }
}

fn deserialize(tokens: &mut std::vec::IntoIter<&str>) -> Option<Box<Node>> {
    match tokens.next()? {
        "#" | "" => None,
        t => {
            let val: i32 = t.parse().ok()?;
            // Order matters: preorder means left is consumed before right.
            let left = deserialize(tokens);
            let right = deserialize(tokens);
            Some(Box::new(Node { val, left, right }))
        }
    }
}

fn main() {
    let tree = Some(Box::new(Node {
        val: 1,
        left: Some(Box::new(Node { val: 2, left: Some(Node::leaf(4)), right: None })),
        right: Some(Node::leaf(3)),
    }));

    let mut encoded = String::new();
    serialize(&tree, &mut encoded);
    println!("serialized: {encoded}");

    let mut tokens = encoded.trim_end_matches(',').split(',').collect::<Vec<_>>().into_iter();
    let rebuilt = deserialize(&mut tokens);
    println!("round trip identical: {}", rebuilt == tree);
}
```

> [!mistake] Inorder alone cannot reconstruct a tree
> A classic trap: people serialize with inorder and find they can't rebuild. Inorder gives you the values in sorted order but loses the *shape* — many different trees share one inorder sequence. **Preorder or postorder with null markers** is unambiguous on its own. Alternatively, an inorder sequence **plus** a preorder sequence pins the tree down uniquely (a standard interview question), but that's two arrays where one annotated array would do.

## Validating a BST

The obvious implementation is wrong, and it's worth seeing why:

```rust
#[derive(Debug)]
struct Node {
    val: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}

impl Node {
    fn leaf(val: i32) -> Box<Node> {
        Box::new(Node { val, left: None, right: None })
    }
}

/// Correct: every node must fall inside a range narrowed by its ancestors,
/// not merely be on the right side of its immediate parent.
fn is_bst(n: &Option<Box<Node>>, lo: Option<i32>, hi: Option<i32>) -> bool {
    match n {
        None => true,
        Some(b) => {
            if lo.is_some_and(|l| b.val <= l) { return false; }
            if hi.is_some_and(|h| b.val >= h) { return false; }
            is_bst(&b.left, lo, Some(b.val)) && is_bst(&b.right, Some(b.val), hi)
        }
    }
}

fn main() {
    let valid = Some(Box::new(Node {
        val: 5,
        left: Some(Node::leaf(3)),
        right: Some(Node::leaf(8)),
    }));
    println!("valid BST:  {}", is_bst(&valid, None, None));

    // The trap: 6 is correctly to the RIGHT of 3, but it sits in 5's LEFT
    // subtree — so it must also be below 5. A parent-only check misses this.
    let tricky = Some(Box::new(Node {
        val: 5,
        left: Some(Box::new(Node { val: 3, left: None, right: Some(Node::leaf(6)) })),
        right: Some(Node::leaf(8)),
    }));
    println!("tricky one: {}  ← 6 is in 5's left subtree", is_bst(&tricky, None, None));
}
```

> [!key] A BST invariant is about *ranges*, not parents
> The rule is not "left child smaller, right child bigger" — it's "**every** node in the left subtree is smaller than this node, and every node in the right subtree is bigger." Each step down narrows an interval. Checking only against the immediate parent accepts trees that aren't BSTs, which then break binary search silently. The alternative correct approach is to do an **inorder** traversal and confirm the output is strictly increasing — which works precisely because of the inorder property in the table above.

## Tree DP: solving problems on subtrees

**Tree DP** computes an answer for every node from the answers of its children — which is exactly postorder. The classic example is the **maximum-weight independent set**: pick nodes with the largest total weight such that no two picked nodes are adjacent.

Two states per node: `take[v]` (best total if we take `v`) and `skip[v]` (best if we don't).

```rust
/// take[v] = w[v] + sum over children of skip[child]
/// skip[v] = sum over children of max(take[child], skip[child])
fn max_weight_independent_set(adj: &[Vec<usize>], w: &[i64], root: usize) -> i64 {
    let n = adj.len();
    let mut take = vec![0i64; n];
    let mut skip = vec![0i64; n];

    // Build a DFS order iteratively, then process it in reverse — that gives
    // postorder (children before parents) with no recursion at all.
    let mut order = Vec::with_capacity(n);
    let mut parent = vec![usize::MAX; n];
    let mut stack = vec![root];
    let mut seen = vec![false; n];
    seen[root] = true;
    while let Some(v) = stack.pop() {
        order.push(v);
        for &to in &adj[v] {
            if !seen[to] {
                seen[to] = true;
                parent[to] = v;
                stack.push(to);
            }
        }
    }

    for &v in order.iter().rev() {
        take[v] = w[v];
        for &to in &adj[v] {
            if to != parent[v] {
                take[v] += skip[to];                    // can't take an adjacent child
                skip[v] += take[to].max(skip[to]);      // free to pick the better option
            }
        }
    }
    take[root].max(skip[root])
}

fn main() {
    //      0(3)
    //     /    \
    //   1(2)   2(1)
    //   /  \      \
    // 3(10) 4(1)  5(1)
    let adj = vec![
        vec![1, 2],
        vec![0, 3, 4],
        vec![0, 5],
        vec![1],
        vec![1],
        vec![2],
    ];
    let w = [3i64, 2, 1, 10, 1, 1];

    let best = max_weight_independent_set(&adj, &w, 0);
    println!("best total = {best}");
    println!("(take 0, 3, 4, 5 → 3 + 10 + 1 + 1 = 15; taking 1 would forbid 3)");
}
```

> [!best] Process a DFS order in reverse instead of recursing
> That `order.iter().rev()` pattern is worth internalising. Building the visit order with an explicit stack and then iterating it **backwards** gives you postorder — children always processed before parents — with no recursion, so no stack-overflow risk on a deep tree and no borrow-checker trouble from recursive `&mut self` methods. It's the standard shape for tree DP in Rust, and it generalises directly to DAGs (where it *is* [topological order](#/ch/dsa-graph-traversal)).

| Tree DP problem | State per node |
|---|---|
| max-weight independent set | `take[v]`, `skip[v]` |
| subtree sizes / sums | one accumulator |
| height / depth | `1 + max(children)` |
| diameter (single pass) | best and second-best downward path |
| count nodes at distance k | array indexed by distance |
| minimum vertex cover | `covered[v]`, `uncovered[v]` |

## Complexity summary

| Operation | Time | Space | Notes |
|---|---|---|---|
| any traversal | O(n) | O(h) recursive, O(w) for BFS | `h` = height, `w` = widest level |
| height / size | O(n) | O(h) | postorder |
| LCA, naive | O(h) | O(1) | fine for few queries |
| LCA, binary lifting | O(n log n) build, O(log n) query | O(n log n) | the default |
| diameter | O(n) | O(n) | two BFS passes |
| serialize / deserialize | O(n) | O(n) | preorder + null markers |
| BST validation | O(n) | O(h) | range bounds, or inorder + check sorted |
| tree DP | O(n) | O(n) | postorder over a DFS order |

## Summary

- The three depth-first traversals are the **same function with the visit line moved**: before the recursion (preorder), between (inorder), after (postorder). Level-order is separate and needs a **queue**.
- **Inorder on a BST yields sorted output** — that single fact solves a surprising number of problems.
- Anything needing children's results first is **postorder**: heights, sizes, deletion, tree DP.
- All traversals are **O(n)** time; recursive depth-first costs **O(h)** stack and **overflows on deep trees**. Prefer the iterative form, or keep the tree balanced.
- **LCA by binary lifting**: precompute ancestors at power-of-two distances for O(n log n) build and O(log n) queries. Distance between nodes follows immediately.
- **Diameter in two BFS passes** — valid because a tree has exactly one path between any two nodes.
- **Serialize with preorder plus null markers.** Inorder alone loses the tree's shape.
- A BST invariant is about **ranges narrowed by all ancestors**, not just the immediate parent.
- **Tree DP is postorder.** Build a DFS order with a stack and iterate it in reverse — no recursion, no overflow.

> [!exercise] Try it yourself
> 1. Add a `preorder_iterative` method using one `Vec` as a stack. Why is it easier than the inorder version? (Hint: push right before left.)
> 2. Write `count_leaves` and `sum_values` as postorder traversals over the arena tree.
> 3. Build a deliberately skewed tree of 200,000 nodes in a line and call the recursive `height`. Watch it overflow, then fix it iteratively.
> 4. Use `level_order` to print a tree one line per level, then modify it to return only the **rightmost** node of each level.
> 5. Extend `Lca` with `is_ancestor(a, b)` in O(1) using an Euler tour's entry/exit times.
> 6. Serialize a tree, corrupt one `#` marker in the string, and observe how `deserialize` fails. Then make it return a `Result` with a useful error.
> 7. Solve **minimum vertex cover** on a tree with the same two-state DP. How do the recurrences change?

Trees are graphs without cycles — which is why so much of this chapter transfers directly. Next we take on the algorithms that need the cycles: **advanced graph algorithms**.
