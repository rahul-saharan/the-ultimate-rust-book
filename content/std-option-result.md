<h1><span class="h1-kicker">The Standard Library, Deep</span>Option & Result Methods Reference</h1>

You met `Option` and `Result` back in [error handling](#/ch/result-option). This chapter is the *reference* — a organized catalogue of their many combinator methods, so you can replace verbose `match` blocks with one expressive line. Bookmark it; you'll return often. Every example runs.

## The mental model

Both types are "a value that might be one of two things." `Option<T>` is `Some(T)` or `None`; `Result<T, E>` is `Ok(T)` or `Err(E)`. Their methods let you transform, extract, and chain these without unwrapping manually.

> [!key] Combinators keep the "maybe/might-fail" wrapper on
> The art is to keep working *inside* the `Option`/`Result` for as long as possible — transforming with `map`, chaining with `and_then` — and only extract the value at the very end (with `?`, `match`, or an `unwrap_or*`). This "railway" style is clean and forces you to handle the empty/error case exactly once.

## Extracting the value

```rust
fn main() {
    let some: Option<i32> = Some(5);
    let none: Option<i32> = None;

    println!("{}", some.unwrap_or(0));          // 5   (default on None)
    println!("{}", none.unwrap_or(0));          // 0
    println!("{}", none.unwrap_or_else(|| 1+1));// 2   (lazily computed default)
    println!("{}", none.unwrap_or_default());   // 0   (type's Default)
    println!("{:?}", some.expect("must exist"));// 5   (panics with msg if None)
}
```

| Method | Returns | On empty/error |
|--------|---------|----------------|
| `unwrap()` | inner value | **panics** |
| `expect(msg)` | inner value | **panics** with `msg` |
| `unwrap_or(default)` | inner or `default` | returns `default` |
| `unwrap_or_else(\|\| …)` | inner or computed | runs the closure |
| `unwrap_or_default()` | inner or `T::default()` | zero value |

## Transforming the inner value

```rust
fn main() {
    let n: Option<i32> = Some(4);

    println!("{:?}", n.map(|x| x * 2));            // Some(8)
    println!("{:?}", n.map(|x| x * 2).unwrap_or(0)); // 8
    println!("{:?}", n.filter(|&x| x > 10));       // None (didn't pass)
    println!("{:?}", n.and_then(halve));            // Some(2)
    println!("{:?}", Some(3).and_then(halve));      // None (3 is odd)

    // Result: map transforms Ok, map_err transforms Err:
    let r: Result<i32, String> = Ok(10);
    println!("{:?}", r.map(|x| x + 1));             // Ok(11)
    let e: Result<i32, String> = Err("boom".into());
    println!("{:?}", e.map_err(|s| s.len()));       // Err(4)
}

fn halve(x: i32) -> Option<i32> {
    if x % 2 == 0 { Some(x / 2) } else { None }
}
```

| Method | Does |
|--------|------|
| `map(f)` | transform the `Some`/`Ok` value |
| `map_err(f)` | (Result) transform the `Err` value |
| `and_then(f)` | chain another `Option`/`Result`-returning op (aka *flatMap*) |
| `filter(p)` | (Option) keep `Some` only if predicate holds |
| `or(other)` / `or_else(f)` | fall back to another `Option`/`Result` |
| `unwrap_or(v)` | extract with a default |

> [!tip] `map` vs `and_then`
> Use **`map`** when your function returns a plain value (`x -> y`): `Some(4).map(|x| x*2)` gives `Some(8)`. Use **`and_then`** when your function *itself* returns an `Option`/`Result` (`x -> Option<y>`): it flattens, so you get `Some(2)` not `Some(Some(2))`. Rule: if mapping would give you a nested `Option<Option<T>>`, you wanted `and_then`.

## Converting between Option and Result

They interconvert cleanly, which matters when using `?`:

```rust
fn main() {
    let opt: Option<i32> = Some(5);
    let none: Option<i32> = None;

    // Option → Result (supply the error for None):
    let r: Result<i32, &str> = opt.ok_or("was none");
    println!("{r:?}"); // Ok(5)
    println!("{:?}", none.ok_or("was none")); // Err("was none")

    // Result → Option (discard the error):
    let res: Result<i32, String> = Ok(10);
    println!("{:?}", res.ok()); // Some(10)
}
```

| Method | Converts |
|--------|----------|
| `Option::ok_or(err)` | `Option<T>` → `Result<T, E>` |
| `Option::ok_or_else(f)` | same, error computed lazily |
| `Result::ok()` | `Result<T, E>` → `Option<T>` (drops error) |
| `Result::err()` | `Result<T, E>` → `Option<E>` |

## Inspecting without consuming

```rust
fn main() {
    let x: Option<i32> = Some(7);
    println!("{}", x.is_some());       // true
    println!("{}", x.is_none());       // false
    println!("{:?}", x.as_ref());      // Some(&7) — borrow the inner value

    let r: Result<i32, String> = Ok(1);
    println!("{} {}", r.is_ok(), r.is_err()); // true false
}
```

> [!best] `as_ref()` to avoid moving out
> Calling a consuming method like `map` on an `Option<String>` you own would *move* it. When you only want to peek or transform *by reference*, call **`.as_ref()`** first: `opt.as_ref().map(|s| s.len())` borrows the string instead of moving it, leaving `opt` usable afterward.

## The `?` operator ties it together

Combinators shine, but for propagating errors up a call stack, the [`?` operator](#/ch/question-mark) is still king — and it works on both types:

```rust
fn parse_and_double(s: &str) -> Option<i32> {
    let n = s.parse::<i32>().ok()?; // Result → Option via .ok(), then ? on Option
    Some(n * 2)
}

fn main() {
    println!("{:?}", parse_and_double("21")); // Some(42)
    println!("{:?}", parse_and_double("x"));   // None
}
```

## Summary

- **Extract** with `unwrap_or`, `unwrap_or_else`, `unwrap_or_default`, or (in real code sparingly) `expect`.
- **Transform** with `map` (plain function), `and_then` (chains another `Option`/`Result` — flattens), `map_err`, `filter`, `or`/`or_else`.
- **Convert** with `ok_or` (Option→Result), `ok`/`err` (Result→Option).
- **Inspect** with `is_some`/`is_ok` and borrow the inside with **`as_ref()`** to avoid moving.
- Keep the wrapper on as long as possible (the "railway" style) and extract once at the end — with `?`, `match`, or an `unwrap_or*`.

> [!exercise] Try it yourself
> 1. Take `Some("42")`, use `and_then` with a parse that returns `Option<i32>`, then `map` to double it.
> 2. Convert a `Some(5)` and a `None` to `Result` with `ok_or("missing")` and print both.
> 3. Write a function returning `Option<i32>` that uses `.ok()?` to bridge a parse `Result` into `?` on an `Option`.

Next in the reference: the trait that powers every loop in Rust — a complete look at **`Iterator`**.
