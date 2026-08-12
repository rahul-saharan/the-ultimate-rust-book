<h1><span class="h1-kicker">Data Structures & Algorithms</span>Binary Trees & Binary Search Trees</h1>

Trees model hierarchy — file systems, org charts, parse trees, decision trees. The **binary tree** (each node has at most two children) is the workhorse, and the **binary search tree (BST)** adds an ordering rule that makes search, insert, and delete all O(log n) on average. This chapter builds a BST in Rust and covers the tree traversals you'll use everywhere.

## Anatomy of a binary tree

A **binary tree** is made of nodes, each holding a value and up to two children (`left` and `right`). In Rust, a child is `Option<Box<Node>>` — `Option` because a child may be absent, `Box` for the recursive structure:

```rust
struct Node {
    value: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}
```

> [!jargon] Tree terminology
> The top node is the **root**. A node's **children** hang below it; the node above is its **parent**. A node with no children is a **leaf**. The **height** is the length of the longest root-to-leaf path, and **depth** is the distance from the root. A **balanced** tree keeps its height ~`log n`; a degenerate one (all nodes in a line) has height `n` — which is why balance matters so much.

## The BST ordering rule

A **binary search tree** organizes values by one simple invariant, and that invariant is what gives it its speed:

> [!key] The BST invariant
> For **every** node: all values in its **left** subtree are **smaller**, and all values in its **right** subtree are **larger**. This means at each step of a search you can discard an entire subtree — go left for smaller, right for larger — halving the remaining nodes, just like [binary search](#/ch/dsa-searching) on an array. That's how insert, search, and delete become **O(log n)** in a balanced tree.

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="A binary search tree with root 5, where all left values are smaller and all right values larger">
  <style>
    .btm { font: 600 12px var(--font-mono); fill: #fff; }
    .btc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bnode { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
  </style>
  <line x1="320" y1="40" x2="220" y2="90" stroke="var(--text-mute)"/>
  <line x1="320" y1="40" x2="420" y2="90" stroke="var(--text-mute)"/>
  <line x1="220" y1="110" x2="160" y2="150" stroke="var(--text-mute)"/>
  <line x1="220" y1="110" x2="280" y2="150" stroke="var(--text-mute)"/>
  <line x1="420" y1="110" x2="480" y2="150" stroke="var(--text-mute)"/>
  <circle cx="320" cy="30" r="18" class="bnode"/><text x="314" y="35" class="btm">5</text>
  <circle cx="220" cy="100" r="18" class="bnode"/><text x="214" y="105" class="btm">3</text>
  <circle cx="420" cy="100" r="18" class="bnode"/><text x="414" y="105" class="btm">8</text>
  <circle cx="160" cy="160" r="18" class="bnode"/><text x="154" y="165" class="btm">1</text>
  <circle cx="280" cy="160" r="18" class="bnode"/><text x="274" y="165" class="btm">4</text>
  <circle cx="480" cy="160" r="18" class="bnode"/><text x="474" y="165" class="btm">9</text>
  <text x="80" y="105" class="btc">smaller ← left</text>
  <text x="500" y="105" class="btc">right → larger</text>
</svg>
<figcaption>In a BST, every left subtree is smaller and every right subtree larger than the node — so search discards half at each step.</figcaption>
</figure>

## Building the BST

Here's a complete BST with insert, search, and an in-order traversal (which, thanks to the invariant, yields values *in sorted order*):

```rust
type Link = Option<Box<Node>>;

struct Node {
    value: i32,
    left: Link,
    right: Link,
}

struct Bst {
    root: Link,
}

impl Bst {
    fn new() -> Self {
        Bst { root: None }
    }

    fn insert(&mut self, value: i32) {
        Self::insert_into(&mut self.root, value);
    }

    fn insert_into(link: &mut Link, value: i32) {
        match link {
            Some(node) => {
                if value < node.value {
                    Self::insert_into(&mut node.left, value);   // go left
                } else if value > node.value {
                    Self::insert_into(&mut node.right, value);  // go right
                } // equal → ignore (no duplicates)
            }
            None => {
                // Reached an empty spot — plant the new node here:
                *link = Some(Box::new(Node { value, left: None, right: None }));
            }
        }
    }

    fn contains(&self, value: i32) -> bool {
        let mut current = &self.root;
        while let Some(node) = current {
            if value == node.value {
                return true;
            }
            current = if value < node.value { &node.left } else { &node.right };
        }
        false
    }

    // In-order traversal: left, self, right → yields sorted values.
    fn sorted(&self) -> Vec<i32> {
        let mut out = Vec::new();
        Self::in_order(&self.root, &mut out);
        out
    }

    fn in_order(link: &Link, out: &mut Vec<i32>) {
        if let Some(node) = link {
            Self::in_order(&node.left, out);  // 1. all smaller values
            out.push(node.value);              // 2. this value
            Self::in_order(&node.right, out); // 3. all larger values
        }
    }
}

fn main() {
    let mut tree = Bst::new();
    for v in [5, 3, 8, 1, 4, 9, 7] {
        tree.insert(v);
    }
    println!("sorted:      {:?}", tree.sorted()); // [1, 3, 4, 5, 7, 8, 9]
    println!("contains 4?  {}", tree.contains(4)); // true
    println!("contains 6?  {}", tree.contains(6)); // false
}
```

## The three tree traversals

Visiting every node has three classic orders, depending on *when* you process the current node relative to its children:

| Traversal | Order | Yields (for a BST) |
|-----------|-------|--------------------|
| **In-order** | left → **node** → right | values in **sorted** order |
| **Pre-order** | **node** → left → right | root first (good for **copying** a tree) |
| **Post-order** | left → right → **node** | children first (good for **deleting/freeing**) |

```rust
# type Link = Option<Box<Node>>;
# struct Node { value: i32, left: Link, right: Link }
fn pre_order(link: &Link, out: &mut Vec<i32>) {
    if let Some(node) = link {
        out.push(node.value);          // node FIRST
        pre_order(&node.left, out);
        pre_order(&node.right, out);
    }
}
# fn main() {
#     let tree: Link = Some(Box::new(Node { value: 2, left: Some(Box::new(Node{value:1,left:None,right:None})), right: Some(Box::new(Node{value:3,left:None,right:None})) }));
#     let mut out = Vec::new();
#     pre_order(&tree, &mut out);
#     println!("{out:?}"); // [2, 1, 3]
# }
```

> [!note] Traversals get a chapter of their own
> All four orders (including **level-order**), their iterative forms, and the algorithms built on them — lowest common ancestor, diameter, serialization, tree DP — are covered in depth in [Tree Algorithms](#/ch/dsa-tree-algorithms). This section is just enough to make the BST's sorted-in-order property concrete.

## Deletion: the operation that's actually hard

Insert and search are a few lines each. **Deletion** is where BSTs earn their reputation, because removing a node must leave the invariant intact — and there are three genuinely different situations:

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="The three cases of binary search tree deletion: removing a leaf, removing a node with one child by splicing it in, and removing a node with two children by promoting its in-order successor">
  <style>
    .dl-h { font: 700 11.5px var(--font-sans); }
    .dl-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .dl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .dl-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .dl-go { fill: var(--red-soft); stroke: var(--red); stroke-width: 2; }
    .dl-new { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.8; }
    .dl-e { stroke: var(--text-mute); stroke-width: 1.2; }
  </style>
  <text x="20" y="16" class="dl-h" fill="var(--red)">1 · leaf — just detach it</text>
  <circle cx="60" cy="42" r="13" class="dl-n"/><text x="56" y="46" class="dl-m">5</text>
  <line x1="52" y1="52" x2="38" y2="66" class="dl-e"/>
  <circle cx="32" cy="76" r="13" class="dl-go"/><text x="28" y="80" class="dl-m">3</text>
  <text x="86" y="60" class="dl-c">set the parent's link to None.</text>
  <text x="86" y="74" class="dl-c">Nothing else can be affected.</text>
  <text x="20" y="114" class="dl-h" fill="var(--rust-600)">2 · one child — splice the child into its place</text>
  <circle cx="60" cy="140" r="13" class="dl-go"/><text x="56" y="144" class="dl-m">8</text>
  <line x1="52" y1="150" x2="38" y2="164" class="dl-e"/>
  <circle cx="32" cy="174" r="13" class="dl-n"/><text x="28" y="178" class="dl-m">7</text>
  <path d="M80 140 L110 140" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#arr-del)"/>
  <circle cx="132" cy="140" r="13" class="dl-new"/><text x="128" y="144" class="dl-m">7</text>
  <text x="160" y="136" class="dl-c">the child's whole subtree is already on the</text>
  <text x="160" y="150" class="dl-c">correct side, so it can move up wholesale</text>
  <text x="20" y="204" class="dl-h" fill="var(--green)">3 · two children — promote the in-order successor</text>
  <text x="20" y="222" class="dl-c">Take the <tspan font-weight="700">smallest value in the right subtree</tspan> (leftmost node there) and put it in the deleted node's slot.</text>
  <text x="20" y="236" class="dl-c">It is the only value that is larger than everything on the left and smaller than everything else on the right.</text>
  <defs><marker id="arr-del" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>BST deletion has three cases. Only the third is interesting: the <b>in-order successor</b> is the unique value that can take the deleted node's place.</figcaption>
</figure>

```rust
type Link = Option<Box<Node>>;

struct Node {
    value: i32,
    left: Link,
    right: Link,
}

struct Bst {
    root: Link,
}

impl Bst {
    fn new() -> Self {
        Bst { root: None }
    }

    fn insert(&mut self, value: i32) {
        Self::insert_into(&mut self.root, value);
    }

    fn insert_into(link: &mut Link, value: i32) {
        match link {
            Some(node) => {
                if value < node.value {
                    Self::insert_into(&mut node.left, value);
                } else if value > node.value {
                    Self::insert_into(&mut node.right, value);
                }
            }
            None => *link = Some(Box::new(Node { value, left: None, right: None })),
        }
    }

    /// Smallest value — walk left until you can't.
    fn min(&self) -> Option<i32> {
        let mut current = self.root.as_deref()?;
        while let Some(left) = current.left.as_deref() {
            current = left;
        }
        Some(current.value)
    }

    /// Largest value — walk right until you can't.
    fn max(&self) -> Option<i32> {
        let mut current = self.root.as_deref()?;
        while let Some(right) = current.right.as_deref() {
            current = right;
        }
        Some(current.value)
    }

    fn remove(&mut self, value: i32) -> bool {
        Self::remove_from(&mut self.root, value)
    }

    fn remove_from(link: &mut Link, value: i32) -> bool {
        let Some(node) = link else { return false }; // not in the tree

        if value < node.value {
            return Self::remove_from(&mut node.left, value);
        }
        if value > node.value {
            return Self::remove_from(&mut node.right, value);
        }

        // Found it. Take ownership so we can restructure freely.
        let mut found = link.take().expect("checked above");
        *link = match (found.left.take(), found.right.take()) {
            // Case 1: leaf — the slot becomes empty.
            (None, None) => None,
            // Case 2: one child — it moves up in place.
            (Some(child), None) | (None, Some(child)) => Some(child),
            // Case 3: two children — promote the in-order successor.
            (Some(left), Some(right)) => {
                let mut right_subtree: Link = Some(right);
                let mut successor = Self::take_min(&mut right_subtree);
                successor.left = Some(left);
                successor.right = right_subtree; // None if the successor *was* the root
                Some(successor)
            }
        };
        true
    }

    /// Detach and return the leftmost node, re-linking its right child in its place.
    fn take_min(link: &mut Link) -> Box<Node> {
        if link.as_ref().expect("non-empty").left.is_none() {
            let mut node = link.take().expect("non-empty");
            *link = node.right.take(); // the successor may have a right child
            return node;
        }
        let node = link.as_mut().expect("non-empty");
        Self::take_min(&mut node.left)
    }

    fn sorted(&self) -> Vec<i32> {
        let mut out = Vec::new();
        Self::in_order(&self.root, &mut out);
        out
    }

    fn in_order(link: &Link, out: &mut Vec<i32>) {
        if let Some(node) = link {
            Self::in_order(&node.left, out);
            out.push(node.value);
            Self::in_order(&node.right, out);
        }
    }
}

fn main() {
    let mut tree = Bst::new();
    for v in [5, 3, 8, 1, 4, 7, 9] {
        tree.insert(v);
    }
    println!("start                   {:?}", tree.sorted());
    println!("min / max               {:?} / {:?}", tree.min(), tree.max());

    println!("\nremove 1 (leaf)         {:?}", { tree.remove(1); tree.sorted() });
    println!("remove 8 (one child)    {:?}", { tree.remove(8); tree.sorted() });
    println!("remove 5 (two children) {:?}", { tree.remove(5); tree.sorted() });
    println!("remove 99 (absent)      {}", tree.remove(99));

    // The invariant is verifiable: in-order output must be strictly increasing.
    let mut stress = Bst::new();
    for v in [50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 55, 65, 75, 85] {
        stress.insert(v);
    }
    let mut still_valid = true;
    for v in [50, 20, 80, 30, 65, 10, 85, 40, 55, 70, 25, 35, 45, 60, 75] {
        stress.remove(v);
        if stress.sorted().windows(2).any(|w| w[0] >= w[1]) {
            still_valid = false;
        }
    }
    println!("\n15 removals in mixed order, invariant held every time: {still_valid}");
}
```

> [!key] Why the in-order successor is the *only* correct replacement
> When the deleted node has two children, its replacement must be larger than everything in the left subtree and smaller than everything in the right. Exactly two values satisfy that: the **largest value in the left subtree** (the in-order predecessor) and the **smallest in the right** (the successor). Anything else breaks the invariant somewhere. Both choices work — this implementation uses the successor, found by walking left from the right child until you can't. Note that the successor has **no left child** by definition, which is what makes detaching it easy: it has at most one child to re-link.

> [!mistake] Forgetting the successor's own right child
> The subtle bug in case 3 is dropping whatever hung to the right of the successor. The successor can't have a left child, but it certainly can have a right one — and if `take_min` doesn't re-link it (`*link = node.right.take()`), that entire subtree silently vanishes from the tree. The symptom is a tree that stays *sorted* but loses elements, so a naive "is it still in order?" check passes. That's exactly why the stress test above compares against removals *and* checks ordering after each step; testing deletion on a handful of leaves proves almost nothing.

## The catch: balance

BSTs are O(log n) *only if balanced*. Insert already-sorted data (1, 2, 3, 4, 5) and each node becomes the right child of the last — the tree degenerates into a linked list of height `n`, and operations become O(n):

> [!warning] An unbalanced BST is just a slow linked list
> A plain BST makes no effort to stay balanced. Feed it sorted or nearly-sorted input and it degrades to a **height-`n` chain** — O(n) search, the worst case. This is a real trap: the "average O(log n)" assumes random insertion order. The fix is a **self-balancing** tree (AVL, red-black) that rebalances on every insert — the [next chapter](#/ch/dsa-balanced-trees). It's also why Rust's `BTreeMap` uses a (balanced) B-tree, not a plain BST.

Here is that degradation measured, with the *same values* inserted in two different orders:

```rust
type Link = Option<Box<Node>>;

struct Node {
    value: u32,
    left: Link,
    right: Link,
}

fn insert(link: &mut Link, v: u32) {
    match link {
        Some(n) => {
            if v < n.value {
                insert(&mut n.left, v)
            } else if v > n.value {
                insert(&mut n.right, v)
            }
        }
        None => *link = Some(Box::new(Node { value: v, left: None, right: None })),
    }
}

fn height(link: &Link) -> usize {
    match link {
        None => 0,
        Some(n) => 1 + height(&n.left).max(height(&n.right)),
    }
}

fn build(values: &[u32]) -> Link {
    let mut root = None;
    for &v in values {
        insert(&mut root, v);
    }
    root
}

fn main() {
    println!("{:>7} | {:>12} | {:>10} | {:>12} | {:>8}",
        "n", "sorted input", "shuffled", "ideal log2 n", "penalty");
    println!("{}", "-".repeat(62));

    // A deterministic shuffle, so this table is reproducible.
    let mut seed: u64 = 0x2545F4914F6CDD1D;
    for &n in &[15u32, 100, 1000, 5000] {
        let ascending: Vec<u32> = (0..n).collect();

        let mut shuffled = ascending.clone();
        for i in (1..shuffled.len()).rev() {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let j = (seed >> 33) as usize % (i + 1);
            shuffled.swap(i, j);
        }

        let h_sorted = height(&build(&ascending));
        let h_shuffled = height(&build(&shuffled));
        let ideal = (u32::BITS - n.leading_zeros()) as usize;

        println!("{:>7} | {:>12} | {:>10} | {:>12} | {:>7.0}x",
            n, h_sorted, h_shuffled, ideal, h_sorted as f64 / h_shuffled as f64);
    }

    println!("\nSorted input gives height exactly n — every node is a right child.");
    println!("Shuffled input stays within ~2x of log2(n), which is why the");
    println!("'average O(log n)' claim holds for random data and fails for sorted data.");
}
```

> [!performance] At n = 5000, sorted input is 179× worse
> The numbers are stark: 5,000 ascending values produce a tree of height **5,000**, while the same values shuffled give height **28** — against an ideal of 13. And the penalty *grows* with `n` (3× at 15 elements, 48× at 1,000, 179× at 5,000), because one side is `O(n)` and the other `O(log n)`.
>
> What makes this a genuine production hazard rather than a curiosity is how *ordinary* sorted input is. Records loaded from a database with `ORDER BY`, timestamps arriving in sequence, auto-incrementing IDs, keys read from an already-sorted file — all of them hit the worst case exactly. A plain BST is at its worst on the most common real-world input shape, which is the whole argument for self-balancing trees.

> [!deep] Why recursive insertion also overflows here
> There's a second failure hiding in that measurement. Building the height-5,000 tree works, but `height()` recurses once per level — and on a degenerate tree that's 5,000 frames deep. Push `n` to a few hundred thousand and the *measurement itself* aborts with a stack overflow before it can report the problem, exactly as in [Tree Algorithms](#/ch/dsa-tree-algorithms). Degenerate trees break recursive code in two ways at once: they're slow, and they're deep.

> [!best] In real Rust, reach for `BTreeMap`/`BTreeSet`
> You'll almost never hand-roll a BST for production — Rust's [`BTreeMap`/`BTreeSet`](#/ch/other-collections) give you a *guaranteed*-balanced, cache-efficient ordered structure with O(log n) operations and sorted iteration. Build a BST here to understand the ideas (the invariant, traversals, why balance matters); use `BTreeMap` when you actually need an ordered map.

## Summary

- A **binary tree** has nodes with up to two children (`Option<Box<Node>>` in Rust); a **BST** adds the invariant: **left subtree smaller, right subtree larger**.
- That invariant makes **search/insert** O(log n) in a balanced tree by discarding half the nodes at each step.
- Three **traversals**: **in-order** (sorted for a BST), **pre-order** (root first), **post-order** (children first). See [Tree Algorithms](#/ch/dsa-tree-algorithms) for all four in depth.
- **`min`/`max`** are just "walk left/right until you can't".
- **Deletion has three cases**: leaf (detach), one child (splice it up), two children (promote the **in-order successor** — the smallest value in the right subtree, which by definition has no left child).
- The successor's **own right child must be re-linked**, or a whole subtree vanishes while the tree still looks sorted.
- A BST is only O(log n) if **balanced**. Measured: 5,000 sorted inserts give height **5,000** vs **28** shuffled — a **179× penalty** that grows with `n`.
- Sorted input is the *common* real-world shape (`ORDER BY`, timestamps, auto-increment IDs), so a plain BST is at its worst on ordinary data. That's the case for **self-balancing trees**.
- Use **`BTreeMap`/`BTreeSet`** in real code; build a BST to learn the concepts.

> [!exercise] Try it yourself
> 1. Add `contains` using the iterative loop from the first example, then rewrite it recursively. Which reads better, and which is safer on a degenerate tree?
> 2. Change `remove_from` to promote the in-order **predecessor** (largest in the left subtree) instead of the successor. Confirm the stress test still passes.
> 3. Delete the `*link = node.right.take()` line from `take_min`, then run the stress test. It still reports "sorted" — how would you *detect* the missing elements?
> 4. Add `floor(x)` and `ceiling(x)`: the largest value ≤ x and the smallest ≥ x. Both are O(h) with no extra storage.
> 5. Add `range(lo, hi) -> Vec<i32>` returning every value in `[lo, hi]`, visiting only the nodes it must. Which subtrees can you skip entirely?
> 6. Add a `size` field maintained on insert and delete, then implement `select(k)` — the k-th smallest value — in O(h).
> 7. Insert 200,000 ascending values and call the recursive `height`. Explain the crash in terms of the previous chapter.
> 8. Write `is_valid_bst` that checks the invariant using range bounds, and use it in place of the sortedness check in the stress test. Which bugs does it catch that sortedness misses?

The fix for the balance problem is trees that rebalance themselves — **AVL and red-black trees**, next.
