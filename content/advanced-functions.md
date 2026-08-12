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

Since the chapter leans on those traits throughout, here they are side by side:

| Bound | The closure may… | Callable | Implemented by |
|---|---|---|---|
| `FnOnce` | consume its captures | **once** | every closure, and `fn` |
| `FnMut` | mutate its captures | repeatedly | closures that don't consume, and `fn` |
| `Fn` | only read its captures | repeatedly, concurrently | closures that only borrow, and `fn` |
| `fn` (the type) | capture **nothing** | repeatedly | plain functions, non-capturing closures |

The traits nest: every `Fn` is also an `FnMut`, and every `FnMut` is also an `FnOnce`. So **take the loosest bound your code needs** — `FnOnce` accepts the most callers, `Fn` the fewest.

> [!tip] A closure that captures nothing *does* coerce to `fn`
> The "not vice versa" above has a useful exception. A closure with an empty capture list is compiled to an ordinary function, so it converts to a function pointer implicitly:
> ```rust
> fn main() {
>     let f: fn(i32) -> i32 = |x| x + 1; // no captures → coerces to fn
>     println!("{}", f(41));
>
>     // Which is why a non-capturing closure can go where `fn` is required:
>     fn apply(g: fn(i32) -> i32, v: i32) -> i32 { g(v) }
>     println!("{}", apply(|x| x * 2, 21));
> }
> ```
> The moment it captures anything, that stops working — the closure now carries data, and a bare pointer has nowhere to put it. Sizes make this concrete: a non-capturing closure is **0 bytes**, one capturing an `i32` is **4 bytes**, and a `fn` pointer is **8 bytes** (with `Option<fn(..)>` also 8, thanks to the null niche).

> [!mistake] "different fn items have unique types"
> Every named function has its own unique, zero-sized *item* type — `add_one` is not of type `fn(i32) -> i32`, it's of an unnameable type that *coerces* to one. Usually inference handles it, but reassignment exposes the difference:
> ```rust,ignore
> let mut f = add_one;
> f = sub_one;  // ❌ error[E0308]: expected fn item, found a different fn item
>               //    note: different fn items have unique types, even if
>               //          their signatures are the same
> ```
> ✅ Fix: annotate the variable so both coerce to the same pointer type — `let mut f: fn(i32) -> i32 = add_one;` — or cast with `add_one as fn(i32) -> i32`. (An array literal like `[add_one, sub_one]` infers the pointer type for you, so it works without help.)

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

#[derive(Debug)]
struct Meters(f64); // a tuple struct is a constructor function too

fn main() {
    // Status::Active is a function `fn(u32) -> Status`, so map can use it directly:
    let statuses: Vec<Status> = (1..=3).map(Status::Active).collect();
    println!("{statuses:?}"); // [Active(1), Active(2), Active(3)]

    let distances: Vec<Meters> = [1.5, 2.5].into_iter().map(Meters).collect();
    println!("{distances:?}");

    // `Some` and `Ok` are just tuple variants, so the same trick applies —
    // and it reads better than `.map(|n| Some(n))`.
    let wrapped: Vec<Option<i32>> = (1..=3).map(Some).collect();
    let results: Vec<Result<i32, String>> = (1..=3).map(Ok).collect();
    println!("{wrapped:?}");
    println!("{results:?}");
}
```

> [!tip] This is why `.map(Some)` and `.ok_or_else(Vec::new)` read so cleanly
> Anywhere a one-argument function is expected, a constructor name works: `.map(Some)`, `.map(Box::new)`, `.map(String::from)`, `.map(Meters)`. And for zero-argument cases, a path like `Vec::new` or `String::new` is a function too — hence `.unwrap_or_else(Vec::new)`. Clippy's `redundant_closure` lint will point these out for you: it flags `|n| Some(n)` and suggests `Some`.

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

### Returning `FnMut` and `FnOnce`

`impl Fn` isn't the only option — the trait you return should match what the closure actually does. A closure that *mutates* its captures is `FnMut`, and one that *consumes* them is `FnOnce`:

```rust
// FnMut: keeps state between calls. This is a closure-based counter.
fn make_counter() -> impl FnMut() -> u32 {
    let mut count = 0;
    move || {
        count += 1;
        count
    }
}

// FnOnce: gives away the captured String, so it can only be called once.
fn make_consumer(message: String) -> impl FnOnce() -> String {
    move || message
}

fn main() {
    // Note `mut` — calling an FnMut requires a mutable binding.
    let mut next = make_counter();
    println!("{} {} {}", next(), next(), next()); // 1 2 3

    let counters = (make_counter(), make_counter());
    let (mut a, mut b) = counters;
    println!("independent: a={} b={}", a(), b()); // each has its own state

    let once = make_consumer(String::from("delivered"));
    println!("{}", once());
    // once(); // ❌ would not compile: the closure was consumed
}
```

> [!mistake] Forgetting `mut` when you hold an `FnMut`
> `let counter = make_counter(); counter();` fails with *"cannot borrow `counter` as mutable"*. Calling an `FnMut` needs `&mut self`, so the binding must be `let mut counter`. The error names the right fix but doesn't explain why — and it surprises people, because "calling a function" doesn't feel like mutation. It is: the closure is a struct holding `count`, and calling it writes to that field.

| Return | When | Cost |
|---|---|---|
| `impl Fn(..)` | one closure type, only reads captures | zero — static dispatch, inlinable |
| `impl FnMut(..)` | one closure type, mutates captures | zero; caller needs `let mut` |
| `impl FnOnce(..)` | one closure type, consumes captures | zero; callable once |
| `Box<dyn Fn(..)>` | **different** closures per branch | heap allocation + dynamic dispatch |
| `fn(..)` | no captures at all | a bare pointer, no allocation |

> [!best] Reach for `impl Fn` first
> Use **`impl Fn`** to return a closure whenever you can — it's zero-cost (static dispatch, no allocation) and usually all you need. Fall back to **`Box<dyn Fn>`** only when you genuinely must return *different* closure types (e.g. chosen at runtime, or stored together in a collection). This mirrors the [static vs. dynamic dispatch](#/ch/trait-objects) trade-off you already know.

> [!note] `move` is usually required when returning closures
> A returned closure outlives the function that created it, so it can't *borrow* the function's locals — it must **own** them. That's why `make_adder` uses `move |x| x + n`: without `move`, the closure would try to borrow `n`, which is gone once the function returns. Same reasoning as `move` closures for [threads](#/ch/threads).

## Summary

- **`fn`** (lowercase) is the **function-pointer type**; **`Fn`/`FnMut`/`FnOnce`** (capitalized) are **traits** implemented by both functions and closures.
- The traits **nest** — every `Fn` is an `FnMut`, every `FnMut` an `FnOnce` — so accept the **loosest** bound your code needs.
- A function pointer implements the `Fn` traits, so you can pass a named function (or an **enum/tuple-struct constructor**, which *is* a function) anywhere a closure is expected. `.map(Some)` and `.map(Box::new)` work for exactly this reason.
- A **non-capturing closure coerces to `fn`**; one that captures anything does not, because a bare pointer has nowhere to store the captures.
- Each named function has a **unique zero-sized item type** that coerces to a pointer — which is why reassigning `f = other_fn` needs an explicit `fn(..)` annotation.
- **Return a closure** with **`impl Fn(...)`** for a single concrete type (static, zero-cost) or **`Box<dyn Fn(...)>`** when different branches return different closures (dynamic dispatch). Use **`impl FnMut`** for a stateful closure and **`impl FnOnce`** for one that consumes its captures.
- Holding an `FnMut` requires **`let mut`** — calling it mutates its captured state.
- Returned closures almost always need **`move`**, since they outlive the function and must own their captures.

> [!exercise] Try it yourself
> 1. Write `fn apply_all(fs: &[fn(i32) -> i32], x: i32) -> Vec<i32>` and call it with an array of named functions.
> 2. Write `make_multiplier(n) -> impl Fn(i32) -> i32`, then rewrite a version returning `Box<dyn Fn>` that picks `*` or `+` based on a `&str` argument.
> 3. Use an enum tuple variant as a constructor function in a `.map(...)` call. Then replace a `.map(|n| Some(n))` somewhere with `.map(Some)`.
> 4. Write `make_counter() -> impl FnMut() -> u32`. Call it without `mut` first and read the error, then fix it. Create two counters and confirm their state is independent.
> 5. Assign a non-capturing closure to a `fn(i32) -> i32` variable. Then add a capture to it and explain the new error.
> 6. Write `let mut f = add_one; f = sub_one;` and read `error[E0308]` in full. Fix it two ways — with an annotation, and with `as`.

The final advanced topic is talking to the outside world in other languages — **FFI**.
