<h1><span class="h1-kicker">The Crate Ecosystem</span>Dates & Times: chrono and time</h1>

The standard library gives you `Instant` (a monotonic stopwatch) and `SystemTime` (seconds since the Unix epoch). What it deliberately doesn't give you is *calendars* — no "what date is it", no time zones, no "add one month", no parsing `2026-08-10T09:14:22Z`. Those need a time-zone database and a great deal of human-calendar arithmetic, so they live in crates.

There are three serious options and one clear recommendation for each situation.

## Which crate?

| Crate | Choose when | Notes |
|---|---|---|
| **`std::time`** | measuring elapsed time; a Unix timestamp | already available; no calendar support |
| **`chrono`** | you need time zones, formatting, or parsing | the de-facto standard; huge ecosystem support |
| **`time`** | you want a smaller, `no_std`-capable option | stricter API, less ecosystem integration |
| **`jiff`** | a new project, and you want the best design | newest (2024); excellent, less widely adopted |

```toml
[dependencies]
# The common choice. `serde` for (de)serialization, `clock` for Local::now().
chrono = { version = "0.4", features = ["serde"] }
```

> [!best] `chrono` unless you have a specific reason otherwise
> It's what `sqlx`, `serde`, `diesel`, and most of the ecosystem integrate with, which matters enormously in practice — a `DateTime<Utc>` field just works in a database row or a JSON payload. `time` is a good crate with a stricter API and `no_std` support. `jiff` (from the author of `ripgrep` and `regex`) has the best design of the three and handles time-zone-aware arithmetic more correctly, but has less ecosystem reach so far. For learning and for most work, learn `chrono`.

## Start with what `std` gives you

Before reaching for a crate, check whether you need a calendar at all.

```rust
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn main() {
    // Instant: a MONOTONIC clock. The only correct way to measure elapsed time.
    let start = Instant::now();
    let sum: u64 = (1..=1_000_000).sum();
    let elapsed = start.elapsed();
    println!("summed to {sum} in {elapsed:?}");
    println!("as millis: {:.3}ms", elapsed.as_secs_f64() * 1000.0);

    // SystemTime: wall-clock time. Can jump backwards (NTP, DST, user change),
    // which is why duration_since returns a Result.
    let now = SystemTime::now();
    match now.duration_since(UNIX_EPOCH) {
        Ok(d) => println!("unix timestamp: {}", d.as_secs()),
        Err(e) => println!("clock is before 1970?! {e}"),
    }

    // Duration arithmetic, with the checked variants for untrusted input.
    let timeout = Duration::from_secs(30);
    let half = timeout / 2;
    println!("timeout {timeout:?}, half {half:?}");
    println!("saturating sub: {:?}", half.saturating_sub(timeout));
    println!("checked sub:    {:?}", half.checked_sub(timeout));
}
```

> [!key] `Instant` for durations, `SystemTime` for timestamps — never the reverse
> `Instant` is **monotonic**: it only moves forward, is unaffected by NTP corrections or the user changing the clock, and is therefore the only correct way to measure "how long did this take". `SystemTime` is wall-clock: it can jump backwards, which is exactly why `duration_since` returns a `Result`. Timing a request with `SystemTime` produces occasional negative durations in production, and that bug is very hard to reproduce.

> [!warning] `Instant` values are meaningless outside the process
> An `Instant` has no defined epoch — it's an opaque point measured from some arbitrary origin, often system boot. You cannot serialize it, store it in a database, compare it across machines, or convert it to a date. If you need a value that means something to anyone else, that's a `SystemTime` or a `DateTime<Utc>`.

## `chrono`: the core types

```rust,ignore
use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};

fn main() {
    // The three main shapes:
    let now_utc: DateTime<Utc> = Utc::now();               // an instant, in UTC
    let now_local: DateTime<Local> = Local::now();          // the same instant, local zone
    let date: NaiveDate = NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(); // no zone at all

    println!("utc   {now_utc}");
    println!("local {now_local}");
    println!("date  {date}");

    // Constructing a specific moment.
    let launch = Utc
        .with_ymd_and_hms(2026, 8, 10, 9, 14, 22)
        .single()
        .expect("valid, unambiguous time");
    println!("launch {launch}");

    // Arithmetic uses chrono's Duration (an alias for TimeDelta).
    let tomorrow = now_utc + Duration::days(1);
    let in_90_min = now_utc + Duration::minutes(90);
    println!("tomorrow  {tomorrow}");
    println!("in 90 min {in_90_min}");

    // Differences give you a Duration you can query.
    let gap = tomorrow - now_utc;
    println!("gap: {} hours, {} seconds", gap.num_hours(), gap.num_seconds());

    // Component access.
    use chrono::{Datelike, Timelike};
    println!(
        "{}-{:02}-{:02} is day {} of the year, a {:?}",
        now_utc.year(), now_utc.month(), now_utc.day(), now_utc.ordinal(), now_utc.weekday()
    );
    println!("time: {:02}:{:02}:{:02}", now_utc.hour(), now_utc.minute(), now_utc.second());
}
```

<figure class="diagram">
<svg viewBox="0 0 640 235" role="img" aria-label="The relationship between naive local types with no time zone, time-zone-aware DateTime types, and the underlying UTC instant">
  <style>
    .dt-h { font: 700 12px var(--font-sans); }
    .dt-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .dt-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dt-naive { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .dt-aware { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .dt-inst { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="dt-h" fill="var(--text-mute)">Naive — no time zone. A wall-clock reading, ambiguous on its own.</text>
  <rect x="20" y="28" width="180" height="40" rx="4" class="dt-naive"/>
  <text x="30" y="46" class="dt-m">NaiveDate</text>
  <text x="30" y="61" class="dt-c">2026-08-10</text>
  <rect x="210" y="28" width="190" height="40" rx="4" class="dt-naive"/>
  <text x="220" y="46" class="dt-m">NaiveDateTime</text>
  <text x="220" y="61" class="dt-c">2026-08-10 09:14:22</text>
  <rect x="410" y="28" width="150" height="40" rx="4" class="dt-naive"/>
  <text x="420" y="46" class="dt-m">NaiveTime</text>
  <text x="420" y="61" class="dt-c">09:14:22</text>
  <text x="20" y="104" class="dt-h" fill="var(--rust-600)">Aware — a naive time PLUS a zone. Now it names a real moment.</text>
  <rect x="20" y="114" width="240" height="42" rx="4" class="dt-aware"/>
  <text x="30" y="132" class="dt-m">DateTime&lt;Utc&gt;</text>
  <text x="30" y="148" class="dt-c">2026-08-10T09:14:22Z</text>
  <rect x="280" y="114" width="280" height="42" rx="4" class="dt-aware"/>
  <text x="290" y="132" class="dt-m">DateTime&lt;Local&gt; / DateTime&lt;Tz&gt;</text>
  <text x="290" y="148" class="dt-c">2026-08-10T10:14:22+01:00</text>
  <rect x="150" y="184" width="340" height="34" rx="4" class="dt-inst"/>
  <text x="162" y="206" class="dt-m">the same instant: 1786353262 seconds since epoch</text>
  <path d="M140 158 L250 182" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-dt)"/>
  <path d="M420 158 L390 182" stroke="var(--green)" stroke-width="2" marker-end="url(#arr-dt)"/>
  <text x="20" y="232" class="dt-c">Store and compute in <tspan font-family="var(--font-mono)">DateTime&lt;Utc&gt;</tspan>; convert to a local zone only when displaying to a person.</text>
  <defs><marker id="arr-dt" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption>A <b>Naive</b> type is a calendar reading with no zone; adding a zone makes it a real <b>instant</b>. Two aware values in different zones can be the same moment.</figcaption>
</figure>

| Type | Has a zone? | Represents |
|---|---|---|
| `NaiveDate` | no | a calendar date (a birthday, a due date) |
| `NaiveTime` | no | a time of day (a daily 09:00 job) |
| `NaiveDateTime` | no | a wall-clock reading with no zone |
| `DateTime<Utc>` | yes | **an actual instant** — what you should store |
| `DateTime<Local>` | yes | the same instant, rendered in the machine's zone |
| `DateTime<FixedOffset>` | yes | an instant with a fixed offset (`+01:00`) |
| `DateTime<Tz>` (chrono-tz) | yes | an instant in a named zone (`Europe/London`) |
| `TimeDelta` (`Duration`) | — | a signed span of time |

> [!key] Store UTC, display local
> This is the rule that prevents most date bugs. Keep every timestamp in your database, your logs, and your business logic as `DateTime<Utc>` — unambiguous, comparable, and immune to DST. Convert to a local zone at exactly one place: the moment you render it for a human. Storing local times means you cannot tell whether `2026-10-25 01:30` was before or after the clocks changed, and that data is unrecoverable.

## Formatting and parsing

```rust,ignore
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};

fn main() {
    let dt = "2026-08-10T09:14:22Z".parse::<DateTime<Utc>>().unwrap();

    // RFC 3339 / ISO 8601 — what you want for APIs, logs, and storage.
    println!("{}", dt.to_rfc3339());
    println!("{}", dt.to_rfc2822());

    // strftime-style custom formatting.
    println!("{}", dt.format("%Y-%m-%d %H:%M:%S"));
    println!("{}", dt.format("%A, %e %B %Y"));      // Monday, 10 August 2026
    println!("{}", dt.format("%d/%m/%Y %I:%M %p")); // 10/08/2026 09:14 AM

    // Parsing: three cases, three functions.
    // 1. An RFC 3339 string with an offset → fully aware.
    let a = DateTime::parse_from_rfc3339("2026-08-10T10:14:22+01:00").unwrap();
    println!("parsed aware: {} (UTC: {})", a, a.with_timezone(&Utc));

    // 2. A custom format WITHOUT a zone → naive, then attach one deliberately.
    let naive = NaiveDateTime::parse_from_str("10/08/2026 09:14", "%d/%m/%Y %H:%M").unwrap();
    let assumed_utc = naive.and_utc();
    println!("parsed naive: {naive} → assumed UTC: {assumed_utc}");

    // 3. Just a date.
    let d = NaiveDate::parse_from_str("2026-08-10", "%Y-%m-%d").unwrap();
    println!("parsed date: {d}");

    // Parsing returns Result — always handle it.
    match NaiveDate::parse_from_str("2026-02-30", "%Y-%m-%d") {
        Ok(d) => println!("{d}"),
        Err(e) => println!("Feb 30 rejected: {e}"),
    }
}
```

| Specifier | Means | Example |
|---|---|---|
| `%Y` / `%y` | 4- / 2-digit year | 2026 / 26 |
| `%m` / `%B` / `%b` | month number / name / abbrev | 08 / August / Aug |
| `%d` / `%e` | day, zero- / space-padded | 10 / 10 |
| `%A` / `%a` | weekday name / abbrev | Monday / Mon |
| `%H` / `%I` | hour, 24- / 12-hour | 09 / 09 |
| `%M` / `%S` | minute / second | 14 / 22 |
| `%.3f` | fractional seconds | .481 |
| `%p` | AM/PM | AM |
| `%z` / `%:z` | offset | +0100 / +01:00 |
| `%s` | Unix timestamp | 1786353262 |
| `%j` | day of year | 222 |
| `%%` | a literal `%` | % |

> [!best] Use RFC 3339 for every machine-readable timestamp
> `to_rfc3339()` produces `2026-08-10T09:14:22+00:00` — sortable as a string, unambiguous about its offset, parseable by every language, and what JSON APIs and databases expect. Custom `%d/%m/%Y` formats are for *displaying* to humans, and even then, prefer locale-aware formatting if you have international users. A custom format in an API contract will eventually be parsed wrongly by someone.

## Time zones and DST

This is where dates get genuinely hard, and where the library earns its keep.

```toml
[dependencies]
chrono = "0.4"
chrono-tz = "0.10"     # the IANA time zone database
```

```rust,ignore
use chrono::{Duration, TimeZone, Utc};
use chrono_tz::Europe::London;
use chrono_tz::America::New_York;

fn main() {
    let instant = Utc.with_ymd_and_hms(2026, 8, 10, 12, 0, 0).unwrap();

    // One moment, rendered in three zones. All the same instant.
    println!("UTC:      {}", instant);
    println!("London:   {}", instant.with_timezone(&London));
    println!("New York: {}", instant.with_timezone(&New_York));

    // The DST transition. In Europe/London, clocks go back on 2026-10-25 at 02:00.
    // 01:30 local time happens TWICE that night — so it's ambiguous.
    let ambiguous = London.with_ymd_and_hms(2026, 10, 25, 1, 30, 0);
    println!("\n01:30 on the transition night: {ambiguous:?}");
    // → Ambiguous(..) — chrono makes you choose which one you meant.

    // In spring, 01:30 does not exist at all when clocks jump forward.
    let nonexistent = London.with_ymd_and_hms(2026, 3, 29, 1, 30, 0);
    println!("01:30 on the spring-forward night: {nonexistent:?}");
    // → None — that local time never occurred.

    // Adding 24 hours is NOT the same as adding one day across a transition.
    let evening = London.with_ymd_and_hms(2026, 10, 24, 20, 0, 0).unwrap();
    let plus_24h = evening + Duration::hours(24);
    println!("\n{}  + 24h → {}", evening, plus_24h);
    // The wall-clock time shifts by an hour, because the day was 25 hours long.
}
```

> [!warning] "One day later" and "24 hours later" are different questions
> On a DST transition a local day is 23 or 25 hours long. `+ Duration::hours(24)` adds exactly 24 hours of elapsed time, so the wall-clock time moves. `+ Duration::days(1)` in chrono is also defined as 86,400 seconds. If you mean "the same time tomorrow", you must do the arithmetic on the **naive local date**, then re-attach the zone — and handle the ambiguous and non-existent cases. This is the single most common date bug in production software, and `jiff` exists partly to make it harder to get wrong.

> [!mistake] `with_ymd_and_hms` returns `LocalResult`, not a `DateTime`
> Because a local time can be **ambiguous** (it occurred twice) or **non-existent** (it was skipped), chrono returns a three-state result: `Single`, `Ambiguous(earlier, later)`, or `None`. Calling `.unwrap()` on it is fine for UTC (never ambiguous) and a latent panic for a real zone. Use `.single()` when you've reasoned it can't be ambiguous, and match on it otherwise.

## Date arithmetic that respects the calendar

```rust,ignore
use chrono::{Datelike, Duration, Months, NaiveDate};

fn main() {
    let d = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();

    // Adding months is not adding 30 days — chrono clamps to a valid date.
    println!("{d} + 1 month  = {:?}", d.checked_add_months(Months::new(1)));  // 2026-02-28
    println!("{d} + 2 months = {:?}", d.checked_add_months(Months::new(2)));  // 2026-03-31
    println!("{d} + 30 days  = {:?}", d.checked_add_signed(Duration::days(30)));

    // Leap years are handled for you.
    println!("\nFeb 29 2024 exists? {:?}", NaiveDate::from_ymd_opt(2024, 2, 29));
    println!("Feb 29 2026 exists? {:?}", NaiveDate::from_ymd_opt(2026, 2, 29));

    // Useful calendar queries.
    let today = NaiveDate::from_ymd_opt(2026, 8, 10).unwrap();
    println!("\nweekday: {:?}", today.weekday());
    println!("ISO week: {:?}", today.iso_week().week());
    println!("day of year: {}", today.ordinal());

    // First and last day of the month.
    let first = today.with_day(1).unwrap();
    let last = first.checked_add_months(Months::new(1)).unwrap().pred_opt().unwrap();
    println!("month runs {first} to {last}");

    // Counting days between dates.
    let then = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
    println!("days since Jan 1: {}", (today - then).num_days());
}
```

> [!tip] Use the `checked_*` variants for anything from user input
> `checked_add_months`, `checked_add_signed`, `from_ymd_opt`, `and_hms_opt` all return `Option` instead of panicking. Given that dates commonly come from a form field or an API payload, the `Option`-returning forms are the correct default — `from_ymd_opt(2026, 13, 45)` gives you `None` where a panicking version would take down a request handler.

## Serialization and databases

```rust,ignore
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Event {
    name: String,
    // With chrono's "serde" feature, this round-trips as an RFC 3339 string.
    created_at: DateTime<Utc>,
    // A date with no time component.
    due: NaiveDate,
    // Optional timestamps work as you'd expect.
    completed_at: Option<DateTime<Utc>>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let event = Event {
        name: "launch".into(),
        created_at: Utc::now(),
        due: NaiveDate::from_ymd_opt(2026, 12, 25).unwrap(),
        completed_at: None,
    };

    let json = serde_json::to_string_pretty(&event)?;
    println!("{json}");

    let back: Event = serde_json::from_str(&json)?;
    println!("{back:?}");
    Ok(())
}
```

| Target | Type to use | Notes |
|---|---|---|
| JSON / an API | `DateTime<Utc>` | serializes as RFC 3339 |
| PostgreSQL `timestamptz` | `DateTime<Utc>` | the correct column type |
| PostgreSQL `timestamp` | `NaiveDateTime` | ⚠️ no zone — usually a schema mistake |
| PostgreSQL `date` | `NaiveDate` | |
| MySQL `DATETIME` | `NaiveDateTime` | MySQL has no zone-aware type |
| SQLite | `DateTime<Utc>` | stored as text; sorts correctly |
| a Unix timestamp column | `i64` + `DateTime::from_timestamp` | |

> [!warning] `timestamp` without a time zone is a schema bug waiting to happen
> A PostgreSQL `timestamp` column stores a wall-clock reading with no offset, so nothing in the database knows which zone it meant. Two services in different regions writing "now" produce values that silently disagree by hours, and you cannot recover the truth afterwards. Use **`timestamptz`** — which despite the name stores a UTC instant — and map it to `DateTime<Utc>`. See [sqlx & Databases](#/ch/sqlx).

## Testing code that depends on time

> [!best] Inject the clock; never call `Utc::now()` deep in your logic
> A function that calls `Utc::now()` internally cannot be tested for "what happens at month end", "what happens across a DST transition", or "what happens when the token expired yesterday" — you'd have to change the system clock. Pass the current time in as a parameter, or take a small `Clock` trait with a real and a fake implementation. It's a two-line change that makes an entire category of logic testable:
> ```rust,ignore
> trait Clock { fn now(&self) -> DateTime<Utc>; }
>
> struct SystemClock;
> impl Clock for SystemClock { fn now(&self) -> DateTime<Utc> { Utc::now() } }
>
> struct FixedClock(DateTime<Utc>);
> impl Clock for FixedClock { fn now(&self) -> DateTime<Utc> { self.0 } }
>
> fn is_expired(token_expiry: DateTime<Utc>, clock: &impl Clock) -> bool {
>     clock.now() > token_expiry
> }
> ```

## Summary
- `std::time` gives you **`Instant`** (monotonic — use it for durations) and **`SystemTime`** (wall clock — use it for timestamps). Never swap them.
- An `Instant` has **no epoch** and can't be stored, serialized, or compared across machines.
- Use **`chrono`** for calendars: it's what the ecosystem integrates with. `time` for `no_std`, `jiff` for the best design on a greenfield project.
- **Naive** types have no zone; **`DateTime<Utc>`** is a real instant. **Store UTC, display local** — this rule prevents most date bugs.
- Format machine-readable timestamps as **RFC 3339**; save `strftime` patterns for human display.
- `with_ymd_and_hms` returns a three-state **`LocalResult`** because a local time can be ambiguous or non-existent. Don't blindly `unwrap` it for a real zone.
- **"One day later" ≠ "24 hours later"** across a DST transition. Do calendar arithmetic on naive dates, then re-attach the zone.
- Prefer the **`checked_*` / `*_opt`** constructors for anything from user input.
- Use **`timestamptz`** in PostgreSQL, mapped to `DateTime<Utc>`; a bare `timestamp` loses information permanently.
- **Inject the clock** so time-dependent logic is testable.

> [!exercise] Try it yourself
> 1. Time a loop with `Instant` and print it three ways: `{:?}`, milliseconds, and microseconds.
> 2. Parse `"2026-08-10T09:14:22Z"` into a `DateTime<Utc>`, then print it in three time zones with `chrono-tz`.
> 3. Take `2026-01-31` and add one month, then two. Explain both answers.
> 4. Find a local time that doesn't exist in your time zone (the spring-forward hour) and confirm `with_ymd_and_hms` returns `None` for it.
> 5. Write `fn is_expired(expiry: DateTime<Utc>, now: DateTime<Utc>) -> bool` and test it for expired, valid, and exactly-at-expiry. Now try writing that test if the function called `Utc::now()` internally.
> 6. Serialize a struct with a `DateTime<Utc>` field to JSON and check the format. Would another language parse it unambiguously?

Next: the iterator adapters the standard library leaves out — **itertools**.
