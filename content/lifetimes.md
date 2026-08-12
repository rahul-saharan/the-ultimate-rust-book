<h1><span class="h1-kicker">Generics, Traits & Lifetimes</span>Lifetimes</h1>

Lifetimes have a fearsome reputation, but the core idea is simple: a **lifetime** is how long a reference is valid. Most of the time Rust figures them out silently and you never write one. Occasionally — when a function returns a reference, or a struct stores one — the compiler needs your help to connect the dots. This chapter demystifies lifetimes so they become just another tool, not a wall.

## What lifetimes are really about

You already know the borrow checker prevents **dangling references** (references to data that's been dropped). Lifetimes are simply the *labels* the compiler uses to track "how long does the thing this reference points to actually live?" — so it can prove no reference outlives its data.

```rust,ignore
fn main() {
    let r;                // r declared
    {
        let x = 5;
        r = &x;           // r points to x
    }                     // x is dropped here!
    println!("{r}");      // ❌ r would be dangling — compile error E0597
}
```

The compiler rejects this: `x` dies at the inner `}`, but `r` (which borrows it) is used afterward. Lifetimes are how it reasons about exactly this.

> [!jargon] Lifetime
> A **lifetime** is the span of code during which a reference is valid to use. It is *not* how long the data lives in memory (that's ownership) — it's the region where a *borrow* is allowed. Every reference has a lifetime; usually the compiler infers it, and you never see it.

## Why functions sometimes need annotations

Consider a function returning the longer of two string slices:

```rust,ignore
fn longest(x: &str, y: &str) -> &str { // ❌ won't compile as-is
    if x.len() > y.len() { x } else { y }
}
```

Rust rejects this with *"missing lifetime specifier."* Why? The returned reference borrows from *either* `x` or `y` — but the compiler can't tell *which* just from the signature, so it can't know how long the result is valid. We have to *tell* it the relationship.

## Generic lifetime annotations

A lifetime parameter looks like a type parameter but starts with an apostrophe: `'a` (say "tick-a"). It doesn't *change* how long anything lives — it **describes a relationship** between the lifetimes of several references:

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("a long string");
    let s2 = String::from("short");
    let result = longest(&s1, &s2);
    println!("The longest is: {result}");
}
```

Read the signature as: *"for some lifetime `'a`, both inputs live at least as long as `'a`, and the returned reference is valid for `'a` too."* In plain English: **the result is valid for as long as the shorter-lived of the two inputs.** That's exactly the guarantee that makes returning a borrow safe.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="The returned reference's lifetime is the overlap of the two input lifetimes">
  <style>
    .lfm { font: 600 12px var(--font-mono); fill: var(--text); }
    .lfc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .barx { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .bary { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .barr { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="26" class="lfm" fill="var(--blue)">x lives:</text>
  <rect x="120" y="14" width="360" height="20" class="barx"/>
  <text x="20" y="60" class="lfm" fill="var(--green)">y lives:</text>
  <rect x="120" y="48" width="240" height="20" class="bary"/>
  <text x="20" y="94" class="lfm" fill="var(--rust-600)">'a =</text>
  <rect x="120" y="82" width="240" height="20" class="barr"/>
  <line x1="360" y1="10" x2="360" y2="115" stroke="var(--text-mute)" stroke-dasharray="3 3"/>
  <text x="20" y="135" class="lfc">'a is the OVERLAP — the result borrow can only be used while BOTH inputs are still alive.</text>
</svg>
<figcaption>The annotation ties the output's validity to the <b>shorter</b> of the inputs — so the returned reference can never dangle.</figcaption>
</figure>

> [!key] Annotations describe, they don't change
> Writing `'a` does **not** make anything live longer or shorter. It's a *constraint you're stating* so the compiler can verify your borrows are sound. If you claim a relationship that isn't true, the compiler catches it. Think of lifetimes as documentation the compiler checks — like types, but for "how long."

## Lifetime elision: why you rarely write them

If lifetimes were always required, Rust would be exhausting. They're not, because the compiler applies **elision rules** — common patterns it can infer automatically. That's why `fn first_word(s: &str) -> &str` needs no annotation: with a single input reference, the output obviously borrows from it.

> [!tip] The three elision rules (so you know when you must annotate)
> The compiler auto-assigns lifetimes when:
> 1. Each reference parameter gets its own lifetime.
> 2. If there's **exactly one** input lifetime, it's given to all outputs. *(This covers most functions.)*
> 3. If there's a `&self` or `&mut self`, its lifetime is given to all outputs. *(This covers most methods.)*
>
> You only annotate by hand when these rules leave the output's lifetime ambiguous — like `longest`, with two input references and no `self`. That's genuinely rare in day-to-day code.

## Decoding the three lifetime errors

Almost every lifetime error you'll meet is one of three, and each has a standard fix:

| Error | The compiler is saying | Usual fix |
|---|---|---|
| **E0106** `missing lifetime specifier` | "this return reference could come from several places — which?" | annotate (`<'a>`), or return an owned value |
| **E0597** `borrowed value does not live long enough` | "the referent dies before the reference does" | move the owner to an outer scope, or return owned data |
| **E0515** `cannot return reference to local variable` | "you're returning a pointer to this function's own stack frame" | return the value itself, not a reference to it |

```rust,ignore
// E0106 — two inputs, so the compiler can't guess which one the output borrows:
fn longest(a: &str, b: &str) -> &str { if a.len() > b.len() { a } else { b } }
//                               ^ expected named lifetime parameter
// fix: fn longest<'a>(a: &'a str, b: &'a str) -> &'a str

// E0597 — `inner` dies at the closing brace, but `r` is used after it:
let r;
{
    let inner = String::from("temporary");
    r = &inner;
}
// println!("{r}");   // ❌ `inner` does not live long enough
// fix: declare `inner` in the outer scope, or store an owned String in `r`

// E0515 — the classic "return a reference to a local":
fn broken() -> &String {
    let s = String::from("hi");
    &s          // ❌ `s` is dropped when the function returns
}
// fix: `fn works() -> String { String::from("hi") }` — return ownership
```

> [!key] Every lifetime error is the same question: *does the data outlive the reference?*
> The messages differ, but they all reduce to that one check. When you're stuck, don't start sprinkling `'a` annotations — they don't extend anything. **A lifetime annotation is a description, not an instruction.** Writing `<'a>` doesn't make data live longer; it only *tells the compiler about a relationship that already exists*, so it can verify it. If the data genuinely dies too early, no annotation can save you — you must either make the owner live longer, or hand back owned data instead of a borrow.
>
> That's why "return a `String` instead of a `&str`" resolves so many of these: it sidesteps the question entirely by giving the caller something that doesn't depend on anyone else's lifetime.

## Lifetimes in structs

If a struct holds a **reference** (rather than owned data), you must annotate its lifetime — this states "an instance of this struct can't outlive the data it borrows":

```rust
struct Excerpt<'a> {
    part: &'a str, // this struct borrows a string slice
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence = novel.split('.').next().unwrap();

    let excerpt = Excerpt { part: first_sentence };
    println!("Excerpt: {}", excerpt.part);
    // `excerpt` cannot outlive `novel`, and the compiler enforces it.
}
```

> [!best] Prefer owned data to dodge lifetimes while learning
> Storing a `String` instead of a `&str` in your struct means no lifetime annotations and no "does this outlive that?" puzzles — at the cost of owning (and cloning) the data. For most application code, **owned fields are the pragmatic default**. Save borrowed fields (and their lifetimes) for performance-critical spots where avoiding a copy genuinely matters. This one habit removes 90% of lifetime friction for newcomers.

## The special `'static` lifetime

`'static` means "valid for the entire duration of the program." Every string literal has it, because literals are baked into the compiled binary:

```rust
fn main() {
    let s: &'static str = "I live for the whole program";
    println!("{s}");
}
```

> [!mistake] Don't sprinkle `'static` to silence errors
> Beginners sometimes add `'static` because the compiler mentions it in an error, and it "makes it compile." That usually just hides a real problem (a reference that genuinely doesn't live long enough). Ask instead: *should this be owned data?* Nine times out of ten, changing a `&str` to a `String` is the correct fix, not forcing `'static`.

---

Everything above is the everyday 90%. The rest of this chapter is the **advanced 10%** — the machinery behind the compiler's decisions. You can skip it on a first read, but understanding it is what turns "I fight the borrow checker" into "I know exactly what it's proving."

## Lifetime bounds: the "outlives" relationship

Just as `T: Trait` bounds a type, you can bound a *lifetime*. The two forms:

- **`'a: 'b`** (say "`'a` outlives `'b`") — lifetime `'a` lasts *at least as long as* `'b`.
- **`T: 'a`** — every reference inside type `T` is valid for at least `'a` (a type "outlives" a lifetime). `T: 'static` therefore means "`T` contains no borrowed data shorter than the whole program" (e.g. an owned `String`).

You need these when you relate several lifetimes and the compiler can't assume the ordering:

```rust
// "'long outlives 'short" lets us return the longer-lived borrow where a
// shorter-lived one is expected:
fn prefer_first<'long: 'short, 'short>(a: &'long str, b: &'short str) -> &'short str {
    let _ = b;
    a // a: &'long str is accepted as &'short str because 'long: 'short
}

fn main() {
    let outer = String::from("outer");
    {
        let inner = String::from("inner");
        let r = prefer_first(&outer, &inner);
        println!("{r}"); // valid for the shorter ('short) region — used here, fine
    }
}
```

> [!jargon] `T: 'static` is not "lives forever" — it's "*could*"
> A common misread: `T: 'static` does **not** mean the value lives for the whole program. It means `T` is *allowed* to — it holds no reference that dies sooner. An owned `String` is `'static` even if you drop it in a millisecond, because it borrows nothing. This bound shows up constantly in `std::thread::spawn` and `tokio::spawn`, which require the closure to be `'static` (it can't capture short-lived borrows, since the task may outlive the spawner).

## Subtyping & variance

Lifetimes are the one place Rust has **subtyping**. If `'long: 'short`, then `&'long T` is a *subtype* of `&'short T` — a longer-lived reference can be used anywhere a shorter-lived one is expected (it's strictly more capable). That's why a `&'static str` works everywhere a `&str` is wanted:

```rust
fn needs_a_str(s: &str) { println!("{s}"); } // any lifetime

fn main() {
    let forever: &'static str = "hello";
    needs_a_str(forever); // &'static coerces "down" to a shorter borrow — subtyping
}
```

**Variance** is the rule for how that subtyping flows through *type constructors* — whether wrapping a type preserves, reverses, or destroys the subtyping. There are three kinds, and Rust assigns them automatically:

<figure class="diagram">
<svg viewBox="0 0 660 200" role="img" aria-label="Variance table: shared references and Box are covariant, mutable references and Cell are invariant, function arguments are contravariant">
  <style>
    .va-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .va-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .va-h { font: 700 12px var(--font-sans); }
    .cov { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .inv { fill: var(--red-soft);   stroke: var(--red);   stroke-width: 1.4; }
    .con { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
  </style>
  <rect x="14" y="20" width="632" height="46" rx="8" class="cov"/>
  <text x="26" y="40" class="va-h" fill="var(--green)">Covariant — subtyping passes through unchanged</text>
  <text x="26" y="59" class="va-b">&amp;'a T, &amp;'a (in T), Box&lt;T&gt;, Vec&lt;T&gt;, Rc&lt;T&gt; &nbsp;·&nbsp; a &amp;'long can be used as &amp;'short</text>
  <rect x="14" y="76" width="632" height="46" rx="8" class="inv"/>
  <text x="26" y="96" class="va-h" fill="var(--red)">Invariant — no subtyping; the lifetime/type must match exactly</text>
  <text x="26" y="115" class="va-b">&amp;'a mut T (in T), Cell&lt;T&gt;, RefCell&lt;T&gt;, *mut T &nbsp;·&nbsp; mutation makes it unsafe to substitute</text>
  <rect x="14" y="132" width="632" height="46" rx="8" class="con"/>
  <text x="26" y="152" class="va-h" fill="var(--amber)">Contravariant — subtyping reverses</text>
  <text x="26" y="171" class="va-b">the argument position of fn(T) &nbsp;·&nbsp; a fn taking &amp;'short works where one taking &amp;'long is needed</text>
</svg>
<figcaption>Variance decides where a longer-lived reference may substitute for a shorter one. Covariant = safe to substitute; invariant = must match; contravariant = the opposite substitutes.</figcaption>
</figure>

The subtle, important one is **why `&mut T` is invariant in `T`**. If it were covariant (like `&T`), you could smuggle a short-lived reference into a long-lived slot and create a dangling pointer:

```rust,ignore
// If &mut &'a str were covariant in 'a, this would compile — and dangle:
fn overwrite<'a>(slot: &mut &'a str, short: &'a str) {
    *slot = short; // store the borrow into the slot
}

fn main() {
    let mut held: &'static str = "static";
    {
        let temp = String::from("temporary");
        overwrite(&mut held, &temp); // ❌ rejected: &mut is INVARIANT in T
    }                                 // temp dropped here…
    println!("{held}");               // …would read freed memory — hence the error above
}
```

Because `&mut &'a str` is invariant in `'a`, the compiler refuses to treat the `&'static str` slot as a slot for a shorter borrow — exactly the check that stops the dangle. You rarely *write* variance, but it explains many "why won't this compile?" errors around mutable references, `Cell`, and closures.

## Higher-ranked trait bounds: `for<'a>`

Sometimes a bound must hold for **every** lifetime, not one fixed `'a` chosen by the caller. That's a **higher-ranked trait bound (HRTB)**, written `for<'a>`. It appears most with closures that take a reference and must work no matter how long-lived that reference is:

```rust
// `for<'a> Fn(&'a str) -> usize` = "works for a reference of ANY lifetime".
fn apply_to_each<F>(f: F)
where
    F: for<'a> Fn(&'a str) -> usize,
{
    let a = String::from("hello");
    let b = String::from("hi");
    println!("{} {}", f(&a), f(&b)); // called with two different, unrelated lifetimes
}

fn main() {
    apply_to_each(|s: &str| s.len());
}
```

> [!note] You've been using HRTBs without knowing it
> The `Fn`/`FnMut`/`FnOnce` traits over reference arguments **elide to `for<'a>`** automatically — so `F: Fn(&str) -> usize` already means `for<'a> Fn(&'a str) -> usize`. You only write `for<'a>` explicitly when the elision can't figure out the relationship, or in a trait bound on an associated type. Seeing `for<'a>` in a compiler error usually means "your closure needs to accept a borrow of any lifetime, and something is pinning it to one."

## Summary

- A **lifetime** is how long a reference is valid; lifetimes let the compiler prove no reference **dangles**.
- Usually inferred — you only annotate when a returned or stored reference's source is ambiguous.
- A lifetime parameter (`'a`) **describes a relationship** between references (e.g. "the output lives as long as the shorter input"); it doesn't change how long anything lives.
- **Elision rules** auto-fill lifetimes for common cases (one input, or methods with `&self`), so you rarely write them.
- Structs that hold references need a lifetime; **prefer owned fields** to avoid this while learning.
- **`'static`** means "lives for the whole program" (string literals are `'static`) — don't use it to paper over errors.

**Advanced:**
- **Lifetime bounds** — `'a: 'b` ("`'a` outlives `'b`") and `T: 'a` relate lifetimes; `T: 'static` means "holds no short-lived borrow" (why `spawn` requires it).
- **Subtyping & variance** — a longer lifetime is a subtype of a shorter one; type constructors are **covariant** (`&T`, `Box<T>`), **invariant** (`&mut T`, `Cell<T>`), or **contravariant** (fn args). `&mut T`'s invariance is what stops dangling-through-mutation bugs.
- **Higher-ranked bounds** — `for<'a>` requires a bound to hold for *every* lifetime; the `Fn` traits use it implicitly.

> [!exercise] Try it yourself
> 1. Write `fn longer<'a>(a: &'a str, b: &'a str) -> &'a str` and call it. Then remove the `'a`s and read the error.
> 2. Reproduce the dangling-reference error (`r = &x` in an inner block), then fix it by moving `x` to the outer scope.
> 3. Make a `struct Tagged<'a> { tag: &'a str }`, then rewrite it to own a `String` and note how the lifetime disappears.
> 4. Write `fn apply<F: for<'a> Fn(&'a str) -> usize>(f: F)` and pass it `|s| s.len()`.
> 5. Try to store a shorter-lived borrow into a `&mut &'static str` and read the invariance error the compiler gives.

You've now got the full generics/traits/lifetimes trio — the toolkit of intermediate Rust. Let's finish this part with the advanced trait features that power operator overloading and elegant APIs.
