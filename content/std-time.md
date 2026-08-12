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

### Arithmetic that can't go negative

A `Duration` is **unsigned**, so subtracting a bigger one from a smaller one has nowhere to go: plain `-` panics. Every operator has a `checked_` form returning `Option` and a `saturating_` form clamping to `Duration::ZERO` — the same vocabulary you know from integers:

```rust
use std::time::Duration;

fn main() {
    // Debug formatting picks a readable unit automatically.
    for d in [Duration::from_secs(90), Duration::from_millis(1500), Duration::from_micros(1500),
              Duration::from_nanos(1500), Duration::ZERO] {
        println!("{d:?}");
    }

    // Arithmetic: + and * are exact; the checked_/saturating_ family avoids panics.
    let a = Duration::from_millis(1500);
    let b = Duration::from_secs(2);
    println!("a + b        {:?}", a + b);
    println!("b * 3        {:?}", b * 3);
    println!("b / 4        {:?}", b / 4);
    println!("mul_f64 1.5  {:?}", b.mul_f64(1.5));
    println!("checked_sub  {:?}", a.checked_sub(b));      // None: would go negative
    println!("saturating   {:?}", a.saturating_sub(b));   // ZERO instead
    println!("a < b        {}", a < b);                   // Durations are Ord

    // Reading a Duration back out
    let d = Duration::from_millis(2500);
    println!("as_secs {} subsec_millis {} as_millis {} as_secs_f64 {}",
             d.as_secs(), d.subsec_millis(), d.as_millis(), d.as_secs_f64());

    // from_secs_f64 rejects NaN/negative -- with try_ for the non-panicking form
    println!("try_from_secs_f64(-1.0) -> {:?}", Duration::try_from_secs_f64(-1.0).is_err());

    // Summing durations, and computing a rate
    let samples = [Duration::from_millis(12), Duration::from_millis(8), Duration::from_millis(10)];
    let total: Duration = samples.iter().sum();
    println!("total {:?} mean {:?}", total, total / samples.len() as u32);
    println!("rate  {:.1} ops/sec", 1.0 / (total.as_secs_f64() / samples.len() as f64));
}
```

```text
90s
1.5s
1.5ms
1.5µs
0ns
a + b        3.5s
b * 3        6s
b / 4        500ms
mul_f64 1.5  3s
checked_sub  None
saturating   0ns
a < b        true
as_secs 2 subsec_millis 500 as_millis 2500 as_secs_f64 2.5
try_from_secs_f64(-1.0) -> true
total 30ms mean 10ms
rate  100.0 ops/sec
```

| Need | Call |
|---|---|
| add / multiply / divide | `+`, `*` by `u32`, `/` by `u32`, `mul_f64`, `div_f64` |
| subtract without panicking | `checked_sub` → `Option`, `saturating_sub` → clamps to `ZERO` |
| whole and fractional parts | `as_secs()` + `subsec_millis()`/`subsec_nanos()` |
| one float | `as_secs_f64()`, `as_secs_f32()` |
| constants | `Duration::ZERO`, `Duration::MAX`, `is_zero()` |
| build from a float safely | `try_from_secs_f64(x)` (`from_secs_f64` panics on negative/NaN) |
| average a batch | `samples.iter().sum::<Duration>() / n` |

> [!mistake] `a - b` on `Duration`s panics when `b > a`
> Timeout code writes this constantly: `let left = timeout - elapsed;` panics the moment you're already past the deadline — which is exactly the case the code exists to handle. Write `timeout.saturating_sub(elapsed)` instead, and the overrun case gives you `ZERO`, which then means "don't wait." The same applies to `subsec_*` confusion: `d.as_secs()` **truncates**, so a 2.5-second duration reports `2` seconds and `500` subsec milliseconds — use `as_millis()` or `as_secs_f64()` when you want the whole value.

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

Run that in debug mode and it reports a few milliseconds; run it with optimizations and it reports tens of *nanoseconds*, because the compiler evaluates that sum at compile time and the loop never exists. That gap is not a curiosity — it's the main hazard of timing code yourself, and the *Measuring code correctly* section below deals with it.

### Deadlines, and the two subtractions

`Instant + Duration` gives another `Instant`, which is all a deadline is. Getting the *remaining* time needs care, because the deadline may already have passed:

```rust
use std::time::{Duration, Instant};

fn main() {
    let t0 = Instant::now();
    let t1 = t0 + Duration::from_millis(50);          // Instant + Duration is an Instant

    // Later minus earlier is a Duration. Earlier minus later does not panic:
    println!("t1.duration_since(t0)            {:?}", t1.duration_since(t0));
    println!("t0.duration_since(t1)            {:?}", t0.duration_since(t1));
    println!("t0.checked_duration_since(t1)    {:?}", t0.checked_duration_since(t1));
    println!("t0.saturating_duration_since(t1) {:?}", t0.saturating_duration_since(t1));

    // A deadline is just an Instant in the future -- and the remaining time
    // is always saturating_duration_since, never a subtraction.
    let deadline = Instant::now() + Duration::from_millis(20);
    let mut polls = 0;
    while Instant::now() < deadline {
        polls += 1;
        let remaining = deadline.saturating_duration_since(Instant::now());
        std::thread::sleep(remaining.min(Duration::from_millis(5)));
    }
    println!("woke {polls} times before the deadline, overshoot small: {:?}",
             Instant::now().saturating_duration_since(deadline) < Duration::from_millis(10));
}
```

```text
t1.duration_since(t0)            50ms
t0.duration_since(t1)            0ns
t0.checked_duration_since(t1)    None
t0.saturating_duration_since(t1) 0ns
woke 4 times before the deadline, overshoot small: true
```

> [!note] `Instant::duration_since` saturates; `Instant - Instant` panics
> `earlier.duration_since(later)` used to panic and now returns `ZERO`, because a handful of platforms were caught reporting a "monotonic" clock that briefly went backwards. The `-` operator, however, still panics on an out-of-order subtraction. Prefer `later.duration_since(earlier)` when order is guaranteed, `saturating_duration_since` when it isn't, and `checked_duration_since` when out-of-order is a bug you want to see. Note also that an `Instant` is only comparable with `Instant`s from the same process — it's an opaque platform counter, so there's no way to print or store one meaningfully.

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

Here is the concrete failure the two clocks have. A clock adjustment — NTP correcting a drift, a container starting with a wrong clock, a user fixing the date — moves wall-clock time *sideways*, while the monotonic counter keeps ticking regardless:

<figure class="diagram">
<svg viewBox="0 0 640 226" role="img" aria-label="Two timelines: the monotonic Instant clock advances evenly so a measured span is correct, while the wall clock jumps backwards during an NTP adjustment and yields a negative or wildly wrong span">
  <style>
    .cl-h { font: 700 11px var(--font-sans); }
    .cl-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .cl-c { font: 10px var(--font-sans); fill: var(--text-mute); }
  </style>
  <text x="20" y="18" class="cl-h" fill="var(--rust-500)">Instant — monotonic counter</text>
  <line x1="20" y1="52" x2="620" y2="52" stroke="var(--rust-400)" stroke-width="2.5"/>
  <circle cx="140" cy="52" r="4.5" fill="var(--rust-500)"/><text x="120" y="42" class="cl-m">start</text>
  <circle cx="500" cy="52" r="4.5" fill="var(--rust-500)"/><text x="484" y="42" class="cl-m">end</text>
  <path d="M140 66 L500 66" stroke="var(--rust-500)" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="252" y="80" class="cl-c" fill="var(--rust-500)">elapsed = 300ms — correct, always</text>
  <text x="20" y="116" class="cl-h" fill="var(--blue)">SystemTime — wall clock</text>
  <line x1="20" y1="150" x2="330" y2="150" stroke="var(--blue)" stroke-width="2.5"/>
  <line x1="330" y1="150" x2="620" y2="150" stroke="var(--blue)" stroke-width="2.5"/>
  <circle cx="140" cy="150" r="4.5" fill="var(--blue)"/><text x="112" y="140" class="cl-m">12:00:00.0</text>
  <path d="M330 138 L330 162" stroke="var(--red)" stroke-width="2"/>
  <path d="M330 128 L268 128" stroke="var(--red)" stroke-width="1.8" marker-end="url(#cl-back)"/>
  <text x="336" y="126" class="cl-c" fill="var(--red)">NTP steps the clock back 1s</text>
  <circle cx="500" cy="150" r="4.5" fill="var(--blue)"/><text x="474" y="140" class="cl-m">11:59:59.3</text>
  <text x="200" y="176" class="cl-c" fill="var(--red)">end &lt; start → duration_since returns Err, or a "negative" span you cannot represent</text>
  <text x="20" y="202" class="cl-c">Same code, same work, same real elapsed time — only the clock disagrees.</text>
  <text x="20" y="218" class="cl-c">This is why <tspan font-family="var(--font-mono)">SystemTime::duration_since</tspan> returns a <tspan font-family="var(--font-mono)">Result</tspan> and <tspan font-family="var(--font-mono)">Instant::elapsed</tspan> does not.</text>
  <defs><marker id="cl-back" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--red)"/></marker></defs>
</svg>
<figcaption>A clock adjustment breaks wall-clock measurement and leaves the monotonic clock untouched — the whole reason two types exist.</figcaption>
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

`SystemTime` supports the same arithmetic, and the error even hands the gap back to you:

```rust
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn main() {
    let now = SystemTime::now();

    // The usual "timestamp": seconds since 1970.
    let secs = now.duration_since(UNIX_EPOCH).expect("clock before 1970").as_secs();
    println!("unix seconds        {secs}");

    // Arithmetic works in both directions, and comparisons return Result.
    let earlier = UNIX_EPOCH + Duration::from_secs(1_700_000_000);
    println!("earlier is earlier  {:?}", earlier.duration_since(now).is_err());
    println!("recovered gap (yrs) {:.1}",
             earlier.duration_since(now).unwrap_err().duration().as_secs_f64() / 31_557_600.0);
    println!("in one hour         {}",
             (now + Duration::from_secs(3600)).duration_since(UNIX_EPOCH).unwrap().as_secs());

    // std has no calendar, but time-of-day is plain arithmetic on the timestamp.
    let t = 1_700_000_000u64;
    println!("UTC {:02}:{:02}:{:02} on day {} of the epoch",
             (t / 3600) % 24, (t / 60) % 60, t % 60, t / 86_400);
}
```

```text
unix seconds        1786516783
earlier is earlier  true
recovered gap (yrs) 2.7
in one hour         1786520383
UTC 22:13:20 on day 19675 of the epoch
```

(Your timestamp and gap will differ, naturally.) Two details worth keeping: `SystemTimeError::duration()` gives you *how far* backwards the comparison went, so an "impossible" ordering is still diagnosable; and `UNIX_EPOCH + Duration` is how you turn a stored timestamp back into a `SystemTime` — which is exactly what you need to compare against a file's `modified()` time.

| Task | Call |
|---|---|
| now, as a timestamp | `SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs()` |
| a stored timestamp → `SystemTime` | `UNIX_EPOCH + Duration::from_secs(n)` |
| age of a file | `fs::metadata(p)?.modified()?.elapsed()?` |
| how stale is this? | `SystemTime::now().duration_since(t)` — `Err` means `t` is in the future |
| how far off was it? | `err.duration()` on the `SystemTimeError` |
| millisecond timestamps | `.as_millis()` — but note it returns `u128` |

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

`sleep` promises *at least* the duration you asked for — never exactly it, because the OS has to reschedule your thread. And a timeout is usually better expressed as a deadline you carry around than as a fixed number of retries:

```rust
use std::time::{Duration, Instant};
use std::sync::mpsc;
use std::thread;

fn main() {
    // sleep guarantees AT LEAST the duration -- never exactly it.
    for req in [Duration::from_millis(1), Duration::from_millis(10)] {
        let t = Instant::now();
        thread::sleep(req);
        let actual = t.elapsed();
        println!("asked {req:?}, slept {actual:?} (overshoot {:?})", actual - req);
    }

    // recv_timeout: wait for a message, but not forever.
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || { thread::sleep(Duration::from_millis(30)); tx.send("late").unwrap(); });
    println!("first try:  {:?}", rx.recv_timeout(Duration::from_millis(5)).map_err(|e| e.to_string()));
    println!("second try: {:?}", rx.recv_timeout(Duration::from_millis(100)));

    // A retry loop with a real deadline, not a fixed number of tries.
    let deadline = Instant::now() + Duration::from_millis(50);
    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts == 4 { println!("succeeded on attempt {attempts}"); break; }
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() { println!("gave up after {attempts} attempts"); break; }
        thread::sleep(left.min(Duration::from_millis(10)));
    }
}
```

```text
asked 1ms, slept 1.082141ms (overshoot 82.141µs)
asked 10ms, slept 10.076514ms (overshoot 76.514µs)
first try:  Err("timed out waiting on channel")
second try: Ok("late")
succeeded on attempt 4
```

> [!best] Pass deadlines, not durations
> A function that takes `timeout: Duration` and internally does three things, each with the full timeout, can take three times as long as advertised. Take a `deadline: Instant` instead and every step computes its own budget with `deadline.saturating_duration_since(Instant::now())`. It composes: the same deadline can be threaded through a connect, a handshake, and a read, and the total is what the caller asked for. This is why `recv_timeout` exists alongside `recv_deadline`, and why the overshoot above (~80 µs per `sleep`) matters once you're chaining calls.

## Measuring code correctly

Wrapping something in `Instant::now()` is easy; getting a number that *means* something takes three habits. Watch what happens without them:

```rust
use std::time::{Duration, Instant};
use std::hint::black_box;

/// A hash-like fold: every step depends on the last, so it cannot be
/// turned into a closed-form expression -- but it CAN be deleted entirely.
fn digest(data: &[u64]) -> u64 {
    data.iter().fold(0u64, |h, &x| h.wrapping_mul(31).wrapping_add(x))
}

fn main() {
    let data: Vec<u64> = (0..100_000).collect();

    // 1. The naive measurement: the result is unused, so the work can vanish.
    let t = Instant::now();
    let _ = digest(&data);
    println!("result discarded:  {:?}", t.elapsed());

    // 2. black_box hides the value from the optimizer, so the work must happen.
    let t = Instant::now();
    black_box(digest(black_box(&data)));
    println!("with black_box:    {:?}", t.elapsed());

    // 3. One run tells you nothing. Warm up, repeat, report the median.
    let mut samples: Vec<Duration> = Vec::new();
    for _ in 0..5 { black_box(digest(black_box(&data))); }          // warm-up
    for _ in 0..21 {
        let t = Instant::now();
        black_box(digest(black_box(&data)));
        samples.push(t.elapsed());
    }
    samples.sort();
    println!("median of 21:      {:?}  (min {:?}, max {:?})",
             samples[samples.len() / 2], samples[0], samples[samples.len() - 1]);

    // 4. Per-operation cost: time a batch, then divide.
    let small: Vec<u64> = (0..100).collect();
    let reps = 10_000;
    let t = Instant::now();
    for _ in 0..reps { black_box(digest(black_box(&small))); }
    println!("per 100-element call: {:?}", t.elapsed() / reps);
}
```

```text
result discarded:  93ns
with black_box:    163.188µs
median of 21:      112.298µs  (min 106.428µs, max 130.354µs)
per 100-element call: 97ns
```

The first two lines differ by a factor of about **1,750**. Nothing got faster: with the result thrown away, the optimizer deleted the loop entirely and timed an empty region. That is the single most common way a Rust micro-benchmark lies, and it always lies in the flattering direction.

The third line adds the other two habits. The very first measured run (163 µs) is 45% slower than the median (112 µs) because caches and branch predictors were cold — hence the warm-up. And min-to-max spans 106–130 µs on an idle machine, so a *single* sample could have been off by 20% either way; the median of many is the honest summary.

| Habit | Why |
|---|---|
| `black_box` the inputs **and** the result | stops the optimizer deleting or pre-computing the work |
| warm up before measuring | the first run pays for cold caches, page faults, and CPU frequency ramp-up |
| repeat and take the median | one sample is noise; the median resists scheduler hiccups better than the mean |
| time a batch, divide by `n` | `Instant::now()` itself costs ~20–30 ns, which swamps anything faster |
| measure in **release** mode | debug builds have different bottlenecks entirely; the numbers don't transfer |

> [!performance] For real benchmarking, use `criterion` or `divan`
> Hand-rolled timing is fine for "is this 10× or 1,000× slower?" For anything closer, the `criterion` crate handles warm-up, sample counts, outlier detection, statistical confidence, and comparison against a saved baseline — it will tell you "3.2% faster (p = 0.04)" instead of leaving you to eyeball two noisy numbers. `divan` is a lighter, newer alternative. Both do what this section does, properly, and neither needs nightly.

> [!warning] For dates, calendars, and time zones, use `chrono` or `time`
> `std::time` deliberately has **no** notion of dates, calendars, time zones, or formatting like "2024-06-01 14:30". For any of that — parsing/formatting timestamps, arithmetic on calendar dates, time-zone conversions — use the **`chrono`** or **`time`** crates. `std::time` covers durations and raw timestamps; the crates handle the messy human-calendar layer.

| You need | `std::time` | crate |
|---|---|---|
| "how long did this take" | `Instant` + `elapsed` | — |
| a Unix timestamp | `duration_since(UNIX_EPOCH)` | — |
| a sleep or a timeout | `thread::sleep`, `recv_timeout` | — |
| year/month/day, weekday, leap years | ✗ | `chrono::NaiveDate`, `time::Date` |
| parse or format `"2026-06-01T14:30:00Z"` | ✗ | `chrono` / `time` (RFC 3339) |
| time zones and DST | ✗ | `chrono-tz`, `time-tz` |
| "add one month" (a calendar concept, not a fixed duration) | ✗ | `chrono` |

> [!deep] Why "one month" can't be a `Duration`
> A `Duration` is a fixed count of nanoseconds, but calendar arithmetic isn't fixed: months are 28–31 days, days are 23–25 hours where DST applies, and some minutes have 61 seconds (leap seconds). "One month after January 31st" has no single right answer. `std` refuses to guess, which is why the calendar layer lives in crates that can make those policies explicit. The flip side: because `SystemTime` is a plain offset from the epoch and epoch seconds ignore leap seconds, timestamp arithmetic stays simple and portable — you just can't call it a date.

## Summary

- **`Duration`** is an **unsigned** span (nanosecond precision): `from_secs`/`from_millis`/`from_secs_f64` in, `as_secs`/`as_millis`/`as_secs_f64` out, `Duration::ZERO`/`MAX` as constants.
- Plain `-` on `Duration`s **panics** when the result would be negative — use `saturating_sub` in timeout code and `checked_sub` when underflow is a bug.
- **`Instant`** is a **monotonic** stopwatch — `Instant::now()` + `.elapsed()` for spans, timeouts, and benchmarks. `duration_since` saturates to `ZERO` out of order, but the `-` operator still panics.
- A **deadline** is an `Instant`; get the remaining budget with `deadline.saturating_duration_since(Instant::now())`, and pass deadlines rather than durations so multi-step operations don't multiply the timeout.
- **`SystemTime`** is wall-clock time — timestamps via `duration_since(UNIX_EPOCH)`, restore with `UNIX_EPOCH + Duration`, and `SystemTimeError::duration()` tells you how far backwards a comparison went.
- `thread::sleep` guarantees *at least* the requested time (~80 µs of overshoot measured here), never exactly it.
- Measuring: **`black_box` the input and result, warm up, repeat and take the median, divide a batch, build in release.** Skipping the first of those made a real 112 µs job look like 93 ns.
- For dates, time zones, and formatting, reach for **`chrono`**/**`time`**; for serious benchmarks, **`criterion`**/**`divan`**.

> [!exercise] Try it yourself
> 1. Time how long it takes to build a `Vec` of one million integers using `Instant`.
> 2. Print the current Unix timestamp with `SystemTime::now().duration_since(UNIX_EPOCH)`.
> 3. Explain why using `Instant` (not `SystemTime`) matters for a benchmark, in terms of the monotonic clock.
> 4. Write `fn remaining(deadline: Instant) -> Duration` that never panics, and use it in a loop that retries a fallible closure until the deadline passes.
> 5. Reproduce the black-box lie: time a `Vec::sort` on 100,000 elements with the result discarded and then with `black_box`, in release mode.
> 6. Turn `[Duration]` samples into a report: min, median, p95, mean, and ops/sec.
> 7. Given a file path, print how old the file is in whole minutes using `metadata()?.modified()?.elapsed()?`, handling the "modified in the future" `Err`.
> 8. Format a Unix timestamp as `YYYY-MM-DD` with pure arithmetic (days since epoch, then the civil-date conversion) and check it against `chrono`.

Next: reading command-line arguments and environment variables, and running other programs — **`std::env` and `std::process`**.
