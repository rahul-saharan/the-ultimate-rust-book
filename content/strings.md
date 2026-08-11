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

The difference is visible in memory. A `String` carries three words — pointer, length, capacity — and owns a heap buffer it can grow. A `&str` carries just two — pointer and length — and owns nothing:

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="A String has pointer length and capacity and owns its heap buffer, while a str slice has only pointer and length and borrows">
  <style>
    .st-l { font: 700 12px var(--font-sans); }
    .st-m { font: 600 12px var(--font-mono); fill: var(--text); }
    .st-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .st-box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .st-heap { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .st-ro { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="st-l" fill="var(--blue)">String — owns, can grow (3 words)</text>
  <g class="st-m">
    <rect x="20" y="30" width="150" height="26" class="st-box"/><text x="30" y="48">ptr ●</text>
    <rect x="20" y="56" width="150" height="26" class="st-box"/><text x="30" y="74">len = 5</text>
    <rect x="20" y="82" width="150" height="26" class="st-box"/><text x="30" y="100">capacity = 8</text>
  </g>
  <g class="st-m">
    <rect x="350" y="30" width="28" height="28" class="st-heap"/><text x="358" y="49">h</text>
    <rect x="378" y="30" width="28" height="28" class="st-heap"/><text x="386" y="49">e</text>
    <rect x="406" y="30" width="28" height="28" class="st-heap"/><text x="414" y="49">l</text>
    <rect x="434" y="30" width="28" height="28" class="st-heap"/><text x="442" y="49">l</text>
    <rect x="462" y="30" width="28" height="28" class="st-heap"/><text x="470" y="49">o</text>
    <rect x="490" y="30" width="28" height="28" class="st-box" stroke-dasharray="4 3"/>
    <rect x="518" y="30" width="28" height="28" class="st-box" stroke-dasharray="4 3"/>
    <rect x="546" y="30" width="28" height="28" class="st-box" stroke-dasharray="4 3"/>
  </g>
  <text x="350" y="76" class="st-c">heap buffer — writable, 3 spare slots</text>
  <path d="M172 45 L348 45" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-str)"/>
  <text x="20" y="148" class="st-l" fill="var(--purple)">&amp;str — borrows, fixed (2 words)</text>
  <g class="st-m">
    <rect x="20" y="158" width="150" height="26" class="st-box"/><text x="30" y="176">ptr ●</text>
    <rect x="20" y="184" width="150" height="26" class="st-box"/><text x="30" y="202">len = 5</text>
  </g>
  <g class="st-m">
    <rect x="350" y="158" width="28" height="28" class="st-ro"/><text x="358" y="177">h</text>
    <rect x="378" y="158" width="28" height="28" class="st-ro"/><text x="386" y="177">e</text>
    <rect x="406" y="158" width="28" height="28" class="st-ro"/><text x="414" y="177">l</text>
    <rect x="434" y="158" width="28" height="28" class="st-ro"/><text x="442" y="177">l</text>
    <rect x="462" y="158" width="28" height="28" class="st-ro"/><text x="470" y="177">o</text>
  </g>
  <text x="350" y="204" class="st-c">read-only bytes in the binary (or inside a String)</text>
  <path d="M172 172 L348 172" stroke="var(--purple)" stroke-width="2.5" marker-end="url(#arr-str2)"/>
  <text x="20" y="238" class="st-c">No capacity field means a <tspan font-family="var(--font-mono)">&amp;str</tspan> can never grow — it's a window, not a container.</text>
  <defs>
    <marker id="arr-str" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="arr-str2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--purple)"/></marker>
  </defs>
</svg>
<figcaption>A <b>String</b> owns a growable heap buffer; a <b>&amp;str</b> is a pointer-plus-length window into bytes someone else owns.</figcaption>
</figure>

> [!tip] The rule of thumb
> **Store** a `String` (when a type or variable needs to own its text). **Accept** a `&str` in function parameters (so callers can pass either). This mirrors `Vec<T>` vs `&[T]` from the last chapters — owned for storage, borrowed for access.

### The text types, side by side

| Type | Owns? | Growable? | Typical source | Use for |
|---|---|---|---|---|
| `String` | yes | yes | `String::from`, `format!`, `.to_string()` | struct fields, values you build or return |
| `&str` | no | no | literals, `&some_string` | function parameters, temporary views |
| `&mut str` | no | no (in-place edits only) | `&mut some_string[..]` | rare; e.g. `make_ascii_uppercase()` |
| `Box<str>` | yes | no | `s.into_boxed_str()` | long-lived text you'll never grow (saves 8 bytes) |
| `Cow<'_, str>` | maybe | maybe | `String::from_utf8_lossy` | "borrow unless I had to change it" |
| `char` | yes | — | `'a'`, `.chars()` | a single Unicode scalar value (always 4 bytes) |
| `Vec<u8>` / `&[u8]` | yes / no | yes / no | `.into_bytes()`, `.as_bytes()` | raw bytes that may not be valid text |

> [!jargon] `Cow` — clone on write
> `Cow<'_, str>` (short for *clone on write*) holds **either** a borrowed `&str` **or** an owned `String`, and only allocates if something actually needs changing. A function that usually returns its input unchanged — say, "escape this text if it contains quotes" — can return a `Cow` and skip the allocation in the common case. You'll meet it again in [Advanced Types](#/ch/advanced-types).

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

A `String` is a `Vec<u8>` underneath, so it has the same growth and editing vocabulary:

```rust
fn main() {
    let mut s = String::with_capacity(32);   // pre-allocate 32 bytes
    s.push_str("hello");
    s.insert(0, '>');                        // insert a char at a byte index
    s.insert_str(1, "-- ");                  // insert a &str
    println!("{s}  (len {}, cap {})", s.len(), s.capacity());

    let popped = s.pop();                    // remove & return the last char
    println!("popped {popped:?} → {s}");

    s.retain(|c| c.is_alphanumeric());       // keep only letters/digits
    println!("retained: {s}");

    s.truncate(3);                           // cut to 3 BYTES (must be a boundary)
    println!("truncated: {s}");

    s.clear();
    println!("cleared: {:?}, still has capacity {}", s, s.capacity());
}
```

### Building reference

| Method | Effect |
|---|---|
| `String::new()` | empty, no allocation |
| `String::with_capacity(n)` | empty, room for `n` **bytes** |
| `String::from("…")` / `"…".to_string()` | owned copy of a `&str` |
| `format!("{a} {b}")` | build from a template; borrows its inputs |
| `push(ch)` | append one `char` |
| `push_str(s)` | append a `&str` |
| `insert(i, ch)` / `insert_str(i, s)` | insert at byte index `i` (must be a char boundary) |
| `pop()` | remove & return the last `char`, as `Option<char>` |
| `remove(i)` | remove & return the `char` at byte index `i` |
| `truncate(n)` | keep the first `n` **bytes** |
| `retain(\|c\| …)` | keep only chars passing the test |
| `clear()` | empty it, keeping capacity |
| `extend(chars)` | append everything from an iterator of `char` |
| `repeat(n)` | a new `String` repeated `n` times |
| `a + &b` | concatenate, **moving** `a` |

> [!performance] For loops, `write!` beats `format!` + `push_str`
> Building a string in a loop with `s.push_str(&format!("{x}, "))` allocates a throwaway `String` every iteration. Bring `std::fmt::Write` into scope and write straight into the buffer instead — one allocation total.

```rust
use std::fmt::Write;

fn main() {
    let mut out = String::with_capacity(64);
    for x in 1..=5 {
        write!(out, "{x}, ").unwrap(); // appends in place, no temporary
    }
    println!("{}", out.trim_end_matches(", "));
}
```

Writing to a `String` can't fail, so the `unwrap()` above never fires — it's just satisfying the shared `Write` signature that also covers files and sockets.

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

    // char_indices pairs each char with its BYTE offset — the bridge
    // between the two worlds:
    for (i, c) in s.char_indices() {
        print!("{i}:{c} ");
    }
    println!(); // 0:c 1:a 2:f 3:é   ← note the jump: é starts at byte 3

    // Reversing correctly means reversing chars, not bytes:
    let backwards: String = s.chars().rev().collect();
    println!("{backwards}"); // éfac
}
```

You *can* slice a string by byte range, but only on a **character boundary** — slicing through the middle of a multi-byte character panics:

```rust
fn main() {
    let s = String::from("hello world");
    let hello = &s[0..5];  // ✅ ASCII, every byte is a boundary
    println!("{hello}");

    // For untrusted indices, ask first instead of risking a panic:
    let text = "café";
    println!("is 3 a boundary? {}", text.is_char_boundary(3)); // true
    println!("is 4 a boundary? {}", text.is_char_boundary(4)); // false — inside é
    println!("get(0..3) = {:?}", text.get(0..3));              // Some("caf")
    println!("get(0..4) = {:?}", text.get(0..4));              // None — no panic
}
```

| I want… | Use | Yields |
|---|---|---|
| characters | `s.chars()` | `char` |
| characters with byte offsets | `s.char_indices()` | `(usize, char)` |
| raw bytes | `s.bytes()` | `u8` |
| the whole byte buffer | `s.as_bytes()` | `&[u8]` |
| lines of text | `s.lines()` | `&str` (handles `\n` and `\r\n`) |
| the Nth character | `s.chars().nth(n)` | `Option<char>` |
| a safe sub-range | `s.get(a..b)` | `Option<&str>` |
| character count | `s.chars().count()` | `usize` (O(n)!) |
| byte count | `s.len()` | `usize` (O(1)) |

> [!mistake] `.chars().count()` is not free
> `s.len()` is instant — it's a stored number. `s.chars().count()` walks the entire string decoding UTF-8. Calling it inside a loop condition turns an O(n) job into O(n²). If you need the character count more than once, compute it once into a variable.

## Searching and testing

```rust
fn main() {
    let s = "the quick brown fox";

    println!("contains 'quick'? {}", s.contains("quick"));      // true
    println!("starts_with 'the'? {}", s.starts_with("the"));    // true
    println!("ends_with 'fox'?  {}", s.ends_with("fox"));       // true

    // find returns a BYTE index, not a char index:
    println!("find 'brown' = {:?}", s.find("brown"));           // Some(10)
    println!("find 'cat'   = {:?}", s.find("cat"));             // None
    println!("rfind 'o'    = {:?}", s.rfind('o'));              // last 'o'

    // Predicates work too, not just literals:
    println!("first digit  = {:?}", "abc7def".find(char::is_numeric)); // Some(3)

    // Count occurrences:
    println!("'o' appears {} times", s.matches('o').count());    // 2

    // strip_prefix / strip_suffix: test and remove in one step
    println!("{:?}", "v1.2.3".strip_prefix('v'));               // Some("1.2.3")
    println!("{:?}", "v1.2.3".strip_prefix('x'));               // None
}
```

| Method | Returns | Notes |
|---|---|---|
| `contains(pat)` | `bool` | substring, `char`, or predicate |
| `starts_with(pat)` / `ends_with(pat)` | `bool` | cheap prefix/suffix test |
| `find(pat)` / `rfind(pat)` | `Option<usize>` | **byte** index of first/last match |
| `matches(pat)` | iterator of `&str` | all matches; `.count()` them |
| `match_indices(pat)` | `(usize, &str)` | matches with their byte offsets |
| `strip_prefix(pat)` / `strip_suffix(pat)` | `Option<&str>` | remove it, or `None` if absent |
| `is_empty()` | `bool` | length zero |
| `eq_ignore_ascii_case(other)` | `bool` | ASCII-only case-insensitive compare |
| `is_char_boundary(i)` | `bool` | is byte `i` safe to slice at? |

> [!note] A "pattern" is more than a string
> Every method above accepts anything implementing the `Pattern` trait: a `&str` (`"abc"`), a `char` (`'x'`), a `char` array (`['a', 'b']`), or a closure/function on `char` (`char::is_numeric`, `|c: char| c == '_'`). So `s.split(|c: char| !c.is_alphanumeric())` splits on any run of punctuation without touching a regex crate.

## Splitting and joining

Splitting is where most text work actually happens:

```rust
fn main() {
    let csv = "name,age,city";

    // Split on a delimiter:
    let fields: Vec<&str> = csv.split(',').collect();
    println!("{fields:?}"); // ["name", "age", "city"]

    // Split only the first occurrence — perfect for "key=value":
    if let Some((key, value)) = "timeout=30".split_once('=') {
        println!("key={key}, value={value}");
    }

    // Limit the number of pieces:
    let parts: Vec<&str> = "a:b:c:d".splitn(2, ':').collect();
    println!("{parts:?}"); // ["a", "b:c:d"]

    // Whitespace-aware splitting collapses runs of spaces:
    let words: Vec<&str> = "  lots   of   space  ".split_whitespace().collect();
    println!("{words:?}"); // ["lots", "of", "space"]

    // Multi-line text:
    let doc = "line one\nline two\nline three";
    for (n, line) in doc.lines().enumerate() {
        println!("{}: {line}", n + 1);
    }

    // And back again:
    println!("{}", fields.join(" | ")); // name | age | city
}
```

| Method | Splits on | Notes |
|---|---|---|
| `split(pat)` | every match | empty pieces are kept |
| `rsplit(pat)` | every match, from the right | reversed order |
| `splitn(n, pat)` | at most `n − 1` times | the remainder stays whole |
| `split_once(pat)` | the **first** match only | `Option<(&str, &str)>` — ideal for `key=value` |
| `rsplit_once(pat)` | the **last** match only | ideal for splitting a file extension |
| `split_whitespace()` | runs of whitespace | collapses repeats, ignores leading/trailing |
| `split_terminator(pat)` | matches, ignoring a trailing one | `"a,b,".split_terminator(',')` → `a`, `b` |
| `split_inclusive(pat)` | keeps the delimiter on each piece | log/record parsing |
| `lines()` | line breaks | handles both `\n` and `\r\n` |
| `chars()` | every character | not really "splitting", but often what you want |
| `slice.join(sep)` | — | the inverse: glue pieces back together |

> [!mistake] `split(' ')` and `split_whitespace()` are not the same
> `"a  b".split(' ')` yields `["a", "", "b"]` — the run of two spaces produces an empty piece. `split_whitespace()` yields `["a", "b"]`. For human-entered text you almost always want `split_whitespace()`; use `split(',')` and friends for machine formats where empty fields are meaningful.

## Trimming, case, and replacing

```rust
fn main() {
    let padded = "\t  Hello, World!  \n";

    println!("[{}]", padded.trim());        // both ends
    println!("[{}]", padded.trim_start());  // leading only
    println!("[{}]", padded.trim_end());    // trailing only

    // Trim specific characters rather than whitespace:
    println!("[{}]", "***важно***".trim_matches('*'));
    println!("[{}]", "0042".trim_start_matches('0'));

    // Case conversion — the Unicode-correct versions allocate a new String:
    println!("{}", "Straße".to_uppercase());  // STRASSE — one char became two!
    println!("{}", "İSTANBUL".to_lowercase());

    // Replacing:
    let s = "one fish two fish";
    println!("{}", s.replace("fish", "bird"));    // all occurrences
    println!("{}", s.replacen("fish", "bird", 1)); // just the first

    // Padding and alignment come from the formatter, not a method:
    println!("[{:>8}]", "right");   // [   right]
    println!("[{:<8}]", "left");    // [left    ]
    println!("[{:^8}]", "mid");     // [  mid   ]
    println!("[{:*^8}]", "mid");    // [**mid***]
}
```

| Method | Effect |
|---|---|
| `trim()` / `trim_start()` / `trim_end()` | remove whitespace |
| `trim_matches(pat)` / `trim_start_matches` / `trim_end_matches` | remove specific chars |
| `to_lowercase()` / `to_uppercase()` | Unicode-correct case, returns `String` |
| `to_ascii_lowercase()` / `to_ascii_uppercase()` | ASCII-only, faster |
| `make_ascii_uppercase()` | in-place, no allocation (on `&mut str`) |
| `replace(from, to)` | replace **all** occurrences |
| `replacen(from, to, n)` | replace the first `n` |
| `repeat(n)` | repeat the whole string |
| `{:>w}` / `{:<w}` / `{:^w}` in `format!` | right / left / centre padding |

> [!warning] Case conversion is not a one-to-one mapping
> `"Straße".to_uppercase()` is `"STRASSE"` — six chars became seven. Turkish dotted/dotless `i` doesn't round-trip either. So never assume `s.to_uppercase().len() == s.len()`, and never compare user text by upper-casing both sides if correctness across languages matters. For ASCII identifiers and protocol tokens, `eq_ignore_ascii_case` is both correct and fast.

## Parsing, and converting to and from bytes

```rust
fn main() {
    // Text → number. parse() returns a Result, because input can be junk.
    let n: i32 = "42".parse().unwrap();
    let f: f64 = "3.14".parse().unwrap();
    println!("{} {}", n + 1, f * 2.0);

    // The safe form:
    match "oops".parse::<i32>() {
        Ok(v) => println!("parsed {v}"),
        Err(e) => println!("could not parse: {e}"),
    }

    // With a default:
    let port: u16 = "not-a-port".parse().unwrap_or(8080);
    println!("port = {port}");

    // Number → text
    println!("{}", 255.to_string());
    println!("{:b} {:o} {:x} {:X}", 255, 255, 255, 255); // binary/octal/hex
    println!("{:.2} {:+} {:e}", 3.14159, 42, 1234.5);    // precision, sign, exponent

    // String ↔ bytes
    let bytes: Vec<u8> = String::from("hi").into_bytes();
    let back = String::from_utf8(bytes).unwrap();        // Result — may be invalid
    println!("{back}");

    // Bytes that might NOT be valid UTF-8: replace the bad ones instead of failing.
    let broken = vec![b'h', b'i', 0xFF];
    println!("{}", String::from_utf8_lossy(&broken));     // hi� (a replacement char)
}
```

| Conversion | Call | Fallible? |
|---|---|---|
| `&str` → number | `s.parse::<T>()` | yes → `Result` |
| number → `String` | `n.to_string()` / `format!("{n}")` | no |
| `&str` → `String` | `s.to_string()` / `String::from(s)` / `s.to_owned()` | no |
| `String` → `&str` | `&s` / `s.as_str()` | no |
| `String` → `Vec<u8>` | `s.into_bytes()` | no |
| `&str` → `&[u8]` | `s.as_bytes()` | no |
| `Vec<u8>` → `String` | `String::from_utf8(v)` | yes → `Result` |
| `&[u8]` → `Cow<str>` | `String::from_utf8_lossy(b)` | no (bad bytes → `�`) |
| `char` → `String` | `c.to_string()` | no |
| `char` → digit | `c.to_digit(10)` | yes → `Option` |

## Literals: escapes, raw strings, and multi-line text

```rust
fn main() {
    // Escapes
    println!("tab:\tnewline↓\nquote:\"  backslash:\\  unicode:\u{1F980}");

    // Raw strings: no escape processing at all — great for regexes and paths
    println!("{}", r"C:\Users\new\table");
    println!("{}", r#"He said "hi" — quotes need the # form"#);

    // Multi-line literals keep their newlines and indentation:
    let block = "first
second";
    println!("{block}");

    // A trailing backslash swallows the newline AND the leading whitespace,
    // so you can wrap long text in source without changing the output:
    let long = "this is one \
                single line";
    println!("{long}");

    // Byte strings are &[u8; N], not text:
    let magic: &[u8; 4] = b"\x89PNG";
    println!("{magic:?}");
}
```

> [!tip] Raw strings save you from backslash soup
> `"\\d+\\.\\d+"` versus `r"\d+\.\d+"` — the raw form is what you'll want for every regex, Windows path, and JSON blob you embed in source. Add `#` symbols (`r#"…"#`, `r##"…"##`) when the text itself contains a quote.

> [!deep] What about grapheme clusters?
> Some things humans see as one "character" are several Unicode scalar values combined — like an emoji with a skin-tone modifier, or `e` + a combining accent. These are called **grapheme clusters**. Rust's standard library gives you *bytes* and *chars* (scalar values); if you need true user-perceived characters (for cursor movement in a text editor, or truncating a display name without mangling it), use the `unicode-segmentation` crate. For most programs, `.chars()` is exactly right.

## Summary

- **`String`** is owned and growable (ptr + len + capacity); **`&str`** is a borrowed window (ptr + len). Store `String`, accept `&str`.
- Build with `push_str`, `push`, `format!`, or `write!` into a buffer for loops. `+` moves its left operand.
- Rust strings are **UTF-8 bytes**: a character is 1–4 bytes, so **`len()` counts bytes**, and **numeric indexing (`s[0]`) is forbidden**.
- Choose your view: **`.chars()`**, **`.char_indices()`**, **`.bytes()`**, **`.lines()`**. Slice only on char boundaries — `.get(a..b)` is the panic-free form.
- Search with `contains`, `find` (a **byte** index), `strip_prefix`; a "pattern" can be a `&str`, `char`, or predicate.
- Split with `split`, **`split_once`** (key=value), `split_whitespace` (human text), `lines`; rejoin with `.join(sep)`.
- Trim, case-convert, and `replace` return **new** `String`s; case conversion can change the character count.
- `parse()` converts text to numbers and returns a **`Result`**; `from_utf8_lossy` rescues invalid bytes.
- Use **raw strings** (`r"…"`) for regexes and paths.

> [!exercise] Try it yourself
> 1. Print the byte length and character count of `"Grüße"` and explain the difference.
> 2. Parse the line `"host=localhost:5432"` into a host and a port using `split_once` twice, handling failure with `Option`.
> 3. Write a function `fn initials(name: &str) -> String` that turns `"ada lovelace"` into `"A.L."` using `split_whitespace`, `chars().next()`, and `to_uppercase`.
> 4. Take `"café"` and try `&s[0..4]`. Predict what happens, then use `.get(0..4)` and `.is_char_boundary(4)` to handle it without panicking.
> 5. Build a comma-separated list of the numbers 1–100 using `write!` into a pre-sized `String`, and compare your code to a version using `format!` in a loop.

Next, the collection for looking things up by key rather than position: the **hash map**.
