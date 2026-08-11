<h1><span class="h1-kicker">Smart Pointers</span>Box&lt;T&gt;: Heap Allocation</h1>

A **smart pointer** is a type that acts like a pointer but adds extra powers — automatic cleanup, reference counting, or runtime borrow checking. The simplest of them all is **`Box<T>`**: it stores a value on the [heap](#/ch/stack-heap) and gives you an owning handle to it on the stack. `Box` is your first smart pointer and the foundation for the rest of this part.

## Why smart pointers exist at all

Rust's ordinary references (`&T`, `&mut T`) are *borrows*: they point at data someone else owns, and the compiler proves at compile time that they never outlive it. That's enough for most code. But three situations sit outside what a plain reference can express:

- **The size isn't known at compile time.** A recursive type, or a `dyn Trait` that could be any concrete type. A value must have a known size to live on the stack.
- **Ownership needs to be shared.** Two parts of a program both need to keep the same data alive, and neither can be said to own it.
- **Mutation must be checked at runtime.** The compiler can't prove your access pattern is safe, but you can guarantee it dynamically.

Each smart pointer solves exactly one of these. Here's the whole family, so you know where this part is heading:

| Type | Gives you | Cost | Reach for it when |
|---|---|---|---|
| **`Box<T>`** | one owner, on the heap | one allocation | you need indirection: recursion, `dyn Trait`, large values |
| **`Rc<T>`** | many owners, single-threaded | non-atomic count | a graph or tree where nodes are shared |
| **`Arc<T>`** | many owners, across threads | atomic count | sharing between threads |
| **`Cell<T>`** | replace a `Copy` value through `&self` | **none** | a counter or flag behind `&self` |
| **`RefCell<T>`** | mutation through `&self` | a runtime borrow flag | interior mutability, single-threaded |
| **`Mutex<T>`** / `RwLock<T>` | mutation through `&self`, thread-safe | a lock | shared mutable state across threads |
| **`Weak<T>`** | a non-owning reference to `Rc`/`Arc` | none | breaking reference cycles |
| **`Cow<'_, T>`** | borrow, or own if modified | none until written | "usually no change needed" |
| **`Pin<P>`** | a promise the value won't move | none | self-referential types, futures |
| `&T` / `&mut T` | a borrow (not a smart pointer) | free | **the default** — start here |

There's a second category that's easy to miss, because you never construct one yourself — you *receive* it. **Guards** are temporary smart pointers handed to you by a container, giving access for exactly as long as you hold them:

| Guard | You get it from | It releases, on drop |
|---|---|---|
| **`MutexGuard<T>`** | `mutex.lock()` | the **lock** |
| `RwLockReadGuard<T>` / `RwLockWriteGuard<T>` | `rwlock.read()` / `.write()` | the lock |
| **`Ref<T>`** / `RefMut<T>` | `refcell.borrow()` / `.borrow_mut()` | the borrow flag |
| `Drain<'_, T>` | `vec.drain(..)` | removes the drained range |
| `PeekMut<'_, T>` | `heap.peek_mut()` | re-sorts the heap |
| your own | a constructor you write | whatever you decided |

> [!key] `Mutex<T>` is the container; `MutexGuard<T>` is the smart pointer
> This distinction confuses people, and it matters. The `Mutex` *holds* the value and outlives every access. `lock()` returns a **`MutexGuard`**, which is the actual smart pointer: it `Deref`s to the `T` so you can use the value directly, and its `Drop` **releases the lock**. That's why you never call `unlock()` in Rust — and why a guard accidentally stored in a long-lived variable holds the lock far longer than you intended. `RefCell`'s `Ref`/`RefMut` work identically with a borrow flag instead of a lock. Guards are the purest illustration of the two traits in this part: `Deref` for access, `Drop` for release. You'll build one yourself in [Building Your Own Smart Pointer](#/ch/custom-smart-pointer).

> [!key] Smart pointers are a last resort, not a starting point
> Every row above costs something a plain `&T` doesn't — an allocation, an atomic increment, a runtime check, or a lifetime you now have to think about. The idiomatic path is always: try a reference first, then a `Box` if you need indirection, and only reach for reference counting or interior mutability when the ownership genuinely can't be expressed any other way. A codebase full of `Rc<RefCell<T>>` usually means someone reached for the last row first (see [Anti-Patterns](#/ch/anti-patterns)).

## What `Box` does

`Box::new(value)` moves `value` onto the heap and hands you a `Box<T>` — a stack-sized pointer that owns the heap data. When the box goes out of scope, the heap data is freed automatically:

```rust
fn main() {
    let boxed = Box::new(5); // the 5 lives on the heap
    println!("boxed = {boxed}");   // prints 5 — Box transparently dereferences
    println!("plus one = {}", *boxed + 1); // *boxed gets the value out
} // `boxed` goes out of scope here; the heap memory is freed
```

For a plain `i32` this is pointless (integers are happiest on the stack). `Box` earns its keep in four specific situations.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A Box is a small pointer on the stack that owns a value on the heap, and when it is dropped both the value and the allocation are released">
  <style>
    .bxm { font: 600 12px var(--font-mono); fill: var(--text); }
    .bxc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bxs { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .bxh { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="40" y="30" class="bxc" fill="var(--blue)">STACK (8 bytes, fixed)</text>
  <rect x="40" y="40" width="150" height="40" class="bxs"/>
  <text x="54" y="65" class="bxm">boxed: ptr ●</text>
  <text x="380" y="30" class="bxc" fill="var(--rust-600)">HEAP (any size)</text>
  <rect x="380" y="40" width="120" height="40" class="bxh"/>
  <text x="420" y="65" class="bxm">5</text>
  <path d="M192 60 L378 60" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#abx)"/>
  <text x="40" y="106" class="bxc">A Box is one pointer wide on the stack; it owns (and frees) the heap value.</text>
  <text x="40" y="128" class="bxc">On drop, Box does two things in order: (1) drop the T, then (2) free the allocation.</text>
  <text x="40" y="150" class="bxc">That is the whole of RAII — no <tspan font-family="var(--font-mono)">free()</tspan> to remember, and it happens even on an early return or a panic.</text>
  <defs><marker id="abx" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><code>Box&lt;T&gt;</code>: a stack-sized owning handle to a heap-allocated value.</figcaption>
</figure>

## How to create one

`Box::new` is the one you'll write most, but there are several routes in — and, importantly, routes back out:

```rust
fn main() {
    // The four ways to make a Box<T> from a T:
    let a = Box::new(5i32);           // the usual
    let b: Box<i32> = Box::from(7);   // via From
    let c: Box<i32> = 9.into();       // via Into — same impl
    let d: Box<i32> = Box::default(); // T::default(), boxed → 0

    println!("{a} {b} {c} {d}");

    // Unsized types can ONLY exist behind a pointer, so these conversions
    // are how you get a Box<str> or Box<[T]> at all:
    let text: Box<str> = String::from("hello").into_boxed_str();
    let slice: Box<[i32]> = vec![1, 2, 3].into_boxed_slice();
    let from_array: Box<[i32]> = Box::new([10, 20, 30]); // array coerces to slice

    println!("{text} {slice:?} {from_array:?}");

    // …and the round trip back, without reallocating:
    let owned_string: String = text.into_string();
    let owned_vec: Vec<i32> = slice.into_vec();
    println!("{owned_string} {owned_vec:?}");

    // Moving the value back out of a Box is just a deref.
    let boxed = Box::new(String::from("moved out"));
    let inner: String = *boxed; // the Box is consumed; the String is yours
    println!("{inner}");
}
```

| To create | Use | Notes |
|---|---|---|
| `Box<T>` from a `T` | `Box::new(value)` | the standard constructor |
| `Box<T>` from a `T` | `Box::from(value)` / `value.into()` | identical; useful in generic code |
| `Box<T>` with a default | `Box::default()` | requires `T: Default` |
| `Box<str>` | `string.into_boxed_str()` | drops the spare capacity |
| `Box<[T]>` | `vec.into_boxed_slice()` | drops the spare capacity |
| `Box<[T]>` from an array | `Box::new([1, 2, 3])` | the array coerces to a slice |
| `Box<dyn Trait>` | `Box::new(concrete) as Box<dyn Trait>` | usually inferred, no cast needed |
| `Pin<Box<T>>` | `Box::pin(value)` | for self-referential types ([Pin](#/ch/pinning)) |
| `String` back from `Box<str>` | `boxed.into_string()` | no reallocation |
| `Vec<T>` back from `Box<[T]>` | `boxed.into_vec()` | no reallocation |
| the `T` back out | `*boxed` | consumes the box, moves the value |

> [!performance] `Box<str>` and `Box<[T]>` save 8 bytes each
> A `String` is three words (pointer, length, **capacity**); a `Box<str>` is two, because a boxed string can't grow so there's no capacity to track. The same holds for `Vec<T>` (24 bytes) versus `Box<[T]>` (16). If you're storing a million parsed strings that will never be modified again, `into_boxed_str()` reclaims 8 megabytes and also releases any over-allocated capacity. It's a genuinely free win for long-lived immutable data — see [Memory Layout](#/ch/memory-layout).

## Job 1: recursive types

Some types refer to themselves — a linked list node contains another node, a tree node contains subtrees. Without indirection, the compiler can't compute their size (a node contains a node contains a node… **infinitely**). Try it and you get a clear error:

```rust,ignore
enum List {
    Cons(i32, List), // ❌ recursive without indirection
    Nil,
}
// error[E0072]: recursive type `List` has infinite size
```

`Box` fixes this. A `Box<List>` is just a pointer — a fixed, known size — no matter how big the list it points to. This breaks the infinite recursion:

```rust
#[derive(Debug)]
enum List {
    Cons(i32, Box<List>), // ✅ a pointer has a known size
    Nil,
}
use List::{Cons, Nil};

fn sum(list: &List) -> i32 {
    match list {
        Cons(value, rest) => value + sum(rest), // `rest` derefs from &Box<List> to &List
        Nil => 0,
    }
}

fn main() {
    // The list 1 → 2 → 3 → Nil
    let list = Cons(1, Box::new(Cons(2, Box::new(Cons(3, Box::new(Nil))))));
    println!("{list:?}");
    println!("sum = {}", sum(&list));
}
```

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="Without a Box the compiler tries to inline each recursive node inside the previous one forever, while with a Box each node holds a fixed-size pointer to the next">
  <style>
    .rc-h { font: 700 12px var(--font-sans); }
    .rc-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .rc-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .rc-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.4; }
    .rc-ok { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <text x="20" y="18" class="rc-h" fill="var(--red)">Cons(i32, List) — the compiler must inline each node inside the last</text>
  <rect x="20" y="26" width="330" height="62" rx="3" class="rc-bad"/><text x="28" y="42" class="rc-m">i32</text>
  <rect x="60" y="46" width="282" height="38" rx="3" class="rc-bad"/><text x="68" y="62" class="rc-m">i32</text>
  <rect x="100" y="64" width="234" height="16" rx="3" class="rc-bad"/><text x="108" y="76" class="rc-m">i32 …</text>
  <text x="366" y="60" class="rc-m" fill="var(--red)">→ ∞ bytes</text>
  <text x="366" y="78" class="rc-c">error[E0072]</text>
  <text x="20" y="118" class="rc-h" fill="var(--rust-600)">Cons(i32, Box&lt;List&gt;) — each node holds a fixed-size pointer instead</text>
  <rect x="20" y="126" width="130" height="34" rx="3" class="rc-ok"/>
  <text x="28" y="140" class="rc-m">i32 = 1</text><text x="28" y="154" class="rc-m">ptr ●</text>
  <rect x="190" y="126" width="130" height="34" rx="3" class="rc-ok"/>
  <text x="198" y="140" class="rc-m">i32 = 2</text><text x="198" y="154" class="rc-m">ptr ●</text>
  <rect x="360" y="126" width="130" height="34" rx="3" class="rc-ok"/>
  <text x="368" y="140" class="rc-m">i32 = 3</text><text x="368" y="154" class="rc-m">ptr ●</text>
  <rect x="530" y="126" width="80" height="34" rx="3" class="rc-ok"/>
  <text x="538" y="147" class="rc-m">Nil</text>
  <path d="M152 148 L188 148" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-rcb)"/>
  <path d="M322 148 L358 148" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-rcb)"/>
  <path d="M492 148 L528 148" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-rcb)"/>
  <text x="20" y="186" class="rc-c">Each node is now <tspan font-weight="700">12 bytes</tspan> (an i32 + padding + a pointer), whatever the list's length.</text>
  <text x="20" y="202" class="rc-c">The recursion moved from the <tspan font-style="italic">type</tspan> (impossible) to the <tspan font-style="italic">heap</tspan> (fine).</text>
  <defs><marker id="arr-rcb" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>Indirection turns "infinitely big" into "one pointer big". The data can still be arbitrarily deep — it just lives on the heap.</figcaption>
</figure>

> [!key] Why `Box` breaks the size cycle
> The compiler must know how many bytes each type occupies to lay it out on the stack. A directly-recursive type has no finite answer. A `Box<List>` is always **one pointer** wide regardless of what it points to — so `Cons(i32, Box<List>)` has a definite size (an `i32` plus a pointer). Indirection turns "infinitely big" into "one pointer big."

## Job 2: trait objects and unsized types

Some types have no size the compiler can know: `dyn Trait` (any implementor, of any size), `str`, and `[T]`. These are **dynamically sized types** (DSTs), and they can only exist behind a pointer. `Box` is the *owning* way to hold one:

```rust
trait Animal {
    fn speak(&self) -> String;
    fn name(&self) -> &str;
}

struct Dog;
struct Cat;
struct Parrot { phrase: String }

impl Animal for Dog {
    fn speak(&self) -> String { "Woof".into() }
    fn name(&self) -> &str { "dog" }
}
impl Animal for Cat {
    fn speak(&self) -> String { "Meow".into() }
    fn name(&self) -> &str { "cat" }
}
impl Animal for Parrot {
    fn speak(&self) -> String { self.phrase.clone() }
    fn name(&self) -> &str { "parrot" }
}

fn main() {
    // Three DIFFERENT types, different sizes, in one Vec — only possible
    // because each is behind a pointer of uniform width.
    let animals: Vec<Box<dyn Animal>> = vec![
        Box::new(Dog),
        Box::new(Cat),
        Box::new(Parrot { phrase: "Pieces of eight".into() }),
    ];

    for a in &animals {
        println!("{}: {}", a.name(), a.speak());
    }

    // Returning a trait object lets a function choose the type at runtime:
    fn pick(loud: bool) -> Box<dyn Animal> {
        if loud { Box::new(Dog) } else { Box::new(Cat) }
    }
    println!("picked: {}", pick(true).speak());
}
```

A pointer to a DST is a **fat pointer** — two words rather than one, because it must carry the missing size information alongside the address:

<figure class="diagram">
<svg viewBox="0 0 640 215" role="img" aria-label="A Box to a sized type is one word, while a Box to a slice carries a length and a Box to a trait object carries a vtable pointer, making each two words">
  <style>
    .fp-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .fp-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .fp-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .fp-p { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .fp-x { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
    .fp-v { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.3; }
  </style>
  <text x="20" y="18" class="fp-h">Box&lt;i32&gt; — thin: 8 bytes</text>
  <rect x="20" y="26" width="110" height="26" rx="3" class="fp-p"/><text x="30" y="44" class="fp-m">ptr ●</text>
  <text x="150" y="44" class="fp-c">the type is known, so the address is all you need</text>
  <text x="20" y="78" class="fp-h">Box&lt;[i32]&gt; — fat: 16 bytes</text>
  <rect x="20" y="86" width="110" height="26" rx="3" class="fp-p"/><text x="30" y="104" class="fp-m">ptr ●</text>
  <rect x="132" y="86" width="110" height="26" rx="3" class="fp-x"/><text x="142" y="104" class="fp-m">len = 3</text>
  <text x="258" y="104" class="fp-c">how many elements — needed for bounds checks</text>
  <text x="20" y="138" class="fp-h">Box&lt;dyn Animal&gt; — fat: 16 bytes</text>
  <rect x="20" y="146" width="110" height="26" rx="3" class="fp-p"/><text x="30" y="164" class="fp-m">ptr ●</text>
  <rect x="132" y="146" width="110" height="26" rx="3" class="fp-v"/><text x="142" y="164" class="fp-m">vtable ●</text>
  <text x="258" y="164" class="fp-c">where <tspan font-family="var(--font-mono)">speak()</tspan>, <tspan font-family="var(--font-mono)">name()</tspan> and <tspan font-family="var(--font-mono)">drop</tspan> live</text>
  <text x="20" y="196" class="fp-c">This is why <tspan font-family="var(--font-mono)">Box&lt;dyn Trait&gt;</tspan> can hold any implementor: the concrete type's size and behaviour are</text>
  <text x="20" y="210" class="fp-c">looked up through the vtable at runtime, so the handle itself stays a uniform two words.</text>
</svg>
<figcaption>A pointer to an unsized type carries the missing information with it — a <b>length</b> for slices, a <b>vtable</b> for trait objects.</figcaption>
</figure>

> [!note] `Box<dyn Trait>` versus `&dyn Trait` versus generics
> All three achieve polymorphism, and the choice is about *ownership* and *when the type is decided*. A **generic** (`fn f<T: Animal>`) is resolved at compile time — fastest, but the caller fixes the type. **`&dyn Animal`** borrows, so it can't outlive what it points to. **`Box<dyn Animal>`** owns, so it can be returned from a function, stored in a struct, or put in a `Vec` — which is why heterogeneous collections use it. See [Trait Objects](#/ch/trait-objects).

## Job 3: moving large data without copying

When you move a value, its bytes are copied to the new location. For a *big* value (a large array or struct), boxing it first means only the small pointer moves — the bulky data stays put on the heap:

```rust
fn main() {
    // A large array boxed onto the heap:
    let big = Box::new([0u8; 1_000_000]);
    // Moving `big` just moves an 8-byte pointer, not a megabyte of data:
    let moved = big;
    println!("first byte: {}", moved[0]);
    println!("length: {}", moved.len());
}
```

> [!warning] `Box::new([0u8; 10_000_000])` builds the array on the stack *first*
> This is a genuine trap. `Box::new(expr)` evaluates `expr` — creating the value on the stack — and only then moves it to the heap. For a large enough array that overflows the stack before the box exists, and you get a stack overflow rather than a heap allocation. Optimized builds usually elide the copy, but debug builds frequently don't. For genuinely huge buffers, build a `Vec` instead (`vec![0u8; 10_000_000]`, which allocates directly on the heap) and call `into_boxed_slice()` if you want a `Box<[u8]>`.

> [!performance] When (and when not) to box
> Boxing costs a heap allocation, so don't box small values you'd happily keep on the stack — `Box<i32>` is almost always pointless. Box when you *need* indirection: recursive types, trait objects, or genuinely large values you move around a lot. For everyday small data, plain stack values are faster.

## Job 4: shrinking a large enum variant

An enum is as large as its biggest variant, and every value of that enum pays for it — including the common small ones:

```rust
use std::mem::size_of;

// ❌ Every Response is 200+ bytes, even the tiny Ok case.
enum FatResponse {
    Ok,
    NotFound,
    Detailed(DetailedError),
}

// ✅ Boxing the rare large variant shrinks the whole enum.
enum LeanResponse {
    Ok,
    NotFound,
    Detailed(Box<DetailedError>),
}

struct DetailedError {
    message: String,
    trace: [u8; 200],
}

fn main() {
    println!("DetailedError  {} bytes", size_of::<DetailedError>());
    println!("FatResponse    {} bytes", size_of::<FatResponse>());
    println!("LeanResponse   {} bytes", size_of::<LeanResponse>());
    println!("\nFor a million responses that are mostly Ok, the lean version");
    println!("saves roughly {} MB.",
        (size_of::<FatResponse>() - size_of::<LeanResponse>()) * 1_000_000 / 1_000_000);
}
```

Clippy's `large_enum_variant` lint finds these for you, and `result_large_err` catches the same problem in a `Result`'s error type — where it matters most, because the error path is usually the rare one.

## The `Box` API, in full

`Box<T>` has a deliberately tiny inherent API. Almost everything you do with it comes from `Deref`, which makes a `Box<T>` behave like a `T`:

| Method | Signature | Purpose |
|---|---|---|
| `Box::new(x)` | `T -> Box<T>` | allocate and move `x` to the heap |
| `Box::pin(x)` | `T -> Pin<Box<T>>` | allocate and pin in place |
| `*boxed` | `Box<T> -> T` | move the value out, consuming the box |
| `Box::leak(b)` | `Box<T> -> &'static mut T` | give up ownership; **never freed** |
| `Box::into_raw(b)` | `Box<T> -> *mut T` | hand the pointer to FFI; **you must free it** |
| `Box::from_raw(p)` | `*mut T -> Box<T>` | `unsafe`; take ownership of a raw pointer back |
| `boxed.downcast::<T>()` | on `Box<dyn Any>` | recover the concrete type, as a `Result` |
| `boxed.into_string()` | `Box<str> -> String` | no reallocation |
| `boxed.into_vec()` | `Box<[T]> -> Vec<T>` | no reallocation |

The traits are where the ergonomics come from:

| Trait | Effect |
|---|---|
| `Deref` / `DerefMut` | `*b`, `b.method()`, and `&*b` all work as if you had a `T` |
| `Drop` | drops the `T`, then frees the allocation — automatically |
| `Clone` | if `T: Clone`; allocates a **new** box with a cloned value |
| `Debug` / `Display` | forwarded to `T`, so `{b}` and `{b:?}` just work |
| `PartialEq` / `Ord` / `Hash` | compare the **contents**, not the addresses |
| `From<T>` | powers `Box::from` and `.into()` |
| `Iterator` | a `Box<dyn Iterator>` is itself an iterator |
| `Future` | a `Box<dyn Future>` can be awaited (with `Pin`) |
| `Fn` / `FnMut` / `FnOnce` | `Box<dyn Fn(i32) -> i32>` is callable directly |
| `Error` | `Box<dyn Error>` is the universal error type ([the `?` operator](#/ch/question-mark)) |

```rust
fn main() {
    // Deref means a Box<T> is usable anywhere a &T is wanted.
    let boxed = Box::new(String::from("hello world"));
    println!("len via deref: {}", boxed.len());        // String::len
    println!("upper: {}", boxed.to_uppercase());       // String method
    takes_str(&boxed);                                  // &Box<String> → &String → &str

    // Comparisons look at the CONTENTS, not the pointers.
    println!("equal? {}", Box::new(5) == Box::new(5));  // true

    // A boxed closure is callable like any other.
    let double: Box<dyn Fn(i32) -> i32> = Box::new(|x| x * 2);
    println!("double(21) = {}", double(21));

    // A boxed iterator is an iterator — handy for returning different
    // iterator types from one function.
    let it: Box<dyn Iterator<Item = i32>> = Box::new((1..4).map(|x| x * 10));
    println!("{:?}", it.collect::<Vec<_>>());
}

fn takes_str(s: &str) {
    println!("as &str: {s}");
}
```

> [!key] `Deref` is why `Box` feels invisible
> You almost never write `*boxed` explicitly, because Rust applies **deref coercion** automatically: `boxed.len()` becomes `(*boxed).len()`, and `&Box<String>` coerces to `&String` and then to `&str` wherever one is expected. That's the whole point of a smart *pointer* — it behaves like the thing it points to, while quietly managing the memory underneath. You'll implement `Deref` yourself in [Deref & Drop](#/ch/deref-drop).

## Memory facts worth knowing

```rust
use std::any::Any;
use std::mem::size_of;

fn main() {
    println!("Box<i32>          {} bytes", size_of::<Box<i32>>());
    println!("Option<Box<i32>>  {} bytes  ← free!", size_of::<Option<Box<i32>>>());
    println!("Box<[i32]>        {} bytes  (ptr + len)", size_of::<Box<[i32]>>());
    println!("Box<str>          {} bytes  (ptr + len)", size_of::<Box<str>>());
    println!("Box<dyn Any>      {} bytes  (ptr + vtable)", size_of::<Box<dyn Any>>());
    println!("String            {} bytes  (ptr + len + cap)", size_of::<String>());
    println!("Box<str>          {} bytes  ← 8 saved, no capacity", size_of::<Box<str>>());
}
```

> [!key] `Option<Box<T>>` is the same size as `Box<T>`
> A `Box` can never be null, which leaves the all-zero bit pattern unused — so the compiler uses it to represent `None`. This is the **niche optimization**, and it means an optional owned pointer costs exactly as much as a mandatory one. In C you'd write a nullable pointer and hope every caller checks it; in Rust you write `Option<Box<T>>`, the compiler forces you to handle `None`, and you pay nothing for the safety. See [Memory Layout](#/ch/memory-layout).

## Escape hatches

Two methods hand ownership out of Rust's model entirely. You'll rarely need them, but knowing they exist explains a lot of FFI code:

```rust
fn main() {
    // Box::leak — deliberately never free it, in exchange for a 'static reference.
    // Legitimate at startup for config that must live for the whole program.
    let config: &'static mut String = Box::leak(Box::new(String::from("prod")));
    config.push_str("-eu-west");
    println!("leaked config: {config}");

    // into_raw / from_raw — hand the pointer to C, then take it back.
    let raw: *mut i32 = Box::into_raw(Box::new(42));
    // Between these two lines, Rust has NO idea this memory exists.
    unsafe {
        println!("through the raw pointer: {}", *raw);
        let reclaimed = Box::from_raw(raw); // ownership restored; will be freed
        println!("reclaimed: {reclaimed}");
    }
}
```

> [!warning] `Box::leak` and `Box::into_raw` are memory leaks by default
> Both consume the `Box` **without** running its destructor, so nothing will ever free that allocation unless you do it yourself. `leak` is intentional and fine for a handful of values created once at startup — it's a bounded, deliberate leak. `into_raw` is a promise: you must eventually pass the pointer back to `from_raw`, exactly once, or the memory is gone for the process's lifetime. Calling `from_raw` twice on the same pointer is a double-free and undefined behaviour. See [Unsafe Rust](#/ch/unsafe) and [FFI](#/ch/ffi).

> [!note] `Box` has exactly one owner
> Unlike the reference-counted pointers coming next, a `Box` follows normal ownership: one owner, moved (not shared). When you need *multiple* owners of the same heap data, that's the job of `Rc` and `Arc` — the [next chapter](#/ch/rc-arc).

## Summary

- A **smart pointer** adds powers to a pointer: cleanup, shared ownership, or runtime checks. Start with a plain **`&T`**; reach for a smart pointer only when ownership genuinely can't be expressed otherwise.
- **`Box<T>`** is the simplest one: a stack-sized owning handle to a **heap** value, freed automatically on drop (drop the `T`, then free the allocation).
- Create with **`Box::new`**, `Box::from`/`.into()`, `Box::default()`, or `into_boxed_str()`/`into_boxed_slice()` for unsized types. Get the value back with **`*boxed`**.
- Four jobs: **recursive types** (finite size), **trait objects and DSTs** (`Box<dyn Trait>`, `Box<[T]>`), moving **large data** cheaply, and **shrinking a big enum variant**.
- A pointer to an unsized type is a **fat pointer** — two words, carrying a length (slices) or a vtable (trait objects).
- **`Deref`** makes a `Box<T>` behave like a `T`, which is why it feels invisible; comparisons look at contents, not addresses.
- **`Option<Box<T>>` is the same size as `Box<T>`** thanks to the niche optimization — a nullable pointer with none of the risk.
- `Box::new(huge_array)` can overflow the stack before it reaches the heap; build a `Vec` instead.
- **`Box::leak`** and **`Box::into_raw`** skip the destructor — deliberate leaks, for startup config and FFI.

> [!exercise] Try it yourself
> 1. Build the cons-list `1 → 2 → 3 → Nil` and write a function that sums its values (hint: recursion + `match`).
> 2. Remove the `Box` from the `Cons` variant and read `error[E0072]` in full. What does the compiler suggest?
> 3. Make a `Vec<Box<dyn Animal>>` with three different animals and print each one's sound. Then try to make a `Vec<dyn Animal>` and explain the error using the fat-pointer diagram.
> 4. Print `size_of` for `Box<i32>`, `Option<Box<i32>>`, `Box<str>`, and `Box<dyn Animal>`. Explain each number.
> 5. Build the `FatResponse`/`LeanResponse` enums and confirm the size difference. Then run `cargo clippy` and see whether `large_enum_variant` catches it.
> 6. Convert a `String` to a `Box<str>` and back, and explain why neither direction needs to reallocate.
> 7. Use `Box::leak` to create a `&'static str` from a runtime-built `String`. Why does the borrow checker allow this, and what did you give up?

`Box` gives one owner. But what if several parts of your program need to *share* ownership of the same data? Enter reference counting: **`Rc` and `Arc`**.
