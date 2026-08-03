<h1><span class="h1-kicker">Advanced Rust</span>Function Pointers & Returning Closures</h1>

You know [closures](#/ch/closures) and how to accept them with `Fn`/`FnMut`/`FnOnce` bounds. This short chapter fills in the rest of Rust's "code as data" story: passing plain **function pointers**, the neat trick of using enum constructors as functions, and the two ways to **return** a closure from a function. These patterns show up constantly in iterator-heavy code.

## Function pointers: `fn`

Besides closures, you can pass regular functions directly, using the **function pointer** type `fn` (lowercase — distinct from the `Fn` *trait*). A `fn` is a bare pointer to a function, with no captured environment:

```rust
fn add_one(x: i32) -> i32 {
    x + 1
}

// `f: fn(i32) -> i32` is a function-pointer parameter:
fn do_twice(f: fn(i32) -> i32, arg: i32) -> i32 {
    f(arg) + f(arg)
}

fn main() {
    let answer = do_twice(add_one, 5); // pass the function by name
    println!("{answer}"); // (5+1) + (5+1) = 12
}
```

> [!jargon] `fn` (the pointer) vs. `Fn` (the trait)
> Lowercase **`fn`** is a concrete *type*: a pointer to a function. Capitalized **`Fn`** (and `FnMut`, `FnOnce`) are *traits* that both functions *and* closures implement. A function pointer implements all three `Fn` traits, so anywhere a closure is accepted, you can pass a plain function too — but not vice versa (a closure that captures variables isn't a bare `fn`).

Because `fn` implements the `Fn` traits, you can pass a named function to any closure-accepting method — sometimes cleaner than a closure:

```rust
fn main() {
    let numbers = vec![1, 2, 3];

    // A closure…
    let strings1: Vec<String> = numbers.iter().map(|n| n.to_string()).collect();
    // …or the function directly (no closure needed):
    let strings2: Vec<String> = numbers.iter().map(ToString::to_string).collect();

    println!("{strings1:?} == {strings2:?}");
}
```

## Enum constructors are functions too

A neat consequence: each tuple-like enum variant (and tuple struct) is *implemented as a function* that constructs the value. So you can pass a variant name where a function is expected:

```rust
#[derive(Debug)]
enum Status {
    Active(u32),
}

fn main() {
    // Status::Active is a function `fn(u32) -> Status`, so map can use it directly:
    let statuses: Vec<Status> = (1..=3).map(Status::Active).collect();
    println!("{statuses:?}"); // [Active(1), Active(2), Active(3)]
}
```

## Returning closures

A function often needs to *return* a closure — a factory that builds behavior. But closures have anonymous, un-nameable types, so you can't write the return type directly. Two solutions:

### `impl Fn` — one concrete closure

If your function returns a *single* closure type, **`impl Fn(...)`** is the clean, zero-cost choice (static dispatch):

```rust
fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n // `move` so the closure owns `n`
}

fn main() {
    let add_five = make_adder(5);
    let add_ten = make_adder(10);
    println!("{} {}", add_five(100), add_ten(100)); // 105 110
}
```

### `Box<dyn Fn>` — when the type varies

`impl Fn` returns *one* type, so you can't return different closures from different branches. When you need that, box a trait object — **`Box<dyn Fn(...)>`** (dynamic dispatch):

```rust
// Different branches return different closures → must box them:
fn make_op(kind: &str) -> Box<dyn Fn(i32) -> i32> {
    match kind {
        "double" => Box::new(|x| x * 2),
        "negate" => Box::new(|x| -x),
        _ => Box::new(|x| x), // identity
    }
}

fn main() {
    let ops = ["double", "negate", "identity"];
    for kind in ops {
        let op = make_op(kind);
        println!("{kind}: {}", op(21));
    }
}
```

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="impl Fn returns one closure type with static dispatch; Box dyn Fn allows different closures with dynamic dispatch">
  <style>
    .afh { font: 700 12px var(--font-sans); }
    .afm { font: 600 11px var(--font-mono); fill: var(--text); }
    .afc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .s1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .s2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="16" y="20" width="296" height="100" rx="10" class="s1"/>
  <text x="30" y="44" class="afm" fill="var(--rust-600)">-&gt; impl Fn(i32) -&gt; i32</text>
  <text x="30" y="68" class="afc">ONE closure type. Static dispatch,</text>
  <text x="30" y="86" class="afc">inlinable, zero cost. No allocation.</text>
  <text x="30" y="108" class="afc">✅ Default choice.</text>
  <rect x="328" y="20" width="296" height="100" rx="10" class="s2"/>
  <text x="342" y="44" class="afm" fill="var(--blue)">-&gt; Box&lt;dyn Fn(i32)-&gt;i32&gt;</text>
  <text x="342" y="68" class="afc">DIFFERENT closures per branch.</text>
  <text x="342" y="86" class="afc">Dynamic dispatch + heap allocation.</text>
  <text x="342" y="108" class="afc">✅ When the type must vary.</text>
</svg>
<figcaption>Return <code>impl Fn</code> for a single closure type (fast); <code>Box&lt;dyn Fn&gt;</code> when different branches return different closures.</figcaption>
</figure>

> [!best] Reach for `impl Fn` first
> Use **`impl Fn`** to return a closure whenever you can — it's zero-cost (static dispatch, no allocation) and usually all you need. Fall back to **`Box<dyn Fn>`** only when you genuinely must return *different* closure types (e.g. chosen at runtime, or stored together in a collection). This mirrors the [static vs. dynamic dispatch](#/ch/trait-objects) trade-off you already know.

> [!note] `move` is usually required when returning closures
> A returned closure outlives the function that created it, so it can't *borrow* the function's locals — it must **own** them. That's why `make_adder` uses `move |x| x + n`: without `move`, the closure would try to borrow `n`, which is gone once the function returns. Same reasoning as `move` closures for [threads](#/ch/threads).

## Summary

- **`fn`** (lowercase) is the **function-pointer type**; **`Fn`/`FnMut`/`FnOnce`** (capitalized) are **traits** implemented by both functions and closures.
- A function pointer implements the `Fn` traits, so you can pass a named function (or an **enum/tuple-struct constructor**, which *is* a function) anywhere a closure is expected.
- **Return a closure** with **`impl Fn(...)`** for a single concrete type (static, zero-cost) or **`Box<dyn Fn(...)>`** when different branches return different closures (dynamic dispatch).
- Returned closures almost always need **`move`**, since they outlive the function and must own their captures.

> [!exercise] Try it yourself
> 1. Write `fn apply_all(fs: &[fn(i32) -> i32], x: i32) -> Vec<i32>` and call it with an array of named functions.
> 2. Write `make_multiplier(n) -> impl Fn(i32) -> i32`, then rewrite a version returning `Box<dyn Fn>` that picks `*` or `+` based on a `&str` argument.
> 3. Use an enum tuple variant as a constructor function in a `.map(...)` call.

The final advanced topic is talking to the outside world in other languages — **FFI**.
