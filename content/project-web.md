<h1><span class="h1-kicker">Building Real Projects</span>Project: A Web Service</h1>

Let's build a real backend: a **JSON REST API** for a to-do list, using [axum](#/ch/axum), [serde](#/ch/serde), [tokio](#/ch/tokio), and shared state. It supports creating, listing, and completing tasks over HTTP. This project ties together async, web handling, shared mutable state, and JSON — the everyday work of Rust backend development. (It runs locally, not in the in-book playground; the code is the guide.)

## What we're building

A small HTTP API:

| Method & path | Does |
|---------------|------|
| `GET /tasks` | list all tasks (JSON array) |
| `POST /tasks` | create a task from a JSON body |
| `PUT /tasks/:id/done` | mark a task complete |

## Setup

```bash
cargo new todo-api && cd todo-api
cargo add axum
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
```

## The data model

Define the task type and derive serde so it serializes to/from JSON automatically:

```rust,ignore
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
struct Task {
    id: u64,
    title: String,
    done: bool,
}

// The shape of the JSON body for creating a task (no id/done — the server sets those):
#[derive(Deserialize)]
struct NewTask {
    title: String,
}
```

## Shared state

Our tasks live in memory, shared across all requests. Because handlers run concurrently on many tasks, we protect the data with `Arc<Mutex<...>>` (the [shared-state](#/ch/shared-state) pattern) and hand it to axum via `State`:

```rust,ignore
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct AppState {
    tasks: Arc<Mutex<Vec<Task>>>,
    next_id: Arc<Mutex<u64>>,
}
```

## The handlers

Each endpoint is a plain `async fn` using [extractors](#/ch/axum) for input and returning `Json` for output:

```rust,ignore
use axum::{extract::{Path, State}, http::StatusCode, Json};

// GET /tasks → list all tasks
async fn list_tasks(State(state): State<AppState>) -> Json<Vec<Task>> {
    let tasks = state.tasks.lock().unwrap();
    Json(tasks.clone())
}

// POST /tasks → create from a JSON body, return the new task with 201
async fn create_task(
    State(state): State<AppState>,
    Json(payload): Json<NewTask>,
) -> (StatusCode, Json<Task>) {
    let mut id = state.next_id.lock().unwrap();
    let task = Task { id: *id, title: payload.title, done: false };
    *id += 1;

    state.tasks.lock().unwrap().push(task.clone());
    (StatusCode::CREATED, Json(task))
}

// PUT /tasks/:id/done → mark complete, 404 if not found
async fn complete_task(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> StatusCode {
    let mut tasks = state.tasks.lock().unwrap();
    match tasks.iter_mut().find(|t| t.id == id) {
        Some(task) => { task.done = true; StatusCode::OK }
        None => StatusCode::NOT_FOUND,
    }
}
```

## Wiring it together

`main` builds the router, attaches the state, and serves:

```rust,ignore
use axum::{routing::{get, post, put}, Router};

#[tokio::main]
async fn main() {
    let state = AppState {
        tasks: Arc::new(Mutex::new(Vec::new())),
        next_id: Arc::new(Mutex::new(1)),
    };

    let app = Router::new()
        .route("/tasks", get(list_tasks).post(create_task))
        .route("/tasks/:id/done", put(complete_task))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("todo-api listening on http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}
```

Try it with `curl`:

```bash
curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Learn axum"}'
curl localhost:3000/tasks
curl -X PUT localhost:3000/tasks/1/done
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A request flows through the router to a handler that locks shared state and returns JSON">
  <style>
    .pwm { font: 600 11px var(--font-mono); fill: var(--text); }
    .pwc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .c1 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .c2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .c3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="14" y="50" width="120" height="40" class="c1"/><text x="26" y="74" class="pwm">POST /tasks</text>
  <rect x="160" y="50" width="120" height="40" class="c1"/><text x="174" y="74" class="pwm">Router</text>
  <rect x="306" y="42" width="150" height="56" class="c2"/><text x="318" y="64" class="pwm">create_task()</text><text x="318" y="82" class="pwc">Json + State</text>
  <rect x="482" y="50" width="140" height="40" class="c3"/><text x="494" y="74" class="pwm">Arc&lt;Mutex&lt;Vec&gt;&gt;</text>
  <path d="M134 70 L158 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#apw)"/>
  <path d="M280 70 L304 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#apw)"/>
  <path d="M456 70 L480 70" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#apw)"/>
  <text x="14" y="128" class="pwc">Router → handler (extractors) → lock shared state → mutate → return JSON. serde handles the JSON both ways.</text>
  <defs><marker id="apw" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The service ties together axum routing, serde JSON, and <code>Arc&lt;Mutex&gt;</code> shared state.</figcaption>
</figure>

## From toy to production

Our in-memory `Vec` resets on restart. The path to a real service:

> [!best] The next steps toward production
> - **Persistence**: replace the `Arc<Mutex<Vec>>` with a database via [**sqlx**](#/ch/sqlx) — swap the state for a `PgPool` and the handlers for SQL queries.
> - **Error handling**: give handlers a custom error type that implements `IntoResponse`, mapping failures to proper status codes (with [thiserror](#/ch/anyhow-thiserror)).
> - **Observability**: add [**tracing**](#/ch/tracing) + `tower_http::trace` so every request is logged with timing.
> - **Middleware**: use `tower_http` layers for CORS, compression, and request timeouts.
> - **Config**: read the port and database URL from the environment.
>
> Each is an incremental change — the axum handler-as-async-function structure stays the same.

> [!warning] Don't hold a lock across `.await`
> With a **`std`** `Mutex`, keep the lock guard's scope short and **never hold it across an `.await`** — the guard isn't `Send`, and holding it while the task suspends can deadlock the async runtime. In our handlers, the lock is taken and released within a single synchronous stretch (no `.await` while locked), which is correct. If you must hold state across await points, use **`tokio::sync::Mutex`** (an async-aware lock) instead.

## Summary

- We built a **JSON REST API** with **axum** (routing + handlers), **serde** (JSON in/out), **tokio** (runtime), and **`Arc<Mutex<...>>`** shared state via axum's `State`.
- Handlers are **async functions** using extractors (`State`, `Json`, `Path`) and returning `Json`/`StatusCode`.
- The `Router` maps method+path to handlers; `.with_state` shares data across them.
- To productionize: swap in **sqlx** for persistence, custom `IntoResponse` errors, **tracing** for logging, `tower_http` middleware, and env-based config.
- Keep `std` mutex guards short and **never across `.await`** (or use `tokio::sync::Mutex`).

> [!exercise] Try it yourself (locally)
> 1. Build the todo API and exercise all three endpoints with `curl`.
> 2. Add a `DELETE /tasks/:id` endpoint returning 404 when the id doesn't exist.
> 3. Replace the in-memory store with SQLite via sqlx (bonus: add tracing to log each request).

Next, a very different target: compiling Rust to run *in the browser* with WebAssembly.
