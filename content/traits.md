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

## The orphan rule

There's one important restriction on implementing traits:

> [!key] The orphan rule (coherence)
> You can implement a trait for a type only if **you own the trait, or you own the type** (or both). You *cannot* implement someone else's trait for someone else's type — e.g. you can't `impl Display for Vec<T>`, because both `Display` and `Vec` belong to the standard library.
>
> **Why?** It prevents two different crates from each defining a conflicting implementation, which would make the meaning of your code depend on what else you happened to import. This rule keeps trait implementations globally unambiguous. The workaround, when you need it, is the *newtype pattern* — wrap the foreign type in your own struct (covered in [Advanced Traits](#/ch/advanced-traits)).

> [!deep] Blanket implementations
> A trait can be implemented for *every* type that satisfies some bound — a **blanket implementation**. The standard library does this famously: `impl<T: Display> ToString for T { … }` gives `.to_string()` to *anything* that can be `Display`ed. That's why `5.to_string()` and `"hi".to_string()` both just work. You can write blanket impls for your own traits too — a powerful way to add behavior across many types at once.

## Summary

- A **trait** defines shared behavior — a contract of methods a type can implement with `impl Trait for Type`.
- Traits can provide **default methods**, letting you build rich APIs from a few required methods (like `Iterator`).
- Accept trait-implementing types with **`impl Trait`** parameters (sugar for a generic **trait bound**); combine bounds with `+` and tidy them with `where`.
- **Return `impl Trait`** to hide a concrete type — but it must be one single type.
- **Derive** standard traits (`Debug`, `Clone`, `PartialEq`, …) instead of writing them.
- The **orphan rule** ensures trait implementations are unambiguous: implement a trait only if you own the trait or the type.

> [!exercise] Try it yourself
> 1. Define a trait `Animal { fn noise(&self) -> String; fn describe(&self) -> String { format!("I say {}", self.noise()) } }` and implement it for `Dog` and `Cat`.
> 2. Write `fn announce(a: &impl Animal)` that prints `a.describe()`, and call it with both.
> 3. Derive `Debug` and `PartialEq` on a `struct Version { major: u32, minor: u32 }` and compare two versions.

`impl Trait` requires one fixed type. But what if you want a `Vec` holding *different* types that share a trait — a mix of `Article`s and `Tweet`s? That's **trait objects** and dynamic dispatch, next.
