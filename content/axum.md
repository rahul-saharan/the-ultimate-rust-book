<h1><span class="h1-kicker">The Crate Ecosystem</span>axum: Building Web Servers</h1>

**axum** is the web framework of choice for production Rust services. It comes from the tokio team, is built on **tokio** (the async runtime), **hyper** (the HTTP implementation), and **tower** (a composable middleware ecosystem), and its defining idea is disarmingly simple: **a handler is just an async function**. No macros, no reflection, no magic base class — you write ordinary Rust functions and axum wires them into a high-performance HTTP server.

This chapter is long on purpose. axum is what you will actually ship, so we cover it thoroughly: routing, every kind of extractor, responses and error handling, shared state, the tower middleware stack, and the production concerns (validation, CORS, tracing, timeouts, graceful shutdown, testing, WebSockets). Then — **before you build anything real** — we open the hood and show *how axum works internally*, with diagrams. Finally, you'll build a complete **e-commerce admin analytics API** that exercises the entire chapter.

> [!note] Servers don't run in the in-book playground
> A web server binds a socket and runs forever, so the "▶ Run" button can't execute axum examples — they're marked `ignore` and are meant to be run **locally** with `cargo run`. One block in the capstone (the pure-Rust analytics core) *is* runnable, so you can execute the real aggregation logic here in the book. Everything else you copy into a project.

## Hello, axum

An axum app is a **`Router`** that maps paths to handler functions, served by a tokio TCP listener:

```rust,ignore
// Cargo.toml:
//   axum = "0.7"
//   tokio = { version = "1", features = ["full"] }

use axum::{routing::get, Router};

async fn hello() -> &'static str {
    "Hello, axum!"
}

#[tokio::main]
async fn main() {
    // Build the router: GET / → hello
    let app = Router::new().route("/", get(hello));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("listening on http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}
```

Visit `http://127.0.0.1:3000` and you get "Hello, axum!". The whole server is a router plus async functions.

> [!key] Handlers are ordinary async functions
> axum's central insight: a **handler is just an `async fn`** whose parameters are *extractors* (things pulled from the request) and whose return value is a *response*. There's no special handler trait to implement or macro to apply — you write normal Rust functions, and axum wires them up. This makes handlers trivial to read, unit-test, and refactor.

## The Router in depth

The `Router` is the heart of an axum app. It matches an incoming request's **method + path** to a handler, and it composes: routers nest inside routers, so a large app is built from small, independently-testable pieces.

### Methods and method routers

`get`, `post`, `put`, `patch`, `delete`, `head`, `options` each build a **`MethodRouter`**. Chain them to serve several methods on one path:

```rust,ignore
use axum::{routing::{get, post}, Router};

async fn list_products() -> &'static str { "all products" }
async fn create_product() -> &'static str { "created" }
async fn get_product() -> &'static str { "one product" }
async fn delete_product() -> &'static str { "deleted" }

fn router() -> Router {
    Router::new()
        // One path, multiple methods — chain them:
        .route("/products", get(list_products).post(create_product))
        // Path parameter with two methods:
        .route("/products/:id", get(get_product).delete(delete_product))
}
```

### Path parameters and wildcards

A segment prefixed with `:` is a **capture**; a `*` prefix captures the **rest** of the path. Extract them with `Path` (covered fully below):

```rust,ignore
Router::new()
    .route("/users/:id", get(get_user))              // /users/42
    .route("/users/:id/posts/:post_id", get(get_post)) // two params
    .route("/files/*path", get(serve_file));           // /files/a/b/c.txt → "a/b/c.txt"
```

### Nesting and merging

`.nest(prefix, sub_router)` mounts a sub-router under a path prefix — the idiomatic way to version and group an API. `.merge(other)` combines two routers at the *same* level (great for splitting routes across modules).

```rust,ignore
fn api_v1() -> Router {
    Router::new()
        .route("/products", get(list_products))
        .route("/orders", get(list_orders))
}

fn app() -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/api/v1", api_v1())   // → /api/v1/products, /api/v1/orders
        .merge(admin_routes())        // fold another router's routes in at the top level
}
```

### Fallbacks (404 and beyond)

`.fallback(handler)` handles anything no route matched — your custom 404, or an SPA's `index.html`:

```rust,ignore
use axum::{http::StatusCode, response::IntoResponse};

async fn not_found() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "no such route")
}

Router::new().route("/", get(hello)).fallback(not_found);
```

> [!tip] Route order doesn't matter (mostly)
> axum uses the **`matchit`** router under the hood — a radix-tree matcher that picks the most specific route regardless of the order you added them. You *cannot* register two routes that overlap ambiguously (e.g. `/:a` and `/:b` on the same method) — axum panics at startup, catching the bug immediately rather than at 3am in production.

## Extractors: getting data from the request

An **extractor** is a handler parameter that axum fills in from the request. You declare the *type* you want, and axum does the parsing — returning a clean error response automatically if it fails.

```rust,ignore
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;

// Path parameter: /users/:id  → the id, parsed to u32
async fn get_user(Path(id): Path<u32>) -> String {
    format!("fetching user {id}")
}

// Query string: /search?q=rust&page=2  → strongly typed
#[derive(Deserialize)]
struct SearchParams { q: String, page: Option<u32> }

async fn search(Query(params): Query<SearchParams>) -> String {
    format!("searching '{}' (page {})", params.q, params.page.unwrap_or(1))
}

// JSON body → deserialized into a struct
#[derive(Deserialize)]
struct NewUser { name: String }

async fn create_user(Json(payload): Json<NewUser>) -> String {
    format!("created user {}", payload.name)
}
```

Here is the full toolbox of built-in extractors:

| Extractor | Pulls from the request… | Notes |
|-----------|--------------------------|-------|
| `Path<T>` | URL path segments (`/users/:id`) | tuple for multiple: `Path<(u32, String)>` |
| `Query<T>` | the query string (`?q=…`) | deserialized with serde |
| `Json<T>` | a JSON request **body** | body-consuming (see rule below) |
| `Form<T>` | a URL-encoded form body | body-consuming |
| `Multipart` | file uploads + form fields | body-consuming; needs the `multipart` feature |
| `State<T>` | shared application state | needs `.with_state` |
| `Extension<T>` | a value inserted by middleware | request-scoped data |
| `HeaderMap` | all request headers | or `TypedHeader<...>` for typed ones |
| `String` / `Bytes` | the raw body as text/bytes | body-consuming |
| `Request` | the entire raw request | body-consuming; the escape hatch |

### The one rule: body extractors go last

The head of a request (method, URI, headers) can be read many times, but the **body is a stream you can only consume once**. So axum splits extractors into two kinds — those that read only the head (`Path`, `Query`, `State`, `HeaderMap`, …) and the one that consumes the body (`Json`, `Form`, `String`, `Bytes`, `Request`). **The body-consuming extractor must be the *last* parameter.**

```rust,ignore
// ✅ Correct: head extractors first, body extractor (Json) last
async fn ok(Path(id): Path<u32>, State(s): State<AppState>, Json(body): Json<Payload>) {}

// ❌ Won't compile: Json is not the final argument
async fn bad(Json(body): Json<Payload>, Path(id): Path<u32>) {}
```

### Optional and fallible extraction

Wrap an extractor in `Option<T>` to get `None` instead of an error when it's absent, or in `Result<T, T::Rejection>` to inspect *why* parsing failed:

```rust,ignore
// Missing/invalid query → None instead of a 400
async fn maybe_query(params: Option<Query<SearchParams>>) -> String {
    match params {
        Some(Query(p)) => format!("searching {}", p.q),
        None => "no query given".into(),
    }
}
```

### Writing your own extractor

Because extraction is a trait, you can create custom extractors — the standard way to model authentication, a request ID, a tenant, etc. Implement **`FromRequestParts`** (head only) for anything that isn't the body:

```rust,ignore
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};

/// Extracts a validated `Bearer <token>` from the Authorization header.
struct AuthToken(String);

#[async_trait]
impl<S> FromRequestParts<S> for AuthToken
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or((StatusCode::UNAUTHORIZED, "missing or malformed bearer token"))?;
        Ok(AuthToken(token.to_string()))
    }
}

// Now any handler can just ask for it:
async fn me(AuthToken(token): AuthToken) -> String {
    format!("authenticated with token {token}")
}
```

## Every kind of request body — JSON, forms, files, raw & streams

The examples so far mostly read `Json`. But a request body can be anything: a JSON document, an HTML form, an **uploaded file** (or several), or a giant stream you don't want to hold in memory. axum has a body extractor for each shape — and they are all **body-consuming**, so exactly one may appear, always as the **last** handler argument.

| Content-Type | Extractor | Feature flag | Use it for |
|---|---|---|---|
| `application/json` | `Json<T>` | — | JSON APIs |
| `application/x-www-form-urlencoded` | `Form<T>` | `form` (default) | classic HTML forms |
| `multipart/form-data` | `Multipart` | **`multipart`** | file uploads + form fields |
| `text/*`, anything | `String` | — | raw text bodies |
| any bytes | `Bytes` | — | binary blobs held in memory |
| any bytes (streamed) | `Body` / `Request` | — | large uploads, streaming to disk |

### Forms

`Form<T>` is `Json<T>`'s twin for `application/x-www-form-urlencoded` — the encoding a plain HTML `<form method="post">` sends. It deserializes into a struct with serde, exactly like `Query`:

```rust,ignore
use axum::Form;
use serde::Deserialize;

#[derive(Deserialize)]
struct LoginForm { username: String, password: String }

async fn login(Form(form): Form<LoginForm>) -> String {
    format!("logging in {}", form.username)
}
```

### File uploads with `Multipart`

A `multipart/form-data` body is how browsers submit **files** (and mixed file + text fields). Enable the feature and take a `Multipart` extractor, then loop over its **fields** — each field is either a text value or a file (it has a `file_name`). Fields arrive as an async stream, so you `.await` each one:

```rust,ignore
// Cargo.toml: axum = { version = "0.7", features = ["multipart"] }
use axum::{extract::Multipart, http::StatusCode};

async fn upload(mut multipart: Multipart) -> Result<String, StatusCode> {
    let mut report = String::new();

    // Pull one field at a time until the stream ends:
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().unwrap_or("unnamed").to_string();
        let file_name = field.file_name().map(|s| s.to_string());     // Some(..) ⇒ it's a file
        let content_type = field.content_type().map(|s| s.to_string());

        // Read this field's bytes (see streaming below for huge files):
        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

        match file_name {
            Some(fname) => report.push_str(&format!(
                "file field '{name}': {fname} [{}] — {} bytes\n",
                content_type.unwrap_or_default(),
                data.len()
            )),
            None => report.push_str(&format!(
                "text field '{name}': {}\n",
                String::from_utf8_lossy(&data)
            )),
        }
    }
    Ok(report)
}

// router.route("/upload", axum::routing::post(upload))
```

<figure class="diagram">
<svg viewBox="0 0 680 200" role="img" aria-label="A multipart form-data body is a sequence of fields separated by a boundary; each field is either a text value or a file part with a filename and content type, and axum yields them one at a time from next_field">
  <style>
    .mp-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .mp-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .mp-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .txt  { fill: var(--blue-soft); stroke: var(--blue);  stroke-width: 1.4; }
    .file { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.4; }
    .bnd  { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="10" y="22" class="mp-h">multipart/form-data body — a stream of fields</text>
  <rect x="10"  y="40" width="70"  height="40" rx="6" class="bnd"/><text x="20" y="64" class="mp-b">--bound</text>
  <rect x="88"  y="40" width="150" height="40" rx="6" class="txt"/><text x="100" y="58" class="mp-b">field "title"</text><text x="100" y="74" class="mp-c">text value</text>
  <rect x="246" y="40" width="70"  height="40" rx="6" class="bnd"/><text x="256" y="64" class="mp-b">--bound</text>
  <rect x="324" y="40" width="170" height="40" rx="6" class="file"/><text x="336" y="58" class="mp-b">field "avatar"</text><text x="336" y="74" class="mp-c">file: cat.png (image/png)</text>
  <rect x="502" y="40" width="70"  height="40" rx="6" class="bnd"/><text x="512" y="64" class="mp-b">--bound</text>
  <rect x="580" y="40" width="90"  height="40" rx="6" class="file"/><text x="592" y="58" class="mp-b">field "doc"</text><text x="592" y="74" class="mp-c">file: a.pdf</text>
  <text x="10" y="118" class="mp-c">multipart.next_field().await  →  yields each field in order (text or file), one at a time.</text>
  <text x="10" y="140" class="mp-c">field.file_name().is_some()   →  this field is an uploaded file; read it with field.bytes() or stream it.</text>
</svg>
<figcaption>A multipart body is a boundary-separated sequence of fields; <code>next_field()</code> hands them to you one at a time, text or file.</figcaption>
</figure>

> [!warning] Always cap upload size — `DefaultBodyLimit`
> axum limits request bodies to **2&nbsp;MB by default**, which protects JSON endpoints but is often too small for uploads. Raise (or remove) it *per route* with the `DefaultBodyLimit` layer — and never disable it on a public endpoint without another guard, or a single request can exhaust your memory:
> ```rust,ignore
> use axum::extract::DefaultBodyLimit;
> Router::new()
>     .route("/upload", post(upload))
>     .layer(DefaultBodyLimit::max(25 * 1024 * 1024)); // 25 MB for this route
> ```

### Raw bytes and text

When you don't want serde at all — a webhook payload, a raw binary blob — take the body as `Bytes` (binary) or `String` (UTF-8 text). Both buffer the whole body in memory:

```rust,ignore
use axum::body::Bytes;

async fn raw_webhook(body: Bytes) -> String {
    format!("received {} raw bytes", body.len())
}

async fn raw_text(body: String) -> String {
    format!("received text: {body}")
}
```

### Streaming huge bodies without buffering

For large uploads (a video, a backup, a CSV bigger than RAM), buffering the whole body is wasteful or impossible. Take the raw `Body` and consume it as an **async stream of chunks**, writing each chunk straight to disk (or a hasher, or a parser) as it arrives:

```rust,ignore
use axum::{body::Body, http::StatusCode};
use futures::StreamExt;         // for `.next()`
use tokio::io::AsyncWriteExt;   // for `.write_all()`

async fn upload_stream(body: Body) -> Result<String, StatusCode> {
    let mut stream = body.into_data_stream();
    let mut file = tokio::fs::File::create("upload.bin")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut total = 0usize;
    // Each `chunk` is a small piece of the body; we never hold the whole thing:
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| StatusCode::BAD_REQUEST)?;
        total += chunk.len();
        file.write_all(&chunk)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok(format!("streamed {total} bytes to disk"))
}
```

> [!tip] Which body extractor should I use?
> **`Json<T>`** for APIs · **`Form<T>`** for HTML forms · **`Multipart`** whenever the client sends *files* · **`Bytes`/`String`** for small raw payloads (webhooks) · the raw **`Body`** stream for anything large enough that you shouldn't hold it in memory. All are body-consuming, so pick exactly one and put it last — combine with head extractors (`State`, `Path`, `AuthToken`) freely before it.

## Returning responses: `IntoResponse`

A handler's return type becomes the HTTP response. axum implements the **`IntoResponse`** trait for all the common types, so you return them directly. Tuples let you set the status and headers alongside the body:

```rust,ignore
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

#[derive(Serialize)]
struct User { id: u32, name: String }

async fn plain() -> &'static str { "just text → 200 OK" }

async fn as_json() -> Json<User> {
    Json(User { id: 1, name: "Ferris".into() }) // → application/json, 200
}

// (StatusCode, body) sets the status:
async fn created() -> (StatusCode, Json<User>) {
    (StatusCode::CREATED, Json(User { id: 2, name: "Corro".into() }))
}

// (StatusCode, headers, body) sets status + headers:
async fn with_headers() -> impl IntoResponse {
    ([("x-custom", "hi")], "body with a header")
}

// Result<T, E>: Ok → success response, Err → error response
async fn maybe() -> Result<Json<User>, StatusCode> {
    Ok(Json(User { id: 3, name: "Rusty".into() }))
}
```

| You return… | axum produces… |
|---|---|
| `&str`, `String` | `200 OK`, `text/plain` |
| `Json<T>` | `200 OK`, `application/json` |
| `StatusCode` | that status, empty body |
| `(StatusCode, T)` | that status + `T` as body |
| `(StatusCode, HeaderMap, T)` | status + headers + body |
| `Result<T, E>` where both `IntoResponse` | `Ok`→T, `Err`→E |
| `impl IntoResponse` | whatever you build |

## Error handling: your own error type

Real handlers fail — a record is missing, the database is down, input is invalid. The idiomatic axum pattern is a **single application error enum that implements `IntoResponse`**, so handlers can use the `?` operator and every error maps to a proper HTTP response in one place.

```rust,ignore
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

/// One error type for the whole app.
enum AppError {
    NotFound,
    BadRequest(String),
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "resource not found".to_string()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m),
        };
        // Every error is a consistent JSON shape: { "error": "..." }
        (status, Json(json!({ "error": message }))).into_response()
    }
}

// Let `?` convert other errors into AppError automatically:
impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            other => AppError::Internal(other.to_string()),
        }
    }
}

// Handlers now read like happy-path code; `?` handles the rest:
async fn get_thing(/* State(db): State<Db> */) -> Result<Json<User>, AppError> {
    // let user = fetch(&db).await?;  // sqlx::Error auto-converts to AppError
    Err(AppError::NotFound)
}
```

> [!best] One error type, mapped once
> Centralizing `IntoResponse` on a single `AppError` (often generated by [`thiserror`](#/ch/custom-errors)) is the single most valuable pattern for a maintainable axum service. Handlers stay clean, error responses stay consistent, and you change the HTTP mapping in exactly one place. Pair it with `From` impls so `?` converts database, parsing, and validation errors for free.

## Shared state

Real apps share resources — a database pool, a config, a cache, an HTTP client — across handlers. Build a `Clone`-able state struct, attach it with `.with_state`, and receive it via the `State` extractor. Cheap-to-clone handles (`Arc`, connection pools) make cloning free-ish.

```rust,ignore
use axum::{extract::State, routing::get, Router};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct AppState {
    counter: Arc<Mutex<u64>>,
}

async fn hit_count(State(state): State<AppState>) -> String {
    let mut count = state.counter.lock().unwrap();
    *count += 1;
    format!("this endpoint has been hit {count} times")
}

fn app() -> Router {
    let state = AppState { counter: Arc::new(Mutex::new(0)) };
    Router::new().route("/count", get(hit_count)).with_state(state)
}
```

### Splitting state with `FromRef`

When state grows, handlers shouldn't need the *whole* struct. Implement (or derive) **`FromRef`** so a handler can extract just the piece it needs:

```rust,ignore
use axum::extract::{FromRef, State};

#[derive(Clone)]
struct AppState {
    db: DbPool,
    config: Arc<Config>,
}

// Let `State<DbPool>` be pulled out of `AppState`:
impl FromRef<AppState> for DbPool {
    fn from_ref(app: &AppState) -> DbPool { app.db.clone() }
}

// This handler only asks for the DB, not the whole state:
async fn list(State(db): State<DbPool>) { /* ... */ }
```

> [!note] `State` vs `Extension`
> Both share data with handlers. Prefer **`State`** — it's type-checked at compile time, so a missing state is a *build* error. **`Extension<T>`** looks up a value at runtime (from a type map) and 500s if it's absent; use it mainly when *middleware* needs to inject request-scoped data (a request ID, the authenticated user) that later handlers read.

## Middleware and the tower stack

axum is built on **`tower`**, an ecosystem of composable `Service`s and middleware `Layer`s shared across the Rust HTTP world (hyper, tonic, reqwest all use it). You add cross-cutting behavior by stacking **layers** onto a router — you rarely hand-write logging, CORS, or timeouts.

Layers wrap the router like an **onion**: a request travels *inward* through each layer to the handler, and the response travels *outward* through them in reverse. The layer added **last** (outermost) sees the request **first**.

<figure class="diagram">
<svg viewBox="0 0 620 300" role="img" aria-label="Middleware layers wrap the handler like an onion: a request passes inward through TraceLayer, CORS, Timeout, and Auth to reach the handler, and the response passes back outward in reverse order">
  <style>
    .ml-t { font: 700 12px var(--font-sans); }
    .ml-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .l1 { fill: var(--rust-100);  stroke: var(--rust-400);  stroke-width: 1.4; }
    .l2 { fill: var(--amber-soft); stroke: var(--amber);     stroke-width: 1.4; }
    .l3 { fill: var(--blue-soft);  stroke: var(--blue);      stroke-width: 1.4; }
    .l4 { fill: var(--purple-soft);stroke: var(--purple);    stroke-width: 1.4; }
    .lc { fill: var(--green-soft); stroke: var(--green);     stroke-width: 1.6; }
  </style>
  <rect x="60"  y="30"  width="500" height="240" rx="14" class="l1"/>
  <text x="72"  y="50" class="ml-t" fill="var(--rust-700)">TraceLayer (logging)</text>
  <rect x="110" y="66"  width="400" height="168" rx="12" class="l2"/>
  <text x="122" y="86" class="ml-t" fill="var(--amber)">CorsLayer</text>
  <rect x="160" y="102" width="300" height="96"  rx="10" class="l3"/>
  <text x="172" y="122" class="ml-t" fill="var(--blue)">TimeoutLayer</text>
  <rect x="210" y="138" width="200" height="24"  rx="8"  class="l4"/>
  <text x="222" y="155" class="ml-t" fill="var(--purple)">Auth middleware</text>
  <rect x="248" y="168" width="124" height="22"  rx="7"  class="lc"/>
  <text x="310" y="184" text-anchor="middle" class="ml-t" fill="var(--green)">handler</text>
  <text x="18" y="150" class="ml-c" transform="rotate(-90 18 150)">request →</text>
  <text x="602" y="150" class="ml-c" transform="rotate(90 602 150)">← response</text>
  <text x="60" y="292" class="ml-c">Added last = outermost = runs first. Response unwinds in reverse.</text>
</svg>
<figcaption>Each <code>.layer(...)</code> wraps everything before it. The <b>outermost</b> layer sees the request first and the response last.</figcaption>
</figure>

### Ready-made layers from `tower-http`

```rust,ignore
// Cargo.toml: tower-http = { version = "0.5", features = ["trace","cors","compression-br","timeout"] }
use std::time::Duration;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

fn app() -> Router {
    Router::new()
        .route("/", get(hello))
        // Innermost first in source, but remember: the LAST .layer is outermost.
        .layer(TimeoutLayer::new(Duration::from_secs(10)))
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http()) // outermost → logs every request
}
```

### Writing custom middleware

For app-specific logic, `middleware::from_fn` turns an async function into a layer. It receives the `Request` and a `Next` handle; call `next.run(req).await` to continue the chain:

```rust,ignore
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

// A simple API-key gate. `from_fn_with_state` gives it access to State.
async fn require_api_key(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ok = req
        .headers()
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .map(|k| k == state.api_key)
        .unwrap_or(false);

    if ok {
        Ok(next.run(req).await) // continue to the handler
    } else {
        Err(StatusCode::UNAUTHORIZED) // short-circuit with 401
    }
}

// router.layer(axum::middleware::from_fn_with_state(state.clone(), require_api_key))
```

## Production concerns, briefly

The pieces every real service needs. Reach for them as required.

**Graceful shutdown** — finish in-flight requests when the process is asked to stop:

```rust,ignore
async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.expect("failed to install Ctrl+C handler");
    println!("shutting down gracefully…");
}

// axum::serve(listener, app).with_graceful_shutdown(shutdown_signal()).await.unwrap();
```

**Serving static files** with a `tower-http` service:

```rust,ignore
use tower_http::services::ServeDir;
Router::new().nest_service("/assets", ServeDir::new("assets")); // serves ./assets/*
```

**Server-Sent Events (SSE)** for one-way streaming (live dashboards, logs):

```rust,ignore
use axum::response::sse::{Event, Sse};
use futures::stream::{self, Stream};
use std::convert::Infallible;

async fn events() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = stream::repeat_with(|| Ok(Event::default().data("tick")));
    Sse::new(stream)
}
```

**WebSockets** for full-duplex communication:

```rust,ignore
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;

async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(Ok(Message::Text(text))) = socket.recv().await {
        let _ = socket.send(Message::Text(format!("echo: {text}"))).await;
    }
}
```

**Testing handlers** without a network — a `Router` is a tower `Service`, so drive it with `oneshot`:

```rust,ignore
use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt; // brings `.oneshot`

#[tokio::test]
async fn health_returns_200() {
    let app = app();
    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
```

> [!tip] The rest of a real web stack
> A production axum service usually pairs with: **serde** (JSON), **sqlx**/`sea-orm` ([databases](#/ch/sqlx)), **tracing** ([structured logging](#/ch/tracing)), **tower-http** (middleware), and **thiserror/anyhow** for errors mapped to HTTP via `IntoResponse`. axum is the router at the center; these fill in around it.

## How axum works internally

Before you build the project, it's worth seeing what axum *is* underneath — because once you see it, the whole framework stops feeling magical and starts feeling inevitable. Everything reduces to **one trait from tower**:

```rust,ignore
// The essence of tower::Service — an async function from Request to Response:
trait Service<Request> {
    type Response;
    type Error;
    fn call(&mut self, req: Request) -> impl Future<Output = Result<Self::Response, Self::Error>>;
}
```

A `Router` is a `Service`. A middleware `Layer` wraps one `Service` to produce another `Service`. A handler is turned *into* a `Service`. hyper drives the whole thing by calling `.call(request)` for each connection. That's the entire architecture.

### The request lifecycle, end to end

<figure class="diagram">
<svg viewBox="0 0 720 300" role="img" aria-label="A request flows from hyper through the tower layer stack, into the router which matches the path, through extractors into the handler, whose return value becomes a response via IntoResponse and flows back out through the layers to hyper">
  <style>
    .li-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .li-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .li-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .n-hy { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.4; }
    .n-ly { fill: var(--rust-100);   stroke: var(--rust-400);      stroke-width: 1.4; }
    .n-rt { fill: var(--amber-soft);  stroke: var(--amber);         stroke-width: 1.4; }
    .n-ex { fill: var(--blue-soft);   stroke: var(--blue);          stroke-width: 1.4; }
    .n-hd { fill: var(--green-soft);  stroke: var(--green);         stroke-width: 1.6; }
    .n-rs { fill: var(--purple-soft); stroke: var(--purple);        stroke-width: 1.4; }
  </style>
  <text x="10" y="20" class="li-h">Request path (top) → · Response path (bottom) ←</text>
  <!-- forward row -->
  <rect x="10"  y="36" width="96"  height="46" rx="8" class="n-hy"/><text x="24" y="56" class="li-b">hyper</text><text x="24" y="72" class="li-c">HTTP/1&amp;2</text>
  <rect x="122" y="36" width="120" height="46" rx="8" class="n-ly"/><text x="134" y="56" class="li-b">tower Layers</text><text x="134" y="72" class="li-c">trace/cors/…</text>
  <rect x="258" y="36" width="110" height="46" rx="8" class="n-rt"/><text x="270" y="56" class="li-b">Router</text><text x="270" y="72" class="li-c">matchit tree</text>
  <rect x="384" y="36" width="130" height="46" rx="8" class="n-ex"/><text x="396" y="56" class="li-b">Extractors</text><text x="396" y="72" class="li-c">FromRequest*</text>
  <rect x="530" y="36" width="180" height="46" rx="8" class="n-hd"/><text x="542" y="56" class="li-b">async fn handler</text><text x="542" y="72" class="li-c">your code runs</text>
  <path d="M106 59 L120 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M242 59 L256 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M368 59 L382 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M514 59 L528 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <!-- down -->
  <path d="M620 82 L620 120" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="628" y="106" class="li-c">return value</text>
  <!-- backward row -->
  <rect x="530" y="126" width="180" height="46" rx="8" class="n-rs"/><text x="542" y="146" class="li-b">IntoResponse</text><text x="542" y="162" class="li-c">→ Response&lt;Body&gt;</text>
  <rect x="258" y="126" width="256" height="46" rx="8" class="n-ly"/><text x="270" y="146" class="li-b">Layers (unwind, reverse order)</text>
  <rect x="10"  y="126" width="96"  height="46" rx="8" class="n-hy"/><text x="24" y="146" class="li-b">hyper</text><text x="24" y="162" class="li-c">writes bytes</text>
  <path d="M528 149 L516 149" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M256 149 L108 149" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="10" y="200" class="li-c">1. hyper accepts a connection and calls the outermost Service with the request.</text>
  <text x="10" y="218" class="li-c">2. Each layer may inspect/modify the request, then delegates inward (or short-circuits, like Auth → 401).</text>
  <text x="10" y="236" class="li-c">3. The Router matches method+path and picks the handler's Service.</text>
  <text x="10" y="254" class="li-c">4. Extractors run in order (head extractors, then the one body extractor) to build the handler's arguments.</text>
  <text x="10" y="272" class="li-c">5. The handler returns; IntoResponse builds a Response; it unwinds back through the layers to hyper.</text>
  <defs><marker id="lia" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The full pipeline: hyper → layers → router → extractors → handler → <code>IntoResponse</code> → layers → hyper.</figcaption>
</figure>

### How a plain function becomes a `Service`

You never implement `Service` for your handlers — axum does it for you through the **`Handler` trait**, which is implemented for every async function taking 0 to 16 extractor arguments. A macro generates one impl per arity. The trait's job is to:

1. Split the incoming `Request` into its **head (`Parts`)** and its **body**.
2. Run each argument's extractor to build the arguments tuple.
3. `.await` your function.
4. Call `IntoResponse` on the result.

This is also why the **body-must-be-last** rule exists — and it's enforced by the type system:

<figure class="diagram">
<svg viewBox="0 0 700 250" role="img" aria-label="A request is split into Parts (head) and Body. FromRequestParts extractors read only the head and can appear many times; a single FromRequest extractor consumes the body and must be the last argument">
  <style>
    .fr-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .fr-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .fr-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .req { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.5; }
    .parts { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .body  { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <rect x="10" y="20" width="150" height="50" rx="8" class="req"/>
  <text x="24" y="42" class="fr-h">Request</text><text x="24" y="60" class="fr-c">head + body</text>
  <path d="M160 38 L210 30" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#fra)"/>
  <path d="M160 52 L210 150" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#fra)"/>
  <rect x="212" y="14" width="180" height="34" rx="7" class="parts"/>
  <text x="224" y="36" class="fr-b">Parts (method, uri, headers)</text>
  <text x="212" y="66" class="fr-c">FromRequestParts — read-only, run MANY, in order:</text>
  <rect x="212" y="76"  width="86" height="26" rx="6" class="parts"/><text x="224" y="93" class="fr-b">Path</text>
  <rect x="304" y="76"  width="86" height="26" rx="6" class="parts"/><text x="316" y="93" class="fr-b">Query</text>
  <rect x="396" y="76"  width="86" height="26" rx="6" class="parts"/><text x="408" y="93" class="fr-b">State</text>
  <rect x="488" y="76"  width="110" height="26" rx="6" class="parts"/><text x="500" y="93" class="fr-b">AuthToken</text>
  <rect x="212" y="140" width="180" height="34" rx="7" class="body"/>
  <text x="224" y="162" class="fr-b">Body (byte stream)</text>
  <text x="212" y="194" class="fr-c">FromRequest — consumes the body, exactly ONE, must be LAST:</text>
  <rect x="212" y="204" width="80"  height="26" rx="6" class="body"/><text x="224" y="221" class="fr-b">Json</text>
  <rect x="298" y="204" width="80"  height="26" rx="6" class="body"/><text x="310" y="221" class="fr-b">Form</text>
  <rect x="384" y="204" width="90"  height="26" rx="6" class="body"/><text x="396" y="221" class="fr-b">Bytes</text>
  <rect x="480" y="204" width="90"  height="26" rx="6" class="body"/><text x="492" y="221" class="fr-b">String</text>
  <defs><marker id="fra" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Head extractors (<code>FromRequestParts</code>) can appear any number of times; the single body extractor (<code>FromRequest</code>) consumes the stream and must come last.</figcaption>
</figure>

> [!deep] Why this design is fast *and* safe
> Because handlers compile down to concrete `Service`s and extractors are resolved by **type**, axum does its wiring at **compile time** — there's no runtime router reflection or dynamic dispatch on the hot path (unless you opt into `dyn`). The `Request`/`Response` types are hyper's own, so there's zero conversion overhead. And the parts/body split is encoded in the trait bounds, so "I tried to read the body twice" or "my body extractor isn't last" become **compiler errors**, not production surprises. This is the Rust philosophy applied to web servers: push mistakes to compile time, pay nothing at runtime.

## Project: an e-commerce admin analytics API

Time to put it all together. You'll build the backend for an **admin analytics dashboard** — the kind that powers the "Overview" screen of a store's admin panel: total revenue, top products, revenue over time, and customer breakdowns. It exercises **everything** in this chapter: nested routing, path/query/JSON extractors, typed responses, a custom error type, shared state, an auth middleware, tracing, CORS, timeouts, and graceful shutdown.

We keep the data **in memory** (a seeded `Vec<Order>` behind an `RwLock`) so the project runs with no database — but the code is structured exactly as it would be with a real pool, so swapping in [sqlx](#/ch/sqlx) later is mechanical.

<figure class="diagram">
<svg viewBox="0 0 700 220" role="img" aria-label="Architecture of the analytics API: the client's request passes through a middleware stack of tracing, CORS, timeout, and API-key auth into a nested API router, whose handlers read the in-memory order store and compute analytics returned as JSON">
  <style>
    .pa-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .pa-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pa-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .cli { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.4; }
    .mw  { fill: var(--rust-100);   stroke: var(--rust-400);      stroke-width: 1.4; }
    .rtr { fill: var(--amber-soft);  stroke: var(--amber);         stroke-width: 1.4; }
    .hnd { fill: var(--green-soft);  stroke: var(--green);         stroke-width: 1.4; }
    .st  { fill: var(--blue-soft);   stroke: var(--blue);          stroke-width: 1.4; }
  </style>
  <rect x="10"  y="80" width="90"  height="46" rx="8" class="cli"/><text x="26" y="103" class="pa-b">Admin UI</text><text x="26" y="119" class="pa-c">browser</text>
  <rect x="120" y="66" width="150" height="74" rx="8" class="mw"/>
  <text x="132" y="86" class="pa-h" fill="var(--rust-700)">middleware</text>
  <text x="132" y="104" class="pa-c">Trace · CORS</text>
  <text x="132" y="120" class="pa-c">Timeout · API-key</text>
  <rect x="290" y="66" width="140" height="74" rx="8" class="rtr"/>
  <text x="302" y="86" class="pa-h" fill="var(--amber)">/api router</text>
  <text x="302" y="104" class="pa-c">overview · revenue</text>
  <text x="302" y="120" class="pa-c">top-products · orders</text>
  <rect x="450" y="66" width="140" height="74" rx="8" class="hnd"/>
  <text x="462" y="86" class="pa-h" fill="var(--green)">handlers</text>
  <text x="462" y="104" class="pa-c">extract + compute</text>
  <text x="462" y="120" class="pa-c">→ Json / AppError</text>
  <rect x="610" y="66" width="80"  height="74" rx="8" class="st"/>
  <text x="622" y="90" class="pa-h" fill="var(--blue)">State</text>
  <text x="622" y="108" class="pa-c">RwLock</text>
  <text x="622" y="124" class="pa-c">Vec&lt;Order&gt;</text>
  <path d="M100 103 L118 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M270 103 L288 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M430 103 L448 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M590 103 L608 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <text x="10" y="180" class="pa-c">/health is public; everything under /api requires the x-api-key header (checked by the auth middleware).</text>
  <defs><marker id="paa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The service: a middleware stack in front of a nested <code>/api</code> router whose handlers compute analytics over an in-memory order store.</figcaption>
</figure>

### Step 0 — the dependencies

```toml,ignore
# Cargo.toml
[package]
name = "admin-analytics"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tower = "0.4"
tower-http = { version = "0.5", features = ["trace", "cors", "timeout"] }
tracing = "0.1"
tracing-subscriber = "0.1"
```

### Step 1 — the analytics core (this block RUNS)

The heart of the service is pure logic over a list of orders — no web framework involved. This is the one block you can execute right here with **▶ Run**, so you can see the aggregation working before wrapping it in HTTP:

```rust
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct Order {
    id: u32,
    customer: String,
    product: String,
    category: String,
    amount_cents: u64,
    day: u32, // day index 1..=N (a stand-in for a real timestamp)
}

fn seed() -> Vec<Order> {
    let rows = [
        (1, "alice", "Keyboard", "Electronics", 4999, 1),
        (2, "bob",   "Mouse",    "Electronics", 2599, 1),
        (3, "alice", "Desk",     "Furniture",   18900, 2),
        (4, "carol", "Keyboard", "Electronics", 4999, 2),
        (5, "bob",   "Chair",    "Furniture",   9900, 3),
        (6, "dave",  "Monitor",  "Electronics", 14900, 3),
        (7, "alice", "Mouse",    "Electronics", 2599, 3),
    ];
    rows.iter()
        .map(|&(id, c, p, cat, amt, day)| Order {
            id, customer: c.into(), product: p.into(),
            category: cat.into(), amount_cents: amt, day,
        })
        .collect()
}

fn total_revenue(orders: &[Order]) -> u64 {
    orders.iter().map(|o| o.amount_cents).sum()
}

fn unique_customers(orders: &[Order]) -> usize {
    orders.iter().map(|o| o.customer.as_str()).collect::<HashSet<_>>().len()
}

/// Top products by revenue, highest first (ties broken by name for stable output).
fn top_products(orders: &[Order], limit: usize) -> Vec<(String, u64)> {
    let mut by_product: HashMap<&str, u64> = HashMap::new();
    for o in orders {
        *by_product.entry(o.product.as_str()).or_insert(0) += o.amount_cents;
    }
    let mut ranked: Vec<(String, u64)> =
        by_product.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    ranked.truncate(limit);
    ranked
}

/// Revenue per day, sorted by day — the time series a dashboard chart draws.
fn revenue_by_day(orders: &[Order]) -> Vec<(u32, u64)> {
    let mut by_day: HashMap<u32, u64> = HashMap::new();
    for o in orders {
        *by_day.entry(o.day).or_insert(0) += o.amount_cents;
    }
    let mut series: Vec<(u32, u64)> = by_day.into_iter().collect();
    series.sort_by_key(|&(day, _)| day);
    series
}

fn dollars(cents: u64) -> String {
    format!("${:.2}", cents as f64 / 100.0)
}

fn main() {
    let orders = seed();

    println!("=== Overview ===");
    println!("orders           : {}", orders.len());
    println!("total revenue    : {}", dollars(total_revenue(&orders)));
    println!("unique customers : {}", unique_customers(&orders));
    let avg = total_revenue(&orders) / orders.len() as u64;
    println!("avg order value  : {}", dollars(avg));

    println!("\n=== Top products ===");
    for (product, revenue) in top_products(&orders, 3) {
        println!("  {product:10} {}", dollars(revenue));
    }

    println!("\n=== Revenue by day ===");
    for (day, revenue) in revenue_by_day(&orders) {
        println!("  day {day}: {}", dollars(revenue));
    }
}
```

Run it and you get a full analytics report from plain Rust. **Everything below just exposes these functions over HTTP** — the hard part is already done and testable in isolation.

### Step 2 — models and shared state

```rust,ignore
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Clone, Serialize, Deserialize)]
struct Order {
    id: u32,
    customer: String,
    product: String,
    category: String,
    amount_cents: u64,
    day: u32,
}

/// Shared, cheaply-cloneable application state.
#[derive(Clone)]
struct AppState {
    orders: Arc<RwLock<Vec<Order>>>, // swap for a sqlx::PgPool in production
    api_key: String,
}
```

### Step 3 — one error type, mapped to HTTP

```rust,ignore
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

enum AppError {
    NotFound,
    BadRequest(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "order not found".to_string()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

### Step 4 — the analytics handlers

Each handler pulls what it needs with extractors, reads the store, computes, and returns JSON. Note the `Query` extractors with serde `default`s for pagination and limits, and the `?`/`AppError` flow on the lookup endpoint.

```rust,ignore
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Serialize)]
struct Overview {
    orders: usize,
    total_revenue_cents: u64,
    unique_customers: usize,
    avg_order_value_cents: u64,
}

async fn overview(State(state): State<AppState>) -> Json<Overview> {
    let orders = state.orders.read().unwrap();
    let total: u64 = orders.iter().map(|o| o.amount_cents).sum();
    let customers: HashSet<&str> = orders.iter().map(|o| o.customer.as_str()).collect();
    let count = orders.len();
    Json(Overview {
        orders: count,
        total_revenue_cents: total,
        unique_customers: customers.len(),
        avg_order_value_cents: if count == 0 { 0 } else { total / count as u64 },
    })
}

#[derive(Deserialize)]
struct TopQuery {
    #[serde(default = "default_limit")]
    limit: usize,
}
fn default_limit() -> usize { 5 }

#[derive(Serialize)]
struct ProductRevenue { product: String, revenue_cents: u64 }

async fn top_products(
    State(state): State<AppState>,
    Query(q): Query<TopQuery>,
) -> Json<Vec<ProductRevenue>> {
    let orders = state.orders.read().unwrap();
    let mut by_product: HashMap<&str, u64> = HashMap::new();
    for o in orders.iter() {
        *by_product.entry(o.product.as_str()).or_insert(0) += o.amount_cents;
    }
    let mut ranked: Vec<ProductRevenue> = by_product
        .into_iter()
        .map(|(p, revenue_cents)| ProductRevenue { product: p.to_string(), revenue_cents })
        .collect();
    ranked.sort_by(|a, b| b.revenue_cents.cmp(&a.revenue_cents).then(a.product.cmp(&b.product)));
    ranked.truncate(q.limit);
    Json(ranked)
}

#[derive(Deserialize)]
struct RangeQuery { from: Option<u32>, to: Option<u32> }

#[derive(Serialize)]
struct DayRevenue { day: u32, revenue_cents: u64 }

async fn revenue(
    State(state): State<AppState>,
    Query(range): Query<RangeQuery>,
) -> Json<Vec<DayRevenue>> {
    let orders = state.orders.read().unwrap();
    let from = range.from.unwrap_or(u32::MIN);
    let to = range.to.unwrap_or(u32::MAX);
    let mut by_day: HashMap<u32, u64> = HashMap::new();
    for o in orders.iter().filter(|o| o.day >= from && o.day <= to) {
        *by_day.entry(o.day).or_insert(0) += o.amount_cents;
    }
    let mut series: Vec<DayRevenue> =
        by_day.into_iter().map(|(day, revenue_cents)| DayRevenue { day, revenue_cents }).collect();
    series.sort_by_key(|d| d.day);
    Json(series)
}

// Path extractor + ? + AppError → clean 404 when the order is missing.
async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Result<Json<Order>, AppError> {
    let orders = state.orders.read().unwrap();
    let order = orders.iter().find(|o| o.id == id).cloned().ok_or(AppError::NotFound)?;
    Ok(Json(order))
}

// POST a new order (JSON body last!) — mutates shared state.
#[derive(Deserialize)]
struct NewOrder { customer: String, product: String, category: String, amount_cents: u64, day: u32 }

async fn ingest_order(
    State(state): State<AppState>,
    Json(new): Json<NewOrder>,
) -> Result<(StatusCode, Json<Order>), AppError> {
    if new.amount_cents == 0 {
        return Err(AppError::BadRequest("amount_cents must be > 0".into()));
    }
    let mut orders = state.orders.write().unwrap();
    let id = orders.iter().map(|o| o.id).max().unwrap_or(0) + 1;
    let order = Order {
        id, customer: new.customer, product: new.product,
        category: new.category, amount_cents: new.amount_cents, day: new.day,
    };
    orders.push(order.clone());
    Ok((StatusCode::CREATED, Json(order)))
}
```

### Step 5 — auth middleware

```rust,ignore
use axum::{extract::{Request, State}, http::StatusCode, middleware::Next, response::Response};

async fn require_api_key(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let provided = req.headers().get("x-api-key").and_then(|v| v.to_str().ok());
    match provided {
        Some(key) if key == state.api_key => Ok(next.run(req).await),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}
```

### Step 6 — assemble the router and run

```rust,ignore
use axum::{
    routing::{get, post},
    Router,
};
use std::{sync::{Arc, RwLock}, time::Duration};
use tower_http::{cors::CorsLayer, timeout::TimeoutLayer, trace::TraceLayer};

fn api_router(state: AppState) -> Router {
    Router::new()
        .route("/analytics/overview", get(overview))
        .route("/analytics/top-products", get(top_products))
        .route("/analytics/revenue", get(revenue))
        .route("/orders", post(ingest_order))
        .route("/orders/:id", get(get_order))
        // Guard the whole /api subtree with the API-key middleware:
        .layer(axum::middleware::from_fn_with_state(state.clone(), require_api_key))
        .with_state(state)
}

fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" })) // public, no auth
        .nest("/api", api_router(state))
        // Global middleware stack (outermost is added last):
        .layer(TimeoutLayer::new(Duration::from_secs(10)))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init(); // TraceLayer logs go here

    let state = AppState {
        orders: Arc::new(RwLock::new(seed_orders())),
        api_key: std::env::var("API_KEY").unwrap_or_else(|_| "dev-secret".into()),
    };

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tracing::info!("analytics API on http://localhost:3000");

    axum::serve(listener, app(state))
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("shutting down");
        })
        .await
        .unwrap();
}

fn seed_orders() -> Vec<Order> {
    // ... same rows as the runnable core in Step 1 ...
    Vec::new()
}
```

Try it locally:

```bash,ignore
# Public health check — no key needed:
curl localhost:3000/health

# Protected analytics — must send the key:
curl -H "x-api-key: dev-secret" localhost:3000/api/analytics/overview
curl -H "x-api-key: dev-secret" "localhost:3000/api/analytics/top-products?limit=3"
curl -H "x-api-key: dev-secret" "localhost:3000/api/analytics/revenue?from=2&to=3"

# Ingest a new order:
curl -X POST -H "x-api-key: dev-secret" -H "content-type: application/json" \
     -d '{"customer":"eve","product":"Webcam","category":"Electronics","amount_cents":7900,"day":3}' \
     localhost:3000/api/orders
```

### What you just practiced

| Feature | Where it appears |
|---|---|
| Nested routers, method routers | `nest("/api", …)`, `get`/`post` |
| Path / Query / Json / State extractors | every handler |
| Body-extractor-last rule | `ingest_order(State, Json)` |
| Typed JSON responses with serde | `Overview`, `ProductRevenue`, … |
| Custom error type → HTTP via `IntoResponse` | `AppError` + `?` in `get_order` |
| Shared, mutable state | `Arc<RwLock<Vec<Order>>>` |
| State-aware custom middleware | `require_api_key` |
| tower-http layers | Trace, CORS, Timeout |
| Graceful shutdown | `with_graceful_shutdown` |

## Summary

- **axum** is a tokio + hyper + tower web framework where **handlers are plain async functions** — no special traits or macros to write.
- A **`Router`** maps method + path to handlers and **composes** via `nest`, `merge`, and `fallback`.
- **Extractors** pull typed data from the request; head extractors can appear many times, the one **body extractor must be last**, and you can write your own via `FromRequestParts`.
- Return any **`IntoResponse`** type; centralize failures in **one error enum** that implements `IntoResponse` and let `?` convert into it.
- Share resources with **`.with_state`** + `State` (split it with `FromRef`); add cross-cutting behavior by stacking **tower/`tower-http` layers** and `middleware::from_fn`.
- **Internally**, everything is a tower **`Service`**: layers wrap services, the router is a service, and handlers are turned into services — so wiring happens at compile time with zero runtime reflection.
- You built a complete **e-commerce admin analytics API** exercising the whole chapter, with a runnable pure-Rust core at its heart.

> [!exercise] Take the project further
> 1. Add `GET /api/analytics/top-categories` (group by `category` instead of `product`).
> 2. Add pagination to a new `GET /api/customers` endpoint using `page` / `per_page` query params with serde defaults.
> 3. Replace the in-memory `Vec` with [sqlx](#/ch/sqlx) and a real database — notice how *only* the state and handler bodies change; the routing and middleware stay identical.
> 4. Write a `#[tokio::test]` that uses `oneshot` to assert `/api/analytics/overview` returns `401` without the key and `200` with it.
> 5. Add `POST /api/orders/import` that accepts a **CSV file upload** via `Multipart`, parses each row into an `Order`, and bulk-inserts them — cap the upload at 5 MB with `DefaultBodyLimit`.

axum is one of the two leading Rust web frameworks. The next chapter covers the other — **Actix Web** — with the same depth and the same capstone project, so you can compare them side by side.
