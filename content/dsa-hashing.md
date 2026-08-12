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

The table we built above has no resizing, so let's add it — along with `remove` and a load-factor readout, which turns that claim into something you can watch happen:

```rust
struct HashTable {
    buckets: Vec<Vec<(String, i32)>>,
    len: usize,
    resizes: usize, // instrumentation, so we can see how rarely this happens
}

impl HashTable {
    fn new() -> Self {
        HashTable { buckets: vec![Vec::new(); 8], len: 0, resizes: 0 }
    }

    /// Note this is an associated function taking the bucket count explicitly —
    /// during a resize we need to hash against the NEW size, not the old one.
    fn hash_of(key: &str, bucket_count: usize) -> usize {
        let mut h: u64 = 5381;
        for b in key.bytes() {
            h = h.wrapping_mul(33).wrapping_add(b as u64);
        }
        (h % bucket_count as u64) as usize
    }

    fn load_factor(&self) -> f64 {
        self.len as f64 / self.buckets.len() as f64
    }

    /// Double the bucket count and re-hash every entry.
    fn resize(&mut self) {
        let new_count = self.buckets.len() * 2;
        let mut new_buckets: Vec<Vec<(String, i32)>> = vec![Vec::new(); new_count];
        // `drain` moves the old entries out so nothing is cloned.
        for bucket in self.buckets.drain(..) {
            for (key, value) in bucket {
                let i = Self::hash_of(&key, new_count);
                new_buckets[i].push((key, value));
            }
        }
        self.buckets = new_buckets;
        self.resizes += 1;
    }

    fn insert(&mut self, key: &str, value: i32) {
        if self.load_factor() >= 0.75 {
            self.resize();
        }
        let i = Self::hash_of(key, self.buckets.len());
        for pair in self.buckets[i].iter_mut() {
            if pair.0 == key {
                pair.1 = value; // update, don't grow
                return;
            }
        }
        self.buckets[i].push((key.to_string(), value));
        self.len += 1;
    }

    fn get(&self, key: &str) -> Option<i32> {
        let i = Self::hash_of(key, self.buckets.len());
        self.buckets[i].iter().find(|p| p.0 == key).map(|p| p.1)
    }

    fn remove(&mut self, key: &str) -> Option<i32> {
        let i = Self::hash_of(key, self.buckets.len());
        let bucket = &mut self.buckets[i];
        let pos = bucket.iter().position(|p| p.0 == key)?;
        self.len -= 1;
        // Order within a bucket is meaningless, so swap_remove is O(1) here.
        Some(bucket.swap_remove(pos).1)
    }

    fn longest_bucket(&self) -> usize {
        self.buckets.iter().map(|b| b.len()).max().unwrap_or(0)
    }
}

fn main() {
    let mut table = HashTable::new();
    for i in 0..1000 {
        table.insert(&format!("key{i}"), i);
    }

    println!("entries       {}", table.len);
    println!("buckets       {}", table.buckets.len());
    println!("load factor   {:.2}", table.load_factor());
    println!("resizes       {}  (for 1000 inserts)", table.resizes);
    println!("longest chain {}  ← what keeps lookups fast", table.longest_bucket());

    println!("\nget(key500)    {:?}", table.get("key500"));
    println!("remove(key500) {:?}", table.remove("key500"));
    println!("get(key500)    {:?}", table.get("key500"));
    println!("entries now    {}", table.len);
}
```

> [!key] A resize **must** re-hash — it cannot just copy buckets across
> The bucket index is `hash(key) % bucket_count`, so changing the count changes where every key belongs. Copying bucket 3 of the old array into bucket 3 of the new one would leave entries where lookups will never search for them — the data is still in memory but permanently unreachable. That's why `resize` recomputes `hash_of(&key, new_count)` for every entry, and why the hash helper takes the size as a parameter rather than reading `self.buckets.len()`. Re-hashing is the expensive part of growth, and the reason `HashMap::with_capacity` is worth using when you know the size in advance.

> [!performance] 1000 inserts caused only 8 resizes
> That's the amortization working. Because each resize *doubles* the capacity, growth events get exponentially rarer — the table went 8 → 16 → 32 → … → 2048 buckets in 8 steps while absorbing a thousand inserts, and the longest chain stayed at **4**. The total re-hashing work across all resizes is bounded by roughly `2n`, exactly as with [`Vec` growth](#/ch/dsa-arrays). Note also the load factor ends at 0.49 rather than 0.75: doubling overshoots, trading some memory for headroom.

## The importance of a good hash function

> [!warning] A bad hash function ruins everything
> If your hash function maps many keys to the same bucket (e.g. `hash = 0` for everything, or only using the first character), all entries pile into one bucket and lookups become **O(n)** — you've built a slow list wearing a hash table's clothes. A good hash **spreads keys uniformly** across buckets. Rust's default hasher (SipHash) is also **DoS-resistant**: it's randomly seeded per-table so an attacker can't craft keys that all collide and grind your server to a halt.

You don't have to take that on faith. Here are four hash functions given the same 100 realistic keys, with the resulting bucket distribution printed:

```rust
const BUCKETS: usize = 16;

/// The polynomial hash from our table — mixes every byte.
fn djb2(key: &str) -> usize {
    let mut h: u64 = 5381;
    for b in key.bytes() {
        h = h.wrapping_mul(33).wrapping_add(b as u64);
    }
    (h % BUCKETS as u64) as usize
}

/// Looks reasonable. Is a disaster on keys that share a prefix.
fn first_byte(key: &str) -> usize {
    (key.bytes().next().unwrap_or(0) as usize) % BUCKETS
}

/// Cheap and fast. Also ignores the content entirely.
fn length_only(key: &str) -> usize {
    key.len() % BUCKETS
}

/// The pathological case, for reference.
fn constant(_key: &str) -> usize {
    0
}

fn distribution(name: &str, keys: &[String], hash: impl Fn(&str) -> usize) {
    let mut counts = vec![0usize; BUCKETS];
    for k in keys {
        counts[hash(k)] += 1;
    }
    let used = counts.iter().filter(|&&c| c > 0).count();
    let longest = *counts.iter().max().unwrap();
    let ideal = keys.len() as f64 / BUCKETS as f64;

    println!("{name:<12} buckets used {used:>2}/{BUCKETS}  longest chain {longest:>3}  (ideal {ideal:.1})");
    print!("{:<12} ", "");
    for c in &counts {
        print!("{}", match c {
            0 => '.',
            1..=9 => char::from_digit(*c as u32, 10).unwrap(),
            _ => '#',
        });
    }
    println!();
}

fn main() {
    let keys: Vec<String> = (0..100).map(|i| format!("user_{i}")).collect();
    println!("100 keys of the form user_0 … user_99, into {BUCKETS} buckets\n");

    distribution("djb2", &keys, djb2);
    distribution("first byte", &keys, first_byte);
    distribution("length only", &keys, length_only);
    distribution("always 0", &keys, constant);

    println!("\nlegend: '.' empty, digit = count, '#' = 10 or more");
}
```

> [!mistake] "Hash the first character" is the trap that looks sensible
> Of the three bad hashes above, `constant` is obviously broken and `length_only` nearly so — but `first_byte` is the one people genuinely write, and on this input it puts **all 100 keys into a single bucket**, because every key starts with `u`. Real keys are rarely uniformly distributed: they're `user_*`, `order_*`, `/api/v1/*`, or timestamps that share a prefix. A hash must mix **every** byte of the key, and it must mix them in a way that changes the *low* bits — those are the ones `% bucket_count` keeps. This is also why `djb2` multiplies by 33 before adding: the multiply propagates earlier bytes upward so later bytes can't simply overwrite them.

## Open addressing, and the tombstone problem

The figure above showed open addressing storing entries directly in the array. Implementing it reveals a subtlety that chaining never has to deal with — and it's the classic bug in hand-rolled hash tables:

```rust
#[derive(Clone)]
enum Slot {
    Empty,
    Occupied(String, i32),
    /// A slot whose entry was removed. Crucially NOT the same as Empty.
    Tombstone,
}

struct OpenTable {
    slots: Vec<Slot>,
    len: usize,
}

impl OpenTable {
    fn new(n: usize) -> Self {
        OpenTable { slots: vec![Slot::Empty; n], len: 0 }
    }

    fn hash(&self, key: &str) -> usize {
        let mut h: u64 = 5381;
        for b in key.bytes() {
            h = h.wrapping_mul(33).wrapping_add(b as u64);
        }
        (h % self.slots.len() as u64) as usize
    }

    fn insert(&mut self, key: &str, value: i32) {
        let mut i = self.hash(key);
        let mut first_tombstone: Option<usize> = None;

        for _ in 0..self.slots.len() {
            match &self.slots[i] {
                // Already present → update in place.
                Slot::Occupied(k, _) if k == key => {
                    self.slots[i] = Slot::Occupied(key.into(), value);
                    return;
                }
                // Remember the first reusable slot, but keep probing: the key
                // might already exist further along the chain.
                Slot::Tombstone => {
                    if first_tombstone.is_none() {
                        first_tombstone = Some(i);
                    }
                }
                // A true gap means the key isn't here; place it.
                Slot::Empty => {
                    let target = first_tombstone.unwrap_or(i);
                    self.slots[target] = Slot::Occupied(key.into(), value);
                    self.len += 1;
                    return;
                }
                _ => {} // occupied by someone else — keep going
            }
            i = (i + 1) % self.slots.len(); // linear probing
        }
        panic!("table full");
    }

    fn get(&self, key: &str) -> Option<i32> {
        let mut i = self.hash(key);
        for _ in 0..self.slots.len() {
            match &self.slots[i] {
                Slot::Occupied(k, v) if k == key => return Some(*v),
                Slot::Empty => return None, // a real gap ends the search
                _ => {}                     // other entry, or a tombstone: continue
            }
            i = (i + 1) % self.slots.len();
        }
        None
    }

    fn remove(&mut self, key: &str) -> Option<i32> {
        let mut i = self.hash(key);
        for _ in 0..self.slots.len() {
            match &self.slots[i] {
                Slot::Occupied(k, v) if k == key => {
                    let v = *v;
                    self.slots[i] = Slot::Tombstone; // NOT Empty — see below
                    self.len -= 1;
                    return Some(v);
                }
                Slot::Empty => return None,
                _ => {}
            }
            i = (i + 1) % self.slots.len();
        }
        None
    }

    fn layout(&self) -> Vec<String> {
        self.slots.iter().map(|s| match s {
            Slot::Empty => ".".to_string(),
            Slot::Tombstone => "†".to_string(),
            Slot::Occupied(k, _) => k.clone(),
        }).collect()
    }
}

fn main() {
    // A deliberately tiny table, to force a probe chain.
    let mut table = OpenTable::new(8);
    for (k, v) in [("cat", 1), ("act", 2), ("tac", 3), ("dog", 4)] {
        table.insert(k, v);
    }
    println!("{} entries: {:?}", table.len, table.layout());
    println!("cat, act and tac all collided — they form one probe chain.\n");

    println!("remove(act) → {:?}", table.remove("act"));
    println!("{:?}", table.layout());
    println!("† marks the tombstone, in the MIDDLE of the chain.\n");

    for k in ["cat", "tac", "dog"] {
        println!("  get({k}) = {:?}", table.get(k));
    }
    println!("  get(act) = {:?}   ← correctly gone", table.get("act"));
}
```

> [!warning] Removing by writing `Empty` silently loses live entries
> This is the bug worth remembering. In the run above, `cat`, `act`, and `tac` land in one probe chain. Delete `act` from the middle and write **`Empty`** there, and the search for `tac` walks to that gap, concludes "nothing further was ever placed here", and returns `None` — **for a key that is still in the table**. I verified exactly that: swapping `Tombstone` for `Empty` makes `get("tac")` return `None` while `cat` and `dog` still resolve, so your tests may well pass.
>
> A **tombstone** says "occupied once, so keep probing" without holding an entry, which preserves every chain that ran through the slot. The costs are real, though: tombstones accumulate, probe chains lengthen, and a table that sees heavy insert/remove churn needs periodic rehashing to clear them out. This is precisely the kind of detail that makes hand-rolled hash tables a bad idea in production, and `std::collections::HashMap` a good one.

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
- A resize **must re-hash every key**, because the index is `hash % bucket_count` — copying buckets across would make entries permanently unreachable.
- Doubling makes growth exponentially rare: **1,000 inserts caused 8 resizes**, and the longest chain stayed at 4.
- A **good hash function must mix every byte**. `first_byte` looks reasonable and puts all 100 `user_*` keys in one bucket — real keys share prefixes.
- With open addressing, **`remove` must write a tombstone, not `Empty`** — an `Empty` in the middle of a probe chain makes later keys unreachable while tests still pass.
- Rust's default hasher is uniform *and* **DoS-resistant** (randomly seeded per table).
- Build one to understand it; use **`HashMap`** (optionally a faster hasher) in real code.

> [!exercise] Try it yourself
> 1. Add a `contains_key` and an `iter()` to the chaining table. What order do entries come out in, and why can't you rely on it?
> 2. Change the resize threshold from 0.75 to 0.95 and re-run the 1,000-insert measurement. What happens to the longest chain, and how many resizes do you save?
> 3. Make `hash_of` return `0` always, then time `get` with 1,000 entries. Now fix it and explain the difference in terms of the load factor.
> 4. Add a fifth hash to the distribution comparison that sums the bytes *without* multiplying. Does it beat `first_byte`? Why is it still poor for anagram-like keys?
> 5. In `OpenTable`, replace `Tombstone` with `Empty` in `remove`, then look up every key. Which ones break, and can you predict which before running it?
> 6. Add resizing to `OpenTable`. Should tombstones be carried over or dropped during the rehash?
> 7. Implement **quadratic probing** (`i + 1², i + 2², …`) instead of linear. What problem does it reduce, and what new constraint does it place on the table size?
> 8. Write a `Hash` + `Eq` implementation for a custom struct, then deliberately make two equal values hash differently. Insert one, look up the other, and explain the result.

Hash tables are unordered. When you need keys *sorted* and fast, you need a tree — next, **binary search trees**.
