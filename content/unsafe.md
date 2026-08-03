<h1><span class="h1-kicker">Advanced Rust</span>Unsafe Rust</h1>

Everything you've written so far is **safe Rust** — the compiler proves it can't cause memory corruption or data races. But sometimes you need to do things the compiler *can't* verify: talk to hardware, call C libraries, or hand-build a data structure with raw pointers. For that, Rust has an escape hatch: the **`unsafe`** keyword. It doesn't turn off safety — it moves the responsibility from the compiler to *you*. This chapter shows how to use it responsibly.

## What `unsafe` actually does

> [!key] `unsafe` is a promise, not a free-for-all
> The `unsafe` keyword does **not** disable the borrow checker or let you do anything you like. It unlocks exactly **five extra abilities** the compiler can't check, and in exchange you promise: *"I've verified this is actually safe; trust me."* Everything else — ownership, borrowing, types — is still fully enforced inside an `unsafe` block. Think of it as "I'm taking manual control of these five things," not "safety off."

The five **unsafe superpowers**:

1. Dereference a raw pointer.
2. Call an `unsafe` function or method.
3. Access or modify a mutable `static` variable.
4. Implement an `unsafe` trait.
5. Access fields of a `union`.

## Superpower 1: raw pointers

Raw pointers (`*const T` and `*mut T`) are like references but without the borrow checker's guarantees — they can be null, dangle, or alias freely. You can *create* them in safe code, but you can only *dereference* them inside `unsafe`:

```rust
fn main() {
    let mut num = 5;

    // Creating raw pointers is safe:
    let r1 = &num as *const i32; // an immutable raw pointer
    let r2 = &mut num as *mut i32; // a mutable raw pointer

    // Dereferencing them requires unsafe — YOU vouch they're valid:
    unsafe {
        println!("r1 points to {}", *r1);
        *r2 = 10;
        println!("now it's {}", *r2);
    }
}
```

## Superpower 2: calling unsafe functions

A function marked `unsafe fn` has requirements the caller must uphold (documented in its contract). Calling it requires an `unsafe` block, which is you saying "I've met the requirements":

```rust
// Marked unsafe: the caller must guarantee something the compiler can't check.
unsafe fn read_unchecked(slice: &[i32], index: usize) -> i32 {
    // Contract: `index` must be in bounds. We skip the bounds check for speed.
    *slice.as_ptr().add(index)
}

fn main() {
    let data = [10, 20, 30];
    let value = unsafe { read_unchecked(&data, 1) }; // we promise 1 is in bounds
    println!("value = {value}");
}
```

## The golden rule: wrap unsafe in safe abstractions

You rarely sprinkle `unsafe` through your code. Instead, you write a small `unsafe` core and wrap it in a **safe API** that upholds the invariants — so callers get safety without ever writing `unsafe` themselves. This is exactly how the standard library is built. Here's a simplified version of `slice::split_at_mut` (which is impossible in *pure* safe Rust, because it hands out two mutable references into one slice):

```rust
fn split_at_mut<T>(slice: &mut [T], mid: usize) -> (&mut [T], &mut [T]) {
    let len = slice.len();
    let ptr = slice.as_mut_ptr();
    assert!(mid <= len); // uphold the invariant BEFORE the unsafe block

    unsafe {
        (
            std::slice::from_raw_parts_mut(ptr, mid),
            std::slice::from_raw_parts_mut(ptr.add(mid), len - mid),
        )
    }
}

fn main() {
    let mut numbers = [1, 2, 3, 4, 5, 6];
    let (left, right) = split_at_mut(&mut numbers, 3);
    left[0] = 100;
    right[0] = 200;
    println!("{numbers:?}"); // [100, 2, 3, 200, 5, 6]
}
```

The `unsafe` is *contained*: the `assert!` guarantees `mid` is valid, the two ranges provably don't overlap, so the safe signature is genuinely safe. Callers never touch `unsafe`.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A small unsafe core wrapped in a safe API that callers use without any unsafe">
  <style>
    .um { font: 600 12px var(--font-mono); fill: var(--text); }
    .uc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .safe { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .core { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <rect x="40" y="20" width="560" height="110" rx="12" class="safe"/>
  <text x="60" y="44" class="um" fill="var(--green)">Safe public API — callers write NO unsafe</text>
  <rect x="220" y="60" width="200" height="52" rx="8" class="core"/>
  <text x="238" y="84" class="um" fill="var(--red)">tiny unsafe { }</text>
  <text x="238" y="102" class="uc">audited, invariants upheld</text>
  <text x="60" y="122" class="uc">The unsafe is small, reviewed, and impossible to misuse from outside.</text>
</svg>
<figcaption>The pattern: a minimal, audited <code>unsafe</code> core behind a safe interface — how <code>Vec</code>, <code>Rc</code>, and the whole std library are built.</figcaption>
</figure>

## Mutable statics and unsafe traits (briefly)

**Mutable statics** are global mutable variables. They're `unsafe` to touch because multiple threads could race on them:

```rust
static mut COUNTER: u32 = 0;

fn main() {
    unsafe {
        COUNTER += 1; // unsafe: no thread-safety guarantee
        println!("counter = {COUNTER}");
    }
    // (Prefer an atomic or a Mutex over `static mut` in real code!)
}
```

**Unsafe traits** (like `Send`/`Sync`) carry invariants the compiler can't verify, so implementing them by hand requires `unsafe impl` — a promise that you've ensured the guarantee. You saw this in [Send & Sync](#/ch/send-sync); it's rare outside low-level libraries.

## Using it responsibly

> [!warning] Undefined behavior is unforgiving
> If you break an `unsafe` contract — dereference a dangling pointer, create two aliasing `&mut`, read uninitialized memory — you get **undefined behavior (UB)**: the program may crash, corrupt data, leak secrets, or *appear* to work until it catastrophically doesn't. Unlike a safe-Rust panic, UB has no guarantees at all. This is the world C programmers live in full-time; `unsafe` is you visiting it briefly, so tread carefully.

> [!best] Rules for writing sound `unsafe`
> 1. **Minimize it.** Keep `unsafe` blocks as small as possible — just the operations that truly need it.
> 2. **Wrap it.** Expose a safe API; never make callers reason about your invariants.
> 3. **Document the contract.** Write a `// SAFETY:` comment above every `unsafe` block explaining *why* it's actually safe.
> 4. **Uphold invariants first.** `assert!` preconditions before the `unsafe` block, as we did in `split_at_mut`.
> 5. **Test with Miri.** Run `cargo +nightly miri test` — Miri is an interpreter that detects many kinds of UB the normal compiler can't.
>
> Most Rust programmers write `unsafe` rarely or never. When you do, these habits keep it sound.

> [!note] You probably need it less than you think
> Reaching for `unsafe` to "make the borrow checker stop complaining" is almost always the wrong move — there's usually a safe design (an index, an `Rc<RefCell>`, a restructure) that's both correct and clearer. Legitimate `unsafe` is for: FFI (calling C), hardware/embedded, and building low-level data structures or performance primitives that safe Rust genuinely can't express. If you're not doing one of those, look for the safe way first.

## Summary

- **`unsafe`** unlocks **five** abilities the compiler can't verify (raw-pointer deref, calling unsafe fns, mutable statics, unsafe traits, unions) — everything else stays fully checked.
- It's a **promise you make**, shifting responsibility to you; it does *not* disable ownership or borrowing.
- The golden pattern: a **small, audited `unsafe` core wrapped in a safe API** — exactly how the standard library works (e.g. `split_at_mut`).
- Breaking an unsafe contract causes **undefined behavior**, which is unbounded and unforgiving.
- Write sound `unsafe` by minimizing and wrapping it, documenting `// SAFETY:` contracts, asserting invariants, and testing with **Miri**. Prefer safe designs whenever possible.

> [!exercise] Try it yourself
> 1. Create a `*const i32` and a `*mut i32` to a variable, then read and modify the value through them in an `unsafe` block.
> 2. Add a `// SAFETY:` comment to the `split_at_mut` example explaining precisely why the two mutable slices don't overlap.
> 3. Rewrite the `static mut COUNTER` example to use an `AtomicU32` instead, and note why it no longer needs `unsafe`.

`unsafe` lets you go below the language. Now let's go *above* it — writing code that writes code, with **declarative macros**.
