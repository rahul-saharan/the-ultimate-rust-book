<h1><span class="h1-kicker">Common Collections</span>Vectors</h1>

A **vector** (`Vec<T>`) is a growable list — a sequence of values of the same type, stored side by side in memory, that can shrink and grow at runtime. If the fixed-size array is a carton that holds exactly a dozen eggs, a `Vec` is a bag you can keep adding eggs to. It's the collection you'll reach for more than any other in Rust.

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

> [!mistake] Don't fight the borrow checker with indices
> A tempting beginner move is `for i in 0..v.len() { v.push(v[i]); }` — but pushing while iterating can invalidate things and the borrow checker will often stop you. Prefer iterator methods. To transform a vector, `.iter().map(...).collect()` is cleaner and safer than manual index loops (see [Iterators](#/ch/iterators)).

## Growing, shrinking, and common operations

`Vec` has a rich toolbox. Here are the ones you'll use daily:

```rust
fn main() {
    let mut v = vec![1, 2, 3];

    v.push(4);              // add to the end → [1,2,3,4]
    let last = v.pop();     // remove & return the last → Some(4)
    v.insert(0, 99);        // insert at index → [99,1,2,3]
    v.remove(0);            // remove at index → [1,2,3]

    println!("len = {}, is_empty = {}", v.len(), v.is_empty());
    println!("contains 2? {}", v.contains(&2));
    println!("last popped: {last:?}");

    v.extend([10, 20]);     // append many → [1,2,3,10,20]
    v.retain(|&x| x < 10);  // keep only matching → [1,2,3]
    v.sort();               // sort in place
    println!("{v:?}");
}
```

| Method | Does |
|--------|------|
| `push(x)` / `pop()` | Add to / remove from the end |
| `insert(i, x)` / `remove(i)` | Insert / remove at an index |
| `len()` / `is_empty()` | Size checks |
| `contains(&x)` | Membership test |
| `sort()` / `sort_by(...)` | Sort in place |
| `iter()` / `iter_mut()` | Get an iterator |
| `first()` / `last()` | `Option<&T>` of the ends |

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

> [!performance] Pre-size with `with_capacity` in hot loops
> If you know roughly how many items you'll add, `Vec::with_capacity(n)` reserves space up front, avoiding repeated reallocation-and-copy as it grows. In a loop pushing a million items, this is a meaningful speedup. For casual use, plain `Vec::new()` is perfectly fine — the doubling strategy keeps average push cost low.

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
- Create with `Vec::new()` + `push`, or the **`vec![]`** macro.
- Read with **`v[i]`** (panics if out of range — use when that's a bug) or **`v.get(i)`** (returns `Option` — use when absence is expected).
- Iterate with `for x in &v` (read) or `for x in &mut v { *x = … }` (modify).
- A `Vec` tracks **length** and **capacity**; it grows by reallocating (usually doubling). Use **`with_capacity`** when you know the size in advance.
- Store mixed shapes by making the element type an **enum**.

> [!exercise] Try it yourself
> 1. Build a `Vec<i32>` of the numbers 1–10 with a loop, then print the sum using `v.iter().sum::<i32>()`.
> 2. Use `.get()` to safely look up index 5 and index 50, printing the `Option` each time.
> 3. Make a `Vec<Cell>` (from the enum above) mixing integers, floats, and text, and iterate over it printing each variant.

Next we tackle a collection that seems simple but hides real depth — text, and the surprising subtleties of Rust's **strings**.
