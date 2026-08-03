<h1><span class="h1-kicker">Appendices</span>E · The Rust Cheat Sheet</h1>

The whole language on one dense, scannable page. Every construct you've learned, condensed for quick reference. Bookmark it — this is the page you'll come back to for "what's the syntax for…?" long after you've finished the book.

## Variables & types

```rust,ignore
let x = 5;                 // immutable binding (type inferred)
let mut y = 5;             // mutable
let z: i64 = 5;            // explicit type
const MAX: u32 = 100_000;  // compile-time constant (type required)
let x = x + 1;             // shadowing (new binding, may change type)

// Scalars: i8..i128/u8..u128/isize/usize, f32/f64, bool, char
// Compound: (i32, bool) tuple, [i32; 4] array
let (a, b) = (1, 2);       // tuple destructuring
let arr = [0; 5];          // [0, 0, 0, 0, 0]
```

## Functions & control flow

```rust,ignore
fn add(a: i32, b: i32) -> i32 { a + b }   // last expr (no ;) is returned

if x > 0 { … } else if x < 0 { … } else { … }
let v = if cond { 1 } else { 2 };          // if is an expression

loop { break value; }                       // loop can return a value
while cond { … }
for i in 0..5 { … }                         // 0..5 exclusive, 1..=5 inclusive
for x in &collection { … }                   // iterate by reference
```

## Ownership & references

```rust,ignore
let s2 = s1;               // MOVE (s1 now invalid, for non-Copy types)
let s2 = s1.clone();       // deep copy
fn read(x: &T) { … }       // borrow (shared, read-only)
fn write(x: &mut T) { … }  // borrow (mutable)
// Rule: one &mut XOR any number of & at a time.
let slice = &v[1..4];      // slice: a borrowed view
```

## Structs & enums

```rust,ignore
struct Point { x: i32, y: i32 }         // named-field
struct Pair(i32, i32);                   // tuple struct
struct Marker;                            // unit struct

let p = Point { x: 1, y: 2 };
let p2 = Point { x: 5, ..p };            // struct update syntax

enum Shape {
    Circle(f64),                          // data-carrying variants
    Rect { w: f64, h: f64 },
    Empty,
}

impl Point {                              // methods
    fn new(x: i32, y: i32) -> Self { Self { x, y } }  // associated fn
    fn sum(&self) -> i32 { self.x + self.y }          // method
}
```

## Pattern matching

```rust,ignore
match value {
    0 => "zero",
    1..=9 => "small",
    n if n < 0 => "negative",        // guard
    Some(x) => …,                     // bind inner value
    Point { x: 0, y } => …,           // destructure
    _ => "other",                     // wildcard
}

if let Some(x) = opt { … }            // match one pattern
while let Some(x) = stack.pop() { … } // loop while matching
let Some(x) = opt else { return };    // bind-or-diverge
```

## Error handling

```rust,ignore
enum Option<T> { Some(T), None }
enum Result<T, E> { Ok(T), Err(E) }

let n = "42".parse::<i32>()?;         // ? propagates Err/None
x.unwrap_or(default);                  // value or default
x.map(|v| v * 2).unwrap_or(0);         // transform + default
match r { Ok(v) => …, Err(e) => … }
fn main() -> Result<(), Box<dyn std::error::Error>> { … }
```

## Collections

```rust,ignore
let v = vec![1, 2, 3];                 // Vec
v.push(4); v.pop(); v[0]; v.get(0);
use std::collections::HashMap;
let mut m = HashMap::new();
m.insert("k", 1);
*m.entry("k").or_insert(0) += 1;       // insert-or-update
let s = String::from("hi"); s.push_str("!");
```

## Generics, traits, lifetimes

```rust,ignore
fn largest<T: PartialOrd>(list: &[T]) -> &T { … }   // trait bound
struct Wrapper<T> { value: T }

trait Summary {
    fn summarize(&self) -> String;                   // required
    fn preview(&self) -> String { … }                // default method
}
impl Summary for Article { … }
fn notify(item: &impl Summary) { … }                 // accept any impl
fn make() -> impl Summary { … }                      // return an impl
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { … }  // lifetime
```

## Closures & iterators

```rust,ignore
let add = |a, b| a + b;
let f = move || println!("{captured}");   // move ownership into closure

v.iter().map(|x| x * 2).filter(|x| x % 2 == 0).collect::<Vec<_>>();
v.iter().sum::<i32>();
v.iter().fold(0, |acc, x| acc + x);
v.iter().any(|&x| x > 5);  .all(…);  .find(…);  .position(…);
(1..=100).filter(|n| n % 3 == 0).sum::<i32>();
```

## Smart pointers & concurrency

```rust,ignore
Box::new(x)                            // heap allocation / recursive types
Rc::new(x); Rc::clone(&a);             // shared ownership (1 thread)
RefCell::new(x); cell.borrow_mut();    // interior mutability (runtime-checked)
Arc::new(Mutex::new(x));               // shared mutable state across threads

use std::thread;
let h = thread::spawn(move || { … });  h.join().unwrap();
let (tx, rx) = std::sync::mpsc::channel();  tx.send(v)?;  rx.recv()?;
```

## Async

```rust,ignore
async fn fetch() -> String { … }
let result = fetch().await;
#[tokio::main] async fn main() { … }
tokio::spawn(async { … });
tokio::join!(a(), b());                // run concurrently
tokio::select! { _ = a => …, _ = b => … }  // race
```

## Modules & crates

```rust,ignore
mod network { pub fn connect() {} }    // define a module
use std::collections::HashMap;         // bring into scope
use crate::network::connect;           // absolute path
pub use internal::Thing;               // re-export
// mod foo;  → loads foo.rs or foo/mod.rs
```

## Common derives & attributes

```rust,ignore
#[derive(Debug, Clone, PartialEq, Eq, Hash, Default, PartialOrd, Ord)]
struct Config { … }

#[test] fn it_works() { assert_eq!(2 + 2, 4); }
#[cfg(test)] mod tests { … }
#[allow(dead_code)]  #[derive(...)]  #[tokio::main]
```

## Cargo commands

```bash
cargo new NAME          # create a project (--lib for a library)
cargo run               # build + run
cargo build --release   # optimized build
cargo check             # fast error-check (no binary)
cargo test              # run tests
cargo add CRATE          # add a dependency
cargo fmt               # format code
cargo clippy            # lint
cargo doc --open        # build & open docs
```

## Formatting

```rust,ignore
println!("{}", x);        // Display
println!("{:?}", x);      // Debug
println!("{:#?}", x);     // pretty Debug
println!("{name}");        // capture a variable inline
println!("{:.2}", pi);    // 2 decimals
println!("{:>8}", s);     // right-align in width 8
println!("{:08b} {:x}", n, n);  // binary (zero-padded), hex
let s = format!("{a}-{b}"); // build a String
```

> [!tip] Keep this page open
> This cheat sheet is deliberately dense — it's a *reminder*, not a tutorial. When you know a construct exists but forget the exact syntax, scan here. For the *why* behind any line, follow it back to its chapter. Print it, pin it, and it'll serve you for years.

> [!key] You've reached the end 🦀
> If you've worked through this book, you now know Rust — from `let` bindings to async runtimes, from ownership to unsafe, from `Vec` to segment trees. You can read real Rust code, write idiomatic programs, choose the right crate, reason about performance, and implement any classic algorithm. **That's a genuinely rare and valuable skill set.** The best next step is to *build something* — a CLI, a web service, a game, a contribution to an open-source crate. The compiler will be your patient teacher, and the community your friendly guide. Welcome to Rust. 🦀

## Summary

- This page condenses the entire language: variables, control flow, ownership, structs/enums, pattern matching, error handling, collections, generics/traits/lifetimes, closures/iterators, smart pointers, concurrency, async, modules, derives, Cargo, and formatting.
- Use it as a **fast lookup**; follow any construct back to its chapter for the full explanation.
- You've completed **The Ultimate Rust Book** — now go build something great.

> [!exercise] Your final challenge
> 1. Without looking, write a complete Rust program (with `cargo new`) that reads numbers from a file, sorts them, and prints statistics — using a struct, error handling with `?`, and iterators.
> 2. Pick one real project from the [projects part](#/ch/project-cli) and build it end to end.
> 3. Find an open-source Rust crate you use, read its source, and open a small pull request. The community is welcoming — jump in! 🦀
