<h1><span class="h1-kicker">The Crate Ecosystem</span>OnceLock, LazyLock & Global State</h1>

Every program eventually needs a value that's computed once and then read everywhere: a compiled regex, a configuration struct, a lookup table, a database pool. In most languages you'd reach for a mutable global and not think about it. Rust makes you think about it — because a mutable global is a data race waiting for a second thread.

The good news is that the answer is now in the standard library, it's safe, and it's about as ergonomic as the crates that used to be required.

## The problem with `static mut`

```rust,ignore
// This is the shape everyone tries first, and it's genuinely dangerous.
static mut COUNTER: u32 = 0;

fn increment() {
    unsafe {
        COUNTER += 1; // read, add, write — three steps, no synchronization
    }
}
// Two threads doing this simultaneously lose updates, and it is
// undefined behaviour, not merely a wrong number.
```

As of **edition 2024** taking a reference to a `static mut` is a hard error, and the `static_mut_refs` lint warns before that. There is no situation in application code where `static mut` is the right answer.

| You want | Use |
|---|---|
| a compile-time constant | `const` |
| a compile-time constant with an address | `static` |
| a value initialized **once**, lazily, when first read | **`LazyLock`** |
| a value initialized **once**, at a moment you choose | **`OnceLock`** |
| a global counter | `static ATOMIC: AtomicU64` |
| global mutable structured data | `static X: Mutex<T>` or `LazyLock<Mutex<T>>` |
| read-heavy global mutable data | `LazyLock<RwLock<T>>` |
| per-thread mutable state | `thread_local!` |
| single-threaded, interior mutability | `Cell` / `RefCell` / `OnceCell` |

## `LazyLock`: initialize on first use

Stabilized in **Rust 1.80**. You give it a closure; it runs exactly once, on the first access, and every later access is a plain read.

```rust
use std::collections::HashMap;
use std::sync::LazyLock;

// The closure runs once, on first access, thread-safely. If two threads
// race to be first, one wins and the other waits for the result.
static COUNTRY_CODES: LazyLock<HashMap<&'static str, u32>> = LazyLock::new(|| {
    println!("  (building the table — you'll see this exactly once)");
    HashMap::from([("gb", 44), ("us", 1), ("jp", 81), ("br", 55)])
});

// Any expensive one-off computation is a good fit — a compiled regex,
// a parsed schema, or here just a derived string.
static DIAL_PREFIXES: LazyLock<String> = LazyLock::new(|| {
    let mut codes: Vec<u32> = COUNTRY_CODES.values().copied().collect();
    codes.sort_unstable();
    codes.iter().map(|c| format!("+{c}")).collect::<Vec<_>>().join(" ")
});

fn main() {
    println!("before any access");

    // Deref gives you &T, so it acts like the value itself.
    println!("gb  -> {:?}", COUNTRY_CODES.get("gb"));
    println!("jp  -> {:?}", COUNTRY_CODES.get("jp"));
    println!("len -> {}", COUNTRY_CODES.len());

    // One LazyLock can safely depend on another.
    println!("prefixes: {}", *DIAL_PREFIXES);

    // force() initializes eagerly without reading a field — useful at startup
    // to move the cost off the first request.
    println!("forced len = {}", LazyLock::force(&COUNTRY_CODES).len());
}
```

> [!key] `LazyLock` replaces `lazy_static!` entirely
> For a decade the answer was the `lazy_static` crate, then `once_cell::sync::Lazy`. Both still work and both are extremely widespread — you'll read them constantly in existing code. But `LazyLock` is in `std`, needs no dependency, no macro, and no import beyond `std::sync`. For new code it's simply the answer. `once_cell` remains useful only if you need to support a compiler older than 1.80.

## `OnceLock`: initialize once, when *you* decide

`LazyLock` computes its value from a closure it already has. `OnceLock` starts empty and lets you *give* it a value later — which is what you need when the value depends on runtime information like command-line arguments.

```rust
use std::sync::OnceLock;

#[derive(Debug)]
struct Config {
    port: u16,
    verbose: bool,
}

static CONFIG: OnceLock<Config> = OnceLock::new();

fn config() -> &'static Config {
    // A tiny accessor is the idiomatic wrapper — callers never see the OnceLock.
    CONFIG.get().expect("config not initialized; call init_config() in main")
}

fn init_config(port: u16, verbose: bool) {
    // set() returns Err if it was already initialized — it never overwrites.
    CONFIG
        .set(Config { port, verbose })
        .expect("config initialized twice");
}

fn main() {
    // Before initialization, get() is None rather than a panic or garbage.
    println!("before init: {:?}", CONFIG.get());

    // In a real program these values come from clap or the environment.
    init_config(8080, true);

    println!("after init:  {:?}", config());
    println!("port = {}", config().port);

    // A second set() fails rather than silently replacing the value.
    let second = CONFIG.set(Config { port: 9999, verbose: false });
    println!("second set succeeded? {}", second.is_ok());

    // get_or_init() is the "initialize if needed" form — the closure runs
    // only if the value is still empty.
    static FALLBACK: OnceLock<String> = OnceLock::new();
    println!("{}", FALLBACK.get_or_init(|| "computed on demand".to_string()));
    println!("{}", FALLBACK.get_or_init(|| "never runs".to_string()));
}
```

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="LazyLock runs its closure on first access while OnceLock stays empty until something calls set, and both are then read-only forever">
  <style>
    .ol-h { font: 700 12px var(--font-sans); }
    .ol-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .ol-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ol-empty { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .ol-full { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .ol-read { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="ol-h" fill="var(--rust-600)">LazyLock — the closure is supplied up front</text>
  <rect x="20" y="28" width="130" height="38" rx="4" class="ol-empty"/>
  <text x="32" y="46" class="ol-m">uninitialized</text>
  <text x="32" y="60" class="ol-c">closure stored</text>
  <rect x="215" y="28" width="150" height="38" rx="4" class="ol-full"/>
  <text x="227" y="46" class="ol-m">closure RUNS</text>
  <text x="227" y="60" class="ol-c">on first deref</text>
  <rect x="430" y="28" width="180" height="38" rx="4" class="ol-read"/>
  <text x="442" y="46" class="ol-m">&amp;T, forever</text>
  <text x="442" y="60" class="ol-c">plain reads, no locking</text>
  <path d="M152 47 L212 47" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-ol)"/>
  <path d="M367 47 L427 47" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-ol2)"/>
  <text x="160" y="86" class="ol-c">first access triggers it</text>
  <text x="20" y="128" class="ol-h" fill="var(--blue)">OnceLock — you supply the value later</text>
  <rect x="20" y="138" width="130" height="38" rx="4" class="ol-empty"/>
  <text x="32" y="156" class="ol-m">empty</text>
  <text x="32" y="170" class="ol-c">get() → None</text>
  <rect x="215" y="138" width="150" height="38" rx="4" class="ol-full"/>
  <text x="227" y="156" class="ol-m">set(value)</text>
  <text x="227" y="170" class="ol-c">2nd call → Err</text>
  <rect x="430" y="138" width="180" height="38" rx="4" class="ol-read"/>
  <text x="442" y="156" class="ol-m">get() → Some(&amp;T)</text>
  <text x="442" y="170" class="ol-c">immutable from now on</text>
  <path d="M152 157 L212 157" stroke="var(--blue)" stroke-width="2" marker-end="url(#arr-ol3)"/>
  <path d="M367 157 L427 157" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-ol2)"/>
  <text x="20" y="208" class="ol-c">Both give out only <tspan font-family="var(--font-mono)">&amp;T</tspan>. To mutate later, put a <tspan font-family="var(--font-mono)">Mutex</tspan> or <tspan font-family="var(--font-mono)">RwLock</tspan> inside.</text>
  <defs>
    <marker id="arr-ol" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="arr-ol2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="arr-ol3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
  </defs>
</svg>
<figcaption><b>LazyLock</b> knows how to build itself; <b>OnceLock</b> waits to be told. After initialization both hand out <code>&amp;T</code> with no synchronization cost.</figcaption>
</figure>

| | `LazyLock<T>` | `OnceLock<T>` |
|---|---|---|
| initialization | a closure given at declaration | `set()` or `get_or_init()` later |
| when it runs | on first access | when you call it |
| needs runtime input? | no | **yes** — that's the point |
| access | `*VALUE` (via `Deref`) | `VALUE.get()` → `Option<&T>` |
| initialized twice | impossible | `set()` returns `Err` |
| typical use | regex, lookup table, static data | config from args, a pool built in `main` |

> [!best] Wrap `OnceLock` in a function, not exposed directly
> Callers shouldn't write `CONFIG.get().unwrap()` at forty call sites. A `fn config() -> &'static Config` accessor gives one place for the `expect` message, one place to change the strategy later, and a signature that says the value is always available. If un-initialized access should be recoverable rather than fatal, return `Option<&'static Config>` instead and let callers decide.

> [!mistake] Forgetting to initialize a `OnceLock` before first use
> The failure is a panic on the first request rather than at startup — the exact problem the [deployment](#/ch/deployment) chapter warns about. Two defences: call `init_*()` as the first thing in `main`, before binding a port; and make the `expect` message say *what to call*, as above. Better still, prefer passing the config explicitly (see the caveat at the end of this chapter) so the compiler enforces it.

## Global mutable state, done safely

`OnceLock` and `LazyLock` give you `&T` — immutable. When the data must change, put a lock inside.

```rust
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex, RwLock};

// A counter needs no lock at all — an atomic is faster and can't deadlock.
static REQUESTS: AtomicU64 = AtomicU64::new(0);

// Mutex::new is a const fn, so a plain static works for simple cases.
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);

// For a type whose constructor isn't const (like HashMap::new in a static),
// wrap it in LazyLock. RwLock suits read-heavy data.
static CACHE: LazyLock<RwLock<HashMap<String, u64>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

fn record_request() -> u64 {
    // fetch_add returns the PREVIOUS value.
    REQUESTS.fetch_add(1, Ordering::Relaxed) + 1
}

fn remember_error(msg: &str) {
    // Keep the critical section tiny — the lock is released at the semicolon.
    *LAST_ERROR.lock().expect("mutex poisoned") = Some(msg.to_string());
}

fn cache_put(key: &str, value: u64) {
    CACHE.write().expect("lock poisoned").insert(key.to_string(), value);
}

fn cache_get(key: &str) -> Option<u64> {
    CACHE.read().expect("lock poisoned").get(key).copied()
}

fn main() {
    for _ in 0..3 {
        println!("request #{}", record_request());
    }

    remember_error("connection refused");
    println!("last error: {:?}", LAST_ERROR.lock().unwrap().as_deref());

    cache_put("answer", 42);
    println!("cached answer  = {:?}", cache_get("answer"));
    println!("cached missing = {:?}", cache_get("nope"));
    println!("total requests = {}", REQUESTS.load(Ordering::Relaxed));
}
```

| Global mutable need | Reach for | Why |
|---|---|---|
| a counter or flag | `AtomicU64`, `AtomicBool` | lock-free, can't deadlock, `const` constructor |
| one value replaced occasionally | `Mutex<T>` | simple; `Mutex::new` is `const` |
| read often, written rarely | `RwLock<T>` | many concurrent readers |
| a map built at startup, then read | `LazyLock<HashMap>` | no lock needed at all |
| a map mutated throughout | `LazyLock<RwLock<HashMap>>` | or `DashMap` for high contention |
| high-contention concurrent map | `dashmap::DashMap` | sharded locking |
| per-thread scratch space | `thread_local!` | no synchronization whatsoever |

> [!performance] If it never changes after startup, don't put a lock around it
> `LazyLock<RwLock<HashMap<..>>>` for a table that's populated once and then only read pays an atomic operation on **every single lookup**, forever. `LazyLock<HashMap<..>>` pays nothing — it hands out `&HashMap` directly. Reach for the lock only when there are genuine writes after initialization. This is one of the most common unnecessary costs in Rust services.

> [!warning] A `Mutex` in a global invites deadlock more than a local one does
> Global locks are reachable from anywhere, so it's easy for two code paths to acquire `A` then `B` and `B` then `A` without either author realizing. Keep global critical sections tiny, never call unknown code (a callback, a trait method, a `Display` impl) while holding one, and never hold two global locks at once. If you need both, that's a sign the data belongs in one struct behind one lock. See [Shared State](#/ch/shared-state).

## `thread_local!`: per-thread state

When each thread needs its own copy, there's no sharing and therefore no synchronization at all.

```rust
use std::cell::RefCell;

thread_local! {
    // Each thread gets its own, initialized on that thread's first access.
    static SCRATCH: RefCell<Vec<u32>> = RefCell::new(Vec::new());
}

fn accumulate(n: u32) -> usize {
    SCRATCH.with(|buf| {
        let mut buf = buf.borrow_mut();
        buf.push(n);
        buf.len()
    })
}

fn main() {
    println!("main thread: {} {} {}", accumulate(1), accumulate(2), accumulate(3));

    let handle = std::thread::spawn(|| {
        // A completely separate Vec — starts empty.
        println!("worker thread: {} {}", accumulate(100), accumulate(200));
        SCRATCH.with(|b| b.borrow().clone())
    });

    let worker_data = handle.join().unwrap();
    println!("worker saw: {worker_data:?}");
    SCRATCH.with(|b| println!("main still has: {:?}", b.borrow()));
}
```

> [!tip] `thread_local!` is the answer for reusable scratch buffers
> A per-thread `RefCell<Vec<u8>>` reused across calls eliminates an allocation per call without any locking — genuinely useful in a hot serialization or parsing path. Two caveats: the value is dropped when the thread exits (so don't rely on it for cleanup ordering), and in async code a task can move between threads at any `.await`, so thread-local state is **not** task-local. For async, use `tokio::task_local!` instead.

## The single-threaded family

Inside one thread you don't need atomics, and the cheaper types are available.

```rust
use std::cell::{Cell, OnceCell, RefCell};

fn main() {
    // Cell<T>: get/set a Copy value through &self. No borrow tracking at all.
    let hits = Cell::new(0u32);
    hits.set(hits.get() + 1);
    hits.set(hits.get() + 1);
    println!("Cell hits = {}", hits.get());

    // RefCell<T>: borrow tracking at RUNTIME, for non-Copy values.
    let log = RefCell::new(Vec::new());
    log.borrow_mut().push("started");
    log.borrow_mut().push("finished");
    println!("RefCell log = {:?}", log.borrow());

    // OnceCell<T>: like OnceLock, but single-threaded and cheaper.
    // Perfect for a lazily-computed field inside a struct.
    struct Document {
        text: String,
        word_count: OnceCell<usize>,
    }

    impl Document {
        fn word_count(&self) -> usize {
            // Computed on first call, cached thereafter — through &self.
            *self.word_count.get_or_init(|| {
                println!("  (counting words — once only)");
                self.text.split_whitespace().count()
            })
        }
    }

    let doc = Document { text: "the quick brown fox".into(), word_count: OnceCell::new() };
    println!("words = {}", doc.word_count());
    println!("words = {} (cached)", doc.word_count());
}
```

| Type | Thread-safe | Mutable after init | Cost |
|---|---|---|---|
| `Cell<T>` | no | yes (`Copy` only) | free |
| `RefCell<T>` | no | yes | a runtime borrow counter |
| `OnceCell<T>` | no | no | free after init |
| `LazyCell<T>` | no | no | free after init |
| `OnceLock<T>` | **yes** | no | one atomic on first read |
| `LazyLock<T>` | **yes** | no | one atomic on first read |
| `Mutex<T>` | **yes** | yes | a lock per access |
| `RwLock<T>` | **yes** | yes | a lock per access |
| `Atomic*` | **yes** | yes | one atomic instruction |

> [!deep] Why `OnceLock` is nearly free after initialization
> It stores a state word alongside the value. The first access performs an atomic compare-and-swap to claim the right to initialize; every subsequent access is an atomic *load* of that word, which on x86 and ARM is an ordinary load instruction with no bus locking or contention. So the steady-state cost is essentially a branch that always predicts correctly. That's why a global `LazyLock<HashMap>` is a perfectly reasonable thing to read in a hot loop — and why wrapping it in an unnecessary `RwLock` is not.

## A caution about globals

> [!warning] Global state is still global state
> Every type in this chapter makes globals *safe* — no data races, no undefined behaviour. None of them makes globals *good design*. A function reading a global has a hidden input: it can't be unit-tested with different values, two tests can't run in parallel with different configurations, and its dependencies aren't visible in its signature. Prefer passing an `Arc<Config>` or `&AppState` explicitly — Rust makes that cheap, and `axum`, `actix`, and every other serious framework are built around it precisely for this reason.

| Legitimate global | Why it's fine |
|---|---|
| a compiled regex | genuinely constant, expensive to build |
| a static lookup table | genuinely constant |
| a process-wide metrics registry | inherently singular; that's the point |
| the logging subscriber | inherently singular |
| an interned string pool | inherently singular |
| application config | ⚠️ works, but hurts testability — pass it instead |
| a database pool | ⚠️ same; pass it in your app state |
| "current user" or request context | ❌ use task-local or an explicit parameter |

## Summary

- **`static mut` is out** — it's a data race and an error in edition 2024. Every alternative below is safe.
- **`LazyLock<T>`** (1.80) runs a closure on first access; it replaces `lazy_static!` and `once_cell::sync::Lazy` for new code.
- **`OnceLock<T>`** starts empty and takes a value from `set()` or `get_or_init()` — use it when initialization depends on runtime input, and wrap it in an accessor function.
- Both hand out **`&T`**. For mutability, put an `Atomic*` (counters), `Mutex` (simple), or `RwLock` (read-heavy) *inside*.
- **Don't add a lock to data that never changes after startup** — `LazyLock<HashMap>` costs nothing per read; `LazyLock<RwLock<HashMap>>` costs an atomic every time.
- **`thread_local!`** gives per-thread state with zero synchronization — but it is *not* task-local in async code; use `tokio::task_local!` there.
- Single-threaded equivalents are cheaper: `Cell`, `RefCell`, `OnceCell`, `LazyCell` — `OnceCell` is ideal for a lazily-computed struct field behind `&self`.
- These types make globals **safe, not good**. Prefer passing state explicitly; reserve globals for genuinely process-wide singletons.

> [!exercise] Try it yourself
> 1. Create a `LazyLock<HashMap<&str, u32>>` with a `println!` inside the closure, then read it three times. How many times does the message print?
> 2. Write a `OnceLock<Config>` with an accessor function, and deliberately read it before initializing. Then improve the panic message so it tells you what to do.
> 3. Add a global `AtomicU64` request counter, increment it from four threads, and confirm the total is exactly right.
> 4. Build a `LazyLock<RwLock<HashMap<..>>>` cache, then rewrite it as `LazyLock<HashMap<..>>` once you realize it's never written after startup. What did you remove?
> 5. Use `thread_local!` for a `RefCell<Vec<u32>>`, push to it from two threads, and show that each thread has its own.
> 6. Give a struct a `OnceCell<usize>` field holding an expensive derived value, computed on first access through `&self`. Why couldn't you do this with a plain `usize`?

Next: turning text into structured data, with the parsing crates — **nom, winnow and pest**.
