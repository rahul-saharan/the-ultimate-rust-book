<h1><span class="h1-kicker">Smart Pointers</span>Box&lt;T&gt;: Heap Allocation</h1>

A **smart pointer** is a type that acts like a pointer but adds extra powers — automatic cleanup, reference counting, or runtime checks. The simplest of them all is **`Box<T>`**: it stores a value on the [heap](#/ch/stack-heap) and gives you an owning handle to it on the stack. `Box` is your first smart pointer and the foundation for the rest of this part.

## What `Box` does

`Box::new(value)` moves `value` onto the heap and hands you a `Box<T>` — a stack-sized pointer that owns the heap data. When the box goes out of scope, the heap data is freed automatically:

```rust
fn main() {
    let boxed = Box::new(5); // the 5 lives on the heap
    println!("boxed = {boxed}");   // prints 5 — Box transparently dereferences
    println!("plus one = {}", *boxed + 1); // *boxed gets the value out
} // `boxed` goes out of scope here; the heap memory is freed
```

For a plain `i32` this is pointless (integers are happiest on the stack). `Box` earns its keep in three specific situations.

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="A Box is a small pointer on the stack that owns a value on the heap">
  <style>
    .bxm { font: 600 12px var(--font-mono); fill: var(--text); }
    .bxc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bxs { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .bxh { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="40" y="30" class="bxc" fill="var(--blue)">STACK</text>
  <rect x="40" y="40" width="150" height="40" class="bxs"/>
  <text x="54" y="65" class="bxm">boxed: ptr ●</text>
  <text x="380" y="30" class="bxc" fill="var(--rust-600)">HEAP</text>
  <rect x="380" y="40" width="120" height="40" class="bxh"/>
  <text x="420" y="65" class="bxm">5</text>
  <path d="M192 60 L378 60" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#abx)"/>
  <text x="40" y="110" class="bxc">A Box is one pointer wide on the stack; it owns (and frees) the heap value.</text>
  <defs><marker id="abx" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><code>Box&lt;T&gt;</code>: a stack-sized owning handle to a heap-allocated value.</figcaption>
</figure>

## Use 1: recursive types

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

fn main() {
    // The list 1 → 2 → 3 → Nil
    let list = Cons(1, Box::new(Cons(2, Box::new(Cons(3, Box::new(Nil))))));
    println!("{list:?}");
}
```

> [!key] Why `Box` breaks the size cycle
> The compiler must know how many bytes each type occupies to lay it out on the stack. A directly-recursive type has no finite answer. A `Box<List>` is always **one pointer** wide regardless of what it points to — so `Cons(i32, Box<List>)` has a definite size (an `i32` plus a pointer). Indirection turns "infinitely big" into "one pointer big."

## Use 2: trait objects

As you saw with [trait objects](#/ch/trait-objects), a `dyn Trait` has no fixed size, so it must live behind a pointer. `Box<dyn Trait>` is the owning way to hold one — the basis of heterogeneous collections:

```rust
trait Animal { fn speak(&self) -> String; }
struct Dog; struct Cat;
impl Animal for Dog { fn speak(&self) -> String { "Woof".into() } }
impl Animal for Cat { fn speak(&self) -> String { "Meow".into() } }

fn main() {
    // A Vec of different types, unified behind Box<dyn Animal>:
    let animals: Vec<Box<dyn Animal>> = vec![Box::new(Dog), Box::new(Cat)];
    for a in &animals {
        println!("{}", a.speak());
    }
}
```

## Use 3: moving large data without copying

When you move a value, its bytes are copied to the new location. For a *big* value (a large array or struct), boxing it first means only the small pointer moves — the bulky data stays put on the heap:

```rust
fn main() {
    // A large array boxed onto the heap:
    let big = Box::new([0u8; 1_000_000]);
    // Moving `big` just moves an 8-byte pointer, not a megabyte of data:
    let moved = big;
    println!("first byte: {}", moved[0]);
}
```

> [!performance] When (and when not) to box
> Boxing costs a heap allocation, so don't box small values you'd happily keep on the stack — `Box<i32>` is almost always pointless. Box when you *need* indirection: recursive types, trait objects, or genuinely large values you move around a lot. For everyday small data, plain stack values are faster.

## `Box` is a well-behaved owner

`Box<T>` implements `Deref` (so `*boxed` and method calls work transparently, as if you had a `T`) and `Drop` (so the heap memory is freed automatically when the box goes out of scope). You'll implement both traits yourself in the [Deref & Drop chapter](#/ch/deref-drop) — `Box` is just the standard library's version.

> [!note] `Box` has exactly one owner
> Unlike the reference-counted pointers coming next, a `Box` follows normal ownership: one owner, moved (not shared). When you need *multiple* owners of the same heap data, that's the job of `Rc` and `Arc` — the [next chapter](#/ch/rc-arc).

## Summary

- **`Box<T>`** is the simplest smart pointer: it stores a value on the **heap** and owns it via a stack-sized pointer, freeing it automatically on drop.
- It's essential for **recursive types** (it gives them a finite size), **trait objects** (`Box<dyn Trait>`), and cheaply moving **large data**.
- `Box` **dereferences transparently** (`*b`, method calls) via `Deref`, and cleans up via `Drop`.
- Don't box small stack values needlessly — boxing costs an allocation; use it when you need indirection.
- A `Box` has a **single owner**; for shared ownership, use `Rc`/`Arc` next.

> [!exercise] Try it yourself
> 1. Build the cons-list `1 → 2 → 3 → Nil` and write a function that sums its values (hint: recursion + `match`).
> 2. Make a `Vec<Box<dyn Animal>>` with three different animals and print each one's sound.
> 3. Box a large array `[0u8; 1_000_000]`, move it into another variable, and confirm the original name is no longer usable.

`Box` gives one owner. But what if several parts of your program need to *share* ownership of the same data? Enter reference counting: **`Rc` and `Arc`**.
