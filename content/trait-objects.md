<h1><span class="h1-kicker">Generics, Traits & Lifetimes</span>Trait Objects & Dynamic Dispatch</h1>

Generics with trait bounds are perfect when each call works with *one* type. But sometimes you need a single collection holding a **mix** of different types that share a trait — a list of GUI widgets where some are buttons and some are checkboxes, all "drawable." For that, Rust offers **trait objects** and **dynamic dispatch**. This chapter explains how they work, and the trade-off against generics.

## The problem: a mixed collection

Say we're building a GUI. We have several component types, all of which can be drawn:

```rust
trait Draw {
    fn draw(&self) -> String;
}

struct Button { label: String }
struct Checkbox { checked: bool }

impl Draw for Button {
    fn draw(&self) -> String { format!("[ {} ]", self.label) }
}
impl Draw for Checkbox {
    fn draw(&self) -> String { format!("[{}]", if self.checked { "x" } else { " " }) }
}
# fn main() {}
```

We want a `Vec` holding *both* buttons and checkboxes. But a `Vec<T>` holds one type `T` — a `Vec<Button>` can't hold a `Checkbox`. Generics won't help here, because they resolve to a single concrete type. We need something that says "any type that is `Draw`, whatever it is."

## Trait objects with `dyn`

A **trait object** is a value accessed through a pointer, where all we know is "it implements this trait." You write it as `dyn Trait`, and because its size isn't known at compile time, it always lives behind a pointer — usually `Box<dyn Trait>` (owned) or `&dyn Trait` (borrowed):

```rust
trait Draw {
    fn draw(&self) -> String;
}
# struct Button { label: String }
# struct Checkbox { checked: bool }
# impl Draw for Button { fn draw(&self) -> String { format!("[ {} ]", self.label) } }
# impl Draw for Checkbox { fn draw(&self) -> String { format!("[{}]", if self.checked { "x" } else { " " }) } }

fn main() {
    // A Vec of trait objects — a mix of concrete types, unified by `Draw`:
    let screen: Vec<Box<dyn Draw>> = vec![
        Box::new(Button { label: "OK".into() }),
        Box::new(Checkbox { checked: true }),
        Box::new(Button { label: "Cancel".into() }),
    ];

    for component in &screen {
        println!("{}", component.draw()); // Rust calls the right draw() for each
    }
}
```

That `Vec<Box<dyn Draw>>` happily holds buttons *and* checkboxes together. At runtime, each `.draw()` call dispatches to the correct type's implementation.

> [!jargon] `dyn`, trait object, and the fat pointer
> **`dyn Trait`** means "some type implementing `Trait`, decided at runtime." A **trait object** is a fat pointer with two parts: a pointer to the *data*, and a pointer to a *vtable* (virtual method table) — a little lookup table of the type's method implementations. When you call `component.draw()`, Rust follows the vtable to the right function.

## Static vs. dynamic dispatch

This is the core concept. Generics and trait objects both let you write "any `Draw`" code, but they resolve the method call at different times:

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="Static dispatch resolves calls at compile time; dynamic dispatch looks them up via a vtable at runtime">
  <style>
    .dsh { font: 700 12px var(--font-sans); }
    .dsm { font: 600 11px var(--font-mono); fill: var(--text); }
    .dsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .stat { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .dyn2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .vt { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="14" y="16" width="300" height="190" rx="10" fill="none" stroke="var(--rust-400)" stroke-width="1.5"/>
  <text x="28" y="40" class="dsh" fill="var(--rust-600)">STATIC dispatch — generics</text>
  <text x="28" y="62" class="dsm">fn f&lt;T: Draw&gt;(x: &amp;T)</text>
  <rect x="28" y="74" width="120" height="30" class="stat"/><text x="40" y="94" class="dsm">f_button()</text>
  <rect x="160" y="74" width="130" height="30" class="stat"/><text x="172" y="94" class="dsm">f_checkbox()</text>
  <text x="28" y="130" class="dsc">Compiler makes a copy per type.</text>
  <text x="28" y="148" class="dsc">Call address known at COMPILE time.</text>
  <text x="28" y="172" class="dsc">✅ Fastest (inlinable). ❌ One type</text>
  <text x="28" y="188" class="dsc">per call; bigger binary.</text>
  <rect x="326" y="16" width="300" height="190" rx="10" fill="none" stroke="var(--blue)" stroke-width="1.5"/>
  <text x="340" y="40" class="dsh" fill="var(--blue)">DYNAMIC dispatch — dyn</text>
  <text x="340" y="62" class="dsm">fn f(x: &amp;dyn Draw)</text>
  <rect x="340" y="74" width="120" height="46" class="dyn2"/><text x="352" y="94" class="dsm">obj: data ●</text><text x="352" y="112" class="dsm">     vtable ●</text>
  <rect x="480" y="74" width="130" height="46" class="vt"/><text x="492" y="94" class="dsm">vtable:</text><text x="492" y="112" class="dsm">draw → …</text>
  <path d="M460 108 L478 108" stroke="var(--blue)" stroke-width="2" marker-end="url(#adx)"/>
  <text x="340" y="148" class="dsc">Call address looked up at RUNTIME.</text>
  <text x="340" y="172" class="dsc">✅ One function, mixed types. ❌ Tiny</text>
  <text x="340" y="188" class="dsc">per-call cost; no inlining.</text>
  <defs><marker id="adx" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker></defs>
</svg>
<figcaption><b>Static dispatch</b> (generics) bakes in the exact function at compile time; <b>dynamic dispatch</b> (<code>dyn</code>) looks it up through a vtable at runtime.</figcaption>
</figure>

- **Generics → static dispatch.** The compiler knows the exact type, so it hard-wires the call (and can even inline it). Maximum speed, but each concrete type gets its own compiled copy, and one call site works with one type.
- **`dyn Trait` → dynamic dispatch.** The exact type isn't known until runtime, so the call goes through the vtable. This adds a tiny indirection (one pointer hop, no inlining) but lets a single function or collection handle many types at once.

> [!key] Which should I use?
> **Default to generics** (`impl Trait`, `<T: Trait>`) — they're faster and keep types precise. Reach for **trait objects** (`dyn Trait`) when you specifically need:
> - a collection of mixed types (`Vec<Box<dyn Trait>>`), or
> - to return different concrete types from different branches, or
> - to reduce code bloat / compile time when you have many types and don't need peak speed.
>
> In practice the dynamic-dispatch cost is negligible for most code — choose based on whether you need the *flexibility*, not premature performance worries.

## `&dyn` vs `Box<dyn>`

Like any reference vs. owned choice: use **`&dyn Trait`** to *borrow* a trait object (e.g. a function parameter), and **`Box<dyn Trait>`** to *own* one (e.g. store it in a struct or `Vec`):

```rust
# trait Draw { fn draw(&self) -> String; }
# struct Button { label: String }
# impl Draw for Button { fn draw(&self) -> String { format!("[ {} ]", self.label) } }
// Borrows any Draw — no allocation:
fn render(item: &dyn Draw) {
    println!("{}", item.draw());
}

fn main() {
    let ok = Button { label: "OK".into() };
    render(&ok);
}
```

## Object safety

Not every trait can become a trait object. A trait is **object-safe** only if its methods can be called through a pointer without knowing the concrete type. The two most common rules: methods can't return `Self` by value, and methods can't have generic type parameters.

> [!mistake] "the trait cannot be made into an object"
> If you see `error[E0038]: the trait cannot be made into an object`, you tried to use `dyn` with a trait that isn't object-safe — often because it has a method returning `Self` (like `Clone`) or a generic method. The fix is usually to use generics (`impl Trait`) instead, or to redesign the method to not return `Self`. Most traits you write *are* object-safe; this only bites occasionally.

## Summary

- A **trait object** (`dyn Trait`, behind `Box<dyn Trait>` or `&dyn Trait`) lets values of **different concrete types** be used together through a shared trait.
- It works via **dynamic dispatch**: a **vtable** lookup at runtime picks the right method.
- **Generics** use **static dispatch** — resolved at compile time, fastest, one type per call site; **trait objects** trade a tiny runtime cost for the flexibility of mixing types.
- Use **`&dyn`** to borrow and **`Box<dyn>`** to own; store `Vec<Box<dyn Trait>>` for heterogeneous collections.
- Only **object-safe** traits can be trait objects (no `Self`-returning or generic methods).

> [!exercise] Try it yourself
> 1. Define a trait `Shape { fn area(&self) -> f64; }`, implement it for `Circle` and `Square`, and store both in a `Vec<Box<dyn Shape>>`. Sum their areas in a loop.
> 2. Write `fn total_area(shapes: &[Box<dyn Shape>]) -> f64`.
> 3. Rewrite one function to take `&impl Shape` (static) and another to take `&dyn Shape` (dynamic); note when each is more convenient.

We've now used references with abandon — but how does the compiler *know* a returned reference is still valid? The answer is Rust's most feared (and, once understood, most elegant) feature: **lifetimes**.
