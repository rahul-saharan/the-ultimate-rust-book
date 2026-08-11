<h1><span class="h1-kicker">Structuring Data</span>Methods & Associated Functions</h1>

Data on its own is inert. **Methods** give your types *behavior* — functions that belong to a type and operate on its data. Instead of a loose `area(rectangle)` function floating in your codebase, you write `rectangle.area()`, keeping the logic right next to the data it works on. This chapter shows how to bring your structs and enums to life with `impl` blocks.

## Defining methods in an `impl` block

A method is just a function defined inside an **`impl`** (implementation) block for a type. Its first parameter is always `self`, which represents the instance the method is called on:

```rust
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // A method: takes &self, so it borrows the instance to read it.
    fn area(&self) -> u32 {
        self.width * self.height
    }
}

fn main() {
    let rect = Rectangle { width: 30, height: 50 };
    println!("The area is {}", rect.area()); // called with dot notation
}
```

> [!jargon] Method vs. function; the receiver
> A **function** is standalone (`fn add(a, b)`). A **method** is a function attached to a type, called with dot syntax on an instance (`rect.area()`). That first `self` parameter is called the **receiver** — it's the instance the method acts upon.

## The three kinds of `self`

How you write `self` declares what the method needs from the instance. This is ownership, applied to methods — and it's worth internalizing:

| Receiver | Means | Use when the method… |
|----------|-------|----------------------|
| `&self` | Borrow immutably | only **reads** the data (most common) |
| `&mut self` | Borrow mutably | **modifies** the instance |
| `self` | Take ownership | **consumes/transforms** the instance |

```rust
#[derive(Debug)]
struct Counter { value: u32 }

impl Counter {
    fn get(&self) -> u32 {           // reads only
        self.value
    }
    fn increment(&mut self) {        // modifies
        self.value += 1;
    }
    fn into_value(self) -> u32 {     // consumes: `self` is used up
        self.value
    }
}

fn main() {
    let mut c = Counter { value: 0 };
    c.increment();
    c.increment();
    println!("count = {}", c.get()); // 2
    let final_value = c.into_value(); // c is consumed here…
    println!("final = {final_value}");
    // println!("{}", c.get());       // ❌ c was moved by into_value
}
```

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="The three receiver types: shared borrow, mutable borrow, and ownership">
  <style>
    .rh { font: 700 12px var(--font-sans); }
    .rm { font: 600 12px var(--font-mono); fill: var(--text); }
    .rc { font: 11px var(--font-sans); fill: var(--text-mute); }
  </style>
  <rect x="16" y="20" width="196" height="120" rx="10" fill="var(--green-soft)" stroke="var(--green)" stroke-width="1.5"/>
  <text x="30" y="46" class="rh" fill="var(--green)">&amp;self</text>
  <text x="30" y="72" class="rm">fn area(&amp;self)</text>
  <text x="30" y="100" class="rc">Read-only borrow.</text>
  <text x="30" y="118" class="rc">Caller keeps the value.</text>
  <rect x="224" y="20" width="196" height="120" rx="10" fill="var(--blue-soft)" stroke="var(--blue)" stroke-width="1.5"/>
  <text x="238" y="46" class="rh" fill="var(--blue)">&amp;mut self</text>
  <text x="238" y="72" class="rm">fn grow(&amp;mut self)</text>
  <text x="238" y="100" class="rc">Mutable borrow.</text>
  <text x="238" y="118" class="rc">Changes the instance.</text>
  <rect x="432" y="20" width="192" height="120" rx="10" fill="var(--rust-100)" stroke="var(--rust-400)" stroke-width="1.5"/>
  <text x="446" y="46" class="rh" fill="var(--rust-600)">self</text>
  <text x="446" y="72" class="rm">fn into_x(self)</text>
  <text x="446" y="100" class="rc">Takes ownership.</text>
  <text x="446" y="118" class="rc">Consumes the instance.</text>
</svg>
<figcaption>Pick your receiver like you pick a parameter: <b>read</b> → <code>&amp;self</code>, <b>modify</b> → <code>&amp;mut self</code>, <b>consume</b> → <code>self</code>.</figcaption>
</figure>

> [!tip] No `->` operator here
> In C or C++ you must remember when to use `.` versus `->`. Rust has **automatic referencing and dereferencing**: when you write `rect.area()`, Rust automatically adds `&`, `&mut`, or `*` as needed to match the method's receiver. You always just use `.` — one less thing to think about.

## Associated functions (functions without `self`)

Functions inside an `impl` block that *don't* take `self` are called **associated functions**. They're associated with the type itself, not an instance — think of them as "static" functions or, most often, **constructors**. You call them with `::`:

```rust
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    // Associated function (no self) — the conventional constructor.
    fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }
    // A second constructor for a special case.
    fn square(side: u32) -> Self {
        Self { width: side, height: side }
    }
}

fn main() {
    let rect = Rectangle::new(30, 50); // note the :: not .
    let sq = Rectangle::square(20);
    println!("{rect:?}, {sq:?}");
}
```

> [!jargon] `Self` (capital S)
> Inside an `impl` block, **`Self`** is a handy alias for the type being implemented. In `impl Rectangle`, `Self` means `Rectangle`. Using `Self` instead of repeating the name makes constructors easy to copy between types and clarifies intent. You've already seen `String::from` and `Vec::new` — those are associated functions too!

> [!best] Name your constructor `new`
> By strong convention, the primary constructor is an associated function called `new` that returns `Self`. Rust has no built-in constructors or `null`, so `Type::new(...)` is the idiom everyone recognizes. Provide extra named constructors (`from_str`, `with_capacity`, `square`) for alternative ways to build your type.

## Methods that take other parameters

Methods can take more parameters after `self`, and can reference other instances of the same type:

```rust
# #[derive(Debug)]
# struct Rectangle { width: u32, height: u32 }
impl Rectangle {
    fn new(width: u32, height: u32) -> Self { Self { width, height } }

    fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}

fn main() {
    let big = Rectangle::new(30, 50);
    let small = Rectangle::new(10, 20);
    println!("Can big hold small? {}", big.can_hold(&small)); // true
}
```

## Method chaining

Methods that return `Self` (or `&mut Self`) let you **chain** calls fluently — each call flows into the next. This is the basis of the popular *builder pattern*:

```rust
#[derive(Debug)]
struct QueryBuilder {
    table: String,
    limit: u32,
}

impl QueryBuilder {
    fn new(table: &str) -> Self {
        Self { table: table.to_string(), limit: 0 }
    }
    fn limit(mut self, n: u32) -> Self { // takes self, returns self → chainable
        self.limit = n;
        self
    }
}

fn main() {
    let query = QueryBuilder::new("users").limit(10);
    println!("{query:?}");
}
```

> [!note] Many small `impl` blocks are fine
> A type can have as many `impl` blocks as you like — Rust merges them. You'll often see behavior split across several blocks (one per trait, for example). Don't feel obliged to cram every method into one block.

## Summary

- **Methods** are functions defined in an **`impl`** block whose first parameter is **`self`** (the receiver), called with dot syntax.
- Choose the receiver by need: **`&self`** to read (most common), **`&mut self`** to modify, **`self`** to consume/transform.
- Rust auto-references and auto-dereferences, so you always use `.` — there's no `->`.
- **Associated functions** take no `self` and are called with `::`; the conventional constructor is **`new`**, returning **`Self`**.
- Methods returning `Self`/`&mut Self` enable fluent **method chaining** (the builder pattern).

> [!exercise] Try it yourself
> 1. Give `Rectangle` a `Rectangle::square(side)` constructor and an `is_square(&self) -> bool` method.
> 2. Add a `scale(&mut self, factor: u32)` method that multiplies both dimensions, then call it and print the new area.
> 3. Add an `into_area(self) -> u32` method that consumes the rectangle and returns its area. Try using the rectangle afterward and read the compiler error.

You can now model data (structs, enums), inspect it (patterns), and give it behavior (methods) — the complete toolkit for your program's types. Next, we learn to organize growing codebases with **modules**.
