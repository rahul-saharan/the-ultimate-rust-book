<h1><span class="h1-kicker">The Crate Ecosystem</span>The Essential Crates Cheat Sheet</h1>

The previous chapters covered the giants in depth. This closing chapter is a **curated map** of the crates every Rust developer should know — organized by what you're trying to do. When you hit a new problem, scan here first: there's almost certainly a well-loved crate for it. (rand, itertools, and chrono-style examples that work on the playground are runnable.)

## The categories

<figure class="diagram">
<svg viewBox="0 0 640 200" role="img" aria-label="A map of essential Rust crates grouped by domain">
  <style>
    .ecm { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .ech { font: 700 11px var(--font-sans); }
    .box1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .box2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.2; }
    .box3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.2; }
    .box4 { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.2; }
  </style>
  <rect x="14" y="16" width="150" height="80" rx="8" class="box1"/>
  <text x="26" y="34" class="ech" fill="var(--rust-600)">Data</text>
  <text x="26" y="52" class="ecm">serde · serde_json</text>
  <text x="26" y="68" class="ecm">chrono · uuid</text>
  <text x="26" y="84" class="ecm">regex · csv</text>
  <rect x="174" y="16" width="150" height="80" rx="8" class="box2"/>
  <text x="186" y="34" class="ech" fill="var(--blue)">Async / Net</text>
  <text x="186" y="52" class="ecm">tokio · reqwest</text>
  <text x="186" y="68" class="ecm">axum · tonic</text>
  <text x="186" y="84" class="ecm">futures</text>
  <rect x="334" y="16" width="150" height="80" rx="8" class="box3"/>
  <text x="346" y="34" class="ech" fill="var(--green)">Utility</text>
  <text x="346" y="52" class="ecm">itertools · rand</text>
  <text x="346" y="68" class="ecm">rayon · once_cell</text>
  <text x="346" y="84" class="ecm">dashmap</text>
  <rect x="494" y="16" width="132" height="80" rx="8" class="box4"/>
  <text x="506" y="34" class="ech" fill="var(--purple)">App plumbing</text>
  <text x="506" y="52" class="ecm">clap · anyhow</text>
  <text x="506" y="68" class="ecm">thiserror</text>
  <text x="506" y="84" class="ecm">tracing · config</text>
  <text x="14" y="130" class="ech" fill="var(--text)">…plus databases (sqlx, diesel, sea-orm), testing (proptest, criterion, mockall),</text>
  <text x="14" y="150" class="ech" fill="var(--text)">and specialized domains (image, plotters, bevy, egui, polars, candle).</text>
  <text x="14" y="184" class="ecm" fill="var(--text-mute)">Scan by category → pick the well-maintained standard → check it against the five signals.</text>
</svg>
<figcaption>A bird's-eye map of the crates that show up in most real Rust projects.</figcaption>
</figure>

## Two you'll reach for constantly

**`rand`** — random numbers (games, sampling, tokens, tests):

```rust
use rand::Rng;

fn main() {
    let mut rng = rand::thread_rng();
    let dice: u32 = rng.gen_range(1..=6);   // random in an inclusive range
    let coin: bool = rng.gen();             // random bool
    let pick = ["red", "green", "blue"];
    let chosen = pick[rng.gen_range(0..pick.len())];
    println!("dice={dice}, coin={coin}, color={chosen}");
}
```

**`itertools`** — extra iterator adapters `std` doesn't have (`unique`, `group_by`, `chunks`, `join`, `sorted`, `cartesian_product`):

```rust
use itertools::Itertools;

fn main() {
    let data = vec![3, 1, 2, 2, 3, 1];

    let unique: Vec<_> = data.iter().unique().collect();  // dedup preserving order
    let sorted: Vec<_> = data.iter().sorted().collect();   // sort in an iterator chain
    let joined = (1..=4).map(|n| n.to_string()).join(" -> ");

    println!("unique: {unique:?}");
    println!("sorted: {sorted:?}");
    println!("joined: {joined}");
}
```

## Three more you'll reach for in real apps: CSV, validation & scheduling

Reading spreadsheet-style data, validating input, and running jobs on a schedule come up in almost
every real application. Here are the go-to crates for each. (They aren't on the in-book playground,
so these examples are illustrative — add the crate and run them locally.)

### CSV parsing with `csv`

The `csv` crate reads and writes comma-separated data, and pairs with [serde](#/ch/serde) to
deserialize each row straight into a typed struct:

```rust,ignore
// cargo add csv serde --features serde/derive
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct City {
    name: String,
    population: u64,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data = "name,population\nOslo,700000\nTokyo,14000000";
    let mut reader = csv::Reader::from_reader(data.as_bytes());
    for row in reader.deserialize() {
        let city: City = row?;              // each CSV row -> a typed struct
        println!("{} has {} people", city.name, city.population);
    }
    Ok(())
}
```

It handles headers, quoting, and custom delimiters, and works over any `Read`/`Write` (files,
strings, network) thanks to [std::io](#/ch/std-io).

### Input validation with `validator`

The `validator` crate adds declarative validation to your structs with a derive — ideal for
checking API request bodies, config, or parsed CSV before the rest of your code trusts them:

```rust,ignore
// cargo add validator --features derive
use validator::Validate;

#[derive(Validate)]
struct SignupForm {
    #[validate(email)]
    email: String,
    #[validate(length(min = 8, message = "password must be at least 8 characters"))]
    password: String,
    #[validate(range(min = 18, max = 120))]
    age: u8,
}

fn main() {
    let form = SignupForm { email: "not-an-email".into(), password: "short".into(), age: 15 };
    match form.validate() {
        Ok(()) => println!("valid!"),
        Err(errors) => println!("invalid: {errors}"),  // reports each failing field
    }
}
```

Built-in rules include `email`, `url`, `length`, `range`, `contains`, and `regex`, and you can plug
in custom validators. It's a natural companion to serde and [axum](#/ch/axum) for request validation.

### Scheduled & cron jobs with `tokio-cron-scheduler`

To run a task on a schedule — every minute, nightly, or on any cron expression —
`tokio-cron-scheduler` runs jobs on the [tokio](#/ch/tokio) runtime using standard cron syntax:

```rust,ignore
// cargo add tokio-cron-scheduler ; tokio with features = ["full"]
use tokio_cron_scheduler::{Job, JobScheduler};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let scheduler = JobScheduler::new().await?;

    // Cron fields: sec min hour day-of-month month day-of-week
    scheduler.add(Job::new_async("0 0 * * * *", |_uuid, _lock| {
        Box::pin(async { println!("running the hourly cleanup task"); })
    })?).await?;

    scheduler.start().await?;
    // ...keep the program alive so the scheduler can keep firing.
    Ok(())
}
```

For non-async programs, **`clokwerk`** offers a fluent scheduler (`every(5.minutes())`), and the
**`cron`** crate just parses and iterates cron expressions if you'd rather drive the timing yourself.

> [!tip] Validate at the edges; schedule with a library
> Run `validator` on data as it *enters* your program — request bodies, config, CSV rows — so
> everything downstream can trust it. And for recurring work, prefer a scheduler crate over a
> hand-rolled `loop { sleep(...) }`: it parses cron expressions, handles overlapping runs, and copes
> with time drift for you.

## Quick-start recipes

Short, copy-pasteable starters for the most useful crates that *don't* already have their own
chapter. Each shows the current stable version, how to add it with the right features, and a minimal
working snippet. (Versions are current as of writing — always check [crates.io](https://crates.io)
and [docs.rs](https://docs.rs) for the latest.)

### `chrono` — dates & times (v0.4)

```bash
cargo add chrono --features serde   # drop the feature if you don't need (de)serialization
```
```rust,ignore
use chrono::{Utc, DateTime, Duration};

let now: DateTime<Utc> = Utc::now();
println!("{}", now.format("%Y-%m-%d %H:%M:%S"));   // format for display
let tomorrow = now + Duration::days(1);             // date arithmetic
let parsed = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")?; // parse
```

### `uuid` — unique identifiers (v1.24)

```bash
cargo add uuid --features v4        # add "serde" too if you (de)serialize them
```
```rust,ignore
use uuid::Uuid;

let id = Uuid::new_v4();                         // a random UUID
let parsed = Uuid::parse_str("67e55044-10b1-426f-9247-bb680e5fe0c8")?;
println!("{id}");
```

### `rand` — random numbers (v0.10)

```bash
cargo add rand
```
```rust,ignore
use rand::Rng;

let mut rng = rand::rng();                // 0.9+ API (was `thread_rng()`)
let dice: u8 = rng.random_range(1..=6);    // 0.9+ (was `gen_range()`)
let coin: bool = rng.random();             // 0.9+ (was `gen()`)
```
> On **rand 0.8** the names are `rand::thread_rng()`, `gen_range()`, and `gen()` — the API was
> renamed in 0.9, so match the snippet to your version.

### `dashmap` — a concurrent HashMap (v6.2)

```bash
cargo add dashmap
```
```rust,ignore
use dashmap::DashMap;

let map = DashMap::new();          // share it across threads with Arc<DashMap<..>>
map.insert("hits", 0);
*map.get_mut("hits").unwrap() += 1; // no external Mutex needed
println!("{}", *map.get("hits").unwrap());
```

### `bytes` — cheap-to-clone byte buffers (v1.12)

```bash
cargo add bytes
```
```rust,ignore
use bytes::{BytesMut, BufMut, Bytes};

let mut buf = BytesMut::with_capacity(64);
buf.put(&b"hello "[..]);
buf.put(&b"world"[..]);
let frozen: Bytes = buf.freeze();  // Clone is O(1) — it shares the buffer
```

### `dotenvy` — load a `.env` file (v0.15)

```bash
cargo add dotenvy
```
```rust,ignore
fn main() {
    dotenvy::dotenv().ok();          // read .env into the environment (ok if missing)
    let db = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    println!("connecting to {db}");
}
```

### `config` — layered configuration (v0.15)

```bash
cargo add config
```
```rust,ignore
use config::{Config, File, Environment};

let settings = Config::builder()
    .add_source(File::with_name("config"))          // config.toml / .yaml / .json
    .add_source(Environment::with_prefix("APP"))     // APP_PORT overrides the file
    .build()?;
let port: u16 = settings.get("port")?;
```

### `indicatif` — progress bars & spinners (v0.18)

```bash
cargo add indicatif
```
```rust,ignore
use indicatif::ProgressBar;

let pb = ProgressBar::new(100);
for _ in 0..100 {
    // ...do a unit of work...
    pb.inc(1);
}
pb.finish_with_message("done");
```

### `tokio-tungstenite` — async WebSockets (v0.30)

```bash
cargo add tokio-tungstenite futures ; cargo add tokio --features full
```
```rust,ignore
use tokio_tungstenite::connect_async;
use futures::{SinkExt, StreamExt};

let (mut ws, _) = connect_async("wss://echo.websocket.org").await?;
ws.send("hello".into()).await?;
if let Some(Ok(msg)) = ws.next().await {
    println!("echoed: {msg}");
}
```

### `proptest` — property-based testing (v1.11)

```bash
cargo add --dev proptest
```
```rust,ignore
use proptest::prelude::*;

proptest! {
    #[test]
    fn reversing_twice_is_identity(v in prop::collection::vec(any::<i32>(), 0..100)) {
        let mut r = v.clone();
        r.reverse();
        r.reverse();
        prop_assert_eq!(r, v);   // proptest tries hundreds of random inputs
    }
}
```

### `mockall` — mock traits in tests (v0.15)

```bash
cargo add --dev mockall
```
```rust,ignore
use mockall::automock;

#[automock]
trait Database {
    fn get(&self, id: u32) -> Option<String>;
}

// In a test, use the generated MockDatabase:
let mut db = MockDatabase::new();
db.expect_get().returning(|_| Some("row".into()));
assert_eq!(db.get(1), Some("row".to_string()));
```

### `insta` — snapshot testing (v1.48)

```bash
cargo add --dev insta
```
```rust,ignore
#[test]
fn renders_greeting() {
    let output = format!("Hello, {}!", "Ferris");
    insta::assert_snapshot!(output);  // first run records; later runs compare
}
// Review and accept changed snapshots with:  cargo insta review
```

## The reference tables

Each row lists the crate, its current stable version (major.minor — pin the patch with `cargo add`),
how to add it with the features you'll usually want, and what it's for. Crates with their own
chapter are linked.

**Data & serialization**

| Crate | Version | Add with (features) | Purpose |
|-------|---------|---------------------|---------|
| `serde` + `serde_json` | 1.0 | `cargo add serde -F derive` + `cargo add serde_json` | JSON & many formats — [serde](#/ch/serde) |
| `toml` | 1.1 | `cargo add toml` | TOML config via serde |
| `csv` | 1.4 | `cargo add csv` (+ `serde`) | read/write CSV |
| `chrono` / `time` | 0.4 / 0.3 | `cargo add chrono -F serde` | dates, times, formatting |
| `uuid` | 1.24 | `cargo add uuid -F v4` | generate & parse UUIDs |
| `regex` | 1.13 | `cargo add regex` | regular expressions — [regex](#/ch/regex) |

**Async, networking & web**

| Crate | Version | Add with (features) | Purpose |
|-------|---------|---------------------|---------|
| `tokio` | 1.53 | `cargo add tokio -F full` | async runtime — [tokio](#/ch/tokio) |
| `reqwest` | 0.13 | `cargo add reqwest -F json` | HTTP client — [reqwest](#/ch/reqwest) |
| `axum` / `actix-web` | 0.8 / 4.14 | `cargo add axum` | web servers — [axum](#/ch/axum) |
| `tonic` + `prost` | 0.14 / 0.14 | `cargo add tonic prost` | gRPC — [tonic](#/ch/tonic) |
| `tokio-tungstenite` | 0.30 | `cargo add tokio-tungstenite` | WebSockets |
| `sqlx` / `sea-orm` / `diesel` | 0.9 / 2.0 / 2.3 | `cargo add sqlx -F runtime-tokio,postgres` | databases — [sqlx](#/ch/sqlx), [SeaORM](#/ch/seaorm) |
| `tokio-cron-scheduler` / `clokwerk` | 0.15 / 0.4 | `cargo add tokio-cron-scheduler` | scheduled / cron jobs |

**Utilities & performance**

| Crate | Version | Add with (features) | Purpose |
|-------|---------|---------------------|---------|
| `rand` | 0.10 | `cargo add rand` | random numbers |
| `itertools` | 0.15 | `cargo add itertools` | extra iterator adapters |
| `rayon` | 1.12 | `cargo add rayon` | data parallelism — [rayon](#/ch/rayon) |
| `dashmap` | 6.2 | `cargo add dashmap` | concurrent HashMap |
| `bytes` | 1.12 | `cargo add bytes` | efficient byte buffers |
| `once_cell` | 1.21 | (prefer std) | lazy statics — now in std as `LazyLock`/`OnceLock` |

**Application plumbing**

| Crate | Version | Add with (features) | Purpose |
|-------|---------|---------------------|---------|
| `clap` | 4.6 | `cargo add clap -F derive` | CLI parsing — [clap](#/ch/clap) |
| `anyhow` / `thiserror` | 1.0 / 2.0 | `cargo add anyhow thiserror` | errors — [anyhow & thiserror](#/ch/anyhow-thiserror) |
| `tracing` + `tracing-subscriber` | 0.1 / 0.3 | `cargo add tracing tracing-subscriber` | logging — [tracing](#/ch/tracing) |
| `validator` | 0.21 | `cargo add validator -F derive` | input validation |
| `config` / `dotenvy` | 0.15 / 0.15 | `cargo add config dotenvy` | config & `.env` files |
| `indicatif` | 0.18 | `cargo add indicatif` | progress bars & spinners |

**Testing & quality** (add these as dev-dependencies: `cargo add --dev …`)

| Crate | Version | Add with | Purpose |
|-------|---------|----------|---------|
| `criterion` | 0.8 | `cargo add --dev criterion` | statistical benchmarking |
| `proptest` / `quickcheck` | 1.11 / 1.1 | `cargo add --dev proptest` | property-based testing |
| `mockall` | 0.15 | `cargo add --dev mockall` | mock objects for tests |
| `insta` | 1.48 | `cargo add --dev insta` | snapshot testing |

> [!tip] Discover crates the smart way
> Beyond crates.io search, three great resources: **[lib.rs](https://lib.rs)** (crates.io reorganized by category, with quality signals), **[blessed.rs](https://blessed.rs)** (an opinionated "recommended crates" list), and **[Awesome Rust](https://github.com/rust-unofficial/awesome-rust)** (a curated GitHub list). When several crates compete, these help you spot the community-blessed default fast — then run it through the [five signals](#/ch/crates-overview).

> [!best] Resist dependency sprawl, but don't reinvent the wheel
> Two failure modes to avoid: (1) adding a crate for something `std` does fine (don't pull in a crate to reverse a string); (2) hand-writing something a mature crate does far better and safer (don't roll your own JSON parser, HTTP client, or date math). The sweet spot: use `std` for the basics, reach for a *well-maintained* crate for anything substantial, and keep your dependency list intentional. Check `cargo tree` occasionally to stay aware of what you've pulled in.

## Summary

- Rust's ecosystem has a well-loved crate for almost every need; scan by **category** (data, async/net, utility, plumbing, testing) to find it.
- Keep-in-your-pocket favorites: **`rand`** (randomness), **`itertools`** (extra iterator adapters), plus the giants from earlier chapters (serde, tokio, clap, anyhow/thiserror, reqwest, axum, sqlx, regex, tracing).
- Discover and vet crates via **lib.rs**, **blessed.rs**, **Awesome Rust**, and the [five signals](#/ch/crates-overview).
- Balance: use **`std`** for basics, reach for **mature crates** for substantial features, and keep dependencies intentional (`cargo tree`).

> [!exercise] Try it yourself
> 1. Use `rand` to simulate rolling two dice 1000 times and count how often the sum is 7.
> 2. Use `itertools`' `unique` and `sorted` to clean up a `Vec<i32>` with duplicates.
> 3. Browse lib.rs for a category you're curious about (e.g. "parsing" or "cryptography") and evaluate the top crate.

You now know the language *and* the ecosystem. Before we build real projects with them, we need the workshop around the code: **the Cargo toolbox, build scripts, feature flags, and debugging**.
