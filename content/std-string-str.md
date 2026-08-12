<h1><span class="h1-kicker">The Standard Library, Deep</span>String, str & Text Types</h1>

The [Strings chapter](#/ch/strings) covered UTF-8 and the `String`/`&str` split. This reference goes wider: the full family of text types (`String`, `str`, `OsString`, `CString`, `Cow`), the method cheat-sheet you'll use daily, and parsing. When you need to *do something* with text, the recipe is here.

## The text-type family

Rust has several string types because "text" means different things in different contexts. You'll use the first two constantly and the rest occasionally:

| Type | Owned/Borrowed | Encoding | Use for |
|------|----------------|----------|---------|
| `String` | owned | UTF-8 | growable text you own |
| `&str` | borrowed | UTF-8 | a view into text (params, literals) |
| `OsString` / `&OsStr` | owned / borrowed | OS-native | filenames/env from the OS (may not be UTF-8) |
| `CString` / `&CStr` | owned / borrowed | null-terminated bytes | passing strings to C ([FFI](#/ch/ffi)) |
| `Cow<str>` | either | UTF-8 | "borrow if possible, own only if I must" |
| `Box<str>` | owned | UTF-8 | a `String` with no spare capacity (compact) |

> [!key] The `String`/`&str` relationship is the pattern
> `String` : `&str` :: `PathBuf` : `&Path` :: `OsString` : `&OsStr` :: `Vec<T>` : `&[T]`. Every "owned vs borrowed" pair in Rust follows this shape — an owned, growable container and a borrowed view into it. Learn it once and all of std's type pairs make sense: **own to store and build, borrow to read and pass**.

## Bytes, chars, and what humans call a character

Every `String` and `&str` in Rust is **UTF-8 bytes**. That single fact explains almost every string API decision: why `len()` counts bytes, why you can't write `s[0]`, why slicing can panic, and why `.chars()` exists at all.

<figure class="diagram">
<svg viewBox="0 0 640 262" role="img" aria-label="The string a-e-acute-kanji-crab stored as ten UTF-8 bytes: a takes one byte, e-acute takes two, the kanji takes three, and the crab emoji takes four; the legal slice boundaries are byte indices 0, 1, 3, 6 and 10">
  <style>
    .u8-h { font: 700 11px var(--font-sans); fill: var(--text-mute); }
    .u8-ch { font: 600 15px var(--font-sans); fill: var(--text); }
    .u8-n { font: 600 10px var(--font-mono); fill: var(--text); }
    .u8-i { font: 9.5px var(--font-mono); fill: var(--text-mute); }
    .u8-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .u8-g1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .u8-g2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .u8-cell { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.1; }
  </style>
  <text x="20" y="16" class="u8-h">let s = "aé漢🦀";  s.len() == 10 bytes,  s.chars().count() == 4</text>
  <rect x="60" y="30" width="52" height="34" rx="3" class="u8-g1"/><text x="78" y="53" class="u8-ch">a</text>
  <rect x="112" y="30" width="104" height="34" rx="3" class="u8-g2"/><text x="152" y="53" class="u8-ch">é</text>
  <rect x="216" y="30" width="156" height="34" rx="3" class="u8-g1"/><text x="282" y="53" class="u8-ch">漢</text>
  <rect x="372" y="30" width="208" height="34" rx="3" class="u8-g2"/><text x="462" y="53" class="u8-ch">🦀</text>
  <rect x="60" y="70" width="52" height="28" class="u8-cell"/><text x="70" y="89" class="u8-n">97</text>
  <rect x="112" y="70" width="52" height="28" class="u8-cell"/><text x="118" y="89" class="u8-n">195</text>
  <rect x="164" y="70" width="52" height="28" class="u8-cell"/><text x="170" y="89" class="u8-n">169</text>
  <rect x="216" y="70" width="52" height="28" class="u8-cell"/><text x="222" y="89" class="u8-n">230</text>
  <rect x="268" y="70" width="52" height="28" class="u8-cell"/><text x="274" y="89" class="u8-n">188</text>
  <rect x="320" y="70" width="52" height="28" class="u8-cell"/><text x="326" y="89" class="u8-n">162</text>
  <rect x="372" y="70" width="52" height="28" class="u8-cell"/><text x="378" y="89" class="u8-n">240</text>
  <rect x="424" y="70" width="52" height="28" class="u8-cell"/><text x="430" y="89" class="u8-n">159</text>
  <rect x="476" y="70" width="52" height="28" class="u8-cell"/><text x="482" y="89" class="u8-n">166</text>
  <rect x="528" y="70" width="52" height="28" class="u8-cell"/><text x="534" y="89" class="u8-n">128</text>
  <text x="82" y="112" class="u8-i">0</text><text x="134" y="112" class="u8-i">1</text><text x="186" y="112" class="u8-i">2</text>
  <text x="238" y="112" class="u8-i">3</text><text x="290" y="112" class="u8-i">4</text><text x="342" y="112" class="u8-i">5</text>
  <text x="394" y="112" class="u8-i">6</text><text x="446" y="112" class="u8-i">7</text><text x="498" y="112" class="u8-i">8</text><text x="550" y="112" class="u8-i">9</text>
  <text x="20" y="140" class="u8-h" fill="var(--green)">legal slice boundaries</text>
  <path d="M60 126 L60 146" stroke="var(--green)" stroke-width="2"/><text x="54" y="160" class="u8-i" fill="var(--green)">0</text>
  <path d="M112 126 L112 146" stroke="var(--green)" stroke-width="2"/><text x="106" y="160" class="u8-i" fill="var(--green)">1</text>
  <path d="M216 126 L216 146" stroke="var(--green)" stroke-width="2"/><text x="210" y="160" class="u8-i" fill="var(--green)">3</text>
  <path d="M372 126 L372 146" stroke="var(--green)" stroke-width="2"/><text x="366" y="160" class="u8-i" fill="var(--green)">6</text>
  <path d="M580 126 L580 146" stroke="var(--green)" stroke-width="2"/><text x="572" y="160" class="u8-i" fill="var(--green)">10</text>
  <text x="20" y="188" class="u8-c"><tspan font-family="var(--font-mono)">&amp;s[1..3]</tspan> is <tspan font-family="var(--font-mono)">"é"</tspan> — both ends land on a boundary, so it is a valid <tspan font-family="var(--font-mono)">&amp;str</tspan>.</text>
  <text x="20" y="206" class="u8-c" fill="var(--red)"><tspan font-family="var(--font-mono)">&amp;s[0..2]</tspan> <tspan font-weight="700">panics</tspan> — index 2 is inside <tspan font-family="var(--font-mono)">é</tspan>, and half a character is not text.</text>
  <text x="20" y="224" class="u8-c">Indices are always <tspan font-style="italic">byte</tspan> offsets: <tspan font-family="var(--font-mono)">find</tspan>, <tspan font-family="var(--font-mono)">char_indices</tspan> and slices all speak bytes, never characters.</text>
  <text x="20" y="242" class="u8-c">This is why ASCII text is as compact as it gets in Rust, and why <tspan font-family="var(--font-mono)">.chars().nth(i)</tspan> has to walk from the start.</text>
  <text x="20" y="258" class="u8-c">A leading byte announces the length (1–4), so the decoder never needs a table — that is UTF-8's whole trick.</text>
</svg>
<figcaption>UTF-8 layout of a four-character string: one, two, three, and four bytes — and the only five byte indices you may slice at.</figcaption>
</figure>

```rust
fn main() {
    let s = "aé漢🦀";
    println!("len (bytes)   {}", s.len());
    println!("chars         {}", s.chars().count());
    println!("char_indices  {:?}", s.char_indices().collect::<Vec<_>>());
    println!("bytes         {:?}", s.as_bytes());
    println!("utf8 widths   {:?}", s.chars().map(|c| c.len_utf8()).collect::<Vec<_>>());

    // Slicing uses BYTE indices and must land on a char boundary.
    println!("&s[0..1]      {:?}", &s[0..1]);
    println!("&s[1..3]      {:?}", &s[1..3]);
    println!("get(0..2)     {:?}", s.get(0..2));       // None -- would split é
    println!("boundary at 2? {}", s.is_char_boundary(2));
    println!("every boundary {:?}",
             (0..=s.len()).filter(|i| s.is_char_boundary(*i)).collect::<Vec<_>>());

    // There is no s[0]: index by byte or by char explicitly.
    println!("first byte    {}", s.as_bytes()[0]);
    println!("first char    {:?}", s.chars().next());
    println!("3rd char      {:?}", s.chars().nth(2));  // O(n), not O(1)

    // Reversing works on chars, not bytes.
    println!("reversed      {}", s.chars().rev().collect::<String>());
}
```

```text
len (bytes)   10
chars         4
char_indices  [(0, 'a'), (1, 'é'), (3, '漢'), (6, '🦀')]
bytes         [97, 195, 169, 230, 188, 162, 240, 159, 166, 128]
utf8 widths   [1, 2, 3, 4]
&s[0..1]      "a"
&s[1..3]      "é"
get(0..2)     None
boundary at 2? false
every boundary [0, 1, 3, 6, 10]
first byte    97
first char    Some('a')
3rd char      Some('漢')
reversed      🦀漢éa
```

> [!mistake] `s[0]` doesn't compile, and `&s[0..n]` can panic
> `String` deliberately does not implement `Index<usize>`: returning a byte would be wrong for text, and returning a `char` would be a silent O(n) walk. Use `s.as_bytes()[0]` for a byte, `s.chars().next()` for the first character, or `s.chars().nth(i)` when you accept the linear cost. Range slicing *does* exist but panics on a non-boundary index — use **`s.get(a..b)`** for the `Option` version, or `is_char_boundary` to check first. When you need random access by character often, convert once: `let chars: Vec<char> = s.chars().collect();`.

### One "character" is not one `char`

A `char` is a Unicode scalar value — not a thing a reader would point at. Accented letters can be composed of two `char`s, flags are two, and emoji families are five:

```rust
fn main() {
    // One "character" as a human sees it can be many chars.
    let precomposed = "é";            // U+00E9
    let decomposed = "e\u{301}";      // e + COMBINING ACUTE ACCENT
    println!("look the same: {precomposed} vs {decomposed}");
    println!("equal? {} | chars {} vs {} | bytes {} vs {}",
             precomposed == decomposed,
             precomposed.chars().count(), decomposed.chars().count(),
             precomposed.len(), decomposed.len());

    let flag = "🇮🇳";
    let family = "👨‍👩‍👧";
    println!("flag:   {} chars, {} bytes", flag.chars().count(), flag.len());
    println!("family: {} chars, {} bytes", family.chars().count(), family.len());

    // Case conversion can change the length -- it is not a per-char mapping.
    println!("ß -> {:?} ({} chars)", "ß".to_uppercase(), "ß".to_uppercase().chars().count());
    println!("İ -> {:?}", "İ".to_lowercase());
    println!("ascii-only, cheap: {:?} {}", "MiXeD".to_ascii_lowercase(),
             "HELLO".eq_ignore_ascii_case("hello"));
}
```

```text
look the same: é vs é
equal? false | chars 1 vs 2 | bytes 2 vs 3
flag:   2 chars, 8 bytes
family: 5 chars, 18 bytes
ß -> "SS" (2 chars)
İ -> "i\u{307}"
ascii-only, cheap: "mixed" true
```

| Question | Answer in Rust |
|---|---|
| How many bytes? | `s.len()` — O(1) |
| How many `char`s? | `s.chars().count()` — O(n) |
| How many *visible* characters? | not in `std` — use the `unicode-segmentation` crate's `graphemes()` |
| How wide on screen? | not in `std` — `unicode-width` (CJK and emoji are double-width) |
| Are these two strings "the same word"? | normalize first (`unicode-normalization`), then compare |

> [!warning] `==` on strings is byte equality, not "looks the same"
> `"é" == "e\u{301}"` is **false**: same appearance, different bytes. Text arriving from macOS filesystems, web forms, or different keyboards can be normalized differently, so a naive `==` or `HashSet<String>` will treat visually identical names as distinct. Normalize to NFC at your program's boundary (with `unicode-normalization`) and compare after. Likewise, `to_uppercase` is *not* length-preserving — `"ß"` becomes `"SS"` — so never assume a case conversion keeps byte offsets valid.

> [!performance] Prefer the `ascii` variants when you know the input is ASCII
> `to_ascii_lowercase`, `eq_ignore_ascii_case`, and `char::is_ascii_digit` are simple byte operations with no Unicode tables involved, while `to_lowercase` must consult full case-mapping data and can allocate a different length. For protocol keywords, HTTP headers, and hex digits — all ASCII by definition — the ASCII versions are both faster and more predictable.

## The everyday method cheat-sheet

```rust
fn main() {
    let s = "  Hello, World!  ";

    // Trimming & case
    println!("{:?}", s.trim());               // "Hello, World!"
    println!("{}", "MiXeD".to_lowercase());    // "mixed"
    println!("{}", "yell".to_uppercase());     // "YELL"

    // Searching
    println!("{}", s.contains("World"));        // true
    println!("{}", s.trim().starts_with("Hello")); // true
    println!("{:?}", s.find("World"));          // Some(9) — byte index

    // Replacing & splitting
    println!("{}", "a-b-c".replace('-', "/"));  // "a/b/c"
    let parts: Vec<&str> = "a,b,c".split(',').collect();
    println!("{parts:?}");                       // ["a", "b", "c"]
    println!("{}", parts.join(" + "));           // "a + b + c"

    // Building
    let joined = ["x", "y", "z"].concat();       // "xyz"
    println!("{joined}");
}
```

| Task | Method(s) |
|------|-----------|
| Remove whitespace | `trim`, `trim_start`, `trim_end` |
| Change case | `to_lowercase`, `to_uppercase` |
| Search | `contains`, `starts_with`, `ends_with`, `find`, `rfind` |
| Split | `split`, `splitn`, `split_whitespace`, `lines` |
| Join | `[..].join(sep)`, `[..].concat()` |
| Replace | `replace`, `replacen` |
| Slice by char | `.chars()`, `.char_indices()`, `.bytes()` |
| Length / empty | `.len()` (bytes!), `.is_empty()`, `.chars().count()` |
| Grow | `push`, `push_str`, `+`, `format!` |

## Splitting and searching: the full family

Most text work is splitting on a delimiter and picking things apart. The variants matter, and the empty-field behaviour is where bugs hide:

```rust
fn main() {
    // split family
    println!("{:?}", "a,b,c".split(',').collect::<Vec<_>>());
    println!("{:?}", "a,,b".split(',').collect::<Vec<_>>());        // empty field kept
    println!("{:?}", "".split(',').collect::<Vec<_>>());            // ONE empty string
    println!("{:?}", "a,b,".split_terminator(',').collect::<Vec<_>>());
    println!("{:?}", "  a  b ".split_whitespace().collect::<Vec<_>>());
    println!("{:?}", "k=v=w".splitn(2, '=').collect::<Vec<_>>());
    println!("{:?}", "k=v=w".rsplitn(2, '=').collect::<Vec<_>>());
    println!("{:?}", "a1b2c".split(|c: char| c.is_ascii_digit()).collect::<Vec<_>>());
    println!("{:?}", "a-b_c".split(['-', '_']).collect::<Vec<_>>());

    // split_once / rsplit_once: the key=value workhorses
    println!("{:?}", "key=value=extra".split_once('='));
    println!("{:?}", "key=value=extra".rsplit_once('='));
    println!("{:?}", "novalue".split_once('='));

    // strip_prefix / strip_suffix beat starts_with + slicing
    println!("{:?}", "--verbose".strip_prefix("--"));
    println!("{:?}", "file.txt".strip_suffix(".txt"));
    println!("{:?}", "file.txt".strip_suffix(".md"));

    // trim variants take a pattern, not just whitespace
    println!("{:?}", "xxhixx".trim_matches('x'));
    println!("{:?}", "0042".trim_start_matches('0'));
    println!("{:?}", "a\r\nb\n".lines().collect::<Vec<_>>());   // \r\n handled

    // find and friends return BYTE indices
    println!("{:?} {:?}", "hello".find('l'), "hello".rfind('l'));
    println!("{:?}", "hello".find(|c: char| c.is_ascii_uppercase()));
    println!("{:?}", "abcabc".match_indices("bc").collect::<Vec<_>>());
    println!("{}", "abcabc".matches('a').count());
    println!("{:?}", "a-b-c".replacen('-', "+", 1));
}
```

```text
["a", "b", "c"]
["a", "", "b"]
[""]
["a", "b"]
["a", "b"]
["k", "v=w"]
["w", "k=v"]
["a", "b", "c"]
["a", "b", "c"]
Some(("key", "value=extra"))
Some(("key=value", "extra"))
None
Some("verbose")
Some("file")
None
"hi"
"42"
["a", "b"]
Some(2) Some(3)
None
[(1, "bc"), (4, "bc")]
2
"a+b-c"
```

| Want | Use | Note |
|---|---|---|
| all fields, keeping empties | `split(pat)` | `"a,,b"` → 3 fields; `""` → **one** empty field |
| fields with no trailing empty | `split_terminator(pat)` | `"a,b,"` → 2 fields — right for line-terminated data |
| words, any run of whitespace | `split_whitespace()` | never yields empties; `split_ascii_whitespace` is faster |
| key and the rest | `split_once(pat)` → `Option<(&str, &str)>` | the correct tool for `key=value` |
| the last field and the rest | `rsplit_once(pat)` | file extensions, last path segment |
| at most n pieces | `splitn(n, pat)` / `rsplitn(n, pat)` | the final piece keeps the remaining delimiters |
| remove a prefix/suffix if present | `strip_prefix` / `strip_suffix` → `Option` | replaces `starts_with` + slicing |
| trim a specific pattern | `trim_matches`, `trim_start_matches`, `trim_end_matches` | repeats until it no longer matches |
| every match position | `match_indices(pat)`, `matches(pat)` | byte offsets, and the matched text |
| lines of text | `lines()` | strips `\n` **and** `\r\n` |

> [!key] A "pattern" is anything that can describe a match
> Every one of these methods accepts a `char`, a `&str`, a `&[char]`, or a **closure** `|c: char| -> bool` — that's the `Pattern` trait. So `s.split(char::is_numeric)`, `s.trim_matches(['"', '\''])`, and `s.find(|c: char| !c.is_alphanumeric())` all just work. Learning this once removes the urge to reach for a regex for simple jobs.

> [!mistake] `"".split(',')` yields one empty string, not zero fields
> An empty input produces `[""]`, so a CSV parser that counts fields sees **1**, not 0 — and `"a,b,".split(',')` gives a trailing `""` that becomes a phantom record. Use `split_terminator` for terminated data, or filter with `.filter(|f| !f.is_empty())` when empty fields are meaningless. This is the single most common off-by-one in hand-rolled text parsing.

## Building strings

```rust
use std::fmt::Write as _;

fn main() {
    // Four ways to build a String, and what each costs.
    let mut a = String::new();
    a.push_str("hello");
    a.push(' ');
    a.push_str("world");

    let b = format!("{} {}", "hello", "world");            // allocates once, most flexible
    let c = String::from("hello") + " " + "world";          // + takes String on the LEFT, &str on the right
    let d = ["hello", "world"].join(" ");
    let mut e = String::with_capacity(11);
    write!(e, "{} {}", "hello", "world").unwrap();          // needs `use std::fmt::Write`
    println!("{}", [a == b, b == c, c == d, d == e].iter().all(|x| *x));

    // Growth: capacity doubles, so with_capacity avoids the copies.
    let mut g = String::new();
    let mut caps = vec![];
    for ch in "abcdefghijklmnopqrstuvwxyz".chars() {
        g.push(ch);
        if caps.last() != Some(&g.capacity()) { caps.push(g.capacity()); }
    }
    println!("capacity steps {caps:?}");

    // repeat, chars().collect, extend
    println!("{:?}", "ab".repeat(3));
    let upper: String = "hello".chars().map(|c| c.to_ascii_uppercase()).collect();
    println!("{upper}");
    let mut ext = String::from("x");
    ext.extend(['y', 'z']);
    println!("{ext}");

    // Bytes <-> text
    let bytes = "héllo".as_bytes().to_vec();
    println!("{:?}", String::from_utf8(bytes.clone()).unwrap());
    let bad = vec![0x68, 0x69, 0xff];
    println!("{:?}", String::from_utf8(bad.clone()).err().map(|e| e.utf8_error().valid_up_to()));
    println!("{:?}", String::from_utf8_lossy(&bad));

    // Compact ownership: Box<str> drops the capacity field
    let s = String::from("compact");
    let boxed: Box<str> = s.into_boxed_str();
    println!("Box<str> {} bytes vs String {} bytes",
             std::mem::size_of_val(&boxed), std::mem::size_of::<String>());
    let back: String = boxed.into_string();
    println!("{back}");
}
```

```text
true
capacity steps [8, 16, 32]
"ababab"
HELLO
xyz
"héllo"
Some(2)
"hi�"
Box<str> 16 bytes vs String 24 bytes
compact
```

| To build | Use | Cost |
|---|---|---|
| append text repeatedly | `push_str` / `push` | amortized O(1), reuses the buffer |
| one formatted result | `format!("{a} {b}")` | one allocation, clearest |
| append formatted text to an existing `String` | `write!(&mut s, …)` with `use std::fmt::Write` | **no** intermediate allocation, unlike `s += &format!(…)` |
| concatenate a known list | `[..].concat()` / `[..].join(sep)` | pre-sizes exactly |
| repeat | `s.repeat(n)` | one allocation |
| transform char by char | `.chars().map(…).collect::<String>()` | pre-sized from the size hint |
| known final size | `String::with_capacity(n)` | avoids every regrowth |

> [!performance] `s += &format!(…)` allocates twice — `write!` allocates once
> Inside a loop, `out += &format!("{}: {}\n", k, v)` builds a throwaway `String` on every iteration and then copies it. `write!(out, "{}: {}\n", k, v).unwrap()` formats straight into `out`. The `unwrap` is safe here: writing to a `String` cannot fail, which is why `fmt::Write` for `String` always returns `Ok`. Bring it in with `use std::fmt::Write` (or `use std::fmt::Write as _` if you only need the methods) — forgetting the import is the usual reason `write!` "doesn't exist" on a `String`.

> [!note] `from_utf8` vs `from_utf8_lossy`
> `String::from_utf8(vec)` validates and hands back the bad byte's position via `e.utf8_error().valid_up_to()` — use it when invalid input is an error worth reporting. `String::from_utf8_lossy(&bytes)` replaces each invalid sequence with `�` (U+FFFD) and returns a `Cow` — use it for logs and display, where getting *something* readable beats failing. Validation is a cheap linear scan, not a copy, so neither is expensive.

## Parsing text into other types

The **`parse`** method (from the `FromStr` trait) turns text into numbers, booleans, IP addresses, and any type that implements `FromStr` — returning a `Result`:

```rust
use std::net::IpAddr;

fn main() {
    let n: i32 = "42".parse().unwrap();
    let pi: f64 = "3.14".parse().unwrap();
    let flag: bool = "true".parse().unwrap();
    let ip: IpAddr = "127.0.0.1".parse().unwrap();

    println!("{n} {pi} {flag} {ip}");

    // parse returns a Result, so handle failure properly:
    match "not a number".parse::<i32>() {
        Ok(v) => println!("got {v}"),
        Err(e) => println!("parse failed: {e}"),
    }
}
```

> [!tip] The target type drives `parse`
> `parse` is generic over its return type, so Rust needs to know what you want: annotate the binding (`let n: i32 = "5".parse()?`) or use the turbofish (`"5".parse::<i32>()`). Implement **`FromStr`** for your own type and it too gains `.parse()` for free — a clean way to build a value from a string.

Here is that last claim made concrete, together with the parsing helpers that aren't `parse` itself:

```rust
use std::str::FromStr;

/// Implementing FromStr gives your type `.parse()` for free.
#[derive(Debug, PartialEq)]
struct Rgb(u8, u8, u8);

impl FromStr for Rgb {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let hex = s.strip_prefix('#').ok_or("must start with #")?;
        if hex.len() != 6 { return Err(format!("expected 6 hex digits, got {}", hex.len())); }
        let byte = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string());
        Ok(Rgb(byte(0)?, byte(2)?, byte(4)?))
    }
}

fn main() {
    println!("{:?}", "#ff8800".parse::<Rgb>());
    println!("{:?}", "ff8800".parse::<Rgb>());
    println!("{:?}", "#ffff".parse::<Rgb>());
    println!("{:?}", i64::from_str_radix("-7f", 16));   // any base from 2 to 36
    println!("{:?}", " 42 ".trim().parse::<u32>());     // parse does NOT trim for you
    println!("{:?}", "1e3".parse::<f64>());             // scientific notation is fine
    println!("{:?}", "".parse::<i32>().unwrap_err().to_string());
}
```

```text
Ok(Rgb(255, 136, 0))
Err("must start with #")
Err("expected 6 hex digits, got 4")
Ok(-127)
Ok(42)
Ok(1000.0)
"cannot parse integer from empty string"
```

> [!mistake] `parse` doesn't trim, and it rejects what you might expect to work
> `" 42".parse::<u32>()` fails, `"42\n".parse::<i32>()` fails (a very common bug when parsing `read_line` input), `"+7"` succeeds, `"4.0".parse::<i32>()` fails, `"0x1f"` fails, and `"1_000".parse::<i32>()` fails even though the *literal* `1_000` is valid Rust. `"TRUE".parse::<bool>()` fails too — only exactly `"true"`/`"false"` are accepted. Always `.trim()` input you got from a human or a file. For non-decimal bases use `from_str_radix`, which is where hex, octal, and binary parsing live. (Floats are more permissive: `"1e3"`, `"inf"` and `"NaN"` all parse.)

## `Cow`: borrow when you can, own when you must

**`Cow`** (*clone-on-write*) is a clever type that holds *either* a borrow *or* an owned value. It lets a function avoid allocating in the common case (no change needed) while still being able to produce an owned result when it must modify:

```rust
use std::borrow::Cow;

// Returns the input unchanged (borrowed, no allocation) OR a fixed copy (owned):
fn sanitize(input: &str) -> Cow<str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_")) // had to change it → allocate
    } else {
        Cow::Borrowed(input)                 // already clean → no allocation!
    }
}

fn main() {
    println!("{}", sanitize("already_clean")); // borrowed — zero allocation
    println!("{}", sanitize("needs fixing"));  // owned — "needs_fixing"
}
```

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="Cow holds either a borrowed reference or an owned value, allocating only when needed">
  <style>
    .cwm { font: 600 12px var(--font-mono); fill: var(--text); }
    .cwc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .bor2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .own2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="cwm">Cow&lt;str&gt; =</text>
  <rect x="120" y="12" width="230" height="34" rx="8" class="bor2"/><text x="134" y="34" class="cwm">Borrowed(&amp;str) — no allocation</text>
  <text x="360" y="34" class="cwc">(the common, cheap case)</text>
  <rect x="120" y="56" width="230" height="34" rx="8" class="own2"/><text x="134" y="78" class="cwm">Owned(String) — allocates</text>
  <text x="360" y="78" class="cwc">(only when it had to change)</text>
</svg>
<figcaption><code>Cow</code> avoids allocation when no change is needed, yet can own a result when it is.</figcaption>
</figure>

> [!best] Use `Cow` for "usually unchanged" text APIs
> Functions like "escape this string if it has special characters" or "normalize this path" often leave the input untouched. Returning `Cow<str>` means the caller pays for an allocation **only** in the rare case a change was needed — otherwise it's a free borrow. It's a favorite optimization in parsing and text-processing libraries.

Three more `Cow` methods make it practical: `to_mut` (start borrowing, clone only when you actually write), `into_owned` (force a `String` out), and `Deref` (so every `&str` method just works on a `Cow`):

```rust
use std::borrow::Cow;

fn escape(input: &str) -> Cow<'_, str> {
    if input.contains('<') { Cow::Owned(input.replace('<', "&lt;")) } else { Cow::Borrowed(input) }
}

fn main() {
    for s in ["plain", "a <tag>"] {
        let c = escape(s);
        println!("{:?} -> {:?} (allocated: {})", s, c, matches!(c, Cow::Owned(_)));
    }

    let mut c = escape("plain");     // Borrowed
    c.to_mut().push('!');            // to_mut clones ON DEMAND, turning it Owned
    println!("after to_mut: {c:?}");

    let owned: String = escape("x").into_owned();
    println!("into_owned: {owned:?}");
    println!("len via Deref: {}", escape("abc").len());
}
```

```text
"plain" -> "plain" (allocated: false)
"a <tag>" -> "a &lt;tag>" (allocated: true)
after to_mut: "plain!"
into_owned: "x"
len via Deref: 3
```

## Choosing the parameter type

Your signature decides who can call you and who pays for allocations. Four options, in the order you should reach for them:

```rust
// Four ways to accept text, and what each costs the caller.
fn read_only(s: &str) -> usize { s.len() }                       // the default choice
fn generic<S: AsRef<str>>(s: S) -> usize { s.as_ref().len() }    // accepts String, &str, Cow, Box<str>
fn takes_ownership(s: impl Into<String>) -> String { s.into() }   // callers may avoid a clone
fn bad(s: &String) -> usize { s.len() }                          // needlessly restrictive

fn main() {
    let owned = String::from("hello");
    let slice: &str = "hello";

    println!("{} {}", read_only(slice), read_only(&owned));  // deref coercion: &String -> &str
    println!("{} {} {}", generic(slice), generic(owned.clone()),
                         generic(std::borrow::Cow::Borrowed("hi")));
    println!("{:?} {:?}", takes_ownership("literal"), takes_ownership(owned.clone()));
    println!("{}", bad(&owned));                              // ...but bad(slice) would NOT compile

    // Conversions, both directions
    let a: String = "x".to_string();
    let b: String = "x".to_owned();
    let c: String = String::from("x");
    let d: String = "x".into();
    println!("{}", [&a, &b, &c, &d].iter().all(|s| *s == &a));
    let back: &str = a.as_str();
    println!("{back} {}", &a[..]);
    let bytes: Vec<u8> = a.clone().into_bytes();
    println!("{:?} -> {:?}", bytes, String::from_utf8(bytes.clone()).unwrap());
    println!("char to String: {:?}", 'q'.to_string());
    println!("Vec<char> to String: {:?}", vec!['a', 'b'].into_iter().collect::<String>());
}
```

```text
5 5
5 5 2
"literal" "hello"
5
true
x x
[120] -> "x"
char to String: "q"
Vec<char> to String: "ab"
```

| Signature | Accepts | Reach for it when |
|---|---|---|
| `&str` | `&str`, `&String` (deref coercion), `&Cow<str>` | **the default** — you only read the text |
| `impl AsRef<str>` | all of the above by value too, plus `Box<str>`, `Rc<str>` | a convenience API where callers hold varied types |
| `impl Into<String>` | `&str`, `String`, `Cow<str>` | you will store it — a `String` caller then avoids a clone entirely |
| `&String` | only `&String` | **never**; it buys nothing and rejects literals |

| Conversion | Call |
|---|---|
| `&str` → `String` | `to_string()`, `to_owned()`, `String::from(s)`, `s.into()` |
| `String` → `&str` | `as_str()`, `&s`, `&s[..]` |
| `String` ↔ `Box<str>` | `into_boxed_str()` / `into_string()` — drops the 8-byte capacity field |
| `String` ↔ `Vec<u8>` | `into_bytes()` / `String::from_utf8(v)` (validated) |
| `&str` → `&[u8]` | `as_bytes()` — free, no check needed |
| `char` → `String` | `c.to_string()`; `chars.collect::<String>()` for many |
| bytes → text, tolerantly | `String::from_utf8_lossy(&bytes)` |

> [!best] `&str` in, `String` out
> The convention that keeps APIs composable: accept the *borrowed* form and return the *owned* form. `fn slugify(title: &str) -> String` can be called with anything and returns something the caller can keep. If your function usually returns its input unchanged, upgrade the return type to `Cow<str>` rather than allocating for nothing.

## Summary

- The text family follows the **owned/borrowed** pattern: `String`/`&str` (UTF-8, everyday), `OsString`/`OsStr` (OS-native, filenames), `CString`/`CStr` (C FFI), `Cow<str>` (borrow-or-own), `Box<str>` (compact owned).
- Text is **UTF-8 bytes**: `len()` is bytes, indices are byte offsets, `s[0]` doesn't exist, and slicing panics off a char boundary (`get(a..b)` is the safe form).
- A `char` is a Unicode scalar, **not** a visible character — `"e\u{301}"` is two chars, a flag is two, an emoji family is five, and `"ß".to_uppercase()` is `"SS"`. Reach for `unicode-segmentation`/`unicode-normalization` when human characters matter.
- The daily toolkit: `trim`, case conversion, `contains`/`find`, `split`/`join`, `replace`, `chars`/`bytes`, `push_str`/`format!`.
- Splitting: **`split_once`/`rsplit_once`** for `key=value`, `split_terminator` for terminated data, `strip_prefix`/`strip_suffix` instead of `starts_with` + slicing — and remember `"".split(',')` yields **one** empty field.
- Any `char`, `&str`, `&[char]`, or closure works as a **pattern**, so most "I need a regex" moments don't.
- Build with `push_str` and `format!`; inside loops use **`write!` into the `String`** (with `use std::fmt::Write`) instead of `+= &format!(…)`, and `with_capacity` when the size is known.
- **`parse`** (via `FromStr`) converts text into numbers, bools, IPs, and your own types — it does **not** trim, and it rejects `"4.0"` as an `i32` and `"TRUE"` as a `bool`. `from_str_radix` handles other bases.
- **`Cow<str>`** holds a borrow *or* an owned value, allocating only when a change is required — with `to_mut` for lazy cloning and `into_owned` to force it.
- Signatures: **`&str` in, `String` out**; `impl AsRef<str>` for convenience, `impl Into<String>` when you'll store it, `&String` never.

> [!exercise] Try it yourself
> 1. Take `"  The Quick Brown Fox  "`, trim it, lowercase it, split into words, and join with `-`.
> 2. Parse `"3.5"`, `"100"`, and `"true"` into `f64`, `i32`, and `bool`, handling a bad input with `match`.
> 3. Write a `fn shout(s: &str) -> Cow<str>` that uppercases only if the string isn't already all-uppercase (borrowing otherwise).
> 4. For `"aé漢🦀"`, print every legal slice boundary, then write `fn safe_truncate(s: &str, max_bytes: usize) -> &str` that never panics (hint: walk down until `is_char_boundary`).
> 5. Parse a `.env`-style file (`KEY=value` lines, `#` comments, blank lines) into a `HashMap<String, String>` using `lines`, `trim`, `starts_with`, and `split_once`.
> 6. Implement `FromStr` for a `Version { major, minor, patch }` and make `"1.4.2".parse::<Version>()` work, with a clear error for `"1.4"`.
> 7. Build a 10,000-line report two ways — `out += &format!(…)` and `write!(out, …)` — and time both in release mode.
> 8. Write `fn word_count(text: &str) -> Vec<(String, usize)>` returning counts sorted by frequency then alphabetically, using `split_whitespace`, `trim_matches` for punctuation, and `to_ascii_lowercase`.

Next in the reference: measuring and working with **time and durations**.
