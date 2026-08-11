<h1><span class="h1-kicker">Smart Pointers</span>Building Your Own Smart Pointer</h1>

You've used five smart pointers. Now build one. This short chapter answers two questions: *why does this family of types exist at all?* — and *what exactly do I write to make my own?*

## Why we need smart pointers

A plain reference (`&T`) is a borrow the compiler proves safe at compile time. That covers most code — but it can't express three things:

| The gap | Why `&T` can't do it | The answer |
|---|---|---|
| The size isn't known when compiling | a stack value needs a fixed size | `Box<T>` |
| Ownership must be **shared** | a borrow owns nothing; someone must free it | `Rc<T>` / `Arc<T>` |
| A resource needs **releasing**, not just forgetting | dropping a reference does nothing | any type with `Drop` |

That third row is the reason to write your own. A file, a lock, a connection, a pooled buffer — each must be *actively released*, and any `open()`/`close()` API invites the bug where `close()` is skipped on an early return.

## What makes a pointer "smart"

Three parts, no more:

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="A smart pointer has three parts: a struct owning the resource, a Deref impl providing transparent access, and a Drop impl performing release">
  <style>
    .sp-h { font: 700 12px var(--font-sans); }
    .sp-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .sp-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .sp-1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.6; }
    .sp-2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.6; }
    .sp-3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <rect x="20" y="28" width="180" height="66" rx="5" class="sp-1"/>
  <text x="32" y="48" class="sp-h" fill="var(--blue)">1 · the struct</text>
  <text x="32" y="66" class="sp-m">struct Guard&lt;T&gt; { … }</text>
  <text x="32" y="84" class="sp-c">owns the resource</text>
  <rect x="228" y="28" width="180" height="66" rx="5" class="sp-2"/>
  <text x="240" y="48" class="sp-h" fill="var(--rust-600)">2 · Deref</text>
  <text x="240" y="66" class="sp-m">deref(&amp;self) -&gt; &amp;T</text>
  <text x="240" y="84" class="sp-c">makes it act like the T</text>
  <rect x="436" y="28" width="184" height="66" rx="5" class="sp-3"/>
  <text x="448" y="48" class="sp-h" fill="var(--green)">3 · Drop</text>
  <text x="448" y="66" class="sp-m">drop(&amp;mut self)</text>
  <text x="448" y="84" class="sp-c">releases it, always</text>
  <text x="20" y="126" class="sp-c">Together: callers use it as if it <tspan font-style="italic">were</tspan> the value, and cleanup happens on every exit path —</text>
  <text x="20" y="142" class="sp-c">normal return, early <tspan font-family="var(--font-mono)">return</tspan>, <tspan font-family="var(--font-mono)">?</tspan>, <tspan font-family="var(--font-mono)">break</tspan>, or a panic. There is no path that skips it.</text>
  <text x="20" y="172" class="sp-h">Every std smart pointer is exactly this</text>
  <text x="20" y="190" class="sp-c">Box frees an allocation · Rc decrements a count · MutexGuard unlocks · File closes a descriptor.</text>
</svg>
<figcaption>A struct that <b>owns</b>, a <code>Deref</code> that gives <b>transparent access</b>, and a <code>Drop</code> that <b>guarantees release</b>.</figcaption>
</figure>

## Build one: a pooled buffer

Allocating a fresh `String` per request is wasteful, so we keep a pool of them. The interesting part is the *return*: users must not have to remember it.

```rust
use std::cell::RefCell;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

type Pool = Rc<RefCell<Vec<String>>>;

/// Owns a buffer borrowed from a pool, and gives it back automatically.
struct Pooled {
    buffer: Option<String>, // Option so `drop` can move the value out
    pool: Pool,
}

impl Pooled {
    fn take(pool: &Pool) -> Option<Pooled> {
        let buffer = pool.borrow_mut().pop()?; // None if the pool is empty
        Some(Pooled { buffer: Some(buffer), pool: Rc::clone(pool) })
    }
}

// 2 — Deref: callers treat a Pooled as if it were the String.
impl Deref for Pooled {
    type Target = String;
    fn deref(&self) -> &String {
        self.buffer.as_ref().expect("present until drop")
    }
}

impl DerefMut for Pooled {
    fn deref_mut(&mut self) -> &mut String {
        self.buffer.as_mut().expect("present until drop")
    }
}

// 3 — Drop: the buffer goes back to the pool, clean, no matter how we exit.
impl Drop for Pooled {
    fn drop(&mut self) {
        if let Some(mut buf) = self.buffer.take() {
            buf.clear();
            self.pool.borrow_mut().push(buf);
        }
    }
}

fn main() {
    let pool: Pool = Rc::new(RefCell::new(vec![String::from("A"), String::from("B")]));
    println!("idle buffers: {}", pool.borrow().len());
    {
        let mut buf = Pooled::take(&pool).expect("pool not empty");
        buf.push_str("hello");                       // DerefMut — a String method
        println!("using {:?} (len {})", *buf, buf.len()); // Deref
        println!("idle while checked out: {}", pool.borrow().len());
    } // Drop runs here — the buffer is returned
    println!("idle after drop: {}", pool.borrow().len());
    println!("returned clean: {:?}", pool.borrow().last());
}
```

Notice what the caller never writes: no `pool.give_back(buf)`, and no cleanup in an error path. `Pooled` behaves like a `String` and returns itself.

> [!key] The `Option` field is the standard trick
> `Drop::drop` takes `&mut self`, so it can only *borrow* — yet we need to **move** the buffer back into the pool. Wrapping the field in `Option` and calling `.take()` swaps in `None` and hands us ownership. (`std::mem::take` works too when the type implements `Default`.) Almost every non-trivial `Drop` impl uses one of these two moves.

> [!warning] Don't reach for `Deref` unless your type really is a pointer
> `Deref` is for types that *stand in for* something else. Implementing it just to inherit an inner type's methods makes your type silently interchangeable with its contents and produces errors mentioning methods you never wrote — see [Anti-Patterns](#/ch/anti-patterns). If you only need a couple of methods forwarded, write those methods.

> [!best] Prefer a guard over a `close()` method
> Any API documented as "remember to call `finish()`" is a bug waiting to happen. Return a guard instead and let `Drop` do it. The one caveat: `Drop` can't report failure, so when release *can* fail meaningfully, also offer `fn close(self) -> Result<()>` and treat `Drop` as the fallback — exactly what `BufWriter` does.

## Summary

- Smart pointers fill three gaps a plain `&T` can't: **unknown size**, **shared ownership**, and **resources needing release**.
- Your own needs three pieces: a **struct that owns** the resource, a **`Deref`** (plus `DerefMut`) for transparent access, and a **`Drop`** that releases it.
- `Drop` runs on **every** exit path — early return, `?`, `break`, panic — which is what makes forgetting impossible.
- Use an **`Option` field** (or `mem::take`) to move a value out inside `drop`.
- Implement `Deref` only for genuine pointer-like types; pair `Drop` with an explicit `close()` when release can fail.

> [!exercise] Try it yourself
> 1. Add a `Pooled::leak(self)` that keeps the buffer instead of returning it. What do you need to do to stop `Drop` from running? (Hint: `ManuallyDrop` or `self.buffer.take()`.)
> 2. Make `Pooled::take` grow the pool instead of returning `None` when empty.
> 3. Write a `Timer` guard that records `Instant::now()` on creation and prints the elapsed time on drop. Confirm it fires on an early `return`.
> 4. Remove the `Option` from `buffer` and try to move it out in `drop`. Read the error, and explain why `&mut self` causes it.

That's the whole family — from `Box` to your own guards. Next we step back and ask *how should I shape this code?*, with Rust's **idioms and design patterns**.
