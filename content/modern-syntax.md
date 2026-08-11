<h1><span class="h1-kicker">Advanced Rust</span>Modern Syntax: let-else, let-chains & More</h1>

Rust keeps getting quietly nicer. A handful of features stabilized over the last few years remove specific, recurring annoyances — the nested `if let` pyramid, the `match` that exists only to return early, the `impl Trait` you couldn't write in a trait. None of them changes how Rust works; all of them change how it reads.

This chapter collects the ones you'll use weekly, with the version each arrived in so you know what's safe to reach for.

## `let`-else: bind or bail

Stabilized in **Rust 1.65**. It handles the single most common shape in Rust code: extract a value, or return early.

```rust
#[derive(Debug)]
struct User {
    name: String,
    age: u32,
}

// ❌ The old shape: the happy path is nested, and it drifts rightwards.
fn greet_nested(input: Option<&str>) -> String {
    match input {
        Some(name) => match name.trim() {
            "" => "empty name".to_string(),
            trimmed => format!("Hello, {trimmed}!"),
        },
        None => "no name given".to_string(),
    }
}

// ✅ let-else: handle the failure and get out. The happy path stays flat,
// and `name` is bound in the OUTER scope for the rest of the function.
fn greet(input: Option<&str>) -> String {
    let Some(name) = input else {
        return "no name given".to_string();
    };

    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "empty name".to_string();
    }

    format!("Hello, {trimmed}!")
}

// It composes beautifully for a chain of validations.
fn parse_user(fields: &[&str]) -> Result<User, String> {
    let [name, age_str] = fields else {
        return Err(format!("expected 2 fields, got {}", fields.len()));
    };

    let Ok(age) = age_str.parse::<u32>() else {
        return Err(format!("age {age_str:?} is not a number"));
    };

    let Some(first_char) = name.chars().next() else {
        return Err("name is empty".to_string());
    };

    Ok(User { name: format!("{}{}", first_char.to_uppercase(), &name[1..]), age })
}

fn main() {
    println!("{}", greet(Some("  ada  ")));
    println!("{}", greet(None));
    println!("{:?}", parse_user(&["grace", "45"]));
    println!("{:?}", parse_user(&["grace", "old"]));
    println!("{:?}", parse_user(&["grace"]));
}
```

> [!key] The `else` block must diverge
> It has to `return`, `break`, `continue`, or `panic!` — it can't fall through, because there'd be no value bound afterwards. The compiler enforces this, and it's exactly the constraint that makes `let`-else so readable: you know at a glance that reaching the next line means the pattern matched. Any function with three or four validations gets dramatically flatter.

<figure class="diagram">
<svg viewBox="0 0 640 230" role="img" aria-label="Nested if-let blocks drift rightwards while let-else keeps the happy path at a single indentation level">
  <style>
    .ms-h { font: 700 12px var(--font-sans); }
    .ms-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .ms-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ms-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.2; }
    .ms-good { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.2; }
  </style>
  <text x="20" y="18" class="ms-h" fill="var(--red)">nested if let — the "pyramid of doom"</text>
  <rect x="20" y="28" width="270" height="18" class="ms-bad"/><text x="26" y="41" class="ms-m">if let Some(a) = x {</text>
  <rect x="40" y="48" width="250" height="18" class="ms-bad"/><text x="46" y="61" class="ms-m">if let Some(b) = a.y {</text>
  <rect x="60" y="68" width="230" height="18" class="ms-bad"/><text x="66" y="81" class="ms-m">if let Ok(c) = b.parse() {</text>
  <rect x="80" y="88" width="210" height="18" class="ms-bad"/><text x="86" y="101" class="ms-m">use(c)   ← the actual work</text>
  <rect x="60" y="108" width="230" height="18" class="ms-bad"/><text x="66" y="121" class="ms-m">} else { … }</text>
  <rect x="40" y="128" width="250" height="18" class="ms-bad"/><text x="46" y="141" class="ms-m">} else { … }</text>
  <rect x="20" y="148" width="270" height="18" class="ms-bad"/><text x="26" y="161" class="ms-m">} else { … }</text>
  <text x="20" y="186" class="ms-c">The real logic is 4 levels deep, and</text>
  <text x="20" y="200" class="ms-c">the error cases are far from their checks.</text>
  <text x="350" y="18" class="ms-h" fill="var(--green)">let-else — flat, errors adjacent</text>
  <rect x="350" y="28" width="270" height="18" class="ms-good"/><text x="356" y="41" class="ms-m">let Some(a) = x else { return … };</text>
  <rect x="350" y="48" width="270" height="18" class="ms-good"/><text x="356" y="61" class="ms-m">let Some(b) = a.y else { return … };</text>
  <rect x="350" y="68" width="270" height="18" class="ms-good"/><text x="356" y="81" class="ms-m">let Ok(c) = b.parse() else { … };</text>
  <rect x="350" y="88" width="270" height="18" class="ms-good"/><text x="356" y="101" class="ms-m">use(c)   ← still column one</text>
  <text x="350" y="186" class="ms-c">Every failure sits next to the check that</text>
  <text x="350" y="200" class="ms-c">found it, and nothing indents.</text>
  <text x="20" y="224" class="ms-c">Same behaviour, same performance. Only the reader benefits — which is the whole point.</text>
</svg>
<figcaption><b>let-else</b> inverts the nesting: failures are handled inline and the success path never indents.</figcaption>
</figure>

## `let`-chains: several conditions, one `if`

Stabilized in **Rust 1.88**, and **edition 2024 only**. You can mix `let` bindings and boolean conditions with `&&` in one `if`.

```rust,ignore
// Requires edition = "2024" in Cargo.toml.
struct Session {
    user: Option<String>,
    expires_in: u64,
}

fn describe(session: &Session) -> String {
    // Each `let` binding is visible to the conditions after it.
    if let Some(name) = &session.user
        && session.expires_in > 0
        && let Some(initial) = name.chars().next()
    {
        return format!("{initial}. is signed in for {}s", session.expires_in);
    }
    "not signed in".to_string()
}

// The pre-1.88 equivalent — this is what you'd write on edition 2021.
fn describe_2021(session: &Session) -> String {
    if let Some(name) = &session.user {
        if session.expires_in > 0 {
            if let Some(initial) = name.chars().next() {
                return format!("{initial}. is signed in for {}s", session.expires_in);
            }
        }
    }
    "not signed in".to_string()
}
```

> [!warning] `let`-chains need edition 2024, and the error is confusing
> On edition 2021 the parser rejects `if let … && let …` with a message about expecting `{` — which doesn't hint that an edition is the problem. If you copy a modern snippet and hit a strange parse error around `&&`, check for a `let` on the right-hand side. Set `edition = "2024"` in `Cargo.toml` to use them. See [Editions](#/ch/editions).

## `matches!`: a predicate, not a statement

Stabilized in **Rust 1.42**, and still underused. It answers "does this match?" as a `bool`.

```rust
#[derive(Debug)]
enum Status {
    Active { since: u32 },
    Suspended { reason: String },
    Closed,
}

fn main() {
    let accounts = [
        Status::Active { since: 2019 },
        Status::Suspended { reason: "payment failed".into() },
        Status::Closed,
    ];

    for s in &accounts {
        // Instead of a 4-line match that returns true/false:
        let is_usable = matches!(s, Status::Active { .. });
        // Guards work too — a condition on the bound values.
        let is_old = matches!(s, Status::Active { since } if *since < 2020);

        println!("{s:?}\n   usable={is_usable} old={is_old}");
    }

    // It shines in iterator chains and assertions.
    let usable = accounts.iter().filter(|s| matches!(s, Status::Active { .. })).count();
    println!("{usable} usable account(s)");

    // Multiple patterns with |:
    let c = 'x';
    println!("vowel? {}", matches!(c, 'a' | 'e' | 'i' | 'o' | 'u'));
    println!("hex digit? {}", matches!(c, '0'..='9' | 'a'..='f'));

    // In tests, matches! is the right tool for "correct shape, don't care about details".
    let result: Result<i32, String> = Err("boom".into());
    assert!(matches!(result, Err(_)));
}
```

> [!best] `matches!` for assertions about shape
> `assert!(matches!(result, Err(MyError::NotFound { .. })))` says "the right *kind* of error occurred" without requiring `PartialEq` on the error type or spelling out every field. That's usually exactly the assertion you want in a test — specific enough to catch a regression, loose enough not to break when you add a field. It's also the cleanest predicate for `filter` and `any`.

## Labeled blocks: `break` with a value

Stabilized in **Rust 1.65**. A labeled block lets you break out of a plain block with a value — a `goto`-shaped escape that stays structured.

```rust
fn classify(code: u32) -> &'static str {
    // 'result: { ... } is an expression you can break out of with a value.
    let label = 'result: {
        if code < 100 {
            break 'result "informational";
        }
        if code < 300 {
            break 'result "success";
        }
        if code < 400 {
            break 'result "redirect";
        }
        if code < 500 {
            break 'result "client error";
        }
        "server error" // the fall-through value
    };
    label
}

fn main() {
    for code in [100, 200, 301, 404, 503] {
        println!("{code} → {}", classify(code));
    }

    // Labels also disambiguate nested loops, which is their older use.
    let target = 42;
    let found = 'outer: loop {
        for i in 1..10 {
            for j in 1..10 {
                if i * j == target {
                    break 'outer Some((i, j));
                }
            }
        }
        break None;
    };
    println!("{target} = {found:?}");
}
```

> [!tip] A labeled block beats a `loop { … break }` hack
> The old workaround was `let x = loop { … break value; };` — a loop that never loops, purely to get `break`'s value. Labeled blocks say what you mean, and the label makes it obvious which construct you're leaving when they nest. Use them for early-exit logic that doesn't warrant its own function.

## `impl Trait` in more places

Two related stabilizations in **Rust 1.75** made traits considerably more usable.

```rust
// RPITIT: `-> impl Trait` in a TRAIT method. Before 1.75 this required
// Box<dyn Iterator> (an allocation) or an associated type (boilerplate).
trait Repository {
    fn ids(&self) -> impl Iterator<Item = u32>;
    fn name(&self) -> impl std::fmt::Display;
}

struct InMemory {
    records: Vec<(u32, String)>,
}

impl Repository for InMemory {
    // Each implementor returns its own concrete type. No Box, no vtable.
    fn ids(&self) -> impl Iterator<Item = u32> {
        self.records.iter().map(|(id, _)| *id)
    }

    fn name(&self) -> impl std::fmt::Display {
        "in-memory"
    }
}

// AFIT: `async fn` directly in a trait, also since 1.75.
trait Loader {
    async fn load(&self, key: &str) -> Option<String>;
}

struct Cache;

impl Loader for Cache {
    async fn load(&self, key: &str) -> Option<String> {
        Some(format!("value for {key}"))
    }
}

fn main() {
    let repo = InMemory {
        records: vec![(1, "alpha".into()), (2, "beta".into())],
    };
    println!("{}: {:?}", repo.name(), repo.ids().collect::<Vec<_>>());

    // Driving the async trait method without a runtime, just to show it compiles:
    let _loader = Cache;
    println!("Loader::load is an async trait method — no #[async_trait] needed");
}
```

| Position | Since | Notes |
|---|---|---|
| argument: `fn f(x: impl Trait)` | 1.26 | sugar for a generic parameter |
| return: `fn f() -> impl Trait` | 1.26 | hides the concrete type |
| trait method return (RPITIT) | 1.75 | replaces `Box<dyn>` in many traits |
| `async fn` in traits (AFIT) | 1.75 | replaces `#[async_trait]` for many cases |
| associated type value | 1.65 (GATs) | `type Item<'a> = …` |

> [!warning] `async fn` in traits is not yet a full replacement for `#[async_trait]`
> The 1.75 version doesn't produce `Send` futures by default, so a trait object you need to `tokio::spawn` still hits problems — you'll see "future cannot be sent between threads safely". For traits used with `dyn` across threads, `#[async_trait]` (which boxes the future) remains the pragmatic choice. For traits used generically, and for internal abstractions, native `async fn` is better: no allocation, no macro. Check which situation you're in before removing the macro. See [The Tokio Runtime](#/ch/tokio).

## Smaller wins worth knowing

```rust
fn main() {
    // Inline format arguments (1.58) — name the variable directly.
    let name = "ada";
    let count = 3;
    println!("{name} has {count}");                 // not println!("{} has {}", name, count)
    println!("{count:>5}");                         // width and alignment still work
    let width = 8;
    println!("{name:>width$}");                     // even dynamic width

    // Inline const blocks (1.79) — force compile-time evaluation in place.
    let table_size = const { 16 * 4 };
    println!("table_size = {table_size}");

    // let-else with slice patterns (1.65 + slice patterns)
    let parts = ["GET", "/index.html", "HTTP/1.1"];
    let [method, path, _version] = parts else {
        unreachable!("we know the length");
    };
    println!("{method} {path}");

    // if let with `..=` ranges and bindings
    let byte = 0x41u8;
    if let c @ 0x41..=0x5A = byte {
        println!("{:?} is an uppercase ASCII letter", c as char);
    }

    // Divide-with-remainder in one call (1.73)
    let (q, r) = (17i32.div_euclid(5), 17i32.rem_euclid(5));
    println!("17 = 5*{q} + {r}");

    // is_some_and / is_none_or style predicates (1.70 / 1.82)
    let maybe: Option<u32> = Some(9);
    println!("big? {}", maybe.is_some_and(|n| n > 5));

    // Result/Option `inspect` (1.76) — peek without consuming
    let doubled = Some(4).inspect(|n| println!("saw {n}")).map(|n| n * 2);
    println!("{doubled:?}");
}
```

| Feature | Since | Replaces |
|---|---|---|
| inline format args `{name}` | 1.58 | `"{}", name` |
| `let`-else | 1.65 | `match`/`if let` for early return |
| labeled blocks with `break value` | 1.65 | `loop { … break v; }` |
| GATs (`type Item<'a>`) | 1.65 | lifetime workarounds in traits |
| `Option::is_some_and` | 1.70 | `map_or(false, …)` |
| `div_euclid` / `rem_euclid` | long stable | manual negative-number handling |
| RPITIT and `async fn` in traits | 1.75 | `Box<dyn>`, `#[async_trait]` |
| `Option::inspect` / `Result::inspect` | 1.76 | a `map` that only logs |
| inline `const { … }` | 1.79 | a separate `const` item |
| `Option::is_none_or` | 1.82 | `map_or(true, …)` |
| `let`-chains (`if let … && let …`) | 1.88 (edition 2024) | nested `if let` |

> [!best] Inline format arguments everywhere
> `println!("{name} has {count}")` is shorter, impossible to get out of order, and impossible to mis-count — the three failure modes of positional arguments. Clippy's `uninlined_format_args` lint will convert an entire codebase for you with `cargo clippy --fix`. Note the one limitation: only a bare identifier works, so `{self.name}` and `{v[0]}` are still positional.

> [!note] Check the version before you use a feature in a published crate
> Every feature here has a stabilization version, and using one raises your crate's effective **MSRV**. If you declare `rust-version = "1.74"` and then use `let`-else (1.65, fine) and RPITIT (1.75, not fine), the MSRV CI job catches it — which is exactly why that job exists. See [CI/CD for Rust](#/ch/ci-cd).

## Summary

- **`let`-else** (1.65) binds a pattern or diverges, flattening validation chains — the `else` block *must* `return`, `break`, `continue`, or panic.
- **`let`-chains** (1.88, **edition 2024 only**) allow `if let … && cond && let …` in one condition. The parse error on edition 2021 is unhelpful, so check the edition.
- **`matches!`** turns a pattern into a `bool`, with guards and `|` alternatives — ideal for `filter`, `any`, and shape assertions in tests.
- **Labeled blocks** (1.65) let you `break 'label value` out of a plain block, replacing the `loop`-that-never-loops hack.
- **RPITIT** and **`async fn` in traits** (1.75) remove most `Box<dyn>` and `#[async_trait]` boilerplate — but native `async fn` in traits still isn't `Send` by default, so `#[async_trait]` retains a niche.
- Smaller wins: inline format args (1.58), `is_some_and` (1.70), `inspect` (1.76), inline `const { … }` (1.79), `is_none_or` (1.82).
- Every feature has a stabilization version, and using it sets your **MSRV** floor.

> [!exercise] Try it yourself
> 1. Take a function with three nested `if let`s and rewrite it with `let`-else. Count the indentation levels you removed.
> 2. Write a `match` that returns `true` for one variant and `false` otherwise, then replace it with `matches!`. Add a guard to it.
> 3. Use a labeled block to classify a number into four ranges without a `match` and without nesting.
> 4. Define a trait with `fn items(&self) -> impl Iterator<Item = u32>` and implement it for two different types. What would this have required before 1.75?
> 5. Run `cargo clippy --fix` with `uninlined_format_args` enabled on a project. How many call sites changed?
> 6. Set `edition = "2024"` on a scratch project and rewrite the `Session` example using a `let`-chain. Then switch back to 2021 and read the error message.

That completes advanced Rust — the language, its recent additions, and the compile-time machinery underneath. Next we turn from the language itself to mastering its **standard library**.
