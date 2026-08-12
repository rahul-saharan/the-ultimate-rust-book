<h1><span class="h1-kicker">The Crate Ecosystem</span>Rocket: Ergonomic Web Servers</h1>

**Rocket** is the third major Rust web framework, and it optimizes for a different axis than [axum](#/ch/axum) and [Actix Web](#/ch/actix): developer ergonomics through the type system. Where axum leans on `tower` composition and Actix on raw throughput and a rich built-in toolkit, Rocket leans on **macros and traits that make invalid requests unrepresentable** — a route that asks for `age: u8` from the path simply doesn't get called if the segment isn't a valid `u8`; Rocket tries the next matching route instead. It runs on tokio under the hood (since 0.5), so everything you know about `async`/`await` still applies.

This chapter is intentionally lighter than the axum and Actix chapters — the goal is fluency, not exhaustive coverage. You'll learn routing, request guards (Rocket's extractors), responders, managed state, fairings (middleware), and catchers (error pages), then build a small **bookmarks API** that exercises all of it.

> [!note] Servers don't run in the in-book playground
> Like axum and Actix, a Rocket server binds a socket and runs forever, so "▶ Run" can't execute these examples — they're marked `ignore`, meant for a local `cargo run`.

## Five ideas every Rust web framework shares

If you've read the [axum](#/ch/axum) or [Actix Web](#/ch/actix) chapters, this is a translation table, not new material — the same five ideas, in Rocket's vocabulary:

| Concept | axum's name | Actix's name | Rocket's name |
|---|---|---|---|
| **Handler** | any `async fn` | any `async fn` | any `fn`/`async fn` tagged `#[get]`/`#[post]`/… |
| **Router** | `Router` | `App` + `HttpServer` | `rocket::build()` + `.mount(base, routes![...])` |
| **Extractor** | `FromRequestParts`/`FromRequest` | `FromRequest` | **request guard** — `FromRequest` |
| **Response trait** | `IntoResponse` | `Responder` | `Responder` (often `#[derive(Responder)]`) |
| **Middleware** | `tower::Layer` | `Transform` via `.wrap(...)` | **Fairing**, via `.attach(...)` |

> [!tip] What Rocket adds beyond the shared shape
> Two things are genuinely distinctive: **typed path/query segments that fail closed** (a bad `<age: u8>` doesn't 400 — Rocket *forwards* to the next route that might match, covered below) and **`#[derive(Responder)]`**, which generates a full `Responder` impl from an enum's shape instead of a hand-written `match`. Both come from the same idea: push more correctness into the macro layer so handler bodies stay simple.

## Hello, Rocket

A Rocket app is built with `rocket::build()`, routes are `#[get]`/`#[post]`/… tagged functions mounted with `routes![...]`, and `#[launch]` replaces `main`:

```rust,ignore
// Cargo.toml: rocket = "0.5"
#[macro_use] extern crate rocket;

#[get("/")]
fn index() -> &'static str {
    "Hello, Rocket!"
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![index])
}
```

`cargo run` and visit `http://127.0.0.1:8000`. `#[launch]` generates the `async fn main` and starts the server for you — you never call `.await` yourself; you just return the built `Rocket` instance.

## Routing: paths, types, and forwarding

Path segments are captured with **`<angle brackets>`**, and the *type* of the matching function parameter is enforced automatically — this is the detail that most surprises people coming from axum or Actix:

```rust,ignore
#[get("/hello/<name>/<age>")]
fn hello(name: &str, age: u8) -> String {
    format!("Hello, {name}! You are {age}.")
}
```

> [!key] A path parameter that fails to parse *forwards*, it doesn't 400
> If `/hello/alice/notanumber` is requested, `age: u8` fails to parse — but Rocket doesn't automatically reject the request. It **forwards** to the next route that matches the same path shape, if one exists, and only 404s if nothing does. This lets you overload a path by type: `#[get("/item/<id>")] fn by_id(id: u32)` and `#[get("/item/<slug>")] fn by_slug(slug: &str)` can coexist, and Rocket routes to whichever one's types actually fit the request.

### Query parameters and multi-segment paths

```rust,ignore
// ?name=Alice&age=30 -- optional params are `Option<T>`
#[get("/search?<name>&<age>")]
fn search(name: &str, age: Option<u8>) -> String {
    format!("{name}, age filter: {age:?}")
}

// <path..> greedily captures the rest as a PathBuf -- for file-serving-style routes
#[get("/files/<path..>")]
fn files(path: std::path::PathBuf) -> String {
    format!("serving {}", path.display())
}
```

### If you're coming from axum or Actix: the syntax translation

The three frameworks disagree on punctuation for the exact same idea — this is worth memorizing once so it stops tripping you up:

| Framework | Path capture | Rest-of-path wildcard |
|---|---|---|
| **axum** (0.8+) | `/{id}` | `/{*rest}` |
| **axum** (<0.8) | `/:id` | `/*rest` |
| **Actix Web** | `/{id}` | `/{rest:.*}` |
| **Rocket** | `/<id>` | `/<rest..>` |

### Mounting and organizing routes

`.mount(base, routes![...])` is Rocket's equivalent of axum's `.nest`/Actix's `web::scope` — it prefixes every route in the list with `base`:

```rust,ignore
#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", routes![index])
        .mount("/api/v1", routes![list_products, list_orders]) // → /api/v1/...
}
```

## Request guards — Rocket's extractors

A **request guard** is any type implementing `FromRequest`; declaring one as a handler parameter runs it *before* the handler, and a failed guard can **forward** to another route or **fail** the request outright. This is how Rocket models auth, headers, and anything else pulled from the request head:

```rust,ignore
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};

pub struct ApiKey<'r>(&'r str);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ApiKey<'r> {
    type Error = &'r str;

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match req.headers().get_one("x-api-key") {
            Some(key) if key == "dev-secret" => Outcome::Success(ApiKey(key)),
            Some(_) => Outcome::Error((Status::Unauthorized, "invalid api key")),
            None => Outcome::Error((Status::Unauthorized, "missing api key")),
        }
    }
}

// Any handler can now just ask for it as a parameter:
#[get("/me")]
fn me(key: ApiKey<'_>) -> String {
    format!("authenticated with {}", key.0)
}
```

> [!note] `Outcome` has three variants, not two
> `Success(S)` continues to the handler; `Error((Status, E))` fails the request with that status; **`Forward(Status)`** — the one axum and Actix don't have an equivalent of — skips this route entirely and lets Rocket try the next one that matches, exactly like the typed-path-parameter behavior above. Guards and path types share the same forwarding mechanism under the hood.

## Data: JSON, forms, and file uploads

A handler that consumes the request body declares it with `data = "<name>"` in the route attribute, and the parameter type determines how it's parsed:

```rust,ignore
// Cargo.toml: rocket = { version = "0.5", features = ["json"] }
use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct NewUser { name: String }

#[derive(Serialize)]
struct User { id: u32, name: String }

#[post("/users", data = "<body>")]
fn create_user(body: Json<NewUser>) -> Json<User> {
    Json(User { id: 1, name: body.name.clone() })
}
```

Forms use `#[derive(FromForm)]` and the `Form<T>` guard — the same shape, different derive:

```rust,ignore
use rocket::form::Form;

#[derive(FromForm)]
struct LoginForm { username: String, password: String }

#[post("/login", data = "<form>")]
fn login(form: Form<LoginForm>) -> String {
    format!("logging in {}", form.username)
}
```

File uploads are a `FromForm` struct with a `TempFile` field — Rocket streams the upload to a temp path for you, and you decide where to persist it:

```rust,ignore
use rocket::fs::TempFile;

#[derive(FromForm)]
struct Upload<'r> {
    title: String,
    file: TempFile<'r>,
}

#[post("/upload", data = "<upload>")]
async fn upload(mut upload: Form<Upload<'_>>) -> std::io::Result<String> {
    upload.file.persist_to(format!("/tmp/{}", upload.title)).await?;
    Ok(format!("saved '{}'", upload.title))
}
```

## Responders: returning responses

Any type implementing **`Responder`** can come back from a handler — `&str`, `String`, `Json<T>`, `(Status, T)` tuples, and `Result<T, E>` where both sides implement it. Rocket's signature convenience is **deriving** `Responder` on your own error enum instead of hand-writing the trait:

```rust,ignore
use rocket::response::Responder;
use rocket::serde::json::Json;
use serde::Serialize;

#[derive(Serialize)]
struct ErrorBody { error: String }

#[derive(Responder)]
enum AppError {
    #[response(status = 404)]
    NotFound(Json<ErrorBody>),
    #[response(status = 400)]
    BadRequest(Json<ErrorBody>),
}

impl AppError {
    fn not_found(msg: &str) -> Self {
        AppError::NotFound(Json(ErrorBody { error: msg.into() }))
    }
}

#[get("/orders/<id>")]
fn get_order(id: u32) -> Result<Json<User>, AppError> {
    Err(AppError::not_found(&format!("order {id} not found")))
}
```

> [!best] One error type, mapped once — same pattern as axum and Actix
> This is the identical idea from the [axum](#/ch/axum) and [Actix Web](#/ch/actix) chapters — centralize error-to-HTTP mapping in one type — just expressed as a derive instead of a hand-written `IntoResponse`/`ResponseError` impl. The `#[response(status = ...)]` attribute is doing exactly what the `match` in `AppError::into_response` did there.

## Managed state

Share a database pool, config, or cache with **`.manage(value)`** on the `Rocket` builder, and receive it in a handler via the **`&State<T>`** guard:

```rust,ignore
use rocket::State;
use std::sync::Mutex;

struct Counter { count: Mutex<u64> }

#[get("/count")]
fn hit(counter: &State<Counter>) -> String {
    let mut c = counter.count.lock().unwrap();
    *c += 1;
    format!("hit {c} times")
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(Counter { count: Mutex::new(0) })
        .mount("/", routes![hit])
}
```

`.manage(value)` stores exactly one value per type — call it once per type you need, and `&State<T>` looks it up by type at request time. It's the same idea as axum's `State`/`.with_state` and Actix's `web::Data`/`.app_data`, just without needing `Arc` yourself — Rocket wraps it for you.

## Fairings — Rocket's middleware

A **Fairing** hooks into the request/response lifecycle (and server startup) — Rocket's answer to `tower::Layer`/`actix_service::Transform`. The quickest way to write one is `AdHoc`, for simple request/response hooks without a full trait impl:

```rust,ignore
use rocket::fairing::AdHoc;

#[launch]
fn rocket() -> _ {
    rocket::build()
        .attach(AdHoc::on_request("Request Logger", |req, _| {
            Box::pin(async move { println!("{} {}", req.method(), req.uri()); })
        }))
        .mount("/", routes![hit])
}
```

> [!note] No built-in CORS — reach for `rocket_cors`
> Unlike Actix (built-in `Cors`) and axum (`tower-http`'s `CorsLayer`), Rocket doesn't ship CORS in the core crate. The community `rocket_cors` crate fills the gap and attaches the same way, as a fairing.

## Catchers: custom error pages

A **catcher** handles a status code Rocket would otherwise render with a bland default page — the equivalent of axum's `.fallback` or Actix's `default_service`, but keyed by status rather than by unmatched path:

```rust,ignore
use rocket::Request;

#[catch(404)]
fn not_found(req: &Request) -> String {
    format!("'{}' isn't a route this server knows about.", req.uri())
}

#[catch(422)]
fn unprocessable() -> &'static str {
    "the request body didn't match the type we expected"
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", routes![hit])
        .register("/", catchers![not_found, unprocessable])
}
```

## The request lifecycle, end to end

<figure class="diagram">
<svg viewBox="0 0 720 250" role="img" aria-label="A request enters through fairings, is matched by the router which may forward on a failed type or guard, passes through request guards into the handler, and the handler's Responder becomes a Response that flows back out through fairings">
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
  <rect x="10"  y="36" width="96"  height="46" rx="8" class="n-hy"/><text x="20" y="56" class="li-b">tokio</text><text x="20" y="72" class="li-c">accept conn</text>
  <rect x="122" y="36" width="120" height="46" rx="8" class="n-ly"/><text x="134" y="56" class="li-b">Fairings</text><text x="134" y="72" class="li-c">on_request</text>
  <rect x="258" y="36" width="110" height="46" rx="8" class="n-rt"/><text x="266" y="56" class="li-b">Router</text><text x="266" y="72" class="li-c">match, or forward</text>
  <rect x="384" y="36" width="130" height="46" rx="8" class="n-ex"/><text x="394" y="56" class="li-b">Request guards</text><text x="394" y="72" class="li-c">FromRequest</text>
  <rect x="530" y="36" width="180" height="46" rx="8" class="n-hd"/><text x="542" y="56" class="li-b">#[get]/#[post] fn</text><text x="542" y="72" class="li-c">your code runs</text>
  <path d="M106 59 L120 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M242 59 L256 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M368 59 L382 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M514 59 L528 59" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M620 82 L620 118" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="628" y="106" class="li-c">Responder</text>
  <rect x="530" y="124" width="180" height="44" rx="8" class="n-rs"/><text x="542" y="144" class="li-b">Response</text><text x="542" y="160" class="li-c">status + body</text>
  <rect x="122" y="124" width="392" height="44" rx="8" class="n-ly"/><text x="134" y="144" class="li-b">Fairings (on_response, reverse order)</text>
  <rect x="10"  y="124" width="96"  height="44" rx="8" class="n-hy"/><text x="20" y="144" class="li-b">tokio</text><text x="20" y="160" class="li-c">writes bytes</text>
  <path d="M528 146 L516 146" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <path d="M120 146 L108 146" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#lia)"/>
  <text x="10" y="196" class="li-c">1. Fairings can inspect/modify the request before routing (on_ignite/on_request).</text>
  <text x="10" y="214" class="li-c">2. The router matches path + method; a failed typed segment forwards to the next candidate route instead of 400ing.</text>
  <text x="10" y="232" class="li-c">3. Request guards run (may also forward/error); the handler runs; its Responder builds the Response, unwinding back through fairings.</text>
  <defs><marker id="lia" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Fairings wrap the whole pipeline; the router and request guards can both <b>forward</b> — Rocket's distinctive escape hatch that axum and Actix don't have.</figcaption>
</figure>

## Testing without a network

Rocket ships its own test client — no separate crate needed:

```rust,ignore
use rocket::local::blocking::Client;
use rocket::http::Status;

#[test]
fn hits_health() {
    let client = Client::tracked(rocket()).expect("valid rocket instance");
    let response = client.get("/count").dispatch();
    assert_eq!(response.status(), Status::Ok);
}
```

## Project: a bookmarks API

A small, complete service — save and list bookmarks, guarded by an API key — that exercises everything above: typed path params, a JSON body, a request guard, managed state, a catcher, and a derived `Responder`.

```rust,ignore
// Cargo.toml:
//   rocket = { version = "0.5", features = ["json"] }
//   serde = { version = "1", features = ["derive"] }

#[macro_use] extern crate rocket;

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::response::Responder;
use rocket::serde::json::Json;
use rocket::State;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
struct Bookmark { id: u32, url: String, title: String }

struct Store { bookmarks: Mutex<Vec<Bookmark>>, api_key: String }

// --- request guard: a validated API key ---
struct ApiKey;

#[rocket::async_trait]
impl<'r> FromRequest<'r> for ApiKey {
    type Error = ();
    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let store = req.rocket().state::<Store>().expect("Store is managed");
        match req.headers().get_one("x-api-key") {
            Some(key) if key == store.api_key => Outcome::Success(ApiKey),
            _ => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

// --- one error type, derived Responder (same pattern as axum's AppError) ---
#[derive(Serialize)]
struct ErrorBody { error: String }

#[derive(Responder)]
enum AppError {
    #[response(status = 404)]
    NotFound(Json<ErrorBody>),
    #[response(status = 401)]
    Unauthorized(Json<ErrorBody>),
}

// --- handlers ---
#[get("/bookmarks")]
fn list(_key: ApiKey, store: &State<Store>) -> Json<Vec<Bookmark>> {
    Json(store.bookmarks.lock().unwrap().clone())
}

#[get("/bookmarks/<id>")]
fn get_one(id: u32, _key: ApiKey, store: &State<Store>) -> Result<Json<Bookmark>, AppError> {
    store.bookmarks.lock().unwrap()
        .iter().find(|b| b.id == id).cloned()
        .map(Json)
        .ok_or_else(|| AppError::NotFound(Json(ErrorBody { error: "no such bookmark".into() })))
}

#[derive(Deserialize)]
struct NewBookmark { url: String, title: String }

#[post("/bookmarks", data = "<body>")]
fn create(body: Json<NewBookmark>, _key: ApiKey, store: &State<Store>) -> Json<Bookmark> {
    let mut bookmarks = store.bookmarks.lock().unwrap();
    let id = bookmarks.iter().map(|b| b.id).max().unwrap_or(0) + 1;
    let bookmark = Bookmark { id, url: body.url.clone(), title: body.title.clone() };
    bookmarks.push(bookmark.clone());
    Json(bookmark)
}

#[catch(404)]
fn not_found() -> Json<ErrorBody> {
    Json(ErrorBody { error: "no such route".into() })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(Store {
            bookmarks: Mutex::new(Vec::new()),
            api_key: std::env::var("API_KEY").unwrap_or_else(|_| "dev-secret".into()),
        })
        .mount("/", routes![list, get_one, create])
        .register("/", catchers![not_found])
}
```

Try it locally:

```bash,ignore
curl -H "x-api-key: dev-secret" localhost:8000/bookmarks
curl -X POST -H "x-api-key: dev-secret" -H "content-type: application/json" \
     -d '{"url":"https://rust-lang.org","title":"Rust"}' \
     localhost:8000/bookmarks
```

Notice `ApiKey` reads `Store` through `req.rocket().state::<Store>()` rather than as a separate parameter — a request guard can depend on managed state internally, so handlers that need auth don't have to also thread the store through by hand just for the key check.

## Resources

> [!best] Where to go deeper
> - **[rocket.rs/guide](https://rocket.rs/guide)** — the official guide, notably thorough and example-driven; it's the best next stop after this chapter.
> - **[docs.rs/rocket](https://docs.rs/rocket)** — the API reference, including the `FromRequest`/`FromForm`/`Responder` trait details this chapter only summarized.
> - **[github.com/rwf2/Rocket](https://github.com/rwf2/Rocket)** — source and the `examples/` directory, covering databases, testing, TLS, and more.
> - **[github.com/rwf2/Rocket/discussions](https://github.com/rwf2/Rocket/discussions)** — community and maintainer Q&A.

## Summary

- **Rocket** optimizes for developer ergonomics: typed path/query segments, request guards, and derivable responders push correctness into the macro/trait layer.
- Routes are `#[get]`/`#[post]`/… functions **mounted** with `routes![...]`; `#[launch]` builds and runs the server.
- Path captures use **`<angle brackets>`** (`<id..>` for a greedy rest-of-path) — different punctuation from axum's `{id}` and Actix's `{id}`, same idea.
- A **request guard** (`FromRequest`) is Rocket's extractor; guards and typed path segments can both **forward** to another route on failure instead of 400ing — the one behavior axum and Actix don't have.
- **`Responder`** is Rocket's `IntoResponse`/`Responder` equivalent, often generated with **`#[derive(Responder)]`** on an error enum instead of hand-written.
- **`.manage(value)`** + **`&State<T>`** shares state, no `Arc` wrapping required from you.
- **Fairings** (`.attach(...)`) are Rocket's middleware; **catchers** (`#[catch(404)]`) are its per-status error pages.
- You built a small **bookmarks API** with a request guard, managed state, JSON, and a derived error responder.

> [!exercise] Try it yourself
> 1. Add `DELETE /bookmarks/<id>` returning `AppError::NotFound` when the id doesn't exist.
> 2. Add a second route on the same path with a different parameter type (e.g. `<id: u32>` vs `<slug: &str>`) and observe Rocket forward between them based on what the client sends.
> 3. Write a fairing that adds an `x-response-time` header to every response.
> 4. Add a `#[catch(401)]` catcher that returns the same JSON error shape as `AppError::Unauthorized`.
> 5. Port the bookmarks API's three routes to [axum](#/ch/axum) or [Actix Web](#/ch/actix) and compare how much of the shape — guard, state, error enum — carries over unchanged.

You've now met all three of Rust's leading web frameworks. Next, when services need to talk to *each other* — not to a browser — with a strict typed contract and streaming, they typically reach for gRPC instead: the next chapter covers it with **tonic**.
