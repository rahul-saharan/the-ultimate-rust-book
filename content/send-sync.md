<h1><span class="h1-kicker">Fearless Concurrency</span>Send, Sync & Thread Safety</h1>

How does the compiler *know* that `Arc` is safe to share between threads but `Rc` isn't? How does it reject a data race before your program runs? The answer is two quiet marker traits — **`Send`** and **`Sync`** — that encode "thread safety" directly into the type system. You'll rarely implement them yourself, but understanding them turns Rust's concurrency errors from cryptic to obvious.

## The problem they solve: data races

Before the traits, the danger. A **data race** happens when two threads access the same memory at the same time, at least one of them writes, and there's no synchronization. The result isn't a crash you can debug — it's *silent corruption*: a torn value, a lost update, a freed pointer still in use.

Here's the concrete case Rust is protecting you from. `Rc<T>` keeps a reference count that it increments on clone and decrements on drop. That increment is not one instruction — it's read, add, write:

<figure class="diagram">
<svg viewBox="0 0 660 235" role="img" aria-label="Two threads both clone an Rc whose count is 1. Each reads 1, adds one, and writes 2. Two clones were made but the count says 2 instead of 3, so the value is freed while one clone is still alive.">
  <style>
    .dr-h { font: 700 12px var(--font-sans); }
    .dr-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .dr-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .dr-t1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .dr-t2 { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .dr-mem { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
    .dr-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.8; }
  </style>
  <text x="14" y="18" class="dr-h" fill="var(--text)">Two threads clone the same Rc. The count starts at 1.</text>
  <text x="14" y="42" class="dr-h" fill="var(--blue)">thread A</text>
  <rect x="14" y="52" width="150" height="24" rx="5" class="dr-t1"/><text x="24" y="68" class="dr-m">read count → 1</text>
  <rect x="14" y="82" width="150" height="24" rx="5" class="dr-t1"/><text x="24" y="98" class="dr-m">add 1 → 2</text>
  <rect x="14" y="112" width="150" height="24" rx="5" class="dr-t1"/><text x="24" y="128" class="dr-m">write 2</text>
  <text x="360" y="42" class="dr-h" fill="var(--amber)">thread B</text>
  <rect x="360" y="52" width="150" height="24" rx="5" class="dr-t2"/><text x="370" y="68" class="dr-m">read count → 1</text>
  <rect x="360" y="82" width="150" height="24" rx="5" class="dr-t2"/><text x="370" y="98" class="dr-m">add 1 → 2</text>
  <rect x="360" y="112" width="150" height="24" rx="5" class="dr-t2"/><text x="370" y="128" class="dr-m">write 2</text>
  <rect x="196" y="72" width="132" height="44" rx="6" class="dr-mem"/>
  <text x="208" y="90" class="dr-m">count in memory</text>
  <text x="208" y="108" class="dr-c">both read before either wrote</text>
  <rect x="14" y="152" width="496" height="30" rx="6" class="dr-bad"/>
  <text x="26" y="172" class="dr-m">2 clones made, but count = 2 instead of 3 — one decrement too few to survive</text>
  <text x="14" y="204" class="dr-c">When both clones drop, the count hits 0 while a third owner still holds the data → use-after-free.</text>
  <text x="14" y="222" class="dr-c">Nothing crashes at the moment of the race. The corruption surfaces later, somewhere else entirely.</text>
</svg>
<figcaption>The interleaving <code>Rc</code> can't survive: two non-atomic increments race, the count ends up too low, and the value is freed while still in use.</figcaption>
</figure>

`Arc` avoids this by making the increment a single **atomic** instruction that can't be interleaved. That's the entire difference between the two types — and `Send`/`Sync` are how the compiler makes sure you get the right one.

## Two traits that mean "thread-safe"

`Send` and `Sync` are **marker traits** — they have no methods; they simply *label* a type with a property the compiler checks:

> [!key] The definitions, in plain English
> - A type is **`Send`** if it's safe to **move it to another thread** (transfer ownership across a thread boundary).
> - A type is **`Sync`** if it's safe for **multiple threads to share a reference (`&T`) to it** at once.
>
> A precise, useful shortcut: **`T` is `Sync` if and only if `&T` is `Send`.** ("Sharing a reference across threads" = "sending a reference to another thread.")

That last line is the one worth pausing on, because it collapses two ideas into one. `Sync` isn't a separate concept bolted on — it's just `Send` applied to references:

<figure class="diagram">
<svg viewBox="0 0 660 210" role="img" aria-label="Send means the value itself moves across the thread boundary and the original thread loses access. Sync means the value stays put while references to it are handed to several threads at once.">
  <style>
    .ss-h { font: 700 12px var(--font-sans); }
    .ss-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .ss-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .ss-a { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .ss-b { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .ss-val { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
    .ss-line { stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style>
  <text x="14" y="18" class="ss-h" fill="var(--rust-600)">Send — the value MOVES across</text>
  <line x1="150" y1="26" x2="150" y2="118" class="ss-line"/>
  <text x="20" y="40" class="ss-c">thread A</text><text x="164" y="40" class="ss-c">thread B</text>
  <rect x="20" y="48" width="104" height="30" rx="6" class="ss-a"/><text x="32" y="68" class="ss-m">let v = …</text>
  <rect x="164" y="48" width="104" height="30" rx="6" class="ss-val"/><text x="176" y="68" class="ss-m">v lives here</text>
  <path d="M126 63 L162 63" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#ssa)"/>
  <text x="20" y="98" class="ss-c">A can no longer touch v —</text>
  <text x="20" y="112" class="ss-c">ownership transferred.</text>
  <text x="360" y="18" class="ss-h" fill="var(--blue)">Sync — the value STAYS, refs go out</text>
  <rect x="360" y="48" width="110" height="30" rx="6" class="ss-val"/><text x="372" y="68" class="ss-m">v stays put</text>
  <rect x="530" y="34" width="110" height="26" rx="6" class="ss-b"/><text x="542" y="52" class="ss-m">&amp;v in thread B</text>
  <rect x="530" y="68" width="110" height="26" rx="6" class="ss-b"/><text x="542" y="86" class="ss-m">&amp;v in thread C</text>
  <path d="M472 60 L528 47" stroke="var(--blue)" stroke-width="1.6" marker-end="url(#ssb)"/>
  <path d="M472 66 L528 79" stroke="var(--blue)" stroke-width="1.6" marker-end="url(#ssb)"/>
  <text x="360" y="98" class="ss-c">Several threads read it at once.</text>
  <text x="360" y="112" class="ss-c">This is why Sync ⟺ &amp;T is Send.</text>
  <text x="14" y="150" class="ss-c">Rule of thumb: ask "does this value need to be in two places at once?"</text>
  <text x="14" y="170" class="ss-c">Only one thread ever touches it → you need <tspan font-family="var(--font-mono)">Send</tspan>.  ·  Several read it simultaneously → you need <tspan font-family="var(--font-mono)">Sync</tspan> too.</text>
  <text x="14" y="194" class="ss-c">A type can be one without the other — the next section shows all four combinations.</text>
  <defs>
    <marker id="ssa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="ssb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--blue)"/></marker>
  </defs>
</svg>
<figcaption><b>Send</b> transfers ownership to one other thread; <b>Sync</b> lets many threads hold references simultaneously.</figcaption>
</figure>

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

The recursion has to stop somewhere, and it stops at a handful of **primitives the compiler special-cases**. Raw pointers (`*const T`, `*mut T`) are neither `Send` nor `Sync` — the compiler has no idea what they point to or who else has a copy, so it refuses to assume. Everything non-thread-safe in `std` ultimately gets its "no" from one of these roots: `Rc` contains a pointer to a non-atomic count, `RefCell` contains a `Cell` for its borrow flag, and the negativity propagates outward through every struct that holds one.

> [!tip] Check a type's status without running anything
> These two one-line helpers turn "is this thread-safe?" into a compile-time question. If the program builds, the answer is yes; if it doesn't, the error names the exact field or type responsible:
> ```rust
> fn assert_send<T: Send>() {}
> fn assert_sync<T: Sync>() {}
>
> #[allow(dead_code)] // the fields exist only to be type-checked
> struct Job { id: u32, name: String }
>
> fn main() {
>     assert_send::<Job>();
>     assert_sync::<Job>();
>     assert_send::<std::sync::Arc<Vec<u8>>>();
>     // assert_send::<std::rc::Rc<u8>>();  // ← uncomment: compile error, by design
>     println!("all assertions passed at compile time");
> }
> ```
> This is genuinely useful in real code: put `assert_send::<MyFuture>()` in a test and you'll catch the day someone adds an `Rc` field to a type that has to cross threads.

## All four combinations

Most types are `Send + Sync`, but the other three quadrants all exist and each teaches something:

<figure class="diagram">
<svg viewBox="0 0 660 250" role="img" aria-label="A two by two grid of Send versus Sync. Send and Sync: most types. Send but not Sync: Cell and RefCell. Not Send but Sync: MutexGuard. Neither: Rc and raw pointers.">
  <style>
    .q-h { font: 700 11.5px var(--font-sans); }
    .q-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .q-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .q-ax { font: 700 11px var(--font-sans); fill: var(--text-mute); }
    .q-both { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .q-send { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.5; }
    .q-sync { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .q-none { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <text x="150" y="16" class="q-ax">Sync  →</text>
  <text x="14" y="120" class="q-ax" transform="rotate(-90 14 120)">Send  →</text>
  <rect x="40" y="26" width="290" height="92" rx="8" class="q-both"/>
  <text x="54" y="46" class="q-h" fill="var(--green)">Send + Sync — the common case</text>
  <text x="54" y="66" class="q-m">i32, String, Vec&lt;T&gt;, Arc&lt;T&gt;, Mutex&lt;T&gt;</text>
  <text x="54" y="84" class="q-c">Move it, share it, do whatever you like.</text>
  <text x="54" y="102" class="q-c">Almost every type you write lands here.</text>
  <rect x="340" y="26" width="290" height="92" rx="8" class="q-send"/>
  <text x="354" y="46" class="q-h" fill="var(--amber)">Send, NOT Sync</text>
  <text x="354" y="66" class="q-m">Cell&lt;T&gt;, RefCell&lt;T&gt;</text>
  <text x="354" y="84" class="q-c">Fine to hand to one other thread outright,</text>
  <text x="354" y="102" class="q-c">unsafe for two to poke at simultaneously.</text>
  <rect x="40" y="126" width="290" height="92" rx="8" class="q-sync"/>
  <text x="54" y="146" class="q-h" fill="var(--blue)">Sync, NOT Send — rare</text>
  <text x="54" y="166" class="q-m">MutexGuard&lt;'_, T&gt;</text>
  <text x="54" y="184" class="q-c">Shareable by reference, but must be dropped</text>
  <text x="54" y="202" class="q-c">on the thread that locked it (OS requirement).</text>
  <rect x="340" y="126" width="290" height="92" rx="8" class="q-none"/>
  <text x="354" y="146" class="q-h" fill="var(--red)">Neither</text>
  <text x="354" y="166" class="q-m">Rc&lt;T&gt;, *const T, *mut T</text>
  <text x="354" y="184" class="q-c">Single-threaded only. The raw pointers are</text>
  <text x="354" y="202" class="q-c">the root every other "no" is derived from.</text>
  <text x="40" y="240" class="q-c">Each quadrant exists for a real reason — knowing which one a type is in tells you exactly how it may be used.</text>
</svg>
<figcaption>The four quadrants. <code>Send</code> without <code>Sync</code> is common; <code>Sync</code> without <code>Send</code> is rare but real.</figcaption>
</figure>

`Cell<T>` is the clearest teaching case for the top-right box. It allows mutation through a shared `&` reference, with **no locking at all** — that's its whole purpose, and it's perfectly safe on one thread. Hand the whole `Cell` to another thread and nothing breaks, because only one thread owns it (`Send` ✓). Let two threads hold `&Cell<i32>` and both call `.set()`, and you have an unsynchronized write race (`Sync` ✗).

## Where the bounds actually come from

The traits would be inert without something demanding them. That something is the signature of `thread::spawn`:

```rust,ignore
pub fn spawn<F, T>(f: F) -> JoinHandle<T>
where
    F: FnOnce() -> T + Send + 'static,   // ← the closure must be Send
    T: Send + 'static,                    // ← and so must its return value
```

Two requirements, both doing real work:

- **`F: Send`** — the closure is a struct holding everything it captured, so it's `Send` only if *every captured value* is. Capture an `Rc` and the closure stops being `Send`, and this bound rejects it. That's the entire mechanism behind the famous error below.
- **`'static`** — the closure can't borrow anything that might be dropped while the thread still runs. This is why `move` is so common with `spawn`: it forces captures to be owned rather than borrowed.

> [!key] Nothing about threads is built into the language here
> `thread::spawn` is an ordinary generic function in the standard library. Its safety comes entirely from those trait bounds — swap them out and the compiler would happily let you race. Every thread-safety guarantee in Rust traces back to `Send`/`Sync` bounds written on ordinary APIs, which is why *your* APIs get the same protection for free when you write `fn process<T: Send>(...)`.

## The famous example: `Rc` is not `Send`

This is where the traits become concrete. `Rc<T>` uses a **non-atomic** counter for speed — perfectly fine on one thread, but if two threads cloned/dropped the same `Rc` simultaneously, the counter could corrupt exactly as the first diagram showed. So `Rc` is deliberately **not `Send`**, and the compiler refuses to let it cross a thread boundary:

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

### Decoding the error message

These errors are long but formulaic, and they always name the culprit. Reading one is a three-step skill:

```text
error[E0277]: `Rc<i32>` cannot be sent between threads safely
   --> src/main.rs:7:19
    |
7   |       thread::spawn(move || {
    |       ------------- ^------
    |       |             |
    |  _____|_____________within this `{closure@src/main.rs:7:19}`
    | |     |
    | |     required by a bound introduced by this call
    |
    = help: within `{closure@…}`, the trait `Send` is not implemented for `Rc<i32>`
note: required because it's used within this closure
```

1. **The first line names the offending type** — `Rc<i32>`, not your struct. That's what to replace.
2. **"within this closure"** tells you it's a *captured* value, so look at what the closure body mentions, not at the spawn call itself.
3. **"the trait `Send` is not implemented"** tells you which of the two traits failed — `Send` means it's being moved, `Sync` means it's being shared by reference. That distinction points at the fix: `Send` failures usually want `Arc`; `Sync` failures usually want a `Mutex` *inside* the `Arc`.

When the type is deeply nested (a struct holding a struct holding an `Rc`), the compiler prints the whole chain — read from the bottom up to find the leaf that's actually at fault.

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

## How `Mutex` manufactures `Sync`

Here's the detail that makes the whole system click, and it's easy to miss. Look at the real bounds in `std`:

```rust,ignore
impl<T: ?Sized + Send> Send for Mutex<T> {}
impl<T: ?Sized + Send> Sync for Mutex<T> {}   // ← Sync requires only T: Send!
```

`Mutex<T>` is `Sync` when `T` is merely **`Send`** — `T` does *not* have to be `Sync`. That's not an oversight; it's the point of a lock. A mutex hands out access to exactly one thread at a time, so `T` is never actually touched by two threads simultaneously — it only ever gets *moved* between them, conceptually. Serialized access is precisely the guarantee that upgrades "safe to send" into "safe to share."

This is why `Mutex<RefCell<T>>` is pointless but `Mutex<T>` around a non-`Sync` type works:

```rust
use std::cell::Cell;
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // Cell<i32> is Send but NOT Sync — several threads can't share &Cell safely.
    // Wrapping it in a Mutex makes the whole thing Sync, because the lock
    // guarantees only one thread is inside at a time.
    let shared = Arc::new(Mutex::new(Cell::new(0)));

    let mut handles = Vec::new();
    for _ in 0..4 {
        let shared = Arc::clone(&shared);
        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                let guard = shared.lock().unwrap();
                guard.set(guard.get() + 1); // Cell mutation, now serialized
            }
        }));
    }
    for h in handles { h.join().unwrap(); }

    println!("final = {}", shared.lock().unwrap().get()); // always 4000
}
```

Contrast `RwLock<T>`, which *does* require `T: Send + Sync` to be `Sync` — because it hands out several `&T` at once to concurrent readers, so `T` really must tolerate genuine simultaneous sharing.

| Wrapper | Is `Sync` when… | Why |
|---|---|---|
| `Mutex<T>` | `T: Send` | one thread inside at a time — access is serialized |
| `RwLock<T>` | `T: Send + Sync` | many readers get `&T` *simultaneously* |
| `Arc<T>` | `T: Send + Sync` | shares `&T` widely, and may drop `T` on any thread |
| `Cell<T>`/`RefCell<T>` | never | mutation through `&` with no synchronization |

> [!deep] Why `Arc<T>` needs *both* from `T`
> `Arc<T>: Send + Sync` requires `T: Send + Sync`, which surprises people who expect it to mirror `Mutex`. Both halves are load-bearing. It needs **`T: Sync`** because `Arc` hands out `&T` to every clone-holder at once — that's shared reading with no lock. And it needs **`T: Send`** because the last `Arc` to be dropped destroys the `T`, and which thread that turns out to be is a race — so `T`'s destructor must be safe to run anywhere. Miss either one and you'd have a hole: `Arc<Cell<i32>>` would let two threads write the same cell, and `Arc<SomeThreadBoundThing>` could run a destructor on the wrong thread.

## The single-threaded / multi-threaded pairs

Rust gives you fast single-threaded tools *and* thread-safe counterparts, and `Send`/`Sync` are how it keeps them from being mixed up by accident:

| Single-threaded (not `Sync`) | Thread-safe (`Send + Sync`) | Purpose |
|------------------------------|------------------------------|---------|
| `Rc<T>` | `Arc<T>` | shared ownership |
| `RefCell<T>` / `Cell<T>` | `Mutex<T>` / `RwLock<T>` | interior mutability |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | shared *mutable* state |

Use the left column for speed when you're on one thread; the compiler forces you to the right column the moment data actually crosses threads.

> [!performance] The single-threaded versions are faster for a reason
> `Rc`'s counter is a plain `+= 1`; `Arc`'s is an atomic read-modify-write that must be coordinated across CPU cores, and on a contended counter that can cost tens of nanoseconds versus roughly one. Same story for `RefCell` (a flag check) versus `Mutex` (a potential syscall when contended). Don't reach for `Arc<Mutex<T>>` reflexively "in case we go multi-threaded later" — if the data never leaves one thread, you're paying for synchronization nobody uses. Let the compiler tell you when you need the upgrade; that's exactly what these traits are for.

## Borrowing across threads with scoped threads

The `'static` bound on `spawn` means a spawned thread can't borrow local data — which is why so much code clones into `Arc`. But when threads are guaranteed to finish before the borrow ends, you don't need any of that. `thread::scope` encodes that guarantee:

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3, 4, 5, 6];
    let mut results = vec![0; 2];

    thread::scope(|s| {
        // Split the output so each thread gets a disjoint &mut — no lock needed.
        let (first, second) = results.split_at_mut(1);
        s.spawn(|| {
            first[0] = data[..3].iter().sum::<i32>();   // borrows `data` directly!
        });
        s.spawn(|| {
            second[0] = data[3..].iter().sum::<i32>();
        });
    }); // scope() blocks here until both threads finish — the borrows are provably over

    println!("{results:?} total={}", results.iter().sum::<i32>());
}
```

Because `scope` cannot return until every thread it spawned has joined, the borrows can't outlive the data — so the `'static` requirement is lifted and plain `&`/`&mut` work. Note that `Sync` is still required for the shared `&data`; scoped threads relax the *lifetime* rule, not the thread-safety rules.

## Opting out, and opting in unsafely

Occasionally you need to *remove* an auto trait — usually because a type wraps a raw pointer or an OS handle that's only valid on one thread. The stable way is to include a zero-sized field that isn't `Send`/`Sync`:

```rust,ignore
use std::marker::PhantomData;
use std::rc::Rc;

/// Deliberately single-threaded: PhantomData<Rc<()>> is neither Send nor Sync,
/// and costs zero bytes at runtime.
struct ThreadBound {
    handle: *mut std::ffi::c_void,
    _not_send: PhantomData<Rc<()>>,
}
```

And occasionally you must add them by hand — when *you* can prove a safety property the compiler can't see:

```rust,ignore
/// SAFETY: the pointer is uniquely owned by this struct, never aliased, and the
/// pointee contains no thread-affine state, so moving it between threads is sound.
unsafe impl Send for MyBox {}
```

> [!warning] `unsafe impl Send`/`Sync` is a promise the compiler cannot check
> Writing these two lines silences every `Send`/`Sync` error involving your type — including the correct ones. You are asserting to the compiler that no data race is possible, and if you're wrong the result is undefined behavior that typically shows up as corruption under load, on someone else's machine, months later. Only reach for it when wrapping raw pointers or FFI handles in a genuinely low-level abstraction, always document *why* it's sound in a `// SAFETY:` comment, and test it under [Miri](#/ch/unsafe) (`cargo +nightly miri test`), which can catch many races that ordinary tests miss.

> [!deep] You almost never implement these by hand
> Because they're auto traits, correct code gets `Send`/`Sync` for free. The only time you manually `unsafe impl Send`/`Sync` is when writing low-level abstractions (like your own `Arc`-style primitive) around raw pointers, where *you* must guarantee the safety the compiler can't verify. If you're not writing `unsafe` code with raw pointers, you'll likely never touch these impls — you'll just read the occasional error and swap `Rc` for `Arc`.

## The async gotcha you *will* hit

One `Send` error is common enough to call out by name. Multi-threaded runtimes like [tokio](#/ch/tokio) can move a task between worker threads at any `.await`, so `tokio::spawn` requires the whole future to be `Send`. A future holds everything alive across an `.await` point — including guards:

```rust,ignore
// ❌ MutexGuard is not Send, so this future isn't Send, so tokio::spawn rejects it.
let guard = data.lock().unwrap();
some_async_call().await;          // guard is still alive here
println!("{}", *guard);

// ✅ Drop the guard before awaiting: copy out what you need first.
let value = { *data.lock().unwrap() };   // guard dropped at the closing brace
some_async_call().await;
println!("{value}");
```

The error says "future cannot be sent between threads safely" and points at the `.await`. The fix is nearly always to shrink the guard's scope so it doesn't straddle the await — or to use tokio's own `tokio::sync::Mutex`, whose guard *is* `Send` (at the cost of being slower). This is the same `Send` machinery you've been reading about, applied to a compiler-generated future type instead of a struct you wrote.

## Summary

- **`Send`** = safe to **move** a value to another thread; **`Sync`** = safe to **share `&T`** across threads (equivalently, `&T` is `Send`).
- They exist to prevent **data races** — like two threads racing `Rc`'s non-atomic refcount into a use-after-free.
- They're **marker/auto traits**: the compiler implements them automatically for types whose parts qualify. The recursion bottoms out at **raw pointers**, which are neither.
- All **four quadrants** are real: `Send + Sync` (most types), `Send` only (`Cell`, `RefCell`), `Sync` only (`MutexGuard`), neither (`Rc`, raw pointers).
- The bounds do their work through ordinary APIs — **`thread::spawn` requires `F: Send + 'static`**, and that single line is what rejects a captured `Rc`.
- **`Mutex<T>` is `Sync` when `T: Send`** — serialized access upgrades "sendable" to "shareable". `RwLock` and `Arc` need `T: Send + Sync` because they share `&T` concurrently.
- **`thread::scope`** lifts the `'static` requirement so threads can borrow locals, because it can't return until they finish.
- Opt out with a `PhantomData<Rc<()>>` field; opt in with `unsafe impl`, which is an **unverifiable promise** — document and Miri-test it.
- In async, a **`MutexGuard` held across `.await`** makes the future non-`Send`; shrink the guard's scope.
- A `Send`/`Sync` compile error (`E0277`) *is* Rust catching a data race before runtime — the essence of fearless concurrency.

> [!exercise] Try it yourself
> 1. Try to move an `Rc<i32>` into `thread::spawn` and read the error; then fix it by switching to `Arc`.
> 2. Explain in one sentence why `Mutex<T>` is `Sync` but `RefCell<T>` is not.
> 3. Predict whether a `struct Job { id: u32, name: String }` is `Send + Sync`, and why. Verify with `assert_send::<Job>()`.
> 4. Add an `Rc<String>` field to `Job`, then use the `assert_send` helper to see which field the compiler blames.
> 5. Write `assert_sync::<Cell<i32>>()` and read the error. Then wrap it — `assert_sync::<Mutex<Cell<i32>>>()` — and explain why the second one compiles.
> 6. Rewrite the scoped-threads example using `Arc<Mutex<Vec<i32>>>` and `thread::spawn` instead. Which version is shorter, and which does more work at runtime?
> 7. Build a struct holding a `*mut u8` and confirm it isn't `Send`. Add `unsafe impl Send` with a `// SAFETY:` comment justifying it — then argue the opposite case, that it's *not* actually sound.
> 8. In an async function, lock a `std::sync::Mutex` and `.await` while holding the guard. Read the "future cannot be sent between threads" error, then fix it two ways: by scoping the guard, and by switching to `tokio::sync::Mutex`.

For the simplest shared counters and flags, taking a lock is overkill. The lowest-level, lock-free tool is the **atomic** — next.
