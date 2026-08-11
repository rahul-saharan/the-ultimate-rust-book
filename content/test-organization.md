<h1><span class="h1-kicker">Testing & Quality</span>Test Organization & Integration Tests</h1>

Rust recognizes two kinds of tests, and they serve different purposes. **Unit tests** check small pieces in isolation, living right beside the code (and able to see its private internals). **Integration tests** check that your public API works from the *outside*, exactly as a real user would call it. Knowing when to use each — and how Rust structures them — is the mark of a well-tested project.

## Unit tests: close and thorough

Unit tests live *inside* the file they test, in a `#[cfg(test)]` module. Their superpower is access to **private** items — because they're part of the same module, they can test internal helpers that aren't `pub`:

```rust,test
// A private helper — not part of the public API.
fn normalize(score: i32) -> i32 {
    score.clamp(0, 100)
}

pub fn grade(score: i32) -> char {
    match normalize(score) {
        90..=100 => 'A',
        80..=89 => 'B',
        _ => 'F',
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_clamps() {
        // We can test the PRIVATE `normalize` because we're in the same module.
        assert_eq!(normalize(150), 100);
        assert_eq!(normalize(-10), 0);
    }

    #[test]
    fn grade_boundaries() {
        assert_eq!(grade(90), 'A');
        assert_eq!(grade(89), 'B');
    }
}
```

> [!key] The `use super::*;` idiom
> Test modules almost always begin with `use super::*;`. `super` means "the parent module" — the file this test module lives in — so `*` pulls in everything defined there (public *and* private). That's how unit tests reach the internals they need.

## Integration tests: from the outside in

Integration tests live in a top-level **`tests/`** directory, as separate files. Each is compiled as its own crate that depends on yours — so it can only use your **public** API, just like a real consumer. This is how you verify your crate's *contract*.

```text
my_project/
├── src/
│   └── lib.rs          # your library code
└── tests/              # each file here is an integration test crate
    ├── api_test.rs
    └── common/
        └── mod.rs      # shared test helpers (not a test crate itself)
```

A file in `tests/` looks like this — note it `use`s your crate by name, exactly as an outside user would:

```rust,ignore
// tests/api_test.rs
use my_project::grade; // import from YOUR crate, like a real user

#[test]
fn grades_an_a() {
    assert_eq!(grade(95), 'A');
    // Note: we CANNOT call the private `normalize` here — only the public API.
}
```

> [!note] Integration tests only exist for library crates
> Because integration tests `use your_crate::…`, they need a library to import from. A pure binary crate (only `src/main.rs`) has no library API to test this way — which is why many projects put their real logic in `src/lib.rs` and keep `src/main.rs` a thin wrapper. That structure makes the logic testable *and* reusable.

| | Unit tests | Integration tests |
|---|---|---|
| Live in | `#[cfg(test)] mod` inside `src/` | files in `tests/` |
| See private items? | **yes** | no — public API only |
| Compiled as | part of your crate | a **separate** crate that depends on yours |
| Needs a library crate? | no | **yes** |
| Good for | edge cases, one function at a time | "does the public contract actually work?" |
| Typical count | many | fewer, one per user-facing scenario |

> [!warning] Every file in `tests/` compiles as its own crate — and that costs real time
> Ten files in `tests/` mean ten separate binaries linked against your library, ten times. On a project with a slow-to-link dependency, this is a noticeable chunk of `cargo test`'s wall-clock time, and it's the main criticism of Rust's default integration-test layout. The common fix is to have a **single** entry point, `tests/integration/main.rs`, with `mod api; mod cli;` pulling in the rest as plain modules — one crate, one link, many test files. Cargo compiles exactly what's declared as a `[[test]]` in `Cargo.toml`, so a lone `main.rs` at the top of `tests/` is treated as one test binary rather than many.

## The two together

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="Unit tests live inside src and see private code; integration tests live in the tests folder and see only public API">
  <style>
    .oh { font: 700 12px var(--font-sans); }
    .om { font: 600 11px var(--font-mono); fill: var(--text); }
    .oc { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .unit { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .integ { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .code { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="16" y="20" width="290" height="165" rx="10" fill="none" stroke="var(--blue)" stroke-width="1.5"/>
  <text x="30" y="42" class="oh" fill="var(--blue)">src/lib.rs</text>
  <rect x="30" y="52" width="260" height="34" rx="6" class="code"/><text x="42" y="74" class="om">pub fn grade() · fn normalize()</text>
  <rect x="30" y="94" width="260" height="46" rx="6" class="unit"/>
  <text x="42" y="114" class="om">#[cfg(test)] mod tests</text>
  <text x="42" y="132" class="oc">UNIT — sees private + public ✅</text>
  <text x="30" y="168" class="oc">Fast, granular, tests internals.</text>
  <rect x="326" y="20" width="298" height="165" rx="10" fill="none" stroke="var(--rust-400)" stroke-width="1.5"/>
  <text x="340" y="42" class="oh" fill="var(--rust-600)">tests/api_test.rs</text>
  <rect x="340" y="52" width="268" height="46" rx="6" class="integ"/>
  <text x="352" y="72" class="om">use my_project::grade;</text>
  <text x="352" y="90" class="oc">INTEGRATION — public API only ✅</text>
  <text x="340" y="126" class="oc">Compiled as a separate crate,</text>
  <text x="340" y="144" class="oc">like a real user of your library.</text>
  <text x="340" y="168" class="oc">Tests the public contract.</text>
</svg>
<figcaption>Unit tests verify the <b>insides</b>; integration tests verify the <b>public contract</b>. <code>cargo test</code> runs both.</figcaption>
</figure>

`cargo test` runs unit tests, integration tests, *and* documentation tests — all in one go, reporting each group separately.

| Command | Runs |
|---|---|
| `cargo test` | everything: unit, integration, doc tests |
| `cargo test grade` | only tests whose name **contains** `grade`, from any group |
| `cargo test --lib` | unit tests only |
| `cargo test --doc` | doc tests only |
| `cargo test --test api_test` | one integration test file only |
| `cargo test --test '*'` | every integration test file, no unit or doc tests |
| `cargo test -- --ignored` | tests marked `#[ignore]` (slow ones you skip by default) |
| `cargo test -- --nocapture` | show `println!` output even from passing tests |

> [!tip] `#[ignore]` for the tests too slow to run every time
> Mark a genuinely expensive test — one that hits a real database, or churns through a million iterations — with `#[ignore]`. It's still compiled and still counted, just skipped by default, so `cargo test` stays fast for everyday use and `cargo test -- --ignored` runs the full suite before a release:
> ```rust,ignore
> #[test]
> #[ignore = "slow: exercises 1M records"]
> fn handles_a_million_records() { /* ... */ }
> ```
> This is different from deleting the test or leaving it commented out — it stays real, discoverable, and runnable on demand. See [Debugging Rust](#/ch/debugging) for `--nocapture`, `--test-threads=1`, and reading test failures in more depth.

## Sharing setup between integration tests

Integration tests often need common helpers (fixtures, sample data). Put them in `tests/common/mod.rs` — using the `common/mod.rs` form (rather than `tests/common.rs`) tells Cargo it's a shared module, **not** its own test crate:

```rust,ignore
// tests/common/mod.rs
pub fn sample_users() -> Vec<String> {
    vec!["alice".into(), "bob".into()]
}

// tests/user_test.rs
mod common;

#[test]
fn has_two_sample_users() {
    assert_eq!(common::sample_users().len(), 2);
}
```

## Don't forget doc tests

As you saw in the [comments chapter](#/ch/comments), code examples inside `///` doc comments are compiled and run by `cargo test`. They're a third layer of testing that doubles as always-correct documentation:

```rust,ignore
/// Doubles a number.
///
/// ```
/// assert_eq!(my_crate::double(21), 42);
/// ```
pub fn double(n: i32) -> i32 { n * 2 }
```

> [!best] A healthy testing pyramid
> Aim for **many** small, fast **unit tests** (the base of the pyramid), a **moderate** number of **integration tests** covering key user journeys through your public API, and **doc tests** on every public item to keep examples honest. Lots of unit tests catch bugs early and precisely; a few integration tests catch wiring mistakes the units can't see.

## Choosing where a test belongs

A concrete example makes the boundary clearer than any rule. Say `grade` is backed by a private `normalize`, and a public `letter_range` describes each grade's cutoffs:

```rust,test
fn normalize(score: i32) -> i32 {
    score.clamp(0, 100)
}

pub fn grade(score: i32) -> char {
    match normalize(score) {
        90..=100 => 'A',
        80..=89 => 'B',
        70..=79 => 'C',
        _ => 'F',
    }
}

pub fn letter_range(letter: char) -> Option<(i32, i32)> {
    match letter {
        'A' => Some((90, 100)),
        'B' => Some((80, 89)),
        'C' => Some((70, 79)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // UNIT test: checks the private clamping logic directly. An outside
    // user of this crate could never write this test — they can't see
    // `normalize` at all.
    #[test]
    fn normalize_clamps_out_of_range_scores() {
        assert_eq!(normalize(150), 100);
        assert_eq!(normalize(-10), 0);
        assert_eq!(normalize(75), 75);
    }

    // Also a unit test, but it only touches the PUBLIC function — it could
    // just as easily live in tests/, which is the real signal for where
    // a test belongs: not where the file sits, but what it needs to see.
    #[test]
    fn grade_and_letter_range_agree() {
        for score in [95, 85, 75, 40] {
            let letter = grade(score);
            let (lo, hi) = letter_range(letter).unwrap();
            assert!((lo..=hi).contains(&score));
        }
    }
}
```

That second test is the key observation: **the deciding factor is what the test needs to see, not which folder it happens to be in.** A test that only calls public functions is free to live in `tests/` — and putting it there is better once your crate has real users, because it's automatically checked against the API a caller would actually use, imports included. Reach for a unit test specifically when you need to reach a private helper, as `normalize_clamps_out_of_range_scores` does.

## Summary

- **Unit tests** live in a `#[cfg(test)] mod tests` in the same file, start with `use super::*;`, and can test **private** items.
- **Integration tests** live in the top-level **`tests/`** directory, each as its own crate that `use`s your library's **public** API only.
- Integration tests require a **library crate** — which is why logic often goes in `src/lib.rs` with a thin `src/main.rs`.
- The real deciding factor is **what a test needs to see**, not which folder it's in — a test that only touches public functions can live in either place.
- Every file in `tests/` is a **separate compiled crate**; many files means many links. Consolidate under one `tests/integration/main.rs` with `mod` declarations if that becomes slow.
- Share helpers via **`tests/common/mod.rs`** (the `mod.rs` form avoids it being treated as a test crate).
- Filter with `cargo test <name>`, run one file with `--test <name>`, and mark slow tests **`#[ignore]`** so they run only with `-- --ignored`.
- **`cargo test`** runs unit, integration, and **doc** tests together. Favor a pyramid: many unit, some integration, doc tests everywhere.

> [!exercise] Try it yourself
> 1. In a `cargo new --lib` project, add a public function and both a unit test (testing a private helper) and an integration test in `tests/`.
> 2. Add a `tests/common/mod.rs` helper and use it from an integration test.
> 3. Add a doc-test example to a public function and confirm `cargo test` runs it.
> 4. Mark one test `#[ignore = "slow"]`, run `cargo test`, and confirm it's skipped. Then run it with `cargo test -- --ignored`.
> 5. Create five files in `tests/`, each with one trivial test, and time `cargo test`. Then merge them into one `tests/integration/main.rs` with `mod` declarations and time it again.

Testing proves your code is *correct*. Next we measure whether it's *fast*: **benchmarking and profiling**.
