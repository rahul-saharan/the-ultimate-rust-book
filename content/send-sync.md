<h1><span class="h1-kicker">Fearless Concurrency</span>Send, Sync & Thread Safety</h1>

How does the compiler *know* that `Arc` is safe to share between threads but `Rc` isn't? How does it reject a data race before your program runs? The answer is two quiet marker traits — **`Send`** and **`Sync`** — that encode "thread safety" directly into the type system. You'll rarely implement them yourself, but understanding them turns Rust's concurrency errors from cryptic to obvious.

## Two traits that mean "thread-safe"

`Send` and `Sync` are **marker traits** — they have no methods; they simply *label* a type with a property the compiler checks:

> [!key] The definitions, in plain English
> - A type is **`Send`** if it's safe to **move it to another thread** (transfer ownership across a thread boundary).
> - A type is **`Sync`** if it's safe for **multiple threads to share a reference (`&T`) to it** at once.
>
> A precise, useful shortcut: **`T` is `Sync` if and only if `&T` is `Send`.** ("Sharing a reference across threads" = "sending a reference to another thread.")

Almost every ordinary type is both. Numbers, `String`, `Vec<T>`, your structs of ordinary fields — all `Send + Sync`. You mostly notice these traits only when a type *isn't* one of them.

```rust
fn main() {
    // These types are Send + Sync, so they cross thread boundaries freely:
    let n: i32 = 42;
    let s: String = "hello".into();
    let v: Vec<i32> = vec![1, 2, 3];
    std::thread::spawn(move || {
        println!("{n} {s} {v:?}"); // all fine — moved into the thread
    }).join().unwrap();
}
```

## Auto traits: derived automatically

`Send` and `Sync` are **auto traits**: the compiler implements them *automatically* for any type whose parts are all `Send`/`Sync`. A struct is `Send` if every field is `Send`; `Sync` if every field is `Sync`. You get thread-safety analysis for free, composed from the ground up — you never write `impl Send`.

```rust
// This struct is automatically Send + Sync, because all its fields are:
struct Config {
    name: String,   // Send + Sync
    retries: u32,   // Send + Sync
    tags: Vec<String>, // Send + Sync
}
# fn main() { let c = Config { name: "x".into(), retries: 3, tags: vec![] }; let _ = (c.name, c.retries, c.tags); }
```

## The famous example: `Rc` is not `Send`

This is where the traits become concrete. `Rc<T>` uses a **non-atomic** counter for speed — perfectly fine on one thread, but if two threads cloned/dropped the same `Rc` simultaneously, the counter could corrupt, causing a double-free. So `Rc` is deliberately **not `Send`**, and the compiler refuses to let it cross a thread boundary:

```rust,ignore
use std::rc::Rc;
use std::thread;

fn main() {
    let data = Rc::new(5);
    let clone = Rc::clone(&data);
    thread::spawn(move || {
        println!("{clone}"); // ❌ error: `Rc<i32>` cannot be sent between threads safely
    });
}
// error[E0277]: `Rc<i32>` cannot be sent between threads safely
```

The fix, as you know, is `Arc` — which uses an **atomic** counter and therefore *is* `Send + Sync`:

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(5);
    let clone = Arc::clone(&data);
    thread::spawn(move || {
        println!("{clone}"); // ✅ Arc is Send + Sync
    }).join().unwrap();
}
```

> [!key] The error *is* the safety guarantee
> That `E0277` isn't the compiler being fussy — it's Rust catching a genuine data race at compile time. The `Send`/`Sync` bounds on `thread::spawn` (`F: Send`, and captured data must be `Send`) are exactly what make concurrency *fearless*: unsafe sharing doesn't compile, so it can never reach production.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A table showing which common types are Send and Sync">
  <style>
    .syh { font: 700 12px var(--font-sans); }
    .sym { font: 600 12px var(--font-mono); fill: var(--text); }
    .syc { font: 11px var(--font-sans); }
    .yes { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .no { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="syh" fill="var(--text)">Which types can cross threads?</text>
  <rect x="20" y="36" width="180" height="30" class="yes"/><text x="34" y="56" class="sym">i32, String, Vec&lt;T&gt;</text>
  <text x="210" y="56" class="syc" fill="var(--green)">✅ Send + Sync</text>
  <rect x="20" y="70" width="180" height="30" class="yes"/><text x="34" y="90" class="sym">Arc&lt;T&gt;, Mutex&lt;T&gt;</text>
  <text x="210" y="90" class="syc" fill="var(--green)">✅ Send + Sync (T thread-safe)</text>
  <rect x="20" y="104" width="180" height="30" class="no"/><text x="34" y="124" class="sym">Rc&lt;T&gt;, RefCell&lt;T&gt;</text>
  <text x="210" y="124" class="syc" fill="var(--red)">❌ single-threaded only</text>
  <text x="20" y="152" class="syc" fill="var(--text-mute)">The compiler checks these automatically — you almost never think about it until an error points it out.</text>
</svg>
<figcaption>Thread-crossing types are <code>Send</code>/<code>Sync</code>; single-threaded helpers like <code>Rc</code> and <code>RefCell</code> are not — and the compiler enforces it.</figcaption>
</figure>

## The single-threaded / multi-threaded pairs

Rust gives you fast single-threaded tools *and* thread-safe counterparts, and `Send`/`Sync` are how it keeps them from being mixed up by accident:

| Single-threaded (not `Sync`) | Thread-safe (`Send + Sync`) | Purpose |
|------------------------------|------------------------------|---------|
| `Rc<T>` | `Arc<T>` | shared ownership |
| `RefCell<T>` / `Cell<T>` | `Mutex<T>` / `RwLock<T>` | interior mutability |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | shared *mutable* state |

Use the left column for speed when you're on one thread; the compiler forces you to the right column the moment data actually crosses threads.

> [!deep] You almost never implement these by hand
> Because they're auto traits, correct code gets `Send`/`Sync` for free. The only time you manually `unsafe impl Send`/`Sync` is when writing low-level abstractions (like your own `Arc`-style primitive) around raw pointers, where *you* must guarantee the safety the compiler can't verify. If you're not writing `unsafe` code with raw pointers, you'll likely never touch these impls — you'll just read the occasional error and swap `Rc` for `Arc`.

## Summary

- **`Send`** = safe to **move** a value to another thread; **`Sync`** = safe to **share `&T`** across threads (equivalently, `&T` is `Send`).
- They're **marker/auto traits**: the compiler implements them automatically for types whose parts qualify — you get thread-safety analysis for free.
- **`Rc`/`RefCell` are not thread-safe** (not `Send`/`Sync`); their atomic/locking counterparts **`Arc`/`Mutex`/`RwLock` are** — the compiler stops you from using the wrong one across threads.
- A `Send`/`Sync` compile error (`E0277`) *is* Rust catching a data race before runtime — the essence of fearless concurrency.
- You almost never implement `Send`/`Sync` yourself (only in `unsafe` low-level code).

> [!exercise] Try it yourself
> 1. Try to move an `Rc<i32>` into `thread::spawn` and read the error; then fix it by switching to `Arc`.
> 2. Explain in one sentence why `Mutex<T>` is `Sync` but `RefCell<T>` is not.
> 3. Predict whether a `struct Job { id: u32, name: String }` is `Send + Sync`, and why.

For the simplest shared counters and flags, taking a lock is overkill. The lowest-level, lock-free tool is the **atomic** — next.
