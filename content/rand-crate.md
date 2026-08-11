<h1><span class="h1-kicker">The Crate Ecosystem</span>rand: Random Numbers</h1>

The standard library has no random number generator. That's a deliberate choice — randomness needs a source of entropy from the operating system, several algorithms with different trade-offs, and a distribution system, all of which evolve faster than `std` can. So randomness lives in the `rand` crate, which is effectively the standard: dice rolls, shuffling, sampling, test data, simulations, and the foundation for cryptographic keys.

```toml
[dependencies]
rand = "0.8"
```

## Getting a random number

```rust
use rand::Rng;

fn main() {
    // thread_rng() gives you a fast, automatically-seeded generator,
    // one per thread. This is what you want 95% of the time.
    let mut rng = rand::thread_rng();

    // gen() produces a value across the type's full range.
    let n: u8 = rng.gen();
    let big: u64 = rng.gen();
    let ratio: f64 = rng.gen();          // f64 in [0, 1)
    let flag: bool = rng.gen();

    println!("u8   = {n}");
    println!("u64  = {big}");
    println!("f64  = {ratio:.4}");
    println!("bool = {flag}");

    // gen_range takes a Rust range — inclusive or exclusive, your choice.
    let d6 = rng.gen_range(1..=6);        // 1 to 6 inclusive — a die
    let index = rng.gen_range(0..10);     // 0 to 9 — a valid index
    let angle = rng.gen_range(0.0..360.0);

    println!("d6 = {d6}, index = {index}, angle = {angle:.1}°");

    // A weighted coin: true with the given probability.
    let rare = rng.gen_bool(0.05);        // 5% chance
    println!("rare event? {rare}");

    // The one-shot form, when you don't need to keep a generator around.
    let quick: u32 = rand::random();
    println!("one-shot = {quick}");
}
```

| Call | Produces |
|---|---|
| `rng.gen::<T>()` | a value over `T`'s whole range (`f64` → `[0, 1)`) |
| `rng.gen_range(a..b)` | uniform in a half-open range |
| `rng.gen_range(a..=b)` | uniform in an inclusive range |
| `rng.gen_bool(p)` | `true` with probability `p` |
| `rng.gen_ratio(a, b)` | `true` with probability `a/b` (exact, no float) |
| `rand::random::<T>()` | one value, using the thread generator |
| `rng.fill(&mut buf)` | fill a whole slice or array with random bytes |

> [!mistake] `gen_range(0..v.len())` panics on an empty collection
> An empty range is invalid — `gen_range(0..0)` panics with "cannot sample empty range". This bites when picking a random element from a collection that might be empty. Use `v.choose(&mut rng)` instead, which returns `Option<&T>` and handles the empty case for you. It's also clearer about intent.

## Picking, shuffling, and sampling

These live on slices and iterators, via traits you need to import.

```rust
use rand::prelude::*;

fn main() {
    let mut rng = rand::thread_rng();
    let names = ["ada", "grace", "alan", "hedy", "katherine"];

    // choose: one random element, as an Option (None if empty).
    println!("chosen: {:?}", names.choose(&mut rng));

    // choose_multiple: k distinct elements, WITHOUT replacement.
    let team: Vec<&&str> = names.choose_multiple(&mut rng, 3).collect();
    println!("team of 3: {team:?}");

    // shuffle: reorder in place (Fisher-Yates).
    let mut deck: Vec<u32> = (1..=10).collect();
    deck.shuffle(&mut rng);
    println!("shuffled: {deck:?}");

    // partial_shuffle: only randomize the first k — cheaper for large lists.
    let mut big: Vec<u32> = (1..=20).collect();
    let (front, _rest) = big.partial_shuffle(&mut rng, 5);
    println!("random 5 from 20: {front:?}");

    // choose_weighted: probability proportional to a weight.
    let loot = [("common", 70), ("rare", 25), ("legendary", 5)];
    let mut counts = [0u32; 3];
    for _ in 0..1000 {
        let (name, _) = loot.choose_weighted(&mut rng, |item| item.1).unwrap();
        let idx = loot.iter().position(|l| l.0 == *name).unwrap();
        counts[idx] += 1;
    }
    println!("1000 rolls: common={} rare={} legendary={}", counts[0], counts[1], counts[2]);

    // An empty collection is handled gracefully:
    let nothing: [u8; 0] = [];
    println!("choose from empty: {:?}", nothing.choose(&mut rng));
}
```

| Method | Does | Returns |
|---|---|---|
| `slice.choose(&mut rng)` | one element | `Option<&T>` |
| `slice.choose_mut(&mut rng)` | one element, mutably | `Option<&mut T>` |
| `slice.choose_multiple(&mut rng, k)` | `k` distinct elements | an iterator |
| `slice.choose_weighted(&mut rng, f)` | weighted by `f(item)` | `Result<&T, _>` |
| `slice.shuffle(&mut rng)` | reorder in place | `()` |
| `slice.partial_shuffle(&mut rng, k)` | randomize only the first `k` | `(&mut [T], &mut [T])` |
| `iter.choose(&mut rng)` | one element from any iterator | `Option<T>` |

> [!performance] `partial_shuffle` when you need k of n, and k is small
> A full `shuffle` of a million elements to pick ten is a million swaps. `partial_shuffle(&mut rng, 10)` does ten. Similarly, `choose_multiple` uses reservoir sampling over an iterator, so it never needs the whole collection in memory — you can sample 100 lines from a file of unknown length in one pass.

## Reproducibility: seeded generators

For tests, simulations, and procedural generation you need randomness that's *repeatable*. Seed a generator explicitly.

```rust
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

fn simulate(seed: u64, rounds: u32) -> Vec<u32> {
    // Same seed → same sequence, every run, on every machine.
    let mut rng = StdRng::seed_from_u64(seed);
    (0..rounds).map(|_| rng.gen_range(1..=100)).collect()
}

fn main() {
    let a = simulate(42, 5);
    let b = simulate(42, 5);
    let c = simulate(43, 5);

    println!("seed 42: {a:?}");
    println!("seed 42: {b:?}   ← identical");
    println!("seed 43: {c:?}   ← different");
    assert_eq!(a, b);

    // A seed from bytes, if you need a larger one:
    let mut rng = StdRng::from_seed([7u8; 32]);
    println!("from 32-byte seed: {}", rng.gen_range(0..1000));
}
```

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="A seeded generator produces the same deterministic sequence every run, while an OS-entropy generator produces a different one each time">
  <style>
    .rn-h { font: 700 12px var(--font-sans); }
    .rn-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .rn-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .rn-seed { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .rn-os { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .rn-out { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="20" y="18" class="rn-h" fill="var(--green)">StdRng::seed_from_u64(42) — deterministic</text>
  <rect x="20" y="28" width="120" height="34" rx="4" class="rn-seed"/>
  <text x="32" y="49" class="rn-m">seed = 42</text>
  <rect x="180" y="28" width="200" height="34" rx="4" class="rn-out"/><text x="192" y="49" class="rn-m">[37, 91, 4, 68, 12]</text>
  <rect x="180" y="66" width="200" height="26" rx="4" class="rn-out"/><text x="192" y="84" class="rn-m">[37, 91, 4, 68, 12]</text>
  <rect x="180" y="96" width="200" height="26" rx="4" class="rn-out"/><text x="192" y="114" class="rn-m">[37, 91, 4, 68, 12]</text>
  <text x="396" y="49" class="rn-c">run 1</text>
  <text x="396" y="84" class="rn-c">run 2 — same</text>
  <text x="396" y="114" class="rn-c">run 3 — same</text>
  <path d="M142 45 L176 45" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-rn)"/>
  <text x="20" y="152" class="rn-h" fill="var(--rust-600)">thread_rng() — OS entropy</text>
  <rect x="20" y="162" width="120" height="34" rx="4" class="rn-os"/>
  <text x="32" y="183" class="rn-m">OS entropy</text>
  <rect x="180" y="162" width="200" height="26" rx="4" class="rn-out"/><text x="192" y="180" class="rn-m">[8, 44, 71, 2, 95]</text>
  <rect x="180" y="192" width="200" height="26" rx="4" class="rn-out"/><text x="192" y="210" class="rn-m">[61, 13, 88, 40, 7]</text>
  <text x="396" y="180" class="rn-c">run 1</text>
  <text x="396" y="210" class="rn-c">run 2 — different</text>
  <path d="M142 179 L176 179" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#arr-rn2)"/>
  <defs>
    <marker id="arr-rn" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="arr-rn2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>Seed explicitly for anything that must be <b>reproducible</b> — tests, simulations, procedural generation. Use OS entropy for everything else.</figcaption>
</figure>

> [!best] Seed your tests, and print the seed on failure
> A test using `thread_rng()` passes 99 times and fails on the hundredth with no way to reproduce it. The fix: generate a random seed, use it to build an `StdRng`, and **include the seed in the assertion message**. Now a failure tells you exactly which input broke, and you can hard-code that seed to reproduce it. This is the same idea property-testing libraries like `proptest` build on — see [Testing in Depth](#/ch/testing-advanced).

| Generator | Speed | Reproducible | Use for |
|---|---|---|---|
| `thread_rng()` | fast | no | general use — the default |
| `StdRng::seed_from_u64(n)` | fast | **yes** | tests, simulations, procedural generation |
| `SmallRng::seed_from_u64(n)` | fastest | yes | huge volumes where quality matters less |
| `OsRng` | slow | no | seeding other generators; keys |
| `rand::random()` | fast | no | one-off values |

## Distributions

Uniform is the default, but real-world quantities are rarely uniform.

```rust
use rand::distributions::{Distribution, Uniform};
use rand::Rng;

fn main() {
    let mut rng = rand::thread_rng();

    // A reusable Uniform is faster than gen_range in a tight loop, because
    // it precomputes the rejection-sampling constants once.
    let die = Uniform::new_inclusive(1, 6);
    let rolls: Vec<i32> = (0..10).map(|_| die.sample(&mut rng)).collect();
    println!("10 rolls: {rolls:?}");

    // Count the distribution to sanity-check uniformity.
    let mut tally = [0u32; 6];
    for _ in 0..60_000 {
        tally[(die.sample(&mut rng) - 1) as usize] += 1;
    }
    println!("60k rolls per face: {tally:?}  (expect ~10000 each)");

    // Random alphanumeric strings — useful for IDs and test fixtures.
    let token: String = (0..12)
        .map(|_| {
            const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
            CHARS[rng.gen_range(0..CHARS.len())] as char
        })
        .collect();
    println!("token: {token}");

    // Random bytes, filled in one call.
    let mut key = [0u8; 16];
    rng.fill(&mut key);
    println!("16 random bytes: {key:02x?}");
}
```

| Distribution | Crate | Models |
|---|---|---|
| `Uniform` | `rand` | equal probability across a range |
| `Bernoulli` | `rand` | a weighted coin flip |
| `Alphanumeric` | `rand` | random `[A-Za-z0-9]` characters |
| `WeightedIndex` | `rand` | pick an index by weight |
| `Normal` | `rand_distr` | measurement error, natural variation |
| `LogNormal` | `rand_distr` | incomes, file sizes, latencies |
| `Exp` | `rand_distr` | time between independent events |
| `Poisson` | `rand_distr` | counts of events per interval |
| `Zipf` | `rand_distr` | word frequency, cache access patterns |

> [!tip] Latency and file sizes are log-normal, not normal
> If you're generating synthetic load or test data, uniform random values produce unrealistically well-behaved systems. Real latencies have a long right tail — most requests are fast and a few are dramatically slower — which is a **log-normal** shape, from `rand_distr`. Using it makes your load tests find the queueing problems that uniform data hides. Same for file sizes and request payloads.

## Random values for your own types

Implement `Distribution<T>` for `Standard` and your type joins `rng.gen()`.

```rust
use rand::distributions::{Distribution, Standard};
use rand::Rng;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

#[derive(Debug)]
struct Card {
    rank: u8, // 1-13
    suit: Suit,
}

impl Distribution<Suit> for Standard {
    fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> Suit {
        match rng.gen_range(0..4) {
            0 => Suit::Clubs,
            1 => Suit::Diamonds,
            2 => Suit::Hearts,
            _ => Suit::Spades,
        }
    }
}

impl Distribution<Card> for Standard {
    fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> Card {
        Card { rank: rng.gen_range(1..=13), suit: rng.gen() }
    }
}

fn main() {
    let mut rng = rand::thread_rng();

    // Now gen() works on your types, and so does gen-based collection building.
    let card: Card = rng.gen();
    println!("drew {card:?}");

    let hand: Vec<Card> = (0..5).map(|_| rng.gen()).collect();
    for c in &hand {
        println!("  {} of {:?}", c.rank, c.suit);
    }
}
```

## Cryptographic randomness

This is the distinction that matters most, and getting it wrong is a security bug.

> [!warning] `thread_rng` is fine for keys; `SmallRng` absolutely is not
> `rand`'s default `thread_rng()` uses ChaCha12, a **cryptographically secure** generator seeded from the OS — so it's suitable for tokens, passwords, salts, and nonces. `SmallRng` is *not* secure: it's optimized for speed, and its output is predictable from a few observed values. Anything security-relevant must use `thread_rng()`, `OsRng`, or a dedicated crate. Never use a seeded generator for a secret, because the seed *is* the secret.

| Need | Use |
|---|---|
| a session token or API key | `rand::thread_rng()` + `Alphanumeric`, or the `uuid` crate |
| a password hash salt | the hashing crate's own generator (`argon2`, `bcrypt`) |
| a cryptographic nonce or key | `OsRng` via `ring`, `rustls`, or `aes-gcm` |
| a UUID | `uuid::Uuid::new_v4()` |
| a shuffled deck in a game | `thread_rng()` — no security requirement |
| reproducible test data | `StdRng::seed_from_u64` |
| millions of values in a simulation | `SmallRng` |

See [Authentication & Security](#/ch/auth-security) for password hashing and token handling in full.

> [!note] `rand` 0.9 renamed several methods
> The 0.9 release (2025) renamed the core API for clarity: `thread_rng()` → `rng()`, `gen()` → `random()`, `gen_range()` → `random_range()`, and `distributions` → `distr`. The behaviour is the same. This book's runnable examples use **0.8**, which is what the Rust Playground provides and still what most of the ecosystem depends on. If you `cargo add rand` today you'll get 0.9 — the mapping above is all you need to translate these examples.

## Summary

- Randomness lives in **`rand`**, not `std`. `rand::thread_rng()` is the right default: fast, per-thread, and cryptographically secure.
- `gen()` for a full-range value, **`gen_range(a..=b)`** for a bounded one, `gen_bool(p)` for a weighted coin. `gen_range` **panics on an empty range**.
- For collections use **`choose`** (returns `Option`, so empty is safe), `choose_multiple`, `choose_weighted`, and `shuffle` — plus `partial_shuffle` when you need only `k` of `n`.
- **Seed explicitly** with `StdRng::seed_from_u64(n)` for anything that must be reproducible, and print the seed in test failures.
- A reusable **`Uniform`** beats `gen_range` in tight loops; `rand_distr` has `Normal`, `LogNormal`, `Exp`, and `Zipf` for realistic data.
- Implement **`Distribution<T> for Standard`** to make `rng.gen()` work on your own types.
- **Security**: `thread_rng`/`OsRng` are secure; **`SmallRng` and any seeded generator are not**. Never use a seed for a secret.
- `rand` **0.9** renamed `thread_rng`→`rng`, `gen`→`random`, `gen_range`→`random_range`.

> [!exercise] Try it yourself
> 1. Simulate 10,000 rolls of two dice and print how often each total from 2 to 12 came up. Does the shape match what you expect?
> 2. Write a function that picks a random element from a `&[T]` and handles the empty case without panicking. Then write the buggy `gen_range(0..len)` version and trigger the panic.
> 3. Write a test that uses a random seed, prints it in the assertion message on failure, and deliberately fails. Reproduce the failure using the printed seed.
> 4. Implement `Distribution<Suit> for Standard` for a `Direction` enum with four variants, then generate 1,000 and confirm they're roughly even.
> 5. Compare timings of `gen_range(1..=6)` in a loop against a reused `Uniform::new_inclusive(1, 6)` over ten million samples.

Next: the other thing `std` deliberately leaves out — real calendar dates and time zones, with **chrono and time**.
