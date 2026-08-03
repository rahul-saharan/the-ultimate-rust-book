<h1><span class="h1-kicker">Asynchronous Rust</span>Pin, Unpin & Self-Referential Futures</h1>

`Pin` has a fearsome reputation — those `Pin<&mut Self>` signatures in every `poll` method look cryptic. But the *idea* behind pinning is simple once you see the problem it solves. This chapter explains **why** async needs pinning (self-referential state machines), what `Pin` and `Unpin` actually promise, and — reassuringly — why you'll almost never have to think about it in everyday async code.

## The problem: self-referential futures

Recall that an `async fn` compiles to a [state machine struct](#/ch/futures). Consider async code that borrows one local variable into another:

```rust,ignore
async fn example() {
    let data = String::from("hello");
    let reference = &data;        // a reference INTO `data`
    some_async_call().await;      // pause here…
    println!("{reference}");       // …resume and use the reference
}
```

To pause at `.await` and resume later, the generated state machine must store **both** `data` *and* `reference` as fields. But `reference` points *into* `data` — the struct contains a pointer to one of its own fields. That's a **self-referential struct**.

> [!key] Why self-reference is dangerous
> A pointer holds a memory *address*. If the struct is ever **moved** (copied to a new location — which Rust does freely, on every assignment or `Vec` reallocation), the data shifts to a new address, but the internal pointer still points at the *old* address — now garbage. Using it would be a use-after-free. So a self-referential struct **must not move** once its internal pointer is set.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="Moving a self-referential struct leaves its internal pointer dangling at the old address">
  <style>
    .pm { font: 600 11px var(--font-mono); fill: var(--text); }
    .pc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="pc" fill="var(--green)">Before move — pointer valid:</text>
  <rect x="20" y="32" width="90" height="26" class="ok"/><text x="30" y="50" class="pm">data "hi"</text>
  <rect x="120" y="32" width="90" height="26" class="ok"/><text x="130" y="50" class="pm">ref ●</text>
  <path d="M165 32 C 165 14, 65 14, 65 30" stroke="var(--green)" stroke-width="1.5" fill="none" marker-end="url(#ap)"/>
  <text x="20" y="98" class="pc" fill="var(--red)">After move to a new address — pointer dangles:</text>
  <rect x="360" y="108" width="90" height="26" class="bad"/><text x="370" y="126" class="pm">data "hi"</text>
  <rect x="460" y="108" width="90" height="26" class="bad"/><text x="470" y="126" class="pm">ref ●</text>
  <path d="M505 108 C 505 150, 120 150, 65 108" stroke="var(--red)" stroke-width="1.5" fill="none" stroke-dasharray="4 3" marker-end="url(#ap2)"/>
  <rect x="20" y="108" width="90" height="26" fill="none" stroke="var(--border-strong)" stroke-dasharray="3 3"/><text x="26" y="126" class="pc">(old spot)</text>
  <text x="120" y="126" class="pc">ref still points HERE → 💥</text>
  <defs>
    <marker id="ap" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="ap2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--red)"/></marker>
  </defs>
</svg>
<figcaption>Moving a self-referential struct breaks its internal pointer — which is exactly what <code>Pin</code> prevents.</figcaption>
</figure>

## `Pin`: a promise not to move

**`Pin<P>`** is a wrapper around a pointer `P` that makes one guarantee: *the value it points to will never move again*. Once a future is pinned, its address is stable, so its internal self-references stay valid. That's why `Future::poll` takes `self: Pin<&mut Self>` — the runtime pins the future in place before polling it, promising it won't be moved between polls.

> [!jargon] Pin
> **`Pin<&mut T>`** is "a mutable reference to a `T` that is guaranteed not to move." It doesn't *do* anything at runtime — it's a compile-time contract. `Pin` doesn't pin by magic; it simply *withholds* the ability to get a `&mut T` you could move out of (like `std::mem::swap`), so safe code can't relocate the value.

## `Unpin`: "actually, I'm fine to move"

Most types *don't* contain self-references and are perfectly safe to move even when pinned. Rust marks these with the auto trait **`Unpin`** (note: `Unpin` means "*not* affected by pinning" — safe to move — which is the opposite of what the name suggests). Nearly every ordinary type is `Unpin`: numbers, `String`, `Vec`, your structs. For them, `Pin` is a no-op you can freely bypass.

The only common types that are **not** `Unpin` are the compiler-generated futures from `async` blocks — precisely because they might be self-referential.

> [!note] The confusing name, decoded
> - **`Unpin`** = "moving me is safe even when pinned" → true for almost everything.
> - **not `Unpin`** (i.e. `!Unpin`) = "I might be self-referential; do NOT move me after pinning" → async-generated futures.
>
> Read `T: Unpin` as "`T` doesn't care about pinning." The double negative is unfortunate, but that's the meaning.

## Why you rarely deal with `Pin` directly

Here's the reassuring part:

> [!key] The runtime and `.await` handle pinning for you
> When you write ordinary async code — `async fn`, `.await`, `tokio::spawn` — **you never touch `Pin` yourself**. The `.await` operator, the `#[tokio::main]` macro, and `spawn` all pin futures behind the scenes. `Pin` only surfaces when you *manually implement* `Future` for a self-referential type, or store a future in a struct field. For the 99% of async code that just uses `async`/`await`, pinning is invisible plumbing.

When you *do* need to pin something (e.g. hold a future in a variable to poll in a loop), the tools are simple:

```rust
#[tokio::main]
async fn main() {
    // Box::pin heap-allocates and pins a future — the easy, always-works option:
    let fut = Box::pin(async { 21 * 2 });
    println!("{}", fut.await); // 42

    // For stack pinning, tokio::pin! (or std::pin::pin!) pins in place:
    let f = async { "pinned on the stack" };
    tokio::pin!(f);
    println!("{}", f.await);
}
```

> [!best] Don't fear `Pin` — reach for `Box::pin` when you must
> If you hit a "cannot be unpinned" or "must be pinned" error, the pragmatic fix is almost always **`Box::pin(future)`**: it puts the future on the heap (a fixed address) and gives you a pinned pointer that just works. It costs one allocation — negligible unless you're in a hot loop. Only hand-roll stack pinning (`pin!`) or manual `Pin` projection when you're writing a low-level `Future` and performance demands it. Everyday async never requires this.

## Summary

- An `async fn` becomes a **state-machine struct** that may be **self-referential** (a field pointing into another field), which breaks if the struct is **moved**.
- **`Pin<P>`** is a compile-time promise that the pointed-to value **won't move again** — that's why `Future::poll` takes `self: Pin<&mut Self>`, keeping self-references valid across polls.
- **`Unpin`** marks types that are safe to move even when pinned (almost everything); async-generated futures are the notable **`!Unpin`** exception.
- You **almost never touch `Pin` directly** — `.await`, `spawn`, and `#[tokio::main]` handle it. It surfaces only when manually implementing `Future` or storing futures.
- When you must pin, reach for **`Box::pin`** (easy, one allocation) or `pin!` for stack pinning.

> [!exercise] Try it yourself
> 1. `Box::pin` an `async { … }` block and `.await` it; confirm it works like any future.
> 2. Explain, in one sentence each, what `Pin` promises and what `Unpin` means (mind the double negative!).
> 3. Look up a `Future` impl in a crate's source (e.g. tokio's `Sleep`) and spot the `Pin<&mut Self>` in its `poll` — you now know why it's there.

You understand async from syntax down to pinning. One practical question remains: tokio isn't the only runtime — how do you **choose** one, and do they interoperate?
