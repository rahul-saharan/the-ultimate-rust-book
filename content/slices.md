<h1><span class="h1-kicker">Ownership — The Heart of Rust</span>The Slice Type</h1>

Often you don't want to borrow an *entire* collection — just a **part** of it. The first word of a sentence. The middle three elements of an array. A **slice** is a reference to a contiguous run of elements inside a collection. Slices are borrowed (they don't own their data), and they solve a surprisingly nasty class of bugs. Let's see how.

## A problem worth solving

Imagine a function that returns the first word of a string. Without slices, the best you could do is return an *index*:

```rust
fn first_word_end(s: &String) -> usize {
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b' ' {
            return i;
        }
    }
    s.len()
}

fn main() {
    let s = String::from("hello world");
    let end = first_word_end(&s);
    println!("First word ends at index {end}");
}
```

But that index is fragile. It's just a number, disconnected from the string. If the string is cleared after you compute the index, the index is now *meaningless* — yet nothing stops you from using it. That's a bug waiting to happen.

> [!key] The core idea of slices
> A slice ties a "view" of data **to the data itself**, and the borrow checker keeps them in sync. If you hold a slice into a string, the compiler won't let you mutate or drop that string — so your view can never go stale. The bug becomes *impossible*.

## String slices

A **string slice** is a reference to part of a `String`. Its type is written `&str`. You create one with a range inside square brackets:

```rust
fn main() {
    let s = String::from("hello world");

    let hello = &s[0..5];  // "hello"
    let world = &s[6..11]; // "world"
    println!("{hello} / {world}");
}
```

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="A string slice stores a pointer to a start position and a length">
  <style>
    .m4 { font: 600 13px var(--font-mono); fill: var(--text); }
    .l4 { font: 600 12px var(--font-sans); fill: var(--text); }
    .c4 { font: 12px var(--font-sans); fill: var(--text-mute); }
    .cell4 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .sel4 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 2; }
    .h4 { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="l4">The heap bytes of the String "hello world":</text>
  <g class="m4">
    <rect x="20" y="30" width="34" height="34" class="cell4"/><text x="30" y="52">h</text>
    <rect x="54" y="30" width="34" height="34" class="cell4"/><text x="64" y="52">e</text>
    <rect x="88" y="30" width="34" height="34" class="cell4"/><text x="98" y="52">l</text>
    <rect x="122" y="30" width="34" height="34" class="cell4"/><text x="132" y="52">l</text>
    <rect x="156" y="30" width="34" height="34" class="cell4"/><text x="166" y="52">o</text>
    <rect x="190" y="30" width="34" height="34" class="cell4"/><text x="200" y="52"> </text>
    <rect x="224" y="30" width="34" height="34" class="sel4"/><text x="234" y="52">w</text>
    <rect x="258" y="30" width="34" height="34" class="sel4"/><text x="268" y="52">o</text>
    <rect x="292" y="30" width="34" height="34" class="sel4"/><text x="302" y="52">r</text>
    <rect x="326" y="30" width="34" height="34" class="sel4"/><text x="336" y="52">l</text>
    <rect x="360" y="30" width="34" height="34" class="sel4"/><text x="370" y="52">d</text>
  </g>
  <text x="224" y="82" class="c4">index 6 ────────── len 5 ──────────▶</text>
  <rect x="440" y="110" width="180" height="52" rx="8" class="sel4"/>
  <text x="452" y="132" class="m4" fill="var(--blue)">let world = &amp;s[6..11];</text>
  <text x="452" y="152" class="c4">ptr → index 6, len = 5</text>
</svg>
<figcaption>A <code>&str</code> is a <b>fat pointer</b>: it stores a pointer to the start byte plus a length. No data is copied.</figcaption>
</figure>

> [!jargon] Fat pointer
> A normal pointer is just an address. A **fat pointer** carries *extra* information alongside the address — for a slice, that's the **length**. So `&str` is two machine words: "start here" and "this many bytes." That's how a slice knows where it ends without a terminator.

Now we can write `first_word` to return a slice — a view that stays valid:

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b' ' {
            return &s[0..i];
        }
    }
    &s[..] // no space found — the whole string is one word
}

fn main() {
    let sentence = String::from("hello wonderful world");
    let word = first_word(&sentence);
    println!("First word: {word}");
}
```

> [!tip] Range shorthand
> Rust lets you drop the start or end of a range: `&s[0..5]` is the same as `&s[..5]`; `&s[6..len]` is `&s[6..]`; and `&s[0..len]` is just `&s[..]` (the whole thing). Use whichever reads cleanest.

### `&str` vs `String`, and why `&str` parameters are better

You may have noticed our best `first_word` takes `&str`, not `&String`. That's deliberate and idiomatic:

> [!best] Take `&str`, not `&String`, as a parameter
> A `&str` can borrow from a `String`, a string literal, or even another slice — so a function taking `&str` accepts *all* of them. Thanks to automatic *deref coercion*, you can pass `&my_string` where `&str` is expected. Writing your function to accept `&str` makes it maximally reusable at zero cost. String literals like `"hello"` are already `&str`, by the way — they point directly into your compiled program.

```rust
# fn first_word(s: &str) -> &str {
#     match s.find(' ') { Some(i) => &s[..i], None => s }
# }
fn main() {
    let owned = String::from("from a String");
    let literal = "from a literal";
    println!("{}", first_word(&owned));   // &String coerces to &str
    println!("{}", first_word(literal));  // already &str
}
```

## Slices work on arrays and vectors too

Slices aren't just for strings. You can slice any contiguous collection, like an array or a `Vec`. The type is written `&[T]` (a slice of `T`):

```rust
fn main() {
    let numbers = [10, 20, 30, 40, 50];
    let middle = &numbers[1..4]; // &[i32] containing [20, 30, 40]

    println!("Middle slice: {middle:?}");
    println!("Sum of slice: {}", sum(middle));
}

fn sum(slice: &[i32]) -> i32 {
    slice.iter().sum()
}
```

> [!best] Accept `&[T]` for the same reason you accept `&str`
> A function that takes `&[i32]` works with arrays *and* vectors *and* sub-slices. Prefer `&[T]` parameters over `&Vec<T>` — it's more general and just as fast.

## The safety payoff

Here's the bug that slices make impossible. Because a slice borrows the string, you can't clear the string while a slice into it is alive:

```rust,ignore
fn main() {
    let mut s = String::from("hello world");
    let word = first_word(&s); // immutable borrow starts
    s.clear();                 // ❌ ERROR: needs &mut while `word` borrows &s
    println!("the first word is: {word}");
}
// error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
```

In a language with bare indices, `s.clear()` would happily run and leave `word` pointing at emptiness. Rust refuses to compile it. **The borrow checker turned a latent runtime bug into a compile-time error.**

## Summary

- A **slice** (`&str` for strings, `&[T]` for arrays/vectors) borrows a **contiguous part** of a collection without copying.
- Slices are **fat pointers**: a start pointer plus a length.
- Prefer **`&str`** and **`&[T]`** as function parameters — they accept `String`/`Vec`, literals, arrays, and sub-slices alike.
- Because a slice **borrows** its source, the compiler prevents the source from being mutated or dropped while the slice is alive — eliminating stale-view bugs.

> [!exercise] Try it yourself
> 1. Write `fn last_word(s: &str) -> &str` that returns the final word of a sentence.
> 2. Write `fn largest(slice: &[i32]) -> i32` and call it with both an array and a `vec![…]`.
> 3. Reproduce the `s.clear()` borrow error, then fix it by moving `s.clear()` to after the final use of `word`.

We've talked a lot about the *stack* and the *heap*. Let's finally look at them head-on and cement your mental model of Rust's **memory**.
