<h1><span class="h1-kicker">Testing & Quality</span>Writing Tests</h1>

Rust treats testing as a first-class citizen — no external framework to install, no configuration to fiddle with. You write test functions right next to your code, run them with one command, and the compiler + test runner take care of the rest. Combined with Rust's strong type system, good tests give you the confidence to refactor fearlessly. This chapter teaches you the whole testing workflow.

## Your first test

A test is just a function marked with the `#[test]` attribute. If it runs without panicking, it passes; if it panics (usually via a failed assertion), it fails.

```rust,test
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*; // bring the outer code (like `add`) into scope

    #[test]
    fn adds_two_numbers() {
        assert_eq!(add(2, 3), 5);
    }
}
```

Run it with:

```bash
cargo test
```

You'll see each test listed with `ok` or `FAILED`, and a summary line. That's the entire loop.

> [!jargon] `#[test]` and `#[cfg(test)]`
> **`#[test]`** marks a function as a test — the test runner finds and executes it. **`#[cfg(test)]`** on the `mod tests` means "only compile this module when running tests." So your test code adds *zero* bytes to the program you ship — it exists only during `cargo test`.

## The assertion macros

Tests check expectations with assertion macros. If the check fails, the macro panics with a helpful message, marking the test as failed:

```rust,test
# fn add(a: i32, b: i32) -> i32 { a + b }
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assertions() {
        assert!(add(2, 2) == 4);              // assert a bool is true
        assert_eq!(add(2, 3), 5);             // assert two values are equal
        assert_ne!(add(2, 2), 5);             // assert two values differ

        // Add a custom message (shown on failure):
        let result = add(10, 20);
        assert_eq!(result, 30, "adding 10 and 20 should give 30, got {result}");
    }
}
```

> [!tip] Prefer `assert_eq!` over `assert!` for equality
> When checking two values are equal, use `assert_eq!(got, expected)` rather than `assert!(got == expected)`. On failure, `assert_eq!` prints **both** values (`left: 4, right: 5`), so you instantly see what went wrong — while `assert!` only tells you it was `false`. The same goes for `assert_ne!` when checking inequality.

### See the difference for yourself

That tip is easy to nod along to and easy to forget, so here it is made concrete. `cargo test` isn't available in the browser, but the assertion macros are just code that panics — so we can catch the panic and print exactly what the test runner would have shown you:

```rust
use std::panic;

/// Run a closure, capturing the panic message an assertion would produce.
fn failure_message(label: &str, f: impl FnOnce() + panic::UnwindSafe) {
    // Silence the default panic printout so the output stays readable.
    let previous = panic::take_hook();
    panic::set_hook(Box::new(|_| {}));
    let outcome = panic::catch_unwind(f);
    panic::set_hook(previous);

    match outcome {
        Ok(()) => println!("{label}\n    passed — no output\n"),
        Err(payload) => {
            let msg = payload
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| payload.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_else(|| "<unknown panic>".to_string());
            // Indent the message the way the test runner reports it.
            let indented: String =
                msg.lines().map(|l| format!("    {l}\n")).collect();
            println!("{label}\n{indented}");
        }
    }
}

fn add(a: i32, b: i32) -> i32 { a + b } // pretend this has a bug: returns 4 for (2,3)

fn main() {
    let buggy = |a: i32, b: i32| a + b - 1; // the "bug"

    failure_message("assert!  — tells you nothing but 'false':", || {
        assert!(buggy(2, 3) == 5);
    });

    failure_message("assert_eq! — shows BOTH values:", || {
        assert_eq!(buggy(2, 3), 5);
    });

    failure_message("assert_eq! with a custom message:", || {
        let result = buggy(10, 20);
        assert_eq!(result, 30, "adding 10 and 20 should give 30, got {result}");
    });

    failure_message("a passing assertion:", || {
        assert_eq!(add(2, 3), 5);
    });
}
```

Run it. The `assert!` failure says only `assertion failed: buggy(2, 3) == 5` — you know *something* is wrong but not what the value was. The `assert_eq!` failure prints `left: 4, right: 5`, which tells you the bug is an off-by-one without opening the debugger. When a test fails at 2 a.m., that difference is the whole ballgame.

> [!note] `catch_unwind` is a teaching device here, not a testing technique
> The wrapper above exists only so this page can *show* you assertion output in a browser. Don't reach for `panic::catch_unwind` in real tests — `#[should_panic]` (below) is the idiomatic way to assert that code panics, and it's clearer and harder to misuse. `catch_unwind` also won't save you if the profile sets `panic = "abort"`, since there's no unwinding to catch.

## Testing that code *panics*

Sometimes correct behavior *is* to panic — e.g. a function should reject invalid input. Verify that with `#[should_panic]`:

```rust,test
fn withdraw(balance: u32, amount: u32) -> u32 {
    if amount > balance {
        panic!("insufficient funds");
    }
    balance - amount
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic(expected = "insufficient funds")]
    fn overdraw_panics() {
        withdraw(50, 100); // should panic — and the message should contain the text
    }
}
```

The `expected = "..."` part makes the test stricter: it passes only if the panic message *contains* that substring, so you're testing the *right* panic, not just any crash.

## Tests that return `Result`

A test can return `Result<(), E>` instead of using assertions — handy when the code under test uses `?`. The test passes on `Ok` and fails on `Err`:

```rust,test
#[cfg(test)]
mod tests {
    #[test]
    fn parsing_works() -> Result<(), std::num::ParseIntError> {
        let n: i32 = "42".parse()?; // ? bubbles the error → test fails if it errs
        assert_eq!(n, 42);
        Ok(())
    }
}
```

## The anatomy of a good test: Arrange, Act, Assert

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="A test has three phases: arrange the inputs, act by calling the code, assert the result">
  <style>
    .wm { font: 600 12px var(--font-mono); fill: var(--text); }
    .wc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .a1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .a2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .a3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="16" y="30" width="190" height="60" rx="10" class="a1"/>
  <text x="30" y="54" class="wm" fill="var(--blue)">1. Arrange</text>
  <text x="30" y="76" class="wc">set up inputs &amp; state</text>
  <rect x="224" y="30" width="190" height="60" rx="10" class="a2"/>
  <text x="238" y="54" class="wm" fill="var(--rust-600)">2. Act</text>
  <text x="238" y="76" class="wc">call the code under test</text>
  <rect x="432" y="30" width="190" height="60" rx="10" class="a3"/>
  <text x="446" y="54" class="wm" fill="var(--green)">3. Assert</text>
  <text x="446" y="76" class="wc">check the result</text>
  <path d="M206 60 L222 60" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#aw)"/>
  <path d="M414 60 L430 60" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#aw)"/>
  <defs><marker id="aw" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Structure each test as <b>Arrange → Act → Assert</b> for clarity.</figcaption>
</figure>

```rust,test
# fn slugify(s: &str) -> String { s.to_lowercase().replace(' ', "-") }
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn slugify_lowercases_and_dashes() {
        let input = "Hello World";      // Arrange
        let slug = slugify(input);       // Act
        assert_eq!(slug, "hello-world"); // Assert
    }
}
```

## Table-driven tests: many cases, one test body

Once you take the "test the edges" advice seriously, you end up wanting a dozen cases for one function — and copy-pasting a dozen near-identical `#[test]` functions is miserable to read and to change. The fix is a **table** of `(input, expected)` pairs and one loop:

```rust,test
fn slugify(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_handles_all_cases() {
        // (description, input, expected) — the description makes failures readable.
        let cases = [
            ("typical",            "Hello World",        "hello-world"),
            ("already a slug",     "hello-world",        "hello-world"),
            ("punctuation",        "Rust: Fast & Safe!", "rust-fast-safe"),
            ("collapses runs",     "a   b",              "a-b"),
            ("trims edges",        "  padded  ",         "padded"),
            ("unicode kept",       "Café Olé",           "café-olé"),
            ("empty string",       "",                   ""),
            ("only punctuation",   "!!!",                ""),
        ];

        for (description, input, expected) in cases {
            assert_eq!(
                slugify(input),
                expected,
                "case '{description}' failed for input {input:?}"
            );
        }
    }
}
```

Eight edge cases, one body to maintain. The `description` in the assertion message is what makes this work in practice — without it, a failure tells you only that *something* in the loop broke.

You can execute the same idea right here, as a miniature test runner that keeps going after a failure and reports a summary — which is exactly what `cargo test` does for you:

```rust
fn slugify(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn main() {
    let cases = [
        ("typical",          "Hello World",        "hello-world"),
        ("already a slug",   "hello-world",        "hello-world"),
        ("punctuation",      "Rust: Fast & Safe!", "rust-fast-safe"),
        ("collapses runs",   "a   b",              "a-b"),
        ("trims edges",      "  padded  ",         "padded"),
        ("unicode kept",     "Café Olé",           "café-olé"),
        ("empty string",     "",                   ""),
        ("only punctuation", "!!!",                ""),
        ("DELIBERATELY WRONG expectation", "Hello", "goodbye"),
    ];

    let mut passed = 0;
    let mut failed = 0;

    for (description, input, expected) in cases {
        let got = slugify(input);
        if got == expected {
            passed += 1;
            println!("ok       {description}");
        } else {
            failed += 1;
            println!("FAILED   {description}");
            println!("           input:    {input:?}");
            println!("           expected: {expected:?}");
            println!("           got:      {got:?}");
        }
    }

    println!("\ntest result: {} passed; {} failed", passed, failed);
}
```

Note the last row: one case has a deliberately wrong expectation, so you can see what a failure report looks like *and* confirm the runner reports the other eight as passing rather than stopping at the first problem.

> [!best] One test per behavior, one table per function
> Table-driven tests are the right default for **pure functions** with many input/output pairs — parsers, formatters, validators, math. They're the wrong shape when each case needs different *setup* or asserts something different; then separate `#[test]` functions with descriptive names are clearer, because the test *name* becomes the failure message.
>
> One real limitation: a table is a single test, so it stops at the first failing case and you don't learn whether cases 4–8 also broke. If that matters, the [`rstest`](#/ch/testing-advanced) crate generates one real test per case from a table-like attribute, giving you both the brevity and the independent reporting.

## Running tests your way

`cargo test` accepts useful flags:

| Command | Does |
|---------|------|
| `cargo test` | Run all tests |
| `cargo test slugify` | Run tests whose name contains "slugify" |
| `cargo test -- --nocapture` | Show `println!` output from passing tests |
| `cargo test -- --test-threads=1` | Run tests sequentially (not in parallel) |
| `cargo test -- --ignored` | Run only tests marked `#[ignore]` |

> [!note] Tests run in parallel by default
> Rust runs your tests **in parallel** across threads for speed. This means tests must not depend on shared mutable state or a specific order — each should be independent. If a test needs isolation (say it touches a shared file), you can serialize with `--test-threads=1`, but designing independent tests is far better.

> [!best] Test behavior at the boundaries
> The bugs hide at the edges. For any function, test: a typical case, the **empty** case (empty string, empty list), the **boundary** (zero, one, the max), and the **error** case (invalid input). A function that's correct for `[]`, `[x]`, and `[lots]` is usually correct everywhere. Don't just test the happy path.

## Summary

- A test is a function marked **`#[test]`**; it passes unless it panics. Run all tests with **`cargo test`**.
- Put tests in a **`#[cfg(test)] mod tests`** so they compile only during testing and never ship.
- Assert with **`assert!`**, **`assert_eq!`**, **`assert_ne!`** (prefer the `_eq`/`_ne` versions — they print both values), with optional custom messages.
- Use **`#[should_panic(expected = "…")]`** to test that code panics correctly, and return **`Result`** from tests that use `?`.
- Tests run **in parallel** and must be independent; test the edges (empty, boundary, error), not just the happy path.

> [!exercise] Try it yourself
> 1. Write a `fn is_palindrome(s: &str) -> bool` and tests for `"level"` (true), `"rust"` (false), and `""` (true).
> 2. Add a `#[should_panic]` test for a function that panics on negative input.
> 3. On your machine, run `cargo test`, then `cargo test -- --nocapture` after adding a `println!` inside a test.
> 4. Run the assertion-output example above. Then add a case comparing two `Vec<i32>`s that differ in one element — how readable is `assert_eq!`'s output for collections?
> 5. Convert your `is_palindrome` tests from exercise 1 into a single **table-driven** test, and add cases for `"Level"` (capitalisation) and `"a man a plan"` (spaces). Decide what the right answers *should* be before you run it.
> 6. Break `slugify` deliberately (e.g. remove the `.trim()`), run the table test, and check that the failure message tells you which case broke.
> 7. Add a case to the mini test-runner that expects a panic. What happens to the whole run, and what does that tell you about why `#[should_panic]` exists?
> 8. Write a test that returns `Result<(), Box<dyn std::error::Error>>` and uses `?` on two fallible calls in sequence.

Tests in the same file are *unit* tests. Real projects also need *integration* tests that exercise your public API from outside. That's next: **test organization**.
