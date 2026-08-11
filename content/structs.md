<h1><span class="h1-kicker">Structuring Data</span>Structs</h1>

Programs are really about *things* — a user, an order, a game character, a network request. A **struct** (short for *structure*) lets you invent your own type by grouping related pieces of data together under one name, with each piece clearly labeled. Structs are the primary way you model the "nouns" of your program in Rust.

## Defining and creating a struct

You define a struct with the `struct` keyword, listing each **field** (a named piece of data) and its type:

```rust
struct User {
    username: String,
    email: String,
    active: bool,
    sign_in_count: u64,
}

fn main() {
    // Create an *instance* by giving every field a value:
    let user1 = User {
        username: String::from("ferris"),
        email: String::from("ferris@rust-lang.org"),
        active: true,
        sign_in_count: 1,
    };

    // Access a field with dot notation:
    println!("{} <{}>", user1.username, user1.email);
}
```

> [!jargon] Field vs. instance
> A **field** is one named slot in a struct (like `email`). An **instance** is a specific, filled-in value of the struct type (like `user1`). The struct definition is the blueprint; an instance is a house built from it.

To *change* a field, the whole instance must be `mut` — Rust doesn't let you mark individual fields mutable:

```rust
# struct User { username: String, email: String, active: bool, sign_in_count: u64 }
fn main() {
    let mut user1 = User {
        username: String::from("ferris"),
        email: String::from("ferris@rust-lang.org"),
        active: true,
        sign_in_count: 1,
    };
    user1.email = String::from("ferris@crab.dev"); // ✅ allowed because user1 is mut
    println!("New email: {}", user1.email);
}
```

## Two handy shortcuts

**Field init shorthand** — when a variable has the same name as the field, you can skip the `field: field` repetition:

```rust
# struct User { username: String, email: String, active: bool, sign_in_count: u64 }
fn build_user(email: String, username: String) -> User {
    User {
        email,      // instead of email: email
        username,   // instead of username: username
        active: true,
        sign_in_count: 1,
    }
}
# fn main() { let u = build_user("a@b.c".into(), "ana".into()); println!("{}", u.username); }
```

**Struct update syntax** — to build a new instance that's mostly a copy of another, fill in the fields you want and use `..other` for the rest:

```rust
# #[derive(Debug)]
# struct User { username: String, email: String, active: bool, sign_in_count: u64 }
fn main() {
    let user1 = User {
        username: String::from("ferris"),
        email: String::from("ferris@rust-lang.org"),
        active: true,
        sign_in_count: 1,
    };

    let user2 = User {
        email: String::from("ferris@crab.dev"),
        ..user1 // take username, active, sign_in_count from user1
    };
    println!("{} / {}", user2.username, user2.email);
}
```

> [!warning] Struct update can *move* data
> `..user1` **moves** any fields that aren't `Copy` (like the `String` `username`). After the update above, `user1.username` is no longer usable, because it was moved into `user2`. If you need both, `.clone()` the field explicitly. (Fields that *are* `Copy`, like `active`, are copied, not moved.)

## Printing structs with `#[derive(Debug)]`

Try to `println!("{}", user1)` and Rust complains — it doesn't know how to display your custom type. The fix is to *derive* the `Debug` trait, which auto-generates a developer-friendly representation you print with `{:?}`:

```rust
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

fn main() {
    let rect = Rectangle { width: 30, height: 50 };
    println!("{rect:?}");   // Rectangle { width: 30, height: 50 }
    println!("{rect:#?}");  // pretty-printed across multiple lines
}
```

> [!tip] `{:?}` vs `{:#?}` vs `dbg!`
> Use `{:?}` for compact debug output and `{:#?}` for a pretty, indented version — great for nested data. There's also the handy `dbg!` macro, which prints a value *with its file and line number* and returns it back: `let area = dbg!(width * height);`. It's the fastest way to peek at a value mid-expression.

> [!jargon] What does "derive" mean?
> **Deriving** a trait tells the compiler "please auto-generate the standard implementation of this behavior for my type." `#[derive(Debug)]` generates the code to format your struct for debugging. You'll derive `Clone`, `PartialEq`, `Hash`, and others the same way — see [Appendix C](#/ch/appendix-derivable) for the full list.

## Three flavors of struct

Rust actually has three kinds of struct, each for a different situation:

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="Named-field structs, tuple structs, and unit structs">
  <style>
    .sh2 { font: 700 13px var(--font-sans); }
    .sm2 { font: 600 12px var(--font-mono); fill: var(--text); }
    .sc2 { font: 11.5px var(--font-sans); fill: var(--text-mute); }
    .card2 { fill: var(--surface); stroke: var(--border-strong); stroke-width: 1.5; }
    .accent2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="16" y="20" width="200" height="170" rx="10" class="card2"/>
  <text x="30" y="44" class="sh2" fill="var(--rust-600)">Named-field</text>
  <rect x="30" y="56" width="170" height="60" rx="6" class="accent2"/>
  <text x="40" y="78" class="sm2">struct Point {</text>
  <text x="52" y="96" class="sm2">x: i32, y: i32,</text>
  <text x="40" y="112" class="sm2">}</text>
  <text x="30" y="140" class="sc2">Fields have names.</text>
  <text x="30" y="158" class="sc2">The default choice for</text>
  <text x="30" y="174" class="sc2">most data.</text>
  <rect x="228" y="20" width="200" height="170" rx="10" class="card2"/>
  <text x="242" y="44" class="sh2" fill="var(--blue)">Tuple struct</text>
  <rect x="242" y="56" width="170" height="42" rx="6" class="accent2"/>
  <text x="252" y="82" class="sm2">struct Rgb(u8,u8,u8);</text>
  <text x="242" y="126" class="sc2">Fields by position:</text>
  <text x="242" y="144" class="sc2">rgb.0, rgb.1, rgb.2</text>
  <text x="242" y="168" class="sc2">Good for simple wrappers.</text>
  <rect x="440" y="20" width="184" height="170" rx="10" class="card2"/>
  <text x="454" y="44" class="sh2" fill="var(--purple)">Unit struct</text>
  <rect x="454" y="56" width="156" height="30" rx="6" class="accent2"/>
  <text x="464" y="76" class="sm2">struct Marker;</text>
  <text x="454" y="116" class="sc2">No fields at all.</text>
  <text x="454" y="134" class="sc2">Useful as a "tag" that</text>
  <text x="454" y="152" class="sc2">carries only a type,</text>
  <text x="454" y="170" class="sc2">often with traits.</text>
</svg>
<figcaption>Pick the flavor that fits: <b>named</b> for clarity, <b>tuple</b> for lightweight wrappers, <b>unit</b> for type-only tags.</figcaption>
</figure>

**Tuple structs** have types but no field names — handy for giving a distinct type to a simple grouping, so the compiler stops you from mixing them up:

```rust
struct Point(i32, i32, i32);
struct Rgb(u8, u8, u8);

fn main() {
    let origin = Point(0, 0, 0);
    let white = Rgb(255, 255, 255);
    println!("x = {}, red = {}", origin.0, white.0);
    // A Point and an Rgb are DIFFERENT types, even though both hold three numbers.
}
```

**Unit structs** have no fields at all. They shine when you need a type to attach behavior to but hold no data (you'll see this with traits later).

## Ownership tip: prefer owned fields

Our `User` struct stored `String` (owned) rather than `&str` (borrowed). That's intentional: it means each `User` **owns** all its data and is valid for as long as the struct itself. Storing references in a struct is possible but requires **lifetimes** (a later [chapter](#/ch/lifetimes)) to prove the referenced data outlives the struct.

> [!best] When learning, give structs owned data
> Default to owned fields (`String`, `Vec<T>`, etc.) in your structs. It sidesteps lifetime annotations entirely and keeps your types self-contained. Reach for references-in-structs only when you have a measured reason and are comfortable with lifetimes.

## Summary

- A **struct** defines a custom type by grouping named **fields**; create an **instance** by filling every field.
- The whole instance must be `mut` to change any field; there's no per-field mutability.
- Use **field init shorthand** (`email,`) and **struct update syntax** (`..other`) to write less — but remember `..other` can *move* non-`Copy` fields.
- Derive **`Debug`** to print with `{:?}` / `{:#?}`, and reach for `dbg!` for quick inspection.
- There are three flavors: **named-field** (default), **tuple structs** (positional, great as distinct wrappers), and **unit structs** (no data).
- Prefer **owned** fields to avoid lifetimes while you're learning.

> [!exercise] Try it yourself
> 1. Define a `Rectangle { width, height }`, derive `Debug`, and print it with both `{:?}` and `{:#?}`.
> 2. Add a function `fn area(r: &Rectangle) -> u32`. (Next chapter you'll turn this into a *method*.)
> 3. Make a tuple struct `Meters(f64)` and a `Feet(f64)`, and write a function that converts one to the other — notice how the types keep you from mixing units.

Structs group data that's *always* present together. But sometimes a value should be *one of several possibilities* — that's the job of **enums**, coming up next.
