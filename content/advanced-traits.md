<h1><span class="h1-kicker">Generics, Traits & Lifetimes</span>Advanced Traits</h1>

You've got the essentials of traits. This chapter collects the *advanced* trait features — the ones that power operator overloading, elegant standard-library APIs, and clever type-safety tricks. You won't need all of these every day, but recognizing them will let you read real-world Rust fluently and design better abstractions of your own.

## Associated types

An **associated type** is a placeholder type that a trait declares and each implementer fills in. You've been *using* one all along: the `Iterator` trait has an associated type `Item`:

```rust
trait Container {
    type Item;                              // associated type: "what do I hold?"
    fn get(&self, i: usize) -> Option<&Self::Item>;
    fn first(&self) -> Option<&Self::Item> { // default method uses it
        self.get(0)
    }
}

struct Numbers { data: Vec<i32> }

impl Container for Numbers {
    type Item = i32;                        // fill in the placeholder
    fn get(&self, i: usize) -> Option<&i32> {
        self.data.get(i)
    }
}

fn main() {
    let n = Numbers { data: vec![10, 20, 30] };
    println!("{:?}", n.first()); // Some(10)
}
```

> [!key] Associated types vs. generic parameters
> Why `type Item` instead of `trait Container<T>`? Because a type implements the trait **once**, with **one** choice of `Item`. `Numbers` *is* a container of `i32` — full stop. A generic `Container<T>` would let a type implement it many times (as `Container<i32>`, `Container<String>`, …), which is rarely what you want and makes call sites need annotations. Use an **associated type** when there's one natural choice per implementer; use a **generic parameter** when a type should implement the trait for many types.

## Operator overloading with default generic type parameters

Rust lets you give operators like `+` meaning for your own types by implementing traits from `std::ops`. Here we teach `+` to add two points:

```rust
use std::ops::Add;

#[derive(Debug, Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}

impl Add for Point {
    type Output = Point; // what `+` produces
    fn add(self, other: Point) -> Point {
        Point { x: self.x + other.x, y: self.y + other.y }
    }
}

fn main() {
    let sum = Point { x: 1, y: 2 } + Point { x: 3, y: 4 };
    println!("{sum:?}"); // Point { x: 4, y: 6 }
}
```

The `Add` trait is actually `Add<Rhs = Self>` — it has a **default generic type parameter** (`Rhs`, the right-hand side, defaulting to `Self`). That default is why `impl Add for Point` "just works" for `Point + Point`. You can override it to add *different* types, like scaling a point by an integer:

```rust
use std::ops::Add;
# #[derive(Debug, Clone, Copy)]
# struct Point { x: i32, y: i32 }

impl Add<i32> for Point {          // Rhs = i32 instead of the default Self
    type Output = Point;
    fn add(self, scalar: i32) -> Point {
        Point { x: self.x + scalar, y: self.y + scalar }
    }
}

fn main() {
    let shifted = Point { x: 1, y: 2 } + 10;
    println!("{shifted:?}"); // Point { x: 11, y: 12 }
}
```

> [!tip] Overload operators sparingly and intuitively
> Operator overloading is delightful for math-like types (vectors, matrices, money, durations) where `+` has an obvious meaning. Avoid it when the meaning would surprise a reader — a clearly named method beats a clever but cryptic operator. The whole family lives in `std::ops`: `Add`, `Sub`, `Mul`, `Index`, `Neg`, and more.

## Supertraits: traits that require other traits

Sometimes a trait needs functionality from *another* trait. A **supertrait** says "to implement me, you must also implement that one." Here, `Summary` requires `Display`:

```rust
use std::fmt::Display;

trait Summary: Display {          // Display is a supertrait of Summary
    fn summarize(&self) -> String {
        format!("Summary of: {self}") // can use Display's {} because it's guaranteed
    }
}

struct Article { title: String }

impl Display for Article {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.title)
    }
}
impl Summary for Article {}       // gets summarize() for free

fn main() {
    let a = Article { title: "Traits Deep Dive".into() };
    println!("{}", a.summarize());
}
```

## Fully qualified syntax for disambiguation

What if a type has two methods with the same name — one inherent, one from a trait (or two traits)? You disambiguate with **fully qualified syntax**: `<Type as Trait>::method(value)`.

```rust
trait Pilot { fn name(&self) -> String; }
trait Wizard { fn name(&self) -> String; }

struct Human;
impl Pilot for Human { fn name(&self) -> String { "Captain".into() } }
impl Wizard for Human { fn name(&self) -> String { "Gandalf".into() } }
impl Human { fn name(&self) -> String { "Just Bob".into() } }

fn main() {
    let person = Human;
    println!("{}", person.name());              // "Just Bob" — the inherent method
    println!("{}", Pilot::name(&person));        // "Captain"
    println!("{}", <Human as Wizard>::name(&person)); // "Gandalf"
}
```

> [!note] When you'll actually need this
> This is rare — it only comes up when names collide. The most common real case is **associated functions** with no `self` to hint at the type, where you write `<Type as Trait>::function()` so the compiler knows which implementation you mean.

## The newtype pattern

Remember the [orphan rule](#/ch/traits): you can't implement a foreign trait for a foreign type (like `Display` for `Vec<String>`). The **newtype pattern** is the clean workaround — wrap the foreign type in a one-field tuple struct you *do* own, and implement the trait on your wrapper:

```rust
use std::fmt;

// We can't `impl Display for Vec<String>` (both are foreign),
// so we wrap Vec in our own type:
struct CommaList(Vec<String>);

impl fmt::Display for CommaList {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.0.join(", ")) // .0 reaches the inner Vec
    }
}

fn main() {
    let list = CommaList(vec!["apple".into(), "banana".into(), "cherry".into()]);
    println!("{list}"); // apple, banana, cherry
}
```

> [!best] Newtypes do more than dodge the orphan rule
> Wrapping a value in a distinct type is a powerful habit even when the orphan rule isn't involved. `struct Meters(f64)` and `struct Seconds(f64)` are different types, so the compiler stops you from ever adding meters to seconds. `struct UserId(u64)` can't be mixed up with a `struct ProductId(u64)`. Newtypes turn unit and identity mistakes into compile errors — a cheap, powerful safety technique.

## Summary

- **Associated types** (`type Item;`) let a trait name a type each implementer fills in *once* — cleaner than generic parameters when there's one natural choice.
- Implement traits from **`std::ops`** to **overload operators** (`Add`, `Mul`, …); `Add<Rhs = Self>` shows off **default generic type parameters**.
- **Supertraits** (`trait A: B`) require implementers to also implement another trait, so `A`'s methods can rely on `B`'s.
- **Fully qualified syntax** (`<Type as Trait>::method`) disambiguates same-named methods — rare, but essential when it comes up.
- The **newtype pattern** (a one-field wrapper struct) side-steps the orphan rule *and* creates safer, distinct domain types.

> [!exercise] Try it yourself
> 1. Implement `std::ops::Mul<i32>` for a `Vector2 { x: f64, y: f64 }` so `v * 3` scales it.
> 2. Define a trait `Named { fn name(&self) -> String; }` with a default, requiring `Display` as a supertrait.
> 3. Create a newtype `struct Celsius(f64)` and `struct Fahrenheit(f64)`, and a method to convert between them — notice the types prevent mixing units.

That completes the generics/traits/lifetimes trio — the heart of intermediate Rust. Next we explore Rust's **functional** side: closures and iterators, where these ideas come together beautifully.
