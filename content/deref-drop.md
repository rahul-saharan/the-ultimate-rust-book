<h1><span class="h1-kicker">Smart Pointers</span>Deref & Drop</h1>

Smart pointers feel magical: you write `*my_box` to reach the value, call methods on a `String` as if it were a `&str`, and resources clean themselves up the instant they go out of scope. That magic is just two traits — **`Deref`** and **`Drop`** — and in this chapter you'll implement both yourself, turning the magic into something you understand and can wield.

## Why these two traits exist

Look back at `Box`, `Rc`, and `RefCell` and you'll notice each does two distinct jobs:

- It **behaves like the value it holds**. `boxed.len()` works even though `len` is a method on `String`, not on `Box`. That's `Deref`.
- It **manages something on the way out**. Freeing an allocation, decrementing a count, releasing a lock. That's `Drop`.

Those two traits *are* what makes a pointer "smart". Take them away and you'd have a plain wrapper struct you'd need to unwrap by hand everywhere, plus a `.close()` method every caller must remember to call. Implement them and the wrapper disappears into the background:

| Without the trait | With the trait |
|---|---|
| `(*wrapper.inner()).len()` | `wrapper.len()` |
| `fn take(x: &Wrapper<String>)` | `fn take(x: &str)` — callers pass either |
| `conn.close()?;` on every exit path | automatic, even on `?` or a panic |
| forgetting cleanup is a leak | forgetting is impossible |

> [!key] `Deref` is about *ergonomics*; `Drop` is about *correctness*
> They're often taught together because every smart pointer uses both, but they solve unrelated problems. `Deref` is pure convenience — code would still work without it, just verbosely. `Drop` is a guarantee: it makes "this resource is always released" a property of the type rather than a rule people have to follow. If you only ever implement one of these yourself, it should be `Drop`.

## `Deref`: making a type act like a reference

The **`Deref`** trait customizes what the dereference operator `*` does. Implement it and your custom type behaves like a pointer to some inner value. Let's build a minimal clone of `Box` to see it work:

```rust
use std::ops::Deref;

struct MyBox<T>(T); // a tuple struct holding one value

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

impl<T> Deref for MyBox<T> {
    type Target = T;              // what * produces
    fn deref(&self) -> &T {
        &self.0                   // return a reference to the inner value
    }
}

fn main() {
    let b = MyBox::new(5);
    // Because we implemented Deref, *b works — it calls b.deref() then dereferences:
    println!("{}", *b);           // 5
    assert_eq!(5, *b);
}
```

Behind the scenes, `*b` becomes `*(b.deref())`. You wrote `deref` to return `&self.0`, so `*b` gives you the inner `5`.

### `DerefMut` for mutable access

`Deref` only ever produces a `&T`. To support `*b = value` and mutating method calls, implement its partner **`DerefMut`**:

```rust
use std::ops::{Deref, DerefMut};

struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

impl<T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

// DerefMut requires Deref, and must return a reference to the SAME field.
impl<T> DerefMut for MyBox<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

fn main() {
    let mut b = MyBox::new(vec![1, 2]);

    b.push(3);          // a &mut method, reached through DerefMut
    b[0] = 10;          // index assignment, likewise
    *b = vec![7, 8, 9]; // replace the whole inner value

    println!("{:?}", *b);
    println!("len = {}", b.len()); // a & method, via plain Deref
}
```

| Trait | Method | Enables |
|---|---|---|
| `Deref` | `deref(&self) -> &Target` | `*b`, `&b` coercion, calling `&self` methods |
| `DerefMut` | `deref_mut(&mut self) -> &mut Target` | `*b = x`, calling `&mut self` methods, `b[i] = x` |

> [!note] `DerefMut` requires `Deref`, and both must point at the same place
> `DerefMut` has `Deref` as a supertrait, so you always implement the pair. Crucially, both must return a reference to the *same* underlying value — returning `&self.a` from `deref` and `&mut self.b` from `deref_mut` compiles but produces genuinely baffling behaviour, where reading and writing hit different fields. The compiler cannot check this; it's a contract you keep.

## Deref coercion: the quiet convenience

`Deref` powers a feature you've been enjoying without noticing: **deref coercion**. When you pass a reference to a type that implements `Deref`, Rust will *automatically* follow the `Deref` chain to match the type a function expects.

```rust
# use std::ops::Deref;
# struct MyBox<T>(T);
# impl<T> MyBox<T> { fn new(x: T) -> MyBox<T> { MyBox(x) } }
# impl<T> Deref for MyBox<T> { type Target = T; fn deref(&self) -> &T { &self.0 } }
fn hello(name: &str) {
    println!("Hello, {name}!");
}

fn main() {
    let m = MyBox::new(String::from("Rust"));
    // &MyBox<String> → &String → &str, all automatically:
    hello(&m);
}
```

That chain — `&MyBox<String>` to `&String` to `&str` — happens silently at compile time.

Rust performs exactly three coercions, and knowing them explains what will and won't compile:

| From | To | Requires | Note |
|---|---|---|---|
| `&T` | `&U` | `T: Deref<Target = U>` | the common case |
| `&mut T` | `&mut U` | `T: DerefMut<Target = U>` | needs `DerefMut` |
| `&mut T` | `&U` | `T: Deref<Target = U>` | mutable "downgrades" to shared |

There is deliberately **no** `&T` → `&mut U` coercion — that would conjure mutable access out of a shared reference and break the borrowing rules.

The everyday coercions you already rely on:

| You have | It coerces to | Which is why |
|---|---|---|
| `&String` | `&str` | `&my_string` works anywhere `&str` is wanted |
| `&Vec<T>` | `&[T]` | `&my_vec` works anywhere `&[T]` is wanted |
| `&Box<T>` | `&T` | boxed values expose the inner type's methods |
| `&Rc<T>` / `&Arc<T>` | `&T` | shared values behave like the value |
| `&PathBuf` | `&Path` | path-taking functions accept either |
| `&OsString` | `&OsStr` | same idea for OS strings |
| `Ref<T>` / `RefMut<T>` | `&T` / `&mut T` | `RefCell` guards act like the value |
| `MutexGuard<T>` | `&T` / `&mut T` | locks act like the locked value |

> [!key] This is why `&String` works where `&str` is wanted
> Deref coercion is the reason you can pass `&my_string` to a function expecting `&str` (`String` derefs to `str`), and call `str` methods directly on a `String`. It also lets `Box<T>` and `Rc<T>` transparently expose the methods of the `T` inside. A huge amount of Rust's ergonomic "it just works" comes from this one trait.

> [!best] Take `&str` and `&[T]` in your function signatures
> Deref coercion means a function taking `&str` can be called with `&String`, `&Box<str>`, or `&Rc<str>` — while a function taking `&String` accepts *only* a `String`. The same applies to `&[T]` versus `&Vec<T>`. Since the coercion is free and happens at compile time, the narrower parameter type costs your callers flexibility for no benefit whatsoever. This is the single most common piece of API advice in Rust, and deref coercion is the machinery that makes it work — see [API Design](#/ch/api-design).

> [!warning] Don't implement `Deref` to fake inheritance
> `Deref` exists for types that genuinely *are* pointers to something else — `Box`, `Rc`, `MutexGuard`, `String`. It's tempting to implement it on a newtype so you inherit all the inner type's methods for free, but that makes your type silently interchangeable with its contents, defeats the whole purpose of a newtype, and produces error messages mentioning methods you never wrote. The standard library's own guidance says not to. If you want a few methods forwarded, write those few methods. See [Anti-Patterns](#/ch/anti-patterns).

## `Drop`: running code on cleanup

The **`Drop`** trait lets you run custom code the moment a value goes out of scope — the foundation of Rust's automatic resource management (closing files, releasing locks, freeing memory). You implement one method, `drop`:

```rust
struct Guard {
    name: String,
}

impl Drop for Guard {
    fn drop(&mut self) {
        println!("Cleaning up guard '{}'", self.name);
    }
}

fn main() {
    let _a = Guard { name: "A".into() };
    let _b = Guard { name: "B".into() };
    println!("Guards created; end of main coming up…");
    // No manual cleanup! drop() runs automatically at the closing brace.
}
```

Run it and you'll see the guards cleaned up **in reverse order** (`B` before `A`) — the last created is the first dropped, like unwinding a stack:

```text
Guards created; end of main coming up…
Cleaning up guard 'B'
Cleaning up guard 'A'
```

> [!key] This is RAII — cleanup tied to scope
> This pattern is called **RAII** (*Resource Acquisition Is Initialization*): a resource is acquired when a value is created and released automatically when the value is dropped. You never write "cleanup" code at every exit path — `Drop` guarantees it runs exactly once, even if the function returns early or panics. It's how `File` closes itself, `MutexGuard` unlocks, and `Box`/`Vec`/`String` free their heap memory.

## Drop order is specified — and not uniform

"Reverse order" is true for local variables, but *not* for struct fields. Getting this wrong causes real bugs when one field depends on another still being alive:

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="Local variables drop in reverse declaration order, while struct fields and vector elements drop in forward declaration order">
  <style>
    .do-h { font: 700 12px var(--font-sans); }
    .do-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .do-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .do-rev { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 1.6; }
    .do-fwd { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <text x="20" y="18" class="do-h" fill="var(--rust-600)">Local variables — REVERSE order (last in, first out)</text>
  <rect x="20" y="28" width="120" height="24" rx="3" class="do-rev"/><text x="30" y="45" class="do-m">let a = …;</text>
  <rect x="150" y="28" width="120" height="24" rx="3" class="do-rev"/><text x="160" y="45" class="do-m">let b = …;</text>
  <rect x="280" y="28" width="120" height="24" rx="3" class="do-rev"/><text x="290" y="45" class="do-m">let c = …;</text>
  <text x="420" y="45" class="do-c">drops: c → b → a</text>
  <path d="M395 58 L35 58" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-do)"/>
  <text x="20" y="80" class="do-c">Why: a later local may borrow an earlier one, so the borrower must die first.</text>
  <text x="20" y="112" class="do-h" fill="var(--green)">Struct fields — DECLARATION order (first declared, first dropped)</text>
  <rect x="20" y="122" width="180" height="24" rx="3" class="do-fwd"/><text x="30" y="139" class="do-m">struct S { a: A,</text>
  <rect x="210" y="122" width="180" height="24" rx="3" class="do-fwd"/><text x="220" y="139" class="do-m">           b: B }</text>
  <text x="410" y="139" class="do-c">drops: a → b</text>
  <path d="M35 152 L385 152" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-do2)"/>
  <text x="20" y="186" class="do-h" fill="var(--green)">Vec / array elements — front to back</text>
  <rect x="20" y="196" width="70" height="24" rx="3" class="do-fwd"/><text x="30" y="213" class="do-m">v[0]</text>
  <rect x="100" y="196" width="70" height="24" rx="3" class="do-fwd"/><text x="110" y="213" class="do-m">v[1]</text>
  <rect x="180" y="196" width="70" height="24" rx="3" class="do-fwd"/><text x="190" y="213" class="do-m">v[2]</text>
  <text x="270" y="213" class="do-c">drops: 0 → 1 → 2</text>
  <path d="M35 226 L245 226" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-do2)"/>
  <text x="20" y="246" class="do-c">A struct's own <tspan font-family="var(--font-mono)">Drop::drop</tspan> always runs <tspan font-weight="700">before</tspan> any of its fields are dropped.</text>
  <defs>
    <marker id="arr-do" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="arr-do2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption>Locals drop backwards; <b>struct fields and collection elements drop forwards</b>. The container's own <code>drop</code> runs first, then its fields.</figcaption>
</figure>

```rust
struct Noisy(&'static str);

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("  dropped {}", self.0);
    }
}

struct Pair {
    first: Noisy,
    second: Noisy,
}

impl Drop for Pair {
    fn drop(&mut self) {
        println!("  Pair::drop runs BEFORE its fields");
    }
}

fn main() {
    println!("locals — reverse order:");
    {
        let _a = Noisy("local a");
        let _b = Noisy("local b");
    }

    println!("\nstruct fields — declaration order:");
    {
        let _p = Pair { first: Noisy("field first"), second: Noisy("field second") };
    }

    println!("\nvec elements — front to back:");
    {
        let _v = vec![Noisy("v[0]"), Noisy("v[1]"), Noisy("v[2]")];
    }

    println!("\ndone");
}
```

> [!mistake] Reordering struct fields can change behaviour
> Because fields drop in declaration order, moving a field up or down in a struct definition changes *when* it's released relative to its siblings. That's normally invisible — but if one field holds a connection and another holds something that flushes to it on drop, swapping their order can turn "flush, then close" into "close, then flush to a closed connection." If a `Drop` impl depends on a sibling field still being usable, say so in a comment above the struct; there's no attribute to enforce it.

## Dropping early with `std::mem::drop`

Values drop at the end of their scope — but sometimes you want to release something *sooner* (say, unlock a mutex before a long computation). You can't call `.drop()` yourself (Rust forbids it, to prevent double-frees), but you can hand the value to the standard `drop` function, which takes ownership and lets it fall out of scope immediately:

```rust
struct Noisy;
impl Drop for Noisy {
    fn drop(&mut self) { println!("Noisy dropped!"); }
}

fn main() {
    let n = Noisy;
    println!("before explicit drop");
    drop(n); // takes ownership → n is dropped right here
    println!("after explicit drop — n is already gone");
}
```

> [!mistake] You can't call `.drop()` directly
> Writing `n.drop()` is a compile error (`explicit use of destructor method`). If Rust let you, the value would *also* be dropped again at the end of scope — a double-free. Use the free function **`drop(n)`** instead; it consumes the value so the automatic drop won't run twice.

> [!tip] `drop(guard)` is how you release a lock early
> The most common real use isn't cleanup at all — it's shortening a critical section. A `MutexGuard` holds the lock until it drops, so `drop(guard)` before a slow computation lets other threads proceed. The alternative is an explicit `{ }` block around the locked section, which is often clearer. Either way, the general rule holds: **hold guards for as little time as possible** — see [Shared State](#/ch/shared-state).

## Choosing *not* to drop

Occasionally you need the opposite: prevent the destructor from running. This comes up in FFI (where C now owns the memory) and when you're deliberately leaking:

```rust
use std::mem::ManuallyDrop;

struct Noisy(&'static str);
impl Drop for Noisy {
    fn drop(&mut self) {
        println!("  dropped {}", self.0);
    }
}

fn main() {
    println!("normal value:");
    {
        let _n = Noisy("this one drops");
    }

    println!("\nManuallyDrop — Drop never runs:");
    {
        let held = ManuallyDrop::new(Noisy("this one leaks"));
        println!("  scope ending… (no drop message follows)");
        let _ = &held;
    }

    println!("\nmem::forget — same effect:");
    {
        let n = Noisy("forgotten");
        std::mem::forget(n);
        println!("  forgotten, no drop message");
    }

    // needs_drop tells you whether a type has any cleanup at all —
    // useful in generic code that wants to skip work.
    println!("\nneeds_drop::<i32>()    = {}", std::mem::needs_drop::<i32>());
    println!("needs_drop::<String>() = {}", std::mem::needs_drop::<String>());
}
```

| Tool | Effect | Use for |
|---|---|---|
| `drop(v)` | drops **now** | releasing a lock or file early |
| `mem::forget(v)` | never drops — **leaks** | after handing ownership to FFI |
| `ManuallyDrop::new(v)` | never drops unless you ask | wrapping a field whose drop you control |
| `ManuallyDrop::into_inner(v)` | recover the value, drop restored | ending the exemption |
| `mem::needs_drop::<T>()` | `bool` | skipping cleanup loops in generic code |
| `mem::take(&mut v)` | swap in `T::default()`, return the old | **moving a field out inside `drop`** |
| `mem::replace(&mut v, x)` | swap in `x`, return the old | same, with a chosen replacement |

> [!warning] `Drop::drop` takes `&mut self`, so you can't move fields out
> This trips up everyone who writes a non-trivial destructor. `fn drop(&mut self)` only *borrows*, so `self.connection.close()` — where `close` takes `self` by value — won't compile. The standard workaround is `std::mem::take(&mut self.connection)` (or `mem::replace`) to swap the field out for a default and take ownership of the original. It's the reason so many `Drop` impls contain a `take` or an `Option` field they can `.take()`.

> [!warning] `Drop` cannot fail and cannot be `async`
> `drop` returns `()`, so there is nowhere to report an error, and it can't `.await`. That's a genuine limitation, not an oversight: dropping happens at arbitrary points including during a panic, and a failing destructor has nothing sensible to do. Panicking inside `drop` *while already panicking* aborts the process outright. So for anything where failure matters — flushing a buffer, committing a transaction, closing a socket cleanly — provide an explicit **`fn close(self) -> Result<()>`** as well, and treat `Drop` as the safety net for paths that skipped it. This is exactly why `BufWriter` has both a `flush()` you should call and a `Drop` that tries anyway (and silently ignores errors).

## How to implement them: the reference

Unlike `Box` or `Rc`, these aren't types you construct — they're traits you *implement*. Here is the complete shape of each, with everything you can and can't do:

```rust
use std::ops::{Deref, DerefMut};

/// A wrapper owning one resource, with all three impls side by side.
struct Wrapper<T> {
    inner: T,
    label: &'static str,
}

// ---- Deref: one associated type, one method, returns a REFERENCE ----
impl<T> Deref for Wrapper<T> {
    type Target = T;            // required: what `*` produces
    fn deref(&self) -> &T {     // note: &self → &Target. Never a value.
        &self.inner
    }
}

// ---- DerefMut: requires Deref; must point at the SAME field ----
impl<T> DerefMut for Wrapper<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.inner         // the same field as deref, always
    }
}

// ---- Drop: no associated types, takes &mut self, returns () ----
impl<T> Drop for Wrapper<T> {
    fn drop(&mut self) {
        // You may: read/mutate fields, log, release resources.
        // You may NOT: return a value, return an error, .await,
        //              move a field out (only &mut self), or call drop(self).
        println!("releasing {}", self.label);
    }
}

fn main() {
    let mut w = Wrapper { inner: vec![1, 2], label: "buffer" };
    w.push(3);                          // DerefMut
    println!("len {}", w.len());         // Deref
    println!("{:?}", *w);                // explicit deref
} // Drop runs here
```

| | `Deref` | `DerefMut` | `Drop` |
|---|---|---|---|
| Associated type | `type Target` | — (inherited) | — |
| Method | `deref(&self) -> &Target` | `deref_mut(&mut self) -> &mut Target` | `drop(&mut self)` |
| Requires | — | `Deref` | — |
| Can return a value? | a reference only | a reference only | no — returns `()` |
| Can fail? | no | no | **no** |
| Can you call it directly? | `.deref()` yes (rarely useful) | `.deref_mut()` yes | **no** — use `drop(v)` |
| Auto-derived? | no | no | no |
| Blanket-implemented? | no | no | implicitly, for every field |

A short checklist before you write either one:

| Ask | If yes | If no |
|---|---|---|
| Is my type conceptually a *pointer* to its contents? | implement `Deref` | don't — write named methods instead |
| Should callers be able to mutate through it? | add `DerefMut` too | `Deref` alone |
| Do `deref` and `deref_mut` return the same field? | correct | fix it — the compiler won't catch this |
| Does my type own a resource needing release? | implement `Drop` | you don't need it; fields drop themselves |
| Can that release fail in a way callers care about? | **also** provide `close(self) -> Result<()>` | `Drop` alone is fine |
| Does `drop` need to consume a field? | use `mem::take` / an `Option` field | direct field access is fine |
| Am I implementing `Drop` just to log? | fine, but remember it runs on panics too | — |

> [!note] You almost never need to implement `Drop`
> Every field drops itself automatically, recursively — a struct holding a `Vec<String>` and a `File` releases all of it with no `Drop` impl at all. You only need one when cleanup isn't expressible as "drop my fields": telling an external system you're finished, decrementing a counter you don't own, unregistering a callback, or freeing something you obtained through FFI. If your `drop` body only touches your own fields and doesn't talk to anything outside, it's probably redundant.

## How they combine in a smart pointer

Every smart pointer you've met is built from these traits:

| Type | `Deref` gives it… | `Drop` gives it… |
|------|-------------------|-------------------|
| `Box<T>` | access to the `T` via `*` and methods | drops the `T`, frees the allocation |
| `Rc<T>` / `Arc<T>` | access to the shared `T` | decrements the count (frees at 0) |
| `String` | `&str` behavior (deref coercion) | frees the text buffer |
| `Vec<T>` | `&[T]` behavior | drops every element, then the buffer |
| `Ref<T>` / `RefMut<T>` | access to the `RefCell`'s value | resets the borrow flag |
| `MutexGuard<T>` | access to the locked `T` | **unlocks** the mutex |
| `File` | — (no `Deref`) | closes the file descriptor |

Putting both together gives you the guard pattern in about twenty lines:

```rust
use std::ops::{Deref, DerefMut};

/// A guard that tracks how long it held a resource, and reports on release.
struct Tracked<T> {
    value: T,
    label: &'static str,
}

impl<T> Tracked<T> {
    fn new(label: &'static str, value: T) -> Self {
        println!("[{label}] acquired");
        Tracked { value, label }
    }
}

// Deref: the guard behaves like the value it wraps.
impl<T> Deref for Tracked<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.value
    }
}

impl<T> DerefMut for Tracked<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.value
    }
}

// Drop: cleanup happens on every exit path, including early returns.
impl<T> Drop for Tracked<T> {
    fn drop(&mut self) {
        println!("[{}] released", self.label);
    }
}

fn process(fail_early: bool) -> Result<usize, &'static str> {
    let mut buffer = Tracked::new("buffer", Vec::new());
    buffer.push("first"); // DerefMut in action — no .value needed

    if fail_early {
        return Err("bailed out"); // the guard STILL releases
    }

    buffer.push("second");
    Ok(buffer.len()) // Deref in action
}

fn main() {
    println!("{:?}\n", process(false));
    println!("{:?}", process(true));
}
```

> [!best] Let `Drop` manage resources for you
> When you wrap any resource — a file handle, a database connection, a network socket, a C pointer — implement `Drop` so it's released automatically. Callers then can't forget to clean up, and cleanup is correct even on early return or panic. This "resource = value with a `Drop`" habit is one of the most reliable patterns in all of Rust.

## Summary

- **`Deref`** is about ergonomics, **`Drop`** is about correctness. Together they're what makes a pointer "smart".
- **`Deref`** customizes `*` (`deref(&self) -> &Target`); **`DerefMut`** adds mutable access (`*b = x`, `&mut self` methods). Both must point at the same value.
- **Deref coercion** happens in exactly three forms: `&T → &U`, `&mut T → &mut U`, and `&mut T → &U`. There is deliberately no `&T → &mut U`.
- Coercion is why **`&String` works where `&str` is wanted** — so take `&str` and `&[T]` in your signatures, never `&String`/`&Vec<T>`.
- **Don't implement `Deref` to fake inheritance.** It's for genuine pointer types only.
- **`Drop`** runs cleanup automatically — this is **RAII**, and it fires on early return and panic.
- **Drop order**: locals **reverse**, struct fields and collection elements **forward**, and a container's own `drop` before its fields.
- Release early with **`drop(value)`** (never `.drop()`); prevent dropping with **`ManuallyDrop`** or **`mem::forget`**.
- `Drop::drop` takes **`&mut self`**, so use **`mem::take`/`mem::replace`** to move a field out.
- `Drop` **cannot fail or be `async`** — pair it with an explicit `close(self) -> Result<()>` when errors matter.

> [!exercise] Try it yourself
> 1. Extend `MyBox<T>` with a method and confirm you can call it through `*` and via deref coercion.
> 2. Add `DerefMut` to `MyBox<Vec<i32>>` and use `push`, index assignment, and `*b = …`. Then remove `DerefMut` and see which of the three stop compiling.
> 3. Make a `struct FileHandle` whose `Drop` prints "closing file", create two in a scope, and observe the reverse drop order.
> 4. Build a struct with two `Drop`-implementing fields and confirm they drop in *declaration* order, and that the struct's own `drop` runs first. Then swap the field order.
> 5. Use `drop(x)` to release a value early and prove (with a println in `Drop`) that it happens before the end of `main`.
> 6. Write a `Drop` impl that needs to consume a field by value. Hit the `&mut self` error, then fix it with `mem::take`.
> 7. Wrap a value in `ManuallyDrop` and confirm its destructor never runs. What would you use this for?

You've now seen both traits in isolation. Next we meet the types where they do their most visible work together — **`Cell` and the lock guards**, whose whole purpose is to hand you access on `Deref` and release it on `Drop`.