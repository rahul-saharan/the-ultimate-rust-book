<h1><span class="h1-kicker">Smart Pointers</span>Deref & Drop</h1>

Smart pointers feel magical: you write `*my_box` to reach the value, call methods on a `String` as if it were a `&str`, and resources clean themselves up the instant they go out of scope. That magic is just two traits — **`Deref`** and **`Drop`** — and in this chapter you'll implement both yourself, turning the magic into something you understand and can wield.

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

> [!key] This is why `&String` works where `&str` is wanted
> Deref coercion is the reason you can pass `&my_string` to a function expecting `&str` (`String` derefs to `str`), and call `str` methods directly on a `String`. It also lets `Box<T>` and `Rc<T>` transparently expose the methods of the `T` inside. A huge amount of Rust's ergonomic "it just works" comes from this one trait.

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

## How they combine in a smart pointer

Every smart pointer you've met is built from these traits:

| Type | `Deref` gives it… | `Drop` gives it… |
|------|-------------------|-------------------|
| `Box<T>` | access to the `T` via `*` and methods | frees the heap allocation |
| `Rc<T>` | access to the shared `T` | decrements the count (frees at 0) |
| `String` | `&str` behavior (deref coercion) | frees the text buffer |
| `MutexGuard<T>` | access to the locked `T` | **unlocks** the mutex |

> [!best] Let `Drop` manage resources for you
> When you wrap any resource — a file handle, a database connection, a network socket, a C pointer — implement `Drop` so it's released automatically. Callers then can't forget to clean up, and cleanup is correct even on early return or panic. This "resource = value with a `Drop`" habit is one of the most reliable patterns in all of Rust.

## Summary

- **`Deref`** customizes the `*` operator so your type acts like a pointer to an inner value; implement `deref(&self) -> &Target`.
- **Deref coercion** automatically follows `Deref` chains (`&String → &str`, `&Box<T> → &T`) — the source of much of Rust's ergonomics.
- **`Drop`** runs cleanup code (`fn drop(&mut self)`) automatically when a value leaves scope — this is **RAII**, and it fires even on early return or panic.
- Values drop in **reverse** creation order; release one early with the free function **`drop(value)`** (you can't call `.drop()` yourself).
- `Box`, `Rc`, `String`, and `MutexGuard` are all just types that combine `Deref` and `Drop`.

> [!exercise] Try it yourself
> 1. Extend `MyBox<T>` with a method and confirm you can call it through `*` and via deref coercion.
> 2. Make a `struct FileHandle` whose `Drop` prints "closing file", create two in a scope, and observe the reverse drop order.
> 3. Use `drop(x)` to release a value early and prove (with a println in `Drop`) that it happens before the end of `main`.

There's one dangerous corner of reference counting we haven't addressed: what if two `Rc`s point at *each other*? That's a memory leak — and the fix is **`Weak` references**, next.
