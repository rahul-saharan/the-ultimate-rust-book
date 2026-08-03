<h1><span class="h1-kicker">The Standard Library, Deep</span>Time & Duration</h1>

Working with time comes in two distinct flavors: measuring *how long* something takes (a stopwatch), and knowing *what time it is* (a calendar clock). Rust's `std::time` gives you both, with types that make the difference explicit and prevent common mistakes. This short reference covers `Instant`, `Duration`, and `SystemTime`.

## `Duration`: a span of time

A **`Duration`** represents a length of time — "5 seconds", "200 milliseconds" — with nanosecond precision. It's the currency all the timing APIs speak:

```rust
use std::time::Duration;

fn main() {
    let d = Duration::from_secs(2);
    let ms = Duration::from_millis(500);
    let combined = d + ms; // Durations add

    println!("{:?}", combined);            // 2.5s
    println!("{} ms", combined.as_millis()); // 2500
    println!("{} s (float)", combined.as_secs_f64()); // 2.5
}
```

| Constructor | Makes |
|-------------|-------|
| `Duration::from_secs(n)` | `n` seconds |
| `Duration::from_millis(n)` | `n` milliseconds |
| `Duration::from_micros(n)` / `from_nanos(n)` | finer |
| `Duration::from_secs_f64(x)` | fractional seconds |
| `.as_secs()` / `.as_millis()` / `.as_secs_f64()` | read it back |

## `Instant`: a stopwatch for measuring elapsed time

An **`Instant`** is an opaque point on a *monotonic* clock — perfect for measuring durations because it only ever moves forward, immune to the system clock being adjusted:

```rust
use std::time::Instant;

fn main() {
    let start = Instant::now();

    let sum: u64 = (0..1_000_000).sum(); // some work

    let elapsed = start.elapsed(); // a Duration
    println!("sum = {sum}");
    println!("took {elapsed:?}");
}
```

> [!key] `Instant` for *how long*, `SystemTime` for *what time*
> Use **`Instant`** to measure elapsed time — timeouts, benchmarks, "how long did this take." It's **monotonic**: it can't go backwards even if someone changes the computer's clock. Use **`SystemTime`** only when you need the actual wall-clock date/time (a file's timestamp, "now" as a calendar value) — it *can* jump when the clock is adjusted. Mixing them up (using `SystemTime` for a stopwatch) is a classic bug that produces negative or wild durations.

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="Instant is a monotonic stopwatch; SystemTime is a wall clock that can be adjusted">
  <style>
    .tim { font: 600 12px var(--font-mono); fill: var(--text); }
    .tic { font: 11px var(--font-sans); fill: var(--text-mute); }
    .mono { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .wall { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="20" y="24" width="290" height="80" rx="10" class="mono"/>
  <text x="36" y="48" class="tim" fill="var(--rust-600)">Instant — stopwatch ⏱</text>
  <text x="36" y="72" class="tic">Monotonic; only moves forward.</text>
  <text x="36" y="92" class="tic">Use for elapsed time, timeouts, benches.</text>
  <rect x="330" y="24" width="290" height="80" rx="10" class="wall"/>
  <text x="346" y="48" class="tim" fill="var(--blue)">SystemTime — wall clock 🕐</text>
  <text x="346" y="72" class="tic">Real calendar time; can jump (NTP, DST).</text>
  <text x="346" y="92" class="tic">Use for timestamps, "what time is it".</text>
</svg>
<figcaption>Reach for <code>Instant</code> to measure spans and <code>SystemTime</code> to read the calendar.</figcaption>
</figure>

## `SystemTime`: wall-clock time

**`SystemTime`** represents real calendar time. Its most common use is getting a Unix timestamp (seconds since 1970) by measuring the duration since the `UNIX_EPOCH`:

```rust
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let now = SystemTime::now();

    // Seconds since the Unix epoch — the usual "timestamp":
    match now.duration_since(UNIX_EPOCH) {
        Ok(dur) => println!("Unix timestamp: {} seconds", dur.as_secs()),
        Err(_) => println!("clock is set before 1970?!"),
    }
}
```

Notice `duration_since` returns a `Result` — because the clock *could* have been set backwards, making "the duration since then" negative (which a `Duration` can't represent). That `Result` is the type system reminding you wall-clock time isn't monotonic.

## Sleeping and timeouts

Pause a thread with `std::thread::sleep` (in async code, use `tokio::time::sleep` instead — see [tokio](#/ch/tokio)):

```rust
use std::time::{Duration, Instant};
use std::thread;

fn main() {
    let start = Instant::now();
    thread::sleep(Duration::from_millis(10)); // block this thread for ~10ms
    println!("slept for {:?}", start.elapsed());
}
```

> [!warning] For dates, calendars, and time zones, use `chrono` or `time`
> `std::time` deliberately has **no** notion of dates, calendars, time zones, or formatting like "2024-06-01 14:30". For any of that — parsing/formatting timestamps, arithmetic on calendar dates, time-zone conversions — use the **`chrono`** or **`time`** crates. `std::time` covers durations and raw timestamps; the crates handle the messy human-calendar layer.

## Summary

- **`Duration`** is a span of time (nanosecond precision); build it with `from_secs`/`from_millis`/… and read it with `as_secs`/`as_millis`/`as_secs_f64`.
- **`Instant`** is a **monotonic** stopwatch — use `Instant::now()` + `.elapsed()` for measuring durations, timeouts, and benchmarks (it never goes backwards).
- **`SystemTime`** is wall-clock/calendar time — use it for timestamps (`duration_since(UNIX_EPOCH)`); it can jump, which is why comparisons return a `Result`.
- Sleep with `thread::sleep(duration)` (or `tokio::time::sleep` in async).
- For **dates, time zones, and formatting**, reach for the **`chrono`** or **`time`** crates.

> [!exercise] Try it yourself
> 1. Time how long it takes to build a `Vec` of one million integers using `Instant`.
> 2. Print the current Unix timestamp with `SystemTime::now().duration_since(UNIX_EPOCH)`.
> 3. Explain why using `Instant` (not `SystemTime`) matters for a benchmark, in terms of the monotonic clock.

Next: reading command-line arguments and environment variables, and running other programs — **`std::env` and `std::process`**.
