<h1><span class="h1-kicker">Ownership — The Heart of Rust</span>Stack, Heap & the Memory Model</h1>

You've seen the words *stack* and *heap* several times now. Understanding these two regions of memory — what they are, what goes where, and why it matters — turns Rust's ownership rules from "arbitrary restrictions" into "obvious common sense." This chapter builds that mental model. It's the difference between fighting the compiler and dancing with it.

## Two regions of memory

When your program runs, the operating system gives it memory to work with. That memory is used in two very different ways.

<figure class="diagram">
<svg viewBox="0 0 640 300" role="img" aria-label="The stack grows downward in neat frames; the heap is a flexible pool of allocations">
  <style>
    .hh { font: 700 13px var(--font-sans); }
    .mm5 { font: 600 11px var(--font-mono); fill: var(--text); }
    .cc5 { font: 11.5px var(--font-sans); fill: var(--text-mute); }
    .frame { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .halloc { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="hh" fill="var(--blue)">THE STACK</text>
  <rect x="20" y="32" width="240" height="30" class="frame"/><text x="30" y="52" class="mm5">main() frame: x=5, ptr●</text>
  <rect x="20" y="62" width="240" height="30" class="frame"/><text x="30" y="82" class="mm5">greet() frame: name●</text>
  <rect x="20" y="92" width="240" height="30" class="frame"/><text x="30" y="112" class="mm5">len() frame: n=11</text>
  <text x="20" y="150" class="cc5">Neat stack of frames, one per function call.</text>
  <text x="20" y="168" class="cc5">Push on call, pop on return. Blazing fast.</text>
  <text x="20" y="186" class="cc5">Every value here has a known, fixed size.</text>
  <text x="380" y="22" class="hh" fill="var(--rust-600)">THE HEAP</text>
  <rect x="380" y="32" width="90" height="40" class="halloc"/><text x="392" y="56" class="mm5">"hello"</text>
  <rect x="490" y="52" width="120" height="30" class="halloc"/><text x="500" y="72" class="mm5">Vec buffer</text>
  <rect x="400" y="92" width="70" height="34" class="halloc"/><text x="410" y="114" class="mm5">Box</text>
  <rect x="500" y="100" width="90" height="46" class="halloc"/><text x="512" y="128" class="mm5">big data</text>
  <text x="380" y="176" class="cc5">A flexible pool. Ask the allocator for space</text>
  <text x="380" y="194" class="cc5">(slower), get back a pointer. Any size, any</text>
  <text x="380" y="212" class="cc5">lifetime — you manage it (in Rust: ownership).</text>
  <path d="M270 80 C 330 80, 330 52, 378 52" stroke="var(--rust-500)" stroke-width="2" fill="none" marker-end="url(#arh)"/>
  <text x="285" y="240" class="cc5" fill="var(--text)">A stack value can hold a <tspan font-family="var(--font-mono)">ptr</tspan> into the heap ↑</text>
  <defs><marker id="arh" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption>The <b>stack</b> is fast and orderly for fixed-size data; the <b>heap</b> is flexible for data whose size or lifetime varies.</figcaption>
</figure>

### The stack

The **stack** stores values in the order it gets them and removes them in the opposite order — *last in, first out*, like a stack of plates. Every time a function is called, it gets a **stack frame**: a block holding its local variables. When the function returns, its whole frame is popped off in one instant.

> [!key] Why the stack is so fast
> Allocating on the stack is nearly free: the computer just moves a single pointer. There's no searching, no bookkeeping. The catch: **every value on the stack must have a size known at compile time**, and it only lives as long as its function call.

### The heap

The **heap** is a large, less-organized pool of memory for data whose size isn't known ahead of time, or that needs to outlive the function that created it. To use it, you ask the *allocator* (the part of the system that manages the heap) for a chunk of space; it finds a spot, reserves it, and hands you back a **pointer** (the address of that spot).

> [!jargon] Allocate / deallocate / pointer
> To **allocate** is to reserve heap memory; to **deallocate** (or *free*) is to give it back. A **pointer** is a value that holds the *address* of data elsewhere in memory. Pointers themselves are small and live on the stack, even when what they point to lives on the heap.

## What goes where?

Here's the rule of thumb, and it explains everything you learned about `Copy` and moves:

| Lives on the **stack** | Lives on the **heap** (with a stack handle) |
|------------------------|---------------------------------------------|
| `i32`, `f64`, `bool`, `char` | `String` (handle on stack, text on heap) |
| Fixed-size arrays `[i32; 4]` | `Vec<T>` (handle on stack, elements on heap) |
| Tuples/structs of stack types | `Box<T>` (pointer on stack, value on heap) |
| References `&T`, `&mut T` | Any recursively/dynamically sized data |

A `String`, for example, is a small three-word handle **on the stack** (pointer, length, capacity) that points to the actual characters **on the heap**. That's exactly why moving a `String` only copies the cheap handle — and why cloning it does the expensive work of duplicating the heap bytes.

You can see the sizes of the *stack portion* of any type:

```rust
use std::mem::size_of;

fn main() {
    println!("i32:        {} bytes", size_of::<i32>());        // 4
    println!("bool:       {} bytes", size_of::<bool>());       // 1
    println!("&str:       {} bytes", size_of::<&str>());       // 16 (ptr + len)
    println!("String:     {} bytes", size_of::<String>());     // 24 (ptr+len+cap)
    println!("Box<i32>:   {} bytes", size_of::<Box<i32>>());   // 8  (just a pointer)
    println!("[i32; 100]: {} bytes", size_of::<[i32; 100]>()); // 400 (all on stack!)
}
```

Notice `Box<i32>` is only 8 bytes on the stack even though it owns an integer on the heap — because a `Box` is just a pointer. And `[i32; 100]` is a full 400 bytes on the stack, because arrays store all their data inline.

<figure class="diagram">
<svg viewBox="0 0 670 215" role="img" aria-label="A String variable is a three word handle on the stack holding a pointer, a length of 5 and a capacity of 8, pointing to the bytes h e l l o stored in the heap. Cloning duplicates the heap bytes; moving copies only the 24 byte handle.">
  <style>
    .sh-h { font: 700 11.5px var(--font-sans); }
    .sh-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .sh-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .sh-st { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .sh-hp { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .sh-free { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.1; stroke-dasharray: 3 2; }
  </style>
  <text x="14" y="16" class="sh-h" fill="var(--blue)">STACK — the handle (24 bytes, fixed)</text>
  <text x="400" y="16" class="sh-h" fill="var(--rust-600)">HEAP — the text (grows)</text>
  <rect x="14" y="26" width="200" height="26" class="sh-st"/><text x="24" y="44" class="sh-m">ptr  ●───────────────</text>
  <rect x="14" y="54" width="200" height="26" class="sh-st"/><text x="24" y="72" class="sh-m">len  5</text>
  <rect x="14" y="82" width="200" height="26" class="sh-st"/><text x="24" y="100" class="sh-m">cap  8</text>
  <rect x="400" y="26" width="40" height="40" class="sh-hp"/><text x="412" y="51" class="sh-m">h</text>
  <rect x="442" y="26" width="40" height="40" class="sh-hp"/><text x="454" y="51" class="sh-m">e</text>
  <rect x="484" y="26" width="40" height="40" class="sh-hp"/><text x="496" y="51" class="sh-m">l</text>
  <rect x="526" y="26" width="40" height="40" class="sh-hp"/><text x="538" y="51" class="sh-m">l</text>
  <rect x="568" y="26" width="40" height="40" class="sh-hp"/><text x="580" y="51" class="sh-m">o</text>
  <rect x="610" y="26" width="48" height="40" class="sh-free"/><text x="616" y="51" class="sh-c">spare</text>
  <path d="M216 39 C 300 39, 340 44, 398 44" stroke="var(--blue)" stroke-width="1.8" fill="none" marker-end="url(#sha)"/>
  <text x="400" y="84" class="sh-c">len = 5 bytes used · cap = 8 allocated</text>
  <text x="400" y="100" class="sh-c">push beyond cap → reallocate &amp; copy</text>
  <rect x="14" y="128" width="644" height="26" rx="4" class="sh-st"/>
  <text x="24" y="146" class="sh-m">MOVE: copy the 24-byte handle only — the heap bytes never move. Cheap, O(1).</text>
  <rect x="14" y="160" width="644" height="26" rx="4" class="sh-hp"/>
  <text x="24" y="178" class="sh-m">CLONE: allocate new heap space and copy every byte. Expensive, O(n).</text>
  <text x="14" y="204" class="sh-c">Vec&lt;T&gt; has the identical three-word shape. Box&lt;T&gt; is the same idea with just the pointer (8 bytes, no len/cap).</text>
  <defs><marker id="sha" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker></defs>
</svg>
<figcaption>A <code>String</code> is a fixed 24-byte handle on the stack pointing at variable-length bytes on the heap — which is why moving is cheap and cloning isn't.</figcaption>
</figure>

### Seeing both regions at once

Addresses make the split concrete. Stack values sit close together; heap allocations live somewhere else entirely:

```rust
fn main() {
    let on_stack: i32 = 42;
    let array = [1u8, 2, 3];
    let text = String::from("hello");
    let boxed = Box::new(99);

    println!("STACK addresses (close together, high):");
    println!("  i32       {:p}", &on_stack);
    println!("  [u8; 3]   {:p}", &array);
    println!("  String handle {:p}", &text);

    println!("\nHEAP addresses (elsewhere, and much lower):");
    println!("  String's bytes {:p}", text.as_ptr());
    println!("  Box's value    {:p}", &*boxed);

    println!("\nThe handle is {} bytes; the text it points to is {} bytes.",
             std::mem::size_of::<String>(), text.len());
}
```

The stack addresses cluster within a few dozen bytes of each other — that's one function's frame. The heap addresses are in a completely different range, because they come from the allocator rather than the frame pointer.

> [!warning] The stack is small and fixed — you can exhaust it
> A thread's stack is typically **8 MB** for the main thread and **2 MB** for spawned ones, decided when the thread starts and never grown. Two things blow it:
> ```rust,ignore
> let big = [0u8; 20_000_000];   // 20 MB array → instant stack overflow
>
> fn recurse(n: u64) -> u64 { 1 + recurse(n + 1) }   // no base case → overflow
> ```
> Both abort the process with `thread 'main' has overflowed its stack` — **not** a catchable panic, because the guard page is hit below the runtime's ability to unwind cleanly. The fixes are to box large data (`Box::new([0u8; 20_000_000])` puts it on the heap, where the limit is your RAM), or to convert deep recursion into a loop with an explicit `Vec` as the stack. This is the failure mode behind the deep-recursion warnings in [Recursion & Backtracking](#/ch/dsa-recursion) and the degenerate-tree crash in [Binary Trees](#/ch/dsa-trees).

### Watching the heap reallocate

Growing a `Vec` isn't one allocation — it's a series of them. Each time the buffer fills, `Vec` asks for a **bigger** one, **copies every existing element across**, and frees the old. You can watch it happen (the printed address may or may not change — the allocator sometimes manages to extend the block in place, which saves the copy):

```rust
fn main() {
    let mut v: Vec<u64> = Vec::new();
    let mut last_cap = v.capacity();
    let mut reallocations = 0;
    let mut elements_copied = 0usize;

    println!("{:>7} {:>9} {:>16}", "len", "capacity", "heap address");
    for i in 0..1_000u64 {
        v.push(i);
        if v.capacity() != last_cap {
            reallocations += 1;
            elements_copied += last_cap; // everything already there had to move
            println!("{:>7} {:>9} {:>16p}  ← reallocated", v.len(), v.capacity(), v.as_ptr());
            last_cap = v.capacity();
        }
    }

    println!("\n1,000 pushes caused {reallocations} reallocations");
    println!("and copied {elements_copied} elements that were already in place.");

    // Pre-sizing eliminates all of it:
    let mut sized: Vec<u64> = Vec::with_capacity(1_000);
    let start_ptr = sized.as_ptr();
    for i in 0..1_000u64 { sized.push(i); }
    println!("\nwith_capacity(1000): 0 reallocations, address unchanged: {}",
             std::ptr::eq(start_ptr, sized.as_ptr()));
}
```

Reaching 1,000 elements takes about **ten** reallocations (capacity roughly doubles: 4, 8, 16, … 1024) and copies close to 1,000 elements that were already sitting in place. `Vec::with_capacity(n)` does it in one allocation with zero copying.

> [!performance] Reserve when you know the size — but measure before micro-tuning
> The counting above is exact and reproducible. *Timing* it is another matter: in a debug build the per-push bounds checks dominate, and the two versions can even swap places run to run. Compile with `--release` and pre-sizing wins consistently but modestly for simple element types, because `Vec`'s doubling strategy already makes growth **amortised O(1)**.
>
> Where it genuinely matters is when elements are expensive to move (large structs), when you're in a hot loop, or when the copying churns your cache. The habit is still free to adopt — `Vec::with_capacity(n)` costs nothing when you know `n` — just don't expect it to transform a program that wasn't allocation-bound. That's the general lesson: reach for a profiler ([Optimization](#/ch/optimization)) before rewriting on a hunch.

## Sized and unsized types

The compiler needs to know how big each stack value is. Types whose size is known at compile time implement a special marker trait called **`Sized`** (automatically — you never write it). Almost everything is `Sized`.

A few types are **unsized** (also called *dynamically sized types*, or DSTs) — their size isn't known until runtime. The two you'll meet are `str` (a string of unknown length) and `[T]` (a slice of unknown length).

> [!note] Why you always see `&str`, never bare `str`
> You can't put an unsized `str` directly on the stack — the compiler wouldn't know how many bytes to reserve. So you always handle it *behind a pointer*: `&str`, `Box<str>`, etc. The pointer is a fixed size (a fat pointer carrying the length), even though the text it points to varies. Same story for `&[T]` versus `[T]`.

## Why this matters for performance

Understanding stack vs. heap lets you write fast Rust on purpose, not by accident:

> [!performance] Practical speed lessons
> - **Heap allocation isn't free.** Each `String::new()`, `Box::new()`, or `Vec` growth may ask the allocator for memory — cheap individually, but costly in a hot loop. Reuse buffers or pre-size with `Vec::with_capacity(n)` when you can.
> - **The stack is cache-friendly.** Data packed contiguously (arrays, `Vec` buffers) is dramatically faster to iterate than data scattered across the heap (like a linked list), because modern CPUs love predictable, sequential memory access.
> - **Prefer borrowing over cloning.** A `&T` is a tiny stack pointer; a `.clone()` of heap data does real allocation and copying. This is why "pass a reference" is the performance-conscious default.

> [!tip] You rarely choose manually
> Here's the beautiful part: in Rust you almost never say "put this on the heap" explicitly. You pick a *type* — `String`, `Vec`, `Box` — and it manages the heap for you, freeing everything automatically via ownership. You get manual-memory-management performance with none of the manual bookkeeping.

## Summary

- The **stack** is a fast, ordered region for fixed-size, short-lived values (function locals). Allocation is nearly free.
- The **heap** is a flexible pool for data whose size or lifetime varies; you get a **pointer** to it, and access is a bit slower.
- Types like `String`, `Vec`, and `Box` keep a small **handle on the stack** pointing to their data **on the heap** — which is exactly why moves are cheap and clones are not.
- **`Sized`** types have a compile-time-known size; **unsized** types (`str`, `[T]`) must be used behind a pointer like `&str` or `&[T]`.
- Knowing where data lives explains ownership's rules and guides you toward fast, cache-friendly code.

> [!exercise] Try it yourself
> 1. Run the `size_of` example. Why is `&str` bigger than `Box<i32>`? (Hint: fat pointer.)
> 2. Predict `size_of::<[u8; 10]>()` and `size_of::<Vec<u8>>()` before running. Explain the difference.
> 3. Explain in one sentence why moving a `String` is cheap but cloning it is not, using the words *stack*, *heap*, and *handle*.
> 4. Run the address example. How far apart are the stack addresses, and how far is the heap from them?
> 5. Print a `String`'s `.len()` and `.capacity()`, then push characters in a loop printing both each time. Watch capacity double.
> 6. Trigger a stack overflow with `let big = [0u8; 20_000_000];`, then fix it with `Box::new(...)` and confirm it runs.
> 7. Run the allocation benchmark. Roughly how many times does a `Vec` reallocate on its way to 200,000 elements, given it doubles each time?
> 8. Take the `text.as_ptr()` value before and after pushing enough characters to force a reallocation. Did the heap address change? What does that imply about holding a raw pointer into a `Vec`?

That completes the Ownership part — the conceptual heart of Rust. Now we'll use these ideas to build our own custom types, starting with **structs**.
