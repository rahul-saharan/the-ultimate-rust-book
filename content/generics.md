<h1><span class="h1-kicker">Generics, Traits & Lifetimes</span>Generics</h1>

Imagine writing `largest_i32`, `largest_char`, `largest_f64`… the same logic copied for every type. Tedious, error-prone, and impossible to keep in sync. **Generics** let you write the logic *once* and have it work for *any* type — with zero runtime cost. They're how `Vec<T>`, `Option<T>`, and `HashMap<K, V>` are built, and soon you'll build your own.

## The duplication problem

Here's a function that finds the largest number in a slice:

```rust
fn largest_i32(list: &[i32]) -> &i32 {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    println!("{}", largest_i32(&[34, 50, 25, 100, 65]));
}
```

Now you need the same for `char`, and `f64`, and... you'd copy-paste the *identical* logic and only change the type. Generics kill that duplication.

## Generic functions

A **generic** function introduces a *type parameter* — a placeholder, conventionally named `T` — in angle brackets after the function name. `T` stands in for whatever concrete type the caller uses:

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}

fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    let chars = vec!['y', 'm', 'a', 'q'];

    println!("Largest number: {}", largest(&numbers)); // works for i32
    println!("Largest char:   {}", largest(&chars));   // AND char, same code
}
```

> [!jargon] Type parameter & trait bound
> `<T>` declares a **type parameter** — a stand-in for a type the caller picks. The `: PartialOrd` part is a **trait bound**: a requirement that `T` must satisfy. Here it says "`T` must be comparable with `<`," which is exactly what our loop needs. You'll learn all about traits in the [next chapter](#/ch/traits) — for now, read a bound as "T must be able to do X."

> [!key] Why the bound is required
> Without `T: PartialOrd`, the compiler would reject `item > largest` — because *some* types can't be ordered, and Rust must guarantee the code works for **every** `T` you might use. The bound is a promise: "I'll only call this with types that can be compared." The compiler checks that promise at every call site. This is how generics stay completely type-safe.

## Generic structs and enums

Your own types can be generic too. Here's a `Point` that works with any coordinate type:

```rust
#[derive(Debug)]
struct Point<T> {
    x: T,
    y: T,
}

fn main() {
    let integer = Point { x: 5, y: 10 };
    let float = Point { x: 1.5, y: 4.2 };
    println!("{integer:?}");
    println!("{float:?}");
    // let mixed = Point { x: 5, y: 4.2 }; // ❌ both fields are T — must match
}
```

Need `x` and `y` to be *different* types? Use two parameters:

```rust
#[derive(Debug)]
struct Pair<T, U> {
    first: T,
    second: U,
}

fn main() {
    let mixed = Pair { first: 5, second: "hello" };
    println!("{mixed:?}");
}
```

You've already been using generic enums all along — `Option<T>` and `Result<T, E>` are exactly this:

```rust,ignore
enum Option<T> { Some(T), None }
enum Result<T, E> { Ok(T), Err(E) }
```

## Generic methods

Implement methods on a generic type by declaring the parameter after `impl`:

```rust
struct Point<T> {
    x: T,
    y: T,
}

impl<T> Point<T> {
    fn x(&self) -> &T {   // works for any T
        &self.x
    }
}

// You can also implement methods for ONE specific type only:
impl Point<f64> {
    fn distance_from_origin(&self) -> f64 { // only Point<f64> gets this
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

fn main() {
    let p = Point { x: 3.0, y: 4.0 };
    println!("x = {}", p.x());
    println!("distance = {}", p.distance_from_origin()); // 5.0
}
```

## The magic: zero-cost via monomorphization

Here's the part that makes Rust special: **generics have no runtime cost whatsoever.** How? At compile time, Rust performs **monomorphization** — a fancy word for "it generates a specialized copy of your generic code for each concrete type you actually use."

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="One generic function is compiled into specialized copies for each concrete type used">
  <style>
    .mgh { font: 700 12px var(--font-sans); }
    .mgm { font: 600 11.5px var(--font-mono); fill: var(--text); }
    .mgc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .gen { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .spec { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="mgh" fill="var(--purple)">You write ONCE:</text>
  <rect x="20" y="32" width="230" height="48" rx="8" class="gen"/>
  <text x="34" y="54" class="mgm">fn largest&lt;T: PartialOrd&gt;</text>
  <text x="34" y="72" class="mgm">   (list: &amp;[T]) -&gt; &amp;T</text>
  <text x="20" y="118" class="mgc">Used with i32 and char…</text>

  <text x="360" y="22" class="mgh" fill="var(--rust-600)">Compiler GENERATES:</text>
  <rect x="360" y="32" width="260" height="40" rx="8" class="spec"/>
  <text x="374" y="57" class="mgm">fn largest_i32(&amp;[i32]) -&gt; &amp;i32</text>
  <rect x="360" y="80" width="260" height="40" rx="8" class="spec"/>
  <text x="374" y="105" class="mgm">fn largest_char(&amp;[char]) -&gt; &amp;char</text>
  <path d="M252 56 C 310 56, 310 52, 358 52" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#amg)"/>
  <path d="M252 60 C 310 60, 310 100, 358 100" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#amg)"/>
  <text x="20" y="160" class="mgc">Each specialized copy is as fast as if you'd hand-written it for that exact type —</text>
  <text x="20" y="178" class="mgc">no boxing, no vtables, no dynamic dispatch. This is a "zero-cost abstraction."</text>
  <defs><marker id="amg" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><b>Monomorphization</b>: the compiler stamps out a fast, specialized version for every concrete type — so generics cost nothing at runtime.</figcaption>
</figure>

> [!performance] Generics vs. "generics" in other languages
> In many languages, generics have a runtime cost (boxing, type erasure, reflection). In Rust, a generic function called with `i32` compiles to the *exact same machine code* you'd get from a hand-written `i32` version. You get the flexibility of generics with the speed of specialized code. The only trade-off is slightly larger binaries and compile times, because there are more copies to compile.

> [!tip] The turbofish `::<>`
> Sometimes the compiler can't infer which type you want — for example, `"42".parse()` could produce many number types. You disambiguate with the *turbofish* syntax: `"42".parse::<i32>()` or `some_iter.collect::<Vec<_>>()`. The `::<Type>` after a method name says "use *this* concrete type for the generic." You'll see it often with `parse` and `collect`.

## Bounds with `where` for readability

When a function has several bounds, the inline syntax gets crowded. A `where` clause moves the bounds below the signature, keeping it readable:

```rust
use std::fmt::Display;

// Crowded inline bounds:
fn show_pair<T: Display + Clone, U: Display + Clone>(a: T, b: U) { /* … */ }

// Same thing, cleaner with `where`:
fn show_pair_clean<T, U>(a: T, b: U)
where
    T: Display + Clone,
    U: Display + Clone,
{
    println!("{a} and {b}");
}
# fn main() { show_pair_clean(1, "two"); }
```

## Summary

- **Generics** let you write code once that works for many types, using a **type parameter** like `<T>`.
- **Trait bounds** (`T: PartialOrd`) constrain what `T` must be able to do, keeping generic code fully type-safe.
- Structs, enums, and methods can all be generic; `Option<T>` and `Result<T, E>` are everyday examples.
- **Monomorphization** compiles a specialized copy per concrete type, so generics are a **zero-cost abstraction** — as fast as hand-written code.
- Use the **turbofish** (`::<Type>`) to disambiguate, and a **`where` clause** to keep many bounds readable.

> [!exercise] Try it yourself
> 1. Write a generic `fn first<T>(list: &[T]) -> &T` returning the first element, and call it with numbers and strings.
> 2. Make a generic `struct Wrapper<T> { value: T }` with a method `get(&self) -> &T`.
> 3. Use the turbofish to collect `1..=5` into a `Vec<i32>`: `(1..=5).collect::<Vec<i32>>()`.

Trait bounds hinted at something big. Now let's meet the feature that powers them — and much of Rust's design: **traits**.
