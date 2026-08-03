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

## The catch: balance

BSTs are O(log n) *only if balanced*. Insert already-sorted data (1, 2, 3, 4, 5) and each node becomes the right child of the last — the tree degenerates into a linked list of height `n`, and operations become O(n):

> [!warning] An unbalanced BST is just a slow linked list
> A plain BST makes no effort to stay balanced. Feed it sorted or nearly-sorted input and it degrades to a **height-`n` chain** — O(n) search, the worst case. This is a real trap: the "average O(log n)" assumes random insertion order. The fix is a **self-balancing** tree (AVL, red-black) that rebalances on every insert — the [next chapter](#/ch/dsa-balanced-trees). It's also why Rust's `BTreeMap` uses a (balanced) B-tree, not a plain BST.

> [!best] In real Rust, reach for `BTreeMap`/`BTreeSet`
> You'll almost never hand-roll a BST for production — Rust's [`BTreeMap`/`BTreeSet`](#/ch/other-collections) give you a *guaranteed*-balanced, cache-efficient ordered structure with O(log n) operations and sorted iteration. Build a BST here to understand the ideas (the invariant, traversals, why balance matters); use `BTreeMap` when you actually need an ordered map.

## Summary

- A **binary tree** has nodes with up to two children (`Option<Box<Node>>` in Rust); a **BST** adds the invariant: **left subtree smaller, right subtree larger**.
- That invariant makes **search/insert** O(log n) in a balanced tree by discarding half the nodes at each step.
- Three **traversals**: **in-order** (sorted for a BST), **pre-order** (root first), **post-order** (children first).
- A BST is only O(log n) if **balanced** — sorted input degenerates it into an O(n) chain, motivating **self-balancing trees**.
- Use **`BTreeMap`/`BTreeSet`** in real code; build a BST to learn the concepts.

> [!exercise] Try it yourself
> 1. Add a `min(&self) -> Option<i32>` method (hint: follow `left` pointers all the way down).
> 2. Add a `height(&self) -> usize` method and observe how it grows for sorted vs. random insertion order.
> 3. Implement post-order traversal and explain why it's the safe order for freeing a tree.

The fix for the balance problem is trees that rebalance themselves — **AVL and red-black trees**, next.
