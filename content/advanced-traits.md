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

That distinction is worth seeing rather than just reading, because it changes what the compiler can infer:

<figure class="diagram">
<svg viewBox="0 0 670 240" role="img" aria-label="With an associated type, one type has exactly one impl and the output type is inferred. With a generic trait parameter, one type can have many impls and call sites need annotations to pick one.">
  <style>
    .at-h { font: 700 12px var(--font-sans); }
    .at-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .at-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .at-one { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .at-many { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.5; }
    .at-ty { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .at-l { stroke: var(--text-mute); stroke-width: 1.3; }
  </style>
  <text x="14" y="18" class="at-h" fill="var(--green)">Associated type — ONE impl per type</text>
  <rect x="14" y="30" width="110" height="26" rx="6" class="at-ty"/><text x="26" y="47" class="at-m">Numbers</text>
  <rect x="164" y="30" width="150" height="26" rx="6" class="at-one"/><text x="176" y="47" class="at-m">Container</text>
  <line x1="124" y1="43" x2="162" y2="43" class="at-l"/>
  <text x="164" y="72" class="at-c">type Item = i32  — settled, once</text>
  <rect x="14" y="86" width="300" height="30" rx="6" class="at-one"/>
  <text x="26" y="105" class="at-m">n.first()  →  Option&lt;&amp;i32&gt;</text>
  <text x="14" y="134" class="at-c">The compiler knows Item without help.</text>
  <text x="14" y="150" class="at-c">No turbofish, no annotation at the call site.</text>
  <text x="356" y="18" class="at-h" fill="var(--amber)">Generic param — MANY impls per type</text>
  <rect x="356" y="30" width="90" height="26" rx="6" class="at-ty"/><text x="368" y="47" class="at-m">Parser</text>
  <rect x="490" y="24" width="166" height="22" rx="6" class="at-many"/><text x="500" y="40" class="at-m">Parse&lt;i32&gt;</text>
  <rect x="490" y="50" width="166" height="22" rx="6" class="at-many"/><text x="500" y="66" class="at-m">Parse&lt;Date&gt;</text>
  <rect x="490" y="76" width="166" height="22" rx="6" class="at-many"/><text x="500" y="92" class="at-m">Parse&lt;Uuid&gt;</text>
  <line x1="446" y1="43" x2="488" y2="35" class="at-l"/>
  <line x1="446" y1="43" x2="488" y2="61" class="at-l"/>
  <line x1="446" y1="43" x2="488" y2="87" class="at-l"/>
  <rect x="356" y="110" width="300" height="30" rx="6" class="at-many"/>
  <text x="368" y="129" class="at-m">p.parse::&lt;Date&gt;(s)  ← must say which</text>
  <text x="356" y="158" class="at-c">Ambiguous without the turbofish — that's the</text>
  <text x="356" y="174" class="at-c">cost, and sometimes exactly what you want.</text>
  <text x="14" y="204" class="at-c">Ask: "can one type sensibly implement this trait more than once?"</text>
  <text x="14" y="222" class="at-c">No → associated type (Iterator, Deref, Add's Output).   Yes → generic parameter (From&lt;T&gt;, TryFrom&lt;T&gt;, AsRef&lt;T&gt;).</text>
</svg>
<figcaption>One natural choice per implementer → associated type. Many valid choices → generic parameter.</figcaption>
</figure>

`std` uses both deliberately: `Iterator` has `type Item` (a `Vec<i32>`'s iterator yields exactly one thing), while `From<T>` is generic (a `String` is sensibly convertible *from* many types, so `String` implements `From<&str>`, `From<char>`, and more).

## Associated constants

Traits can declare **constants** as well as types and methods. Each implementer supplies a value, and — like methods — the trait may provide a default:

```rust
trait Shape {
    const SIDES: u32;                    // required: each impl must supply it
    const NAME: &'static str = "shape";  // optional: has a default

    // Default methods can use both, via `Self::`
    fn describe() -> String {
        format!("a {} has {} sides", Self::NAME, Self::SIDES)
    }
}

struct Triangle;
struct Square;

impl Shape for Triangle {
    const SIDES: u32 = 3;
    const NAME: &'static str = "triangle";  // override the default
}

impl Shape for Square {
    const SIDES: u32 = 4;
    // NAME not given → falls back to "shape"
}

fn main() {
    println!("{}", Triangle::describe());
    println!("{}", Square::describe());
    // Constants are usable in generic code too:
    fn total_sides<A: Shape, B: Shape>() -> u32 { A::SIDES + B::SIDES }
    println!("combined sides: {}", total_sides::<Triangle, Square>());
}
```

Because they're resolved at compile time, associated constants cost nothing at runtime and can appear anywhere a `const` can — including array lengths in `const`-generic code.

> [!tip] The `f64::MAX` pattern is an associated constant
> You've used these without noticing: `i32::MAX`, `f64::EPSILON`, `usize::BITS`, and `Duration::ZERO` are all associated constants. They live *on the type* rather than in a loose module, so they're discoverable by autocomplete and can't collide with anything else. When you find yourself writing `const MAX_RETRIES_FOR_HTTP_CLIENT: u32`, consider hanging it off the relevant type as `impl HttpClient { const MAX_RETRIES: u32 = 3; }` instead.

## Blanket implementations

A **blanket implementation** implements a trait for *every* type satisfying some bound, rather than for one named type. This is how a few lines of standard-library code give a method to thousands of types at once:

```rust
use std::fmt::Debug;

trait Loggable {
    fn log(&self);
}

// One impl. Every Debug type in the universe now has `.log()`.
impl<T: Debug> Loggable for T {
    fn log(&self) {
        println!("[LOG] {self:?}");
    }
}

fn main() {
    42.log();
    "hello".log();
    vec![1, 2, 3].log();
    Some(3.5).log();
}
```

The standard library's most famous example is `impl<T: Display> ToString for T` — the single reason `5.to_string()`, `'x'.to_string()`, and `my_type.to_string()` all work without anyone writing a `ToString` impl. `Into` is another: `impl<T, U: From<T>> Into<U> for T` means implementing `From` automatically gives you `Into` for free.

<figure class="diagram">
<svg viewBox="0 0 660 190" role="img" aria-label="A single blanket implementation with a Display bound fans out to give the to_string method to i32, char, String, and every user type that implements Display.">
  <style>
    .bl-h { font: 700 11.5px var(--font-sans); }
    .bl-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .bl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .bl-src { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.6; }
    .bl-dst { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .bl-l { stroke: var(--rust-400); stroke-width: 1.2; }
  </style>
  <rect x="14" y="60" width="230" height="56" rx="8" class="bl-src"/>
  <text x="26" y="80" class="bl-m">impl&lt;T: Display&gt; ToString for T</text>
  <text x="26" y="98" class="bl-c">one impl, written once in std</text>
  <line x1="244" y1="72" x2="430" y2="26" class="bl-l"/>
  <line x1="244" y1="82" x2="430" y2="62" class="bl-l"/>
  <line x1="244" y1="92" x2="430" y2="98" class="bl-l"/>
  <line x1="244" y1="102" x2="430" y2="134" class="bl-l"/>
  <line x1="244" y1="112" x2="430" y2="166" class="bl-l"/>
  <rect x="432" y="14" width="214" height="24" rx="5" class="bl-dst"/><text x="444" y="30" class="bl-m">i32::to_string()</text>
  <rect x="432" y="50" width="214" height="24" rx="5" class="bl-dst"/><text x="444" y="66" class="bl-m">char::to_string()</text>
  <rect x="432" y="86" width="214" height="24" rx="5" class="bl-dst"/><text x="444" y="102" class="bl-m">Ipv4Addr::to_string()</text>
  <rect x="432" y="122" width="214" height="24" rx="5" class="bl-dst"/><text x="444" y="138" class="bl-m">YourType::to_string()</text>
  <rect x="432" y="158" width="214" height="24" rx="5" class="bl-dst"/><text x="444" y="174" class="bl-c">…every Display type, forever</text>
  <text x="14" y="140" class="bl-c">Types written years later get the</text>
  <text x="14" y="156" class="bl-c">method automatically — no std change,</text>
  <text x="14" y="172" class="bl-c">no registration, nothing to opt into.</text>
</svg>
<figcaption>A blanket impl is written once and applies forever — including to types that don't exist yet.</figcaption>
</figure>

> [!warning] A blanket impl is a one-way door — you can't add exceptions later
> Because Rust forbids overlapping implementations, `impl<T: Debug> Loggable for T` means you can **never** write a specialized `impl Loggable for MyType` with different behavior — you'll get `error[E0119]: conflicting implementations`. The compiler can't know which one you meant, and specialization is still unstable. So a blanket impl is a permanent commitment: every qualifying type gets *exactly* this behavior. Before writing one in a public crate, ask whether some user will eventually need to override it. If the answer is plausibly yes, prefer a derive macro or an explicit `impl` per type, which keeps the door open.

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

Note that `Point + 10` works but `10 + Point` does **not** — operator traits are implemented on the *left* operand, and `i32` is a foreign type you can't add an impl to. If you need both directions, implement `Add<Point> for i32` as well (legal here only because `Point` is local; see the orphan rule below).

Here is the operator family in full, so you know what's available:

| Operator | Trait | Notes |
|---|---|---|
| `a + b`, `a - b` | `Add`, `Sub` | `type Output` sets the result type |
| `a * b`, `a / b`, `a % b` | `Mul`, `Div`, `Rem` | |
| `-a` | `Neg` | unary minus |
| `!a` | `Not` | boolean/bitwise NOT |
| `a & b`, `a \| b`, `a ^ b` | `BitAnd`, `BitOr`, `BitXor` | |
| `a << b`, `a >> b` | `Shl`, `Shr` | |
| `a += b` (and friends) | `AddAssign`, … | takes `&mut self`, returns `()` |
| `a == b`, `a != b` | `PartialEq` | usually derived |
| `a < b`, `a > b`, … | `PartialOrd` | usually derived |
| `a[i]` | `Index`, `IndexMut` | panics on out-of-range by convention |
| `a(…)` | `Fn`, `FnMut`, `FnOnce` | callable types; unstable to impl by hand |
| `*a` | `Deref`, `DerefMut` | see [Deref & Drop](#/ch/deref-drop) |

> [!tip] Overload operators sparingly and intuitively
> Operator overloading is delightful for math-like types (vectors, matrices, money, durations) where `+` has an obvious meaning. Avoid it when the meaning would surprise a reader — a clearly named method beats a clever but cryptic operator. The whole family lives in `std::ops`: `Add`, `Sub`, `Mul`, `Index`, `Neg`, and more.

> [!mistake] `Add` takes `self` by value, which bites on non-`Copy` types
> `fn add(self, rhs: Rhs)` **consumes** both operands. For a `Copy` type like `Point` that's invisible, but for a `Matrix` holding a `Vec`, `a + b` moves both — and `let c = a + b; let d = a + e;` fails to compile because `a` is gone. The standard fix is to also implement the trait for references, so `&a + &b` works:
> ```rust,ignore
> impl Add for &Matrix {            // note: implemented on the reference type
>     type Output = Matrix;
>     fn add(self, rhs: &Matrix) -> Matrix { /* … */ }
> }
> ```
> Real numeric crates implement all four combinations (`T+T`, `T+&T`, `&T+T`, `&T+&T`), usually via a macro. If your type owns heap data, plan for this from the start.

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

You can require several at once with `+`, and the bound can also be expressed in a `where` clause when it gets long:

```rust,ignore
trait Persistable: Serialize + DeserializeOwned + Debug + Send + 'static {}

// identical, and easier to read as the list grows:
trait Persistable
where
    Self: Serialize + DeserializeOwned + Debug + Send + 'static,
{}
```

> [!jargon] A supertrait is a *requirement*, not inheritance
> The syntax `trait Summary: Display` looks like class inheritance, and it isn't. `Summary` does **not** inherit `Display`'s methods into itself, and an `Article` isn't a "subclass" of anything. All the colon means is: *any type implementing `Summary` must separately implement `Display` too*, and in exchange `Summary`'s default methods may call `Display`'s. There's no hierarchy, no overriding, and no shared state — just a compile-time obligation. If you come from an OO language, read `A: B` as "**A requires B**," never "A extends B."

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

Note the precedence rule that example demonstrates: when an **inherent** method and a **trait** method share a name, the inherent one silently wins for `person.name()`. That's occasionally a trap — adding an inherent method can quietly shadow a trait method callers were relying on, with no error.

> [!note] When you'll actually need this
> This is rare — it only comes up when names collide. The most common real case is **associated functions** with no `self` to hint at the type, where you write `<Type as Trait>::function()` so the compiler knows which implementation you mean.

The no-`self` case deserves a concrete look, because that's where the *only* solution is the full form:

```rust
trait Animal {
    fn baby_name() -> String;   // no self — nothing to infer from
}

struct Dog;
impl Dog {
    fn baby_name() -> String { "Spot".into() }
}
impl Animal for Dog {
    fn baby_name() -> String { "puppy".into() }
}

fn main() {
    println!("{}", Dog::baby_name());              // "Spot" (inherent)
    // println!("{}", Animal::baby_name());        // ❌ which type's impl?
    println!("{}", <Dog as Animal>::baby_name());  // "puppy" — fully qualified
}
```

## The orphan rule and coherence

You met the [orphan rule](#/ch/traits) with traits: you can implement a trait for a type only if **the trait or the type is local to your crate**. It's worth understanding the shape of the rule precisely, because it governs what the newtype pattern below is for:

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="A grid of trait local or foreign against type local or foreign. Three combinations are allowed; implementing a foreign trait for a foreign type is forbidden.">
  <style>
    .or-h { font: 700 11px var(--font-sans); }
    .or-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .or-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .or-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .or-no { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.8; }
    .or-lbl { font: 700 10.5px var(--font-sans); fill: var(--text-mute); }
  </style>
  <text x="150" y="16" class="or-lbl">YOUR type</text>
  <text x="400" y="16" class="or-lbl">FOREIGN type (Vec, String…)</text>
  <text x="8" y="60" class="or-lbl">YOUR trait</text>
  <text x="8" y="140" class="or-lbl">FOREIGN trait</text>
  <rect x="96" y="26" width="240" height="66" rx="8" class="or-ok"/>
  <text x="108" y="46" class="or-m">impl MyTrait for MyType</text>
  <text x="108" y="66" class="or-c">✅ allowed — both are yours</text>
  <text x="108" y="82" class="or-c">the everyday case</text>
  <rect x="344" y="26" width="286" height="66" rx="8" class="or-ok"/>
  <text x="356" y="46" class="or-m">impl MyTrait for Vec&lt;T&gt;</text>
  <text x="356" y="66" class="or-c">✅ allowed — the trait is yours</text>
  <text x="356" y="82" class="or-c">this is how extension traits work</text>
  <rect x="96" y="100" width="240" height="66" rx="8" class="or-ok"/>
  <text x="108" y="120" class="or-m">impl Display for MyType</text>
  <text x="108" y="140" class="or-c">✅ allowed — the type is yours</text>
  <text x="108" y="156" class="or-c">how you hook into std traits</text>
  <rect x="344" y="100" width="286" height="66" rx="8" class="or-no"/>
  <text x="356" y="120" class="or-m">impl Display for Vec&lt;String&gt;</text>
  <text x="356" y="140" class="or-c">❌ forbidden — neither is yours</text>
  <text x="356" y="156" class="or-c">fix: wrap it in a newtype</text>
  <text x="8" y="190" class="or-c">Only the bottom-right is blocked. "Local trait OR local type" is the whole rule.</text>
</svg>
<figcaption>Three of four combinations are fine. Only <b>foreign trait + foreign type</b> is rejected — and the newtype pattern converts that case into the allowed one.</figcaption>
</figure>

> [!deep] Why coherence matters more than it seems
> The rule exists so that a given (trait, type) pair has **exactly one** implementation across your entire dependency graph. Imagine crates `a` and `b` both writing `impl Display for Vec<String>` with different formats. Your program depends on both. Which one runs? Any answer is bad: picking one silently changes behavior depending on your dependency list, and rejecting the build means adding an unrelated dependency can break compilation. Rust avoids the dilemma by making the situation unrepresentable. The cost is that you occasionally need a newtype; the benefit is that trait resolution never depends on what else happens to be linked in.

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

Here's that safety made concrete — the version with newtypes refuses to compile the bug:

```rust
#[derive(Debug, Clone, Copy)]
struct Meters(f64);
#[derive(Debug, Clone, Copy)]
struct Seconds(f64);
#[derive(Debug, Clone, Copy)]
struct MetersPerSecond(f64);

impl Meters {
    // The types make the intent unmistakable, and the unit is in the return type.
    fn per(self, t: Seconds) -> MetersPerSecond {
        MetersPerSecond(self.0 / t.0)
    }
}

fn main() {
    let distance = Meters(100.0);
    let time = Seconds(9.58);
    let speed = distance.per(time);
    println!("{:.2} m/s", speed.0);

    // let nonsense = distance.per(Meters(5.0)); // ❌ won't compile: expected Seconds
    // With plain f64 everywhere, that mistake compiles happily and ships.
}
```

> [!performance] Newtypes are free at runtime
> A single-field tuple struct has the **same size and layout** as the value it wraps — `Meters` is exactly an `f64`, and the wrapper vanishes entirely after compilation. You can confirm it: `std::mem::size_of::<Meters>() == std::mem::size_of::<f64>()`. The only cost is the `.0` you occasionally type, and implementing `Deref` or a few forwarding methods removes most of that. There is no performance argument against newtypes.

## Related patterns, covered elsewhere

Several advanced trait techniques get full treatment in their own chapters — here's the map so you know they exist and where to look:

| Pattern | What it's for | Where |
|---|---|---|
| **Trait objects** (`dyn Trait`) | runtime polymorphism, heterogeneous collections | [Trait Objects](#/ch/trait-objects) |
| **Extension traits** | adding methods to types you don't own | [Design Patterns](#/ch/idioms-patterns) |
| **Sealed traits** | a public trait only *you* may implement | [API Design](#/ch/api-design) |
| **RPITIT / `async fn` in traits** | returning `impl Trait` from trait methods | [Modern Syntax](#/ch/modern-syntax) |
| **Generic associated types (GATs)** | associated types with their own lifetimes | [Modern Syntax](#/ch/modern-syntax) |
| **Marker traits** (`Send`, `Sync`) | traits with no methods that label a property | [Send, Sync & Thread Safety](#/ch/send-sync) |
| **Derivable traits** | `#[derive(...)]` and what each one gives you | [Appendix C](#/ch/appendix-derivable) |

## Summary

- **Associated types** (`type Item;`) let a trait name a type each implementer fills in *once* — cleaner than generic parameters when there's one natural choice. Use a **generic parameter** when one type should implement the trait many times (`From<T>`).
- **Associated constants** (`const SIDES: u32;`) work the same way for values, may have defaults, and are how `i32::MAX` and `f64::EPSILON` are defined.
- **Blanket impls** (`impl<T: Display> ToString for T`) give a trait to every qualifying type at once — powerful, but a **permanent** commitment, since you can never add an overriding impl later.
- Implement traits from **`std::ops`** to **overload operators** (`Add`, `Mul`, …); `Add<Rhs = Self>` shows off **default generic type parameters**. Operators consume `self`, so non-`Copy` types usually need reference impls too.
- **Supertraits** (`trait A: B`) require implementers to also implement another trait — a *requirement*, **not inheritance**.
- **Fully qualified syntax** (`<Type as Trait>::method`) disambiguates same-named methods; it's mandatory for associated functions with no `self`. Inherent methods silently win over trait methods.
- The **orphan rule** blocks only *foreign trait + foreign type*; coherence guarantees one impl per (trait, type) across the whole dependency graph.
- The **newtype pattern** side-steps the orphan rule, creates safer domain types (`Meters` vs `Seconds`), and is **free at runtime**.

> [!exercise] Try it yourself
> 1. Implement `std::ops::Mul<i32>` for a `Vector2 { x: f64, y: f64 }` so `v * 3` scales it.
> 2. Define a trait `Named { fn name(&self) -> String; }` with a default, requiring `Display` as a supertrait.
> 3. Create a newtype `struct Celsius(f64)` and `struct Fahrenheit(f64)`, and a method to convert between them — notice the types prevent mixing units.
> 4. Add a `const PRECISION: usize = 2;` associated constant to a `Currency` trait and use it in a default `format_amount` method.
> 5. Write a blanket `impl<T: Debug> Describe for T`, then try to add a specialized `impl Describe for String`. Read the `E0119` error and explain why specialization would be needed.
> 6. Make `Vector2` support both `v * 3` and `3 * v`. Which of the two requires `Vector2` to be a local type, and why?
> 7. Give a type both an inherent `id()` and a trait `id()`, then call each one. Which does plain `x.id()` resolve to?
> 8. Implement `Add` for a `Matrix` holding a `Vec<f64>`, then write `let c = &a + &b;` — add the reference impl needed to make it compile without moving `a` and `b`.

That completes the generics/traits/lifetimes trio — the heart of intermediate Rust. Next we explore Rust's **functional** side: closures and iterators, where these ideas come together beautifully.
