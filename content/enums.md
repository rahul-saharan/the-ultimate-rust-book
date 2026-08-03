<h1><span class="h1-kicker">Structuring Data</span>Enums</h1>

If structs model "a thing that has *all* of these parts," enums model "a thing that is *one of* these possibilities." An **enum** (short for *enumeration*) is a type whose value is exactly one of a fixed set of **variants**. This sounds simple, but Rust's enums are extraordinarily powerful — each variant can carry its own data — and they're the foundation of some of the language's best ideas, including how Rust abolishes `null` and how it models errors. By the end of this chapter you'll reach for enums constantly.

## Defining an enum

Say an IP address is either version 4 or version 6 — never both, never neither. That's a perfect enum:

```rust
#[derive(Debug)]
enum IpKind {
    V4,
    V6,
}

fn main() {
    let home = IpKind::V4;
    let loopback = IpKind::V6;
    println!("{home:?} and {loopback:?}");
}
```

`IpKind::V4` and `IpKind::V6` are the two possible values. The `::` reaches into the enum to name a variant.

> [!jargon] Variant
> A **variant** is one of the possible forms an enum value can take. An `IpKind` value is *either* `V4` *or* `V6` — those are its two variants. A value is always exactly one variant at a time, never more, never fewer.

## Variants can hold data — the superpower

Here's what makes Rust enums special: each variant can carry its own data, and different variants can carry *different* types and amounts of data. This lets you pack "what kind it is" and "its associated data" into a single, tidy type:

```rust
#[derive(Debug)]
enum IpAddr {
    V4(u8, u8, u8, u8),  // four bytes
    V6(String),          // a string
}

fn main() {
    let home = IpAddr::V4(127, 0, 0, 1);
    let loopback = IpAddr::V6(String::from("::1"));
    println!("{home:?}");     // V4(127, 0, 0, 1)
    println!("{loopback:?}"); // V6("::1")
}
```

Variants can hold data in any shape — like tuple structs, or even like named-field structs:

```rust
#[derive(Debug)]
enum Message {
    Quit,                       // no data
    Move { x: i32, y: i32 },    // named fields, like a struct
    Write(String),              // a single string
    ChangeColor(i32, i32, i32), // three ints
}

fn main() {
    let msgs = [
        Message::Quit,
        Message::Move { x: 10, y: 20 },
        Message::Write(String::from("hello")),
        Message::ChangeColor(255, 0, 0),
    ];
    for m in &msgs {
        println!("{m:?}");
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="A Message value is exactly one of four variants, each carrying different data">
  <style>
    .em { font: 700 12px var(--font-sans); }
    .emm { font: 600 11px var(--font-mono); fill: var(--text); }
    .emc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .v1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .v2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .v3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .v4 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="em" fill="var(--text)">enum Message  —  a value is EXACTLY ONE of:</text>
  <rect x="20" y="38" width="140" height="56" rx="8" class="v1"/><text x="34" y="62" class="emm">Quit</text><text x="34" y="82" class="emc">(no data)</text>
  <rect x="172" y="38" width="150" height="56" rx="8" class="v2"/><text x="186" y="62" class="emm">Move</text><text x="186" y="82" class="emc">{ x: i32, y: i32 }</text>
  <rect x="334" y="38" width="140" height="56" rx="8" class="v3"/><text x="348" y="62" class="emm">Write</text><text x="348" y="82" class="emc">(String)</text>
  <rect x="486" y="38" width="134" height="56" rx="8" class="v4"/><text x="500" y="62" class="emm">ChangeColor</text><text x="500" y="82" class="emc">(i32,i32,i32)</text>
  <text x="20" y="130" class="emc">One type, four shapes. The compiler tracks which variant you have and forces you to handle each one.</text>
</svg>
<figcaption>An enum unifies several related shapes under one type — and each value is precisely one variant.</figcaption>
</figure>

You can attach methods to an enum with `impl`, just like a struct:

```rust
# enum Message { Quit, Write(String), Move { x: i32, y: i32 }, ChangeColor(i32,i32,i32) }
impl Message {
    fn describe(&self) -> &str {
        match self {
            Message::Quit => "quitting",
            Message::Move { .. } => "moving",
            Message::Write(_) => "writing text",
            Message::ChangeColor(..) => "changing color",
        }
    }
}

fn main() {
    let m = Message::Write(String::from("hi"));
    println!("This message is {}", m.describe());
}
```

## How an enum is stored in memory

It helps to picture what an enum actually *is* in memory, because it explains both its size and its safety. Every enum value is stored as two parts side by side: a small **tag** (also called the *discriminant*) that records *which* variant this is, followed by enough space to hold the data of the **largest** variant. The tag is how the program knows, at runtime, which variant it's looking at.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="An enum value in memory is a tag identifying the variant, followed by a payload area sized for the largest variant">
  <style>
    .mm-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .mm-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tag { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .pay { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .unused { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="20" y="22" class="mm-c">enum Shape { Circle(f64), Rectangle { w: f64, h: f64 }, Empty }</text>
  <text x="20" y="52" class="mm-b" fill="var(--text-mute)">Rectangle:</text>
  <rect x="120" y="38" width="60" height="30" class="tag"/><text x="132" y="58" class="mm-b">tag</text>
  <rect x="180" y="38" width="130" height="30" class="pay"/><text x="196" y="58" class="mm-b">w: f64</text>
  <rect x="310" y="38" width="130" height="30" class="pay"/><text x="326" y="58" class="mm-b">h: f64</text>
  <text x="20" y="98" class="mm-b" fill="var(--text-mute)">Circle:</text>
  <rect x="120" y="84" width="60" height="30" class="tag"/><text x="132" y="104" class="mm-b">tag</text>
  <rect x="180" y="84" width="130" height="30" class="pay"/><text x="192" y="104" class="mm-b">radius: f64</text>
  <rect x="310" y="84" width="130" height="30" class="unused"/><text x="326" y="104" class="mm-c">unused</text>
  <text x="20" y="140" class="mm-c">Both are the same size: tag + room for the biggest variant. The tag says which one is live.</text>
</svg>
<figcaption>An enum = tag + payload sized for its largest variant. Smaller variants leave the extra room unused.</figcaption>
</figure>

```rust
use std::mem::size_of;

enum Shape {
    Circle(f64),                  // 8 bytes of payload
    Rectangle { w: f64, h: f64 }, // 16 bytes — the largest variant
    Empty,                        // no payload
}

fn main() {
    // Size = space for the largest variant + the tag (rounded up for alignment):
    println!("Shape        = {} bytes", size_of::<Shape>());        // 24
    println!("f64          = {} bytes", size_of::<f64>());          // 8

    // Sometimes the tag is FREE: Rust reuses impossible bit-patterns ("niche optimization").
    // A bool only uses 2 of its 256 possible byte values, so Option<bool> needs no extra tag:
    println!("bool         = {} bytes", size_of::<bool>());         // 1
    println!("Option<bool> = {} bytes", size_of::<Option<bool>>()); // 1 — same!
}
```

> [!deep] Why enums are "sum types"
> A struct holds *all* its fields at once, so its number of possible values is the *product* of its fields' — that's why structs are called **product types**. An enum is *one* variant at a time, so its number of possible values is the *sum* of its variants' — a **sum type**. `Option<bool>` has `1 (None) + 2 (Some true/false) = 3` possible values. Getting this count to match reality — no impossible states, no missing ones — is the essence of good data modeling, which is our next topic.

## Modeling with enums: make illegal states impossible

This is the mindset shift that makes enums so valued in Rust. Suppose you're tracking a network connection. A tempting first attempt uses a couple of booleans:

```rust,ignore
// ❌ Fragile: two bools give 2×2 = 4 combinations, but some are nonsense.
struct Connection {
    is_connected: bool,
    is_loading: bool,
}
// What does { is_connected: true, is_loading: true } mean? Nothing valid — yet
// nothing stops you writing it, and every reader must guess. Bugs live here.
```

An enum lets you write down *exactly* the states that can really occur — and then the impossible ones simply cannot be constructed:

<figure class="diagram">
<svg viewBox="0 0 660 150" role="img" aria-label="Two booleans allow four combinations, two of which are invalid; an enum encodes exactly the valid states with no invalid ones">
  <style>
    .is-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .is-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .is-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .ok  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
    .bad { fill: var(--red-soft);   stroke: var(--red);   stroke-width: 1.3; }
    .en  { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.3; }
  </style>
  <text x="20" y="20" class="is-h" fill="var(--red)">Two bools → 4 combos (2 invalid)</text>
  <rect x="20"  y="30" width="130" height="24" class="ok"/><text x="30" y="47" class="is-b">F,F disconnected</text>
  <rect x="20"  y="58" width="130" height="24" class="ok"/><text x="30" y="75" class="is-b">T,F connected</text>
  <rect x="20"  y="86" width="130" height="24" class="bad"/><text x="30" y="103" class="is-b">F,T ??? invalid</text>
  <rect x="20"  y="114" width="130" height="24" class="bad"/><text x="30" y="131" class="is-b">T,T ??? invalid</text>
  <text x="360" y="20" class="is-h" fill="var(--blue)">Enum → exactly the valid states</text>
  <rect x="360" y="30" width="150" height="24" class="en"/><text x="370" y="47" class="is-b">Disconnected</text>
  <rect x="360" y="58" width="150" height="24" class="en"/><text x="370" y="75" class="is-b">Connecting</text>
  <rect x="360" y="86" width="220" height="24" class="en"/><text x="370" y="103" class="is-b">Connected { session_id }</text>
  <rect x="360" y="114" width="220" height="24" class="en"/><text x="370" y="131" class="is-b">Failed(reason)</text>
</svg>
<figcaption>Booleans let you write states that make no sense; an enum lets you write down only the ones that can truly happen.</figcaption>
</figure>

```rust
#[derive(Debug)]
enum Connection {
    Disconnected,
    Connecting,
    Connected { session_id: u32 }, // only THIS state carries a session id
    Failed(String),                 // only THIS state carries an error message
}

fn status_line(c: &Connection) -> String {
    match c {
        Connection::Disconnected => "offline".to_string(),
        Connection::Connecting => "dialing…".to_string(),
        Connection::Connected { session_id } => format!("online (session {session_id})"),
        Connection::Failed(reason) => format!("failed: {reason}"),
    }
}

fn main() {
    for c in [
        Connection::Disconnected,
        Connection::Connecting,
        Connection::Connected { session_id: 42 },
        Connection::Failed("timeout".into()),
    ] {
        println!("{}", status_line(&c));
    }
}
```

> [!best] Make illegal states unrepresentable
> Notice that the `session_id` exists *only* in the `Connected` variant and the error message *only* in `Failed` — you can't have a session id while disconnected, because there's nowhere to put it. This is a Rust superpower: design your enums so the compiler rejects impossible states at *compile time*. If you find yourself writing "this field only matters when that flag is set," you probably want an enum.

## C-like enums and discriminants

If none of your variants carry data, an enum is just a set of named constants — like C's `enum`. You can pin each variant to a specific integer and cast to it with `as`, which is handy for protocol codes, status values, and C interop:

```rust
#[derive(Debug, Clone, Copy)]
enum HttpStatus {
    Ok = 200,
    NotFound = 404,
    ServerError = 500,
}

fn main() {
    let s = HttpStatus::NotFound;
    println!("{s:?} is code {}", s as u16);              // NotFound is code 404
    println!("server error = {}", HttpStatus::ServerError as u16); // 500
}
```

## A useful pattern: state machines

Enums are the natural way to write a **state machine** — a value that moves between a fixed set of states following clear rules. A method that maps the current state to the next one *is* the machine. Because `match` must cover every variant, you can never forget a transition.

<figure class="diagram">
<svg viewBox="0 0 520 170" role="img" aria-label="A traffic light state machine cycles Red to Green to Yellow and back to Red">
  <style>
    .sm-b { font: 700 12px var(--font-mono); fill: #fff; }
    .sm-c { font: 11px var(--font-sans); fill: var(--text-mute); }
  </style>
  <circle cx="90"  cy="80" r="34" fill="var(--red)"/><text x="72" y="85" class="sm-b">Red</text>
  <circle cx="260" cy="80" r="34" fill="var(--green)"/><text x="238" y="85" class="sm-b">Green</text>
  <circle cx="430" cy="80" r="34" fill="var(--amber)"/><text x="404" y="85" class="sm-b">Yellow</text>
  <path d="M126 72 L222 72" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#sma)"/>
  <path d="M296 80 L392 80" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#sma)"/>
  <path d="M424 116 C 300 165, 180 165, 92 118" stroke="var(--text-mute)" stroke-width="1.6" fill="none" marker-end="url(#sma)"/>
  <text x="150" y="62" class="sm-c">next</text>
  <text x="322" y="70" class="sm-c">next</text>
  <text x="230" y="158" class="sm-c">next (wraps around)</text>
  <defs><marker id="sma" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>A traffic light: three states, one transition rule. The <code>next</code> method is the whole machine.</figcaption>
</figure>

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
enum Light {
    Red,
    Green,
    Yellow,
}

impl Light {
    fn next(self) -> Light {          // the transition function
        match self {
            Light::Red => Light::Green,
            Light::Green => Light::Yellow,
            Light::Yellow => Light::Red,
        }
    }
}

fn main() {
    let mut light = Light::Red;
    for _ in 0..5 {
        print!("{light:?} → ");
        light = light.next();
    }
    println!("{light:?}");
    // Red → Green → Yellow → Red → Green → Yellow
}
```

## Recursive and generic enums

Because a variant can hold *any* type, it can even hold *another value of the same enum* — a **recursive** enum. This is how you build trees and expressions. The one rule: the recursive part must sit behind a pointer like [`Box`](#/ch/box), so the compiler can compute a fixed size (an infinitely-nested value would otherwise be infinitely large). Here is a tiny math-expression evaluator — a classic use of enums:

```rust
#[derive(Debug)]
enum Expr {
    Num(f64),
    Add(Box<Expr>, Box<Expr>), // an Expr made of two smaller Exprs
    Mul(Box<Expr>, Box<Expr>),
}

impl Expr {
    fn eval(&self) -> f64 {
        match self {
            Expr::Num(n) => *n,
            Expr::Add(a, b) => a.eval() + b.eval(), // recurse into each side
            Expr::Mul(a, b) => a.eval() * b.eval(),
        }
    }
}

fn main() {
    // Build the tree for (2 + 3) * 4:
    let tree = Expr::Mul(
        Box::new(Expr::Add(Box::new(Expr::Num(2.0)), Box::new(Expr::Num(3.0)))),
        Box::new(Expr::Num(4.0)),
    );
    println!("(2 + 3) * 4 = {}", tree.eval()); // 20
}
```

Enums can also be **generic** — parameterized by a type. In fact `Option<T>` and `Result<T, E>` (below) are just generic enums from the standard library. You can write your own:

```rust
#[derive(Debug)]
enum Either<L, R> {   // holds a value of one of two types
    Left(L),
    Right(R),
}

fn main() {
    let a: Either<i32, String> = Either::Left(10);
    let b: Either<i32, String> = Either::Right("hello".into());
    println!("{a:?} / {b:?}");
}
```

## `Option`: how Rust kills the billion-dollar mistake

Many languages have `null` — a special "no value here" value. The trouble is that *any* value might secretly be `null`, so you constantly risk the dreaded null-pointer crash. Rust simply **has no null**. Instead, the possibility of absence is expressed with a normal generic enum from the standard library, **`Option<T>`**:

```rust,ignore
enum Option<T> {
    Some(T), // there IS a value, and here it is
    None,    // there is NO value
}
```

The `<T>` means it works for any type. `Some` and `None` are so common they're available everywhere without any import:

```rust
fn main() {
    let some_number = Some(5);        // Option<i32>
    let some_text = Some("a string"); // Option<&str>
    let nothing: Option<i32> = None;  // must annotate: nothing to infer from

    println!("{some_number:?}, {some_text:?}, {nothing:?}");
}
```

> [!history] The billion-dollar mistake
> Tony Hoare, who invented the null reference in 1965, later called it his *"billion-dollar mistake,"* estimating the cost of all the crashes and vulnerabilities it caused. Rust learned the lesson: because there's no null, a value of type `String` is *always* a real string. When something might be missing, its type is `Option<String>` — and the compiler **forces** you to handle the `None` case. The null crash is designed out of existence.

> [!key] Why `Option` is safer than null
> The magic is that `Option<T>` and `T` are **different types**. You can't accidentally use an `Option<i32>` where an `i32` is expected — the compiler stops you and makes you deal with the `None` case first. The "did you check for missing?" question is answered at compile time, everywhere, automatically.

## `Option`'s cousin: `Result`

The other enum you'll use every day is **`Result<T, E>`**, which models an operation that can **succeed or fail**: `Ok(T)` carries the success value, `Err(E)` carries the error. It's the same idea as `Option`, but the "nothing" case carries a *reason*. Any function that can fail returns a `Result`:

```rust
#[derive(Debug)]
enum Grade { Pass, Fail }

fn grade(score: i32) -> Result<Grade, String> {
    if !(0..=100).contains(&score) {
        Err(format!("score {score} is out of range"))
    } else if score >= 50 {
        Ok(Grade::Pass)
    } else {
        Ok(Grade::Fail)
    }
}

fn main() {
    println!("{:?}", grade(72));  // Ok(Pass)
    println!("{:?}", grade(30));  // Ok(Fail)
    println!("{:?}", grade(150)); // Err("score 150 is out of range")
}
```

`Option` and `Result` are the backbone of Rust error handling — we give them a whole [reference chapter](#/ch/result-option).

## Getting the value out

To use the value inside an enum like `Option`, you have to handle *every* case. The most explicit way is `match` (the star of the [next chapter](#/ch/pattern-matching)):

```rust
fn main() {
    let maybe_age: Option<u32> = Some(30);

    let message = match maybe_age {
        Some(age) => format!("You are {age} years old"),
        None => String::from("Age unknown"),
    };
    println!("{message}");
}
```

When you care about just *one* variant, `match` is heavy. `if let` runs code for a single pattern, and **`let … else`** binds the value or bails out early — a clean way to handle the "missing" case at the top of a function:

```rust
fn main() {
    let config: Option<u16> = Some(8080);

    // if let: do something only when it matches Some:
    if let Some(port) = config {
        println!("configured port: {port}");
    }

    // let ... else: bind `port`, or take the else branch and leave:
    let Some(port) = config else {
        println!("no port set; giving up");
        return;
    };
    println!("binding to :{port}"); // `port` is available for the rest of the function
}
```

For everyday transformations, `Option` (and `Result`) also carry dozens of convenient methods so you don't always need a full `match`:

```rust
fn main() {
    let x = Some(5);

    println!("{:?}", x.map(|n| n * 2)); // transform if present → Some(10)

    let y: Option<i32> = None;
    println!("{}", y.unwrap_or(0));     // fallback for None → 0

    println!("{}", x.is_some());        // true
    println!("{}", x.unwrap_or(-1));    // 5
}
```

> [!mistake] Don't reach for `.unwrap()` in real code
> `.unwrap()` extracts the value but **panics (crashes) if it's `None`/`Err`**. It's fine for quick experiments and examples, but in real programs it's a landmine. Prefer `match`, `if let`, `let … else`, or safe combinators like `unwrap_or`, `unwrap_or_else`, and `map`. We devote a whole [chapter](#/ch/result-option) to doing this well. Treat a bare `.unwrap()` as a "TODO: handle this properly."

## Summary

- An **enum** is a type whose value is exactly **one of a fixed set of variants** — a **sum type**.
- Each variant can **carry its own data**, in any shape (tuple-like, struct-like, or none) — this is what makes Rust enums so expressive.
- In memory, an enum is a **tag** (which variant) plus room for the **largest** variant; sometimes the tag is free thanks to **niche optimization**.
- Use enums to **make illegal states unrepresentable** — put data only in the variant where it makes sense, and the compiler rejects the impossible combinations for you.
- Enums shine for **state machines**, and can be **recursive** (trees/expressions, via `Box`) and **generic** (`Option`, `Result`, your own).
- Rust has **no null**: absence is `Option<T>` (`Some`/`None`); fallibility is `Result<T, E>` (`Ok`/`Err`). Because these are distinct types, the compiler forces you to handle every case.
- Extract values with `match`, `if let`, `let … else`, or combinators like `map`/`unwrap_or`; avoid bare `.unwrap()` in real code.

> [!exercise] Try it yourself
> 1. Define `enum Shape { Circle(f64), Rectangle(f64, f64) }` and a method `area(&self) -> f64` using `match`.
> 2. Model a simple `enum TrafficAction { Go, Slow, Stop }` and write a function that maps a `Light` (from this chapter) to the action a driver should take.
> 3. Write `fn divide(a: f64, b: f64) -> Option<f64>` that returns `None` when `b == 0.0`, and handle both cases with `match`.
> 4. Extend the `Expr` evaluator with a `Sub(Box<Expr>, Box<Expr>)` variant — the compiler will point you at the `match` you must update.
> 5. Model a vending machine as an enum state machine (`Idle`, `CoinInserted(u32)`, `Dispensing`) with a `next` method.

Enums are only half the story — their true power is unlocked by the tool that inspects them. Next up: **pattern matching**, one of the most satisfying features in all of Rust.
