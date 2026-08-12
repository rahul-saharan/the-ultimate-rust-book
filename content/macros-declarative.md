<h1><span class="h1-kicker">Advanced Rust</span>Declarative Macros: macro_rules!</h1>

You've used macros since chapter one — `println!`, `vec!`, `format!`. Now you'll write your own. **Declarative macros** (`macro_rules!`) are pattern-matching templates: they match the *syntax* you pass in and expand it into other code at compile time. They let you reduce boilerplate and build mini-languages — with the same zero runtime cost as hand-written code, because the expansion happens before compilation.

## Macros vs. functions

> [!key] What macros can do that functions can't
> A function receives *values*; a **macro** receives *syntax* and generates *code*. That lets macros do things functions fundamentally cannot:
> - Take a **variable number** of arguments (`println!("{}", a)` vs `println!("{} {}", a, b)`).
> - Accept different **types** in the same call (`vec![1, 2]` and `vec!["a", "b"]`).
> - Generate **items** like structs, functions, or trait impls.
> - Inspect and transform the code passed to them.
>
> The cost: macros are harder to write and read than functions. Reach for a function first; use a macro only when you need one of these superpowers.

## When is a macro the right tool?

Before writing one, it's worth being clear about *why* macros exist, because reaching for them too early is the most common mistake.

<figure class="diagram">
<svg viewBox="0 0 670 250" role="img" aria-label="A decision ladder: use a plain function when values suffice, generics when the same logic applies to many types, a declarative macro when you need variable arguments or to generate code, and a procedural macro when you must inspect a type's structure.">
  <style>
    .dl-h { font: 700 11.5px var(--font-sans); }
    .dl-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .dl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .dl-1 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .dl-2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .dl-3 { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .dl-4 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
  </style>
  <text x="14" y="18" class="dl-h">Try these in order — stop at the first one that works</text>
  <rect x="14" y="28" width="642" height="44" rx="7" class="dl-1"/>
  <text x="26" y="46" class="dl-h" fill="var(--green)">1 · a plain function</text>
  <text x="200" y="46" class="dl-c">fixed arguments, one set of types, ordinary values</text>
  <text x="26" y="63" class="dl-c">Easiest to read, debug, document and step through. The right answer most of the time.</text>
  <rect x="14" y="78" width="642" height="44" rx="7" class="dl-2"/>
  <text x="26" y="96" class="dl-h" fill="var(--blue)">2 · generics + traits</text>
  <text x="200" y="96" class="dl-c">same logic, many types</text>
  <text x="26" y="113" class="dl-c">Still a function — the compiler writes the variants. See <tspan font-family="var(--font-mono)">Generics</tspan>.</text>
  <rect x="14" y="128" width="642" height="52" rx="7" class="dl-3"/>
  <text x="26" y="146" class="dl-h" fill="var(--amber)">3 · macro_rules!</text>
  <text x="200" y="146" class="dl-c">variable arg counts · generating items · a small DSL</text>
  <text x="26" y="163" class="dl-c">You need syntax that no function signature can express: <tspan font-family="var(--font-mono)">vec![1,2,3]</tspan>, <tspan font-family="var(--font-mono)">println!("{a} {b}")</tspan>,</text>
  <text x="26" y="176" class="dl-c">or emitting a dozen near-identical trait impls from one line.</text>
  <rect x="14" y="186" width="642" height="52" rx="7" class="dl-4"/>
  <text x="26" y="204" class="dl-h" fill="var(--purple)">4 · procedural macro</text>
  <text x="200" y="204" class="dl-c">you must READ the structure of a type</text>
  <text x="26" y="221" class="dl-c">Iterating a struct's fields, reading helper attributes, custom compile errors —</text>
  <text x="26" y="234" class="dl-c">pattern matching alone can't do it. Its own crate, its own chapter (next).</text>
</svg>
<figcaption>Escalate only when the simpler tool genuinely can't express what you need. Each step up costs readability.</figcaption>
</figure>

> [!key] The one-sentence test
> **A function receives values; a macro receives syntax.** So the question is always: *does what I'm writing need to see the code itself, or just the values?* Counting arguments, accepting `key => value` pairs, generating an `impl` block, capturing an expression for a lazy log — those need syntax. Anything else is a function.
>
> The cost is real and worth naming: macros produce worse error messages (pointing into expanded code you never wrote), get weaker IDE support (no autocomplete inside them, unreliable go-to-definition), can't be passed around as values, and are harder for the next person to read. A macro that saves five lines but costs an hour of confusion is a bad trade.

## The declarative macros you already use

Nearly every macro in daily Rust is a `macro_rules!` one from `std`. Recognising the categories makes the ones you write feel less exotic:

| Macro | Does | Why it can't be a function |
|---|---|---|
| `println!` / `format!` / `write!` | formatted output | variadic, and the format string is checked **at compile time** |
| `vec![1, 2, 3]` / `vec![0; n]` | build a `Vec` | variadic, plus a second `value; count` form |
| `assert!` / `assert_eq!` | test assertions | captures the *source text* of the expression for the failure message |
| `panic!` / `todo!` / `unimplemented!` | abort with a message | variadic formatting; `todo!` also types as `!` |
| `matches!(x, Some(_))` | pattern test → `bool` | takes a **pattern**, which is not a value |
| `dbg!(expr)` | print value + file/line, return it | needs the expression's text and location |
| `include_str!` / `env!` | embed a file or env var at build time | runs at compile time |
| `cfg!(target_os = "linux")` | compile-time condition as a `bool` | evaluates configuration, not values |

> [!tip] `dbg!` and `matches!` deserve to be in your muscle memory
> `dbg!(x)` prints `[src/main.rs:4:5] x = 42` **and returns `x`**, so you can wrap any subexpression without restructuring: `let total = dbg!(a + b) * 2;`. Remove it when you're done — it writes to stderr and is not for production. And `matches!(value, Pattern)` collapses a three-line `match` into a boolean: `if matches!(status, Status::Active | Status::Pending)`. Both are `macro_rules!` macros you could have written yourself.

## A first macro

Macros are defined with `macro_rules!`. The body looks like a `match`: each arm is `(pattern) => { expansion }`. Here's a tiny one:

```rust
macro_rules! say_hello {
    () => {
        println!("Hello from a macro!");
    };
}

fn main() {
    say_hello!(); // expands to println!("Hello from a macro!");
}
```

## Capturing input with fragment specifiers

Macros capture pieces of syntax into **metavariables** (written `$name`), each tagged with a **fragment specifier** that says what kind of syntax to match:

```rust
macro_rules! print_twice {
    ($x:expr) => {  // $x captures any expression
        println!("{}", $x);
        println!("{}", $x);
    };
}

fn main() {
    print_twice!(2 + 3);       // works with an expression
    print_twice!("hello");      // and a different type — 5 and 5, then hello hello
}
```

The common fragment specifiers:

| Specifier | Matches | Example |
|-----------|---------|---------|
| `expr` | an expression | `2 + 2`, `foo()` |
| `ident` | an identifier | `my_var`, `Foo` |
| `ty` | a type | `i32`, `Vec<String>` |
| `literal` | a literal | `42`, `"hi"` |
| `pat` | a pattern | `Some(x)`, `_` |
| `block` | a `{ … }` block | `{ do_thing(); }` |
| `stmt` | a statement | `let x = 5` |
| `tt` | a single "token tree" (most flexible) | almost anything |

## Repetition: variable numbers of arguments

The real power is **repetition**. `$( … )*` matches a pattern zero or more times, and re-emits it once per match. This is how `vec!` accepts any number of elements — let's build our own:

```rust
macro_rules! my_vec {
    // Match a comma-separated list of expressions:
    ( $( $x:expr ),* ) => {
        {
            let mut temp = Vec::new();
            $(
                temp.push($x); // repeated once for EACH matched $x
            )*
            temp
        }
    };
}

fn main() {
    let v = my_vec![1, 2, 3, 4];
    println!("{v:?}"); // [1, 2, 3, 4]
    let words = my_vec!["a", "b"];
    println!("{words:?}");
}
```

Read the repetition syntax as: **`$( … ),*`** means "the stuff inside, repeated, separated by commas." Inside the expansion, `$( … )*` replays the body once per captured item.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A macro call is expanded at compile time into the code its template generates">
  <style>
    .mdm { font: 600 11px var(--font-mono); fill: var(--text); }
    .mdc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .call { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .exp { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="30" width="180" height="30" class="call"/><text x="34" y="50" class="mdm">my_vec![1, 2, 3]</text>
  <text x="230" y="40" class="mdc">expands at</text><text x="230" y="56" class="mdc">COMPILE time ⟶</text>
  <rect x="360" y="18" width="260" height="120" rx="8" class="exp"/>
  <text x="374" y="40" class="mdm">{ let mut temp = Vec::new();</text>
  <text x="374" y="58" class="mdm">  temp.push(1);</text>
  <text x="374" y="76" class="mdm">  temp.push(2);</text>
  <text x="374" y="94" class="mdm">  temp.push(3);</text>
  <text x="374" y="112" class="mdm">  temp }</text>
  <text x="20" y="150" class="mdc">The macro is gone by runtime — only the generated code remains. Zero overhead.</text>
</svg>
<figcaption>A macro call is <b>expanded into real code at compile time</b>, so there's no runtime cost.</figcaption>
</figure>

### Repetition, in detail

The repetition syntax has three parts, and reading it correctly is most of the battle:

<figure class="diagram">
<svg viewBox="0 0 670 235" role="img" aria-label="The repetition pattern dollar parenthesis dollar x colon expr parenthesis comma star breaks into a capture, a separator, and a repeat operator. Below, three input expressions each produce one copy of the expansion body.">
  <style>
    .rp-h { font: 700 11.5px var(--font-sans); }
    .rp-m { font: 600 12px var(--font-mono); fill: var(--text); }
    .rp-s { font: 600 11px var(--font-mono); }
    .rp-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .rp-cap { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .rp-sep { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .rp-op { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
    .rp-in { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .rp-out { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.3; }
  </style>
  <text x="14" y="18" class="rp-h">the pattern</text>
  <text x="120" y="42" class="rp-m">$(  $x:expr  )  ,  *</text>
  <rect x="150" y="52" width="86" height="20" rx="4" class="rp-cap"/><text x="158" y="66" class="rp-c">what to capture</text>
  <rect x="244" y="52" width="70" height="20" rx="4" class="rp-sep"/><text x="252" y="66" class="rp-c">separator</text>
  <rect x="322" y="52" width="118" height="20" rx="4" class="rp-op"/><text x="330" y="66" class="rp-c">* = zero or more</text>
  <text x="452" y="66" class="rp-c">(+ = one or more, ? = zero or one)</text>
  <text x="14" y="104" class="rp-h">input</text>
  <rect x="120" y="90" width="200" height="22" rx="4" class="rp-in"/><text x="130" y="106" class="rp-s">my_vec![10, 20, 30]</text>
  <text x="336" y="106" class="rp-c">→ $x binds three times: 10, 20, 30</text>
  <text x="14" y="146" class="rp-h">expansion</text>
  <text x="120" y="140" class="rp-c">the body inside $( … )* is replayed once per capture</text>
  <rect x="120" y="150" width="240" height="20" rx="4" class="rp-out"/><text x="130" y="164" class="rp-s">temp.push(10);</text>
  <rect x="120" y="174" width="240" height="20" rx="4" class="rp-out"/><text x="130" y="188" class="rp-s">temp.push(20);</text>
  <rect x="120" y="198" width="240" height="20" rx="4" class="rp-out"/><text x="130" y="212" class="rp-s">temp.push(30);</text>
  <text x="380" y="168" class="rp-c">The separator appears only in the PATTERN.</text>
  <text x="380" y="186" class="rp-c">In the expansion you choose your own —</text>
  <text x="380" y="204" class="rp-c">here a semicolon, since these are statements.</text>
</svg>
<figcaption>A repetition has three parts: <b>what to capture</b>, the <b>separator</b> between items, and the <b>repeat operator</b>.</figcaption>
</figure>

Two refinements you'll want almost immediately — accepting a **trailing comma**, and building pairs:

```rust
use std::collections::HashMap;

macro_rules! hashmap {
    // `$(,)?` at the end optionally allows one trailing comma.
    ( $( $key:expr => $value:expr ),* $(,)? ) => {{
        // `#[allow]` because with zero pairs, `map` is never mutated.
        #[allow(unused_mut)]
        let mut map = HashMap::new();
        $( map.insert($key, $value); )*
        map
    }};
}

fn main() {
    let scores = hashmap!{
        "alice" => 10,
        "bob"   => 20,   // ← trailing comma accepted
    };
    let mut keys: Vec<_> = scores.keys().collect();
    keys.sort();
    println!("{keys:?} → {:?}", keys.iter().map(|k| scores[*k]).collect::<Vec<_>>());

    let empty: HashMap<&str, i32> = hashmap!{};
    println!("empty: {}", empty.len());
}
```

Note `{{` and `}}`: the outer braces are the macro's expansion delimiter, the inner ones make the expansion a **block expression** so it evaluates to `map`.

## Multiple arms and recursion

Like `match`, a macro can have several arms, tried top to bottom. Macros can even call *themselves*, enabling recursive expansion. Here's a `max!` that handles any number of arguments by peeling one off and recursing:

```rust
macro_rules! max {
    // Base case: one argument — it's the max of itself.
    ($a:expr) => { $a };
    // Recursive case: compare the first with the max of the rest.
    ($a:expr, $($rest:expr),+) => {
        {
            let a = $a;
            let b = max!($($rest),+); // recurse on the remaining args
            if a > b { a } else { b }
        }
    };
}

fn main() {
    println!("{}", max!(3));             // 3
    println!("{}", max!(3, 7, 2, 9, 4)); // 9
}
```

## TT munchers: parsing token by token

Repetition (`$( … ),*`) handles uniform lists. When the input has *structure* — optional pieces, keywords, varying shapes — you need the **TT muncher**: a recursive macro that bites off the first token or two, emits something, and recurses on the rest.

The convention is to hide the recursion behind **internal rules** prefixed with `@`, so callers only ever see the public arm:

```rust
macro_rules! config {
    // ── internal rules FIRST (see the warning below on why) ──
    // `@munch` marks them as not-for-callers.

    // Base case: nothing left to chew.
    (@munch $out:ident,) => {};

    // `enable key,` — must precede the generic arm, or it would never fire.
    (@munch $out:ident, enable $key:ident, $( $rest:tt )*) => {
        $out.push((stringify!($key).to_string(), "true".to_string()));
        config!(@munch $out, $( $rest )*);
    };

    // `key: value,` — a plain setting
    (@munch $out:ident, $key:ident : $value:expr, $( $rest:tt )*) => {
        $out.push((stringify!($key).to_string(), $value.to_string()));
        config!(@munch $out, $( $rest )*);
    };

    // ── public entry point LAST, because it matches anything ──
    ( $( $rest:tt )* ) => {{
        let mut settings: Vec<(String, String)> = Vec::new();
        config!(@munch settings, $( $rest )*);
        settings
    }};
}

fn main() {
    let settings = config! {
        host: "localhost",
        port: 8080,
        enable tls,
        retries: 3,
    };

    for (k, v) in &settings {
        println!("{k} = {v}");
    }
}
```

Each recursion consumes one clause and passes the remainder along as a `tt` sequence. That's something plain repetition cannot do, because `$( … ),*` requires every item to match the *same* pattern — here `enable tls` and `port: 8080` have different shapes.

> [!key] Why `tt`, why `@`, and why order matters
> **`tt`** (token tree) is the only fragment that can hold "whatever is left" without committing to a grammar. Once input is captured as `expr` or `ty`, the macro system won't let you re-match its interior — so munchers carry the unparsed tail as `$( $rest:tt )*` and interpret it one arm at a time.
>
> The **`@`** is pure convention, not syntax: it makes internal arms unambiguous against real user input and signals "don't call this directly." You'll see it throughout the ecosystem.
>
> Arms are tried **top to bottom**, and the first match wins — which drives the whole layout above.

> [!warning] Put the catch-all entry arm LAST, or the macro recurses into itself
> This is the muncher bug everyone writes once, and it's worth understanding rather than memorising. The public arm's pattern is `$( $rest:tt )*` — "any tokens at all". That includes `@munch settings, host: "localhost", …`, the very call the entry arm makes. Put it first and every internal call matches it again, forever:
> ```text
> error: recursion limit reached while expanding `config!`
> ```
> Ordering the arms **internal-first, catch-all-last** fixes it, because the specific `@munch` patterns get first refusal. The same top-to-bottom rule explains the smaller ordering constraint inside the group: `enable $key:ident` must precede `$key:ident : $value:expr`, or `enable tls` reaches an arm that can't match it and the expansion fails.
>
> Separately, each token consumed costs one level of macro recursion, and the compiler stops at **128** by default. A muncher chewing a long input hits that ceiling legitimately. You can raise it with `#![recursion_limit = "256"]` at the crate root, but that's a smell — every expansion step is real compile-time work. If you're munching hundreds of tokens the input has outgrown `macro_rules!`: a [procedural macro](#/ch/macros-procedural) parses the whole stream in one pass with ordinary Rust code, and gives far better errors doing it.

## Hygiene

> [!key] Macros are hygienic
> Notice `my_vec!` created a variable named `temp`. What if *your* code already had a `temp`? In many languages' macros, that would clash disastrously. Rust macros are **hygienic**: identifiers a macro introduces live in their own separate scope and can't accidentally collide with or capture the caller's variables. This makes `macro_rules!` far safer than the naive text-substitution macros of C.

> [!best] Prefer functions; reach for macros deliberately
> Macros are powerful but they're a *cost*: they're harder to write, harder to read, produce cryptic errors, and IDEs support them less well. Use a **function** or **generics** whenever they'd do. Justify a declarative macro when you genuinely need variadic arguments, code generation, or a DSL — and keep it as simple as the job allows. When you need to derive behavior for a *type* (like `#[derive(Debug)]`), that's the domain of **procedural macros**, next.

> [!warning] Export macros with `#[macro_export]`
> A `macro_rules!` macro is only visible *after* its definition in the same crate unless you annotate it with **`#[macro_export]`**, which makes it available to the whole crate and to crates that depend on yours. Forgetting this is a common "why can't I use my macro?" stumble. (Order matters too: a macro must be defined textually before it's used, unless exported.)

### Hygiene has one hole: paths

Variable names are hygienic, but **paths to items are not**. A macro that mentions `HashMap` expands into the caller's scope, where `HashMap` may not be imported — or may mean something else entirely. The fix is **`$crate`**, which always resolves to the crate the macro was *defined* in:

```rust,ignore
// ❌ Fragile: breaks unless the CALLER has imported HashMap
#[macro_export]
macro_rules! bad_map {
    () => { HashMap::new() };
}

// ✅ Robust: an absolute path the caller can't accidentally shadow
#[macro_export]
macro_rules! good_map {
    () => { ::std::collections::HashMap::new() };
}

// ✅ For items in YOUR crate, use $crate:
#[macro_export]
macro_rules! make_config {
    () => { $crate::config::Config::default() };
}
```

Any macro you `#[macro_export]` should use fully-qualified paths (`::std::…`) or `$crate::…` for everything it references. Skipping this is the most common reason an exported macro "works in my crate but not in yours."

## Debugging macros

Macros fail in confusing ways because the error points at generated code you never wrote. Three tools help:

| Tool | What it does |
|---|---|
| **`cargo expand`** | prints your source with all macros expanded — install with `cargo install cargo-expand` |
| **`trace_macros!(true)`** | nightly; logs each expansion step as the compiler performs it |
| **`stringify!($x)`** | turns a captured fragment back into a string so you can `println!` it while developing |

### Two bugs worth meeting once

```rust
// `expr` fragments are treated as a single unit, so precedence is SAFE:
macro_rules! square_expr { ($x:expr) => { $x * $x }; }

// `tt` fragments are raw tokens with no such protection — precedence LEAKS:
macro_rules! square_tt { ($($x:tt)*) => { $($x)* * $($x)* }; }

macro_rules! twice { ($x:expr) => { $x + $x }; }
fn expensive() -> i32 {
    println!("  …evaluated");
    5
}

fn main() {
    println!("expr fragment, 2 + 1 → {}", square_expr!(2 + 1)); // 9  ✅
    println!("tt fragment,   2 + 1 → {}", square_tt!(2 + 1));   // 5  ❌ 2 + 1*2 + 1

    println!("twice!(expensive()):");
    println!("  = {}", twice!(expensive()));  // evaluates it TWICE
}
```

> [!mistake] Precedence is handled for `expr`; double evaluation never is
> The first surprise is a *non*-surprise: you'll often read that `$x * $x` breaks on `2 + 1`, and for an **`expr`** fragment it doesn't — Rust wraps the captured expression as one unit, so you get 9. That protection is real and worth knowing about, but it applies **only** to fragment types that parse a complete grammar element (`expr`, `ty`, `pat`, …). With **`tt`**, you're splicing raw tokens and precedence genuinely leaks — hence the 5.
>
> The second bug has no such safety net. `$x` is *substituted*, not evaluated-then-substituted, so mentioning it twice runs the caller's expression twice — visible above as two "…evaluated" lines. Any macro that uses a capture more than once should bind it first:
> ```rust,ignore
> macro_rules! twice_fixed { ($x:expr) => {{ let v = $x; v + v }}; }
> ```
> That's the same reasoning behind the `{{ let mut map = …; map }}` shape in `hashmap!` above.

## Summary

- **Declarative macros** (`macro_rules!`) are compile-time pattern-matching templates that transform **syntax** into code — with no runtime cost.
- They can do what functions can't: **variadic** arguments, mixed **types**, and generating **items**.
- Capture syntax with **metavariables** (`$x`) tagged by **fragment specifiers** (`expr`, `ident`, `ty`, `tt`, …); handle lists with **repetition** `$( … ),*`.
- Macros support **multiple arms** and **recursion** (like `max!`), and are **hygienic** — their variables never clash with the caller's.
- Prefer functions/generics; use macros deliberately, and remember **`#[macro_export]`** to share them.

> [!exercise] Try it yourself
> 1. Write a `square!($x:expr)` macro that expands to `$x * $x`, and call it on `5` and on `2 + 1` (watch out — why might you want parentheses?).
> 2. Build a `min!` macro mirroring the recursive `max!`.
> 3. Write a `hashmap!` macro so `hashmap!{"a" => 1, "b" => 2}` builds a `HashMap` (hint: repetition with `$k:expr => $v:expr`).

`macro_rules!` matches syntax patterns. For the ultimate power — generating code from the *structure* of your types, like `#[derive(Debug)]` does — you need **procedural macros**.
