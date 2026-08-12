<h1><span class="h1-kicker">Testing & Quality</span>Testing in Depth</h1>

You can write a unit test, an [integration test](#/ch/test-organization), and a doc test. This chapter is the next level — the techniques that make a *real* codebase testable and its test suite trustworthy: **designing code so it can be tested**, **test doubles** (fakes and mocks), **table-driven** and **property-based** tests, **snapshot** tests, **async** tests, and how to test things that touch the outside world — an **HTTP API** or a **database** — without flakiness. These are the practices behind production Rust services.

## Design for testability first

The hardest tests to write are for code welded to the real world — the system clock, a database, a network call, the filesystem. The fix isn't a clever testing trick; it's a **design** move: depend on a **trait**, not a concrete thing. Your production code uses the real implementation; your tests substitute a controllable one. This is dependency injection, and it's the single highest-leverage testing habit.

```rust,test
// The code under test depends on a TRAIT, so tests can swap the implementation.
trait Clock {
    fn now_secs(&self) -> u64;
}

struct SystemClock;
impl Clock for SystemClock {
    fn now_secs(&self) -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

// Note: takes `&dyn Clock`, not `SystemClock` — that's what makes it testable.
fn is_expired(clock: &dyn Clock, deadline_secs: u64) -> bool {
    clock.now_secs() > deadline_secs
}

#[cfg(test)]
mod tests {
    use super::*;

    // A fake whose "time" we control → deterministic, instant tests (no real clock):
    struct FakeClock(u64);
    impl Clock for FakeClock {
        fn now_secs(&self) -> u64 { self.0 }
    }

    #[test]
    fn not_expired_before_the_deadline() {
        assert!(!is_expired(&FakeClock(100), 200));
    }

    #[test]
    fn expired_after_the_deadline() {
        assert!(is_expired(&FakeClock(300), 200));
    }
}
```

> [!key] Push the messy edges to the boundary
> Keep the parts that talk to the outside world (clock, DB, network) thin, behind traits, at the *edge* of your program. Then the **core logic** — the part with the bugs — is pure and trivially testable with fakes. This is "ports and adapters" / hexagonal architecture, and in Rust it's just traits. If a function is hard to test, that's usually a design smell telling you a dependency should be injected.

## Test doubles: fakes, stubs, mocks, spies

"Test double" is the umbrella term for any stand-in you use in place of a real dependency. They differ in *how much behavior* they carry and *what they let you assert*:

<figure class="diagram">
<svg viewBox="0 0 680 150" role="img" aria-label="A spectrum of test doubles from simple to rich: dummy, stub, fake, mock, spy">
  <style>
    .td-b { font: 700 11px var(--font-mono); fill: var(--text); }
    .td-c { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .box { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .hl  { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="14"  y="40" width="120" height="60" rx="8" class="box"/><text x="26" y="64" class="td-b">dummy</text><text x="26" y="84" class="td-c">a placeholder,</text><text x="26" y="97" class="td-c">never used</text>
  <rect x="146" y="40" width="120" height="60" rx="8" class="box"/><text x="158" y="64" class="td-b">stub</text><text x="158" y="84" class="td-c">returns canned</text><text x="158" y="97" class="td-c">values</text>
  <rect x="278" y="40" width="120" height="60" rx="8" class="hl"/><text x="290" y="64" class="td-b">fake</text><text x="290" y="84" class="td-c">working, simple</text><text x="290" y="97" class="td-c">impl (in-memory)</text>
  <rect x="410" y="40" width="120" height="60" rx="8" class="box"/><text x="422" y="64" class="td-b">mock</text><text x="422" y="84" class="td-c">asserts it was</text><text x="422" y="97" class="td-c">called as expected</text>
  <rect x="542" y="40" width="124" height="60" rx="8" class="box"/><text x="554" y="64" class="td-b">spy</text><text x="554" y="84" class="td-c">records calls for</text><text x="554" y="97" class="td-c">later inspection</text>
  <text x="14" y="28" class="td-c">simpler ← behavior & assertions → richer</text>
  <text x="14" y="128" class="td-c">Prefer a hand-written <b>fake</b> for most cases; reach for a mock library only when you must assert HOW a dependency was called.</text>
</svg>
<figcaption>The double spectrum. A hand-rolled <b>fake</b> (an in-memory implementation of your trait) covers most needs; mocks add call-verification.</figcaption>
</figure>

The `FakeClock` above is a **fake**. When you need to assert *that* (and *how*) a dependency was called — "the email sender was invoked exactly once with this address" — a mocking crate like **`mockall`** generates the boilerplate:

```rust,ignore
use mockall::automock;

#[automock]                       // generates `MockDatabase` for tests
trait Database {
    fn user_count(&self) -> u64;
}

fn store_is_empty(db: &dyn Database) -> bool {
    db.user_count() == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_empty_when_no_users() {
        let mut db = MockDatabase::new();
        db.expect_user_count()
            .times(1)              // assert it's called exactly once…
            .returning(|| 0);      // …and program its return value
        assert!(store_is_empty(&db));
    }
}
```

> [!best] Favor fakes over mocks
> Over-mocking couples your tests to *implementation details* ("was this exact method called?") so they break on harmless refactors. A **fake** tests *behavior* (the outcome) and stays robust. Rule of thumb: mock only at true I/O boundaries (network, DB) where a real call is impossible in a unit test; everywhere else, a small fake is clearer and less brittle.

## Table-driven tests

When one function needs checking against many input/output pairs, don't write ten near-identical test functions — drive them from a **table**. One test, many cases, and a message that pinpoints which case failed:

```rust,test
fn slugify(s: &str) -> String {
    s.trim().to_lowercase().replace(' ', "-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_handles_all_cases() {
        let cases = [
            ("Hello World", "hello-world"),
            ("  Trim Me  ", "trim-me"),
            ("Already-Slug", "already-slug"),
            ("", ""),
        ];
        for (input, expected) in cases {
            assert_eq!(slugify(input), expected, "failed on input {input:?}");
        }
    }
}
```

For a version that reports each case as its *own* test (better output, parallel), the **`rstest`** crate turns cases into separate test functions:

```rust,ignore
use rstest::rstest;

#[rstest]
#[case("Hello World", "hello-world")]
#[case("  Trim Me  ", "trim-me")]
#[case("", "")]
fn slugify_cases(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(slugify(input), expected);
}
```

## Property-based testing

Example tests check the cases *you thought of*. **Property-based** tests check a *rule* against **hundreds of random inputs the tool invents** — and on failure, "shrink" the counterexample to the smallest input that still breaks it. You assert an *invariant* ("reversing twice gives back the original", "the output is always sorted", "encode then decode is identity"), not specific values.

<figure class="diagram">
<svg viewBox="0 0 660 150" role="img" aria-label="An example test checks one hand-picked input; a property test generates many random inputs, checks an invariant on each, and shrinks any failure to a minimal case">
  <style>
    .pt-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .pt-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pt-h { font: 700 12px var(--font-sans); }
    .ex { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.3; }
    .pp { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
  </style>
  <text x="14" y="20" class="pt-h" fill="var(--text-mute)">Example test</text>
  <rect x="14" y="30" width="120" height="30" class="ex"/><text x="26" y="50" class="pt-b">one input</text>
  <path d="M134 45 L180 45" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pta)"/>
  <rect x="182" y="30" width="150" height="30" class="ex"/><text x="194" y="50" class="pt-b">assert == expected</text>
  <text x="14" y="90" class="pt-h" fill="var(--green)">Property test</text>
  <rect x="14" y="100" width="150" height="30" class="pp"/><text x="26" y="120" class="pt-b">100s random inputs</text>
  <path d="M164 115 L210 115" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pta)"/>
  <rect x="212" y="100" width="160" height="30" class="pp"/><text x="224" y="120" class="pt-b">check invariant holds</text>
  <path d="M372 115 L418 115" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pta)"/>
  <rect x="420" y="100" width="220" height="30" class="pp"/><text x="432" y="120" class="pt-b">shrink failure → minimal case</text>
  <defs><marker id="pta" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Property tests explore inputs you'd never enumerate by hand, and hand you the smallest failing example when they find a bug.</figcaption>
</figure>

You can approximate the idea in plain `std` by looping over generated inputs:

```rust,test
fn reverse<T: Clone>(v: &[T]) -> Vec<T> {
    v.iter().rev().cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Property: reversing twice is the identity — checked over many inputs.
    #[test]
    fn double_reverse_is_identity() {
        for n in 0..100u32 {
            let v: Vec<u32> = (0..n).collect();
            assert_eq!(reverse(&reverse(&v)), v);
        }
    }
}
```

The real tool, **`proptest`**, generates and shrinks for you:

```rust,ignore
use proptest::prelude::*;

proptest! {
    #[test]
    fn double_reverse_is_identity(v in prop::collection::vec(any::<i32>(), 0..100)) {
        let twice: Vec<i32> = v.iter().rev().rev().cloned().collect();
        prop_assert_eq!(twice, v); // holds for every generated `v`
    }
}
```

> [!tip] What makes a good property?
> Look for **round-trips** (`decode(encode(x)) == x`), **invariants** (a sorted output is always ordered; a balanced tree's height stays `O(log n)`), **oracles** (your fast version agrees with a slow, obviously-correct one), and **idempotence** (`f(f(x)) == f(x)`). Property tests are especially deadly on parsers, serializers, and data structures.

## Snapshot testing

For output that's tedious to assert field-by-field — a rendered template, a big JSON response, a formatted report — **snapshot testing** records the output once (a reviewed "snapshot" file) and then fails if it ever changes. The **`insta`** crate is the standard:

```rust,ignore
#[test]
fn renders_invoice() {
    let invoice = build_invoice();
    // First run writes the snapshot; later runs compare against it.
    // Review changes with `cargo insta review`.
    insta::assert_json_snapshot!(invoice);
}
```

> [!warning] Snapshots are only as good as the review
> A snapshot test's value is the human **reviewing** the diff when it changes. Rubber-stamping `cargo insta accept` without reading the diff turns a safety net into a rubber stamp. Use snapshots for large, stable outputs — not for values you can assert directly (that just hides intent).

## Testing async code

Async tests need a runtime; `#[tokio::test]` provides one per test (like `#[test]` but it runs an async fn):

```rust,ignore
#[tokio::test]
async fn fetches_within_timeout() {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        fetch_data(),
    ).await;
    assert!(result.is_ok(), "fetch should finish within 1s");
}
```

## Integration testing the outside world

The most valuable — and most flaky-prone — tests exercise your app end-to-end. Two patterns keep them reliable.

**Test an HTTP API by spawning the real app on a random port**, then hitting it with a client. Binding port `0` lets the OS pick a free port, so tests run in parallel without collisions:

```rust,ignore
// tests/api.rs — a black-box test of the running server.
async fn spawn_app() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();          // the OS-chosen port
    tokio::spawn(async move { run_server(listener).await });
    format!("http://{addr}")
}

#[tokio::test]
async fn health_check_returns_200() {
    let base = spawn_app().await;
    let resp = reqwest::get(format!("{base}/health")).await.unwrap();
    assert!(resp.status().is_success());
}
```

**Isolate database tests** so they never interfere. The gold standard is a **fresh, migrated database per test** (or a transaction that's rolled back at the end). `sqlx` bakes this in with `#[sqlx::test]`, which hands each test its own clean database and pool:

```rust,ignore
#[sqlx::test]                            // fresh migrated DB + pool, unique per test
async fn insert_then_read(pool: sqlx::PgPool) {
    let id = create_user(&pool, "alice").await.unwrap();
    let user = get_user(&pool, id).await.unwrap();
    assert_eq!(user.name, "alice");
}                                        // the test's database is torn down after
```

> [!key] The rules of non-flaky integration tests
> **Isolation** — each test gets its own port/DB/temp dir; never share mutable global state. **No sleeps** — don't `sleep(100ms)` and hope; await a real signal (a readiness check, a channel). **Determinism** — inject the clock and any randomness (seed it). **Clean up** — use RAII guards or framework hooks (`#[sqlx::test]`, `tempfile`) so a failed test still tidies up. Flaky tests get ignored, and ignored tests protect nothing. For spinning up real Postgres/Redis in CI, `testcontainers` runs them in throwaway Docker containers.

## Flaky tests: making the nondeterminism go away

A test that passes locally and fails in CI once a week is worse than no test — the team learns to re-run rather than investigate, and real failures get ignored with it. Flakiness nearly always traces to one of four sources, and each has a structural fix:

| Source | Symptom | Fix |
|---|---|---|
| **Wall-clock time** | fails at midnight, month boundaries, or under load | inject a clock; never call `Instant::now()` inside logic under test |
| **Randomness** | fails ~1 run in 50 | seed it: `StdRng::seed_from_u64(42)` |
| **Ordering** | fails only when tests run in parallel | remove shared state; `HashMap` iteration order is *deliberately* randomised |
| **Sleeps and timing** | fails on a slow CI box | wait for a condition, don't `sleep(100ms)` and hope |

```rust
use std::collections::HashMap;

// ❌ Depends on HashMap iteration order, which varies per run BY DESIGN.
fn first_key_bad(m: &HashMap<&str, i32>) -> Option<String> {
    m.keys().next().map(|k| k.to_string())
}

// ✅ Deterministic: state the ordering you actually mean.
fn first_key_good(m: &HashMap<&str, i32>) -> Option<String> {
    let mut keys: Vec<_> = m.keys().collect();
    keys.sort();
    keys.first().map(|k| k.to_string())
}

fn main() {
    let m: HashMap<&str, i32> = [("b", 2), ("a", 1), ("c", 3)].into_iter().collect();
    println!("sorted first key is always: {:?}", first_key_good(&m));
    println!("unsorted may vary run to run: {:?}", first_key_bad(&m));
}
```

> [!key] Inject the nondeterminism instead of hiding from it
> The general shape of the fix is the same in every case: take the unpredictable thing as a **parameter** rather than reaching for it globally. A function that calls `Instant::now()` internally can only be tested in real time; one that accepts `now: Instant` can be tested at any instant you like, including the leap second that broke production. The same applies to random seeds, environment variables, and the filesystem — this is the "design for testability" principle from the top of the chapter, applied to time.
>
> For the ordering case specifically: `HashMap`'s iteration order is randomised *on purpose* (it's part of the HashDoS defence), so a test that depends on it isn't unlucky — it's wrong. Use `BTreeMap` when you want deterministic order, or sort explicitly.

> [!warning] Don't paper over flakes with retries or `--test-threads=1`
> Both are tempting and both hide the signal. A retry turns "this fails 5% of the time" into "this fails silently 0.25% of the time" — the bug is still there, and it's now in production too, where nothing retries it. Forcing single-threaded tests masks genuine shared-state bugs that would also bite under real concurrent load.
>
> Use `--test-threads=1` to *diagnose* (if it fixes things, you have shared state), then fix the state. Reserve `#[ignore]` for tests that are legitimately slow or need external services, and run them separately in CI with `cargo test -- --ignored`.

## Measuring what you test: coverage

Coverage shows which lines your tests actually exercised — a guide to gaps (not a target to game):

```bash,ignore
cargo install cargo-llvm-cov
cargo llvm-cov --html        # open target/llvm-cov/html/index.html
```

> [!best] Coverage is a floormat, not a trophy
> 100% coverage doesn't mean "bug-free" — it means every line *ran*, not that every line was *meaningfully asserted*. Use coverage to find **untested** code (a `0%` module is a real signal), then write tests that assert behavior. Chasing a coverage percentage leads to tests that execute code without checking anything.

## Summary

- **Design for testability**: depend on **traits**, inject dependencies, and keep I/O at the edges so core logic is pure and easy to test.
- **Test doubles** range from stubs to mocks; prefer a hand-written **fake** and reach for **`mockall`** only to assert *how* an I/O boundary was called.
- Use **table-driven** tests (or **`rstest`**) for many input/output pairs, and **property tests** (**`proptest`**) to check invariants over random inputs with shrinking.
- **Snapshot** tests (**`insta`**) pin large, stable outputs — with a real human reviewing changes.
- Test **async** with `#[tokio::test]`; test an **API** by spawning it on port `0` and hitting it over HTTP; **isolate DB** tests with a fresh database per test (`#[sqlx::test]`) or `testcontainers`.
- Keep integration tests **isolated, sleep-free, deterministic, and self-cleaning** — flaky tests are worse than no tests. Use **coverage** to find gaps, not as a score.

> [!exercise] Try it yourself
> 1. Refactor a function that reads `SystemTime` to take an `&dyn Clock`, then test it with a `FakeClock`.
> 2. Convert three copy-pasted tests into one **table-driven** test with a helpful failure message.
> 3. Write a **property** (in plain `std`) that `sort` produces a non-decreasing sequence of the same length, checked over many random-ish inputs.
> 4. Sketch a `spawn_app()` helper that binds port `0` and returns the base URL for black-box API tests.

With code designed for testing and a suite that's fast and trustworthy, you can refactor fearlessly — which is what makes the rest of production Rust (config, auth, deployment) safe to build on.
