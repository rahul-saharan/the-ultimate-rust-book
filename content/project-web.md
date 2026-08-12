<h1><span class="h1-kicker">Building Real Projects</span>Project: A Web Service</h1>

Let's build a real backend: a **JSON REST API** for a to-do list, using [axum](#/ch/axum), [serde](#/ch/serde), [tokio](#/ch/tokio), and shared state. It supports creating, listing, fetching, completing, and deleting tasks over HTTP — with a proper error type, request logging, graceful shutdown, and tests that need no running server. Every response shown in this chapter was captured from the service actually running.

## What we're building

| Method & path | Does | Success | Failure |
|---------------|------|---------|---------|
| `GET /tasks` | list tasks, with `?done=` and `?limit=` filters | `200` + JSON array | `400` on a bad query value |
| `POST /tasks` | create a task from a JSON body | `201` + the new task | `422` invalid title, `415` wrong content-type |
| `GET /tasks/{id}` | fetch one task | `200` + the task | `404` unknown id, `400` non-numeric id |
| `POST /tasks/{id}/done` | mark a task complete | `200` + the task | `404` unknown id |
| `DELETE /tasks/{id}` | delete a task | `204` no content | `404` unknown id |

## Setup

```bash
cargo new todo-api && cd todo-api
cargo add axum
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add thiserror
cargo add tower-http --features trace,cors,timeout,compression-gzip
cargo add tracing tracing-subscriber --features tracing-subscriber/env-filter
cargo add --dev tower http-body-util          # for testing handlers directly
```

> [!warning] Path parameters changed syntax in axum 0.8
> Routes now use **braces**: `/tasks/{id}`. The older `:id` form from axum 0.7 and earlier doesn't just fail to match — it **panics at startup** with a message telling you to migrate. If you're following an older tutorial and your server dies immediately on `Router::new()`, that's why. Wildcards changed too: `*rest` became `{*rest}`.

## The data model

Define the task type and derive serde so it serializes to/from JSON automatically. Note the deliberate asymmetry: what a client may *send* is a different type from what the server *stores*.

```rust,ignore
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
struct Task { id: u64, title: String, done: bool }

// The shape of the JSON body for creating a task (no id/done -- the server sets those):
#[derive(Deserialize)]
struct NewTask { title: String }

// Query parameters for the list endpoint; both optional.
#[derive(Deserialize)]
struct ListParams { done: Option<bool>, limit: Option<usize> }
```

> [!best] Never accept your storage type as input
> If `POST /tasks` took a `Task`, a client could set `id` and `done` themselves — assigning ids that collide, or marking a task complete at creation. Separate types make the trust boundary explicit and let the compiler enforce it: `NewTask` simply has nowhere to put an `id`. The same applies on the way out — a `TaskResponse` that omits internal fields (a password hash, an owner id) is better than hoping you remembered `#[serde(skip)]` on the storage struct.

## Shared state

Our tasks live in memory, shared across all requests. Handlers run concurrently on many tasks, so the data needs a lock ([shared state](#/ch/shared-state)) and axum hands it to each handler via `State`:

```rust,ignore
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Clone)]                       // axum requires State to be Clone -- Arc makes that cheap
struct AppState {
    tasks: Arc<RwLock<Vec<Task>>>,     // RwLock: listing is far more common than mutating
    next_id: Arc<AtomicU64>,           // an atomic counter needs no lock at all
}
```

Two deliberate choices there. **`RwLock` over `Mutex`**, because `GET /tasks` only reads and concurrent readers can overlap. And **one lock, not two** — an earlier version of this chapter used a second `Mutex` for the id counter, which is a trap: two independent locks can't be acquired atomically, so "take an id, then push the task" has a window in the middle. An `AtomicU64` sidesteps the question entirely, since `fetch_add` is indivisible.

## Errors as a type

Handlers that return `Result<T, AppError>` where `AppError: IntoResponse` are the single biggest structural upgrade over returning bare status codes. One place defines how each failure looks on the wire, and `?` works in handlers:

```rust,ignore
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};

#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("task {0} not found")]
    NotFound(u64),
    #[error("{0}")]
    Invalid(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match self {
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Invalid(_) => StatusCode::UNPROCESSABLE_ENTITY,
        };
        // One JSON error shape for the whole API.
        (status, Json(serde_json::json!({ "error": self.to_string() }))).into_response()
    }
}
```

## The handlers

Each endpoint is a plain `async fn` using [extractors](#/ch/axum) for input and returning something that implements `IntoResponse`:

```rust,ignore
use axum::extract::{Path, Query, State};

// GET /tasks?done=true&limit=10
async fn list_tasks(State(s): State<AppState>, Query(q): Query<ListParams>) -> Json<Vec<Task>> {
    let tasks = s.tasks.read().unwrap();
    let out: Vec<Task> = tasks.iter()
        .filter(|t| q.done.map_or(true, |d| t.done == d))
        .take(q.limit.unwrap_or(usize::MAX))
        .cloned()
        .collect();
    Json(out)
}

// POST /tasks -- validate, assign an id, store, return 201
async fn create_task(State(s): State<AppState>, Json(body): Json<NewTask>)
    -> Result<(StatusCode, Json<Task>), AppError>
{
    let title = body.title.trim().to_string();
    if title.is_empty() { return Err(AppError::Invalid("title must not be empty".into())); }
    if title.len() > 120 { return Err(AppError::Invalid("title too long (max 120)".into())); }

    let task = Task { id: s.next_id.fetch_add(1, Ordering::Relaxed), title, done: false };
    s.tasks.write().unwrap().push(task.clone());
    Ok((StatusCode::CREATED, Json(task)))
}

// GET /tasks/{id}
async fn get_task(State(s): State<AppState>, Path(id): Path<u64>) -> Result<Json<Task>, AppError> {
    let tasks = s.tasks.read().unwrap();
    tasks.iter().find(|t| t.id == id).cloned().map(Json).ok_or(AppError::NotFound(id))
}

// POST /tasks/{id}/done
async fn complete_task(State(s): State<AppState>, Path(id): Path<u64>)
    -> Result<Json<Task>, AppError>
{
    let mut tasks = s.tasks.write().unwrap();
    let t = tasks.iter_mut().find(|t| t.id == id).ok_or(AppError::NotFound(id))?;
    t.done = true;
    Ok(Json(t.clone()))
}

// DELETE /tasks/{id} -- 204 with no body on success
async fn delete_task(State(s): State<AppState>, Path(id): Path<u64>)
    -> Result<StatusCode, AppError>
{
    let mut tasks = s.tasks.write().unwrap();
    let before = tasks.len();
    tasks.retain(|t| t.id != id);
    if tasks.len() == before { Err(AppError::NotFound(id)) } else { Ok(StatusCode::NO_CONTENT) }
}
```

## Wiring it together

Building the router in its own function (rather than inline in `main`) is what makes the tests further down possible — they construct the same `Router` with no listener and no port:

```rust,ignore
use axum::{routing::{get, post}, Router};

fn app(state: AppState) -> Router {
    Router::new()
        .route("/tasks", get(list_tasks).post(create_task))
        .route("/tasks/{id}", get(get_task).delete(delete_task))
        .route("/tasks/{id}/done", post(complete_task))
        .with_state(state)
}

#[tokio::main]
async fn main() {
    let state = AppState {
        tasks: Arc::new(RwLock::new(Vec::new())),
        next_id: Arc::new(AtomicU64::new(1)),
    };

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app(state)).await.unwrap();
}
```

<figure class="diagram">
<svg viewBox="0 0 640 268" role="img" aria-label="The request lifecycle: the tokio listener accepts a connection, tower layers wrap the request, the router matches a method and path, extractors parse state, path, query and body, the handler returns a Result, and IntoResponse turns either arm into an HTTP response">
  <style>
    .rq-h { font: 700 11px var(--font-sans); }
    .rq-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .rq-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .rq-a { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .rq-b { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .rq-r { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.6; }
    .rq-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .rq-err { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <text x="20" y="16" class="rq-h" fill="var(--text-mute)">one request, start to finish</text>
  <rect x="20" y="26" width="104" height="34" rx="4" class="rq-a"/><text x="30" y="41" class="rq-m">TcpListener</text><text x="30" y="54" class="rq-c">tokio accepts</text>
  <rect x="140" y="26" width="120" height="34" rx="4" class="rq-b"/><text x="150" y="41" class="rq-m">tower layers</text><text x="150" y="54" class="rq-c">trace · timeout · cors</text>
  <rect x="276" y="26" width="104" height="34" rx="4" class="rq-r"/><text x="286" y="41" class="rq-m">Router</text><text x="286" y="54" class="rq-c">method + path</text>
  <rect x="396" y="26" width="120" height="34" rx="4" class="rq-b"/><text x="406" y="41" class="rq-m">extractors</text><text x="406" y="54" class="rq-c">State Path Query Json</text>
  <rect x="532" y="26" width="88" height="34" rx="4" class="rq-r"/><text x="542" y="41" class="rq-m">handler</text><text x="542" y="54" class="rq-c">async fn</text>
  <path d="M124 43 L138 43" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#rq-a1)"/>
  <path d="M260 43 L274 43" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#rq-a1)"/>
  <path d="M380 43 L394 43" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#rq-a1)"/>
  <path d="M516 43 L530 43" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#rq-a1)"/>
  <text x="20" y="88" class="rq-h" fill="var(--text-mute)">the handler returns a Result — both arms become a response</text>
  <rect x="60" y="98" width="220" height="30" rx="4" class="rq-ok"/><text x="72" y="117" class="rq-m">Ok((StatusCode::CREATED, Json(task)))</text>
  <rect x="60" y="134" width="220" height="30" rx="4" class="rq-err"/><text x="72" y="153" class="rq-m">Err(AppError::NotFound(id))</text>
  <rect x="360" y="112" width="200" height="38" rx="4" class="rq-a"/><text x="372" y="128" class="rq-m">IntoResponse</text><text x="372" y="143" class="rq-c">status + headers + body</text>
  <path d="M282 113 L358 126" stroke="var(--green)" stroke-width="1.5" marker-end="url(#rq-a2)"/>
  <path d="M282 149 L358 138" stroke="var(--red)" stroke-width="1.5" marker-end="url(#rq-a3)"/>
  <text x="20" y="184" class="rq-c">A failing <tspan font-style="italic">extractor</tspan> short-circuits before your handler ever runs — that's where 415, 422 and 400 come from.</text>
  <text x="20" y="200" class="rq-c">An unmatched path stops at the Router: 404. A matched path with the wrong method: 405.</text>
  <text x="20" y="222" class="rq-c">Because <tspan font-family="var(--font-mono)">app()</tspan> builds the Router as a value, a test can call it directly — no socket, no port, no server task.</text>
  <text x="20" y="244" class="rq-c">Layers wrap the <tspan font-style="italic">whole</tspan> stack, so <tspan font-family="var(--font-mono)">TraceLayer</tspan> also sees the responses your extractors rejected.</text>
  <text x="20" y="260" class="rq-c">State is cloned per request — cheap, because it's <tspan font-family="var(--font-mono)">Arc</tspan> inside.</text>
  <defs>
    <marker id="rq-a1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="rq-a2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="rq-a3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--red)"/></marker>
  </defs>
</svg>
<figcaption>Listener → layers → router → extractors → handler → <code>IntoResponse</code>. Failures short-circuit at whichever stage detects them.</figcaption>
</figure>

## Exercising it with `curl`

```bash
curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Learn axum"}'
curl localhost:3000/tasks
curl 'localhost:3000/tasks?done=true&limit=1'
curl -X POST localhost:3000/tasks/1/done
curl -X DELETE localhost:3000/tasks/2
```

Here is what the running service actually returns, status codes included:

```text
POST /tasks {"title":"Learn axum"}      201  {"id":1,"title":"Learn axum","done":false}
POST /tasks {"title":"Write tests"}     201  {"id":2,"title":"Write tests","done":false}
POST /tasks/1/done                      200  {"id":1,"title":"Learn axum","done":true}
GET  /tasks/1                           200  {"id":1,"title":"Learn axum","done":true}
GET  /tasks                             200  [{"id":1,...,"done":true},{"id":2,...,"done":false}]
GET  /tasks?done=true                   200  [{"id":1,"title":"Learn axum","done":true}]
GET  /tasks?limit=1                     200  [{"id":1,"title":"Learn axum","done":true}]
DELETE /tasks/2                         204  (no body)
DELETE /tasks/2   (again)               404  {"error":"task 2 not found"}
GET  /tasks/99                          404  {"error":"task 99 not found"}
POST /tasks {"title":"   "}             422  {"error":"title must not be empty"}
```

## What the framework rejects before you see it

The interesting half of that transcript is the failures we never wrote code for. Each of these is an *extractor* refusing to produce a value, which short-circuits the request:

```text
POST /tasks {"titel":"typo"}            422  Failed to deserialize the JSON body into the
                                             target type: missing field `title` at line 1 column 16
POST /tasks  (no content-type header)   415  Expected request with `Content-Type: application/json`
GET  /tasks/abc                         400  Invalid URL: Cannot parse `abc` to a `u64`
GET  /tasks?done=maybe                  400  Failed to deserialize query string: done: provided
                                             string was not `true` or `false`
GET  /nope                              404  (no body)
PUT  /tasks                             405  (no body)
```

> [!key] Extractors are your first validation layer, and the types are the schema
> `Path<u64>` means a non-numeric id can never reach your handler — there is no `if let Ok(id) = ...` to forget. `Json<NewTask>` means a body with a missing or mistyped field is rejected with the field name and column, and a request without the JSON content-type gets a `415` before the body is even parsed. This is the practical payoff of typed extractors: the entire class of "we forgot to validate that" bugs is handled by `serde` and the type system, and what remains in your handler is *business* validation — "the title mustn't be blank" — which is exactly what `AppError::Invalid` is for.

> [!tip] Customise those built-in error bodies
> The default extractor rejections are plain text, which is fine internally but inconsistent with your JSON error shape. Two ways to fix that: wrap the extractor (`axum::extract::rejection::JsonRejection` can be mapped in a custom `FromRequest` impl that emits your error format), or use the `axum-extra` / `axum_valid` ecosystem crates that do it for you. Do it once, early — retrofitting an error format across forty endpoints is much less pleasant.

## Testing without a server

Because `app()` returns a `Router`, and a `Router` is a `tower::Service`, tests can send requests straight into it. No port, no `tokio::spawn`, no waiting for a socket, no flakiness — and it's fast enough to run on every save:

```rust,ignore
#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;               // brings `oneshot`

    fn state() -> AppState {
        AppState { tasks: Arc::new(RwLock::new(Vec::new())), next_id: Arc::new(AtomicU64::new(1)) }
    }

    async fn body_string(r: Response) -> String {
        String::from_utf8(r.into_body().collect().await.unwrap().to_bytes().to_vec()).unwrap()
    }

    #[tokio::test]
    async fn create_then_list() {
        let app = app(state());
        // No server, no port, no async runtime plumbing: just call the Router.
        let res = app.clone().oneshot(
            Request::post("/tasks")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"first"}"#)).unwrap()).await.unwrap();
        assert_eq!(res.status(), StatusCode::CREATED);
        assert_eq!(body_string(res).await, r#"{"id":1,"title":"first","done":false}"#);

        let res = app.oneshot(Request::get("/tasks").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert!(body_string(res).await.contains(r#""title":"first""#));
    }

    #[tokio::test]
    async fn rejects_blank_title() {
        let res = app(state()).oneshot(
            Request::post("/tasks")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"  "}"#)).unwrap()).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(body_string(res).await, r#"{"error":"title must not be empty"}"#);
    }

    #[tokio::test]
    async fn missing_task_is_404() {
        let res = app(state()).oneshot(Request::get("/tasks/42").body(Body::empty()).unwrap())
            .await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}
```

```text
running 3 tests
test tests::missing_task_is_404 ... ok
test tests::rejects_blank_title ... ok
test tests::create_then_list ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

> [!best] Give each test its own state
> Every test above builds a fresh `state()`, so ids start at 1 and tests can't see each other's tasks. Sharing one state across tests makes them order-dependent — and since `cargo test` runs them in parallel on separate threads, order-dependent means *randomly failing*. The same rule scales to a database: a test transaction that rolls back, or a fresh schema per test, beats a shared fixture you have to clean up.

## Middleware, logging, and graceful shutdown

The service so far has no observability and no timeouts. `tower_http` provides both as **layers** — one line each, wrapping the whole stack:

```rust,ignore
use std::time::Duration;
use tower_http::{compression::CompressionLayer, cors::CorsLayer,
                 timeout::TimeoutLayer, trace::TraceLayer};

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.expect("failed to listen for ctrl-c");
    tracing::info!("shutdown signal received, finishing in-flight requests");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // RUST_LOG=info,tower_http=debug cargo run
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let app = app(state())
        .layer(TraceLayer::new_for_http())            // a span + log line per request
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT, Duration::from_secs(10)))
        .layer(CompressionLayer::new())               // gzip/br when the client asks
        .layer(CorsLayer::permissive());              // tighten this for real deployments

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())    // stop accepting, drain, then exit
        .await?;
    Ok(())
}
```

With `RUST_LOG=info,tower_http=debug`, one request produces:

```text
2026-08-12T07:38:39.754157Z  INFO prod: listening on http://0.0.0.0:3111
2026-08-12T07:38:41.758229Z DEBUG request{method=GET uri=/health version=HTTP/1.1}:
    tower_http::trace::on_request: started processing request
2026-08-12T07:38:41.758291Z DEBUG request{method=GET uri=/health version=HTTP/1.1}:
    tower_http::trace::on_response: finished processing request latency=0 ms status=200
```

That `request{...}` prefix is a [tracing](#/ch/tracing) **span**: every log line emitted anywhere inside the request — including from your handlers and your database layer — carries the method and URI automatically, which is what makes production logs navigable.

| Layer | Adds |
|---|---|
| `TraceLayer::new_for_http()` | a per-request span, plus start/finish lines with latency and status |
| `TimeoutLayer` | an upper bound on a request, so one slow dependency can't pin a connection open |
| `CompressionLayer` | gzip/brotli when the client sends `Accept-Encoding` |
| `CorsLayer` | the headers a browser needs to call your API from another origin |
| `DefaultBodyLimit` (axum) | a cap on request-body size — 2 MB by default; raise or lower deliberately |
| `tower::limit::ConcurrencyLimitLayer` | back-pressure: bound in-flight requests instead of queueing without limit |

> [!key] Layer order matters, and it's outside-in
> `.layer(a).layer(b)` means a request passes through **`b` first, then `a`** — the last layer added is the outermost. Put `TraceLayer` on last if you want it to observe everything, including timeouts and rejections; put a timeout *inside* tracing so the timeout shows up as a logged `408` rather than vanishing. Layers added with `.route_layer()` apply only to matched routes, which is how you protect some paths (auth) and not others (`/health`).

> [!warning] `0.0.0.0` versus `127.0.0.1`, one more time
> The production version binds `0.0.0.0` — every interface, which is what a container needs, and what makes the service reachable from the internet on a cloud host. `127.0.0.1` is local-only and right for development. As the [`std::net` chapter](#/ch/std-net) put it: choose deliberately, because "it worked on my laptop" is exactly what the wrong choice looks like. Bind the port from the environment (`PORT`), since most platforms tell you which port to use rather than letting you pick.

## From toy to production

Our in-memory `Vec` resets on restart. The path to a real service:

> [!best] The next steps toward production
> - **Persistence**: replace the `Arc<RwLock<Vec>>` with a database via [**sqlx**](#/ch/sqlx) — swap the state for a `PgPool` and the handlers for SQL queries. Add a `#[from] sqlx::Error` variant to `AppError` that maps to `500` (and log it, don't leak it).
> - **Config**: read the port, database URL, and log filter from the environment at startup into a `Config` struct, and fail loudly if something required is missing.
> - **Auth**: an extractor that pulls a token from the `Authorization` header and returns `401`/`403` — because it's an extractor, protected handlers just take a `CurrentUser` argument and unprotected ones don't.
> - **Pagination**: our `limit` is a start; real APIs need a cursor and a total, and a *maximum* limit so a client can't ask for everything.
> - **OpenAPI**: `utoipa` or `aide` generate a schema from your types, so the docs can't drift from the code.
>
> Each is an incremental change — the handler-as-async-function structure stays the same.

> [!warning] Don't hold a lock across `.await`
> With a **`std`** `RwLock`/`Mutex`, keep the guard's scope short and **never hold it across an `.await`** — the guard isn't `Send`, so a handler that holds one while awaiting won't even compile in axum, and the pattern risks deadlocking the runtime. Our handlers take and release the lock inside a single synchronous stretch, which is correct. If state genuinely must be held across await points, use **`tokio::sync::RwLock`**; if a handler needs to do slow *blocking* work (a big computation, a sync library), send it to `tokio::task::spawn_blocking` instead of stalling the async worker.

## Summary

- A JSON API is **axum** (routing + extractors), **serde** (JSON both ways), **tokio** (runtime), and shared state via `State` — with `Arc` inside so cloning per request is cheap.
- axum 0.8 uses **`/tasks/{id}`** for path parameters; the old `:id` form panics at startup.
- **Accept different types than you store.** `NewTask` has no `id` field, so a client cannot set one.
- Prefer **one lock over two** (an `AtomicU64` for the id counter removes the second lock entirely) and `RwLock` when reads dominate.
- **Return `Result<T, AppError>` with `IntoResponse`** so every failure has one JSON shape and `?` works in handlers.
- **Extractors are validation**: measured here, the framework returned `415` for a missing content-type, `422` for a mistyped JSON field, `400` for `/tasks/abc` and `?done=maybe`, `405` for the wrong method — all before any handler code ran.
- **Test the `Router` directly** with `tower`'s `oneshot`: no port, no server task, no flakiness, three tests in 0.00s. Fresh state per test, because tests run in parallel.
- Add **`tower_http` layers** for tracing, timeouts, compression, and CORS — remembering that the **last layer added is the outermost** — plus **graceful shutdown** and a `PORT` from the environment.
- Keep `std` guards out of `.await`, and push blocking work to `spawn_blocking`.

> [!exercise] Try it yourself (locally)
> 1. Build the service and reproduce the whole transcript above with `curl -i`, including the `415`, `422`, `400`, and `405` responses.
> 2. Add `PATCH /tasks/{id}` taking `{"title": "...", "done": true}` with both fields optional, and decide what it should return when neither is given.
> 3. Add the `oneshot` tests for `DELETE` (both the `204` and the `404`) and for `?limit=`.
> 4. Add a `500` variant to `AppError` that logs the internal detail with `tracing::error!` but returns a generic message to the client — then prove the detail isn't in the response body.
> 5. Add `TraceLayer` and `TimeoutLayer`, then make a handler `tokio::time::sleep` for 15 seconds and confirm you get a logged timeout rather than a hung request.
> 6. Write an `ApiKey` extractor that reads `Authorization: Bearer …` and returns `401` when absent; apply it with `route_layer` to everything except `/health`.
> 7. Replace the in-memory store with SQLite via sqlx, keeping the handler signatures unchanged.
> 8. Load-test with `oha` or `hey` and watch the `TraceLayer` latency numbers — then add `ConcurrencyLimitLayer` and observe what changes under overload.

Next, a very different target: compiling Rust to run *in the browser* with WebAssembly.
