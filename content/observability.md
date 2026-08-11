<h1><span class="h1-kicker">Performance & Production</span>Observability in Production</h1>

Your service is deployed, tests pass, and something is wrong. Latency doubled at 4am, one endpoint returns errors for 2% of users, memory climbs slowly all week. None of that shows up in a test suite — you can only diagnose it if the running system tells you what it's doing.

**Observability** is the property of being able to answer questions about a system you didn't anticipate asking. In Rust that means three things — logs, metrics, and traces — and one crate ecosystem that ties them together.

## The three signals

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="Logs record discrete events, metrics record aggregate numbers over time, and traces record the path of one request across services" >
  <style>
    .ob-h { font: 700 13px var(--font-sans); }
    .ob-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .ob-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ob-log { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .ob-met { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .ob-tr { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .ob-span { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 1.2; }
  </style>
  <rect x="20" y="28" width="190" height="90" rx="5" class="ob-log"/>
  <text x="32" y="48" class="ob-h" fill="var(--blue)">LOGS</text>
  <text x="32" y="66" class="ob-c">discrete events, with detail</text>
  <text x="32" y="86" class="ob-m">"order 7 failed: timeout"</text>
  <text x="32" y="104" class="ob-c">answers: what happened?</text>
  <rect x="225" y="28" width="190" height="90" rx="5" class="ob-met"/>
  <text x="237" y="48" class="ob-h" fill="var(--green)">METRICS</text>
  <text x="237" y="66" class="ob-c">aggregate numbers, cheap</text>
  <text x="237" y="86" class="ob-m">p99 = 240ms, rate = 1.2k/s</text>
  <text x="237" y="104" class="ob-c">answers: is it healthy?</text>
  <rect x="430" y="28" width="190" height="90" rx="5" class="ob-tr"/>
  <text x="442" y="48" class="ob-h" fill="var(--rust-600)">TRACES</text>
  <text x="442" y="66" class="ob-c">one request, end to end</text>
  <text x="442" y="86" class="ob-m">api → auth → db → cache</text>
  <text x="442" y="104" class="ob-c">answers: where is the time?</text>
  <text x="20" y="150" class="ob-h" fill="var(--text-mute)">A trace is a tree of spans:</text>
  <rect x="20" y="160" width="560" height="18" rx="3" class="ob-span"/><text x="28" y="173" class="ob-m">HTTP POST /orders — 240ms</text>
  <rect x="60" y="182" width="120" height="18" rx="3" class="ob-span"/><text x="68" y="195" class="ob-m">authenticate 30ms</text>
  <rect x="190" y="182" width="330" height="18" rx="3" class="ob-span"/><text x="198" y="195" class="ob-m">db insert 180ms ← the answer</text>
  <rect x="210" y="204" width="150" height="18" rx="3" class="ob-span"/><text x="218" y="217" class="ob-m">acquire pool conn 160ms</text>
  <text x="20" y="240" class="ob-c">The nesting is what makes it useful: the slow span is <tspan font-family="var(--font-mono)">acquire pool conn</tspan>, not the query. Your pool is too small.</text>
</svg>
<figcaption>Metrics tell you <b>something is wrong</b>; traces tell you <b>where</b>; logs tell you <b>what</b>. You need all three, and they're most useful when correlated.</figcaption>
</figure>

| Signal | Cardinality | Cost | Use to |
|---|---|---|---|
| **logs** | high (any detail) | high volume | investigate one specific failure |
| **metrics** | low (bounded labels) | very cheap | alert, dashboard, capacity-plan |
| **traces** | high, usually sampled | moderate | find where latency goes |

> [!key] Metrics for alerting, traces for locating, logs for explaining
> An alert should fire on a **metric** (error rate above 1%), because metrics are cheap enough to evaluate continuously. You then find the slow or failing component in a **trace**. Finally you read the **logs** for that request to learn why. Trying to alert on logs is expensive and slow; trying to debug one request from metrics is impossible. Each signal has a job.

## `tracing`: the crate to build on

Rust's `log` crate does levelled logging. `tracing` does that *and* spans — the nested timing context that makes async code comprehensible. For anything new, start with `tracing`.

```toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
```

```rust,ignore
use tracing::{debug, error, info, instrument, warn};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Debug)]
struct Order {
    id: u64,
    total_cents: u64,
}

// #[instrument] creates a span for the whole function call, automatically
// recording the arguments as structured fields.
#[instrument(skip(order), fields(order_id = order.id))]
fn process(order: &Order) -> Result<(), String> {
    info!("processing order");

    if order.total_cents == 0 {
        // Structured fields, not string interpolation — see below.
        warn!(total = order.total_cents, "order has zero total");
    }

    // Any log emitted inside this function is automatically tagged with
    // the span's fields, including order_id. No manual threading.
    charge(order.total_cents)?;
    info!("order complete");
    Ok(())
}

#[instrument]
fn charge(cents: u64) -> Result<(), String> {
    debug!("calling payment provider");
    if cents > 100_000 {
        error!(limit = 100_000, "amount exceeds limit");
        return Err("amount too large".into());
    }
    Ok(())
}

fn main() {
    // RUST_LOG=info,myapp::payments=debug controls this at runtime.
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(fmt::layer())
        .init();

    let _ = process(&Order { id: 7, total_cents: 4_500 });
    let _ = process(&Order { id: 8, total_cents: 250_000 });
}
```

Output carries the span context automatically:

```text
2026-08-10T09:14:22Z  INFO process{order_id=7}: processing order
2026-08-10T09:14:22Z DEBUG process{order_id=7}:charge{cents=4500}: calling payment provider
2026-08-10T09:14:22Z  INFO process{order_id=7}: order complete
2026-08-10T09:14:22Z ERROR process{order_id=8}:charge{cents=250000}: amount exceeds limit limit=100000
```

> [!best] Structured fields, never string interpolation
> Write `info!(user_id = id, duration_ms = ms, "request finished")`, not `info!("request {id} finished in {ms}ms")`. The first produces machine-queryable fields — you can filter on `user_id`, aggregate `duration_ms`, and alert on it. The second produces a string that someone has to write a fragile regex against at 3am. This one habit is the difference between logs you can query and logs you can only read.

> [!tip] `#[instrument]` is the highest-value annotation in the crate
> One attribute gives you a timed span, automatic argument capture, and automatic context propagation to every log inside. Use `skip(big_arg)` to avoid dumping large values, `skip_all` plus `fields(...)` to be explicit, and `err` to log the error automatically when the function returns `Err`. In async code it also correctly tracks time *across* `.await` points, which is precisely where plain logging falls apart.

## Log levels that mean something

| Level | Use for | Who reads it |
|---|---|---|
| `error!` | the operation failed and someone must act | on-call, alerts |
| `warn!` | recovered, but it's suspicious | on-call, reviewed daily |
| `info!` | significant lifecycle events | operators; on in production |
| `debug!` | detail for diagnosing a specific problem | developers; off by default |
| `trace!` | very verbose, per-iteration detail | developers, locally |

```bash
RUST_LOG=info                                   # everything at info and above
RUST_LOG=warn,myapp=debug                       # quiet deps, verbose own crate
RUST_LOG=myapp::payments=trace,myapp=info       # one module verbose
RUST_LOG=info,sqlx=warn,hyper=warn              # silence noisy libraries
```

> [!mistake] Logging an error *and* returning it
> `error!("failed: {e}"); return Err(e);` at three levels of the call stack produces the same failure three times in your logs, and each entry looks like a separate incident. Log where you **stop propagating** — usually a request handler or `main` — and add context elsewhere. `#[instrument(err)]` handles this cleanly: it records the error at the span where it occurred without you writing a log line. See [Error Handling Strategy](#/ch/error-strategy).

> [!warning] Never log secrets, tokens, or personal data
> `#[instrument]` captures arguments automatically with their `Debug` output, so a function taking a `Password`, an API key, or a full `User` will happily write it to your log aggregator — where it's now retained, replicated, and searchable by everyone with dashboard access. Use `skip(password)`, and implement `Debug` manually on sensitive newtypes to print `Password(***)`. This is a genuinely common and genuinely serious incident class.

## JSON output for aggregators

Humans want colours; log aggregators want JSON. Pick per environment:

```rust,ignore
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

fn init_telemetry() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());

    let registry = tracing_subscriber::registry().with(filter);

    // Structured JSON in production, pretty output locally.
    if std::env::var("JSON_LOGS").is_ok() {
        registry
            .with(
                fmt::layer()
                    .json()
                    .with_current_span(true)
                    .with_span_list(false)
                    .flatten_event(true),
            )
            .init();
    } else {
        registry.with(fmt::layer().pretty()).init();
    }
}
```

```json
{"timestamp":"2026-08-10T09:14:22.481Z","level":"ERROR","target":"myapp::payments",
 "message":"amount exceeds limit","limit":100000,
 "span":{"name":"charge","cents":250000},"order_id":8}
```

> [!best] Log to stdout, always — never to a file
> In a container, stdout is collected by the platform (Docker, Kubernetes, systemd) and forwarded to wherever logs live. Writing to a file inside a container means the logs vanish when the pod restarts, fill the ephemeral disk, and need a sidecar to ship. This is the twelve-factor rule and it's genuinely correct: your process emits a stream, and something else owns rotation, shipping, and retention.

## Metrics

Metrics are cheap counters and histograms, scraped by Prometheus or pushed to a vendor.

```toml
[dependencies]
metrics = "0.23"
metrics-exporter-prometheus = "0.15"
```

```rust,ignore
use metrics::{counter, gauge, histogram};
use metrics_exporter_prometheus::PrometheusBuilder;
use std::time::Instant;

fn init_metrics() {
    // Exposes GET /metrics on :9000 for Prometheus to scrape.
    PrometheusBuilder::new()
        .with_http_listener(([0, 0, 0, 0], 9000))
        .install()
        .expect("failed to install Prometheus exporter");
}

fn handle_request(path: &str) -> Result<(), String> {
    let start = Instant::now();

    let result = do_work(path);

    // Counter: monotonically increasing. Label with LOW-cardinality values only.
    let outcome = if result.is_ok() { "ok" } else { "error" };
    counter!("http_requests_total", "path" => path.to_string(), "outcome" => outcome)
        .increment(1);

    // Histogram: distributions, so you get p50/p95/p99 rather than a useless mean.
    histogram!("http_request_duration_seconds", "path" => path.to_string())
        .record(start.elapsed().as_secs_f64());

    result
}

fn report_pool(active: usize, max: usize) {
    // Gauge: a value that goes up and down.
    gauge!("db_pool_connections_active").set(active as f64);
    gauge!("db_pool_connections_max").set(max as f64);
}

fn do_work(_path: &str) -> Result<(), String> {
    Ok(())
}
```

| Metric type | Represents | Example |
|---|---|---|
| **counter** | a total that only increases | requests, errors, bytes sent |
| **gauge** | a value that moves up and down | queue depth, open connections, memory |
| **histogram** | a distribution | latency, payload size, batch size |

> [!warning] High-cardinality labels will take down your metrics backend
> A label whose values are unbounded — a user ID, a request ID, a full URL with query parameters, an error *message* — creates a separate time series for every distinct value. Ten thousand users becomes ten thousand series per metric, and Prometheus falls over. Labels must be **bounded and small**: HTTP method, status class, endpoint *template* (`/users/:id`, not `/users/8134`), region. Put the unbounded detail in logs and traces, which are built for it. This is the single most common observability outage.

> [!performance] Histograms, not averages
> A mean latency of 90ms is compatible with "everything takes 90ms" and with "95% take 20ms and 5% take 1.4 seconds" — and only the second one has angry users. Always record a histogram and alert on **p95/p99**, because the tail is what people actually experience. This is also why `histogram!` is the right default for anything time- or size-shaped, even when a gauge would compile.

## The four signals worth alerting on

Rather than alerting on everything, start with the "golden signals":

| Signal | Metric | Alert when |
|---|---|---|
| **latency** | request duration histogram | p99 above your SLO for 5 minutes |
| **traffic** | request rate counter | a sudden drop (often means an outage upstream) |
| **errors** | error-rate ratio | above ~1% sustained |
| **saturation** | pool usage, queue depth, memory | above ~80% of capacity |

```rust
use std::time::{Duration, Instant};

/// A tiny latency recorder — enough to show what a histogram gives you
/// that an average cannot.
struct Latencies {
    samples: Vec<Duration>,
}

impl Latencies {
    fn new() -> Self {
        Latencies { samples: Vec::new() }
    }

    fn record(&mut self, d: Duration) {
        self.samples.push(d);
    }

    fn percentile(&mut self, p: f64) -> Duration {
        self.samples.sort_unstable();
        // Index of the p-th percentile, clamped into range.
        let idx = ((self.samples.len() as f64 - 1.0) * p / 100.0).round() as usize;
        self.samples[idx.min(self.samples.len() - 1)]
    }

    fn mean(&self) -> Duration {
        let total: Duration = self.samples.iter().sum();
        total / self.samples.len() as u32
    }
}

fn main() {
    let mut l = Latencies::new();
    // 95 fast requests…
    for _ in 0..95 {
        l.record(Duration::from_millis(20));
    }
    // …and 5 slow ones. This is a completely normal shape.
    for _ in 0..5 {
        l.record(Duration::from_millis(1_400));
    }

    println!("mean = {:?}   ← looks fine", l.mean());
    println!("p50  = {:?}", l.percentile(50.0));
    println!("p95  = {:?}", l.percentile(95.0));
    println!("p99  = {:?}   ← what 1 in 100 users actually experiences", l.percentile(99.0));
}
```

## Distributed tracing with OpenTelemetry

For a request crossing several services, you need a trace ID that travels with it.

```toml
[dependencies]
opentelemetry = "0.27"
opentelemetry_sdk = { version = "0.27", features = ["rt-tokio"] }
opentelemetry-otlp = "0.27"
tracing-opentelemetry = "0.28"
```

```rust,ignore
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

fn init_tracing() -> Result<(), Box<dyn std::error::Error>> {
    // Export spans to any OTLP collector: Jaeger, Tempo, Honeycomb, Datadog…
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(opentelemetry_otlp::new_exporter().tonic())
        .install_batch(opentelemetry_sdk::runtime::Tokio)?;

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        // Human-readable logs AND exported spans, from the same instrumentation.
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .init();
    Ok(())
}
```

> [!key] Instrument once with `tracing`, export anywhere
> The reason to standardize on `tracing` is that your `#[instrument]` annotations and `info!` calls are **backend-agnostic**. Adding a layer sends the same spans to Jaeger, or Honeycomb, or a JSON file, or all three — without touching a single instrumented function. Switching vendors becomes a change in `main`, not a rewrite. That's worth choosing deliberately at the start of a project.

> [!note] Sample traces; don't sample errors
> Tracing every request in a high-traffic service is expensive to store and mostly redundant. Head-based sampling at 1–10% is normal. But configure your sampler to **always keep traces that contain an error or exceed a latency threshold** — those are the ones you'll actually want, and losing them to a coin flip is maddening. Most collectors support this as "tail-based sampling".

## Health checks

Orchestrators need to know two different things, and conflating them causes outages.

```rust,ignore
use axum::{http::StatusCode, routing::get, Json, Router};
use serde_json::json;

/// Liveness: is the process functioning at all? Must be cheap and must NOT
/// check dependencies — if the database is down, restarting your pod won't help.
async fn healthz() -> StatusCode {
    StatusCode::OK
}

/// Readiness: should this instance receive traffic right now? This one DOES
/// check dependencies, so a pod with a dead pool is removed from the load
/// balancer without being killed.
async fn readyz(/* State(pool): State<PgPool> */) -> (StatusCode, Json<serde_json::Value>) {
    let db_ok = true; // sqlx::query("SELECT 1").execute(&pool).await.is_ok()

    if db_ok {
        (StatusCode::OK, Json(json!({ "status": "ready", "db": "ok" })))
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "status": "degraded", "db": "down" })))
    }
}

pub fn routes() -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        // Useful in every service: which build is this?
        .route("/version", get(|| async { env!("CARGO_PKG_VERSION") }))
}
```

> [!mistake] A liveness probe that checks the database causes cascading restarts
> If liveness returns unhealthy when your database is unreachable, Kubernetes kills *every* pod simultaneously — and they all fail to start, because the database is still down. You've converted a recoverable dependency outage into a total outage, and lost the pods that could have served cached responses. **Liveness = is this process wedged.** **Readiness = can I serve traffic.** Keep them separate, and make liveness almost trivially cheap.

## What to instrument on day one

| Instrument | Because |
|---|---|
| a startup log with version + git hash | "which build is this?" is asked in every incident |
| every request: method, path template, status, duration | the golden signals fall out of it |
| every outbound call: target, status, duration | most latency is something else's fault |
| connection pool: active, idle, wait time | the most common hidden bottleneck |
| queue depth, if you have a queue | the earliest saturation signal there is |
| background job outcomes | silent failures otherwise stay silent |
| panics, via a hook | see [Debugging Rust](#/ch/debugging) |
| a `/version` and `/healthz` endpoint | cheap and endlessly useful |

> [!best] Add the correlation ID at the edge and propagate it everywhere
> Generate a request ID (or accept an inbound `traceparent`) in your outermost middleware, put it in a span field, and pass it on every outbound call. Then one grep gives you every log line, in every service, for one user's failed request. Without it you're joining logs by timestamp and hoping. `tower-http`'s `TraceLayer` plus `tracing` gives you this in a handful of lines — see [axum](#/ch/axum).

## Summary

- **Metrics** to alert, **traces** to locate, **logs** to explain. All three, correlated by a request ID.
- Build on **`tracing`**: `#[instrument]` gives you spans, automatic argument capture, and context propagation that works across `.await`.
- Use **structured fields** (`info!(user_id = id, "…")`), never string interpolation — it's the difference between queryable and greppable.
- Log to **stdout**, in **JSON** in production and pretty locally, filtered at runtime with `RUST_LOG`.
- **Log once**, where you stop propagating; `#[instrument(err)]` does it for you.
- **Never log secrets** — `#[instrument]` captures arguments, so `skip` them and redact `Debug` on sensitive types.
- Metrics labels must be **bounded**; high cardinality (user IDs, raw URLs) takes down your metrics backend.
- Record **histograms and alert on p99**, not averages — the tail is what users feel.
- Keep **liveness** (is the process wedged) separate from **readiness** (can I serve traffic), or a database outage becomes a total outage.

> [!exercise] Try it yourself
> 1. Add `tracing` and `tracing-subscriber` to a small program, annotate two nested functions with `#[instrument]`, and observe how the child's logs inherit the parent's fields.
> 2. Run the same program with `RUST_LOG=info` and `RUST_LOG=debug`, then with `RUST_LOG=warn,myapp=trace`. Predict the output before each run.
> 3. Convert a `info!("user {id} did {action}")` call to structured fields, and switch the subscriber to `.json()`. Which version could you build a dashboard on?
> 4. Run the percentile example above. Explain to a colleague why the mean is misleading, using those exact numbers.
> 5. Write a function taking a `password: String`, annotate it with `#[instrument]`, and check whether the password appears in the log. Then fix it two different ways.
> 6. Design health endpoints for a service with a database and a cache. Which dependencies go in liveness, which in readiness, and why?

That completes the performance and production part — you can now measure, shrink, ship, and watch a Rust service. Next we put the whole book together on **real projects**, starting with a command-line tool built from scratch.
