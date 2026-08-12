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

### Watch an address change under a move

That diagram is easy to accept and easy to under-appreciate, so here it is happening. We won't build an actual self-referential struct (dereferencing the stale pointer would be undefined behaviour); we'll just print where the data *lives* before and after a move, which is all the argument needs:

```rust
#[derive(Debug)]
#[allow(dead_code)] // `data` exists only to give the struct something to hold
struct Holder {
    data: String,
}

impl Holder {
    /// The address this value currently occupies.
    fn address(&self) -> usize {
        self as *const Holder as usize
    }
}

fn takes_ownership(h: Holder) -> Holder {
    println!("  inside the function : 0x{:x}", h.address());
    h // moved out again on return
}

fn main() {
    let h = Holder { data: String::from("hello") };
    println!("originally           : 0x{:x}", h.address());

    let h = takes_ownership(h);
    println!("after being returned : 0x{:x}", h.address());

    // Moving into a Vec relocates it again — and a Vec that grows
    // will relocate every element it holds, repeatedly.
    let mut v = Vec::with_capacity(1);
    v.push(h);
    println!("after push into Vec  : 0x{:x}", v[0].address());
    for i in 0..4 {
        v.push(Holder { data: format!("filler {i}") });
    }
    println!("after Vec reallocs   : 0x{:x}", v[0].address());

    println!("\nEvery one of those numbers is a different location.");
    println!("A pointer stored INSIDE the struct would still name the first one.");
}
```

Run it and you'll see three or four distinct addresses for what is, semantically, "the same value." Rust moves values constantly — returning them, pushing them into collections, reassigning them — and normally that's completely fine, because nothing records the old address. A self-referential struct is the one case that *does* record it, which is why it needs a special rule.

## `Pin`: a promise not to move

**`Pin<P>`** is a wrapper around a pointer `P` that makes one guarantee: *the value it points to will never move again*. Once a future is pinned, its address is stable, so its internal self-references stay valid. That's why `Future::poll` takes `self: Pin<&mut Self>` — the runtime pins the future in place before polling it, promising it won't be moved between polls.

> [!jargon] Pin
> **`Pin<&mut T>`** is "a mutable reference to a `T` that is guaranteed not to move." It doesn't *do* anything at runtime — it's a compile-time contract. `Pin` doesn't pin by magic; it simply *withholds* the ability to get a `&mut T` you could move out of (like `std::mem::swap`), so safe code can't relocate the value.

### What exactly does `&mut T` let you do that's dangerous?

The whole design turns on one observation: **`&mut T` is enough to move a value**. Not obvious until you see the three functions that do it:

```rust
use std::mem;

#[derive(Debug)]
struct Thing { id: u32 }

fn main() {
    let mut a = Thing { id: 1 };
    let mut b = Thing { id: 2 };

    // All three of these MOVE a value, given only &mut:
    mem::swap(&mut a, &mut b);                       // exchange them
    println!("after swap:    a={a:?} b={b:?}");

    let old = mem::replace(&mut a, Thing { id: 99 }); // move new in, old out
    println!("after replace: a={a:?}, got back {old:?}");

    let taken = mem::take(&mut b.id);                 // move out, leave Default
    println!("after take:    b={b:?}, took {taken}");
}
```

If you hold a `&mut Future`, you can `mem::swap` it with another future — relocating a value whose internal pointers assumed a fixed address. That's the hole. `Pin<&mut T>` closes it by simply **never handing out the `&mut T`** (unless `T: Unpin`, where moving is harmless anyway).

<figure class="diagram">
<svg viewBox="0 0 670 215" role="img" aria-label="Pin wraps a mutable pointer and permits shared reference access and safe method calls, but withholds the mutable reference that would allow mem swap, replace, or take. For Unpin types the mutable reference is handed out freely because moving is harmless.">
  <style>
    .pw-h { font: 700 11.5px var(--font-sans); }
    .pw-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .pw-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .pw-box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .pw-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .pw-no { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .pw-un { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
  </style>
  <rect x="12" y="24" width="150" height="54" rx="7" class="pw-box"/>
  <text x="24" y="44" class="pw-m">Pin&lt;&amp;mut T&gt;</text>
  <text x="24" y="60" class="pw-c">a pointer wrapper</text>
  <text x="24" y="73" class="pw-c">with one promise</text>
  <text x="200" y="18" class="pw-h" fill="var(--green)">✓ still allowed</text>
  <rect x="200" y="26" width="210" height="22" rx="4" class="pw-ok"/><text x="210" y="42" class="pw-m">&amp;*pinned  → &amp;T</text>
  <rect x="200" y="52" width="210" height="22" rx="4" class="pw-ok"/><text x="210" y="68" class="pw-m">.poll(cx), other &amp;self fns</text>
  <rect x="200" y="78" width="210" height="22" rx="4" class="pw-ok"/><text x="210" y="94" class="pw-m">read fields, call methods</text>
  <path d="M164 46 L198 40" stroke="var(--green)" stroke-width="1.5" marker-end="url(#pwa)"/>
  <text x="440" y="18" class="pw-h" fill="var(--red)">✗ withheld</text>
  <rect x="440" y="26" width="218" height="22" rx="4" class="pw-no"/><text x="450" y="42" class="pw-m">&amp;mut T  ← the dangerous one</text>
  <rect x="440" y="52" width="218" height="22" rx="4" class="pw-no"/><text x="450" y="68" class="pw-m">mem::swap / replace / take</text>
  <rect x="440" y="78" width="218" height="22" rx="4" class="pw-no"/><text x="450" y="94" class="pw-m">moving the value anywhere</text>
  <path d="M164 56 C 300 130, 380 60, 438 46" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="4 3" fill="none" marker-end="url(#pwb)"/>
  <rect x="12" y="126" width="646" height="34" rx="6" class="pw-un"/>
  <text x="24" y="140" class="pw-m">…unless T: Unpin — then Pin::get_mut() hands out &amp;mut T freely</text>
  <text x="24" y="154" class="pw-c">because a type with no internal self-references is harmless to move. That is ~every type except async-generated futures.</text>
  <text x="12" y="182" class="pw-c">Pin adds no runtime cost and generates no code. It is purely a restriction on which safe APIs you can reach,</text>
  <text x="12" y="198" class="pw-c">enforced by the type system — the same trick as <tspan font-family="var(--font-mono)">&amp;</tspan> vs <tspan font-family="var(--font-mono)">&amp;mut</tspan>, applied to "may this move?"</text>
  <defs>
    <marker id="pwa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="pwb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--red)"/></marker>
  </defs>
</svg>
<figcaption><code>Pin</code> permits everything except the one capability that enables a move: handing out <code>&amp;mut T</code>.</figcaption>
</figure>

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

### The three ways to pin

| Tool | Where the value lives | Cost | Use when |
|---|---|---|---|
| `Box::pin(v)` | heap, at a fixed address | one allocation | the default; needed to *return* or *store* a pinned future |
| `std::pin::pin!(v)` / `tokio::pin!(v)` | the current stack frame | free | you poll it in this scope and never move it out |
| `Pin::new(&mut v)` | wherever it already is | free | **only** for `T: Unpin` — no promise needed |

That last row is the one people misread. `Pin::new` doesn't pin anything difficult — it's a safe constructor available *only* when the type is `Unpin`, i.e. when the guarantee is trivially satisfiable:

```rust
use std::pin::Pin;

fn main() {
    // i32 is Unpin, so Pin::new is safe and free — no promise is actually needed.
    let mut n = 5;
    let pinned: Pin<&mut i32> = Pin::new(&mut n);
    println!("pinned value: {}", *pinned);

    // Because i32: Unpin, we can even get the &mut straight back out:
    let mut n2 = 10;
    let p2 = Pin::new(&mut n2);
    *p2.get_mut() += 1;      // allowed ONLY because i32: Unpin
    println!("mutated: {n2}");

    // For a !Unpin type (an async future), Pin::new is not available at all —
    // you'd need Box::pin or pin!, which is exactly the point.
}
```

## Where you'll actually meet `Pin`

The chapter so far is theory. In practice `Pin` shows up in a small number of recognisable situations — knowing them by sight is most of what you need:

**1. A recursive `async fn`** — the single most common `Pin` error in real code. An async function that awaits itself would need a future of infinite size, so the recursion must go through a pointer:

```rust
use std::future::Future;
use std::pin::Pin;

// ❌ `async fn countdown(n)` calling itself won't compile:
//    "recursion in an async fn requires boxing"
//
// ✅ Box::pin gives the recursive call a fixed-size, heap-allocated future:
fn countdown(n: u32) -> Pin<Box<dyn Future<Output = ()> + Send>> {
    Box::pin(async move {
        if n == 0 {
            println!("liftoff!");
            return;
        }
        println!("{n}…");
        countdown(n - 1).await;   // the recursive await, now through a Box
    })
}

#[tokio::main]
async fn main() {
    countdown(3).await;
}
```

**2. Storing a future in a struct** — a field of type `F: Future` can't be polled unless it's pinned, so the field is usually `Pin<Box<dyn Future<Output = T>>>`, or the struct uses [`pin-project`](#/ch/pinning) (below).

**3. Implementing `Future` or `Stream` by hand** — the `self: Pin<&mut Self>` receiver you saw in [Futures & the Poll Model](#/ch/futures). If your type is `Unpin` (most hand-written ones are, because they hold no self-references), you can immediately recover a normal `&mut self`:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

struct Countdown { remaining: u32 }

// Countdown holds only a u32 — no self-references — so it is automatically Unpin.
impl Future for Countdown {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<&'static str> {
        // Because Self: Unpin, `self` derefs to &mut Self and we can ignore Pin entirely.
        if self.remaining == 0 {
            Poll::Ready("done")
        } else {
            self.remaining -= 1;
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

fn main() {
    println!("{}", futures::executor::block_on(Countdown { remaining: 3 }));
}
```

**4. Selecting or racing futures in a loop** — `select!` and manual polling often need `tokio::pin!` on a future you want to poll across several iterations without moving it.

> [!note] Pin projection, and the crate that does it for you
> If your struct holds a future *and* other fields, polling it means turning `Pin<&mut MyStruct>` into `Pin<&mut TheFutureField>` — a **pin projection**. Doing that by hand requires `unsafe`, because you must promise you never move the pinned field. The [`pin-project`](https://docs.rs/pin-project) crate generates that code safely from a `#[pin_project]` attribute, and it's what essentially every library in this position uses. If you find yourself writing `unsafe { self.map_unchecked_mut(...) }`, reach for `pin-project` instead — hand-rolled projection is a classic source of subtle unsoundness.

## Summary

- An `async fn` becomes a **state-machine struct** that may be **self-referential** (a field pointing into another field), which breaks if the struct is **moved**.
- **`Pin<P>`** is a compile-time promise that the pointed-to value **won't move again** — that's why `Future::poll` takes `self: Pin<&mut Self>`, keeping self-references valid across polls.
- **`Unpin`** marks types that are safe to move even when pinned (almost everything); async-generated futures are the notable **`!Unpin`** exception.
- The danger is concrete: **`&mut T` is enough to move a value** via `mem::swap`/`replace`/`take`. `Pin<&mut T>` simply never hands out that `&mut T` — unless `T: Unpin`, where moving is harmless.
- Three ways to pin: **`Box::pin`** (heap, one allocation, the default), **`pin!`** (stack, free, same scope only), and **`Pin::new`** (free, but *only* for `Unpin` types).
- You **almost never touch `Pin` directly** — `.await`, `spawn`, and `#[tokio::main]` handle it. It surfaces in four places: **recursive `async fn`** (needs `Box::pin`), futures stored in structs, hand-written `Future`/`Stream` impls, and `select!` loops.
- If your hand-written future holds no self-references it's automatically **`Unpin`**, and you can ignore `Pin` inside `poll` entirely.
- **Pin projection** (reaching a pinned field) needs `unsafe` — use the **`pin-project`** crate rather than hand-rolling it.

> [!exercise] Try it yourself
> 1. `Box::pin` an `async { … }` block and `.await` it; confirm it works like any future.
> 2. Explain, in one sentence each, what `Pin` promises and what `Unpin` means (mind the double negative!).
> 3. Look up a `Future` impl in a crate's source (e.g. tokio's `Sleep`) and spot the `Pin<&mut Self>` in its `poll` — you now know why it's there.
> 4. Run the address example and count how many distinct addresses one value occupies. Add a `Vec` that grows several times and watch it move again.
> 5. Write a recursive `async fn` *without* `Box::pin` and read the compiler's error — it names the fix explicitly.
> 6. Call `Pin::new(&mut some_future)` on an `async` block. Why does it fail, and which of the three pinning tools works instead?
> 7. Take the `Countdown` future above and add a field holding a `String` plus a `&str` pointing into it. What changes about `Unpin`, and what does the compiler now demand?
> 8. Use `std::pin::pin!` to pin a future on the stack, then try to return it from the function. Explain the error in terms of where the value lives.

You understand async from syntax down to pinning. One practical question remains: tokio isn't the only runtime — how do you **choose** one, and do they interoperate?
