<h1><span class="h1-kicker">Common Collections</span>Vectors</h1>

A **vector** (`Vec<T>`) is a growable list — a sequence of values of the same type, stored side by side in memory, that can shrink and grow at runtime. If the fixed-size array is a carton that holds exactly a dozen eggs, a `Vec` is a bag you can keep adding eggs to. It's the collection you'll reach for more than any other in Rust.

This chapter is both a tutorial and a reference. Read it top to bottom the first time, then come back for the method tables — they cover essentially everything `Vec` can do.

## Creating a vector

There are two common ways to make one:

```rust
fn main() {
    // 1. Empty, then push. The type is inferred from what you push.
    let mut scores: Vec<i32> = Vec::new();
    scores.push(10);
    scores.push(20);

    // 2. The vec! macro, with initial values (type inferred).
    let colors = vec!["red", "green", "blue"];

    println!("{scores:?}");
    println!("{colors:?}");
}
```

> [!jargon] The `<T>` in `Vec<T>`
> `Vec<T>` is a **generic** type — the `T` is a placeholder for *the type of element it holds*. A `Vec<i32>` holds integers; a `Vec<String>` holds strings. Every element must be the same type. You'll learn to write your own generic types in the [Generics](#/ch/generics) chapter.

Those two cover most days, but there are several more constructors worth knowing:

```rust
fn main() {
    let empty: Vec<i32> = Vec::new();                 // []
    let sized: Vec<i32> = Vec::with_capacity(100);    // [] but room for 100
    let repeated = vec![0u8; 5];                      // [0, 0, 0, 0, 0]
    let from_array = Vec::from([1, 2, 3]);            // [1, 2, 3]
    let collected: Vec<i32> = (1..=5).collect();      // [1, 2, 3, 4, 5]
    let mapped: Vec<i32> = (1..=4).map(|n| n * n).collect(); // [1, 4, 9, 16]
    let from_slice = [10, 20, 30].to_vec();           // [10, 20, 30]

    println!("{} {} {repeated:?} {from_array:?}", empty.len(), sized.capacity());
    println!("{collected:?} {mapped:?} {from_slice:?}");
}
```

### Construction reference

| Constructor | Result | When to use |
|---|---|---|
| `Vec::new()` | empty, no allocation yet | the default; you don't know the size |
| `vec![]` | empty | same as `Vec::new()`, shorter |
| `vec![a, b, c]` | those elements | you know the values up front |
| `vec![x; n]` | `x` repeated `n` times | grids, buffers, zero-filled arrays (needs `T: Clone`) |
| `Vec::with_capacity(n)` | empty, room for `n` | you know roughly how many you'll push |
| `Vec::from([a, b, c])` | those elements | converting from an array |
| `slice.to_vec()` | owned copy of a slice | you have a `&[T]` and need to own it |
| `iter.collect()` | elements of the iterator | building from a range, map, or filter |
| `Vec::from_iter(iter)` | same as `collect` | when type inference needs the help |

> [!performance] `Vec::new()` doesn't allocate
> An empty `Vec` performs **zero** heap allocations — it's just three machine words of zeroes on the stack. The first `push` allocates. This means you can freely create empty vectors in hot paths (say, one per loop iteration that may stay empty) without paying for memory you never use.

## Reading elements: `[]` vs `.get()`

There are two ways to access an element, and the difference matters:

```rust
fn main() {
    let v = vec![10, 20, 30, 40, 50];

    // 1. Indexing with [] — direct, but PANICS if out of bounds.
    let third: &i32 = &v[2];
    println!("The third element is {third}");

    // 2. .get() — returns an Option, so you handle "missing" safely.
    match v.get(2) {
        Some(x) => println!("Element 2 is {x}"),
        None => println!("There is no element 2"),
    }

    // Asking for index 99:
    println!("v.get(99) = {:?}", v.get(99)); // None — no crash
    // println!("{}", v[99]);                 // would PANIC
}
```

> [!key] Choose `[]` or `.get()` deliberately
> Use **`v[i]`** when an out-of-range index is a genuine *bug* that should crash loudly and immediately. Use **`v.get(i)`** when a missing index is an expected possibility you want to handle gracefully (it returns `Option<&T>`). Rust makes you pick — and either way, you can never silently read past the end into other memory like C would.

Beyond indexing, there's a family of accessors that all hand back an `Option`, so nothing can surprise you on an empty vector:

```rust
fn main() {
    let mut v = vec![10, 20, 30];

    println!("first  = {:?}", v.first());       // Some(10)
    println!("last   = {:?}", v.last());        // Some(30)
    println!("get(1) = {:?}", v.get(1));        // Some(20)

    // Mutable variants let you change the element in place.
    if let Some(x) = v.last_mut() {
        *x = 99;
    }
    println!("{v:?}"); // [10, 20, 99]

    // Splitting the ends off, pattern-match style:
    if let Some((head, tail)) = v.split_first() {
        println!("head = {head}, tail = {tail:?}"); // 10, [20, 99]
    }

    // The empty case is always well-behaved:
    let nothing: Vec<i32> = Vec::new();
    println!("empty first = {:?}", nothing.first()); // None
}
```

### Access reference

| Method | Returns | Notes |
|---|---|---|
| `v[i]` | `T` (by value if `Copy`) | **panics** out of range |
| `v.get(i)` | `Option<&T>` | safe; also takes ranges: `v.get(1..3)` |
| `v.get_mut(i)` | `Option<&mut T>` | safe mutable access |
| `v.first()` / `v.last()` | `Option<&T>` | the ends |
| `v.first_mut()` / `v.last_mut()` | `Option<&mut T>` | mutable ends |
| `v.split_first()` / `v.split_last()` | `Option<(&T, &[T])>` | head/tail destructuring |
| `v.len()` / `v.is_empty()` | `usize` / `bool` | prefer `is_empty()` over `len() == 0` |
| `v.as_slice()` | `&[T]` | borrow the whole thing as a slice |
| `v.swap(i, j)` | `()` | exchange two elements |

## Iterating

The idiomatic way to walk a vector is a `for` loop over a reference. Use `&v` to read, and `&mut v` (with `*` to dereference) to modify in place:

```rust
fn main() {
    let mut v = vec![100, 32, 57];

    // Read each element:
    for n in &v {
        println!("{n}");
    }

    // Modify each element in place (* dereferences to reach the value):
    for n in &mut v {
        *n += 50;
    }
    println!("{v:?}"); // [150, 82, 107]
}
```

There are exactly three ways to iterate, and picking the right one is mostly about **what you want to happen to the vector afterwards**:

```rust
fn main() {
    let names = vec![String::from("ada"), String::from("grace")];

    // 1. .iter() — borrow each element as &T. The vector survives.
    for n in names.iter() {
        println!("borrowed: {n}");
    }
    println!("still usable: {names:?}");

    // 2. .into_iter() — take each element as T. The vector is consumed.
    let shouted: Vec<String> = names.into_iter().map(|n| n.to_uppercase()).collect();
    // println!("{names:?}");  // ❌ names was moved
    println!("{shouted:?}");

    // 3. .iter_mut() — borrow each element as &mut T, to edit in place.
    let mut nums = vec![1, 2, 3];
    for n in nums.iter_mut() {
        *n *= 10;
    }
    println!("{nums:?}"); // [10, 20, 30]
}
```

| Form | Yields | The vector afterwards | Shorthand |
|---|---|---|---|
| `v.iter()` | `&T` | unchanged, still yours | `for x in &v` |
| `v.iter_mut()` | `&mut T` | elements edited in place | `for x in &mut v` |
| `v.into_iter()` | `T` | **consumed** (moved away) | `for x in v` |
| `v.drain(..)` | `T` | emptied, but still usable | — |
| `v.iter().enumerate()` | `(usize, &T)` | unchanged | index + value |
| `v.iter().rev()` | `&T` backwards | unchanged | — |

> [!mistake] Don't fight the borrow checker with indices
> A tempting beginner move is `for i in 0..v.len() { v.push(v[i]); }` — but pushing while iterating can invalidate things and the borrow checker will often stop you. Prefer iterator methods. To transform a vector, `.iter().map(...).collect()` is cleaner and safer than manual index loops (see [Iterators](#/ch/iterators)).

## Adding and removing elements

This is the heart of `Vec`. The full toolbox:

```rust
fn main() {
    let mut v = vec![1, 2, 3];

    v.push(4);                    // add to the end → [1,2,3,4]
    let last = v.pop();           // remove & return the last → Some(4)
    v.insert(0, 99);              // insert at index → [99,1,2,3]
    v.remove(0);                  // remove at index, shifting → [1,2,3]

    v.extend([10, 20]);           // append many → [1,2,3,10,20]
    v.extend_from_slice(&[30]);   // append a slice → [1,2,3,10,20,30]

    let mut other = vec![40, 50];
    v.append(&mut other);         // move all of `other` in; `other` is now empty
    println!("{v:?}  other={other:?}");

    v.truncate(4);                // keep the first 4 → [1,2,3,10]
    v.retain(|&x| x < 10);        // keep only matching → [1,2,3]
    println!("last popped: {last:?}, now {v:?}");

    let tail = v.split_off(1);    // v = [1], tail = [2,3]
    println!("v={v:?} tail={tail:?}");

    v.clear();                    // remove everything
    println!("cleared: {v:?}, is_empty = {}", v.is_empty());
}
```

### `remove` shifts, `swap_remove` doesn't

Two ways to delete an element by index, with very different costs. `remove(i)` slides every later element down one slot to close the gap — **O(n)**. `swap_remove(i)` moves the *last* element into the hole instead — **O(1)**, but it scrambles the order.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="remove shifts all later elements left, while swap_remove moves the last element into the gap">
  <style>
    .vr-l { font: 700 12px var(--font-sans); }
    .vr-m { font: 600 13px var(--font-mono); fill: var(--text); }
    .vr-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .vr-box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .vr-gone { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .vr-moved { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="vr-l" fill="var(--text-mute)">start:  v = [a, b, c, d, e]   — delete index 1</text>
  <text x="20" y="58" class="vr-l" fill="var(--red)">v.remove(1) — O(n): c, d, e each slide one slot left</text>
  <g class="vr-m">
    <rect x="20" y="68" width="44" height="32" class="vr-box"/><text x="37" y="90">a</text>
    <rect x="64" y="68" width="44" height="32" class="vr-gone"/><text x="81" y="90" fill="var(--red)">b</text>
    <rect x="108" y="68" width="44" height="32" class="vr-moved"/><text x="125" y="90">c</text>
    <rect x="152" y="68" width="44" height="32" class="vr-moved"/><text x="169" y="90">d</text>
    <rect x="196" y="68" width="44" height="32" class="vr-moved"/><text x="213" y="90">e</text>
  </g>
  <path d="M130 108 L92 108" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-vec-rm)"/>
  <path d="M174 108 L136 108" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-vec-rm)"/>
  <path d="M218 108 L180 108" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-vec-rm)"/>
  <text x="290" y="90" class="vr-m">→ [a, c, d, e]</text>
  <text x="290" y="110" class="vr-c">order preserved, 3 moves</text>
  <text x="20" y="158" class="vr-l" fill="var(--green)">v.swap_remove(1) — O(1): e jumps into the gap</text>
  <g class="vr-m">
    <rect x="20" y="168" width="44" height="32" class="vr-box"/><text x="37" y="190">a</text>
    <rect x="64" y="168" width="44" height="32" class="vr-gone"/><text x="81" y="190" fill="var(--red)">b</text>
    <rect x="108" y="168" width="44" height="32" class="vr-box"/><text x="125" y="190">c</text>
    <rect x="152" y="168" width="44" height="32" class="vr-box"/><text x="169" y="190">d</text>
    <rect x="196" y="168" width="44" height="32" class="vr-moved"/><text x="213" y="190">e</text>
  </g>
  <path d="M214 210 C 200 232, 100 232, 86 208" stroke="var(--green)" stroke-width="2.5" fill="none" marker-end="url(#arr-vec-sw)"/>
  <text x="290" y="190" class="vr-m">→ [a, e, c, d]</text>
  <text x="290" y="210" class="vr-c">order scrambled, 1 move</text>
  <defs>
    <marker id="arr-vec-rm" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="arr-vec-sw" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption><code>remove</code> keeps order at O(n) cost; <b>swap_remove</b> is O(1) but reorders. Pick by whether order matters.</figcaption>
</figure>

```rust
fn main() {
    let mut ordered = vec!['a', 'b', 'c', 'd', 'e'];
    ordered.remove(1);
    println!("remove(1):      {ordered:?}"); // ['a', 'c', 'd', 'e']

    let mut fast = vec!['a', 'b', 'c', 'd', 'e'];
    fast.swap_remove(1);
    println!("swap_remove(1): {fast:?}");    // ['a', 'e', 'c', 'd']
}
```

> [!performance] Removing many elements? Use `retain`, not a loop of `remove`
> Calling `remove` in a loop is **O(n²)** — each call shifts the tail again. `v.retain(|x| keep(x))` does one single pass, **O(n)**, and reads better too. Same idea for building: `extend` beats a `push` loop, because it can reserve all the space at once.

### `drain` — remove *and* use the elements

`drain` is the underrated one. It removes a range and hands you the removed values as an iterator, leaving the vector usable:

```rust
fn main() {
    let mut v = vec![1, 2, 3, 4, 5, 6];

    // Take out indices 1..4 and use them.
    let taken: Vec<i32> = v.drain(1..4).collect();
    println!("taken = {taken:?}, left = {v:?}"); // [2,3,4], [1,5,6]

    // drain(..) empties the vector but keeps its allocated capacity —
    // handy for reusing a buffer in a loop.
    let all: Vec<i32> = v.drain(..).collect();
    println!("all = {all:?}, v = {v:?}, capacity still {}", v.capacity());
}
```

### Add/remove reference

| Method | Cost | Effect |
|---|---|---|
| `push(x)` | O(1) amortized | append one element |
| `pop()` | O(1) | remove & return the last, as `Option<T>` |
| `insert(i, x)` | O(n) | insert at `i`, shifting the tail right |
| `remove(i)` | O(n) | remove at `i`, shifting the tail left; **panics** if out of range |
| `swap_remove(i)` | O(1) | remove at `i` by moving the last element in; reorders |
| `truncate(n)` | O(n) drops | keep only the first `n` elements |
| `clear()` | O(n) drops | remove all; **keeps capacity** |
| `extend(iter)` | O(k) | append everything from an iterator |
| `extend_from_slice(&[..])` | O(k) | append a slice (needs `T: Clone`) |
| `append(&mut other)` | O(k) | move all of `other` in, emptying it |
| `retain(\|&x\| …)` | O(n) | keep only elements passing the test |
| `retain_mut(\|x\| …)` | O(n) | same, but the closure can also edit each element |
| `dedup()` | O(n) | remove **consecutive** duplicates |
| `drain(range)` | O(n) | remove a range, yielding the removed items |
| `split_off(i)` | O(n − i) | split into two vectors at `i` |
| `resize(n, x)` | O(\|Δ\|) | grow with copies of `x`, or shrink to `n` |
| `fill(x)` | O(n) | overwrite every element with `x` |

> [!mistake] `dedup()` only removes *neighbours*
> `vec![1, 2, 1].dedup()` leaves `[1, 2, 1]` — the two `1`s aren't adjacent. To remove *all* duplicates, sort first (`v.sort(); v.dedup();`) or use a `HashSet` (see [VecDeque, BTreeMap, HashSet & Friends](#/ch/other-collections)). This trips up almost everyone once.

## Searching and sorting

```rust
fn main() {
    let mut v = vec![5, 3, 9, 1, 7];

    // Membership and position
    println!("contains 9?  {}", v.contains(&9));                    // true
    println!("index of 9:  {:?}", v.iter().position(|&x| x == 9));  // Some(2)
    println!("any even?    {}", v.iter().any(|&x| x % 2 == 0));     // false
    println!("max / min:   {:?} {:?}", v.iter().max(), v.iter().min());
    println!("sum:         {}", v.iter().sum::<i32>());

    // Sorting
    v.sort();                                  // [1, 3, 5, 7, 9]
    println!("sorted:      {v:?}");
    v.sort_by(|a, b| b.cmp(a));                // descending
    println!("descending:  {v:?}");
    v.reverse();                               // back to ascending
    println!("reversed:    {v:?}");

    // Binary search needs a sorted vector; Ok(i) = found, Err(i) = insert here
    println!("find 7:      {:?}", v.binary_search(&7));
    println!("find 8:      {:?}", v.binary_search(&8));
}
```

Sorting by a *derived* key is the everyday case, and `sort_by_key` keeps it readable:

```rust
#[derive(Debug)]
struct Task {
    name: &'static str,
    priority: u8,
}

fn main() {
    let mut tasks = vec![
        Task { name: "email",  priority: 3 },
        Task { name: "deploy", priority: 1 },
        Task { name: "review", priority: 2 },
    ];

    tasks.sort_by_key(|t| t.priority);
    for t in &tasks {
        println!("{} (p{})", t.name, t.priority);
    }

    // Floats have no total order, so they need sort_by with partial_cmp:
    let mut temps = vec![21.5, 18.2, 30.9];
    temps.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("{temps:?}");
}
```

### Search & sort reference

| Method | Cost | Notes |
|---|---|---|
| `contains(&x)` | O(n) | linear scan; needs `T: PartialEq` |
| `iter().position(\|x\| …)` | O(n) | first matching **index**, as `Option<usize>` |
| `iter().find(\|x\| …)` | O(n) | first matching **element** |
| `iter().any(…)` / `all(…)` | O(n) | short-circuiting tests |
| `binary_search(&x)` | O(log n) | **requires a sorted vector**; `Ok(i)` or `Err(insert_at)` |
| `binary_search_by_key(&k, f)` | O(log n) | binary search on a derived key |
| `partition_point(\|x\| …)` | O(log n) | first index where the predicate turns false |
| `sort()` | O(n log n) | **stable**; allocates; needs `T: Ord` |
| `sort_unstable()` | O(n log n) | faster, no allocation, ties may reorder |
| `sort_by(\|a, b\| …)` | O(n log n) | custom comparator (use for floats) |
| `sort_by_key(\|x\| …)` | O(n log n) | sort by a derived key — the common case |
| `reverse()` | O(n) | flip in place |
| `rotate_left(k)` / `rotate_right(k)` | O(n) | shift elements around, wrapping |
| `select_nth_unstable(k)` | O(n) avg | put the k-th smallest in place — cheaper than a full sort |

> [!best] Reach for `sort_unstable` unless you need stability
> A **stable** sort keeps equal elements in their original relative order; `sort()` guarantees that but needs temporary memory. `sort_unstable()` is typically faster and allocates nothing. If your elements are plain numbers — where "equal" elements are indistinguishable anyway — `sort_unstable()` is the better default. Use `sort()` when you're sorting records by one field and want previous ordering preserved among ties.

## Slices, chunks and windows

A **slice** (`&[T]`) is a borrowed view into part of a vector — a pointer plus a length, no copying. Most of what looks like a `Vec` method is really a slice method, which is why they work on arrays too (see [The Slice Type](#/ch/slices)).

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="chunks splits a slice into non-overlapping groups while windows produces overlapping views">
  <style>
    .vw-l { font: 700 12px var(--font-sans); }
    .vw-m { font: 600 12px var(--font-mono); fill: var(--text); }
    .vw-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .vw-box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .vw-g1 { fill: none; stroke: var(--rust-500); stroke-width: 2.5; }
    .vw-g2 { fill: none; stroke: var(--blue); stroke-width: 2.5; }
    .vw-g3 { fill: none; stroke: var(--purple); stroke-width: 2.5; }
  </style>
  <text x="20" y="20" class="vw-l" fill="var(--text-mute)">v = [1, 2, 3, 4, 5, 6]</text>
  <text x="20" y="52" class="vw-l" fill="var(--rust-600)">v.chunks(2) — non-overlapping groups of 2</text>
  <g class="vw-m">
    <rect x="20" y="62" width="42" height="30" class="vw-box"/><text x="37" y="83">1</text>
    <rect x="62" y="62" width="42" height="30" class="vw-box"/><text x="79" y="83">2</text>
    <rect x="104" y="62" width="42" height="30" class="vw-box"/><text x="121" y="83">3</text>
    <rect x="146" y="62" width="42" height="30" class="vw-box"/><text x="163" y="83">4</text>
    <rect x="188" y="62" width="42" height="30" class="vw-box"/><text x="205" y="83">5</text>
    <rect x="230" y="62" width="42" height="30" class="vw-box"/><text x="247" y="83">6</text>
  </g>
  <rect x="17" y="59" width="90" height="36" rx="4" class="vw-g1"/>
  <rect x="101" y="59" width="90" height="36" rx="4" class="vw-g1"/>
  <rect x="185" y="59" width="90" height="36" rx="4" class="vw-g1"/>
  <text x="300" y="83" class="vw-m">[1,2] [3,4] [5,6]</text>
  <text x="20" y="132" class="vw-l" fill="var(--blue)">v.windows(3) — overlapping views of 3, sliding by 1</text>
  <g class="vw-m">
    <rect x="20" y="142" width="42" height="30" class="vw-box"/><text x="37" y="163">1</text>
    <rect x="62" y="142" width="42" height="30" class="vw-box"/><text x="79" y="163">2</text>
    <rect x="104" y="142" width="42" height="30" class="vw-box"/><text x="121" y="163">3</text>
    <rect x="146" y="142" width="42" height="30" class="vw-box"/><text x="163" y="163">4</text>
    <rect x="188" y="142" width="42" height="30" class="vw-box"/><text x="205" y="163">5</text>
    <rect x="230" y="142" width="42" height="30" class="vw-box"/><text x="247" y="163">6</text>
  </g>
  <rect x="17" y="137" width="132" height="20" rx="4" class="vw-g2"/>
  <rect x="59" y="159" width="132" height="20" rx="4" class="vw-g3"/>
  <rect x="101" y="181" width="132" height="20" rx="4" class="vw-g2"/>
  <text x="300" y="163" class="vw-m">[1,2,3] [2,3,4] [3,4,5] …</text>
  <text x="20" y="205" class="vw-c">Both borrow — nothing is copied.</text>
</svg>
<figcaption><b>chunks</b> partitions; <b>windows</b> slides. Windows are the tool for "compare each element to its neighbour" problems.</figcaption>
</figure>

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5, 6];

    // A slice is a borrowed view — no copying.
    let middle: &[i32] = &v[1..4];
    println!("middle = {middle:?}"); // [2, 3, 4]

    // chunks: fixed-size batches (the last may be short)
    for c in v.chunks(2) {
        print!("{c:?} ");
    }
    println!();

    // windows: overlapping pairs — perfect for "is it increasing?"
    let increasing = v.windows(2).all(|w| w[0] <= w[1]);
    println!("increasing? {increasing}");

    // split_at: two halves, both borrowed
    let (left, right) = v.split_at(3);
    println!("{left:?} | {right:?}");
}
```

| Method | Yields | Use for |
|---|---|---|
| `&v[a..b]` | `&[T]` | a borrowed sub-range (panics if out of range) |
| `v.chunks(n)` | `&[T]` batches | batching, pagination, fixed-width records |
| `v.chunks_exact(n)` | `&[T]` batches | same, but drops a short tail (faster) |
| `v.windows(n)` | overlapping `&[T]` | comparing neighbours, moving averages |
| `v.split_at(i)` | `(&[T], &[T])` | two halves |
| `v.split(\|x\| …)` | `&[T]` pieces | splitting on a separator value |
| `v.concat()` | `Vec<T>` | flatten a `Vec<Vec<T>>` |
| `v.join(sep)` | `Vec<T>` / `String` | flatten with a separator between pieces |
| `v.starts_with(&[..])` / `ends_with` | `bool` | prefix/suffix tests |

## How a vector grows: capacity

Understanding a vector's inner workings makes you a better Rust programmer. A `Vec` stores its elements on the **heap**, and tracks two numbers: **length** (how many elements it holds) and **capacity** (how many it *can* hold before needing to reallocate).

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="When a vector fills its capacity, it allocates a bigger buffer and moves the elements">
  <style>
    .vh { font: 700 12px var(--font-sans); }
    .vm { font: 600 12px var(--font-mono); fill: var(--text); }
    .vc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .used { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .free { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style>
  <text x="20" y="24" class="vh" fill="var(--rust-600)">Before push (len 4, cap 4 — FULL):</text>
  <g class="vm">
    <rect x="20" y="34" width="40" height="34" class="used"/><text x="34" y="56">1</text>
    <rect x="60" y="34" width="40" height="34" class="used"/><text x="74" y="56">2</text>
    <rect x="100" y="34" width="40" height="34" class="used"/><text x="114" y="56">3</text>
    <rect x="140" y="34" width="40" height="34" class="used"/><text x="154" y="56">4</text>
  </g>
  <text x="20" y="98" class="vh" fill="var(--green)">After push(5): allocate a bigger buffer (cap 8), copy, add:</text>
  <g class="vm">
    <rect x="20" y="108" width="40" height="34" class="used"/><text x="34" y="130">1</text>
    <rect x="60" y="108" width="40" height="34" class="used"/><text x="74" y="130">2</text>
    <rect x="100" y="108" width="40" height="34" class="used"/><text x="114" y="130">3</text>
    <rect x="140" y="108" width="40" height="34" class="used"/><text x="154" y="130">4</text>
    <rect x="180" y="108" width="40" height="34" class="used"/><text x="194" y="130">5</text>
    <rect x="220" y="108" width="40" height="34" class="free"/>
    <rect x="260" y="108" width="40" height="34" class="free"/>
    <rect x="300" y="108" width="40" height="34" class="free"/>
  </g>
  <text x="20" y="172" class="vc">Growth typically doubles capacity, so many pushes are cheap "on average" (amortized O(1)).</text>
</svg>
<figcaption>When a <code>Vec</code> outgrows its capacity, it allocates a larger buffer (usually double) and moves its elements over.</figcaption>
</figure>

You can watch it happen:

```rust
fn main() {
    let mut v: Vec<i32> = Vec::new();
    let mut last_cap = v.capacity();
    println!("start: len 0, cap {last_cap}");

    for i in 0..20 {
        v.push(i);
        if v.capacity() != last_cap {
            last_cap = v.capacity();
            println!("grew at len {}: cap now {last_cap}", v.len());
        }
    }

    // clear() drops the elements but KEEPS the buffer:
    v.clear();
    println!("after clear: len {}, cap {}", v.len(), v.capacity());

    // shrink_to_fit gives the memory back:
    v.shrink_to_fit();
    println!("after shrink: len {}, cap {}", v.len(), v.capacity());
}
```

| Method | Effect |
|---|---|
| `capacity()` | how many elements fit before reallocating |
| `reserve(n)` | ensure room for `n` **more** elements |
| `reserve_exact(n)` | same, without over-allocating |
| `shrink_to_fit()` | release unused capacity back to the allocator |
| `with_capacity(n)` | construct with room for `n` |
| `into_boxed_slice()` | convert to `Box<[T]>`, dropping spare capacity |

> [!performance] Pre-size with `with_capacity` in hot loops
> If you know roughly how many items you'll add, `Vec::with_capacity(n)` reserves space up front, avoiding repeated reallocation-and-copy as it grows. In a loop pushing a million items, this is a meaningful speedup. For casual use, plain `Vec::new()` is perfectly fine — the doubling strategy keeps average push cost low.

> [!deep] Why "amortized" O(1) is honest, not a fudge
> A single `push` that triggers growth costs O(n) — it copies everything. But because capacity **doubles**, that expensive push happens ever more rarely: at sizes 1, 2, 4, 8, 16… Summing the cost of n pushes gives roughly 2n element-moves total, so the *average* cost per push is a small constant. That's what **amortized O(1)** means: individual calls vary, but the total across many calls is linear.

## Vectors of vectors: grids

A `Vec<Vec<T>>` is the straightforward way to build a 2D grid:

```rust
fn main() {
    // A 3x4 grid of zeroes: 3 rows, each a Vec of 4 items.
    let mut grid = vec![vec![0; 4]; 3];

    grid[1][2] = 7;      // row 1, column 2

    for row in &grid {
        println!("{row:?}");
    }

    // Flatten it into one list:
    let flat: Vec<i32> = grid.concat();
    println!("flat = {flat:?}");
    println!("total = {}", flat.iter().sum::<i32>());
}
```

> [!tip] For fixed-size grids, one flat `Vec` is faster
> `Vec<Vec<T>>` means one heap allocation per row and a pointer-chase for every access. For a grid whose width you know, store a single `Vec<T>` of `rows * cols` and index it as `grid[row * cols + col]`. One allocation, contiguous memory, far friendlier to the CPU cache. Wrap it in a small struct with a `get(row, col)` method and the arithmetic stays out of your way.

## Storing multiple types with an enum

A `Vec` holds one type — but you can make that "one type" an enum, letting you store a mix of shapes in a single vector:

```rust
#[derive(Debug)]
enum Cell {
    Int(i64),
    Float(f64),
    Text(String),
}

fn main() {
    let row = vec![
        Cell::Int(3),
        Cell::Text(String::from("blue")),
        Cell::Float(10.12),
    ];
    for cell in &row {
        println!("{cell:?}");
    }
}
```

> [!note] Dropping a vector drops its elements
> When a `Vec` goes out of scope, it's dropped — and so is every element inside it, automatically and in order. If you have a `Vec<String>`, all those heap-allocated strings are freed too. Ownership scales cleanly from one value to a whole collection.

## Summary

- **`Vec<T>`** is a growable, heap-allocated list of same-typed values — your default collection.
- Create with `Vec::new()` + `push`, the **`vec![]`** macro, `with_capacity`, or `.collect()`.
- Read with **`v[i]`** (panics if out of range — use when that's a bug) or **`v.get(i)`** (returns `Option` — use when absence is expected).
- Iterate with **`iter()`** (borrow), **`iter_mut()`** (edit in place), or **`into_iter()`** (consume).
- **`remove`** preserves order at O(n); **`swap_remove`** is O(1) but reorders. Use **`retain`** to delete many, and **`drain`** to remove *and* use the elements.
- Sort with **`sort_unstable`** by default, **`sort_by_key`** for derived keys, **`sort_by`** for floats; then **`binary_search`** is O(log n).
- **`chunks`** partitions and **`windows`** slides — the tools for batching and neighbour comparisons.
- A `Vec` tracks **length** and **capacity**, growing by doubling (amortized O(1) pushes). Pre-size with **`with_capacity`**.
- Store mixed shapes by making the element type an **enum**.

> [!exercise] Try it yourself
> 1. Build a `Vec<i32>` of the numbers 1–10 with a loop, then print the sum using `v.iter().sum::<i32>()`.
> 2. Take `vec![5, 1, 4, 1, 5, 9, 2, 6]`, sort it, `dedup()` it, then `binary_search` for `4` and for `7`. Explain what `Err(i)` is telling you.
> 3. Use `windows(2)` to find the largest jump between consecutive elements of a list of temperatures.
> 4. Time (or reason about) removing every even number from a 10,000-element vector with `retain` versus a loop of `remove`. Why is one dramatically faster?
> 5. Rewrite the 3×4 grid above as a single flat `Vec<i32>` with a `get(row, col)` helper function.

Next we tackle a collection that seems simple but hides real depth — text, and the surprising subtleties of Rust's **strings**.
