<h1><span class="h1-kicker">Common Collections</span>Collection Recipes & Idioms</h1>

You now know what every collection *does*. This chapter is about what you actually *write* — the dozen or so patterns that come up again and again in real Rust code. Count things, group things, deduplicate, take the top ten, invert a map, batch a stream. Each recipe here is short, runnable, and idiomatic; together they'll cover most of the collection code you ever need.

Keep this chapter open while you work. It's a cookbook, not a lecture.

## The shape of every recipe

Almost all of these are the same three-step move: **start with an iterator, transform it, land it in a collection.** The landing is `collect()` or `fold()`, and choosing between them is the only real decision.

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="A pipeline from a source collection through iterator adapters into a destination collection, with collect and fold as the two landing options">
  <style>
    .cr-l { font: 700 12px var(--font-sans); fill: var(--text); }
    .cr-m { font: 600 12px var(--font-mono); fill: var(--text); }
    .cr-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cr-src { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .cr-mid { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .cr-dst { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="56" width="118" height="46" rx="5" class="cr-src"/>
  <text x="34" y="76" class="cr-m">Vec / HashMap</text>
  <text x="34" y="94" class="cr-c">any collection</text>
  <rect x="188" y="56" width="150" height="46" rx="5" class="cr-mid"/>
  <text x="200" y="76" class="cr-m">.map .filter</text>
  <text x="200" y="94" class="cr-m">.zip .flat_map</text>
  <rect x="392" y="18" width="150" height="40" rx="5" class="cr-dst"/>
  <text x="404" y="43" class="cr-m">.collect()</text>
  <rect x="392" y="72" width="150" height="40" rx="5" class="cr-dst"/>
  <text x="404" y="97" class="cr-m">.fold(acc, f)</text>
  <rect x="392" y="126" width="150" height="40" rx="5" class="cr-dst"/>
  <text x="404" y="151" class="cr-m">.sum() .max()</text>
  <path d="M140 79 L186 79" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-cr)"/>
  <path d="M340 76 C 366 76, 366 38, 390 38" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arr-cr)"/>
  <path d="M340 79 L390 90" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-cr)"/>
  <path d="M340 82 C 366 82, 366 144, 390 144" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arr-cr)"/>
  <text x="560" y="43" class="cr-c">one item</text>
  <text x="560" y="57" class="cr-c">per input</text>
  <text x="560" y="97" class="cr-c">build up</text>
  <text x="560" y="111" class="cr-c">state</text>
  <text x="560" y="151" class="cr-c">one</text>
  <text x="560" y="165" class="cr-c">answer</text>
  <text x="20" y="196" class="cr-c">Use <tspan font-family="var(--font-mono)">collect</tspan> when each input maps to one output. Use <tspan font-family="var(--font-mono)">fold</tspan> when outputs merge — counting, grouping, deduplicating.</text>
  <defs><marker id="arr-cr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>Source → adapters → landing. <b>collect</b> for one-to-one, <b>fold</b> when several inputs contribute to one entry.</figcaption>
</figure>

> [!key] `collect` when outputs are independent, `fold` when they merge
> Turning ten numbers into ten squares? Each output stands alone — `collect`. Turning ten words into a count per word? Several inputs feed the same entry — that's `fold` (or a plain `for` loop with `entry`). Reaching for `collect` where you needed to merge is the most common source of "why do I only have one item?" confusion.

## Recipe 1: count occurrences

The frequency map — probably the single most-used collection pattern there is.

```rust
use std::collections::HashMap;

fn main() {
    let text = "the cat sat on the mat the end";

    // The loop form — clearest, and what you'll write most often.
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_default() += 1;
    }

    // The fold form — the same thing as one expression.
    let counts2 = text.split_whitespace().fold(HashMap::new(), |mut acc, w| {
        *acc.entry(w).or_insert(0usize) += 1;
        acc
    });

    let mut out: Vec<_> = counts.iter().collect();
    out.sort();
    println!("{out:?}");
    println!("same? {}", counts == counts2);
}
```

## Recipe 2: group items by a key

A "multimap" — many values under one key. `or_default()` creates the empty `Vec` for you.

```rust
use std::collections::HashMap;

#[derive(Debug)]
struct Employee {
    name: &'static str,
    dept: &'static str,
}

fn main() {
    let staff = [
        Employee { name: "ada",   dept: "eng" },
        Employee { name: "grace", dept: "eng" },
        Employee { name: "hedy",  dept: "design" },
    ];

    let mut by_dept: HashMap<&str, Vec<&str>> = HashMap::new();
    for e in &staff {
        by_dept.entry(e.dept).or_default().push(e.name);
    }

    let mut depts: Vec<_> = by_dept.into_iter().collect();
    depts.sort();
    for (dept, names) in depts {
        println!("{dept}: {names:?}");
    }
}
```

> [!tip] Group into a `BTreeMap` when you're going to print it
> Swap `HashMap` for `BTreeMap` and the groups come out in sorted key order with no extra sorting step — and identically on every run, which makes the output diffable and the test assertable. The API is otherwise the same, so it's a one-word change.

## Recipe 3: deduplicate

Three different jobs that people all call "dedup":

```rust
use std::collections::HashSet;

fn main() {
    let items = vec![3, 1, 4, 1, 5, 9, 2, 6, 5, 3];

    // (a) Unique values, order irrelevant — one line.
    let unique: HashSet<i32> = items.iter().copied().collect();
    println!("count of unique: {}", unique.len());

    // (b) Unique values, sorted — sort then dedup (dedup only removes NEIGHBOURS).
    let mut sorted = items.clone();
    sorted.sort_unstable();
    sorted.dedup();
    println!("sorted unique: {sorted:?}");

    // (c) Unique values, FIRST-SEEN order preserved — the one people get wrong.
    let mut seen = HashSet::new();
    let first_seen: Vec<i32> = items
        .iter()
        .copied()
        .filter(|x| seen.insert(*x)) // insert returns true only the first time
        .collect();
    println!("original order: {first_seen:?}");
}
```

> [!mistake] `Vec::dedup()` alone almost never does what you want
> `dedup()` only collapses **adjacent** equal elements, so `[1, 2, 1].dedup()` is unchanged. Either sort first, or use the `HashSet`-filter trick above when order matters. The `filter(|x| seen.insert(*x))` idiom is worth memorizing — it's O(n) and reads cleanly once you know that `insert` returns `true` for new values.

## Recipe 4: top K without sorting everything

Sorting a million items to see the top ten is wasteful. A bounded min-heap costs O(n log k).

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

fn main() {
    let scores = [17, 3, 92, 45, 8, 61, 30, 77, 55];
    let k = 3;

    let mut heap = BinaryHeap::with_capacity(k + 1);
    for s in scores {
        heap.push(Reverse(s));
        if heap.len() > k {
            heap.pop(); // evict the smallest of the k+1
        }
    }

    let mut top: Vec<i32> = heap.into_iter().map(|Reverse(s)| s).collect();
    top.sort_unstable_by(|a, b| b.cmp(a));
    println!("top {k}: {top:?}"); // [92, 77, 61]

    // For a single extreme, skip the heap entirely:
    println!("max: {:?}", scores.iter().max());
    println!("min: {:?}", scores.iter().min());
}
```

## Recipe 5: sort a map by value

Maps aren't sortable — so move the pairs into a `Vec` and sort that.

```rust
use std::collections::HashMap;

fn main() {
    let sales = HashMap::from([("north", 120), ("south", 340), ("east", 90), ("west", 340)]);

    let mut ranked: Vec<(&str, i32)> = sales.into_iter().collect();

    // Highest first; ties broken alphabetically so the output is deterministic.
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));

    for (rank, (region, total)) in ranked.iter().enumerate() {
        println!("{}. {region}: {total}", rank + 1);
    }
}
```

> [!best] Always break ties explicitly when you'll display the result
> `sort_by_key(|(_, v)| *v)` leaves equal values in an arbitrary order — and for a `HashMap` source, that order changes between runs. Chaining `.then(...)` on a second field makes the output stable, reproducible, and testable. It costs one line and saves a confusing bug report.

## Recipe 6: invert a map

Swapping keys and values is a `map` plus a `collect` — but think about duplicates first.

```rust
use std::collections::HashMap;

fn main() {
    let codes = HashMap::from([("gb", 44), ("us", 1), ("ca", 1)]);

    // Naive inversion — later duplicates SILENTLY overwrite earlier ones.
    let lossy: HashMap<i32, &str> = codes.iter().map(|(k, v)| (*v, *k)).collect();
    println!("lossy has {} entries (was {})", lossy.len(), 3);

    // Lossless inversion — collect the collisions into a Vec.
    let mut safe: HashMap<i32, Vec<&str>> = HashMap::new();
    for (country, code) in &codes {
        safe.entry(*code).or_default().push(country);
    }
    for list in safe.values_mut() {
        list.sort();
    }

    let mut out: Vec<_> = safe.into_iter().collect();
    out.sort();
    println!("{out:?}"); // [(1, ["ca", "us"]), (44, ["gb"])]
}
```

## Recipe 7: partition and unzip

Two ways to split one iterator into two collections.

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8];

    // partition: split by a predicate
    let (even, odd): (Vec<i32>, Vec<i32>) = numbers.iter().partition(|&&n| n % 2 == 0);
    println!("even={even:?} odd={odd:?}");

    // unzip: split pairs into two lists
    let pairs = vec![("a", 1), ("b", 2), ("c", 3)];
    let (letters, digits): (Vec<&str>, Vec<i32>) = pairs.into_iter().unzip();
    println!("{letters:?} {digits:?}");

    // zip: and back again (stops at the shorter side)
    let rejoined: Vec<(&str, i32)> = letters.into_iter().zip(digits).collect();
    println!("{rejoined:?}");
}
```

## Recipe 8: flatten nested collections

```rust
fn main() {
    let teams = vec![vec!["ada", "grace"], vec!["alan"], vec![]];

    // flatten: one level of nesting away
    let everyone: Vec<&str> = teams.iter().flatten().copied().collect();
    println!("{everyone:?}");

    // concat: the same thing for Vec<Vec<T>>, in one call
    println!("{:?}", teams.concat());

    // flat_map: map and flatten in one pass
    let letters: Vec<char> = everyone.iter().flat_map(|name| name.chars()).collect();
    println!("{} letters", letters.len());

    // flatten also drops the Nones out of an iterator of Options
    let maybe = vec![Some(1), None, Some(3)];
    let present: Vec<i32> = maybe.into_iter().flatten().collect();
    println!("{present:?}"); // [1, 3]
}
```

> [!tip] `flatten()` on `Option`s and `Result`s is a hidden gem
> An iterator of `Option<T>` flattens to just the `Some` values, and an iterator of `Result<T, E>` flattens to just the `Ok`s. That turns "parse these lines and keep the ones that worked" into `lines.map(|l| l.parse::<i32>()).flatten().collect()` — or the even shorter `filter_map(|l| l.parse().ok())`.

## Recipe 9: running totals and sliding windows

```rust
fn main() {
    let daily = [10, 5, 20, 15, 30];

    // Running total with scan (carries state between items):
    let cumulative: Vec<i32> = daily
        .iter()
        .scan(0, |total, &x| {
            *total += x;
            Some(*total)
        })
        .collect();
    println!("cumulative: {cumulative:?}"); // [10, 15, 35, 50, 80]

    // 3-day moving average with windows:
    let averages: Vec<f64> = daily
        .windows(3)
        .map(|w| w.iter().sum::<i32>() as f64 / w.len() as f64)
        .collect();
    println!("3-day averages: {averages:?}");

    // Day-over-day change — the classic windows(2) use:
    let deltas: Vec<i32> = daily.windows(2).map(|w| w[1] - w[0]).collect();
    println!("deltas: {deltas:?}"); // [-5, 15, -5, 15]
}
```

## Recipe 10: batching

```rust
fn main() {
    let ids: Vec<u32> = (1..=10).collect();

    // Fixed-size batches — the last one may be short.
    for (n, batch) in ids.chunks(4).enumerate() {
        println!("batch {}: {batch:?}", n + 1);
    }

    // Turn each batch into a comma-separated request string:
    let requests: Vec<String> = ids
        .chunks(4)
        .map(|b| b.iter().map(u32::to_string).collect::<Vec<_>>().join(","))
        .collect();
    println!("{requests:?}");
}
```

## Recipe 11: build an index

Mapping each term to where it appeared — the core of every search feature.

```rust
use std::collections::{BTreeMap, BTreeSet};

fn main() {
    let doc = "\
the quick brown fox
jumps over the lazy dog
the fox sleeps";

    // word → set of line numbers it appears on
    let mut index: BTreeMap<&str, BTreeSet<usize>> = BTreeMap::new();
    for (line_no, line) in doc.lines().enumerate() {
        for word in line.split_whitespace() {
            index.entry(word).or_default().insert(line_no + 1);
        }
    }

    for word in ["the", "fox", "cat"] {
        match index.get(word) {
            Some(lines) => println!("{word}: lines {lines:?}"),
            None => println!("{word}: not found"),
        }
    }
}
```

## Recipe 12: a bounded cache

A `HashMap` for the values plus a `VecDeque` for the eviction order gives you a serviceable fixed-size cache in about twenty lines.

```rust
use std::collections::{HashMap, VecDeque};

struct Cache {
    capacity: usize,
    values: HashMap<String, u64>,
    order: VecDeque<String>, // oldest at the front
}

impl Cache {
    fn new(capacity: usize) -> Self {
        Cache { capacity, values: HashMap::new(), order: VecDeque::new() }
    }

    fn insert(&mut self, key: &str, value: u64) {
        if self.values.insert(key.to_string(), value).is_none() {
            self.order.push_back(key.to_string());
            if self.order.len() > self.capacity {
                if let Some(oldest) = self.order.pop_front() {
                    self.values.remove(&oldest);
                }
            }
        }
    }

    fn get(&self, key: &str) -> Option<u64> {
        self.values.get(key).copied()
    }
}

fn main() {
    let mut cache = Cache::new(2);
    cache.insert("a", 1);
    cache.insert("b", 2);
    cache.insert("c", 3); // evicts "a"

    println!("a = {:?}", cache.get("a")); // None — evicted
    println!("b = {:?}", cache.get("b")); // Some(2)
    println!("c = {:?}", cache.get("c")); // Some(3)
}
```

> [!note] This is FIFO, not LRU
> The cache above evicts whatever was *inserted* first. A true **LRU** (least-recently-used) cache promotes an entry on every *read*, which needs a linked structure to reorder in O(1) — genuinely fiddly in safe Rust. Reach for the `lru` crate rather than writing one, unless building it is the point (see [Designing Your Own Data Structures](#/ch/dsa-design)).

## Recipe 13: merging maps

```rust
use std::collections::HashMap;

fn main() {
    let defaults = HashMap::from([("host", "localhost"), ("port", "8080"), ("tls", "off")]);
    let overrides = HashMap::from([("port", "443"), ("tls", "on")]);

    // Later values win — extend overwrites on collision.
    let mut config = defaults.clone();
    config.extend(overrides.clone());

    let mut out: Vec<_> = config.iter().collect();
    out.sort();
    println!("merged: {out:?}");

    // Summing numeric maps instead of overwriting:
    let q1 = HashMap::from([("north", 10), ("south", 20)]);
    let q2 = HashMap::from([("south", 5), ("east", 7)]);

    let mut totals: HashMap<&str, i32> = q1;
    for (region, amount) in q2 {
        *totals.entry(region).or_insert(0) += amount;
    }
    let mut sums: Vec<_> = totals.into_iter().collect();
    sums.sort();
    println!("totals: {sums:?}"); // [("east", 7), ("north", 10), ("south", 25)]
}
```

## The recipe index

| I want to… | Reach for |
|---|---|
| count how often each item appears | `*map.entry(k).or_default() += 1` |
| group values under a key | `map.entry(k).or_default().push(v)` |
| unique items, order irrelevant | `.collect::<HashSet<_>>()` |
| unique items, sorted | `sort_unstable()` then `dedup()` |
| unique items, first-seen order | `.filter(\|x\| seen.insert(*x))` |
| the largest / smallest | `.max()` / `.min()` |
| the top K | bounded `BinaryHeap` with `Reverse` |
| a map sorted by value | `.collect::<Vec<_>>()` then `sort_by` |
| a map sorted by key | collect into a `BTreeMap` |
| to swap keys and values | `.map(\|(k, v)\| (v, k)).collect()` |
| to split by a condition | `.partition(pred)` |
| to split pairs apart | `.unzip()` |
| to remove one level of nesting | `.flatten()` / `.concat()` |
| to map and flatten at once | `.flat_map(f)` |
| to drop the `None`s / `Err`s | `.flatten()` or `.filter_map(f)` |
| a running total | `.scan(0, …)` |
| to compare each item to the next | `.windows(2)` |
| fixed-size batches | `.chunks(n)` |
| to merge two maps | `.extend(other)`, or `entry` to combine |
| to join into a string | `.collect::<Vec<_>>().join(", ")` |

> [!deep] When `itertools` earns its place
> Several recipes above get shorter with the [`itertools`](#/ch/essential-crates) crate: `.counts()` for a frequency map, `.into_group_map_by(f)` for grouping, `.unique()` for order-preserving dedup, `.chunks(n)` over any iterator (not just slices), and `.sorted_by_key(f)` as an expression. It's a well-maintained, dependency-light crate that many projects add on day one. Learn the std versions first, though — they're what you'll read in other people's code, and they're always available.

## Summary

- Every recipe is **source → adapters → landing**. Use **`collect`** when each input yields its own output; use **`fold`** or a `for` loop with **`entry`** when several inputs merge into one.
- `*map.entry(k).or_default() += 1` counts; `map.entry(k).or_default().push(v)` groups. These two lines cover an enormous amount of real code.
- Three kinds of dedup: `HashSet` (any order), `sort` + `dedup` (sorted), `filter(|x| seen.insert(*x))` (first-seen order).
- **Top K** is a bounded `BinaryHeap` with `Reverse`, not a full sort.
- Maps can't be sorted — `collect` into a `Vec` and sort that, breaking ties explicitly so output is deterministic.
- `partition`, `unzip`, `zip`, `flatten`, `flat_map`, `scan`, `windows`, and `chunks` cover splitting, joining, nesting, and batching.
- Use a **`BTreeMap`** anywhere the output gets printed, compared, or asserted on.

> [!exercise] Try it yourself
> 1. Given a sentence, print the three most common words with their counts, ties broken alphabetically.
> 2. Group a list of file names by extension into a `BTreeMap<&str, Vec<&str>>`, then print each group.
> 3. Take `vec![1, 2, 2, 3, 3, 3]` and produce (a) the unique values in first-seen order, and (b) a count per value — in the same pass if you can.
> 4. Build an inverted index over three lines of text, then answer "which lines contain both word A and word B?" using `BTreeSet::intersection`.
> 5. Extend the bounded cache into a true LRU: move a key to the back of the queue on every `get`. Where does it get awkward, and why?

That completes the collections toolkit — the containers, their methods, and the patterns that combine them. Next, real programs have to cope when things go *wrong*, so we turn to Rust's exceptionally good approach to **error handling**.
