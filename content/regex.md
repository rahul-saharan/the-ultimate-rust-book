<h1><span class="h1-kicker">The Crate Ecosystem</span>regex: Pattern Matching on Text</h1>

A **regular expression** (regex) is a compact pattern language for matching text — finding phone numbers, validating emails, extracting fields from a log line. Rust's **regex** crate is fast (guaranteed linear time, no catastrophic backtracking), safe, and Unicode-aware. This chapter covers the everyday operations. (regex is on the in-book playground, so these examples run.)

## Compile once, use many times

Create a `Regex` with `Regex::new` (it returns a `Result` — an invalid pattern is an error), then use it to test, find, or replace:

```rust
use regex::Regex;

fn main() {
    // The r"..." raw string avoids doubling every backslash.
    let re = Regex::new(r"\d{4}-\d{2}-\d{2}").unwrap(); // a date like 2024-06-01

    println!("{}", re.is_match("today is 2024-06-01")); // true
    println!("{}", re.is_match("no date here"));         // false

    // Find the first match's text:
    if let Some(m) = re.find("logged on 2024-06-01 at noon") {
        println!("found: {}", m.as_str()); // 2024-06-01
    }
}
```

> [!performance] Compile the regex ONCE, outside hot loops
> `Regex::new` compiles the pattern into a state machine — real work you don't want to repeat. **Never** call `Regex::new` inside a loop that runs it against many strings; compile it once and reuse the `Regex`. For a global/static regex, wrap it in a [`LazyLock`](#/ch/std-sync) (`static RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(...).unwrap());`) so it compiles on first use and is reused forever.

## Capture groups: extracting pieces

Parentheses in a pattern create **capture groups** — the sub-parts you want to pull out. `captures` returns them, indexable by position:

```rust
use regex::Regex;

fn main() {
    let re = Regex::new(r"(\d{4})-(\d{2})-(\d{2})").unwrap();

    if let Some(caps) = re.captures("date: 2024-06-15") {
        println!("full:  {}", &caps[0]); // 2024-06-15 (whole match)
        println!("year:  {}", &caps[1]); // 2024
        println!("month: {}", &caps[2]); // 06
        println!("day:   {}", &caps[3]); // 15
    }
}
```

**Named groups** (`(?P<name>...)`) make the code far clearer than numeric indices:

```rust
use regex::Regex;

fn main() {
    let re = Regex::new(r"(?P<user>\w+)@(?P<domain>[\w.]+)").unwrap();

    if let Some(caps) = re.captures("contact: ferris@rust-lang.org") {
        println!("user:   {}", &caps["user"]);   // ferris
        println!("domain: {}", &caps["domain"]); // rust-lang.org
    }
}
```

## Finding all matches

`find_iter` and `captures_iter` iterate over *every* match in the text — perfect for extracting all occurrences:

```rust
use regex::Regex;

fn main() {
    let re = Regex::new(r"#(\w+)").unwrap(); // hashtags
    let text = "Loving #rust and #systems and #programming!";

    let tags: Vec<&str> = re.captures_iter(text)
        .map(|c| c.get(1).unwrap().as_str()) // group 1: the word after #
        .collect();

    println!("{tags:?}"); // ["rust", "systems", "programming"]
}
```

## Replacing

`replace` (first match) and `replace_all` (every match) substitute text. You can reference captured groups in the replacement with `$name` or `$1`:

```rust
use regex::Regex;

fn main() {
    let re = Regex::new(r"(\d{4})-(\d{2})-(\d{2})").unwrap();
    let text = "meeting on 2024-06-15";

    // Reorder the date to DD/MM/YYYY using capture references:
    let result = re.replace_all(text, "$3/$2/$1");
    println!("{result}"); // meeting on 15/06/2024

    // Simple redaction:
    let secrets = Regex::new(r"\b\d{16}\b").unwrap();
    println!("{}", secrets.replace_all("card 1234567812345678 ok", "[REDACTED]"));
}
```

## Splitting, and flags

Two more everyday operations. `split` treats the pattern as a delimiter, and **inline flags** (or `RegexBuilder`) change how matching works:

```rust
use regex::{Regex, RegexBuilder};

fn main() {
    // Split on any run of whitespace or commas:
    let sep = Regex::new(r"[\s,]+").unwrap();
    let fields: Vec<&str> = sep.split("alpha, beta,,  gamma").collect();
    println!("{fields:?}");

    // Inline flags go at the start of the pattern:
    //   (?i) case-insensitive   (?m) ^/$ match line boundaries   (?s) . matches \n
    let ci = Regex::new(r"(?i)rust").unwrap();
    println!("{} {}", ci.is_match("RUST"), ci.is_match("Rustacean"));

    let multi = Regex::new(r"(?m)^error").unwrap();
    println!("{}", multi.find_iter("ok\nerror: bad\nerror: worse").count());

    // RegexBuilder is the same thing, spelled out — clearer for several flags:
    let re = RegexBuilder::new(r"^\w+$")
        .case_insensitive(true)
        .multi_line(true)
        .build()
        .unwrap();
    println!("{}", re.is_match("Hello"));
}
```

> [!warning] Escape any user input you splice into a pattern
> Building a pattern from user text without escaping is the regex equivalent of SQL injection — at best it fails to match, at worst it's a denial of service. `regex::escape` neutralises every metacharacter:
> ```rust
> use regex::Regex;
>
> fn main() {
>     let user_input = "1+1"; // `+` is a quantifier — as a pattern this is broken
>     let broken = Regex::new(user_input);
>     println!("unescaped compiles? {}", broken.is_ok());
>
>     let safe = Regex::new(&regex::escape(user_input)).unwrap();
>     println!("escaped matches literally: {}", safe.is_match("what is 1+1?"));
> }
> ```
> And if all you need is a literal substring, skip regex entirely — `haystack.contains(needle)` is simpler and faster.

> [!performance] Rust's regex has no catastrophic backtracking — that's a real guarantee
> The `regex` crate compiles patterns to a finite automaton and matches in time **linear in the input length**, regardless of the pattern. The classic ReDoS attack — `(a+)+$` against a long string of `a`s, which hangs PCRE, Python, and JavaScript engines for exponential time — simply runs fast here.
>
> The price is that Rust's engine deliberately **omits backreferences (`\1`) and lookaround (`(?=…)`)**, because those features are what make linear-time matching impossible. If you truly need them, the `fancy-regex` crate adds them with backtracking — and with the performance characteristics that implies. For almost everything else, the guarantee is worth more than the features, especially when patterns touch untrusted input.

## The pattern cheat-sheet

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Common regex syntax elements and what they match">
  <style>
    .rgm { font: 600 11px var(--font-mono); fill: var(--text); }
    .rgc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cellr { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <rect x="14" y="16" width="150" height="24" class="cellr"/><text x="24" y="33" class="rgm">\d \w \s</text>
  <text x="174" y="33" class="rgc">digit, word char, whitespace</text>
  <rect x="14" y="44" width="150" height="24" class="cellr"/><text x="24" y="61" class="rgm">.  ^  $</text>
  <text x="174" y="61" class="rgc">any char, start, end</text>
  <rect x="14" y="72" width="150" height="24" class="cellr"/><text x="24" y="89" class="rgm">* + ? {n,m}</text>
  <text x="174" y="89" class="rgc">0+, 1+, optional, n-to-m times</text>
  <rect x="14" y="100" width="150" height="24" class="cellr"/><text x="24" y="117" class="rgm">[abc] [^a] |</text>
  <text x="174" y="117" class="rgc">char set, negated set, OR</text>
  <rect x="330" y="16" width="180" height="24" class="cellr"/><text x="340" y="33" class="rgm">(...) (?P&lt;n&gt;...)</text>
  <text x="520" y="33" class="rgc">group / named</text>
  <rect x="330" y="44" width="180" height="24" class="cellr"/><text x="340" y="61" class="rgm">\b</text>
  <text x="520" y="61" class="rgc">word boundary</text>
  <rect x="330" y="72" width="180" height="24" class="cellr"/><text x="340" y="89" class="rgm">(?i)</text>
  <text x="520" y="89" class="rgc">case-insensitive</text>
  <text x="14" y="140" class="rgc">Use raw strings r"..." so backslashes stay literal — regex patterns are full of them.</text>
</svg>
<figcaption>The regex syntax you'll use most — write patterns in raw strings <code>r"…"</code>.</figcaption>
</figure>

> [!tip] Rust's regex is linear-time — no ReDoS
> Many languages' regex engines can hit **catastrophic backtracking** on certain patterns, freezing on malicious input (a "ReDoS" attack). Rust's `regex` crate uses finite automata that guarantee **linear-time** matching — it *cannot* blow up like that. The trade-off: it omits backreferences and lookaround (features that require backtracking). For 99% of tasks you won't miss them, and you gain safety on untrusted input for free.

> [!mistake] Don't reach for regex when a simple method will do
> A regex is overkill for "does this start with `http`?" (`s.starts_with("http")`) or "split on commas" (`s.split(',')`). Those `str` methods are clearer and faster. Use regex when the pattern is genuinely *complex* — variable structure, alternation, extraction of sub-parts. Simple string checks belong to the [`str` methods](#/ch/std-string-str).

## Summary

- The **regex** crate matches text patterns; create a `Regex` with `Regex::new` (returns `Result`) and **compile it once** (use `LazyLock` for globals).
- Test with **`is_match`**, locate with **`find`**/**`find_iter`**, extract with **`captures`**/**`captures_iter`** (numeric `[1]` or **named** `["name"]` groups).
- Substitute with **`replace`**/**`replace_all`**, referencing groups as `$1`/`$name`.
- Write patterns in **raw strings `r"…"`**; Rust's engine is **linear-time** (ReDoS-safe) at the cost of no backreferences/lookaround.
- Prefer plain `str` methods for simple checks; use regex for genuinely complex patterns.

> [!exercise] Try it yourself
> 1. Write a regex that matches a simple email and use `captures` with named groups to extract the user and domain.
> 2. Use `find_iter` to count how many numbers appear in `"a1b22c333"`.
> 3. Use `replace_all` to turn all runs of whitespace in a string into single spaces (pattern `\s+`).

Next: seeing what your program is doing in production with structured logging via **tracing**.
