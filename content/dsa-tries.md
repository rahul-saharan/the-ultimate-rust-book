<h1><span class="h1-kicker">Data Structures & Algorithms</span>Tries & Prefix Trees</h1>

A **trie** (pronounced "try", from re*trie*val) is a tree specialized for storing strings by their characters. Each path from the root spells out a word, and shared prefixes share nodes. This makes tries brilliant at **prefix queries** — autocomplete, spell-checkers, IP routing, dictionaries — where you ask "what words start with `ca`?" This chapter builds one in Rust.

## The idea: share prefixes

In a trie, each **node** represents a character, and following a path spells a string. Words with common prefixes share the same early nodes — so `cat`, `car`, and `card` all share the `c → a` path, branching only where they differ:

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="A trie storing cat, car, card, and dog, sharing the ca prefix among the first three">
  <style>
    .trm3 { font: 600 12px var(--font-mono); fill: #fff; }
    .trc3 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tnode { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.5; }
    .tend { fill: var(--green); stroke: var(--green); stroke-width: 2; }
  </style>
  <circle cx="300" cy="25" r="14" class="tnode"/><text x="294" y="30" class="trm3">•</text>
  <circle cx="220" cy="70" r="14" class="tnode"/><text x="215" y="75" class="trm3">c</text>
  <circle cx="440" cy="70" r="14" class="tnode"/><text x="435" y="75" class="trm3">d</text>
  <circle cx="220" cy="110" r="14" class="tnode"/><text x="215" y="115" class="trm3">a</text>
  <circle cx="480" cy="110" r="14" class="tnode"/><text x="475" y="115" class="trm3">o</text>
  <circle cx="170" cy="155" r="14" class="tend"/><text x="165" y="160" class="trm3">t</text>
  <circle cx="270" cy="155" r="14" class="tend"/><text x="265" y="160" class="trm3">r</text>
  <circle cx="520" cy="155" r="14" class="tend"/><text x="515" y="160" class="trm3">g</text>
  <circle cx="320" cy="180" r="10" class="tend"/><text x="316" y="184" class="trm3" font-size="9">d</text>
  <line x1="300" y1="25" x2="220" y2="70" stroke="var(--text-mute)"/><line x1="300" y1="25" x2="440" y2="70" stroke="var(--text-mute)"/>
  <line x1="220" y1="70" x2="220" y2="110" stroke="var(--text-mute)"/><line x1="440" y1="70" x2="480" y2="110" stroke="var(--text-mute)"/>
  <line x1="220" y1="110" x2="170" y2="155" stroke="var(--text-mute)"/><line x1="220" y1="110" x2="270" y2="155" stroke="var(--text-mute)"/>
  <line x1="480" y1="110" x2="520" y2="155" stroke="var(--text-mute)"/><line x1="270" y1="155" x2="320" y2="180" stroke="var(--text-mute)"/>
  <text x="20" y="120" class="trc3">green = end of a word</text>
  <text x="20" y="140" class="trc3">"cat","car","card"</text>
  <text x="20" y="156" class="trc3">share the c→a path</text>
</svg>
<figcaption>A trie: shared prefixes share nodes; a "word ends here" flag marks complete words (green).</figcaption>
</figure>

## Building a trie

Each node holds a map from character to child node, plus a flag marking whether a word *ends* at this node (so we can tell `car` from the prefix of `card`):

```rust
use std::collections::HashMap;

#[derive(Default)]
struct TrieNode {
    children: HashMap<char, TrieNode>,
    is_end_of_word: bool,
}

struct Trie {
    root: TrieNode,
}

impl Trie {
    fn new() -> Self {
        Trie { root: TrieNode::default() }
    }

    // Insert a word, character by character. O(word length).
    fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        for ch in word.chars() {
            // Walk down, creating nodes as needed (entry API!):
            node = node.children.entry(ch).or_default();
        }
        node.is_end_of_word = true; // mark the final node
    }

    // Is `word` a complete stored word?
    fn contains(&self, word: &str) -> bool {
        self.find(word).map_or(false, |node| node.is_end_of_word)
    }

    // Does any stored word start with `prefix`?
    fn starts_with(&self, prefix: &str) -> bool {
        self.find(prefix).is_some()
    }

    // Walk to the node at the end of `s`, if it exists.
    fn find(&self, s: &str) -> Option<&TrieNode> {
        let mut node = &self.root;
        for ch in s.chars() {
            node = node.children.get(&ch)?; // ? returns None if the path breaks
        }
        Some(node)
    }
}

fn main() {
    let mut trie = Trie::new();
    for word in ["cat", "car", "card", "dog"] {
        trie.insert(word);
    }

    println!("contains 'car':    {}", trie.contains("car"));   // true
    println!("contains 'ca':     {}", trie.contains("ca"));     // false (not a full word)
    println!("starts_with 'ca':  {}", trie.starts_with("ca"));  // true
    println!("starts_with 'xyz': {}", trie.starts_with("xyz")); // false
}
```

Notice the [entry API](#/ch/hashmaps) (`entry(ch).or_default()`) — "get this child, creating it if absent" — makes insertion clean.

## Why a trie beats a HashSet for prefixes

You *could* store words in a `HashSet<String>`. So why a trie?

> [!key] The trie's superpower: prefix queries
> A `HashSet` answers "is this exact word present?" in O(word length) — same as a trie. But it *cannot* efficiently answer "how many words start with `ca`?" or "give me all completions of `ca`" — you'd have to scan every word. A trie answers prefix queries by **walking to the prefix node** (O(prefix length)) and exploring only its subtree. That's why autocomplete, spell-check suggestions, and dictionary features are built on tries, not hash sets.

### Autocomplete in action

Here's the payoff — collecting *every* word under a prefix: walk to the prefix node once, then depth-first gather the words in its subtree. This is exactly how a search box suggests completions as you type:

```rust
use std::collections::HashMap;

#[derive(Default)]
struct TrieNode { children: HashMap<char, TrieNode>, end: bool }

#[derive(Default)]
struct Trie { root: TrieNode }

impl Trie {
    fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        for ch in word.chars() {
            node = node.children.entry(ch).or_default();
        }
        node.end = true;
    }

    // Every stored word beginning with `prefix`, sorted.
    fn autocomplete(&self, prefix: &str) -> Vec<String> {
        // 1. Walk to the node where the prefix ends.
        let mut node = &self.root;
        for ch in prefix.chars() {
            match node.children.get(&ch) {
                Some(next) => node = next,
                None => return vec![], // nothing has this prefix
            }
        }
        // 2. DFS the subtree, collecting complete words.
        let mut out = Vec::new();
        collect(node, &mut prefix.to_string(), &mut out);
        out.sort();
        out
    }
}

fn collect(node: &TrieNode, path: &mut String, out: &mut Vec<String>) {
    if node.end {
        out.push(path.clone()); // this path spells a stored word
    }
    for (&ch, child) in &node.children {
        path.push(ch);          // choose
        collect(child, path, out);
        path.pop();             // un-choose (backtrack)
    }
}

fn main() {
    let mut trie = Trie::default();
    for w in ["car", "card", "care", "cat", "dog"] {
        trie.insert(w);
    }
    println!("{:?}", trie.autocomplete("car")); // ["car", "card", "care"]
    println!("{:?}", trie.autocomplete("ca"));  // ["car", "card", "care", "cat"]
    println!("{:?}", trie.autocomplete("xyz")); // []
}
```

Notice the backtracking rhythm (`push` → recurse → `pop`) from the [patterns chapter](#/ch/dsa-patterns) — a trie walk *is* a tree DFS.

## Complexity

| Operation | Cost | (n = number of words, L = word length) |
|-----------|------|------|
| insert | O(L) | independent of how many words are stored |
| contains | O(L) | |
| starts_with | O(prefix length) | |
| collect all with prefix | O(subtree size) | walk the prefix's subtree |

Crucially, operations depend on **word length**, not the **number of words** — a trie with a million words looks up just as fast as one with ten.

> [!performance] Tries trade memory for prefix speed
> A trie can use more memory than a `HashSet` — many nodes, each with a `HashMap` of children. Optimizations exist: use a fixed `[Option<Box<Node>>; 26]` array for lowercase-only alphabets (faster, denser), or a **radix trie** (compress chains of single-child nodes into one). For most uses, the `HashMap`-per-node version shown here is simple and plenty fast. Reach for a trie specifically when **prefix operations** matter; otherwise a `HashSet`/`HashMap` is lighter.

> [!tip] Real-world tries
> Tries (and their compressed cousins) power: **autocomplete** and search suggestions, **spell-checkers** (find words within an edit distance), **IP routing tables** (longest-prefix match on address bits), and **T9/predictive text**. When you see "match by prefix" at scale, think trie. Crates like `fst` and `radix_trie` provide production-grade implementations.

## Summary

- A **trie** stores strings as paths of character-nodes; **shared prefixes share nodes**, and an `is_end_of_word` flag marks complete words.
- Build it with a `HashMap<char, TrieNode>` per node and the **entry API** for clean insertion.
- Operations cost **O(word/prefix length)**, *independent of the number of words stored*.
- Its killer feature over a `HashSet` is **prefix queries** — autocomplete, spell-check, IP routing — which a hash set can't do efficiently.
- Tries trade memory for prefix speed; optimize with fixed-array children or a radix/compressed trie when needed.

> [!exercise] Try it yourself
> 1. Add a `count_words_with_prefix(&self, prefix: &str) -> usize` that walks the prefix's subtree counting `is_end_of_word` nodes.
> 2. Add an `all_with_prefix(&self, prefix: &str) -> Vec<String>` returning every completion (DFS from the prefix node, building strings).
> 3. Explain why a `HashSet<String>` can't answer "words starting with `ca`" without scanning everything.

Next, a structure for tracking connected groups with near-constant-time operations — **union-find**.
