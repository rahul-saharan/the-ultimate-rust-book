<h1><span class="h1-kicker">Error Handling</span>Recoverable Errors: Result & Option</h1>

Most errors aren't bugs — they're just *life*. A file might not exist. A user might type "banana" where you wanted a number. A server might be briefly unreachable. These are **recoverable** errors: expected situations your program should handle gracefully, not crash on. Rust models them not with exceptions, but with two ordinary enums baked into the type system — **`Result`** and **`Option`** — and the result (pun intended) is error handling that's impossible to forget.

## Why not exceptions?

Rust's approach only makes sense against the thing it replaced. In most languages, a failure **throws**: control flow leaps out of your function, past every caller, until something catches it. Nothing in a function's signature tells you it can happen.

<figure class="diagram">
<svg viewBox="0 0 670 245" role="img" aria-label="With exceptions, an error thrown deep in a call stack invisibly unwinds past intermediate functions that never mentioned it. With Result, each function declares failure in its return type and the caller must handle it.">
  <style>
    .ex-h { font: 700 12px var(--font-sans); }
    .ex-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .ex-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .ex-f { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .ex-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .ex-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .ex-warn { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
  </style>
  <text x="12" y="17" class="ex-h" fill="var(--red)">Exceptions — invisible control flow</text>
  <rect x="12" y="28" width="150" height="24" rx="5" class="ex-f"/><text x="22" y="45" class="ex-m">main()</text>
  <rect x="30" y="58" width="150" height="24" rx="5" class="ex-warn"/><text x="40" y="75" class="ex-m">load_config()</text>
  <rect x="48" y="88" width="150" height="24" rx="5" class="ex-warn"/><text x="58" y="105" class="ex-m">read_file()</text>
  <rect x="66" y="118" width="150" height="24" rx="5" class="ex-bad"/><text x="76" y="135" class="ex-m">throw IOError</text>
  <path d="M228 130 C 268 130 268 44 176 40" stroke="var(--red)" stroke-width="2" fill="none" marker-end="url(#exa)"/>
  <text x="240" y="90" class="ex-c">flies past</text>
  <text x="240" y="104" class="ex-c">both frames</text>
  <text x="12" y="166" class="ex-c">Neither middle function mentions IOError.</text>
  <text x="12" y="182" class="ex-c">You cannot tell from a signature what may throw,</text>
  <text x="12" y="198" class="ex-c">and forgetting to catch compiles perfectly fine.</text>
  <text x="368" y="17" class="ex-h" fill="var(--green)">Result — failure is a value</text>
  <rect x="368" y="28" width="290" height="24" rx="5" class="ex-f"/><text x="378" y="45" class="ex-m">fn main()</text>
  <rect x="386" y="58" width="272" height="24" rx="5" class="ex-ok"/><text x="396" y="75" class="ex-m">fn load_config() -&gt; Result&lt;Config, E&gt;</text>
  <rect x="404" y="88" width="254" height="24" rx="5" class="ex-ok"/><text x="414" y="105" class="ex-m">fn read_file() -&gt; Result&lt;String, E&gt;</text>
  <rect x="422" y="118" width="236" height="24" rx="5" class="ex-ok"/><text x="432" y="135" class="ex-m">return Err(io_error)</text>
  <path d="M416 130 L404 130 L404 106" stroke="var(--green)" stroke-width="1.8" fill="none" marker-end="url(#exb)"/>
  <path d="M398 100 L386 100 L386 76" stroke="var(--green)" stroke-width="1.8" fill="none" marker-end="url(#exb)"/>
  <path d="M380 70 L368 70 L368 46" stroke="var(--green)" stroke-width="1.8" fill="none" marker-end="url(#exb)"/>
  <text x="368" y="166" class="ex-c">Every frame declares it can fail, and every caller</text>
  <text x="368" y="182" class="ex-c">must deal with the Err — the compiler checks.</text>
  <text x="368" y="198" class="ex-c">Verbose? The ? operator fixes that, next chapter.</text>
  <text x="12" y="230" class="ex-c">Same failure, two philosophies: hidden and automatic, versus visible and checked.</text>
  <defs>
    <marker id="exa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--red)"/></marker>
    <marker id="exb" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
  </defs>
</svg>
<figcaption>Exceptions travel invisibly through functions that never mention them. A <code>Result</code> is an ordinary value that every signature declares and every caller must handle.</figcaption>
</figure>

Rust makes the opposite trade: slightly more typing at each step, in exchange for never being surprised. There is no `throw`, no `catch`, and no hidden exit path from a function.

## `Result`: success or failure, in the type

Any operation that can fail returns a **`Result<T, E>`** — an enum with two variants:

```rust,ignore
enum Result<T, E> {
    Ok(T),   // success, carrying a value of type T
    Err(E),  // failure, carrying an error of type E
}
```

Because the *possibility of failure is right there in the return type*, you can't accidentally ignore it. Here's parsing a string into a number, which might fail:

```rust
fn main() {
    let good: Result<i32, _> = "42".parse();
    let bad: Result<i32, _> = "oops".parse();

    println!("{good:?}"); // Ok(42)
    println!("{bad:?}");  // Err(ParseIntError { .. })
}
```

> [!key] There is nothing magic about `Result`
> `Result` is not a compiler feature — it's an ordinary `enum` defined in the standard library, in about four lines, using only [enums](#/ch/enums) and [generics](#/ch/generics) you already know. You could write it yourself. Everything that makes it feel special (`?`, exhaustive matching, the "must handle it" pressure) comes from features that work on *any* enum. That's worth internalizing early: Rust's error handling isn't a separate subsystem bolted onto the language, it's ordinary types plus a very good `match`.

## Handling a `Result` with `match`

The most explicit way to deal with a `Result` is `match` — you handle success and failure side by side:

```rust
fn main() {
    let input = "57";

    match input.parse::<i32>() {
        Ok(number) => println!("Success! Doubled: {}", number * 2),
        Err(error) => println!("Couldn't parse '{input}': {error}"),
    }
}
```

> [!key] Errors as values, not exceptions
> In many languages an error *throws* — it invisibly jumps out of your function and can appear anywhere, so you're never quite sure what might fail. In Rust an error is just a **return value**. Failure is visible in the function's signature, checked by the compiler, and handled with the same tools as any other value. No hidden control flow, no forgotten `catch`.

`match` is **exhaustive**: leave off the `Err` arm and the code doesn't compile. That's not pedantry — it's the mechanism that makes forgetting impossible:

```text
error[E0004]: non-exhaustive patterns: `Err(_)` not covered
 --> src/main.rs:4:11
  |
4 |     match input.parse::<i32>() {
  |           ^^^^^^^^^^^^^^^^^^^^ pattern `Err(_)` not covered
```

## You can't silently ignore a `Result`

Even without `match`, Rust pushes back. `Result` is marked **`#[must_use]`**, so discarding one produces a warning:

```rust
fn might_fail(n: i32) -> Result<i32, String> {
    if n > 0 { Ok(n * 2) } else { Err("must be positive".to_string()) }
}

fn main() {
    // Deliberately ignoring the result — the compiler warns about this:
    //   warning: unused `Result` that must be used
    // let _ = might_fail(-1);   // ← `let _ =` is the explicit "yes, I mean it"

    // The honest options are: handle it…
    match might_fail(-1) {
        Ok(v) => println!("got {v}"),
        Err(e) => println!("failed: {e}"),
    }
    // …or state clearly that you're discarding it:
    let _ = might_fail(-1);
    println!("done");
}
```

> [!mistake] `let _ = …` silences the warning without handling anything
> Writing `let _ = fallible();` is a legitimate way to say "I know this can fail and I genuinely don't care" — flushing a log on shutdown, say. But it's also the easiest way to hide a real bug, because it looks deliberate. The difference between good and bad use is whether you could explain *why* the failure is safe to drop. If you can't, you're not ignoring an error, you're losing one. In a code review, treat every `let _ =` on a `Result` as something that needs a comment.

## `Option`: present or absent

You met `Option<T>` with enums — it's `Result`'s sibling for when something might simply be *missing*, with no error to report:

```rust,ignore
enum Option<T> {
    Some(T), // there is a value
    None,    // there isn't
}
```

Use **`Result`** when a failure has a *reason* worth reporting (why did parsing fail?); use **`Option`** when absence needs no explanation (the list was empty; the key wasn't there):

```rust
fn main() {
    let numbers = vec![1, 2, 3];

    match numbers.first() { // returns Option<&i32>
        Some(first) => println!("first is {first}"),
        None => println!("the list is empty"),
    }
}
```

> [!deep] `Option` is Rust's answer to the billion-dollar mistake
> Tony Hoare, who introduced null references in 1965, later called them his "billion-dollar mistake" — decades of crashes from values that claimed to be an object and weren't. **Rust has no null.** A `String` is always a valid string; there is no way for it to secretly be nothing. When a value may be absent, that possibility is a *different type* — `Option<String>` — and the compiler will not let you use it as a `String` until you've dealt with the `None` case. The entire category of null-pointer exceptions simply cannot be written. This is arguably the single highest-value thing the type system does for you, and it costs nothing at runtime, as the next section shows.

## `Option` is usually free

A reasonable worry: doesn't wrapping everything in an enum cost memory and speed? For the common cases, **no** — the compiler uses a trick called the **niche optimization**. A reference can never be null, so `Option<&T>` stores `None` *as* the all-zero bit pattern that a valid reference could never have. No extra byte, no tag:

```rust
use std::mem::size_of;

fn main() {
    println!("{:<14}{:>3}   {:<22}{:>3}", "i32", size_of::<i32>(),
             "Option<i32>", size_of::<Option<i32>>());
    println!("{:<14}{:>3}   {:<22}{:>3}", "&i32", size_of::<&i32>(),
             "Option<&i32>", size_of::<Option<&i32>>());
    println!("{:<14}{:>3}   {:<22}{:>3}", "Box<i32>", size_of::<Box<i32>>(),
             "Option<Box<i32>>", size_of::<Option<Box<i32>>>());
    println!("{:<14}{:>3}   {:<22}{:>3}", "String", size_of::<String>(),
             "Option<String>", size_of::<Option<String>>());
}
```

Running that prints:

```text
i32             4   Option<i32>             8
&i32            8   Option<&i32>            8
Box<i32>        8   Option<Box<i32>>        8
String         24   Option<String>         24
```

<figure class="diagram">
<svg viewBox="0 0 660 190" role="img" aria-label="Option of i32 needs a separate tag byte plus padding, growing from four bytes to eight. Option of a reference reuses the impossible null bit pattern as None, so it stays eight bytes with no tag at all.">
  <style>
    .no-h { font: 700 11.5px var(--font-sans); }
    .no-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .no-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .no-d { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .no-v { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .no-p { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 3 2; }
    .no-n { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="12" y="17" class="no-h" fill="var(--amber)">Option&lt;i32&gt; — needs a real tag: 4 → 8 bytes</text>
  <rect x="12" y="26" width="60" height="28" rx="4" class="no-d"/><text x="22" y="45" class="no-m">tag</text>
  <rect x="74" y="26" width="120" height="28" rx="4" class="no-v"/><text x="84" y="45" class="no-m">i32 value</text>
  <rect x="196" y="26" width="90" height="28" rx="4" class="no-p"/><text x="206" y="45" class="no-c">padding</text>
  <text x="300" y="45" class="no-c">every i32 bit pattern is a valid i32,</text>
  <text x="300" y="59" class="no-c">so None needs somewhere else to live</text>
  <text x="12" y="92" class="no-h" fill="var(--green)">Option&lt;&amp;i32&gt; — free: stays 8 bytes</text>
  <rect x="12" y="102" width="182" height="28" rx="4" class="no-v"/><text x="22" y="121" class="no-m">&amp;i32 — a real address</text>
  <text x="210" y="121" class="no-c">Some(r)</text>
  <rect x="12" y="136" width="182" height="28" rx="4" class="no-n"/><text x="22" y="155" class="no-m">0x0000000000000000</text>
  <text x="210" y="155" class="no-c">None — an address a reference can never hold</text>
  <text x="300" y="100" class="no-c">The "impossible" value IS the tag.</text>
  <text x="300" y="114" class="no-c">Same size as a bare reference,</text>
  <text x="300" y="128" class="no-c">so wrapping costs literally nothing.</text>
  <text x="12" y="182" class="no-c">Same trick applies to Box, Vec, String, and NonZero types — all of which have an impossible bit pattern to spare.</text>
</svg>
<figcaption>The <b>niche optimization</b>: when a type has an impossible bit pattern, <code>None</code> borrows it, and <code>Option&lt;T&gt;</code> is the same size as <code>T</code>.</figcaption>
</figure>

> [!performance] The safety is free where it matters most
> `Option<i32>` does grow (4 → 8 bytes, tag plus alignment padding), but every pointer-shaped type — `&T`, `Box<T>`, `Vec<T>`, `String`, `Rc<T>`, and the `NonZero*` family — wraps for **zero** bytes. That's why returning `Option<&Item>` from a lookup is a genuinely free abstraction: it compiles to exactly the null-pointer check a C programmer would write by hand, except the compiler forces you to actually perform it. You get the C representation and the guarantee.

## The combinator toolkit — handling without `match`

Writing a full `match` for every fallible call gets tedious. Both `Option` and `Result` come with dozens of **combinators** (methods that transform or extract the value), letting you handle the common cases in a single expressive line.

```rust
fn main() {
    // unwrap_or: give a default on failure/absence
    let count: i32 = "not a number".parse().unwrap_or(0);
    println!("count = {count}"); // 0

    // map: transform the success value, leave errors untouched
    let doubled = "21".parse::<i32>().map(|n| n * 2);
    println!("{doubled:?}"); // Ok(42)

    // unwrap_or_else: compute the default lazily
    let value = "x".parse::<i32>().unwrap_or_else(|_| -1);
    println!("{value}"); // -1

    // is_ok / is_some: just ask
    println!("{}", "5".parse::<i32>().is_ok()); // true
}
```

Here are the combinators you'll use most (they exist on both `Option` and `Result`, with small naming differences):

| Method | Does |
|--------|------|
| `unwrap_or(default)` | Value, or `default` on `None`/`Err` |
| `unwrap_or_else(\|e\| …)` | Value, or a computed default |
| `unwrap_or_default()` | Value, or the type's default (`0`, `""`, …) |
| `map(\|v\| …)` | Transform the inner success value |
| `and_then(\|v\| …)` | Chain another fallible operation |
| `ok_or(err)` | Convert `Option` → `Result` |
| `ok()` | Convert `Result` → `Option` (discard the error) |
| `is_ok()` / `is_some()` | Boolean check |

### `map` vs `and_then` — the one distinction worth memorizing

New Rustaceans reach for `map` and get a nested `Option<Option<T>>` or `Result<Result<T, E>, E>`. The rule is simple:

- Use **`map`** when your closure returns a **plain value**.
- Use **`and_then`** when your closure itself returns an **`Option`/`Result`**.

```rust
fn half_if_even(n: i32) -> Option<i32> {
    if n % 2 == 0 { Some(n / 2) } else { None }
}

fn main() {
    let input = Some(8);

    // map with a fallible closure → nested, almost never what you want:
    let nested: Option<Option<i32>> = input.map(half_if_even);
    println!("map:      {nested:?}");        // Some(Some(4))

    // and_then flattens as it goes:
    let flat: Option<i32> = input.and_then(half_if_even);
    println!("and_then: {flat:?}");          // Some(4)

    // …and chains cleanly: 8 → 4 → 2 → 1
    let chained = Some(8).and_then(half_if_even).and_then(half_if_even);
    println!("chained:  {chained:?}");       // Some(2)

    // One more step reaches 1, which is odd → None, and any further
    // and_then calls are skipped entirely (short-circuiting).
    let stops = Some(8)
        .and_then(half_if_even)   // Some(4)
        .and_then(half_if_even)   // Some(2)
        .and_then(half_if_even)   // Some(1)
        .and_then(half_if_even);  // 1 is odd → None
    println!("stops:    {stops:?}");         // None
}
```

> [!tip] `and_then` is the same shape as `?`
> If `and_then` chaining feels like it's doing what `?` does — short-circuiting on the first failure and carrying the value forward otherwise — that's because it is. They're two spellings of the same idea, and the [next chapter](#/ch/question-mark) shows why `?` usually reads better inside a function body. Combinators still win for one-liners and inside iterator chains, where there's no function to return from.

The full method reference — `filter`, `zip`, `flatten`, `transpose`, `collect` into a `Result`, and the rest — lives in [Option & Result Methods](#/ch/std-option-result).

## `if let`, `let else`, and `while let`

When you only want to act on success (or only on `Some`), `if let` is tidier than `match`:

```rust
fn main() {
    let config: Option<&str> = Some("dark-mode");

    if let Some(setting) = config {
        println!("Applying setting: {setting}");
    }

    // Combine with else for a fallback:
    let port: Result<u16, _> = "8080".parse();
    if let Ok(p) = port {
        println!("Listening on port {p}");
    } else {
        println!("Invalid port; using default 3000");
    }
}
```

Two close relatives are worth knowing now, because they remove most of the "pyramid of nesting" that `if let` can create:

```rust
fn parse_port(raw: Option<&str>) -> u16 {
    // let-else: bind on success, or bail out. The else block MUST diverge.
    let Some(text) = raw else {
        return 3000;
    };
    let Ok(port) = text.parse::<u16>() else {
        return 3000;
    };
    port  // from here on, `port` is a plain u16 — no nesting, no unwrapping
}

fn main() {
    println!("{}", parse_port(Some("8080"))); // 8080
    println!("{}", parse_port(Some("abc")));  // 3000
    println!("{}", parse_port(None));         // 3000

    // while let: keep going as long as the pattern matches
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        print!("{top} ");
    }
    println!();  // 3 2 1
}
```

> [!best] `let else` is the flattening tool
> The instinct when several things can fail is to nest `if let` inside `if let` inside `if let`, drifting rightward off the screen. `let else` inverts it: handle each failure immediately and return, so the happy path stays at one indent level and reads top to bottom. This is the same "early return" style that makes `?` pleasant, available for `Option` in functions that don't return one.

## Working with references: `as_ref` and friends

One genuine beginner stumbling block: methods like `map` and `unwrap` **consume** the `Option`. Call `.map()` on an `Option<String>` you don't own and you'll hit a move error:

```rust
struct Config { name: Option<String> }

fn main() {
    let config = Config { name: Some("server-01".to_string()) };

    // ❌ `config.name.map(...)` would MOVE the String out of config.
    // ✅ as_ref() turns &Option<String> into Option<&String> — borrow, don't move:
    let length = config.name.as_ref().map(|s| s.len()).unwrap_or(0);
    println!("name length: {length}");

    // as_deref() goes one step further: Option<String> → Option<&str>
    let name: &str = config.name.as_deref().unwrap_or("unnamed");
    println!("name: {name}");

    // config.name is still intact, because we only ever borrowed it:
    println!("still here: {:?}", config.name);
}
```

| You have | You want | Use |
|---|---|---|
| `&Option<T>` | `Option<&T>` | `.as_ref()` |
| `&mut Option<T>` | `Option<&mut T>` | `.as_mut()` |
| `Option<String>` | `Option<&str>` | `.as_deref()` |
| `Option<&T>` where `T: Clone` | `Option<T>` | `.cloned()` |
| `Option<T>` | take it, leave `None` behind | `.take()` |

> [!mistake] Reaching for `.clone()` to escape a move error
> When `config.name.map(...)` complains, the tempting fix is `config.name.clone().map(...)`. It compiles, and it allocates a whole new `String` to compute a length you were going to throw away. `.as_ref()` is free. Whenever a move error appears on an `Option`, try `as_ref`/`as_deref` **before** reaching for `clone` — the borrow is almost always what you actually meant.

## Putting it together

A small, realistic function using both types the way real code does — `Option` for "field absent", `Result` for "value present but wrong":

```rust
#[derive(Debug)]
#[allow(dead_code)] // the fields are only ever printed via Debug
struct Settings {
    host: String,
    port: u16,
    verbose: bool,
}

/// Look up a key in a simple `key=value` config.
fn lookup<'a>(lines: &'a [&'a str], key: &str) -> Option<&'a str> {
    lines
        .iter()
        .find_map(|line| line.strip_prefix(&format!("{key}=")))
}

fn parse_settings(lines: &[&str]) -> Result<Settings, String> {
    // Required field: absence IS an error, so Option → Result with ok_or.
    let host = lookup(lines, "host")
        .ok_or("missing required key: host")?
        .to_string();

    // Optional with a default, but if present it must be valid.
    let port = match lookup(lines, "port") {
        Some(raw) => raw
            .parse::<u16>()
            .map_err(|e| format!("bad port {raw:?}: {e}"))?,
        None => 8080,
    };

    // Optional flag: absent or unparseable both just mean "off".
    let verbose = lookup(lines, "verbose")
        .and_then(|v| v.parse::<bool>().ok())
        .unwrap_or(false);

    Ok(Settings { host, port, verbose })
}

fn main() {
    let good = ["host=example.com", "port=9000", "verbose=true"];
    println!("{:?}\n", parse_settings(&good));

    let defaults = ["host=example.com"];
    println!("{:?}\n", parse_settings(&defaults));

    let missing = ["port=9000"];
    println!("{:?}\n", parse_settings(&missing));

    let bad_port = ["host=example.com", "port=99999"];
    println!("{:?}", parse_settings(&bad_port));
}
```

Notice the three distinct decisions in that one function: **required** (`ok_or` promotes absence to an error), **optional with default** (`None` is fine, but a bad value isn't), and **best-effort** (anything unusable falls back silently). Getting these three right for each field is most of what real-world error handling actually is.

## When to use which — the decision

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Decision guide: panic for bugs, Result for failures with reasons, Option for plain absence">
  <style>
    .dh { font: 600 12px var(--font-sans); fill: var(--text); }
    .dc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dm { font: 600 12px var(--font-mono); }
    .b1 { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .b2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .b3 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="dh">"Something might go wrong here." Which tool?</text>
  <rect x="20" y="40" width="195" height="130" rx="10" class="b1"/>
  <text x="34" y="64" class="dm" fill="var(--red)">panic! / unwrap</text>
  <text x="34" y="90" class="dc">The error means MY CODE</text>
  <text x="34" y="106" class="dc">IS WRONG (a bug).</text>
  <text x="34" y="130" class="dc">e.g. impossible state,</text>
  <text x="34" y="146" class="dc">broken invariant.</text>
  <rect x="225" y="40" width="195" height="130" rx="10" class="b2"/>
  <text x="239" y="64" class="dm" fill="var(--rust-600)">Result&lt;T, E&gt;</text>
  <text x="239" y="90" class="dc">Failure with a REASON</text>
  <text x="239" y="106" class="dc">the caller should handle.</text>
  <text x="239" y="130" class="dc">e.g. file missing, parse</text>
  <text x="239" y="146" class="dc">failed, network error.</text>
  <rect x="430" y="40" width="190" height="130" rx="10" class="b3"/>
  <text x="444" y="64" class="dm" fill="var(--blue)">Option&lt;T&gt;</text>
  <text x="444" y="90" class="dc">Plain ABSENCE, no</text>
  <text x="444" y="106" class="dc">reason needed.</text>
  <text x="444" y="130" class="dc">e.g. empty list, key not</text>
  <text x="444" y="146" class="dc">found, optional field.</text>
</svg>
<figcaption>Bug → <b>panic</b>. Failure worth explaining → <b>Result</b>. Simple "nothing here" → <b>Option</b>.</figcaption>
</figure>

> [!best] Prefer combinators and `match` over `.unwrap()`
> `.unwrap()` and `.expect()` extract the value but **panic** on failure — so they turn a *recoverable* error back into a *crash*, defeating the whole point. Save them for tests and quick prototypes. In real code, use `match`, `if let`, or combinators like `unwrap_or`, `map`, and `and_then`. The next chapter adds the **`?` operator**, which makes propagating errors upward beautifully concise.

> [!tip] If you must unwrap, use `expect` with a *reason*
> `.expect("…")` panics just like `.unwrap()`, but the message becomes your incident report. Write the **invariant that was violated**, not a restatement of the failure: `expect("config was validated at startup")` tells the next person why you believed it was safe, which is the actual useful information. `expect("failed to get config")` tells them nothing they can't see from the stack trace.

## Where this goes next

| Question | Chapter |
|---|---|
| How do I stop writing `match` at every level? | [The `?` Operator](#/ch/question-mark) |
| What are *all* the methods on these types? | [Option & Result Methods](#/ch/std-option-result) |
| How do I make my own error type? | [Custom Errors, thiserror & anyhow](#/ch/custom-errors) |
| When is crashing the right call? | [Unrecoverable Errors with panic!](#/ch/panic) |
| Which error type belongs where in a real app? | [Error Handling Strategy](#/ch/error-strategy) |

## Summary

- **Recoverable** errors are modeled as **values**, not exceptions: **`Result<T, E>`** (`Ok`/`Err`) for failures, **`Option<T>`** (`Some`/`None`) for absence.
- Both are **ordinary enums** from the standard library — no compiler magic, just generics plus a very good `match`.
- Because failure is in the **return type**, the compiler ensures you can't silently ignore it — `match` is exhaustive and `Result` is `#[must_use]`.
- **Rust has no null.** `Option<T>` makes absence a distinct type, eliminating null-pointer errors as a category — and thanks to the **niche optimization**, `Option<&T>`, `Option<Box<T>>`, and `Option<String>` are the *same size* as the types they wrap.
- Handle them explicitly with **`match`**/**`if let`**, flatten nesting with **`let else`**, or go concise with **combinators**.
- **`map` for plain values, `and_then` for fallible ones** — mixing them up is what produces `Option<Option<T>>`.
- Use **`as_ref`/`as_deref`** to borrow instead of moving; reaching for `.clone()` to fix a move error usually means you wanted `as_ref`.
- Avoid **`.unwrap()`** in real code; if you must, use **`.expect("the invariant you relied on")`**.
- Choose by intent: **panic** for bugs, **`Result`** for failures with a reason, **`Option`** for plain absence.

> [!exercise] Try it yourself
> 1. Write `fn safe_divide(a: f64, b: f64) -> Option<f64>` returning `None` when `b == 0.0`; handle both cases with `match`.
> 2. Parse `"123"` and `"abc"` into `i32`, using `unwrap_or(-1)` for each, and print the results.
> 3. Chain combinators: take `"20"`, `parse::<i32>()`, then `map(|n| n * 3)`, then `unwrap_or(0)`.
> 4. Call `might_fail(-1)` and ignore the result without `let _ =`. Read the `must_use` warning, then satisfy it two different ways.
> 5. Print `size_of::<Option<bool>>()` and `size_of::<Option<Option<bool>>>()`. Explain the first using the niche idea; is the second what you expected?
> 6. Write `fn first_word_len(s: &Option<String>) -> usize` without moving or cloning the `String` — `as_ref` is the tool.
> 7. Rewrite `parse_settings`'s `port` logic using only combinators (no `match`), then decide which version you'd rather maintain.
> 8. Take a three-level nested `if let` and flatten it with `let else`. Count the indent levels before and after.

Handling errors with `match` everywhere can get verbose when one function calls another that calls another. Rust's answer is a single, elegant character: the **`?` operator**.
