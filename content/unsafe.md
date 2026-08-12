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

Raw pointers are the foundation the other superpowers rest on, and the place most `unsafe` bugs come from — so the rest of this section covers them properly.

### What a raw pointer drops compared to a reference

A `&T` carries a stack of compile-time guarantees. A `*const T` is the same machine-level address with **every one of them removed**:

<figure class="diagram">
<svg viewBox="0 0 670 240" role="img" aria-label="A comparison showing that a reference guarantees non-null, aligned, initialized, valid lifetime, and enforced aliasing rules, while a raw pointer guarantees none of these and shifts each obligation to the programmer.">
  <style>
    .rp-h { font: 700 11.5px var(--font-sans); }
    .rp-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .rp-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .rp-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .rp-no { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.3; }
    .rp-hd { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <rect x="212" y="14" width="210" height="26" rx="5" class="rp-hd"/><text x="248" y="32" class="rp-m">&amp;T  (reference)</text>
  <rect x="440" y="14" width="218" height="26" rx="5" class="rp-hd"/><text x="470" y="32" class="rp-m">*const T  (raw pointer)</text>
  <text x="12" y="62" class="rp-c">never null</text>
  <rect x="212" y="48" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="64" class="rp-c">guaranteed by the compiler</text>
  <rect x="440" y="48" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="64" class="rp-c">may be null — you must check</text>
  <text x="12" y="88" class="rp-c">always aligned</text>
  <rect x="212" y="74" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="90" class="rp-c">guaranteed</text>
  <rect x="440" y="74" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="90" class="rp-c">you must ensure it</text>
  <text x="12" y="114" class="rp-c">points to init data</text>
  <rect x="212" y="100" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="116" class="rp-c">guaranteed</text>
  <rect x="440" y="100" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="116" class="rp-c">may be uninitialized garbage</text>
  <text x="12" y="140" class="rp-c">outlives its use</text>
  <rect x="212" y="126" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="142" class="rp-c">lifetimes enforce it</text>
  <rect x="440" y="126" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="142" class="rp-c">NO lifetime — may dangle</text>
  <text x="12" y="166" class="rp-c">aliasing rules</text>
  <rect x="212" y="152" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="168" class="rp-c">shared XOR mutable, checked</text>
  <rect x="440" y="152" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="168" class="rp-c">alias freely — you must not</text>
  <text x="12" y="192" class="rp-c">Send / Sync</text>
  <rect x="212" y="178" width="210" height="22" rx="4" class="rp-ok"/><text x="222" y="194" class="rp-c">inherits from T</text>
  <rect x="440" y="178" width="218" height="22" rx="4" class="rp-no"/><text x="450" y="194" class="rp-c">neither — blocks auto traits</text>
  <text x="12" y="224" class="rp-c">A raw pointer is not "a more powerful reference" — it is the same address with the proof obligations moved onto you.</text>
</svg>
<figcaption>Every guarantee a reference gives you is one you must personally uphold with a raw pointer.</figcaption>
</figure>

### Creating raw pointers

There are several routes, and one of them is newer than most tutorials:

```rust
fn main() {
    let mut value = 42;

    // 1. Cast from a reference (the classic form):
    let p1 = &value as *const i32;
    let p2 = &mut value as *mut i32;

    // 2. `&raw const` / `&raw mut` (Rust 1.82+) — preferred, because it never
    //    creates an intermediate reference. That matters for packed/unaligned
    //    fields and uninitialized memory, where making a `&` would itself be UB.
    let p3 = &raw const value;
    let p4 = &raw mut value;

    // 3. A null pointer, and the "dangling but aligned" placeholder:
    let nothing: *const i32 = std::ptr::null();
    let dangling: *const i32 = std::ptr::dangling();

    // 4. From a Box / Vec / slice (a real allocation):
    let boxed = Box::new(7);
    let p5 = Box::into_raw(boxed); // we now OWN this allocation manually

    println!("null? {}  aligned-dangling? {}", nothing.is_null(), !dangling.is_null());
    unsafe {
        println!("p1={} p3={} p5={}", *p1, *p3, *p5);
        *p4 = 43;
        println!("after *p4 = 43: {}", *p2);

        // We took ownership out of the Box, so we must give it back —
        // otherwise this allocation leaks.
        drop(Box::from_raw(p5));
    }
}
```

> [!tip] Prefer `&raw const` / `&raw mut` over `as` casts
> `&value as *const i32` first creates a `&i32` and then casts it. Usually harmless — but if the place is uninitialized, misaligned, or a field of a `#[repr(packed)]` struct, *creating that intermediate reference is already undefined behaviour*, before you've done anything with it. `&raw const value` produces the pointer directly, with no reference in between. It was stabilised in Rust 1.82 precisely to close this trap; the `addr_of!`/`addr_of_mut!` macros were the older spelling and do the same job.

### Thin and fat pointers

Not every pointer is one machine word. Pointers to **dynamically sized types** carry a second word of metadata:

```rust
use std::mem::size_of;

fn main() {
    println!("*const i32       {:>3} bytes   (thin: just an address)", size_of::<*const i32>());
    println!("*mut  u8         {:>3} bytes   (thin)", size_of::<*mut u8>());
    println!("*const [i32]     {:>3} bytes   (fat: address + LENGTH)", size_of::<*const [i32]>());
    println!("*const str       {:>3} bytes   (fat: address + byte length)", size_of::<*const str>());
    println!("*const dyn Send  {:>3} bytes   (fat: address + VTABLE pointer)", size_of::<*const dyn Send>());
    println!();
    println!("NonNull<i32>         {:>3} bytes", size_of::<std::ptr::NonNull<i32>>());
    println!("Option<NonNull<i32>> {:>3} bytes   (None reuses the null pattern)",
             size_of::<Option<std::ptr::NonNull<i32>>>());
}
```

That last pair is the [niche optimization](#/ch/result-option) again: because `NonNull` promises never to be null, `Option` stores `None` *as* null and stays 8 bytes. This is how `Vec`, `Box`, and `Rc` are built without paying for an extra tag.

### When is a dereference actually sound?

This is the checklist. `unsafe { *p }` is only defined behaviour if **all** of these hold:

| Requirement | Meaning | Typical way it breaks |
|---|---|---|
| **Non-null** | `p` isn't 0 | forgot to check a C return value |
| **Aligned** | address is a multiple of `align_of::<T>()` | casting `*const u8` to `*const u32` |
| **Dereferenceable** | the whole `size_of::<T>()` bytes are in one live allocation | pointer arithmetic ran off the end |
| **Initialized** | those bytes hold a valid value of `T` | reading `MaybeUninit` too early |
| **Valid for `T`** | e.g. a `bool` is 0 or 1, a `char` is a valid scalar | transmuting arbitrary bytes |
| **Aliasing respected** | no live `&mut` elsewhere to the same place | two `&mut` from one pointer |
| **Not dangling** | the allocation is still alive | use-after-free |

> [!warning] "It printed the right number" proves nothing
> Undefined behaviour is not a crash — it's the compiler being *allowed to assume the situation never happens*. Code with UB frequently works perfectly in debug builds, then breaks when you add `--release`, upgrade the compiler, or change something unrelated. The optimizer may delete your null check because "a dereferenced pointer can't be null," or reorder writes because "these two `&mut` can't alias." **Testing cannot demonstrate the absence of UB.** That's what Miri is for, below.

### Pointer arithmetic

Raw pointers support offsetting — in units of `T`, not bytes:

```rust
fn main() {
    let data = [10, 20, 30, 40, 50];
    let base = data.as_ptr(); // *const i32

    unsafe {
        println!("base      = {}", *base);
        println!("base+2    = {}", *base.add(2));      // 3rd element
        println!("offset(4) = {}", *base.offset(4));   // signed version
        println!("last-1    = {}", *base.add(4).sub(1));

        // Walk the array manually, the way C would:
        let mut p = base;
        let end = base.add(data.len());
        let mut sum = 0;
        while p < end {
            sum += *p;
            p = p.add(1);
        }
        println!("sum       = {sum}");
    }

    // Distance between two pointers, in elements:
    unsafe {
        let d = base.add(3).offset_from(base);
        println!("offset_from = {d}");
    }
}
```

> [!mistake] `add` may only stay *within* one allocation — one past the end, and no further
> The rule is stricter than C programmers expect. `ptr.add(n)` is undefined behaviour if the result lands outside the allocation the pointer came from, **even if you never dereference it**. Computing the address is already the error. One-past-the-end is specifically allowed (that's how the `while p < end` loop above terminates), but two-past is not.
>
> If you genuinely need to compute an out-of-range address without UB, use `wrapping_add`, which is defined for any value — you just can't dereference the result unless it lands somewhere valid. Also note `add` takes a `usize` and `offset` a signed `isize`; both are `unsafe` for this reason, while `wrapping_add` is safe to *call* precisely because it makes no promises.

### Reading and writing through pointers

Direct `*p` isn't always what you want — these are the tools for the trickier cases:

| Function | Does | Use when |
|---|---|---|
| `ptr::read(p)` | copies the value out, **without** moving | you must duplicate a non-`Copy` value |
| `ptr::write(p, v)` | writes **without** dropping the old value | the destination is uninitialized |
| `ptr::copy(src, dst, n)` | `memmove` — regions may overlap | shifting elements within a buffer |
| `ptr::copy_nonoverlapping` | `memcpy` — faster, must **not** overlap | copying between distinct buffers |
| `ptr::read_unaligned` | reads without the alignment requirement | parsing bytes off the wire |
| `ptr::swap` | exchanges two values | in-place rearrangement |

```rust
fn main() {
    let mut buffer = [1, 2, 3, 4, 5];

    unsafe {
        let p = buffer.as_mut_ptr();

        // Shift [1,2,3,4] one slot right — regions OVERLAP, so copy (memmove):
        std::ptr::copy(p, p.add(1), 4);
        println!("after copy:  {buffer:?}");

        // Read a value out without moving it:
        let first = std::ptr::read(p);
        println!("read first:  {first}");

        // Write without dropping whatever was there:
        std::ptr::write(p, 99);
        println!("after write: {buffer:?}");
    }
}
```

> [!key] Why `read`/`write` exist at all
> Plain `*p = value` *drops* the old value first — correct when the destination holds a live value, catastrophic when it holds uninitialized garbage (you'd run a destructor on nonsense). Conversely `let v = *p;` on a non-`Copy` type would move out of a place the compiler doesn't own. `ptr::write` skips the drop; `ptr::read` copies bit-for-bit and leaves the source untouched — which also means **you now have two owners of one value**, and dropping both is a double-free. These functions are how `Vec::push`, `Vec::remove`, and `mem::swap` are actually implemented.

### The UB catalogue for raw pointers

The realistic failure modes, in rough order of how often they appear:

| Bug | Looks like |
|---|---|
| **Use-after-free** | holding a pointer into a `Vec` that reallocated, or past a `Box`'s drop |
| **Two aliasing `&mut`** | `&mut *p` twice, or handing out overlapping slices |
| **Out-of-bounds offset** | `add(n)` past the allocation, often an off-by-one |
| **Misalignment** | casting `*const u8` from a byte buffer to `*const u32` |
| **Uninitialized read** | reading `MaybeUninit` before writing it |
| **Invalid value** | transmuting `2u8` into a `bool`, or `0` into a `NonNull` |
| **Leak** | `Box::into_raw` without a matching `Box::from_raw` (safe, but still a bug) |

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

**Mutable statics** are global mutable variables. They're `unsafe` to touch because multiple threads could race on them — and the language is actively moving away from them:

```rust
use std::sync::atomic::{AtomicU32, Ordering};

// ✅ The right way: an atomic static needs no `unsafe` at all.
static COUNTER: AtomicU32 = AtomicU32::new(0);

fn main() {
    COUNTER.fetch_add(1, Ordering::Relaxed);
    println!("counter = {}", COUNTER.load(Ordering::Relaxed));
}
```

> [!warning] `static mut` references are a hard error in edition 2024
> You'll still see this in older material:
> ```rust,ignore
> static mut COUNTER: u32 = 0;
> unsafe { COUNTER += 1; println!("{COUNTER}"); }   // ← creates a &COUNTER
> ```
> On **edition 2021** that now warns (`static_mut_refs`); on **edition 2024** it's a **compile error**. The reason is that taking any reference to a `static mut` is unsound the moment another thread touches it, and `println!` quietly takes one. If you truly need a mutable static, you must go through a raw pointer and never materialise a reference:
> ```rust,ignore
> static mut COUNTER: u32 = 0;
> unsafe {
>     let p = &raw mut COUNTER;     // no reference is created
>     *p += 1;
>     println!("{}", *p);
> }
> ```
> In practice you almost never should. Use an **`AtomicU32`** (as above), a **`Mutex`**, or **`OnceLock`**/**`LazyLock`** for one-time init — all of which are safe, thread-correct, and shorter. See [OnceLock, LazyLock & Global State](#/ch/lazy-statics).

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
- A **raw pointer** is a reference with every guarantee removed: it may be null, misaligned, uninitialized, dangling, aliasing, and it carries no lifetime and neither `Send` nor `Sync`.
- Prefer **`&raw const` / `&raw mut`** (Rust 1.82+) over `as` casts — they never create the intermediate reference that can itself be UB.
- Pointers to DSTs are **fat**: `*const [T]`, `*const str`, and `*const dyn Trait` are 16 bytes (address + length or vtable); ordinary pointers are 8.
- A dereference is sound only if the pointer is **non-null, aligned, dereferenceable, initialized, valid for `T`, non-aliasing, and not dangling** — all seven, every time.
- **`add`/`offset` must stay within one allocation** (one-past-the-end permitted), and merely *computing* an out-of-range address is already UB. `wrapping_add` is the escape hatch.
- Use **`ptr::read`/`write`/`copy`** when the destination is uninitialized or the value isn't `Copy` — plain `*p = v` drops the old value first.
- The golden pattern: a **small, audited `unsafe` core wrapped in a safe API** — exactly how the standard library works (e.g. `split_at_mut`).
- **`static mut` references warn on edition 2021 and are an error on edition 2024** — use an atomic, a `Mutex`, or `OnceLock` instead.
- Breaking an unsafe contract causes **undefined behavior**, which is unbounded and unforgiving — and **testing cannot prove its absence**.
- Write sound `unsafe` by minimizing and wrapping it, documenting `// SAFETY:` contracts, asserting invariants, and testing with **Miri**. Prefer safe designs whenever possible.

> [!exercise] Try it yourself
> 1. Create a `*const i32` and a `*mut i32` to a variable, then read and modify the value through them in an `unsafe` block.
> 2. Add a `// SAFETY:` comment to the `split_at_mut` example explaining precisely why the two mutable slices don't overlap.
> 3. Rewrite the `static mut COUNTER` example to use an `AtomicU32` instead, and note why it no longer needs `unsafe`.
> 4. Print `size_of` for `*const u8`, `*const [u8]`, and `*const dyn std::fmt::Debug`. Explain the second word in each fat pointer.
> 5. Take a pointer into a `Vec`, then `push` enough elements to force a reallocation, then dereference the old pointer. Run it under Miri (`cargo +nightly miri run`) and read what it says — this is use-after-free.
> 6. Walk an array with `ptr.add(i)` in a loop. Then deliberately loop one element too far and run it under Miri.
> 7. Use `Box::into_raw` and *forget* the matching `Box::from_raw`. Confirm it compiles and runs fine — then explain why it's still a bug.
> 8. Cast a `&[u8; 8]` to `*const u32` at a deliberately odd offset and dereference it. What requirement did you break, and does it fail visibly?

`unsafe` lets you go below the language. Now let's go *above* it — writing code that writes code, with **declarative macros**.
