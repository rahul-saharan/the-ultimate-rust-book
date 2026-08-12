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
| remove | O(L) | plus pruning on the way back up |
| count with prefix | **O(prefix length)** | with a maintained `passing` counter |
| count with prefix | O(subtree size) | without one |
| longest prefix of a string | O(L) | stop at the deepest `end` you passed |
| collect all with prefix | O(subtree size) | unavoidable — you're producing every result |

Crucially, operations depend on **word length**, not the **number of words** — a trie with a million words looks up just as fast as one with ten.

## Counting with a prefix in O(L), not O(subtree)

`autocomplete` has to walk the whole subtree, which is unavoidable when you want every word. But if you only need the *count*, you can maintain it during insertion — one extra field turns an O(subtree) query into O(prefix length):

```rust
use std::collections::HashMap;

#[derive(Default)]
struct Node {
    children: HashMap<char, Node>,
    end: bool,
    /// How many stored words pass through this node.
    passing: u32,
}

#[derive(Default)]
struct Trie {
    root: Node,
}

impl Trie {
    fn insert(&mut self, word: &str) {
        let mut node = &mut self.root;
        node.passing += 1;
        for ch in word.chars() {
            node = node.children.entry(ch).or_default();
            node.passing += 1;
        }
        node.end = true;
    }

    fn walk(&self, s: &str) -> Option<&Node> {
        let mut node = &self.root;
        for ch in s.chars() {
            node = node.children.get(&ch)?;
        }
        Some(node)
    }

    fn contains(&self, word: &str) -> bool {
        self.walk(word).is_some_and(|n| n.end)
    }

    /// O(prefix length) — no subtree traversal at all.
    fn count_with_prefix(&self, prefix: &str) -> u32 {
        self.walk(prefix).map_or(0, |n| n.passing)
    }

    /// The longest stored word that is a prefix of `text`.
    /// This is the operation IP routing tables are built for.
    fn longest_prefix_of(&self, text: &str) -> Option<String> {
        let mut node = &self.root;
        let mut best = None;
        let mut built = String::new();
        for ch in text.chars() {
            match node.children.get(&ch) {
                Some(next) => {
                    node = next;
                    built.push(ch);
                    if node.end {
                        best = Some(built.clone()); // remember the deepest match
                    }
                }
                None => break,
            }
        }
        best
    }

    fn node_count(&self) -> usize {
        fn count(n: &Node) -> usize {
            1 + n.children.values().map(count).sum::<usize>()
        }
        count(&self.root)
    }

    /// Remove a word, pruning nodes that no longer lead to anything.
    fn remove(&mut self, word: &str) -> bool {
        if !self.contains(word) {
            return false; // nothing to do — and don't corrupt the counters
        }
        self.root.passing -= 1;
        let chars: Vec<char> = word.chars().collect();
        Self::prune(&mut self.root, &chars, 0);
        true
    }

    /// Returns true if this node has become removable (no children, not a word).
    fn prune(node: &mut Node, chars: &[char], depth: usize) -> bool {
        if depth == chars.len() {
            node.end = false; // the word stops being a word
            return node.children.is_empty();
        }
        let ch = chars[depth];
        let child_removable = {
            let child = node.children.get_mut(&ch).expect("verified by contains");
            child.passing -= 1;
            Self::prune(child, chars, depth + 1)
        };
        if child_removable {
            node.children.remove(&ch);
        }
        node.children.is_empty() && !node.end
    }
}

fn main() {
    let mut trie = Trie::default();
    for w in ["car", "card", "care", "cat", "dog"] {
        trie.insert(w);
    }
    println!("nodes                {}", trie.node_count());
    println!("count_with_prefix ca  {}", trie.count_with_prefix("ca"));
    println!("count_with_prefix car {}", trie.count_with_prefix("car"));
    println!("count_with_prefix z   {}", trie.count_with_prefix("z"));

    println!("\nlongest_prefix_of(\"cardiff\") {:?}", trie.longest_prefix_of("cardiff"));
    println!("longest_prefix_of(\"catalog\") {:?}", trie.longest_prefix_of("catalog"));
    println!("longest_prefix_of(\"zebra\")   {:?}", trie.longest_prefix_of("zebra"));

    println!("\nremove(\"card\") {}", trie.remove("card"));
    println!("  card {} · car {} · care {}", trie.contains("card"), trie.contains("car"), trie.contains("care"));
    println!("  count ca is now {}", trie.count_with_prefix("ca"));
    println!("  nodes {}  (the 'd' node was pruned)", trie.node_count());

    println!("remove(\"dog\")  {}", trie.remove("dog"));
    println!("  nodes {}  (the whole d-o-g chain went)", trie.node_count());
    println!("remove(\"nope\") {}", trie.remove("nope"));
}
```

> [!key] Deletion means pruning, and pruning must happen on the way back up
> Removing a word is not simply clearing its `end` flag — that leaks nodes, and a long deleted word leaves a long dead chain behind. You must also delete every node that is now useless: no children **and** not the end of some other word. That test can only be applied *after* recursing, which is why `prune` returns a `bool` upward and the parent does the removal. Removing `card` deletes exactly one node (`d`) because `car` still needs the rest; removing `dog` deletes three, because nothing else shares that path.

> [!mistake] Decrementing counters before checking the word exists
> Notice `remove` calls `contains` **first** and bails out early. Skip that check and a call like `remove("nope")` walks partway down, decrements `passing` on every node it touches, and then discovers the word was never there — leaving the counters permanently wrong, with no error and no crash. Prefix counts silently drift below the truth. Any structure with maintained aggregate fields has this hazard: **validate before you mutate**, because a half-applied update is worse than a rejected one.

## Choosing the node representation

The `HashMap<char, Node>` version handles any alphabet, but it hashes on every character step. For a known small alphabet you can index directly instead:

```rust
use std::collections::HashMap;
use std::mem::size_of;

#[derive(Default)]
struct MapNode {
    children: HashMap<char, MapNode>,
    end: bool,
}

/// Fixed-array node for a lowercase-ASCII alphabet: no hashing at all,
/// just one array index per character.
struct ArrayNode {
    children: [Option<Box<ArrayNode>>; 26],
    end: bool,
}

impl Default for ArrayNode {
    fn default() -> Self {
        ArrayNode { children: Default::default(), end: false }
    }
}

impl ArrayNode {
    fn index(ch: char) -> Option<usize> {
        ch.is_ascii_lowercase().then(|| (ch as u8 - b'a') as usize)
    }

    fn insert(&mut self, word: &str) {
        let mut node = self;
        for ch in word.chars() {
            let Some(i) = Self::index(ch) else { return }; // outside the alphabet
            node = node.children[i].get_or_insert_with(Default::default);
        }
        node.end = true;
    }

    fn contains(&self, word: &str) -> bool {
        let mut node = self;
        for ch in word.chars() {
            let Some(i) = Self::index(ch) else { return false };
            match &node.children[i] {
                Some(next) => node = next,
                None => return false,
            }
        }
        node.end
    }
}

fn main() {
    println!("size of one node:");
    println!("  HashMap node  {:>4} bytes  (+ a heap allocation for the table)", size_of::<MapNode>());
    println!("  array node    {:>4} bytes  (26 inline pointers, no table)", size_of::<ArrayNode>());
    println!("  Option<Box<T>> is {} bytes — the null-pointer niche at work",
        size_of::<Option<Box<ArrayNode>>>());

    let mut trie = ArrayNode::default();
    for w in ["car", "card", "care", "cat", "dog", "do", "a"] {
        trie.insert(w);
    }
    for w in ["car", "card", "ca", "do", "a", "zzz"] {
        println!("  contains({w:>4}) = {}", trie.contains(w));
    }
    println!("\nout-of-alphabet input is simply rejected: contains(\"Car\") = {}",
        trie.contains("Car"));
}
```

> [!performance] The array node is *faster* but **bigger**, not denser
> It's tempting to assume the array version saves memory by avoiding a `HashMap`. Measured, it's the opposite: a `MapNode` is **56 bytes** and an `ArrayNode` is **216** — 26 pointers held inline whether or not they're used. For English words most nodes have one or two children, so the array version wastes roughly 190 bytes per node.
>
> What it buys is **speed and locality**: a character step is one array index instead of a hash computation plus a probe, and the children live inside the node rather than in a separate heap table. So the real trade is *time for space*, and it only becomes a space win when nodes are genuinely dense — DNA sequences over `ACGT` (4 pointers), or binary tries over bits (2). For a sparse alphabet, keep the `HashMap`, or use a small sorted `Vec<(char, Node)>` which is compact *and* cache-friendly at these sizes.

> [!performance] Tries trade memory for prefix speed
> A trie can use more memory than a `HashSet` — many nodes, each with a `HashMap` of children. Optimizations exist: use a fixed `[Option<Box<Node>>; 26]` array for a small known alphabet (see above), or a **radix trie** that compresses chains of single-child nodes into one edge — which is what makes deleted-word chains and long shared suffixes cheap. For most uses, the `HashMap`-per-node version shown here is simple and plenty fast. Reach for a trie specifically when **prefix operations** matter; otherwise a `HashSet`/`HashMap` is lighter.

> [!tip] Real-world tries
> Tries (and their compressed cousins) power: **autocomplete** and search suggestions, **spell-checkers** (find words within an edit distance), **IP routing tables** (longest-prefix match on address bits), and **T9/predictive text**. When you see "match by prefix" at scale, think trie. Crates like `fst` and `radix_trie` provide production-grade implementations.

## Summary

- A **trie** stores strings as paths of character-nodes; **shared prefixes share nodes**, and an `is_end_of_word` flag marks complete words.
- Build it with a `HashMap<char, TrieNode>` per node and the **entry API** for clean insertion.
- Operations cost **O(word/prefix length)**, *independent of the number of words stored*.
- Its killer feature over a `HashSet` is **prefix queries** — autocomplete, spell-check, IP routing — which a hash set can't do efficiently.
- **Deletion means pruning**: clear the `end` flag, then remove every node left with no children and no word ending on it. That test only works *after* recursing, so `prune` reports upward and the parent deletes.
- **Validate before mutating.** `remove` must confirm the word exists first, or a missing word silently corrupts the maintained counters.
- A **`passing` counter** per node turns "how many words start with this?" from O(subtree) into **O(prefix length)**.
- **`longest_prefix_of`** — remember the deepest `end` you walked past — is the IP-routing and word-segmentation primitive.
- The fixed-array node is **faster but larger**: measured at **216 bytes vs 56** for the `HashMap` version. It's a space win only for genuinely dense alphabets (`ACGT`, bits), not sparse English.
- Tries trade memory for prefix speed; optimize with a small sorted `Vec` of children, or a radix/compressed trie, when needed.

> [!exercise] Try it yourself
> 1. Add `all_with_prefix` to the counting trie so it returns both the completions and the count, walking the subtree only once.
> 2. Delete the `if !self.contains(word) { return false; }` guard from `remove`, then call `remove("nope")` and print `count_with_prefix("n")`. Explain the corruption.
> 3. Explain why a `HashSet<String>` can't answer "words starting with `ca`" without scanning everything.
> 4. Use `longest_prefix_of` to split `"catdogcar"` into stored words, greedily left to right. Where does a greedy split fail, and what would you need instead?
> 5. Change `ArrayNode` to hold 4 slots for `A`, `C`, `G`, `T`. Compare `size_of` against the `HashMap` node — which wins now?
> 6. Replace the `HashMap` children with a `Vec<(char, Node)>` kept sorted, using binary search to descend. Measure `size_of` and reason about when this beats both other options.
> 7. Add `remove` to the array-based trie. Which part is easier than the `HashMap` version, and which is harder?
> 8. Store a *value* per word (making it a map, not a set) and implement `get`/`insert` with `Option<V>` on each node. What changes in `prune`?

Next, a structure for tracking connected groups with near-constant-time operations — **union-find**.
