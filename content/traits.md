<h1><span class="h1-kicker">Generics, Traits & Lifetimes</span>Traits: Defining Shared Behavior</h1>

A **trait** defines *shared behavior* — a set of methods that a type can implement to say "I can do this." If you've used interfaces in Java or C#, protocols in Swift, or duck typing in Python, traits will feel familiar — but Rust's version is more powerful and, thanks to generics, completely free at runtime. Traits are arguably the most important feature in Rust after ownership; they're everywhere.

## Defining a trait

A trait is a named collection of method signatures. Here's one that says "this type can summarize itself":

```rust,ignore
trait Summary {
    fn summarize(&self) -> String; // a method signature, no body yet
}
```

Any type that wants to be `Summary` must provide a `summarize` method.

> [!jargon] Trait
> A **trait** is a contract: a set of methods a type promises to provide. "Type `X` implements trait `Y`" means `X` supplies all of `Y`'s methods. Traits let you write code that works with *any* type that fulfills the contract, without caring what the type actually is.

## Implementing a trait for your types

Use `impl Trait for Type` to fulfill the contract. Different types can implement the same trait in their own way:

```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct Article {
    title: String,
    author: String,
}

struct Tweet {
    username: String,
    content: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("\"{}\" by {}", self.title, self.author)
    }
}

impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.username, self.content)
    }
}

fn main() {
    let article = Article { title: "Rust Rocks".into(), author: "Ferris".into() };
    let tweet = Tweet { username: "rustlang".into(), content: "1.0 is out!".into() };

    println!("{}", article.summarize());
    println!("{}", tweet.summarize());
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="One trait, implemented by several different types in their own way">
  <style>
    .trh { font: 700 12px var(--font-sans); }
    .trm { font: 600 12px var(--font-mono); fill: var(--text); }
    .trc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .trait2 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 2; }
    .impl2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="230" y="16" width="180" height="46" rx="10" class="trait2"/>
  <text x="252" y="38" class="trm" fill="var(--purple)">trait Summary</text>
  <text x="252" y="55" class="trc">fn summarize(&amp;self)</text>
  <rect x="20" y="120" width="170" height="44" rx="8" class="impl2"/>
  <text x="34" y="141" class="trm">Article</text><text x="34" y="158" class="trc">"title" by author</text>
  <rect x="235" y="120" width="170" height="44" rx="8" class="impl2"/>
  <text x="249" y="141" class="trm">Tweet</text><text x="249" y="158" class="trc">@user: content</text>
  <rect x="450" y="120" width="170" height="44" rx="8" class="impl2"/>
  <text x="464" y="141" class="trm">Weather</text><text x="464" y="158" class="trc">18°C, sunny</text>
  <path d="M300 64 L120 118" stroke="var(--purple)" stroke-width="1.5" fill="none"/>
  <path d="M320 64 L320 118" stroke="var(--purple)" stroke-width="1.5" fill="none"/>
  <path d="M340 64 L520 118" stroke="var(--purple)" stroke-width="1.5" fill="none"/>
  <text x="415" y="45" class="trc">each type implements</text>
  <text x="415" y="59" class="trc">it in its own way ↓</text>
</svg>
<figcaption>One trait, many implementations. Code written against <code>Summary</code> works with all of them.</figcaption>
</figure>

> [!key] Traits are not inheritance — behavior is bolted on, never inherited
> The most useful thing to unlearn from OO languages: a trait adds **behavior to an existing type**, it doesn't create a parent-child relationship. `Article` isn't a "kind of" `Summary` — it's a plain struct that happens to also satisfy a contract. Three consequences follow:
> - A type can implement **any number** of unrelated traits, with no diamond problem and no ordering issues.
> - Traits carry **no data** — there are no fields to inherit. Shared *state* comes from composition (a struct field), shared *behavior* from traits. Rust keeps them strictly separate.
> - You can implement a trait for a type **long after that type was written**, including for `i32` and `String`. An interface has to be declared at the class's birth; a trait can be added at any time by anyone who owns either side.

## Method receivers: `&self`, `&mut self`, and `self`

A trait method's first parameter decides what the caller may do with the value — the same [ownership](#/ch/ownership) rules you already know, applied to the contract:

```rust
trait Shape {
    fn area(&self) -> f64;          // borrow: read-only, callable many times
    fn scale(&mut self, k: f64);    // mutable borrow: may modify in place
    fn into_name(self) -> String;   // by value: CONSUMES the shape
}

struct Circle { radius: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { 3.14159 * self.radius * self.radius }
    fn scale(&mut self, k: f64) { self.radius *= k; }
    fn into_name(self) -> String { format!("circle of radius {}", self.radius) }
}

fn main() {
    let mut c = Circle { radius: 1.0 };
    println!("area      {:.2}", c.area());
    c.scale(2.0);
    println!("scaled    {:.2}", c.area());
    println!("consumed: {}", c.into_name());
    // c is gone now — into_name took ownership.
}
```

A trait may also declare an **associated function** with no `self` at all — typically a constructor:

```rust
trait Zeroed {
    fn zero() -> Self;              // no self: called as Type::zero()
    fn is_zero(&self) -> bool;
}

impl Zeroed for i32 {
    fn zero() -> Self { 0 }
    fn is_zero(&self) -> bool { *self == 0 }
}

impl Zeroed for f64 {
    fn zero() -> Self { 0.0 }
    fn is_zero(&self) -> bool { *self == 0.0 }
}

// Generic code can now *construct* values, not just inspect them:
fn sum_or_zero<T: Zeroed + Copy + std::ops::Add<Output = T>>(items: &[T]) -> T {
    let mut total = T::zero();      // ← the associated function
    for &i in items {
        if i.is_zero() { continue; } // ← the &self method
        total = total + i;
    }
    total
}

fn main() {
    println!("{}", sum_or_zero(&[1, 0, 2, 3]));
    println!("{}", sum_or_zero(&[1.5, 0.0, 2.5]));
    println!("{}", sum_or_zero::<i32>(&[]));   // T::zero() saves the empty case
}
```

Note the `-> Self` return type: inside a trait, **`Self`** (capital S) means "whichever type is implementing this," so one signature serves every implementer.

## Default method implementations

A trait can provide a **default** body for a method. Types get it for free, and may override it if they want something special:

```rust
trait Summary {
    fn summarize(&self) -> String;

    // Default method — uses summarize(); types needn't implement it.
    fn preview(&self) -> String {
        format!("(read more) {}", self.summarize())
    }
}

struct Note { text: String }
impl Summary for Note {
    fn summarize(&self) -> String { self.text.clone() }
    // preview() is inherited for free
}

fn main() {
    let n = Note { text: "Buy milk".into() };
    println!("{}", n.preview()); // (read more) Buy milk
}
```

> [!tip] Default methods build big APIs from small ones
> This is how the standard library's `Iterator` trait works: you implement one method (`next`), and get dozens of default methods (`map`, `filter`, `sum`, …) for free. Design your traits the same way — a few *required* methods, many *default* ones built on top. Implementers do little; users get a lot.

## A trait must be in scope to use its methods

This is the single most common trait error beginners hit, and it looks nothing like a trait problem. **A trait's methods are only callable where the trait itself is in scope.** Import the type but not the trait, and the method appears not to exist:

```text
error[E0599]: no method named `write_all` found for struct `File` in the current scope
   |
14 |     file.write_all(b"hello")?;
   |          ^^^^^^^^^ method not found in `File`
   |
   = help: items from traits can only be used if the trait is in scope
help: trait `Write` which provides `write_all` is implemented but not in scope;
      perhaps you want to import it
   |
1  + use std::io::Write;
   |
```

<figure class="diagram">
<svg viewBox="0 0 660 180" role="img" aria-label="Without importing the Write trait, File appears to have no write_all method. Adding use std::io::Write brings the trait's methods into scope and the same call compiles.">
  <style>
    .sc-h { font: 700 11.5px var(--font-sans); }
    .sc-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .sc-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .sc-no { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .sc-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .sc-t { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
    .sc-f { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
  </style>
  <text x="12" y="16" class="sc-h" fill="var(--red)">Trait NOT imported</text>
  <rect x="12" y="26" width="130" height="26" rx="5" class="sc-f"/><text x="22" y="43" class="sc-m">use std::fs::File;</text>
  <rect x="12" y="60" width="130" height="40" rx="5" class="sc-f"/>
  <text x="22" y="77" class="sc-m">File</text><text x="22" y="92" class="sc-c">methods you can see</text>
  <rect x="12" y="108" width="130" height="26" rx="5" class="sc-no"/><text x="22" y="125" class="sc-m">.write_all() ✗</text>
  <text x="12" y="152" class="sc-c">"no method named write_all"</text>
  <text x="12" y="166" class="sc-c">— yet File DOES implement Write.</text>
  <rect x="196" y="60" width="150" height="40" rx="6" class="sc-t"/>
  <text x="206" y="77" class="sc-m">trait Write</text>
  <text x="206" y="92" class="sc-c">impl exists, just unseen</text>
  <path d="M200 96 L146 120" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/>
  <text x="380" y="16" class="sc-h" fill="var(--green)">Trait imported</text>
  <rect x="380" y="26" width="180" height="26" rx="5" class="sc-f"/><text x="390" y="43" class="sc-m">use std::fs::File;</text>
  <rect x="380" y="60" width="180" height="26" rx="5" class="sc-t"/><text x="390" y="77" class="sc-m">use std::io::Write;</text>
  <rect x="380" y="94" width="180" height="26" rx="5" class="sc-ok"/><text x="390" y="111" class="sc-m">.write_all() ✓</text>
  <text x="380" y="140" class="sc-c">The impl didn't change — only</text>
  <text x="380" y="154" class="sc-c">your visibility of it did.</text>
</svg>
<figcaption>The implementation always existed. Importing the trait is what makes its methods callable.</figcaption>
</figure>

> [!mistake] "No method named X" usually means a missing `use`, not a missing impl
> When the compiler says a method doesn't exist on a type you're *sure* has it, check for a missing trait import before anything else. Common culprits: `std::io::Write` / `std::io::Read` (for `write_all`, `read_to_string`), `std::io::BufRead` (for `.lines()`), `std::fmt::Write` (for `write!` into a `String`), `Itertools` from the [itertools](#/ch/itertools) crate, and `rand::Rng` (for `.gen_range()`). Modern rustc almost always suggests the exact `use` line — read past the first line of the error. This is also why crates ship a **prelude** (`use tokio::prelude::*`): it's a bundle of the traits you need in scope to use the library at all.

## Traits as function parameters

Now the payoff. You can write a function that accepts *any* type implementing a trait. The clean syntax is `impl Trait`:

```rust
# trait Summary { fn summarize(&self) -> String; }
# struct Tweet { username: String, content: String }
# impl Summary for Tweet { fn summarize(&self) -> String { format!("@{}: {}", self.username, self.content) } }
fn notify(item: &impl Summary) {
    println!("🔔 Breaking news! {}", item.summarize());
}

fn main() {
    let tweet = Tweet { username: "rustlang".into(), content: "traits!".into() };
    notify(&tweet); // works with any &impl Summary
}
```

`&impl Summary` is shorthand for a **trait bound** on a generic — these two signatures are identical:

```rust,ignore
fn notify(item: &impl Summary)          { /* … */ } // shorthand
fn notify<T: Summary>(item: &T)         { /* … */ } // explicit generic + bound
```

You can require multiple traits with `+`, and use `where` for readability:

```rust,ignore
fn process<T: Summary + Clone>(item: &T) { /* … */ }

fn process2<T>(item: &T)
where T: Summary + Clone
{ /* … */ }
```

> [!note] When the shorthand *isn't* enough
> `impl Trait` and the generic form differ in one way: with a named parameter `<T>` you can **refer to the type**, and force two arguments to be the *same* type. `fn pair<T: Summary>(a: &T, b: &T)` requires both to be `Tweet`, or both `Article`. Whereas `fn pair(a: &impl Summary, b: &impl Summary)` lets you pass one of each, because each `impl Trait` is an independent type parameter. You also need the named form to use a turbofish (`notify::<Tweet>(…)`) or to name the type in a `where` clause. Start with `impl Trait`; reach for `<T>` when you need to tie things together.

## The three ways to accept a trait

Once several types implement a trait, you have three ways to write code against it, and picking the right one is a real design decision:

| Form | Dispatch | Choose it when |
|---|---|---|
| `fn f(x: &impl Trait)` / `fn f<T: Trait>(x: &T)` | **static** — one copy compiled per concrete type | the default; fastest, inlinable, type known at compile time |
| `fn f(x: &dyn Trait)` | **dynamic** — one copy, looked up at runtime | you need a *mixed* collection, or want to shrink compiled size |
| `fn f(x: Box<dyn Trait>)` | **dynamic**, owned | same, but the value must be stored/returned |

Static dispatch is the right default — it's what `impl Trait` gives you, and it costs nothing at runtime. The moment you need a `Vec` holding *different* types that share a trait, static dispatch can't express it and you reach for `dyn`. That's the whole subject of the [next chapter](#/ch/trait-objects), including the performance trade-off and which traits are even eligible.

## Returning a type that implements a trait

You can also return `impl Trait`, which is handy for hiding a complex concrete type (like a closure or iterator) behind the behavior it provides:

```rust
# trait Summary { fn summarize(&self) -> String; }
# struct Tweet { username: String, content: String }
# impl Summary for Tweet { fn summarize(&self) -> String { format!("@{}: {}", self.username, self.content) } }
fn make_summary() -> impl Summary {
    Tweet { username: "ferris".into(), content: "I return impl Trait".into() }
}

fn main() {
    println!("{}", make_summary().summarize());
}
```

> [!note] `impl Trait` return picks ONE concrete type
> `-> impl Summary` means "I return *some single* type that implements `Summary`" — decided at compile time. You can't return `Article` from one branch and `Tweet` from another with `impl Trait`; for that you need a **trait object** (`Box<dyn Summary>`), the subject of the [next chapter](#/ch/trait-objects).

## Deriving common traits

For standard behaviors, you don't implement traits by hand — you **derive** them, and the compiler writes the implementation:

```rust
#[derive(Debug, Clone, PartialEq)]
struct Color {
    r: u8,
    g: u8,
    b: u8,
}

fn main() {
    let red = Color { r: 255, g: 0, b: 0 };
    let also_red = red.clone();
    println!("{red:?}");                 // Debug
    println!("equal? {}", red == also_red); // PartialEq
}
```

`Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `Hash`, `PartialOrd`, `Ord`, and `Default` are all derivable — see [Appendix C](#/ch/appendix-derivable) for the full list and when to use each.

### `Display` is the one you must write yourself

`Debug` (`{:?}`) is derivable and meant for *programmers*. `Display` (`{}`) is **not** derivable and meant for *users* — because only you can decide how your type should read in a sentence:

```rust
use std::fmt;

struct Temperature { celsius: f64 }

impl fmt::Display for Temperature {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        // write! into the formatter; the ? propagates any write error
        write!(f, "{:.1}°C", self.celsius)
    }
}

fn main() {
    let t = Temperature { celsius: 21.567 };
    println!("{t}");                      // 21.6°C   ← Display
    println!("{}", t.to_string());        // 21.6°C   ← free via the ToString blanket impl
    // println!("{t:?}");                 // ❌ won't compile — Debug not derived
}
```

Implementing `Display` also gets you `.to_string()` for free, via a blanket implementation in the standard library ([Advanced Traits](#/ch/advanced-traits) explains how that works).

## The standard-library traits worth knowing early

Much of what looks like *syntax* in Rust is actually a trait you can implement. This table is the map — it explains why so many features "just work" on your own types once you implement the right trait:

| Trait | Unlocks | Derivable? |
|---|---|---|
| `Debug` | `{:?}` formatting, `assert_eq!` output | ✅ |
| `Display` | `{}` formatting, `.to_string()` | ❌ write by hand |
| `Clone` / `Copy` | `.clone()` / implicit copying | ✅ |
| `PartialEq` / `Eq` | `==`, `!=` | ✅ |
| `PartialOrd` / `Ord` | `<`, `>`, `.sort()`, `BTreeMap` keys | ✅ |
| `Hash` | use as a `HashMap`/`HashSet` key | ✅ |
| `Default` | `Type::default()`, `..Default::default()` | ✅ |
| `From` / `Into` | `.into()`, `?` error conversion | ❌ |
| `Iterator` | `for` loops, `.map()`, `.filter()`, … | ❌ |
| `Drop` | automatic cleanup at end of scope | ❌ |
| `Add`, `Mul`, … | the `+`, `*` operators | ❌ |
| `Deref` | auto-deref (`&String` → `&str`) | ❌ |

> [!best] Implement `Debug` on everything, `Display` on things users see
> `#[derive(Debug)]` costs one line and pays for itself the first time a test fails or you need a log line — `assert_eq!` prints values through `Debug`, so without it you get a compile error at the worst moment. Add it to essentially every type you define. `Display`, by contrast, is a deliberate choice: implement it only when a type has *one* obvious human-facing representation. If a type could reasonably be shown several ways, provide named methods instead and let the caller choose.

## Designing good traits

A few habits separate traits that are pleasant to implement from traits that are a chore:

> [!best] Keep the required surface small
> Ask "what is the *minimum* an implementer must provide?" and put everything else in default methods. `Iterator` requires exactly one method (`next`) and offers around 70 defaults — which is why implementing it feels trivial and using it feels rich. A trait with eight required methods is a trait people avoid implementing. If your trait has grown large, that's usually a sign it should be split into two.

> [!tip] Name traits for capability, not category
> The convention is a verb-ish or `-able` name describing *what the type can do*: `Display`, `Clone`, `Iterator`, `Read`, `Write`, `Serialize`. Avoid noun-y category names inherited from class hierarchies (`AbstractAnimalBase`) — a trait isn't a classification, it's a capability. When a trait is a pure label with no methods at all (like [`Send` and `Sync`](#/ch/send-sync)), it's called a **marker trait**; the compiler and generic bounds can still check it even though there's nothing to call.

## The orphan rule

There's one important restriction on implementing traits:

> [!key] The orphan rule (coherence)
> You can implement a trait for a type only if **you own the trait, or you own the type** (or both). You *cannot* implement someone else's trait for someone else's type — e.g. you can't `impl Display for Vec<T>`, because both `Display` and `Vec` belong to the standard library.
>
> **Why?** It prevents two different crates from each defining a conflicting implementation, which would make the meaning of your code depend on what else you happened to import. This rule keeps trait implementations globally unambiguous. The workaround, when you need it, is the *newtype pattern* — wrap the foreign type in your own struct (covered in [Advanced Traits](#/ch/advanced-traits)).

> [!deep] Blanket implementations
> A trait can be implemented for *every* type that satisfies some bound — a **blanket implementation**. The standard library does this famously: `impl<T: Display> ToString for T { … }` gives `.to_string()` to *anything* that can be `Display`ed. That's why `5.to_string()` and `"hi".to_string()` both just work. You can write blanket impls for your own traits too — a powerful way to add behavior across many types at once.

## Where this goes next

| Question | Chapter |
|---|---|
| How do I hold a `Vec` of *different* types sharing a trait? | [Trait Objects & Dynamic Dispatch](#/ch/trait-objects) |
| How do generics compile to zero-cost code? | [Generics](#/ch/generics) |
| Associated types, operators, supertraits, newtypes | [Advanced Traits](#/ch/advanced-traits) |
| Which traits can I `#[derive]`, and what does each give me? | [Appendix C · Derivable Traits](#/ch/appendix-derivable) |
| How do `Send`/`Sync` use traits to guarantee thread safety? | [Send, Sync & Thread Safety](#/ch/send-sync) |

## Summary

- A **trait** defines shared behavior — a contract of methods a type can implement with `impl Trait for Type`.
- Traits are **not inheritance**: they add behavior to existing types, carry no data, and can be implemented long after a type was written.
- Method receivers follow ownership: **`&self`** (read), **`&mut self`** (modify), **`self`** (consume); a method with no `self` is an **associated function**, and **`Self`** names the implementing type.
- Traits can provide **default methods**, letting you build rich APIs from a few required methods (like `Iterator`).
- **A trait must be in scope to call its methods** — "no method named X" usually means a missing `use`, not a missing impl.
- Accept trait-implementing types with **`impl Trait`** parameters (sugar for a generic **trait bound**); combine bounds with `+` and tidy them with `where`. Use the named `<T>` form when two arguments must be the *same* type.
- **Return `impl Trait`** to hide a concrete type — but it must be one single type.
- **Derive** standard traits (`Debug`, `Clone`, `PartialEq`, …) instead of writing them; **`Display` is not derivable** and gives you `.to_string()` for free.
- Much of Rust's "syntax" is traits: `{}`, `==`, `+`, `for`, and auto-cleanup are all trait implementations you can provide.
- Design traits with a **small required surface** and many defaults; name them for capability.
- The **orphan rule** ensures trait implementations are unambiguous: implement a trait only if you own the trait or the type.

> [!exercise] Try it yourself
> 1. Define a trait `Animal { fn noise(&self) -> String; fn describe(&self) -> String { format!("I say {}", self.noise()) } }` and implement it for `Dog` and `Cat`.
> 2. Write `fn announce(a: &impl Animal)` that prints `a.describe()`, and call it with both.
> 3. Derive `Debug` and `PartialEq` on a `struct Version { major: u32, minor: u32 }` and compare two versions.
> 4. Add `fn legs(&self) -> u32` with a default of `4` to `Animal`, then override it for a `Bird`.
> 5. Implement `Display` for `Version` so it prints `1.4`, then call `.to_string()` on it without implementing `ToString`.
> 6. Write `fn loudest<T: Animal>(a: &T, b: &T) -> String`. Try calling it with a `Dog` and a `Cat` — explain the error, then fix it by switching to `&dyn Animal` or two type parameters.
> 7. Add a `fn new_default() -> Self` associated function to `Animal` and call it as `Dog::new_default()`. Why can't you call it on a `&dyn Animal`?
> 8. In a fresh file, call `.write_all(b"hi")` on a `File` *without* importing `std::io::Write`. Read the error, then fix it — this is the error you'll hit most often in real code.

`impl Trait` requires one fixed type. But what if you want a `Vec` holding *different* types that share a trait — a mix of `Article`s and `Tweet`s? That's **trait objects** and dynamic dispatch, next.
