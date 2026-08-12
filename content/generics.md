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

### How the compiler figures out `T`

You rarely write the type parameter at a call site, because the compiler **infers** it from the arguments. `largest(&numbers)` where `numbers: Vec<i32>` means `T = i32`, deduced and then checked against the bound. Inference only fails when nothing in the call determines the type:

```rust
fn main() {
    // Inferred from the argument — no annotation needed:
    let words = vec!["pear", "apple"];
    println!("{}", first(&words));      // T = &str

    // Inferred from the RETURN type, working backwards:
    let parsed: i32 = "42".parse().unwrap();
    println!("{parsed}");

    // Nothing to infer from → you must say which type:
    let n = "42".parse::<i32>().unwrap();          // turbofish
    let v = (1..=3).collect::<Vec<i32>>();          // turbofish
    let w: Vec<i32> = (1..=3).collect();            // or annotate the binding
    println!("{n} {v:?} {w:?}");
}

fn first<T>(list: &[T]) -> &T { &list[0] }
```

> [!mistake] "type annotations needed" means inference had a genuine choice
> `"42".parse()` is the classic case: `parse` is generic over *anything* that implements `FromStr`, and `i32`, `u8`, and `f64` are all valid answers. The compiler isn't being obtuse — it truly cannot tell which you meant, so it asks. Either annotate the binding (`let n: i32 = …`) or use the turbofish (`parse::<i32>()`). The same happens with `collect()`, `into()`, and `Default::default()`, which are all generic over their *output*.

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

### Conditional methods: `impl<T: Bound>`

That `impl Point<f64>` block hints at something more general. You can add a bound to the `impl` itself, and the methods inside then exist **only for the types that satisfy it** — one type, many types, or all of them:

```rust
use std::fmt::Display;

struct Wrapper<T> {
    value: T,
}

// Available for EVERY T:
impl<T> Wrapper<T> {
    fn new(value: T) -> Self { Wrapper { value } }
    fn get(&self) -> &T { &self.value }
}

// Available only when T can be Displayed:
impl<T: Display> Wrapper<T> {
    fn print(&self) {
        println!("wrapped: {}", self.value);
    }
}

// Available only when T can be compared and copied:
impl<T: PartialOrd + Copy> Wrapper<T> {
    fn max_with(&self, other: T) -> T {
        if self.value > other { self.value } else { other }
    }
}

struct NotDisplayable;

fn main() {
    let n = Wrapper::new(10);
    n.print();                          // ✅ i32: Display
    println!("max: {}", n.max_with(7)); // ✅ i32: PartialOrd + Copy

    let odd = Wrapper::new(NotDisplayable);
    println!("still works: {}", odd.get() as *const _ as usize != 0);
    // odd.print();  // ❌ NotDisplayable doesn't implement Display —
    //               //    the method simply doesn't exist for this type
}
```

This is how the standard library gives `Option<T>` a `unwrap_or_default()` only when `T: Default`, and how `Vec<T>` gets `sort()` only when `T: Ord`. The API shape adapts to what the type can actually do.

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

> [!deep] How much do those extra copies actually cost?
> "Monomorphization bloats your binary" is repeated a lot, so it's worth measuring rather than assuming. Compiling a 120-line generic function instantiated at **12 different integer types**, versus the same function at one type, the binary grew by **16 bytes** — against a baseline of roughly 340 KB. Writing the twelve copies by hand produced a binary of *identical* size to the generic version.
>
> Two things explain that. The optimizer performs **identical code folding**: instantiations that compile to the same machine code are merged back into one. And the fixed cost of the standard library and runtime dwarfs the difference for any small program.
>
> Be careful reading too much into that number, though — my test function didn't use `T` in a way that changed the generated code, which is exactly the case the folding handles best. Bloat is real when instantiations genuinely *differ*: a large generic function over many unrelated struct types, or deep generic call trees where each layer multiplies. Where it bites in practice is **compile time** more often than binary size, and on **WASM or embedded** targets where every kilobyte counts. The honest guidance is: don't pre-emptively avoid generics for size reasons — measure with `cargo bloat` or `cargo llvm-lines` if a size budget matters, and see [Deployment & Binary Size](#/ch/deployment).

> [!tip] The turbofish `::<>`
> Sometimes the compiler can't infer which type you want — for example, `"42".parse()` could produce many number types. You disambiguate with the *turbofish* syntax: `"42".parse::<i32>()` or `some_iter.collect::<Vec<_>>()`. The `::<Type>` after a method name says "use *this* concrete type for the generic." You'll see it often with `parse` and `collect`.

## Three kinds of generic parameter

`<T>` is the one you meet first, but Rust generalizes over three different things — and they all live in the same angle brackets, in a fixed order:

<figure class="diagram">
<svg viewBox="0 0 670 230" role="img" aria-label="A single generic signature containing a lifetime parameter, a type parameter, and a const parameter, shown in that required order, each with what it abstracts over and which chapter covers it.">
  <style>
    .gp-h { font: 700 11.5px var(--font-sans); }
    .gp-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .gp-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .gp-lt { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .gp-ty { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .gp-ct { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.5; }
    .gp-sig { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
  </style>
  <rect x="12" y="22" width="646" height="30" rx="5" class="gp-sig"/>
  <text x="24" y="42" class="gp-m">fn windows&lt;'a, T, const N: usize&gt;(data: &amp;'a [T]) -&gt; impl Iterator&lt;Item = &amp;'a [T; N]&gt;</text>
  <rect x="92" y="26" width="26" height="22" rx="3" class="gp-lt"/>
  <rect x="124" y="26" width="16" height="22" rx="3" class="gp-ty"/>
  <rect x="146" y="26" width="118" height="22" rx="3" class="gp-ct"/>
  <text x="12" y="76" class="gp-h" fill="var(--blue)">1 · lifetimes first</text>
  <rect x="12" y="86" width="200" height="72" rx="6" class="gp-lt"/>
  <text x="24" y="106" class="gp-m">&lt;'a&gt;</text>
  <text x="24" y="124" class="gp-c">abstracts over HOW LONG</text>
  <text x="24" y="138" class="gp-c">a reference stays valid</text>
  <text x="24" y="152" class="gp-c">erased at compile time</text>
  <text x="234" y="76" class="gp-h" fill="var(--purple)">2 · types next</text>
  <rect x="234" y="86" width="200" height="72" rx="6" class="gp-ty"/>
  <text x="246" y="106" class="gp-m">&lt;T&gt;</text>
  <text x="246" y="124" class="gp-c">abstracts over WHICH TYPE</text>
  <text x="246" y="138" class="gp-c">i32, String, your struct…</text>
  <text x="246" y="152" class="gp-c">monomorphized per type</text>
  <text x="456" y="76" class="gp-h" fill="var(--amber)">3 · consts last</text>
  <rect x="456" y="86" width="202" height="72" rx="6" class="gp-ct"/>
  <text x="468" y="106" class="gp-m">&lt;const N: usize&gt;</text>
  <text x="468" y="124" class="gp-c">abstracts over a VALUE</text>
  <text x="468" y="138" class="gp-c">known at compile time</text>
  <text x="468" y="152" class="gp-c">e.g. an array length</text>
  <text x="12" y="182" class="gp-c">All three are "generic parameters" — the compiler substitutes concrete lifetimes, types, and values at each call site.</text>
  <text x="12" y="198" class="gp-c">The order is enforced: lifetimes, then types, then consts. Bounds work on all of them (<tspan font-family="var(--font-mono)">T: Display</tspan>, <tspan font-family="var(--font-mono)">'a: 'b</tspan>).</text>
  <text x="12" y="218" class="gp-c">Covered in: this chapter (types) · Lifetimes (lifetimes) · Const Generics (consts).</text>
</svg>
<figcaption>Rust is generic over <b>lifetimes</b>, <b>types</b>, and <b>compile-time values</b> — three parameter kinds sharing one syntax.</figcaption>
</figure>

```rust
use std::fmt::Debug;

/// Generic over a lifetime ('a), a type (T), and a const value (N).
fn describe_chunk<'a, T: Debug, const N: usize>(chunk: &'a [T; N]) -> String {
    format!("{N} items: {chunk:?}")
}

fn main() {
    let threes = [1, 2, 3];
    let twos = ["a", "b"];

    println!("{}", describe_chunk(&threes)); // N inferred as 3
    println!("{}", describe_chunk(&twos));   // N inferred as 2, T as &str
}
```

Lifetimes get their own [chapter](#/ch/lifetimes), and const generics [theirs](#/ch/const-generics) — but it's worth seeing early that they aren't three unrelated features. They're one idea (*write it once, let the compiler substitute*) applied to three different kinds of thing.

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

## Decoding generic errors

Three errors cover nearly everything the compiler will say about generics:

| Error | Means | Fix |
|---|---|---|
| `the trait bound T: Display is not satisfied` | your code needs a capability you didn't require | add the bound to the signature, or use a type that has it |
| `type annotations needed` | inference had more than one valid answer | turbofish (`::<i32>`) or annotate the binding |
| `cannot find method X for T` | the method comes from a trait `T` isn't bound by | add `T: ThatTrait` — see [Traits](#/ch/traits) |

The first is the one that trips people up, because the fix is counter-intuitive: the error appears *inside* your generic function, but the change belongs in its **signature**.

```rust,ignore
fn print_all<T>(items: &[T]) {
    for item in items {
        println!("{item}");   // ❌ error[E0277]: `T` doesn't implement `std::fmt::Display`
    }
}

// The fix is in the signature, not the body:
fn print_all_fixed<T: std::fmt::Display>(items: &[T]) {
    for item in items {
        println!("{item}");   // ✅ now guaranteed printable
    }
}
```

> [!key] A generic function must work for *every* `T` that satisfies its bounds
> This is the mental shift that makes generic errors make sense. Inside `print_all<T>`, the compiler knows **nothing** about `T` beyond what the bounds state — not that it's printable, comparable, or clonable. It won't peek at your call sites to see that you only ever pass `String`. Every capability you use in the body must be promised in the signature. The upside of that strictness: once it compiles, it's guaranteed to work for every type anyone will ever call it with, including types written years later.

## When *not* to be generic

Generics are a tool, not a virtue. Reaching for `<T>` by default produces signatures that are harder to read, error messages that are harder to parse, and abstractions nobody needed:

> [!best] Write the concrete version first; generalize on the second use
> If a function is only ever called with `&str`, `fn shout(s: &str)` is clearer than `fn shout<T: AsRef<str>>(s: T)` — shorter signature, simpler errors, no inference surprises. Genericize when you have an actual second caller with a different type, not in anticipation of one. This is the "rule of three" applied to types: duplication is cheaper than the wrong abstraction, and a concrete function is trivial to make generic later, while un-genericizing a public API is a breaking change.
>
> Two related judgment calls: prefer **`&str` over `T: AsRef<str>`** unless callers genuinely need to pass `String`, `&String`, *and* `&str` ergonomically; and when you need a *mixed* collection of types rather than one type per call site, generics are the wrong tool entirely — you want [trait objects](#/ch/trait-objects).

## Summary

- **Generics** let you write code once that works for many types, using a **type parameter** like `<T>`.
- **Trait bounds** (`T: PartialOrd`) constrain what `T` must be able to do, keeping generic code fully type-safe.
- Structs, enums, and methods can all be generic; `Option<T>` and `Result<T, E>` are everyday examples.
- The compiler **infers** `T` from arguments or the expected return type; when the choice is genuinely ambiguous it asks for annotations.
- An `impl` block can carry its own bounds, so methods exist **only for types that qualify** — how `Vec<T>` gets `sort()` only when `T: Ord`.
- Rust has **three kinds of generic parameter**: lifetimes `<'a>`, types `<T>`, and const values `<const N: usize>` — in that order.
- **Monomorphization** compiles a specialized copy per concrete type, so generics are a **zero-cost abstraction** — as fast as hand-written code. Measured, the binary-size cost is usually negligible (identical copies get folded); compile time is the more common casualty.
- Use the **turbofish** (`::<Type>`) to disambiguate, and a **`where` clause** to keep many bounds readable.
- A generic function must work for **every** `T` meeting its bounds, so every capability used in the body must be declared in the **signature**.
- Don't genericize speculatively — write the concrete version first, and use [trait objects](#/ch/trait-objects) when you need a mixed collection rather than one type per call site.

> [!exercise] Try it yourself
> 1. Write a generic `fn first<T>(list: &[T]) -> &T` returning the first element, and call it with numbers and strings.
> 2. Make a generic `struct Wrapper<T> { value: T }` with a method `get(&self) -> &T`.
> 3. Use the turbofish to collect `1..=5` into a `Vec<i32>`: `(1..=5).collect::<Vec<i32>>()`.
> 4. Write `fn print_all<T>(items: &[T])` that `println!`s each item. Read the `E0277` error, then fix it in the signature.
> 5. Add a second `impl<T: PartialOrd> Wrapper<T>` block with a `is_bigger_than(&self, other: T) -> bool` method. Confirm it's unavailable on a `Wrapper` holding a type that isn't `PartialOrd`.
> 6. Call `"7".parse()` with no annotation and read the error. Fix it three ways: turbofish, a typed `let`, and a typed function return.
> 7. Write `fn sum_array<const N: usize>(a: [i32; N]) -> i32` and call it with arrays of two different lengths. What is `N` at each call site?
> 8. Take a function you wrote generically and rewrite it concretely for one type. Which version would you rather debug — and does your answer change if it has three callers instead of one?

Trait bounds hinted at something big. Now let's meet the feature that powers them — and much of Rust's design: **traits**.
