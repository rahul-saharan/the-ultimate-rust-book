<h1><span class="h1-kicker">The Crate Ecosystem</span>Actix Web: Building Web Servers</h1>

**Actix Web** is the other heavyweight of production Rust web development. Alongside [axum](#/ch/axum) it consistently tops the throughput benchmarks, and it's battle-tested in large deployments. Where axum builds on `tower`, Actix Web has its own service/middleware stack (`actix-service`) and a distinctive **multi-worker threading model** inherited from its actor-framework roots — but you write plain `async fn` handlers, just like axum.

This chapter matches the depth of the axum one so you can compare them directly. We cover routing, every extractor, request bodies (including file uploads), responses and the `Responder`/`ResponseError` traits, shared state, the middleware stack, and the production concerns. Then — **before the project** — we open the hood and show how Actix Web works internally, with diagrams, focusing on the worker model that makes it fast. Finally you'll build the same **e-commerce admin analytics API** you built for axum, so the two frameworks stand side by side.

> [!note] Servers don't run in the in-book playground
> An Actix server binds a socket and runs forever, so "▶ Run" can't execute these examples — they're marked `ignore`, to be run **locally** with `cargo run`. One block in the capstone (the pure-Rust analytics core) *is* runnable, so you can execute the real aggregation logic in the book.

## Five ideas every Rust web framework shares

Every Rust web framework — Actix Web, [axum](#/ch/axum), and [Rocket](#/ch/rocket) — rebuilds the same five ideas, just with different names. If you've read the [axum chapter](#/ch/axum) first, this table is your dictionary; if you're starting here, it's your map for the rest of the ecosystem:

| Concept | The problem it solves | Actix Web's name |
|---|---|---|
| **Handler** | turn a plain function into something that answers a request | any `async fn` |
| **Router** | map an incoming method + path to a handler | `App` (routes) served by `HttpServer` |
| **Extractor** | pull typed data (path, query, JSON, state, …) out of a request | types implementing `FromRequest` |
| **Response trait** | let a handler return *anything* and still produce an HTTP response | `Responder` (failures: `ResponseError`) |
| **Middleware** | wrap cross-cutting behavior (logging, auth, CORS) around handlers | a `Transform`, applied with `.wrap(...)` |

> [!tip] Same five ideas, different spelling
> axum calls the response trait **`IntoResponse`** and middleware a **`tower::Layer`**; [Rocket](#/ch/rocket) calls extractors **request guards** and middleware a **`Fairing`**. Once you've internalized "a function handles a route, typed data comes from the request, the return value becomes the response," every Rust web framework you meet after these three is a variation on the same five-part shape.

> [!key] Actix Web vs. axum — how to choose
> Both are excellent, tokio-based, and extremely fast. **axum** is minimal, `tower`-native, and composes with the wider tower ecosystem (used by tonic, hyper, reqwest). **Actix Web** is more batteries-included (built-in logger, sessions, static files, its own powerful extractor/middleware system) and has a longer track record at scale. Pick axum for tower interop and a smaller surface; pick Actix Web for a rich built-in toolkit and its worker model. The *concepts* — handlers, extractors, responders, middleware — map almost one-to-one.

## Hello, Actix Web

An Actix app is an **`App`** (routes + shared data + middleware) served by an **`HttpServer`**. The `#[actix_web::main]` macro sets up the async runtime (Actix runs on tokio):

```rust,ignore
// Cargo.toml:
//   actix-web = "4"

use actix_web::{get, App, HttpServer, Responder};

#[get("/")]                          // attribute routing: GET /
async fn hello() -> impl Responder {
    "Hello, Actix!"
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(hello)     // register the handler
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

Visit `http://127.0.0.1:8080` and you get "Hello, Actix!". Notice the closure passed to `HttpServer::new` — it's an **app factory** that Actix calls **once per worker thread**. Hold that thought; it's central to how Actix works (and to a common state bug we'll cover).

> [!key] Handlers are ordinary async functions
> Like axum, an Actix handler is just an `async fn` whose parameters are **extractors** and whose return value implements **`Responder`**. No handler trait to implement — the `#[get(...)]` macro (or an explicit `.route(...)`) wires it up.

## Routing: `App`, scopes, and paths

You register routes two ways: **attribute macros** (`#[get("/path")]` + `.service(...)`) or the **fluent API** (`.route("/path", web::get().to(handler))`). Both compile to the same thing.

```rust,ignore
use actix_web::{get, post, web, App, HttpResponse, Responder};

#[get("/products")]
async fn list_products() -> impl Responder { HttpResponse::Ok().body("all products") }

#[post("/products")]
async fn create_product() -> impl Responder { HttpResponse::Created().finish() }

// Fluent equivalent, and one path with several methods:
fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("/health", web::get().to(|| async { "ok" }))
       .route("/products/{id}", web::get().to(get_product).delete(delete_product));
}
```

### Path parameters and wildcards

A segment in `{braces}` is a capture; `{tail:.*}` captures the rest. Extract with `web::Path`:

```rust,ignore
#[get("/users/{id}")]
async fn get_user(path: web::Path<u32>) -> String {
    format!("fetching user {}", path.into_inner())
}

#[get("/users/{id}/posts/{post_id}")]
async fn get_post(path: web::Path<(u32, u32)>) -> String {
    let (id, post_id) = path.into_inner();     // multiple params → a tuple
    format!("user {id}, post {post_id}")
}

#[get("/files/{path:.*}")]
async fn serve(path: web::Path<String>) -> String {
    format!("serving {}", path.into_inner())    // /files/a/b/c.txt → "a/b/c.txt"
}
```

### Scopes — grouping and versioning routes

`web::scope(prefix)` mounts a group of routes under a common path prefix — the idiomatic way to version and organize an API:

```rust,ignore
use actix_web::{web, App};

App::new()
    .route("/health", web::get().to(health))          // public
    .service(
        web::scope("/api/v1")                          // → /api/v1/products, /api/v1/orders
            .service(list_products)
            .service(list_orders),
    );
```

> [!tip] Route registration order *can* matter
> Unlike axum's tree matcher, Actix matches routes in **registration order** and takes the first that fits. Register more specific routes **before** catch-alls, and put a `default_service` last for your 404. This is a common gotcha when a broad pattern accidentally shadows a specific one.

## Extractors: getting data from the request

An **extractor** is a handler parameter Actix fills in from the request. Declare the type you want; Actix parses it and returns a clean `400`/`404` automatically if it fails. A handler may take **several** extractors (up to 12), as separate parameters.

```rust,ignore
use actix_web::{get, post, web, Responder};
use serde::Deserialize;

// Path parameter:
#[get("/users/{id}")]
async fn get_user(path: web::Path<u32>) -> String {
    format!("user {}", path.into_inner())
}

// Query string: /search?q=rust&page=2
#[derive(Deserialize)]
struct SearchParams { q: String, page: Option<u32> }

#[get("/search")]
async fn search(query: web::Query<SearchParams>) -> String {
    format!("'{}' page {}", query.q, query.page.unwrap_or(1))
}

// JSON body → deserialized into a struct:
#[derive(Deserialize)]
struct NewUser { name: String }

#[post("/users")]
async fn create_user(body: web::Json<NewUser>) -> String {
    format!("created {}", body.name)
}
```

The built-in extractor toolbox:

| Extractor | Pulls from the request… | Notes |
|-----------|--------------------------|-------|
| `web::Path<T>` | URL path segments (`/users/{id}`) | tuple for multiple |
| `web::Query<T>` | the query string (`?q=…`) | serde-deserialized |
| `web::Json<T>` | a JSON **body** | body-consuming; size-limited |
| `web::Form<T>` | a URL-encoded form body | body-consuming |
| `Multipart` | file uploads + fields | `actix-multipart` crate |
| `web::Data<T>` | shared application state | see State below |
| `web::Bytes` | the raw body as bytes | body-consuming |
| `web::Payload` | the raw body **stream** | body-consuming; for large uploads |
| `HttpRequest` | the whole request (headers, etc.) | read-only metadata |

> [!note] Extractors are `FromRequest` implementers
> Every extractor implements the **`FromRequest`** trait, which runs *before* your handler to build that argument from the request. You can implement `FromRequest` yourself for a custom extractor — the standard way to model authentication (pull and validate a token), a request ID, or a tenant — so your handler just declares `auth: Auth` and gets a validated value.

### Debugging handler and extractor errors

The most common Actix compile error is some variant of "the trait `Handler<_, _, _>` is not implemented for..." — it shows up when a handler's return type doesn't implement `Responder`, or an argument doesn't implement `FromRequest`. Unlike axum, Actix has no `#[debug_handler]` macro, but the same divide-and-conquer trick always works: temporarily change the return type to a concrete `HttpResponse` and strip the arguments down to one at a time until the error disappears — whichever piece you removed last was the culprit.

```rust,ignore
// Doesn't compile, and the error is long and generic:
// async fn broken(a: web::Json<A>, b: web::Path<u32>) -> impl Responder { ... }

// Step 1: pin the return type down.
async fn broken(a: web::Json<A>, b: web::Path<u32>) -> HttpResponse { todo!() }
// Step 2: if that alone fixes it, the problem was your Responder impl (or lack of one).
// If not, remove arguments one at a time — the one whose removal fixes it doesn't implement FromRequest.
```

### Customizing extractor error responses

By default, a failed `web::Json`/`web::Query`/`web::Path` extraction produces Actix's built-in `400 Bad Request` with a plain-text description. For a JSON API you usually want that in your app's own error shape — register an **`error_handler`** on the extractor's config to rewrite it:

```rust,ignore
use actix_web::{error::InternalError, web, App, HttpResponse};
use serde_json::json;

let json_cfg = web::JsonConfig::default().error_handler(|err, _req| {
    // Wrap the default rejection in the app's own { "error": "..." } shape.
    let response = HttpResponse::BadRequest().json(json!({ "error": err.to_string() }));
    InternalError::from_response(err, response).into()
});

// App::new().app_data(json_cfg)...
```

> [!note] Most apps don't need this
> The default rejection bodies are fine for internal services and early APIs. Reach for a custom `error_handler` only once a *public* API needs every failure mode — including malformed request bodies, not just handler-level errors — in one consistent shape, matching the `AppError`/`ResponseError` pattern from [Error handling](#/ch/actix) below.

## Request bodies — JSON, forms, files, raw & streams

A body can be JSON, an HTML form, an uploaded **file**, or a large stream. Each shape has its own extractor; all consume the request payload.

### Forms

```rust,ignore
use actix_web::{post, web};
use serde::Deserialize;

#[derive(Deserialize)]
struct LoginForm { username: String, password: String }

#[post("/login")]
async fn login(form: web::Form<LoginForm>) -> String {
    format!("logging in {}", form.username)     // application/x-www-form-urlencoded
}
```

### File uploads with `Multipart`

`multipart/form-data` bodies (how browsers upload files) stream in as a sequence of **fields**, each an async stream of bytes. Use the `actix-multipart` crate:

```rust,ignore
// Cargo.toml: actix-multipart = "0.7"  futures-util = "0.3"
use actix_multipart::Multipart;
use actix_web::{post, Error, HttpResponse};
use futures_util::StreamExt;

#[post("/upload")]
async fn upload(mut payload: Multipart) -> Result<HttpResponse, Error> {
    let mut report = String::new();
    // Iterate the fields:
    while let Some(item) = payload.next().await {
        let mut field = item?;
        let name = field.name().unwrap_or("unnamed").to_string();
        let filename = field.content_disposition().and_then(|cd| cd.get_filename().map(String::from));

        // Read this field's bytes chunk by chunk:
        let mut size = 0usize;
        while let Some(chunk) = field.next().await {
            size += chunk?.len();
        }
        match filename {
            Some(f) => report.push_str(&format!("file '{name}': {f} — {size} bytes\n")),
            None => report.push_str(&format!("text field '{name}' — {size} bytes\n")),
        }
    }
    Ok(HttpResponse::Ok().body(report))
}
```

### Raw bytes and streaming huge bodies

```rust,ignore
use actix_web::{post, web, Error, HttpResponse};
use futures_util::StreamExt;

// Whole body buffered as bytes (webhooks, small blobs):
#[post("/raw")]
async fn raw(body: web::Bytes) -> String {
    format!("received {} bytes", body.len())
}

// Stream a large upload without buffering it all in memory:
#[post("/upload-stream")]
async fn upload_stream(mut payload: web::Payload) -> Result<HttpResponse, Error> {
    let mut total = 0usize;
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        total += chunk.len();
        // write chunk to disk / hash it / parse it as it arrives…
    }
    Ok(HttpResponse::Ok().body(format!("streamed {total} bytes")))
}
```

> [!warning] Cap body sizes — configure the extractor
> `web::Json` defaults to a **256&nbsp;KB** limit; raise or lower it (and other extractor settings) by registering a config with `app_data`. Never accept unbounded uploads on a public endpoint:
> ```rust,ignore
> App::new().app_data(web::JsonConfig::default().limit(2 * 1024 * 1024)); // 2 MB JSON
> App::new().app_data(web::PayloadConfig::new(25 * 1024 * 1024));          // 25 MB raw
> ```

## Returning responses: `Responder` and `HttpResponse`

A handler returns anything implementing **`Responder`**. `HttpResponse` is the explicit builder; `web::Json<T>`, `String`, `&str`, and tuples with a status are responders too.

```rust,ignore
use actix_web::{get, web, HttpResponse, Responder};
use serde::Serialize;

#[derive(Serialize)]
struct User { id: u32, name: String }

#[get("/text")]
async fn text() -> impl Responder { "plain text → 200 OK" }

#[get("/json")]
async fn as_json() -> impl Responder {
    web::Json(User { id: 1, name: "Ferris".into() }) // application/json, 200
}

#[get("/built")]
async fn built() -> HttpResponse {
    HttpResponse::Created()
        .insert_header(("x-custom", "hi"))
        .json(User { id: 2, name: "Corro".into() })   // 201 + header + JSON body
}
```

| You return… | Actix produces… |
|---|---|
| `&str`, `String` | `200 OK`, `text/plain` |
| `web::Json<T>` | `200 OK`, `application/json` |
| `HttpResponse` | exactly what you built |
| `impl Responder` | whatever the responder makes |
| `Result<T, E: ResponseError>` | `Ok`→T, `Err`→the error's response |

## Error handling: `ResponseError`

Fallible handlers return a `Result`, and Actix turns the `Err` into an HTTP response via the **`ResponseError`** trait. The idiomatic pattern is one app-wide error enum implementing it — so handlers use `?` and every error maps to a proper response in one place.

```rust,ignore
use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde_json::json;
use std::fmt;

#[derive(Debug)]
enum AppError {
    NotFound,
    BadRequest(String),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::NotFound => write!(f, "resource not found"),
            AppError::BadRequest(m) | AppError::Internal(m) => write!(f, "{m}"),
        }
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
    fn error_response(&self) -> HttpResponse {
        // Consistent JSON error shape: { "error": "..." }
        HttpResponse::build(self.status_code()).json(json!({ "error": self.to_string() }))
    }
}

// Handlers now read like happy-path code; `?` produces the right response on error:
#[actix_web::get("/thing/{id}")]
async fn get_thing(path: actix_web::web::Path<u32>) -> Result<HttpResponse, AppError> {
    let _id = path.into_inner();
    Err(AppError::NotFound)
}
```

> [!best] One error type, mapped once
> As in axum, centralizing the HTTP mapping on a single `AppError` (often built with [`thiserror`](#/ch/custom-errors)) is the highest-value pattern for a maintainable service. Add `From` impls so `?` converts database/parse/validation errors into `AppError` automatically.

## Shared state with `web::Data`

Share a database pool, config, or cache across handlers by wrapping it in **`web::Data<T>`** (an `Arc` inside) and registering it with `.app_data(...)`. Handlers receive it via the `web::Data` extractor.

```rust,ignore
use actix_web::{get, web, App, HttpServer, Responder};
use std::sync::Mutex;

struct AppState {
    counter: Mutex<u64>,       // Mutex because handlers run concurrently
}

#[get("/count")]
async fn hit(data: web::Data<AppState>) -> impl Responder {
    let mut c = data.counter.lock().unwrap();
    *c += 1;
    format!("hit {c} times")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Build the shared state ONCE, outside the factory:
    let state = web::Data::new(AppState { counter: Mutex::new(0) });

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())   // clone the Arc handle into each worker
            .service(hit)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

> [!mistake] Don't create shared state *inside* the factory
> The app factory runs **once per worker thread**, so state built *inside* the closure gives each worker its **own** copy — your counter would be per-thread, not global. Always construct shared state **once outside**, wrap it in `web::Data` (which is an `Arc`), and `.clone()` the handle in. This is the single most common Actix state bug, and it flows directly from the worker model we'll see in the internals section.

## Middleware

Add cross-cutting behavior by **wrapping** the app (or a scope) with middleware via `.wrap(...)`. Middleware nests like an **onion**: a request travels inward through each layer to the handler; the response travels back outward in reverse. The layer added **last** (outermost) sees the request first.

<figure class="diagram">
<svg viewBox="0 0 620 300" role="img" aria-label="Actix middleware layers wrap the handler like an onion: a request passes inward through Logger, CORS, and an API-key check to reach the handler, and the response passes back outward in reverse order">
  <style>
    .ml-t { font: 700 12px var(--font-sans); }
    .ml-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .l1 { fill: var(--rust-100);   stroke: var(--rust-400);  stroke-width: 1.4; }
    .l2 { fill: var(--amber-soft);  stroke: var(--amber);     stroke-width: 1.4; }
    .l3 { fill: var(--purple-soft); stroke: var(--purple);    stroke-width: 1.4; }
    .lc { fill: var(--green-soft);  stroke: var(--green);     stroke-width: 1.6; }
  </style>
  <rect x="60"  y="30"  width="500" height="240" rx="14" class="l1"/>
  <text x="72"  y="50" class="ml-t" fill="var(--rust-700)">Logger (access log)</text>
  <rect x="120" y="66"  width="380" height="168" rx="12" class="l2"/>
  <text x="132" y="86" class="ml-t" fill="var(--amber)">Cors</text>
  <rect x="180" y="102" width="260" height="96"  rx="10" class="l3"/>
  <text x="192" y="122" class="ml-t" fill="var(--purple)">API-key check (from_fn)</text>
  <rect x="250" y="150" width="120" height="26"  rx="7"  class="lc"/>
  <text x="310" y="167" text-anchor="middle" class="ml-t" fill="var(--green)">handler</text>
  <text x="18" y="150" class="ml-c" transform="rotate(-90 18 150)">request →</text>
  <text x="602" y="150" class="ml-c" transform="rotate(90 602 150)">← response</text>
  <text x="60" y="292" class="ml-c">.wrap() added last = outermost = runs first. Response unwinds in reverse.</text>
</svg>
<figcaption>Each <code>.wrap(...)</code> wraps everything before it. The <b>outermost</b> layer sees the request first and the response last.</figcaption>
</figure>

### Built-in and community middleware

```rust,ignore
// Cargo.toml: actix-cors = "0.7"
use actix_web::{middleware::{Logger, Compress}, App};
use actix_cors::Cors;

App::new()
    .wrap(Logger::default())        // outermost → logs every request
    .wrap(Cors::permissive())
    .wrap(Compress::default());     // gzip/brotli responses
```

### Custom middleware with `from_fn`

For app-specific logic, `middleware::from_fn` turns an async function into middleware. It gets the `ServiceRequest` and a `Next` handle; call `next.call(req).await` to continue:

```rust,ignore
use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    error::ErrorUnauthorized,
    middleware::{from_fn, Next},
    web, Error,
};

async fn require_api_key(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    // Reach shared state from inside middleware via app_data:
    let expected = req.app_data::<web::Data<AppState>>().map(|d| d.api_key.clone());
    let provided = req.headers().get("x-api-key").and_then(|v| v.to_str().ok());

    match (expected, provided) {
        (Some(exp), Some(key)) if key == exp => next.call(req).await, // continue
        _ => Err(ErrorUnauthorized("invalid or missing api key")),    // short-circuit 401
    }
}

// Guard a scope: web::scope("/api").wrap(from_fn(require_api_key))
```

## Production concerns, briefly

**Graceful shutdown is automatic.** `HttpServer` installs `SIGINT`/`SIGTERM` handlers and drains in-flight requests before exiting; tune the window with `.shutdown_timeout(secs)`.

**Serving static files** with `actix-files`:

```rust,ignore
// Cargo.toml: actix-files = "0.6"
use actix_files::Files;
App::new().service(Files::new("/assets", "./assets").show_files_listing());
```

**WebSockets** with `actix-ws`, **sessions** with `actix-session`, **identity/auth** with `actix-identity` — Actix has a rich first-party ecosystem for these.

**Testing** handlers without a network — Actix has a built-in test harness:

```rust,ignore
use actix_web::{test, web, App};

#[actix_web::test]
async fn health_ok() {
    let app = test::init_service(
        App::new().route("/health", web::get().to(|| async { "ok" })),
    ).await;
    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}
```

## How Actix Web works internally

Before the project, let's see what Actix *is* underneath — especially the piece that makes it distinctive and fast: the **worker model**.

### Everything is a `Service`

Like tower, Actix is built on a `Service` trait: an async function from request to response. `App` is a `Service`. Middleware is a **`Transform`** that wraps one `Service` to produce another. Routing selects the handler's `Service`. Handlers become `Service`s automatically. Conceptually identical to axum's tower stack — different crate, same shape.

```rust,ignore
// The essence of actix_service::Service — an async request → response:
trait Service<Req> {
    type Response;
    type Error;
    fn call(&self, req: Req) -> impl Future<Output = Result<Self::Response, Self::Error>>;
}
```

### The worker model — Actix's signature design

Here's what sets Actix apart. `HttpServer` opens the listening socket, then spawns **N worker threads** (by default one per logical CPU). It calls your **app factory closure once per worker**, so each worker owns its **own independent copy** of the `App`, running its own single-threaded async event loop (an *Arbiter*). Incoming connections are distributed across workers. No lock is needed to route or handle a request, because each worker is self-contained — shared state is the *only* thing crossing threads (which is why it must be `Arc`-wrapped `web::Data`).

<figure class="diagram">
<svg viewBox="0 0 700 260" role="img" aria-label="HttpServer accepts connections on one socket and distributes them across N worker threads, each running its own copy of the App and its own event loop; all workers share the Arc-wrapped application state">
  <style>
    .wk-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .wk-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .wk-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .srv { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.5; }
    .wkr { fill: var(--amber-soft);  stroke: var(--amber);         stroke-width: 1.4; }
    .st  { fill: var(--blue-soft);   stroke: var(--blue);          stroke-width: 1.5; }
  </style>
  <rect x="270" y="14" width="160" height="46" rx="8" class="srv"/>
  <text x="284" y="34" class="wk-h">HttpServer</text>
  <text x="284" y="52" class="wk-c">one listening socket</text>
  <path d="M300 60 L150 96" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#wka)"/>
  <path d="M350 60 L350 96" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#wka)"/>
  <path d="M400 60 L560 96" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#wka)"/>
  <!-- workers -->
  <rect x="60"  y="98" width="180" height="70" rx="8" class="wkr"/>
  <text x="72" y="118" class="wk-b">worker 1</text><text x="72" y="136" class="wk-c">own App copy</text><text x="72" y="154" class="wk-c">own event loop</text>
  <rect x="260" y="98" width="180" height="70" rx="8" class="wkr"/>
  <text x="272" y="118" class="wk-b">worker 2</text><text x="272" y="136" class="wk-c">own App copy</text><text x="272" y="154" class="wk-c">own event loop</text>
  <rect x="460" y="98" width="180" height="70" rx="8" class="wkr"/>
  <text x="472" y="118" class="wk-b">worker N</text><text x="472" y="136" class="wk-c">own App copy</text><text x="472" y="154" class="wk-c">own event loop</text>
  <!-- shared state -->
  <path d="M150 168 L330 206" stroke="var(--blue)" stroke-width="1.3" marker-end="url(#wkb)"/>
  <path d="M350 168 L350 206" stroke="var(--blue)" stroke-width="1.3" marker-end="url(#wkb)"/>
  <path d="M550 168 L370 206" stroke="var(--blue)" stroke-width="1.3" marker-end="url(#wkb)"/>
  <rect x="250" y="208" width="200" height="42" rx="8" class="st"/>
  <text x="264" y="228" class="wk-h" fill="var(--blue)">web::Data&lt;AppState&gt;</text>
  <text x="264" y="244" class="wk-c">one Arc, shared by all workers</text>
  <defs><marker id="wka" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker><marker id="wkb" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker></defs>
</svg>
<figcaption>One socket, N self-contained workers each with its own <code>App</code> and event loop; only <code>web::Data</code> (an <code>Arc</code>) crosses threads.</figcaption>
</figure>

### The request lifecycle, end to end

<figure class="diagram">
<svg viewBox="0 0 720 250" role="img" aria-label="A request flows from a worker through the middleware chain, into routing, through FromRequest extractors into the handler, whose Responder becomes an HttpResponse that flows back out through the middleware">
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
  <rect x="10"  y="36" width="96"  height="46" rx="8" class="n-hy"/><text x="22" y="56" class="li-b">worker</text><text x="22" y="72" class="li-c">event loop</text>
  <rect x="122" y="36" width="120" height="46" rx="8" class="n-ly"/><text x="134" y="56" class="li-b">middleware</text><text x="134" y="72" class="li-c">Logger/Cors…</text>
  <rect x="258" y="36" width="110" height="46" rx="8" class="n-rt"/><text x="270" y="56" class="li-b">routing</text><text x="270" y="72" class="li-c">match path</text>
  <rect x="384" y="36" width="130" height="46" rx="8" class="n-ex"/><text x="396" y="56" class="li-b">extractors</text><text x="396" y="72" class="li-c">FromRequest</text>
  <rect x="530" y="36" width="180" height="46" rx="8" class="n-hd"/><text x="542" y="56" class="li-b">async fn handler</text><text x="542" y="72" class="li-c">your code runs</text>
  <path d="M106 59 L120 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M242 59 L256 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M368 59 L382 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M514 59 L528 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M620 82 L620 118" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="628" y="106" class="li-c">Responder</text>
  <rect x="530" y="124" width="180" height="44" rx="8" class="n-rs"/><text x="542" y="144" class="li-b">HttpResponse</text><text x="542" y="160" class="li-c">status + body</text>
  <rect x="122" y="124" width="392" height="44" rx="8" class="n-ly"/><text x="134" y="144" class="li-b">middleware (unwind, reverse order)</text>
  <rect x="10"  y="124" width="96"  height="44" rx="8" class="n-hy"/><text x="22" y="144" class="li-b">worker</text><text x="22" y="160" class="li-c">writes bytes</text>
  <path d="M528 146 L516 146" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M120 146 L108 146" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="10" y="196" class="li-c">1. A worker's event loop reads the request and calls its App service.</text>
  <text x="10" y="214" class="li-c">2. Middleware runs outer→inner (may short-circuit, e.g. API-key → 401); routing picks the handler.</text>
  <text x="10" y="232" class="li-c">3. FromRequest extractors build the args; the handler runs; its Responder → HttpResponse unwinds back out.</text>
  <defs><marker id="lia" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Within a worker: middleware → routing → <code>FromRequest</code> extractors → handler → <code>Responder</code> → <code>HttpResponse</code> → back out.</figcaption>
</figure>

> [!deep] Why the worker model is fast
> Because each worker is a **share-nothing** unit with its own event loop, the hot path — accept, route, extract, respond — touches **no cross-thread locks**. Contention only appears where you *choose* to share mutable state (`web::Data<Mutex<...>>`), so you pay synchronization cost exactly where you asked for it and nowhere else. Combined with compile-time routing/extraction (no reflection), this is why Actix and axum both sit at the top of the throughput charts.

## Project: an e-commerce admin analytics API

The same capstone you built with [axum](#/ch/axum) — an **admin analytics dashboard** backend (revenue, top products, revenue over time) — now in Actix Web, so you can compare them line for line. It exercises scopes, path/query/JSON extractors, typed responses, a custom `ResponseError`, `web::Data` state, an API-key middleware, a logger, CORS, and automatic graceful shutdown. Data stays **in memory** (a seeded `Vec<Order>` behind an `RwLock`).

<figure class="diagram">
<svg viewBox="0 0 700 210" role="img" aria-label="Architecture of the analytics API: the client's request passes through Logger, CORS, and an API-key check into a scoped API, whose handlers read the in-memory order store and return JSON">
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
  <text x="132" y="104" class="pa-c">Logger · CORS</text>
  <text x="132" y="120" class="pa-c">API-key (from_fn)</text>
  <rect x="290" y="66" width="140" height="74" rx="8" class="rtr"/>
  <text x="302" y="86" class="pa-h" fill="var(--amber)">/api scope</text>
  <text x="302" y="104" class="pa-c">overview · revenue</text>
  <text x="302" y="120" class="pa-c">top-products · orders</text>
  <rect x="450" y="66" width="140" height="74" rx="8" class="hnd"/>
  <text x="462" y="86" class="pa-h" fill="var(--green)">handlers</text>
  <text x="462" y="104" class="pa-c">extract + compute</text>
  <text x="462" y="120" class="pa-c">→ Json / AppError</text>
  <rect x="610" y="66" width="80"  height="74" rx="8" class="st"/>
  <text x="622" y="90" class="pa-h" fill="var(--blue)">Data</text>
  <text x="622" y="108" class="pa-c">RwLock</text>
  <text x="622" y="124" class="pa-c">Vec&lt;Order&gt;</text>
  <path d="M100 103 L118 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M270 103 L288 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M430 103 L448 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <path d="M590 103 L608 103" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#paa)"/>
  <text x="10" y="180" class="pa-c">/health is public; the /api scope is wrapped with the API-key middleware.</text>
  <defs><marker id="paa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>A middleware stack in front of a scoped <code>/api</code> whose handlers compute analytics over an in-memory order store.</figcaption>
</figure>

### Step 0 — the dependencies

```toml,ignore
# Cargo.toml
[dependencies]
actix-web = "4"
actix-cors = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
env_logger = "0.11"   # backend for the Logger middleware
futures-util = "0.3"
```

### Step 1 — the analytics core (this block RUNS)

The heart of the service is pure logic over a list of orders — no web framework involved. This is the block you can execute with **▶ Run** (identical to the axum project's core, so the frameworks share the exact same domain logic):

```rust
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct Order {
    id: u32,
    customer: String,
    product: String,
    category: String,
    amount_cents: u64,
    day: u32,
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
    println!("avg order value  : {}", dollars(total_revenue(&orders) / orders.len() as u64));

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

Run it and you get a full analytics report from plain Rust. **Everything below just exposes these functions over HTTP.**

### Step 2 — models, state, and the error type

```rust,ignore
use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::RwLock;
use std::fmt;

#[derive(Clone, Serialize, Deserialize)]
struct Order {
    id: u32,
    customer: String,
    product: String,
    category: String,
    amount_cents: u64,
    day: u32,
}

// Shared state — built once, shared across workers via web::Data (an Arc).
struct AppState {
    orders: RwLock<Vec<Order>>,   // RwLock: many readers, occasional writer
    api_key: String,
}

#[derive(Debug)]
enum AppError { NotFound, BadRequest(String) }

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::NotFound => write!(f, "order not found"),
            AppError::BadRequest(m) => write!(f, "{m}"),
        }
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
        }
    }
    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(json!({ "error": self.to_string() }))
    }
}
```

### Step 3 — the analytics handlers

```rust,ignore
use actix_web::{get, post, web, HttpResponse, Responder};
use std::collections::{HashMap, HashSet};

#[derive(Serialize)]
struct Overview {
    orders: usize,
    total_revenue_cents: u64,
    unique_customers: usize,
    avg_order_value_cents: u64,
}

#[get("/analytics/overview")]
async fn overview(data: web::Data<AppState>) -> impl Responder {
    let orders = data.orders.read().unwrap();
    let total: u64 = orders.iter().map(|o| o.amount_cents).sum();
    let customers: HashSet<&str> = orders.iter().map(|o| o.customer.as_str()).collect();
    let count = orders.len();
    web::Json(Overview {
        orders: count,
        total_revenue_cents: total,
        unique_customers: customers.len(),
        avg_order_value_cents: if count == 0 { 0 } else { total / count as u64 },
    })
}

#[derive(Deserialize)]
struct TopQuery { #[serde(default = "default_limit")] limit: usize }
fn default_limit() -> usize { 5 }

#[derive(Serialize)]
struct ProductRevenue { product: String, revenue_cents: u64 }

#[get("/analytics/top-products")]
async fn top_products(data: web::Data<AppState>, q: web::Query<TopQuery>) -> impl Responder {
    let orders = data.orders.read().unwrap();
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
    web::Json(ranked)
}

#[derive(Deserialize)]
struct RangeQuery { from: Option<u32>, to: Option<u32> }

#[derive(Serialize)]
struct DayRevenue { day: u32, revenue_cents: u64 }

#[get("/analytics/revenue")]
async fn revenue(data: web::Data<AppState>, range: web::Query<RangeQuery>) -> impl Responder {
    let orders = data.orders.read().unwrap();
    let (from, to) = (range.from.unwrap_or(u32::MIN), range.to.unwrap_or(u32::MAX));
    let mut by_day: HashMap<u32, u64> = HashMap::new();
    for o in orders.iter().filter(|o| o.day >= from && o.day <= to) {
        *by_day.entry(o.day).or_insert(0) += o.amount_cents;
    }
    let mut series: Vec<DayRevenue> =
        by_day.into_iter().map(|(day, revenue_cents)| DayRevenue { day, revenue_cents }).collect();
    series.sort_by_key(|d| d.day);
    web::Json(series)
}

// Path extractor + ? + AppError → clean 404 when the order is missing.
#[get("/orders/{id}")]
async fn get_order(data: web::Data<AppState>, path: web::Path<u32>) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    let orders = data.orders.read().unwrap();
    let order = orders.iter().find(|o| o.id == id).cloned().ok_or(AppError::NotFound)?;
    Ok(HttpResponse::Ok().json(order))
}

// POST a new order (JSON body) — mutates shared state.
#[derive(Deserialize)]
struct NewOrder { customer: String, product: String, category: String, amount_cents: u64, day: u32 }

#[post("/orders")]
async fn ingest_order(data: web::Data<AppState>, body: web::Json<NewOrder>)
    -> Result<HttpResponse, AppError>
{
    if body.amount_cents == 0 {
        return Err(AppError::BadRequest("amount_cents must be > 0".into()));
    }
    let mut orders = data.orders.write().unwrap();
    let id = orders.iter().map(|o| o.id).max().unwrap_or(0) + 1;
    let order = Order {
        id, customer: body.customer.clone(), product: body.product.clone(),
        category: body.category.clone(), amount_cents: body.amount_cents, day: body.day,
    };
    orders.push(order.clone());
    Ok(HttpResponse::Created().json(order))
}
```

### Step 4 — the API-key middleware

```rust,ignore
use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    error::ErrorUnauthorized,
    middleware::Next,
    web, Error,
};

async fn require_api_key(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let expected = req.app_data::<web::Data<AppState>>().map(|d| d.api_key.clone());
    let provided = req.headers().get("x-api-key").and_then(|v| v.to_str().ok().map(String::from));
    match (expected, provided) {
        (Some(exp), Some(key)) if key == exp => next.call(req).await,
        _ => Err(ErrorUnauthorized("invalid or missing api key")),
    }
}
```

### Step 5 — assemble the server and run

```rust,ignore
use actix_cors::Cors;
use actix_web::{get, middleware::{from_fn, Logger}, web, App, HttpServer};
use std::sync::RwLock;

#[get("/health")]
async fn health() -> &'static str { "ok" }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Build shared state ONCE, outside the factory:
    let state = web::Data::new(AppState {
        orders: RwLock::new(seed_orders()),
        api_key: std::env::var("API_KEY").unwrap_or_else(|_| "dev-secret".into()),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())            // clone the Arc into each worker
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .service(health)                     // public
            .service(
                web::scope("/api")               // everything here needs the key
                    .wrap(from_fn(require_api_key))
                    .service(overview)
                    .service(top_products)
                    .service(revenue)
                    .service(get_order)
                    .service(ingest_order),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()                                       // graceful shutdown handled automatically
    .await
}

fn seed_orders() -> Vec<Order> {
    // ... same rows as the runnable core in Step 1 ...
    Vec::new()
}
```

Try it locally:

```bash,ignore
curl localhost:8080/health                                             # public
curl -H "x-api-key: dev-secret" localhost:8080/api/analytics/overview  # protected
curl -H "x-api-key: dev-secret" "localhost:8080/api/analytics/top-products?limit=3"
curl -X POST -H "x-api-key: dev-secret" -H "content-type: application/json" \
     -d '{"customer":"eve","product":"Webcam","category":"Electronics","amount_cents":7900,"day":3}' \
     localhost:8080/api/orders
```

### What you just practiced

| Feature | Where it appears |
|---|---|
| Scopes & attribute routing | `web::scope("/api")`, `#[get]`/`#[post]` |
| Path / Query / Json / Data extractors | every handler |
| Typed JSON responses with serde | `Overview`, `ProductRevenue`, … |
| Custom error type → HTTP via `ResponseError` | `AppError` + `?` in `get_order` |
| Shared, mutable state (built once, per the worker model) | `web::Data<AppState>` + `RwLock` |
| State-aware custom middleware | `require_api_key` (`from_fn`, reads `app_data`) |
| Built-in / community middleware | `Logger`, `Cors` |
| Automatic graceful shutdown | `.run().await` |

## Resources

> [!best] Where to go deeper
> - **[docs.rs/actix-web](https://docs.rs/actix-web)** — the authoritative, always-current API reference.
> - **[actix.rs](https://actix.rs)** — the official guide/book, with a deeper walkthrough of sessions, WebSockets, and databases than fits in one chapter.
> - **[github.com/actix/examples](https://github.com/actix/examples)** — dozens of runnable example projects (auth, WebSockets, Diesel/SQLx, TLS, HTTP/2, and more) maintained alongside the framework.
> - **[github.com/actix/actix-web/discussions](https://github.com/actix/actix-web/discussions)** — Q&A with maintainers and the community.
> - **[github.com/actix/actix-extras](https://github.com/actix/actix-extras)** — the umbrella repo for `actix-cors`, `actix-session`, `actix-identity`, and the other first-party crates mentioned in this chapter.

## Summary

- **Actix Web** is a tokio-based framework where **handlers are plain async functions** returning a `Responder`; an **`App`** holds routes/state/middleware and an **`HttpServer`** serves it.
- Register routes with attribute macros or the fluent API; group them with **`web::scope`**.
- **Extractors** (`web::Path`, `Query`, `Json`, `Form`, `Data`, `Bytes`, `Payload`, `Multipart`) implement `FromRequest`; you can write your own. Body extractors are size-limited via config.
- Return any **`Responder`**; centralize failures in one error enum implementing **`ResponseError`** and use `?`.
- Share state with **`web::Data`** (an `Arc`) built **once outside** the factory; add cross-cutting behavior with **`.wrap(...)`** and `middleware::from_fn`.
- **Internally**, everything is a `Service`; Actix's signature design is the **multi-worker model** — N share-nothing workers, each with its own `App` and event loop, so the hot path is lock-free.
- You built the same **e-commerce admin analytics API** as the axum chapter, with a runnable pure-Rust core, so you can compare the two frameworks directly.

> [!exercise] Take the project further
> 1. Add `GET /api/analytics/top-categories` (group by `category`).
> 2. Add pagination to a `GET /api/customers` endpoint with `page`/`per_page` query params.
> 3. Add a `POST /api/orders/import` that accepts a **CSV file upload** via `Multipart`, capping the size with `PayloadConfig`.
> 4. Write an `#[actix_web::test]` asserting `/api/analytics/overview` is `401` without the key and `200` with it.
> 5. Port this same project to [axum](#/ch/axum) (or compare with the one you built there) — notice how the handlers, extractors, and error type map almost one-to-one.

You've now seen both leading Rust web frameworks. There's a third worth knowing — **Rocket** — which trades some of axum's and Actix's raw configurability for the most ergonomic, "batteries-included" developer experience of the three; the next chapter covers it at a lighter depth. After that, when your services need to talk to *each other* faster, with a strict typed contract and streaming, they often use gRPC instead — the chapter after covers it with **tonic**.
