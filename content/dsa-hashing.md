<h1><span class="h1-kicker">Data Structures & Algorithms</span>Hash Tables from Scratch</h1>

You've *used* [`HashMap`](#/ch/hashmaps) — now let's understand it by building one. A **hash table** achieves near-magical O(1) average lookup by converting a key into an array index via a **hash function**. The subtleties — collisions, load factor, resizing — are what separate a toy from a real implementation. Building one demystifies the most important data structure in practical programming.

## The core idea

> [!key] Turn a key into an array index
> A hash table is really just an **array** plus a **hash function** that maps any key to an index in that array. To store `key → value`, compute `index = hash(key) % array_size` and put the pair there. To look it up, recompute the same index and read it. Since computing the hash and indexing are both O(1), lookups are **O(1) on average** — no scanning, regardless of how many items are stored. That's the whole trick.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A key is hashed to a number, reduced modulo the array size, and stored in that bucket">
  <style>
    .hgm { font: 600 11px var(--font-mono); fill: var(--text); }
    .hgc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .keyb { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .hashb { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .bkt { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .bktf { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="14" y="55" width="90" height="30" class="keyb"/><text x="24" y="75" class="hgm">"apple"</text>
  <rect x="140" y="55" width="120" height="30" class="hashb"/><text x="150" y="75" class="hgm">hash → 40213</text>
  <rect x="300" y="55" width="120" height="30" class="hashb"/><text x="310" y="75" class="hgm">% 8 → bucket 5</text>
  <g class="hgm">
    <rect x="470" y="14" width="150" height="20" class="bkt"/><text x="480" y="29">bucket 4</text>
    <rect x="470" y="36" width="150" height="20" class="bktf"/><text x="480" y="51">bucket 5 → apple:3</text>
    <rect x="470" y="58" width="150" height="20" class="bkt"/><text x="480" y="73">bucket 6</text>
  </g>
  <path d="M104 70 L138 70" stroke="var(--purple)" stroke-width="1.5" marker-end="url(#ahg)"/>
  <path d="M260 70 L298 70" stroke="var(--purple)" stroke-width="1.5" marker-end="url(#ahg)"/>
  <path d="M420 62 L468 48" stroke="var(--rust-500)" stroke-width="1.5" marker-end="url(#ahg2)"/>
  <text x="14" y="120" class="hgc">hash(key) → big number → mod array size → the bucket where the pair lives.</text>
  <defs>
    <marker id="ahg" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--purple)"/></marker>
    <marker id="ahg2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>Hash the key to a number, reduce it modulo the array size, and that's the bucket.</figcaption>
</figure>

## Collisions: the central problem

Two different keys can hash to the *same* index — a **collision**. Since we can't avoid them (many keys, few slots), we must *handle* them. The most common strategy is **chaining**: each array slot holds a small list of all pairs that landed there. Let's build a hash table using chaining:

```rust
struct HashTable {
    buckets: Vec<Vec<(String, i32)>>, // each bucket is a list of (key, value) pairs
}

impl HashTable {
    fn new(size: usize) -> Self {
        HashTable { buckets: vec![Vec::new(); size] }
    }

    // A simple string hash (the classic "djb2"-style polynomial hash).
    fn hash(&self, key: &str) -> usize {
        let mut h: usize = 5381;
        for b in key.bytes() {
            h = h.wrapping_mul(33).wrapping_add(b as usize);
        }
        h % self.buckets.len() // reduce to a valid bucket index
    }

    fn insert(&mut self, key: &str, value: i32) {
        let idx = self.hash(key);
        let bucket = &mut self.buckets[idx];
        // If the key already exists in this bucket, update it:
        for pair in bucket.iter_mut() {
            if pair.0 == key {
                pair.1 = value;
                return;
            }
        }
        bucket.push((key.to_string(), value)); // otherwise append
    }

    fn get(&self, key: &str) -> Option<i32> {
        let idx = self.hash(key);
        // Scan only this one small bucket, not the whole table:
        self.buckets[idx].iter().find(|p| p.0 == key).map(|p| p.1)
    }
}

fn main() {
    let mut table = HashTable::new(8);
    table.insert("apple", 3);
    table.insert("banana", 5);
    table.insert("apple", 7); // updates the existing key

    println!("apple  = {:?}", table.get("apple"));  // Some(7)
    println!("banana = {:?}", table.get("banana")); // Some(5)
    println!("cherry = {:?}", table.get("cherry")); // None
}
```

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="Chaining stores a linked list of entries in each bucket; open addressing stores entries directly in the array, probing to the next slot on a collision">
  <style>
    .co-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .co-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .co-h { font: 700 12px var(--font-sans); }
    .slot { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .ent  { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .clash{ fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <text x="14" y="20" class="co-h" fill="var(--blue)">Chaining — each bucket holds a list</text>
  <rect x="14" y="30" width="40" height="26" class="slot"/><text x="26" y="48" class="co-b">0</text>
  <rect x="14" y="58" width="40" height="26" class="slot"/><text x="26" y="76" class="co-b">1</text>
  <rect x="14" y="86" width="40" height="26" class="slot"/><text x="26" y="104" class="co-b">2</text>
  <rect x="70" y="58" width="70" height="26" class="ent"/><text x="82" y="76" class="co-b">"cat"</text>
  <rect x="150" y="58" width="70" height="26" class="clash"/><text x="162" y="76" class="co-b">"act"</text>
  <path d="M54 71 L68 71" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#coa)"/>
  <path d="M140 71 L148 71" stroke="var(--text-mute)" stroke-width="1.2" marker-end="url(#coa)"/>
  <text x="70" y="104" class="co-c">collisions append to the bucket's list</text>
  <text x="360" y="20" class="co-h" fill="var(--rust-600)">Open addressing — probe to next slot</text>
  <rect x="360" y="30" width="90" height="26" class="slot"/><text x="372" y="48" class="co-b">0 · empty</text>
  <rect x="360" y="58" width="90" height="26" class="ent"/><text x="372" y="76" class="co-b">1 · "cat"</text>
  <rect x="360" y="86" width="90" height="26" class="clash"/><text x="372" y="104" class="co-b">2 · "act"</text>
  <text x="460" y="76" class="co-c">"act" wanted slot 1 (taken) →</text>
  <text x="460" y="104" class="co-c">probes forward to slot 2</text>
  <defs><marker id="coa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Two collision strategies: <b>chaining</b> keeps a list per bucket; <b>open addressing</b> stores everything in the array and probes to the next free slot.</figcaption>
</figure>

> [!jargon] Chaining vs. open addressing
> Two ways to resolve collisions: **chaining** (each slot holds a list of colliding entries — what we built, and what most languages use) and **open addressing** (on a collision, probe for the *next* empty slot in the array itself). Chaining is simpler and degrades gracefully; open addressing is more cache-friendly and is what Rust's real `HashMap` uses (a variant called SwissTable). Both give O(1) average when collisions are rare.

## Load factor: keeping it fast

Collisions get more frequent as the table fills up. The **load factor** = (number of entries) / (number of buckets) measures how full it is. When it gets too high, buckets grow long and lookups drift toward O(n). The fix: **resize** (allocate a bigger array and re-hash everything) when the load factor exceeds a threshold (~0.7–0.9):

> [!key] Why hash tables stay O(1): resizing
> A hash table keeps its O(1) average performance by **growing** before it gets crowded. When the load factor crosses a threshold, it doubles the bucket count and re-inserts every entry (an O(n) operation, but rare — amortized O(1) per insert, just like [`Vec` growth](#/ch/dsa-arrays)). This keeps buckets short. If a table *never* resized, it would eventually degrade to a slow linear scan. Resizing is what makes the "O(1)" promise hold as data grows.

## The importance of a good hash function

> [!warning] A bad hash function ruins everything
> If your hash function maps many keys to the same bucket (e.g. `hash = 0` for everything, or only using the first character), all entries pile into one bucket and lookups become **O(n)** — you've built a slow list wearing a hash table's clothes. A good hash **spreads keys uniformly** across buckets. Rust's default hasher (SipHash) is also **DoS-resistant**: it's randomly seeded per-table so an attacker can't craft keys that all collide and grind your server to a halt.

## Performance summary

| Operation | Average | Worst (bad hash / all collide) |
|-----------|---------|-------------------------------|
| insert | O(1) | O(n) |
| get | O(1) | O(n) |
| remove | O(1) | O(n) |

> [!best] Build one to learn; use `HashMap` to ship
> Our from-scratch table teaches the mechanics, but Rust's [`std::collections::HashMap`](#/ch/hashmaps) is a highly optimized, DoS-resistant SwissTable — always use it in real code. For extra speed with trusted keys, swap in a faster hasher (`ahash`, `fxhash`) via `HashMap`'s hasher parameter. Understanding buckets, collisions, load factor, and resizing helps you *use* `HashMap` well — like knowing when `with_capacity` avoids resizes in a hot loop.

## Summary

- A **hash table** = an **array** + a **hash function** mapping keys to bucket indices, giving **O(1) average** lookup.
- **Collisions** (different keys, same bucket) are inevitable; resolve them with **chaining** (a list per bucket) or **open addressing** (probe for a free slot — what Rust uses).
- The **load factor** (entries ÷ buckets) drives performance; tables **resize** (double + re-hash, amortized O(1)) to keep buckets short and stay O(1).
- A **good hash function** spreads keys uniformly; a bad one degrades everything to O(n). Rust's default is uniform *and* DoS-resistant.
- Build one to understand it; use **`HashMap`** (optionally a faster hasher) in real code.

> [!exercise] Try it yourself
> 1. Add a `remove(&mut self, key: &str)` method to the `HashTable` that deletes a key from its bucket.
> 2. Add a `len` method and print the load factor after several inserts.
> 3. Deliberately make `hash` always return `0` and observe how `get` degrades — then fix it and explain why.

Hash tables are unordered. When you need keys *sorted* and fast, you need a tree — next, **binary search trees**.
