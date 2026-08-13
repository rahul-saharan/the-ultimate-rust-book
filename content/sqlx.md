<h1><span class="h1-kicker">The Crate Ecosystem</span>sqlx & Databases</h1>

Most real applications need a database. Rust has several approaches, but **sqlx** stands out for a remarkable feature: it checks your **SQL queries at compile time** against a real database schema. A typo in a column name or a type mismatch becomes a *build error*, not a 3 a.m. production surprise. This chapter is a thorough tour of sqlx — every way to run a query, every way to fetch results, parameter binding, mapping rows to your types, transactions, migrations, and errors — each explained in plain language with visuals. It ends by building a **generic CRUD handler** from an enum, structs, and generics that works for *any* table. (A database can't run in the in-book playground, so examples are illustrative — run them locally.)

## The Rust database landscape

| Crate | Style | Best when… |
|-------|-------|------------|
| **sqlx** | write SQL, compile-time checked, async | you like SQL and want safety without an ORM |
| **SeaORM** | full async ORM (entities, relations) | you want an ORM abstraction over SQL |
| **Diesel** | sync ORM + query builder, compile-time safe | you want a mature, type-safe query DSL |
| **rusqlite** | thin SQLite wrapper | small local apps using SQLite only |

> [!key] sqlx's headline: compile-time-checked SQL
> With the `query!` macro, sqlx connects to your database **at compile time**, checks that your SQL is valid against the real schema, and infers the Rust types of the results. Misspell a column, use the wrong type, or reference a missing table, and **your code won't compile**. You get the flexibility of hand-written SQL with a safety net most ORMs can't match — and no runtime query-parsing overhead.

## Connecting: the pool

sqlx is async (built on tokio) and supports PostgreSQL, MySQL, and SQLite. You never open one connection per query — that's slow. Instead you create a **connection pool** once at startup: a small set of open, ready-to-use connections that your whole app borrows from and returns to. When a task needs the database, it takes a connection from the pool, runs its query, and hands it back.

<figure class="diagram">
<svg viewBox="0 0 660 180" role="img" aria-label="Several application tasks borrow connections from a shared pool of a fixed number of open connections, which talk to the database">
  <style>
    .pl-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .pl-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pl-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .task { fill: var(--blue-soft);  stroke: var(--blue);   stroke-width: 1.4; }
    .pool { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.5; }
    .conn { fill: var(--rust-100);   stroke: var(--rust-400); stroke-width: 1.4; }
    .db   { fill: var(--green-soft); stroke: var(--green);   stroke-width: 1.5; }
  </style>
  <text x="10" y="20" class="pl-h">Your app (async tasks)</text>
  <rect x="10" y="30" width="90" height="26" rx="6" class="task"/><text x="30" y="47" class="pl-b">task A</text>
  <rect x="10" y="64" width="90" height="26" rx="6" class="task"/><text x="30" y="81" class="pl-b">task B</text>
  <rect x="10" y="98" width="90" height="26" rx="6" class="task"/><text x="30" y="115" class="pl-b">task C</text>
  <rect x="170" y="26" width="200" height="120" rx="10" class="pool"/>
  <text x="182" y="46" class="pl-h">Pool (max 5)</text>
  <rect x="184" y="56" width="80" height="24" rx="5" class="conn"/><text x="196" y="72" class="pl-b">conn 1</text>
  <rect x="184" y="86" width="80" height="24" rx="5" class="conn"/><text x="196" y="102" class="pl-b">conn 2</text>
  <rect x="276" y="56" width="80" height="24" rx="5" class="conn"/><text x="288" y="72" class="pl-b">conn 3</text>
  <rect x="276" y="86" width="80" height="24" rx="5" class="conn"/><text x="288" y="102" class="pl-b">…</text>
  <rect x="440" y="60" width="180" height="52" rx="10" class="db"/><text x="452" y="82" class="pl-h" fill="var(--green)">Database</text><text x="452" y="100" class="pl-c">Postgres / MySQL / SQLite</text>
  <path d="M100 43 L168 60" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pla)"/>
  <path d="M100 77 L168 86" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pla)"/>
  <path d="M100 111 L168 112" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#pla)"/>
  <path d="M370 86 L438 86" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#pla)"/>
  <defs><marker id="pla" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Create the pool <b>once</b>; every task borrows a connection, uses it, and returns it. Reuse — never reconnect per query.</figcaption>
</figure>

```rust,ignore
// Cargo.toml:
//   sqlx = { version = "0.8", features = ["runtime-tokio", "postgres"] }
//   tokio = { version = "1", features = ["full"] }

use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(5)      // most connections to keep open
        .min_connections(1)      // keep at least this many warm
        .connect("postgres://user:pass@localhost/mydb")
        .await?;

    // A quick sanity query: ask the DB to echo a number back.
    let row: (i64,) = sqlx::query_as("SELECT $1")
        .bind(42_i64)
        .fetch_one(&pool)
        .await?;
    println!("the database returned {}", row.0);
    Ok(())
}
```

The pool type matches your database: `PgPool` (Postgres), `MySqlPool` (MySQL), `SqlitePool` (SQLite). Everything below works the same across all three — only the placeholder syntax differs (`$1` for Postgres, `?` for MySQL/SQLite).

## Running a query: the `query` family

sqlx gives you a small family of ways to *build* a query. They split along one line: **checked** (a macro that verifies your SQL against the real schema at compile time) versus **unchecked** (a function you use when the SQL is built dynamically at runtime).

<figure class="diagram">
<svg viewBox="0 0 680 190" role="img" aria-label="The query builders split into compile-time-checked macros (query!, query_as!, query_scalar!) and runtime functions (query, query_as, query_scalar)">
  <style>
    .qf-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .qf-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .qf-h { font: 700 12px var(--font-sans); }
    .chk { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
    .unk { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
  </style>
  <text x="14" y="22" class="qf-h" fill="var(--green)">Checked at COMPILE time (macros) ✔ verified vs schema</text>
  <rect x="14"  y="32" width="150" height="30" rx="6" class="chk"/><text x="26" y="52" class="qf-b">query!(…)</text>
  <rect x="178" y="32" width="200" height="30" rx="6" class="chk"/><text x="190" y="52" class="qf-b">query_as!(Struct, …)</text>
  <rect x="392" y="32" width="170" height="30" rx="6" class="chk"/><text x="404" y="52" class="qf-b">query_scalar!(…)</text>
  <text x="14" y="74" class="qf-c">Fixed SQL string literal → mistakes are build errors. Prefer these.</text>
  <text x="14" y="112" class="qf-h" fill="var(--amber)">Checked at RUN time (functions) — for SQL built dynamically</text>
  <rect x="14"  y="122" width="120" height="30" rx="6" class="unk"/><text x="26" y="142" class="qf-b">query(&amp;sql)</text>
  <rect x="148" y="122" width="210" height="30" rx="6" class="unk"/><text x="160" y="142" class="qf-b">query_as::&lt;_, T&gt;(&amp;sql)</text>
  <rect x="372" y="122" width="200" height="30" rx="6" class="unk"/><text x="384" y="142" class="qf-b">query_scalar(&amp;sql)</text>
  <text x="14" y="164" class="qf-c">SQL comes from a variable → not schema-checked, but still parameter-bound (safe).</text>
</svg>
<figcaption>Macros (compile-time safe) for fixed SQL; functions (runtime) for SQL you assemble on the fly — like the generic handler at the end.</figcaption>
</figure>

| Builder | Checked? | Gives you | Reach for it when |
|---|---|---|---|
| `query!("…", args)` | ✅ compile-time | an anonymous record (fields named after your columns) | a one-off checked query |
| `query_as!(Struct, "…", args)` | ✅ compile-time | rows mapped into **your struct** | checked query → typed struct |
| `query_scalar!("…", args)` | ✅ compile-time | a **single value** (one column) | `COUNT(*)`, `MAX(id)`, one field |
| `query(&sql)` | ❌ runtime | a raw `Row` (read with `.get`) | SQL built at runtime |
| `query_as::<_, T>(&sql)` | ❌ runtime | rows mapped into `T` via `FromRow` | dynamic SQL → typed struct |

The checked macro is where sqlx shines — it validates the SQL and infers each field's type:

```rust,ignore
#[derive(Debug)]
struct User { id: i64, name: String, email: String }

async fn get_user(pool: &sqlx::PgPool, id: i64) -> Result<User, sqlx::Error> {
    // query_as! checks this SQL against the schema at COMPILE time and maps
    // each row into a User with the right field types:
    let user = sqlx::query_as!(
        User,
        "SELECT id, name, email FROM users WHERE id = $1",
        id
    )
    .fetch_one(pool)
    .await?;
    Ok(user)
}
```

If `users` has no `email` column, or `id` is a `TEXT` not an integer, this fails to *compile*, pointing at the exact query. That's the safety net.

## Getting the results: which fetch method?

Building a query is only half of it — you then choose **how many rows you expect**, and that picks the method you call. This is the single most important table in the chapter:

<figure class="diagram">
<svg viewBox="0 0 680 210" role="img" aria-label="Choosing a fetch method by how many rows you expect: execute for none, fetch_one for exactly one, fetch_optional for zero or one, fetch_all for many, fetch for a lazy stream">
  <style>
    .fm-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .fm-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .m1 { fill: var(--rust-100);   stroke: var(--rust-400); stroke-width: 1.4; }
    .m2 { fill: var(--blue-soft);  stroke: var(--blue);     stroke-width: 1.4; }
    .m3 { fill: var(--amber-soft); stroke: var(--amber);    stroke-width: 1.4; }
    .m4 { fill: var(--green-soft); stroke: var(--green);    stroke-width: 1.4; }
    .m5 { fill: var(--purple-soft);stroke: var(--purple);   stroke-width: 1.4; }
  </style>
  <text x="14" y="22" class="fm-c">“How many rows do I expect back?” →</text>
  <rect x="14" y="34" width="640" height="30" rx="6" class="m1"/><text x="26" y="54" class="fm-b">.execute()</text><text x="150" y="54" class="fm-c">— I don't want rows, just run it. Returns the rows-affected count. (INSERT / UPDATE / DELETE)</text>
  <rect x="14" y="70" width="640" height="30" rx="6" class="m2"/><text x="26" y="90" class="fm-b">.fetch_one()</text><text x="150" y="90" class="fm-c">— exactly ONE row. Errors if 0 rows or more than 1. (get-by-id you know exists)</text>
  <rect x="14" y="106" width="640" height="30" rx="6" class="m3"/><text x="26" y="126" class="fm-b">.fetch_optional()</text><text x="180" y="126" class="fm-c">— zero or one row → Option&lt;T&gt;. (look-up that might miss)</text>
  <rect x="14" y="142" width="640" height="30" rx="6" class="m4"/><text x="26" y="162" class="fm-b">.fetch_all()</text><text x="150" y="162" class="fm-c">— many rows → Vec&lt;T&gt;, all loaded into memory. (lists / reports)</text>
  <rect x="14" y="178" width="640" height="30" rx="6" class="m5"/><text x="26" y="198" class="fm-b">.fetch()</text><text x="150" y="198" class="fm-c">— many rows as a lazy Stream, one at a time. (huge result sets)</text>
</svg>
<figcaption>Pick the fetch method by the row count you expect. This choice, plus the query builder above, is 90% of using sqlx.</figcaption>
</figure>

In plain terms, each method answers a different question:

- **`.execute()`** — "just run this; I don't need any rows back." Returns a result whose `.rows_affected()` tells you how many rows changed. This is what you use for `INSERT`, `UPDATE`, and `DELETE`.
- **`.fetch_one()`** — "give me exactly one row." If the query returns zero rows you get `Error::RowNotFound`; if it returns several, that's also an error. Use it when the row *must* exist (a lookup by primary key you just created).
- **`.fetch_optional()`** — "there might be one row, or none." Returns `Option<T>` — `Some(row)` or `None`. This is the honest choice for "find by id" where the id might not exist.
- **`.fetch_all()`** — "give me every matching row as a `Vec`." Simple and common for lists, but it loads all rows into memory at once.
- **`.fetch()`** — "stream the rows to me one at a time." Returns a `Stream` you loop over with `.next().await`. Use it when a result set is too big to hold in memory (exporting a million rows).

```rust,ignore
// execute → rows changed
let deleted = sqlx::query!("DELETE FROM users WHERE id = $1", id)
    .execute(pool).await?
    .rows_affected();

// fetch_one → the row must exist
let user: User = sqlx::query_as!(User, "SELECT id, name, email FROM users WHERE id = $1", id)
    .fetch_one(pool).await?;

// fetch_optional → maybe there, maybe not
let maybe: Option<User> = sqlx::query_as!(User, "SELECT id, name, email FROM users WHERE email = $1", email)
    .fetch_optional(pool).await?;

// fetch_all → a list
let everyone: Vec<User> = sqlx::query_as!(User, "SELECT id, name, email FROM users ORDER BY id")
    .fetch_all(pool).await?;

// fetch → stream huge results without buffering
use futures::TryStreamExt;
let mut rows = sqlx::query!("SELECT id FROM events").fetch(pool);
while let Some(row) = rows.try_next().await? {
    // handle one row at a time…
    let _ = row.id;
}
```

## Binding parameters (and staying injection-safe)

Values never go *into* the SQL text — they travel separately as **bound parameters**. In a macro you list them after the SQL; with the `query()` function you chain `.bind(value)` in order. The database receives the query and the data on separate channels, so user input can never be mistaken for SQL.

```rust,ignore
// Macro: arguments follow the SQL, matched to $1, $2, … by position.
sqlx::query!("INSERT INTO users (name, email) VALUES ($1, $2)", name, email);

// Function: .bind() once per placeholder, in order.
sqlx::query("INSERT INTO users (name, email) VALUES ($1, $2)")
    .bind(name)
    .bind(email);
```

> [!key] Bound parameters prevent SQL injection
> Never build SQL by string concatenation with user data. Writing `format!("… WHERE name = '{name}'")` is the classic **SQL-injection** hole — a crafted `name` can rewrite your query. Bind parameters (`$1`, `.bind(…)`) send the query and the values separately, so input is always treated as *data*, never as *code*. Always bind; only ever build the *structure* of a query from trusted constants (like a fixed table name), never from user input.

## Mapping rows into your types: `FromRow`

`query_as!` maps columns to a struct's fields by name for you. For the runtime `query_as::<_, T>()` function, your struct opts in by deriving **`FromRow`**, which teaches sqlx how to read each field out of a row:

```rust,ignore
#[derive(Debug, sqlx::FromRow)]
struct Product {
    id: i64,
    #[sqlx(rename = "product_name")] // column is product_name, field is name
    name: String,
    price_cents: i64,
}
```

Sometimes you want a single field from a dynamic row without a struct — read it by name with `.get` (panics on a wrong name/type) or `.try_get` (returns a `Result`):

```rust,ignore
use sqlx::Row;
let row = sqlx::query("SELECT name, price_cents FROM products WHERE id = ?")
    .bind(id).fetch_one(pool).await?;
let name: String = row.get("name");          // by column name
let price: i64 = row.try_get("price_cents")?; // fallible version
```

## Generic reads: one function, any table, any type

You will get tired of writing `SELECT * FROM users`, `SELECT * FROM products`, `SELECT * FROM orders` and three near-identical functions to run them. This section builds a small family of **generic read functions** that work for *any* table and map into *any* type — and, just as importantly, shows where doing this becomes dangerous.

### The bound that makes it possible

Everything rests on one trait bound. `query_as::<_, T>()` can produce any `T` that knows how to build itself from a row:

```rust,ignore
T: for<'r> FromRow<'r, SqliteRow> + Send + Unpin
```

Read it piece by piece:

| Part | Why it's there |
|---|---|
| `FromRow<'r, SqliteRow>` | "`T` can be constructed from a row of this database" — the derive provides it |
| `for<'r>` | a **higher-ranked** bound: works for a row of *any* lifetime, because you don't know yet how long the borrowed row will live |
| `Send + Unpin` | the future crosses an `.await`, so it must be movable and sendable across threads |

The `for<'r>` is the part that trips people up. Without it you'd have to name a lifetime the caller can't possibly know; with it, you're saying "whatever lifetime the row turns out to have, `T` can be built from it." Swap `SqliteRow` for `PgRow` or `MySqlRow` to target a different database.

<figure class="diagram">
<svg viewBox="0 0 700 218" role="img" aria-label="A generic read pipeline: the table name is interpolated into the SQL string while values are sent separately as bind parameters; the database returns rows which FromRow maps into the caller's chosen type T.">
  <style>
    .gr-h { font: 700 11.5px var(--font-sans); }
    .gr-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .gr-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .gr-id { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.5; }
    .gr-val { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .gr-db { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .gr-t { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="14" y="18" class="gr-h">Two things vary — and they travel by completely different routes</text>
  <rect x="14" y="30" width="215" height="52" rx="7" class="gr-id"/>
  <text x="26" y="48" class="gr-h" fill="var(--amber)">identifier: T::TABLE</text>
  <text x="26" y="64" class="gr-c">spliced INTO the SQL text</text>
  <text x="26" y="77" class="gr-c">⚠ must come from a whitelist</text>
  <rect x="14" y="92" width="215" height="52" rx="7" class="gr-val"/>
  <text x="26" y="110" class="gr-h" fill="var(--green)">values: .bind(x)</text>
  <text x="26" y="126" class="gr-c">sent SEPARATELY from the SQL</text>
  <text x="26" y="139" class="gr-c">✓ injection-proof by construction</text>
  <rect x="278" y="58" width="150" height="60" rx="7" class="gr-db"/>
  <text x="292" y="80" class="gr-h" fill="var(--blue)">database</text>
  <text x="292" y="99" class="gr-c">returns SqliteRow /</text>
  <text x="292" y="112" class="gr-c">PgRow / MySqlRow</text>
  <rect x="478" y="58" width="208" height="60" rx="7" class="gr-t"/>
  <text x="492" y="80" class="gr-h" fill="var(--rust-700)">your type T</text>
  <text x="492" y="99" class="gr-m">FromRow::from_row(&amp;row)</text>
  <text x="492" y="112" class="gr-c">column names → struct fields</text>
  <path d="M231 56 L276 74" stroke="var(--amber)" stroke-width="1.6" marker-end="url(#gra)"/>
  <path d="M231 118 L276 102" stroke="var(--green)" stroke-width="1.6" marker-end="url(#gra)"/>
  <path d="M430 88 L474 88" stroke="var(--text-mute)" stroke-width="1.6" marker-end="url(#gra)"/>
  <text x="14" y="172" class="gr-c">A bind parameter can only ever be a <tspan font-weight="700">value</tspan>. There is no way to bind a table or column name —</text>
  <text x="14" y="188" class="gr-c">the database parses the SQL text before it looks at your parameters, so identifiers must already be there.</text>
  <text x="14" y="208" class="gr-c">That asymmetry is the single most important thing to understand in this section.</text>
  <defs><marker id="gra" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Values travel <b>outside</b> the SQL as bind parameters; identifiers must be <b>inside</b> it — so they need a whitelist.</figcaption>
</figure>

### Step 1: describe a table with a trait

Give each entity a trait that supplies its identifiers as **compile-time constants**. This is what makes the whole approach safe: the table name can never come from a request.

```rust,ignore
use sqlx::{FromRow, Sqlite, SqlitePool, QueryBuilder};
use sqlx::sqlite::SqliteRow;

/// Everything a generic read needs to know about a table.
pub trait Entity: for<'r> FromRow<'r, SqliteRow> + Send + Unpin {
    /// Hard-coded in source — never user input.
    const TABLE: &'static str;
    /// The whitelist for any column a caller is allowed to name.
    const COLUMNS: &'static [&'static str];
}

#[derive(Debug, FromRow)]
struct Product {
    id: i64,
    name: String,
    price_cents: i64,
}

impl Entity for Product {
    const TABLE: &'static str = "products";
    const COLUMNS: &'static [&'static str] = &["id", "name", "price_cents"];
}
```

### Step 2: the read functions

Seven variants cover almost every read you'll write. Each is generic over `T`, so implementing `Entity` once for a new struct gives you all of them for free:

```rust,ignore
// ── 1. Whole table ─────────────────────────────────────────────
async fn fetch_all<T: Entity>(pool: &SqlitePool) -> Result<Vec<T>, sqlx::Error> {
    let sql = format!("SELECT * FROM {}", T::TABLE);
    sqlx::query_as::<_, T>(sqlx::AssertSqlSafe(sql)).fetch_all(pool).await
}

// ── 2. One row by id → Option, because it might not exist ──────
async fn fetch_by_id<T: Entity>(pool: &SqlitePool, id: i64) -> Result<Option<T>, sqlx::Error> {
    let sql = format!("SELECT * FROM {} WHERE id = ?", T::TABLE);
    sqlx::query_as::<_, T>(sqlx::AssertSqlSafe(sql))
        .bind(id)                       // ← the VALUE is bound, never interpolated
        .fetch_optional(pool)
        .await
}

// ── 3. Filter by a caller-chosen column — the dangerous one ────
async fn fetch_where<T, V>(pool: &SqlitePool, column: &str, value: V) -> Result<Vec<T>, sqlx::Error>
where
    T: Entity,
    V: for<'q> sqlx::Encode<'q, Sqlite> + sqlx::Type<Sqlite> + Send + 'static,
{
    // The column name goes into the SQL TEXT, so it MUST be validated.
    if !T::COLUMNS.contains(&column) {
        return Err(sqlx::Error::Protocol(format!("unknown column `{column}`")));
    }
    let sql = format!("SELECT * FROM {} WHERE {} = ?", T::TABLE, column);
    sqlx::query_as::<_, T>(sqlx::AssertSqlSafe(sql)).bind(value).fetch_all(pool).await
}

// ── 4. Pagination ──────────────────────────────────────────────
async fn fetch_page<T: Entity>(pool: &SqlitePool, limit: i64, offset: i64)
    -> Result<Vec<T>, sqlx::Error>
{
    let sql = format!("SELECT * FROM {} ORDER BY id LIMIT ? OFFSET ?", T::TABLE);
    sqlx::query_as::<_, T>(sqlx::AssertSqlSafe(sql))
        .bind(limit).bind(offset)
        .fetch_all(pool).await
}

// ── 5. A scalar, no struct needed ──────────────────────────────
async fn count<T: Entity>(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let sql = format!("SELECT COUNT(*) FROM {}", T::TABLE);
    sqlx::query_scalar::<_, i64>(sqlx::AssertSqlSafe(sql)).fetch_one(pool).await
}
```

Note the second generic parameter on `fetch_where`. `V: Encode<'q, Sqlite> + Type<Sqlite>` means "any value this database knows how to send" — so the same function binds an `i64`, a `String`, or a `bool` without an overload each.

### Step 3: dynamic filters with `QueryBuilder`

`format!` stops scaling once the *shape* of the query varies — three optional filters mean eight possible SQL strings. `QueryBuilder` assembles SQL and its bind parameters together, so you can add clauses in a loop:

```rust,ignore
async fn search<T: Entity>(pool: &SqlitePool, filters: &[(&str, String)])
    -> Result<Vec<T>, sqlx::Error>
{
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("SELECT * FROM ");
    qb.push(T::TABLE);                       // constant — safe

    let mut first = true;
    for (col, val) in filters {
        if !T::COLUMNS.contains(col) { continue; }   // whitelist again
        qb.push(if first { " WHERE " } else { " AND " });
        first = false;
        qb.push(col);                        // identifier: validated, pushed as text
        qb.push(" = ");
        qb.push_bind(val.clone());           // value: bound, NOT pushed as text
    }

    qb.build_query_as::<T>().fetch_all(pool).await
}
```

The distinction between `push` and `push_bind` is the whole API: **`push` writes SQL text, `push_bind` adds a parameter**. Anything derived from user input belongs in `push_bind`.

### Step 4: map into a *different* type

Your read type doesn't have to match the table. Any struct deriving `FromRow` whose fields match the selected columns will do — which is how you return a slim DTO instead of a full row:

```rust,ignore
#[derive(Debug, FromRow)]
struct ProductSummary {      // no `id` — just what the caller needs
    name: String,
    price_cents: i64,
}

/// `T` says which table; `P` says what shape to return.
async fn fetch_projection<T: Entity, P>(pool: &SqlitePool, cols: &[&str])
    -> Result<Vec<P>, sqlx::Error>
where
    P: for<'r> FromRow<'r, SqliteRow> + Send + Unpin,
{
    for c in cols {
        if !T::COLUMNS.contains(c) {
            return Err(sqlx::Error::Protocol(format!("unknown column `{c}`")));
        }
    }
    let sql = format!("SELECT {} FROM {}", cols.join(", "), T::TABLE);
    sqlx::query_as::<_, P>(sqlx::AssertSqlSafe(sql)).fetch_all(pool).await
}
```

Calling it with two type parameters reads nicely: `fetch_projection::<Product, ProductSummary>(&pool, &["name", "price_cents"])`.

### All seven, running

Against an in-memory SQLite database seeded with three products:

```text
1 fetch_all      : 3
2 fetch_by_id(2) : Some("Mouse")
3 fetch_where    : 1
3b bad column    : true          ← "name; DROP TABLE products" rejected
4 fetch_page     : ["Mouse", "Monitor"]
5 count          : 3
6 search         : 1
7 projection     : [ProductSummary { name: "Keyboard", price_cents: 4999 }, …]
   table survived: 3 rows
```

Line `3b` is the one to notice: a column name of `name; DROP TABLE products` is refused by the `COLUMNS` whitelist before any SQL is built, and the final count confirms the table is intact.

### Which function for which job

| You want | Use | Returns |
|---|---|---|
| Every row | `fetch_all::<T>` | `Vec<T>` |
| One row that may not exist | `fetch_by_id::<T>` | `Option<T>` |
| One row that *must* exist | `.fetch_one` | `T`, or `RowNotFound` |
| Rows matching one column | `fetch_where::<T, V>` | `Vec<T>` |
| A page of results | `fetch_page::<T>` | `Vec<T>` |
| A single number | `count::<T>` / `query_scalar` | `i64` |
| Filters known only at runtime | `search::<T>` + `QueryBuilder` | `Vec<T>` |
| A narrower shape than the table | `fetch_projection::<T, P>` | `Vec<P>` |
| A huge result set | `.fetch(pool)` → a `Stream` | rows one at a time |

> [!warning] You cannot bind an identifier — this is the rule that keeps you safe
> `.bind()` sends a **value** alongside the query; the database has already parsed the SQL by then, which is exactly why binding is injection-proof. It also means a bind parameter can never be a table name, column name, `ORDER BY` direction, or `LIMIT` keyword. This fails, and not in a way you can work around:
> ```rust,ignore
> sqlx::query("SELECT * FROM ?").bind(table)      // ❌ syntax error at the database
> sqlx::query("SELECT * FROM users ORDER BY ?").bind(col)  // ❌ silently sorts by a constant
> ```
> So identifiers *must* be interpolated into the string — and the moment you interpolate, you own the injection risk. Three defences, in order of preference:
> 1. **A constant** (`T::TABLE`) that lives in your source and can't be influenced by a request. Best.
> 2. **A whitelist check** (`T::COLUMNS.contains(&column)`) when the caller genuinely chooses. Good.
> 3. **An enum** the caller must construct — `enum SortDir { Asc, Desc }` mapping to `"ASC"`/`"DESC"` — so the invalid case is unrepresentable. Best of all when the set is small and fixed.
>
> Never sanitise by escaping quotes yourself, and never let a raw request string reach `format!`. `ORDER BY` is the most-forgotten case: it takes an identifier *and* a direction, and both are attacker-reachable if you're careless.

> [!key] What you trade away: compile-time SQL checking
> Everything here uses the **runtime** `query_as` function rather than the `query_as!` **macro**, and that's not a style choice — it's forced. The macro connects to your database *at build time* to verify the SQL and infer result types, which requires the query to be a literal it can read. A query assembled from `T::TABLE` doesn't exist until runtime, so there is nothing to check.
>
> The practical consequence: a typo in a generic function's SQL becomes a **runtime** `sqlx::Error` instead of a build failure, and `FromRow` mismatches surface as a `ColumnNotFound` when the query runs. Two habits contain that:
> - Keep the generic layer **small and heavily tested** — it's a handful of functions covering boilerplate, and integration tests against a real database catch mistakes once for every entity that uses them.
> - Use the **checked macros for hand-written queries** — the complicated joins and reports where a mistake is likely and reuse is unlikely. Reserve the generic layer for the repetitive CRUD it's good at.
>
> This is the same trade as any reflection-style abstraction: less code, later errors. Knowing which side of the line a query belongs on is the skill.

> [!warning] sqlx 0.9 requires `AssertSqlSafe` for dynamic SQL
> The examples above wrap their `format!`ed strings in **`sqlx::AssertSqlSafe(sql)`**. That's new in **sqlx 0.9**, which added a `SqlSafeStr` trait so that passing a runtime-built `String` to `query_as` no longer compiles by default:
> ```text
> error[E0277]: dynamic SQL strings should be audited for possible injections
>    = help: the trait `SqlSafeStr` is not implemented for `&String`
>    = note: prefer literal SQL strings with bind parameters or `QueryBuilder`…
> ```
> On **sqlx 0.8** (the version this chapter's setup pins) you pass `&sql` directly and there is no wrapper. If you're on 0.9 or later, add `AssertSqlSafe` — and treat it as the compiler asking you to confirm you've done the whitelist work above, because that is precisely what the name means. It asserts; it does not check.

## Transactions: all-or-nothing

A **transaction** groups several statements so they either *all* succeed or *all* undo. You `begin()` one, run statements against it, then `commit()`. If you drop the transaction without committing (e.g. an error causes an early `?` return), sqlx automatically **rolls it back** — the database is left untouched.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A transaction: begin, run statements, then either commit to save all changes or roll back to discard them all">
  <style>
    .tx-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .tx-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .beg { fill: var(--blue-soft);  stroke: var(--blue);  stroke-width: 1.4; }
    .stmt{ fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.3; }
    .ok  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .bad { fill: var(--red-soft);   stroke: var(--red);   stroke-width: 1.5; }
  </style>
  <rect x="14"  y="60" width="96"  height="36" rx="8" class="beg"/><text x="26" y="83" class="tx-b">begin()</text>
  <rect x="130" y="40" width="150" height="28" rx="6" class="stmt"/><text x="142" y="59" class="tx-b">UPDATE … -amount</text>
  <rect x="130" y="88" width="150" height="28" rx="6" class="stmt"/><text x="142" y="107" class="tx-b">UPDATE … +amount</text>
  <path d="M110 78 L128 54" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#txa)"/>
  <path d="M110 78 L128 102" stroke="var(--text-mute)" stroke-width="1.3" marker-end="url(#txa)"/>
  <rect x="320" y="24" width="150" height="34" rx="8" class="ok"/><text x="332" y="46" class="tx-b" fill="var(--green)">commit() → saved</text>
  <rect x="320" y="98" width="220" height="34" rx="8" class="bad"/><text x="332" y="120" class="tx-b" fill="var(--red)">error/drop → rolled back</text>
  <path d="M280 54 L318 44" stroke="var(--green)" stroke-width="1.5" marker-end="url(#txa)"/>
  <path d="M280 102 L318 112" stroke="var(--red)" stroke-width="1.5" marker-end="url(#txa)"/>
  <defs><marker id="txa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Either every statement in the transaction sticks (<code>commit</code>) or none of them do (rollback on error/drop).</figcaption>
</figure>

```rust,ignore
async fn transfer(pool: &sqlx::PgPool, from: i64, to: i64, amount: i64) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;               // start

    // Run statements against the transaction with &mut *tx:
    sqlx::query!("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
        .execute(&mut *tx).await?;
    sqlx::query!("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
        .execute(&mut *tx).await?;                    // if this errors, the ? returns early…

    tx.commit().await?;                               // …and `tx` drops un-committed → auto rollback
    Ok(())
}
```

## Compile-time checking & offline builds

Because `query!`/`query_as!` verify against a real schema, they need one of two things at *build* time:

- a **live database** reachable via the `DATABASE_URL` environment variable, or
- a **cached schema**: run `cargo sqlx prepare` to save each query's metadata into a `.sqlx/` folder that you commit. CI and offline builds then compile with no database at all.

> [!note] This is the one bit of setup sqlx asks for
> The prepared cache (`.sqlx/`) is the price of compile-time safety: generate it whenever you add or change a checked query, and commit it. Prefer the `runtime` you already use (`runtime-tokio`) plus the driver feature for your database (`postgres`, `mysql`, or `sqlite`).

## Migrations & errors

**Migrations** version your schema in SQL files under `migrations/`, checked into git so every environment matches:

```bash,ignore
sqlx migrate add create_users     # scaffold a timestamped .sql file
sqlx migrate run                   # apply all pending migrations
```

You can also embed and run them from your app at startup with the `sqlx::migrate!()` macro.

**Errors** all come back as `sqlx::Error`. The variants you'll match on most:

- `Error::RowNotFound` — `fetch_one` found nothing.
- `Error::Database(e)` — the DB rejected it; `e.code()`/`e.constraint()` tell you *why* (e.g. a unique-constraint violation).
- `Error::PoolTimedOut` — no connection was free in time.

```rust,ignore
match get_user(pool, id).await {
    Ok(user) => { /* … */ }
    Err(sqlx::Error::RowNotFound) => { /* return a 404 */ }
    Err(e) => { /* log and return a 500 */ }
}
```

---

## Project: a generic CRUD handler with enums, structs & generics

Time to tie it together. Writing the same four functions (create, read, update, delete) for every table is tedious. We'll build **one generic handler** that performs any CRUD operation on *any* entity — using an **enum** to describe the operation, **structs** for the entities, a **trait** to teach the handler each table's SQL, and **generics** to make it reusable.

The pieces:

<figure class="diagram">
<svg viewBox="0 0 700 220" role="img" aria-label="A Crud enum describes the operation, entities implement a Repository trait supplying their SQL, and one generic handle function dispatches to sqlx and returns an Outcome enum">
  <style>
    .cr-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .cr-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cr-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .cmd { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
    .hnd { fill: var(--rust-100);    stroke: var(--rust-400); stroke-width: 1.5; }
    .rep { fill: var(--blue-soft);   stroke: var(--blue);   stroke-width: 1.4; }
    .out { fill: var(--green-soft);  stroke: var(--green);  stroke-width: 1.4; }
  </style>
  <rect x="14" y="30" width="150" height="120" rx="10" class="cmd"/>
  <text x="26" y="50" class="cr-h" fill="var(--purple)">Crud&lt;T&gt; enum</text>
  <text x="26" y="72" class="cr-b">Create(T)</text>
  <text x="26" y="90" class="cr-b">Read(id)</text>
  <text x="26" y="108" class="cr-b">Update(id, T)</text>
  <text x="26" y="126" class="cr-b">Delete(id)</text>
  <text x="26" y="144" class="cr-b">List</text>
  <rect x="260" y="60" width="170" height="60" rx="10" class="hnd"/>
  <text x="272" y="82" class="cr-h" fill="var(--rust-700)">handle&lt;T&gt;(pool, op)</text>
  <text x="272" y="104" class="cr-c">one function, any entity</text>
  <rect x="260" y="150" width="170" height="46" rx="10" class="rep"/>
  <text x="272" y="170" class="cr-h" fill="var(--blue)">Repository trait</text>
  <text x="272" y="188" class="cr-c">each entity's TABLE + SQL</text>
  <rect x="520" y="60" width="165" height="120" rx="10" class="out"/>
  <text x="532" y="80" class="cr-h" fill="var(--green)">Outcome&lt;T&gt; enum</text>
  <text x="532" y="102" class="cr-b">Created(id)</text>
  <text x="532" y="120" class="cr-b">One(Option&lt;T&gt;)</text>
  <text x="532" y="138" class="cr-b">Many(Vec&lt;T&gt;)</text>
  <text x="532" y="156" class="cr-b">Affected(u64)</text>
  <path d="M164 90 L258 90" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#cra)"/>
  <path d="M345 148 L345 122" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#cra)"/>
  <path d="M430 90 L518 90" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#cra)"/>
  <defs><marker id="cra" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The <b>command</b> enum in, the <b>outcome</b> enum out; one generic <code>handle</code> uses each entity's <code>Repository</code> impl to build the SQL.</figcaption>
</figure>

**Step 1 — the entities are plain structs** that derive `FromRow` (SQLite here; the same idea works for Postgres):

```rust,ignore
use sqlx::{FromRow, SqlitePool};

#[derive(Debug, FromRow)]
struct Product {
    id: i64,
    name: String,
    price_cents: i64,
}
```

**Step 2 — a `Crud<T>` enum describes the operation**, and an `Outcome<T>` enum describes the result (each operation returns a different shape, so an enum is the perfect fit):

```rust,ignore
enum Crud<T> {
    Create(T),
    Read(i64),
    Update(i64, T),
    Delete(i64),
    List,
}

#[derive(Debug)]
enum Outcome<T> {
    Created(i64),        // new row id
    One(Option<T>),      // a single (maybe-missing) row
    Many(Vec<T>),        // a list
    Affected(u64),       // rows changed by update/delete
}
```

**Step 3 — a `Repository` trait** teaches the generic handler the parts that *must* differ per table: its name, and how to bind its fields for insert/update. (Table names come from a **trusted constant**, never user input — so building the read/list/delete SQL with `format!` is injection-safe; all values still go through `.bind`.)

```rust,ignore
// async fn in traits is stable since Rust 1.75.
trait Repository:
    for<'r> FromRow<'r, sqlx::sqlite::SqliteRow> + Send + Unpin + Sized
{
    const TABLE: &'static str;
    async fn insert(&self, pool: &SqlitePool) -> Result<i64, sqlx::Error>;
    async fn update(&self, id: i64, pool: &SqlitePool) -> Result<u64, sqlx::Error>;
}
```

**Step 4 — ONE generic handler** for every entity and every operation:

```rust,ignore
async fn handle<T: Repository>(pool: &SqlitePool, op: Crud<T>) -> Result<Outcome<T>, sqlx::Error> {
    match op {
        Crud::Create(item) => Ok(Outcome::Created(item.insert(pool).await?)),

        Crud::Read(id) => {
            let sql = format!("SELECT * FROM {} WHERE id = ?", T::TABLE); // T::TABLE is a constant
            let row = sqlx::query_as::<_, T>(&sql).bind(id).fetch_optional(pool).await?;
            Ok(Outcome::One(row))
        }

        Crud::Update(id, item) => Ok(Outcome::Affected(item.update(id, pool).await?)),

        Crud::Delete(id) => {
            let sql = format!("DELETE FROM {} WHERE id = ?", T::TABLE);
            let res = sqlx::query(&sql).bind(id).execute(pool).await?;
            Ok(Outcome::Affected(res.rows_affected()))
        }

        Crud::List => {
            let sql = format!("SELECT * FROM {}", T::TABLE);
            let rows = sqlx::query_as::<_, T>(&sql).fetch_all(pool).await?;
            Ok(Outcome::Many(rows))
        }
    }
}
```

**Step 5 — implement `Repository` once per entity** (the only per-table code you write):

```rust,ignore
impl Repository for Product {
    const TABLE: &'static str = "products";

    async fn insert(&self, pool: &SqlitePool) -> Result<i64, sqlx::Error> {
        let res = sqlx::query("INSERT INTO products (name, price_cents) VALUES (?, ?)")
            .bind(&self.name)
            .bind(self.price_cents)
            .execute(pool)
            .await?;
        Ok(res.last_insert_rowid())
    }

    async fn update(&self, id: i64, pool: &SqlitePool) -> Result<u64, sqlx::Error> {
        let res = sqlx::query("UPDATE products SET name = ?, price_cents = ? WHERE id = ?")
            .bind(&self.name)
            .bind(self.price_cents)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(res.rows_affected())
    }
}
```

**Now the whole CRUD surface is one call**, for `Product` — or any future entity that implements `Repository`:

```rust,ignore
async fn demo(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // CREATE
    let new_id = match handle(pool, Crud::Create(Product { id: 0, name: "Keyboard".into(), price_cents: 4999 })).await? {
        Outcome::Created(id) => id,
        _ => unreachable!(),
    };

    // READ (maybe-missing → Option)
    if let Outcome::One(Some(p)) = handle::<Product>(pool, Crud::Read(new_id)).await? {
        println!("read: {p:?}");
    }

    // UPDATE
    handle(pool, Crud::Update(new_id, Product { id: new_id, name: "Keyboard Pro".into(), price_cents: 6999 })).await?;

    // LIST
    if let Outcome::Many(all) = handle::<Product>(pool, Crud::List).await? {
        println!("{} product(s)", all.len());
    }

    // DELETE
    handle::<Product>(pool, Crud::Delete(new_id)).await?;
    Ok(())
}
```

To add a `User` table tomorrow, you write one struct and one `impl Repository for User` — the enum, the outcome, and the generic `handle` are reused unchanged. That's the payoff of combining enums, structs, generics, and traits over sqlx.

> [!best] Keep the checked macros where you can
> This generic handler uses the *runtime* `query`/`query_as` functions because the table name is only known through the generic `T` — so it trades a little of sqlx's compile-time checking for reusability. That's a fair trade for boilerplate CRUD, but for your important, hand-written queries, prefer the checked `query!`/`query_as!` macros so mistakes stay build errors.

## Summary

- **sqlx** gives async database access with **compile-time-checked SQL** — invalid queries become build errors (via `query!`/`query_as!`). Alternatives: **SeaORM**/**Diesel** (ORMs), **rusqlite** (thin SQLite).
- Connect with a **pool** created once and shared; the pool type matches your database (`PgPool`/`MySqlPool`/`SqlitePool`).
- **Build** a query with the checked macros (`query!`, `query_as!`, `query_scalar!`) or the runtime functions (`query`, `query_as`) for dynamic SQL.
- **Fetch** by expected row count: `execute` (none → rows-affected), `fetch_one` (exactly one), `fetch_optional` (zero/one → `Option`), `fetch_all` (many → `Vec`), `fetch` (a lazy `Stream`).
- Always **bind parameters** (`$1`, `.bind`) — never concatenate user input — to stop SQL injection. Map rows with **`FromRow`**, group writes in **transactions** (`begin` → `commit`, auto-rollback on drop), version schemas with **migrations**, and match on **`sqlx::Error`** variants.
- You built a **generic CRUD handler** from a `Crud<T>` enum, an `Outcome<T>` enum, a `Repository` trait, and one generic `handle` function — reusable for every table.

> [!exercise] Try it yourself (locally, with a database)
> 1. Set up SQLite with sqlx, add a `products` table via a migration, and run the generic handler above.
> 2. Add a second entity (`User`) by writing one struct + one `impl Repository for User` — reuse `handle` unchanged.
> 3. Swap a `Read` to use `fetch_one` and observe the `RowNotFound` error when the id is missing; then switch back to `fetch_optional`.
> 4. Wrap a create + update in a transaction and confirm a failure rolls both back.

sqlx keeps you close to the SQL. Next, we look at the higher-level alternative — treating your
tables as Rust types with the **SeaORM** ORM.
