<h1><span class="h1-kicker">Common Collections</span>Hash Maps</h1>

A **hash map** stores data as **key–value pairs**: you look things up by a *key* instead of by a numeric position. "What's the score for team Blue?" "What's the price of this product ID?" "How many times does this word appear?" Whenever you think *"I want to associate X with Y and look it up fast,"* you want a `HashMap<K, V>`.

## Creating and inserting

`HashMap` isn't in the automatic prelude, so you bring it into scope with a `use` line first:

```rust
use std::collections::HashMap;

fn main() {
    let mut scores = HashMap::new();
    scores.insert(String::from("Blue"), 10);
    scores.insert(String::from("Yellow"), 50);

    println!("{scores:?}"); // order is not guaranteed!
}
```

Here `K` (the key type) is `String` and `V` (the value type) is `i32`. Rust infers both from your first `insert`.

> [!jargon] Key and value
> A **key** is what you look up by (a team name, an ID, a word). A **value** is the data stored under that key (a score, a price, a count). Keys are unique — inserting with a key that already exists **replaces** the old value.

## Looking things up with `get`

`get` returns an **`Option`**, because the key might not be present. This is the same "no null" safety you saw with `Option` — you can't forget the missing case:

```rust
use std::collections::HashMap;

fn main() {
    let mut scores = HashMap::new();
    scores.insert(String::from("Blue"), 10);

    // get returns Option<&V>
    match scores.get("Blue") {
        Some(score) => println!("Blue's score is {score}"),
        None => println!("Blue hasn't played yet"),
    }

    // A common one-liner: copy the value out, or use a default.
    let yellow = scores.get("Yellow").copied().unwrap_or(0);
    println!("Yellow's score is {yellow}"); // 0 (absent → default)
}
```

## Iterating

Loop over a hash map with a `for` loop, destructuring each pair into key and value:

```rust
use std::collections::HashMap;

fn main() {
    let mut prices = HashMap::new();
    prices.insert("apple", 3);
    prices.insert("banana", 2);
    prices.insert("cherry", 8);

    for (item, price) in &prices {
        println!("{item}: ${price}");
    }
}
```

> [!warning] Hash map order is intentionally random
> If you run the loop above twice, the items may print in **different orders**. `HashMap` gives no ordering guarantee — and it even randomizes iteration order per run to protect against a class of denial-of-service attacks. **Never rely on the order.** If you need keys sorted, use a `BTreeMap` (covered [next chapter](#/ch/other-collections)) or collect the keys into a `Vec` and sort them.

## How a hash map actually works

The name gives it away. When you insert a key, the map runs it through a **hash function** — a routine that turns the key into a number — and uses that number to decide which "bucket" (storage slot) the pair goes into. Looking up a key repeats the calculation and jumps straight to the right bucket, which is why lookups are, on average, **O(1)** (constant time — it doesn't matter whether the map holds ten items or ten million).

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="A key is hashed to a number that selects a bucket where the value is stored">
  <style>
    .hm { font: 600 12px var(--font-mono); fill: var(--text); }
    .hc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .keyb { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .hashb { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .bkt { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .bktf { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="80" width="100" height="34" class="keyb"/><text x="34" y="102" class="hm">"Blue"</text>
  <rect x="170" y="80" width="120" height="34" class="hashb"/><text x="184" y="102" class="hm">hash → 8213…</text>
  <path d="M122 97 L168 97" stroke="var(--purple)" stroke-width="2" marker-end="url(#ah)"/>
  <text x="180" y="132" class="hc">mod (number of buckets)</text>
  <g class="hm">
    <rect x="360" y="20" width="180" height="30" class="bkt"/><text x="372" y="40">bucket 0</text>
    <rect x="360" y="52" width="180" height="30" class="bkt"/><text x="372" y="72">bucket 1</text>
    <rect x="360" y="84" width="180" height="30" class="bktf"/><text x="372" y="104">bucket 2 → ("Blue", 10)</text>
    <rect x="360" y="116" width="180" height="30" class="bkt"/><text x="372" y="136">bucket 3</text>
  </g>
  <path d="M292 97 L358 99" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#ah)"/>
  <text x="20" y="175" class="hc">Same key → same hash → same bucket, every time. That's why lookups are ~O(1).</text>
  <defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>Keys are hashed to select a bucket, giving fast average-case insertion and lookup.</figcaption>
</figure>

> [!note] What can be a key?
> Any type that implements the `Hash` and `Eq` traits — which includes all the basics: integers, `String`, `&str`, `bool`, `char`, and tuples of those. Your own structs can be keys too; just add `#[derive(Hash, Eq, PartialEq)]`. `f64` is *not* a valid key (floating-point equality is unreliable).

## Updating values — the `entry` API

Updating is where hash maps really shine. The **`entry`** method is the idiomatic tool: it looks up a key and lets you insert a default *only if it's missing*. This gives you the famous, elegant word-counter in three lines:

```rust
use std::collections::HashMap;

fn main() {
    let text = "the quick brown fox the lazy dog the end";
    let mut counts: HashMap<&str, i32> = HashMap::new();

    for word in text.split_whitespace() {
        // entry().or_insert(0) returns a &mut to the value (inserting 0 first
        // if the word is new). We then increment it with *.
        *counts.entry(word).or_insert(0) += 1;
    }

    println!("{counts:?}"); // {"the": 3, "fox": 1, ...} (order varies)
}
```

Read `*counts.entry(word).or_insert(0) += 1;` as: *"find `word`; if it's not there, start it at 0; either way, give me a mutable handle to its count, and add one."*

> [!best] Reach for `entry` instead of `contains_key` + `insert`
> The clumsy way is `if map.contains_key(k) { ... } else { map.insert(...) }` — two lookups and more code. `entry` does it in one lookup and reads beautifully. Its variants — `or_insert(default)`, `or_insert_with(|| expensive())`, `or_default()` — cover every "insert-or-update" case.

## A note on ownership

For types that aren't `Copy` (like `String`), `insert` **moves** the key and value into the map — the map now owns them:

```rust
use std::collections::HashMap;

fn main() {
    let name = String::from("favorite");
    let value = String::from("Rust");

    let mut map = HashMap::new();
    map.insert(name, value); // both are moved into the map
    // println!("{name}");   // ❌ name was moved

    println!("{map:?}");
}
```

If you want the map to hold borrowed data instead of owning it, use references as the value type (`HashMap<String, &str>`) — but then you're back in lifetime territory, so owning is usually simpler.

## Summary

- **`HashMap<K, V>`** stores **key–value pairs** for fast, average **O(1)** lookup by key. Import it with `use std::collections::HashMap;`.
- **`insert`** adds/replaces; **`get`** returns an **`Option`** so you handle the missing case.
- Iteration order is **unspecified and randomized** — never depend on it (use `BTreeMap` for sorted keys).
- Keys must implement `Hash` + `Eq` (integers, strings, tuples, and derivable structs qualify; `f64` does not).
- The **`entry`** API (`entry(k).or_insert(default)`) is the idiomatic way to insert-or-update — the word-count classic.
- `insert` **moves** non-`Copy` keys and values into the map, which then owns them.

> [!exercise] Try it yourself
> 1. Build a `HashMap<&str, i32>` of three products and their prices, then look up one with `get` and handle both `Some` and `None`.
> 2. Write a word-frequency counter for a sentence of your choice using the `entry` API.
> 3. Given a `Vec<i32>`, use a `HashMap` to count how many times each number appears.

Vectors, strings, and hash maps cover the vast majority of collection needs. Next, we round out the toolkit with the rest of **`std::collections`** — deques, ordered maps, sets, and heaps.
