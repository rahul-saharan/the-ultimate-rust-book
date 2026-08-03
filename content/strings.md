<h1><span class="h1-kicker">Common Collections</span>Strings & Text</h1>

Text seems like it should be simple — and in many languages it *appears* to be, right up until an emoji or an accented letter breaks something. Rust chooses to be honest about the real complexity of human text from the start. Once you understand *why* Rust strings work the way they do, you'll write text-handling code that's correct for every language on Earth. Let's demystify them.

## Two string types: `String` and `&str`

You've already met both. Here's the clear distinction:

- **`String`** is an **owned**, growable, heap-allocated string. You create and modify it. Think of it as a `Vec<u8>` that's guaranteed to be valid text.
- **`&str`** (a "string slice") is a **borrowed** view into string data you don't own. String literals like `"hello"` are `&str`, pointing directly into your compiled program.

```rust
fn main() {
    let owned: String = String::from("I own my data");
    let borrowed: &str = "I'm baked into the binary";
    let slice: &str = &owned[0..5]; // a borrowed view into `owned`

    println!("{owned}");
    println!("{borrowed}");
    println!("{slice}");
}
```

> [!tip] The rule of thumb
> **Store** a `String` (when a type or variable needs to own its text). **Accept** a `&str` in function parameters (so callers can pass either). This mirrors `Vec<T>` vs `&[T]` from the last chapters — owned for storage, borrowed for access.

## Building and combining strings

```rust
fn main() {
    let mut s = String::new();
    s.push_str("Hello");   // append a &str
    s.push(',');           // append a single char
    s.push(' ');

    let name = String::from("world");
    // format! builds a new String WITHOUT taking ownership of its inputs:
    let greeting = format!("{s}{name}!");
    println!("{greeting}"); // Hello, world!
    println!("name still usable: {name}");
}
```

You can also concatenate with `+`, but watch the ownership:

```rust
fn main() {
    let s1 = String::from("Hello, ");
    let s2 = String::from("world!");
    let s3 = s1 + &s2; // s1 is MOVED into s3; s2 is borrowed
    println!("{s3}");
    // println!("{s1}"); // ❌ s1 was moved
    println!("{s2}");    // ✅ s2 was only borrowed
}
```

> [!best] Prefer `format!` over `+` chains
> The `+` operator moves its left operand and gets awkward fast (`s1 + &s2 + &s3 + ...`). For anything beyond joining two pieces, `format!("{a}{b}{c}")` is clearer, doesn't consume its inputs, and reads like a template. Reach for `format!` by default.

## The big idea: strings are UTF-8 bytes

Here is the concept that explains every "weird" thing about Rust strings.

> [!key] A Rust string is a sequence of bytes, encoded as UTF-8
> **UTF-8** is a way of encoding text where each character takes **one to four bytes**. Plain English letters take one byte, but `é` takes two, `京` takes three, and `🦀` takes four. So there is *no fixed relationship* between "number of characters" and "number of bytes." Rust refuses to pretend otherwise — and that honesty is what makes it correct.

<figure class="diagram">
<svg viewBox="0 0 640 190" role="img" aria-label="The string crab-a-b takes six bytes: four for the crab emoji and one each for a and b">
  <style>
    .gh { font: 700 12px var(--font-sans); }
    .gm { font: 600 13px var(--font-mono); fill: var(--text); }
    .gc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ch4 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .cha { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .chb { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="22" class="gh">The text "🦀ab" — 3 characters, but 6 bytes:</text>
  <text x="20" y="52" class="gc">characters (.chars()):</text>
  <rect x="180" y="36" width="60" height="26" class="ch4"/><text x="200" y="54" class="gm">🦀</text>
  <rect x="244" y="36" width="40" height="26" class="cha"/><text x="258" y="54" class="gm">a</text>
  <rect x="288" y="36" width="40" height="26" class="chb"/><text x="302" y="54" class="gm">b</text>
  <text x="20" y="102" class="gc">bytes (.bytes(), .len()):</text>
  <g class="gm">
    <rect x="180" y="86" width="30" height="26" class="ch4"/><text x="185" y="104" font-size="10">240</text>
    <rect x="210" y="86" width="30" height="26" class="ch4"/><text x="215" y="104" font-size="10">159</text>
    <rect x="240" y="86" width="30" height="26" class="ch4"/><text x="245" y="104" font-size="10">166</text>
    <rect x="270" y="86" width="30" height="26" class="ch4"/><text x="275" y="104" font-size="10">128</text>
    <rect x="300" y="86" width="30" height="26" class="cha"/><text x="308" y="104" font-size="10">97</text>
    <rect x="330" y="86" width="30" height="26" class="chb"/><text x="338" y="104" font-size="10">98</text>
  </g>
  <text x="20" y="150" class="gc">🦀 alone is 4 bytes. That's why <tspan font-family="var(--font-mono)">"🦀ab".len()</tspan> is 6, and why indexing by number would be meaningless.</text>
</svg>
<figcaption>One "character" may span several bytes — so a byte index and a character index are not the same thing.</figcaption>
</figure>

### Why `len()` might surprise you, and why you can't index

Because `len()` counts **bytes**, not characters:

```rust
fn main() {
    let english = "hello";
    let russian = "Здравствуйте";

    println!("'{english}' — {} bytes, {} chars", english.len(), english.chars().count());
    println!("'{russian}' — {} bytes, {} chars", russian.len(), russian.chars().count());
    // english: 5 bytes, 5 chars
    // russian: 24 bytes, 12 chars!
}
```

And this is why Rust **won't let you write `s[0]`** to get "the first character":

> [!warning] `s[0]` does not compile — on purpose
> If Rust let you index a string by number, what should `russian[0]` return? The first *byte* (half of a character — garbage)? The first *character* (which would require scanning)? There's no good answer, so Rust bans numeric indexing entirely. Instead, be explicit about what you want: `.chars().nth(0)` for the first character, or `.bytes().next()` for the first byte.

## Working with the pieces you actually want

Say what you mean by choosing an iterator:

```rust
fn main() {
    let s = "café";

    // Iterate over characters (what humans usually mean):
    for c in s.chars() {
        print!("[{c}]");
    }
    println!(); // [c][a][f][é]

    // Iterate over raw bytes:
    println!("byte count: {}", s.bytes().count()); // 5 — é is 2 bytes

    // Get the Nth character safely:
    println!("3rd char: {:?}", s.chars().nth(2)); // Some('f')
}
```

You *can* slice a string by byte range, but only on a **character boundary** — slicing through the middle of a multi-byte character panics:

```rust
fn main() {
    let s = String::from("hello world");
    let hello = &s[0..5];  // ✅ ASCII, every byte is a boundary
    println!("{hello}");
    // let bad = &"café"[0..3]; // ⚠️ would panic: index 3 is inside 'é'
}
```

## The everyday string toolkit

You rarely need to think about bytes in practice — the standard library has expressive methods for real tasks:

```rust
fn main() {
    let s = "  The Quick Brown Fox  ";

    println!("{}", s.trim());                 // "The Quick Brown Fox"
    println!("{}", s.to_lowercase());          // "  the quick brown fox  "
    println!("{}", s.replace("Quick", "Lazy")); // swap a word
    println!("{}", s.contains("Brown"));        // true
    println!("{}", s.trim().starts_with("The"));// true

    // Split into pieces and collect into a Vec:
    let words: Vec<&str> = s.split_whitespace().collect();
    println!("{words:?}"); // ["The", "Quick", "Brown", "Fox"]

    // Parse a string into a number:
    let n: i32 = "42".parse().unwrap();
    println!("parsed {}", n + 1);
}
```

> [!tip] `.parse()` turns text into numbers
> `let n: i32 = "42".parse().unwrap();` converts a string to a number. It returns a `Result` (parsing can fail on `"oops"`), so in real code use `?` or `match` instead of `.unwrap()`. The target type is how `.parse()` knows what to produce — hence the `: i32` annotation.

> [!deep] What about grapheme clusters?
> Some things humans see as one "character" are several Unicode scalar values combined — like an emoji with a skin-tone modifier, or `e` + a combining accent. These are called **grapheme clusters**. Rust's standard library gives you *bytes* and *chars* (scalar values); if you need true user-perceived characters (for cursor movement in a text editor, say), use the `unicode-segmentation` crate. For most programs, `.chars()` is exactly right.

## Summary

- **`String`** is owned and growable; **`&str`** is a borrowed view (string literals are `&str`). Store `String`, accept `&str`.
- Build strings with `push_str`, `push`, `+` (moves the left side), or — best — **`format!`**.
- Rust strings are **UTF-8 bytes**: a character can be 1–4 bytes, so **`len()` counts bytes**, and **numeric indexing (`s[0]`) is forbidden**.
- Say what you want: **`.chars()`** for characters, **`.bytes()`** for bytes; slice only on character boundaries.
- The standard library covers real tasks: `trim`, `split`, `replace`, `contains`, `to_lowercase`, `parse`, and more.

> [!exercise] Try it yourself
> 1. Print the byte length and character count of `"Grüße"` and explain the difference.
> 2. Use `format!` to build a sentence from three `String` variables without consuming them.
> 3. Split `"a,b,c,d"` on commas into a `Vec<&str>`, then join them back with `" - "` using `.join(" - ")`.
> 4. Parse `"3.14"` into an `f64` and multiply it by 2.

Next, the collection for looking things up by key rather than position: the **hash map**.
