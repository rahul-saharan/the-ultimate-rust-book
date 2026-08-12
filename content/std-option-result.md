<h1><span class="h1-kicker">The Standard Library, Deep</span>Option & Result Methods Reference</h1>

You met `Option` and `Result` back in [error handling](#/ch/result-option). This chapter is the *reference* — a organized catalogue of their many combinator methods, so you can replace verbose `match` blocks with one expressive line. Bookmark it; you'll return often. Every example runs.

## The mental model

Both types are "a value that might be one of two things." `Option<T>` is `Some(T)` or `None`; `Result<T, E>` is `Ok(T)` or `Err(E)`. Their methods let you transform, extract, and chain these without unwrapping manually.

> [!key] Combinators keep the "maybe/might-fail" wrapper on
> The art is to keep working *inside* the `Option`/`Result` for as long as possible — transforming with `map`, chaining with `and_then` — and only extract the value at the very end (with `?`, `match`, or an `unwrap_or*`). This "railway" style is clean and forces you to handle the empty/error case exactly once.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="Two parallel tracks: values flowing along the success track pass through map and and_then, while an error at any point switches to the failure track and skips every remaining step">
  <style>
    .rw-h { font: 700 11.5px var(--font-sans); }
    .rw-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .rw-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .rw-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
    .rw-err { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.6; }
    .rw-op { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <text x="20" y="16" class="rw-h" fill="var(--green)">the success track — Some / Ok</text>
  <line x1="20" y1="52" x2="620" y2="52" stroke="var(--green)" stroke-width="2.5"/>
  <rect x="120" y="36" width="84" height="32" rx="4" class="rw-op"/><text x="136" y="56" class="rw-m">map(f)</text>
  <rect x="250" y="36" width="110" height="32" rx="4" class="rw-op"/><text x="262" y="56" class="rw-m">and_then(g)</text>
  <rect x="406" y="36" width="84" height="32" rx="4" class="rw-op"/><text x="422" y="56" class="rw-m">map(h)</text>
  <rect x="536" y="36" width="84" height="32" rx="4" class="rw-ok"/><text x="550" y="56" class="rw-m">value</text>
  <text x="20" y="196" class="rw-h" fill="var(--red)">the failure track — None / Err</text>
  <line x1="20" y1="164" x2="620" y2="164" stroke="var(--red)" stroke-width="2.5" stroke-dasharray="6 4"/>
  <rect x="536" y="148" width="84" height="32" rx="4" class="rw-err"/><text x="546" y="168" class="rw-m">handled</text>
  <path d="M290 70 C 290 110, 300 120, 300 160" stroke="var(--red)" stroke-width="2" fill="none" marker-end="url(#arr-rail)"/>
  <text x="308" y="120" class="rw-c" fill="var(--red)">g returns None/Err → switch tracks</text>
  <text x="308" y="136" class="rw-c" fill="var(--red)">every later step is SKIPPED</text>
  <text x="20" y="220" class="rw-c">Once on the failure track a value stays there: <tspan font-family="var(--font-mono)">map</tspan> and <tspan font-family="var(--font-mono)">and_then</tspan> do nothing to a <tspan font-family="var(--font-mono)">None</tspan>/<tspan font-family="var(--font-mono)">Err</tspan>.</text>
  <text x="20" y="234" class="rw-c">That is why you only handle the failure <tspan font-style="italic">once</tspan>, at the end — not after every step.</text>
  <defs><marker id="arr-rail" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--red)"/></marker></defs>
</svg>
<figcaption>The <b>railway</b>: combinators operate on the success track, and a failure switches once and skips every remaining step.</figcaption>
</figure>

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

## Combining, flattening, and one-step defaults

The chapter so far covers the methods you reach for daily. These are the next tier — the ones that replace an `if let` or a nested `match` when you spot them:

```rust
fn main() {
    let a: Option<i32> = Some(2);
    let b: Option<&str> = Some("x");

    // Combining two Options.
    println!("zip           {:?}", a.zip(b));               // Some((2, "x"))
    println!("zip w/ None   {:?}", a.zip(None::<&str>));    // None
    println!("or            {:?}", None::<i32>.or(Some(9))); // Some(9)
    println!("xor (both)    {:?}", Some(1).xor(Some(2)));   // None — exactly one, or nothing
    println!("xor (one)     {:?}", Some(1).xor(None::<i32>));

    // map + a default, in ONE call — no unwrap_or afterwards.
    println!("\nmap_or        {}", a.map_or(-1, |x| x * 10));            // 20
    println!("map_or (None) {}", None::<i32>.map_or(-1, |x| x * 10));   // -1
    println!("map_or_else   {}", None::<i32>.map_or_else(|| -2, |x| x)); // -2
    println!("is_some_and   {}", a.is_some_and(|x| x > 1));             // true

    // Un-nesting.
    let nested: Option<Option<i32>> = Some(Some(3));
    println!("\nflatten       {:?}", nested.flatten());                 // Some(3)
    let inner: Result<Option<i32>, String> = Ok(Some(4));
    println!("transpose     {:?}", inner.transpose());                  // Some(Ok(4))

    // Borrowing views — none of these consume the original.
    let owned: Option<String> = Some("hello".into());
    println!("\nas_ref().map  {:?}", owned.as_ref().map(|s| s.len()));  // Some(5)
    println!("as_deref      {:?}", owned.as_deref());                   // Some("hello") as &str
    println!("still usable  {:?}", owned);
    let borrowed: Option<&i32> = Some(&5);
    println!("copied        {:?}", borrowed.copied());                   // Option<i32>

    // An Option IS an iterator of 0 or 1 items.
    println!("\niter().sum()  {}", Some(3).iter().sum::<i32>());
    println!("chain         {:?}", (1..3).chain(Some(9)).collect::<Vec<_>>());
    println!("flatten a Vec {:?}",
        vec![Some(1), None, Some(3)].into_iter().flatten().collect::<Vec<_>>());
}
```

| Method | Use when |
|---|---|
| `zip(other)` | you need **both** values, or nothing |
| `and(other)` / `or(other)` | pick between two, ignoring the other's content |
| `xor(other)` | exactly one must be present |
| `map_or(default, f)` | transform **and** supply a default in one call |
| `map_or_else(d, f)` | same, with a lazily computed default |
| `is_some_and(p)` | "present **and** satisfies this" without nesting |
| `flatten()` | collapse `Option<Option<T>>` |
| `transpose()` | swap `Result<Option<T>, E>` ⇄ `Option<Result<T, E>>` |
| `as_ref()` / `as_mut()` | borrow the inside instead of moving |
| `as_deref()` | `Option<String>` → `Option<&str>` |
| `copied()` / `cloned()` | `Option<&T>` → `Option<T>` |
| `iter()` / `into_iter()` | treat it as a 0-or-1 item iterator |
| `unwrap_err()` | (Result) the error, panicking if it was `Ok` |
| `is_err_and(p)` | (Result) failed **and** the error matches |

### Mutating an `Option` in place

Four methods exist specifically for `Option` fields you own, and they're the standard way to move a value out from behind `&mut self`:

```rust
fn main() {
    // take(): move the value out, leaving None behind.
    let mut slot = Some(1);
    println!("take     {:?}, slot is now {:?}", slot.take(), slot);

    // replace(): swap in a new value, get the old one back.
    let mut slot = Some(1);
    println!("replace  {:?}, slot is now {:?}", slot.replace(9), slot);

    // get_or_insert(): fill it if empty, then borrow it mutably.
    let mut empty: Option<i32> = None;
    *empty.get_or_insert(7) += 1;
    println!("get_or_insert then +1 → {:?}", empty);

    // insert(): always overwrite, and borrow the new value.
    let mut any = Some(1);
    *any.insert(5) *= 2;
    println!("insert 5 then ×2       → {:?}", any);
}
```

> [!key] `Option::take()` is how you move out of `&mut self`
> This is the single most useful method in the list, and you've already seen it twice: it's how [linked lists](#/ch/dsa-linked-list) re-link nodes and how a [`Drop` impl](#/ch/deref-drop) gets ownership of a field it can only borrow. `take()` swaps the value out and leaves `None`, which is always a valid `Option` — so the borrow checker is satisfied and you own the value.
>
> The general pattern is worth naming: when you need to move a value out of a struct you only have `&mut` access to, wrap the field in `Option` and `take()` it, or use `std::mem::take`/`std::mem::replace` for types with a cheap default. There is no way to move out of a `&mut` directly, and this is the idiom that works around it.

## Collecting many Results into one

This is the idiom that turns a loop full of `?` into a single expression, and it surprises people the first time:

```rust
fn main() {
    // collect() into Result<Vec<_>, _> — stops at the FIRST error.
    let all_good: Result<Vec<i32>, _> =
        ["1", "2", "3"].iter().map(|s| s.parse::<i32>()).collect();
    println!("all valid    {:?}", all_good);

    let one_bad: Result<Vec<i32>, _> =
        ["1", "x", "3"].iter().map(|s| s.parse::<i32>()).collect();
    println!("one invalid  {:?}", one_bad.is_err());

    // Option works the same way: any None makes the whole thing None.
    let opts: Option<Vec<i32>> = vec![Some(1), Some(2)].into_iter().collect();
    println!("all Some     {:?}", opts);
    let opts: Option<Vec<i32>> = vec![Some(1), None].into_iter().collect();
    println!("one None     {:?}", opts);

    // Want ALL the errors, not just the first? Partition instead.
    let (ok, failed): (Vec<_>, Vec<_>) = ["1", "x", "3", "y"]
        .iter()
        .map(|s| s.parse::<i32>())
        .partition(|r| r.is_ok());
    println!("\npartition    {} ok, {} failed", ok.len(), failed.len());

    // Or filter_map to just skip the bad ones.
    let valid: Vec<i32> = ["1", "x", "3"].iter().filter_map(|s| s.parse().ok()).collect();
    println!("filter_map   {valid:?}");

    // sum() and product() also short-circuit through Option/Result.
    let total: Option<i32> = [Some(1), Some(2)].into_iter().sum();
    println!("sum          {:?}", total);
    let total: Option<i32> = [Some(1), None].into_iter().sum();
    println!("sum w/ None  {:?}", total);
}
```

> [!key] `Iterator<Item = Result<T, E>>` collects into `Result<Vec<T>, E>`
> One `collect()` turns a sequence of fallible operations into a single `Result` holding either every value or the first error — and it **short-circuits**, so it stops parsing at the first failure rather than doing the remaining work. Same for `Option`. This is usually what you want, and it replaces a whole `for` loop with `?` inside.
>
> The three variations cover the rest: **`partition`** when you need *all* the errors (validating a form, importing a file where you want a full report), **`filter_map(…ok())`** when bad entries should simply be skipped, and **`sum`/`product`** which short-circuit the same way. Choosing between "fail on the first problem" and "collect every problem" is a product decision, and Rust makes both a one-liner.

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
- **Convert** with `ok_or` (Option→Result), `ok`/`err` (Result→Option), and **`transpose`** to swap the nesting.
- **Combine** with `zip` (both or nothing), `xor` (exactly one), and collapse nesting with **`flatten`**.
- **`map_or` / `map_or_else`** transform *and* default in one call; **`is_some_and`** tests presence and a predicate together.
- **Inspect** with `is_some`/`is_ok`; borrow the inside with **`as_ref()`**, **`as_deref()`**, or **`copied()`** to avoid moving.
- **`Option::take()`** is how you move a value out from behind `&mut self` — the linked-list and `Drop` idiom.
- An `Option` **is an iterator** of 0 or 1 items, so `chain`, `flatten`, and `sum` all work on it.
- **`collect()` turns `Iterator<Item = Result<T, E>>` into `Result<Vec<T>, E>`**, short-circuiting at the first error. Use `partition` when you want *every* error, `filter_map(…ok())` to skip bad entries.
- Keep the wrapper on as long as possible (the "railway" style) and extract once at the end — with `?`, `match`, or an `unwrap_or*`.

> [!exercise] Try it yourself
> 1. Take `Some("42")`, use `and_then` with a parse that returns `Option<i32>`, then `map` to double it.
> 2. Rewrite `opt.map(|x| x * 2).unwrap_or(0)` using `map_or`. Which reads better, and how many passes does each make?
> 3. Write a function returning `Option<i32>` that uses `.ok()?` to bridge a parse `Result` into `?` on an `Option`.
> 4. Parse `["1", "2", "oops", "4"]` three ways: `collect` into a `Result`, `partition` to count failures, and `filter_map` to skip them. When would you choose each?
> 5. Add a `println!` inside the parse closure and confirm that `collect` into a `Result` really does **stop** at `"oops"`.
> 6. Use `zip` to combine two `Option`s into an `Option<(A, B)>`, then `map` over the pair. What happens if either is `None`?
> 7. Take an `Option<String>` field out of a struct behind `&mut self` using `take()`. Then try it without `Option` and explain the error.
> 8. Convert `Result<Option<i32>, E>` to `Option<Result<i32, E>>` with `transpose`, and back. When does that nesting actually arise?

Next in the reference: the trait that powers every loop in Rust — a complete look at **`Iterator`**.
