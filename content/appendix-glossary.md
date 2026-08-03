<h1><span class="h1-kicker">Appendices</span>D · Glossary</h1>

Every Rust term used in this book, defined in plain English. Whenever a word made you pause, look it up here. Terms link to the chapter where they're taught in depth.

## A – C

**Allocation** — reserving memory (usually on the [heap](#/ch/stack-heap)) to store data; *deallocation*/*freeing* gives it back.

**Amortized** — an average cost over many operations, even if one is occasionally expensive. `Vec::push` is *amortized O(1)*: usually instant, occasionally triggering a reallocation. ([Big-O](#/ch/dsa-intro))

**Associated function** — a function on a type that takes no `self` (called with `::`), like `String::new`. ([Methods](#/ch/methods))

**Associated type** — a placeholder type a [trait](#/ch/advanced-traits) declares and each implementer fills in (e.g. `Iterator::Item`).

**Async** — a concurrency model for [waiting efficiently](#/ch/async-intro) on I/O; `async fn` returns a *future*.

**Borrow** — to access a value via a [reference](#/ch/references-borrowing) (`&`) without taking ownership.

**Borrow checker** — the compiler component that enforces the borrowing rules (shared XOR mutable) at compile time.

**Closure** — an anonymous [function that captures](#/ch/closures) variables from its surrounding scope (`|x| x + 1`).

**Copy** — a [trait](#/ch/appendix-derivable) for small stack-only types that are duplicated implicitly on assignment (vs. *moved*).

**Crate** — Rust's unit of compilation: a binary or library. Casually, "a crate" also means a package from [crates.io](#/ch/crates-overview).

## D – I

**Deref coercion** — the compiler automatically following [`Deref`](#/ch/deref-drop) to convert `&String → &str`, `&Box<T> → &T`, etc.

**DST (dynamically sized type)** — a type without a compile-time size (`str`, `[T]`, `dyn Trait`), used only behind a [pointer](#/ch/advanced-types).

**Drop** — the automatic [cleanup](#/ch/deref-drop) that runs when a value goes out of scope (RAII).

**Enum** — a type that is [one of several variants](#/ch/enums), each optionally carrying data.

**Future** — a value representing a [computation not yet complete](#/ch/futures); driven by an async runtime.

**Generics** — writing code [parameterized over types](#/ch/generics) (`<T>`), specialized at compile time (*monomorphization*).

**Heap** — the flexible memory region for [data whose size/lifetime varies](#/ch/stack-heap); accessed via pointers.

**Immutable** — cannot be changed after binding (the [default](#/ch/variables) in Rust).

**Iterator** — a type producing a [sequence of values](#/ch/iterators) lazily via `next()`.

## L – O

**Lifetime** — [how long a reference is valid](#/ch/lifetimes); annotated `'a` when the compiler needs help.

**Macro** — [code that generates code](#/ch/macros-declarative) at compile time; called with `!` (`println!`). *Declarative* (`macro_rules!`) or *procedural* (custom `#[derive]`).

**Monomorphization** — the compiler generating a specialized copy of [generic](#/ch/generics) code per concrete type (zero-cost).

**Move** — transferring [ownership](#/ch/ownership) of a value; the source becomes invalid.

**Mutable** — changeable; opt in with `mut`.

**Ownership** — Rust's [core memory model](#/ch/ownership): each value has one owner; when the owner scope ends, the value is dropped.

**Option** — the [enum](#/ch/enums) `Some(T)` / `None` modeling a value that may be absent (Rust's "no null").

## P – S

**Panic** — an [unrecoverable error](#/ch/panic): the program prints a message and unwinds/aborts.

**Pattern matching** — [destructuring and branching](#/ch/pattern-matching) on the shape of data with `match`, `if let`, etc.

**Pointer** — a value holding the memory *address* of data elsewhere.

**RAII** — *Resource Acquisition Is Initialization*: a resource is [released automatically](#/ch/deref-drop) when its owner is dropped.

**Reference** — a [borrow](#/ch/references-borrowing) (`&T` shared, `&mut T` mutable) that accesses a value without owning it.

**Result** — the [enum](#/ch/result-option) `Ok(T)` / `Err(E)` modeling success or failure.

**Runtime** — for [async](#/ch/tokio), the library (e.g. tokio) that drives futures; more generally, code running while your program executes.

**Shadowing** — [re-declaring a variable](#/ch/variables) with the same name (possibly a new type).

**Slice** — a [borrowed view](#/ch/slices) into a contiguous part of a collection (`&str`, `&[T]`); a *fat pointer* (address + length).

**Smart pointer** — a type that acts like a [pointer with extra powers](#/ch/box) (`Box`, `Rc`, `RefCell`).

**Stack** — the fast, ordered [memory region](#/ch/stack-heap) for fixed-size, short-lived values (function locals).

**Struct** — a [custom type grouping named fields](#/ch/structs).

## T – Z

**Trait** — a set of [shared behavior](#/ch/traits) (methods) types can implement; Rust's interfaces.

**Trait object** — `dyn Trait`: a value used [via dynamic dispatch](#/ch/trait-objects), behind a pointer.

**Turbofish** — the `::<Type>` syntax to specify a [generic type](#/ch/generics) (`"5".parse::<i32>()`).

**UB (undefined behavior)** — the [consequence of breaking `unsafe`](#/ch/unsafe) rules: anything can happen. Safe Rust guarantees no UB.

**Unsafe** — code using [abilities](#/ch/unsafe) the compiler can't verify (raw pointers, FFI); you vouch for its correctness.

**Vec** — a [growable array](#/ch/vectors) (`Vec<T>`), the default collection.

**Zero-cost abstraction** — a high-level feature ([generics](#/ch/generics), [iterators](#/ch/iterators)) that compiles to code as fast as a hand-written low-level version.

> [!tip] Still stuck on a term?
> The official [Rust reference](https://doc.rust-lang.org/reference/) and the [standard-library docs](https://doc.rust-lang.org/std/) (offline via `rustup doc`) are the authoritative sources. And remember: throughout this book, every hard word was explained in parentheses the moment it first appeared — the [jargon-buster callouts](#/ch/welcome) are scattered through every chapter.

## Summary

- This glossary defines every technical term in the book in plain English, linked to its home chapter.
- The concepts that unify Rust: **ownership**, **borrowing**, **lifetimes**, **traits**, **generics**, and **zero-cost abstractions**.
- When a term stumps you: check here, the jargon-buster callouts in each chapter, or `rustup doc`.
