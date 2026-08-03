<h1><span class="h1-kicker">The Crate Ecosystem</span>SeaORM: An Async ORM</h1>

[sqlx](#/ch/sqlx) lets you write SQL by hand with compile-time checks. **SeaORM** takes the other approach: it's a full **ORM** (Object-Relational Mapper) that lets you work with your database as Rust *structs and methods* instead of raw SQL — `User::find().filter(...).all(&db).await?` rather than a `SELECT` string. It's async, built on top of sqlx, and designed for dynamic queries and relationships.

This chapter is thorough. We cover the whole ORM: entities and how Rust types map to columns, every kind of CRUD, deep query building (filters, joins, aggregates, pagination), all four relationship shapes with eager/lazy loading, transactions, `ActiveEnum`s, migrations, the raw-SQL escape hatch, and testing with a mock database. Then you'll design a complete **e-commerce database schema** — users, products, orders, and more — with migrations, entities, and realistic queries. (SeaORM needs its crate and a running database, so examples are illustrative — run them in a local project.)

## What an ORM is, and why you'd want one

> [!jargon] ORM (Object-Relational Mapper)
> An **ORM** maps database tables to types in your programming language: a row becomes a struct, a
> table becomes a type, and you query and mutate data by calling methods instead of writing SQL. It
> handles the translation to and from SQL for you. The trade-off is a layer of abstraction: more
> convenience and safety for common operations, at the cost of some control over the exact SQL.

> [!key] SeaORM vs. sqlx — two philosophies
> - **[sqlx](#/ch/sqlx)**: *you write the SQL.* It checks your queries against the real schema at
>   compile time. Maximum control, closest to the database, minimal magic.
> - **SeaORM**: *you describe your tables as Rust types* and build queries with a fluent API. Less
>   SQL to write, first-class support for **relationships** and **dynamic** (runtime-built) queries,
>   at the cost of an abstraction layer.
>
> Neither is "better" — sqlx suits SQL-comfortable teams and hand-tuned queries; SeaORM suits
> apps with lots of CRUD, complex relations, or queries assembled at runtime. Since SeaORM is built
> *on* sqlx, you can even drop down to raw sqlx queries when you need to.

## Setup

SeaORM is async (works with tokio) and supports PostgreSQL, MySQL, and SQLite. The companion tool
`sea-orm-cli` generates entity code and manages migrations:

```toml
# Cargo.toml
[dependencies]
sea-orm = { version = "1.0", features = ["sqlx-postgres", "runtime-tokio-rustls", "macros", "with-chrono", "with-rust_decimal"] }
tokio = { version = "1", features = ["full"] }

# The migration framework lives in its own sub-crate (usually a `migration/` member crate):
sea-orm-migration = "1.0"
```

```bash
cargo install sea-orm-cli   # the code generator + migration tool
```

> [!tip] Feature flags decide your capabilities
> Pick a **driver** (`sqlx-postgres`, `sqlx-mysql`, or `sqlx-sqlite`), a **runtime/TLS** combo
> (`runtime-tokio-rustls` is the common default), and any **type integrations** you need
> (`with-chrono` or `with-time` for timestamps, `with-uuid`, `with-rust_decimal` or `with-bigdecimal`
> for money, `with-json` for JSON columns). Missing a `with-*` feature is the usual cause of "the
> trait `TryGetable` is not implemented" errors.

## Connecting

You connect once and share the connection (like sqlx's pool or reqwest's client). For real apps,
configure the pool through `ConnectOptions`:

```rust,ignore
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), sea_orm::DbErr> {
    let mut opt = ConnectOptions::new("postgres://user:pass@localhost/shop");
    opt.max_connections(20)
        .min_connections(2)
        .connect_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(30))
        .sqlx_logging(true);                 // log the generated SQL — invaluable while learning

    let db: DatabaseConnection = Database::connect(opt).await?;
    println!("connected: {}", db.ping().await.is_ok());
    Ok(())
}
```

The `DatabaseConnection` is cheap to clone (it's a handle to a shared pool) — store it in your app
state and pass `&db` everywhere.

## Entities: your tables as Rust types

The heart of SeaORM is the **entity** — a module describing one table. You usually *generate*
entities from an existing database with `sea-orm-cli generate entity`, but here's what one looks
like so you understand the pieces:

```rust,ignore
use sea_orm::entity::prelude::*;

// The `Model` is a plain row: the shape of one record.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]                 // a UNIQUE constraint
    pub email: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTimeUtc,       // needs the `with-chrono` feature
}

// Relations to other entities are declared here (empty for now).
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

// Boilerplate that ties it together (usually generated for you).
impl ActiveModelBehavior for ActiveModel {}
```

That one `DeriveEntityModel` macro generates four things you'll use constantly:

- **`Model`** — a fetched row (the struct above).
- **`ActiveModel`** — a write buffer with every field wrapped in `ActiveValue`.
- **`Entity`** — the table handle you call `find()`, `insert()`, etc. on.
- **`Column`** — an enum of the columns, for building queries (`Column::Email`).

### How Rust field types map to columns

SeaORM infers the SQL column type from the Rust field type. The common mappings:

| Rust field type | Column type | Notes |
|---|---|---|
| `i16` / `i32` / `i64` | `SmallInt` / `Integer` / `BigInteger` | |
| `f32` / `f64` | `Float` / `Double` | not for money |
| `bool` | `Boolean` | |
| `String` | `Varchar` / `Text` | |
| `Option<T>` | **nullable** column | `NULL` ⇒ `None` |
| `Decimal` (rust_decimal) | `Decimal` | the right choice for **money** |
| `DateTimeUtc` (chrono) | `Timestamp with time zone` | needs `with-chrono` |
| `Uuid` | `Uuid` | needs `with-uuid` |
| `Json` (`serde_json::Value`) | `Json` / `Jsonb` | needs `with-json` |
| `Vec<u8>` | `Binary` / `Blob` | |
| an `ActiveEnum` | native `ENUM` or string/int | see below |

Override the inferred type or add constraints with `#[sea_orm(...)]` attributes:

```rust,ignore
#[sea_orm(column_type = "Decimal(Some((12, 2)))")] // precise money column
pub price: Decimal,
#[sea_orm(column_name = "full_name")]              // column named differently from the field
pub name: String,
#[sea_orm(nullable)]                                // explicit nullable
pub deleted_at: Option<DateTimeUtc>,
```

> [!jargon] Model vs. ActiveModel
> SeaORM gives you two views of a row. A **`Model`** is a *read* result — a plain struct holding the
> data you fetched. An **`ActiveModel`** is a *write* buffer — the same fields, each wrapped so
> SeaORM can track which ones you've *set* versus left unchanged, so an update only touches the
> columns you actually modified. You read into `Model`s and write through `ActiveModel`s.

### `ActiveValue`: `Set`, `NotSet`, `Unchanged`

Every field of an `ActiveModel` is an `ActiveValue` in one of three states, and this is what makes
partial updates work:

- **`Set(value)`** — "write this value" (an insert or an update to this column).
- **`NotSet`** — "I haven't touched this" (skipped on insert → uses the DB default; skipped on update).
- **`Unchanged(value)`** — the value as loaded from the DB (used to build the `WHERE` on update).

```rust,ignore
use sea_orm::ActiveValue::{Set, NotSet};

let partial = user::ActiveModel {
    name: Set("New Name".to_owned()), // only this column will be written
    ..Default::default()               // everything else is NotSet
};
```

## Custom enum columns with `ActiveEnum`

Real schemas have status/kind columns with a fixed set of values. `DeriveActiveEnum` maps a Rust
enum to a column — stored as a string, an integer, or a native database `ENUM`:

```rust,ignore
use sea_orm::entity::prelude::*;

#[derive(EnumIter, DeriveActiveEnum, Clone, Debug, PartialEq, Eq)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(16))")]
pub enum OrderStatus {
    #[sea_orm(string_value = "pending")]
    Pending,
    #[sea_orm(string_value = "paid")]
    Paid,
    #[sea_orm(string_value = "shipped")]
    Shipped,
    #[sea_orm(string_value = "cancelled")]
    Cancelled,
}
```

Now a field `pub status: OrderStatus` is fully type-checked — you can `.filter(Column::Status.eq(OrderStatus::Paid))`
and never deal with a stray string.

## CRUD operations

With an entity defined, the four basic operations read fluently:

```rust,ignore
use sea_orm::*;
use entity::user; // the entity module from above

async fn crud(db: &DatabaseConnection) -> Result<(), DbErr> {
    // CREATE — build an ActiveModel and insert it:
    let new_user = user::ActiveModel {
        name: Set("Ferris".to_owned()),
        email: Set("ferris@crab.dev".to_owned()),
        ..Default::default()          // id is auto-generated
    };
    let inserted: user::Model = new_user.insert(db).await?;

    // READ — by primary key, or with filters:
    let one = user::Entity::find_by_id(inserted.id).one(db).await?;
    let crabs = user::Entity::find()
        .filter(user::Column::Name.contains("Ferris"))
        .order_by_asc(user::Column::Id)
        .all(db)
        .await?;

    // UPDATE — turn a Model into an ActiveModel, change fields, save:
    let mut editable: user::ActiveModel = one.unwrap().into();
    editable.email = Set("ferris@rust-lang.org".to_owned());
    editable.update(db).await?;

    // DELETE — by primary key:
    user::Entity::delete_by_id(inserted.id).exec(db).await?;

    println!("found {} matching users", crabs.len());
    Ok(())
}
```

Notice you never wrote SQL: `find()`, `filter()`, `order_by_asc()`, `insert()`, `update()`,
`delete_by_id()` build and run it for you, and results come back as typed `Model`s.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="SeaORM maps Rust entities to database tables and is layered on top of sqlx">
  <style>
    .som2 { font: 600 12px var(--font-mono); fill: var(--text); }
    .soc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ent { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .lyr { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .tbl { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="30" y="20" width="180" height="50" rx="8" class="ent"/>
  <text x="44" y="42" class="som2">user::Model</text><text x="44" y="60" class="soc2">id, name, email (Rust)</text>
  <rect x="430" y="20" width="180" height="50" rx="8" class="tbl"/>
  <text x="444" y="42" class="som2">users (table)</text><text x="444" y="60" class="soc2">id | name | email (SQL)</text>
  <path d="M212 45 L428 45" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#aso)"/>
  <path d="M428 55 L214 55" stroke="var(--rust-500)" stroke-width="2" marker-end="url(#aso2)"/>
  <text x="250" y="38" class="soc2">SeaORM maps structs ⇄ rows</text>
  <rect x="180" y="110" width="280" height="40" rx="8" class="lyr"/>
  <text x="194" y="134" class="som2">SeaORM  →  built on sqlx  →  the driver</text>
  <text x="30" y="150" class="soc2"></text>
  <defs>
    <marker id="aso" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
    <marker id="aso2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>SeaORM maps your Rust entities to and from table rows, and sits on top of sqlx and the database driver.</figcaption>
</figure>

### Beyond one row: batch, upsert, and bulk operations

```rust,ignore
// Insert MANY rows in one statement:
product::Entity::insert_many(vec![am1, am2, am3]).exec(db).await?;

// UPSERT — insert, or update on conflict (great for idempotent imports):
use sea_orm::sea_query::OnConflict;
product::Entity::insert(am)
    .on_conflict(
        OnConflict::column(product::Column::Sku)   // if this SKU already exists…
            .update_column(product::Column::Price)  // …just update the price
            .to_owned(),
    )
    .exec(db)
    .await?;

// UPDATE MANY with a WHERE — no need to load rows first:
product::Entity::update_many()
    .col_expr(product::Column::Price, Expr::col(product::Column::Price).mul(1.1)) // +10%
    .filter(product::Column::CategoryId.eq(3))
    .exec(db)
    .await?;

// DELETE MANY:
product::Entity::delete_many()
    .filter(product::Column::IsActive.eq(false))
    .exec(db)
    .await?;

// COUNT:
let n = product::Entity::find().filter(product::Column::IsActive.eq(true)).count(db).await?;
```

## Querying in depth

The fluent query builder is where SeaORM shines for dynamic queries. Everything below composes.

### Conditions: `and`, `or`, and operators

```rust,ignore
use sea_orm::{Condition, ColumnTrait};

let results = product::Entity::find()
    .filter(
        Condition::all()                                   // AND
            .add(product::Column::IsActive.eq(true))
            .add(product::Column::PriceCents.gte(1000))
            .add(
                Condition::any()                           // nested OR
                    .add(product::Column::Name.contains("pro"))
                    .add(product::Column::Name.contains("max")),
            ),
    )
    .all(db)
    .await?;
```

Common column operators: `.eq` `.ne` `.gt` `.gte` `.lt` `.lte`, `.like` `.contains` `.starts_with`,
`.is_in([..])` `.is_null()` `.between(a, b)`.

### Selecting only some columns

Fetching a whole `Model` when you need two columns is wasteful. Select specific columns into a custom
struct with `FromQueryResult`:

```rust,ignore
#[derive(FromQueryResult)]
struct NameEmail { name: String, email: String }

let rows: Vec<NameEmail> = user::Entity::find()
    .select_only()
    .column(user::Column::Name)
    .column(user::Column::Email)
    .into_model::<NameEmail>()
    .all(db)
    .await?;
```

### Aggregates and grouping

```rust,ignore
use sea_orm::sea_query::Expr;

#[derive(FromQueryResult)]
struct CategoryStats { category_id: i32, product_count: i64, avg_price: Option<Decimal> }

let stats: Vec<CategoryStats> = product::Entity::find()
    .select_only()
    .column(product::Column::CategoryId)
    .column_as(product::Column::Id.count(), "product_count")
    .column_as(product::Column::PriceCents.into_expr().cast_as("decimal").avg(), "avg_price")
    .group_by(product::Column::CategoryId)
    .into_model::<CategoryStats>()
    .all(db)
    .await?;
```

### Pagination and streaming

```rust,ignore
// Page through results 20 at a time:
let mut pages = product::Entity::find()
    .order_by_asc(product::Column::Id)
    .paginate(db, 20);

let total_items = pages.num_items().await?;
let total_pages = pages.num_pages().await?;
let first_page: Vec<product::Model> = pages.fetch_page(0).await?; // page index is 0-based

// Or STREAM a huge result set without loading it all into memory:
use futures::StreamExt;
let mut stream = product::Entity::find().stream(db).await?;
while let Some(row) = stream.next().await {
    let product = row?;
    // process one row at a time…
}
```

## Relationships

Where an ORM really earns its keep is **relationships**. SeaORM models all four shapes; you declare
them once in the `Relation` enum and then load related data without hand-writing joins.

<figure class="diagram">
<svg viewBox="0 0 700 210" role="img" aria-label="The four relationship shapes: one-to-one, one-to-many, many-to-one belongs_to, and many-to-many through a junction table">
  <style>
    .rl-t { font: 700 12px var(--font-sans); fill: var(--text); }
    .rl-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .rl-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .e1 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .e2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .e3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.4; }
  </style>
  <text x="10" y="20" class="rl-t">has_one (1:1)</text>
  <rect x="10" y="30" width="70" height="28" class="e1"/><text x="24" y="49" class="rl-b">user</text>
  <path d="M80 44 L150 44" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <rect x="150" y="30" width="80" height="28" class="e2"/><text x="164" y="49" class="rl-b">profile</text>

  <text x="380" y="20" class="rl-t">has_many (1:N)</text>
  <rect x="380" y="30" width="70" height="28" class="e1"/><text x="394" y="49" class="rl-b">user</text>
  <path d="M450 40 L520 32" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <path d="M450 48 L520 56" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <rect x="520" y="24" width="80" height="22" class="e2"/><text x="534" y="40" class="rl-b">order</text>
  <rect x="520" y="52" width="80" height="22" class="e2"/><text x="534" y="68" class="rl-b">order</text>

  <text x="10" y="110" class="rl-t">belongs_to (N:1)</text>
  <rect x="10" y="120" width="80" height="28" class="e2"/><text x="24" y="139" class="rl-b">product</text>
  <path d="M90 134 L160 134" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <rect x="160" y="120" width="90" height="28" class="e1"/><text x="174" y="139" class="rl-b">category</text>
  <text x="10" y="168" class="rl-c">product.category_id → category.id</text>

  <text x="380" y="110" class="rl-t">many_to_many (N:M via junction)</text>
  <rect x="380" y="120" width="70" height="28" class="e2"/><text x="392" y="139" class="rl-b">order</text>
  <rect x="480" y="120" width="90" height="28" class="e3"/><text x="490" y="139" class="rl-b">order_item</text>
  <rect x="600" y="120" width="80" height="28" class="e1"/><text x="612" y="139" class="rl-b">product</text>
  <path d="M450 134 L478 134" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <path d="M570 134 L598 134" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rla)"/>
  <text x="380" y="180" class="rl-c">a junction table links the two sides</text>
  <defs><marker id="rla" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The four relationship shapes SeaORM models. <code>belongs_to</code> holds the foreign key; the other side is <code>has_one</code>/<code>has_many</code>.</figcaption>
</figure>

### Declaring relations

```rust,ignore
// In product's entity — a product belongs to one category:
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::category::Entity",
        from = "Column::CategoryId",
        to = "super::category::Column::Id"
    )]
    Category,
    #[sea_orm(has_many = "super::order_item::Entity")]
    OrderItem,
}

// Implement `Related` so you can traverse the link in queries:
impl Related<super::category::Entity> for Entity {
    fn to() -> RelationDef { Relation::Category.def() }
}
```

### Eager loading: fetch related data together

```rust,ignore
// find_with_related → Vec<(Parent, Vec<Child>)>  (one-to-many)
let orders_with_items: Vec<(order::Model, Vec<order_item::Model>)> =
    order::Entity::find()
        .filter(order::Column::UserId.eq(user_id))
        .find_with_related(order_item::Entity)   // the JOIN happens for you
        .all(db)
        .await?;

// find_also_related → Vec<(Model, Option<Related>)>  (one-to-one / many-to-one)
let products_with_category: Vec<(product::Model, Option<category::Model>)> =
    product::Entity::find()
        .find_also_related(category::Entity)
        .all(db)
        .await?;
```

### Many-to-many via a junction

Add a `via()` to `Related` and SeaORM traverses *two* joins for you — e.g. every product that appears
in a given order, through the `order_item` junction:

```rust,ignore
impl Related<super::product::Entity> for order::Entity {
    fn to() -> RelationDef { super::order_item::Relation::Product.def() }
    fn via() -> Option<RelationDef> {
        Some(super::order_item::Relation::Order.def().rev()) // hop through the junction
    }
}

let products_in_order = order::Entity::find_by_id(order_id)
    .find_with_related(product::Entity) // orders ⇄ products, transparently
    .all(db)
    .await?;
```

### Lazy loading: fetch related data on demand

When you already hold a `Model`, load its relations directly:

```rust,ignore
let user = user::Entity::find_by_id(1).one(db).await?.unwrap();
let their_orders: Vec<order::Model> = user.find_related(order::Entity).all(db).await?;
```

> [!mistake] The N+1 query trap
> The classic ORM pitfall: looping over N parents and lazily loading each one's children fires **N+1**
> separate queries instead of one join. Prefer eager loading (`find_with_related`, `find_also_related`,
> or `load_many`/`load_one` for a batch you already have) so related data comes back in a single round
> trip. Turn on `sqlx_logging(true)` and *watch the SQL* — if you see the same query repeated in a
> loop, you've hit N+1.

## Transactions

Multi-step writes that must all succeed (or all fail) belong in a **transaction**. SeaORM offers a
closure form that commits on `Ok` and rolls back on `Err` automatically:

```rust,ignore
use sea_orm::TransactionTrait;

db.transaction::<_, i32, DbErr>(|txn| {
    Box::pin(async move {
        let order = order::ActiveModel { /* … */ ..Default::default() }.insert(txn).await?;
        for item in items {
            order_item::ActiveModel {
                order_id: Set(order.id),
                /* … */
                ..Default::default()
            }
            .insert(txn)
            .await?;
        }
        Ok(order.id) // committed; return the new order id
    })
})
.await?;
```

Or manage it by hand when you need finer control:

```rust,ignore
let txn = db.begin().await?;
// … run several statements against &txn …
txn.commit().await?;   // or txn.rollback().await?;
```

## Migrations

SeaORM includes a **migration** framework so your schema is versioned in code and every environment
stays in sync. You write migrations as Rust (using a schema-builder API, so they're database-
agnostic) and run them with the CLI:

```bash
sea-orm-cli migrate generate create_users_table  # scaffold a new migration
sea-orm-cli migrate up                            # apply pending migrations
sea-orm-cli migrate down                          # roll the last one back
```

A migration is a struct with `up`/`down` methods that build the schema:

```rust,ignore
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(Users::Email).string().not_null().unique_key())
                    .col(ColumnDef::new(Users::Name).string().not_null())
                    .col(ColumnDef::new(Users::CreatedAt).timestamp_with_time_zone().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Users::Table).to_owned()).await
    }
}

// Column/table names as an enum (so typos are compile errors):
#[derive(DeriveIden)]
enum Users { Table, Id, Email, Name, CreatedAt }
```

> [!best] Generate entities from your schema, don't hand-write them
> The idiomatic SeaORM workflow: manage your schema with **migrations**, then run
> `sea-orm-cli generate entity -o src/entities` to auto-generate the entity structs *from* the live
> database. This keeps your Rust types perfectly in sync with the real schema — regenerate after any
> migration. Writing entities by hand (as we do here for illustration) is error-prone; let the
> tool do it.

## The raw-SQL escape hatch & testing

Because SeaORM sits on sqlx, you can always drop to raw SQL when the query builder is awkward:

```rust,ignore
use sea_orm::{Statement, DbBackend, FromQueryResult};

#[derive(FromQueryResult)]
struct Report { month: String, revenue: Decimal }

let report = Report::find_by_statement(Statement::from_sql_and_values(
    DbBackend::Postgres,
    r#"SELECT to_char(created_at, 'YYYY-MM') AS month, SUM(total_cents)/100.0 AS revenue
       FROM orders GROUP BY month ORDER BY month"#,
    [],
))
.all(&db)
.await?;
```

And you can **unit-test** query logic with no database using `MockDatabase` (feature `mock`):

```rust,ignore
use sea_orm::{MockDatabase, DatabaseBackend};

let db = MockDatabase::new(DatabaseBackend::Postgres)
    .append_query_results([vec![user::Model { id: 1, name: "Test".into(), /* … */ }]])
    .into_connection();
// call your function with &db and assert on the result — fast, deterministic, no DB needed.
```

---

## Project: an e-commerce database schema

Now the big one. You'll model the database behind an online store — the kind of schema that powers a
real shop's checkout and admin panel. It exercises **every** relationship shape, an `ActiveEnum`,
foreign keys, money columns, and multi-step transactional writes.

**The tables (seven):**

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | customer accounts | has many addresses, orders, reviews |
| `addresses` | shipping/billing addresses | belongs to a user |
| `categories` | product categories | has many products |
| `products` | the catalog | belongs to a category; has many order_items, reviews |
| `orders` | a placed order | belongs to a user; has many order_items; has a status enum |
| `order_items` | line items (the junction) | belongs to an order and a product |
| `reviews` | product reviews | belongs to a user and a product |

### The entity-relationship diagram

<figure class="diagram">
<svg viewBox="0 0 720 440" role="img" aria-label="Entity-relationship diagram of the e-commerce schema: users have addresses, orders, and reviews; categories have products; orders have order items; products have order items and reviews; order items form the junction between orders and products">
  <style>
    .er-t { font: 700 12px var(--font-sans); fill: var(--text); }
    .er-c { font: 10.5px var(--font-mono); fill: var(--text-mute); }
    .er-l { font: 10px var(--font-sans); fill: var(--rust-600); }
    .u  { fill: var(--blue-soft);   stroke: var(--blue);   stroke-width: 1.5; }
    .cat{ fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .p  { fill: var(--green-soft);  stroke: var(--green);  stroke-width: 1.5; }
    .o  { fill: var(--amber-soft);  stroke: var(--amber);  stroke-width: 1.5; }
    .oi { fill: var(--rust-100);    stroke: var(--rust-400); stroke-width: 1.5; }
    .r  { fill: var(--surface-2);   stroke: var(--border-strong); stroke-width: 1.5; }
    .ln { stroke: var(--text-mute); stroke-width: 1.4; }
  </style>
  <!-- users -->
  <rect x="290" y="20" width="150" height="66" rx="8" class="u"/>
  <text x="304" y="40" class="er-t">users</text>
  <text x="304" y="58" class="er-c">id, email, name</text>
  <text x="304" y="74" class="er-c">is_active, created_at</text>
  <!-- categories -->
  <rect x="30" y="20" width="150" height="52" rx="8" class="cat"/>
  <text x="44" y="40" class="er-t">categories</text>
  <text x="44" y="58" class="er-c">id, name, slug</text>
  <!-- addresses -->
  <rect x="540" y="20" width="150" height="66" rx="8" class="r"/>
  <text x="554" y="40" class="er-t">addresses</text>
  <text x="554" y="58" class="er-c">id, user_id(FK)</text>
  <text x="554" y="74" class="er-c">line1, city, country</text>
  <!-- products -->
  <rect x="30" y="180" width="150" height="82" rx="8" class="p"/>
  <text x="44" y="200" class="er-t">products</text>
  <text x="44" y="218" class="er-c">id, category_id(FK)</text>
  <text x="44" y="234" class="er-c">name, sku(unique)</text>
  <text x="44" y="250" class="er-c">price_cents, stock</text>
  <!-- orders -->
  <rect x="290" y="180" width="150" height="82" rx="8" class="o"/>
  <text x="304" y="200" class="er-t">orders</text>
  <text x="304" y="218" class="er-c">id, user_id(FK)</text>
  <text x="304" y="234" class="er-c">status(enum)</text>
  <text x="304" y="250" class="er-c">total_cents, created_at</text>
  <!-- order_items (junction) -->
  <rect x="160" y="330" width="180" height="82" rx="8" class="oi"/>
  <text x="174" y="350" class="er-t">order_items</text>
  <text x="174" y="368" class="er-c">id, order_id(FK)</text>
  <text x="174" y="384" class="er-c">product_id(FK)</text>
  <text x="174" y="400" class="er-c">quantity, unit_cents</text>
  <!-- reviews -->
  <rect x="500" y="330" width="180" height="82" rx="8" class="r"/>
  <text x="514" y="350" class="er-t">reviews</text>
  <text x="514" y="368" class="er-c">id, user_id(FK)</text>
  <text x="514" y="384" class="er-c">product_id(FK)</text>
  <text x="514" y="400" class="er-c">rating, body</text>

  <!-- edges -->
  <path d="M290 50 L180 46" class="ln" marker-end="url(#era)"/>        <!-- users? no: categories independent; skip -->
  <path d="M440 50 L540 50" class="ln" marker-end="url(#era)"/><text x="452" y="42" class="er-l">1:N addresses</text>
  <path d="M360 86 L360 178" class="ln" marker-end="url(#era)"/><text x="366" y="140" class="er-l">1:N orders</text>
  <path d="M105 72 L105 178" class="ln" marker-end="url(#era)"/><text x="110" y="130" class="er-l">1:N products</text>
  <path d="M290 240 L182 232" class="ln" marker-end="url(#era)"/><text x="196" y="224" class="er-l">(via items)</text>
  <path d="M330 262 L280 328" class="ln" marker-end="url(#era)"/><text x="300" y="300" class="er-l">1:N items</text>
  <path d="M120 262 L220 328" class="ln" marker-end="url(#era)"/><text x="120" y="300" class="er-l">1:N items</text>
  <path d="M170 260 L560 328" class="ln" marker-end="url(#era)"/><text x="430" y="300" class="er-l">product 1:N reviews</text>
  <path d="M420 86 L600 328" class="ln" marker-end="url(#era)"/><text x="560" y="200" class="er-l">user 1:N reviews</text>
  <defs><marker id="era" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The schema: <b>order_items</b> is the junction that turns orders ⇄ products into a many-to-many, and carries the per-line quantity and price.</figcaption>
</figure>

### Step 1 — the migrations

Each table is one migration. Here are the two most instructive — `products` (a foreign key to
`categories`, a unique SKU, an index) and `orders` (a foreign key to `users` plus the status column).
The others (`users`, `categories`, `addresses`, `order_items`, `reviews`) follow the same pattern.

```rust,ignore
use sea_orm_migration::prelude::*;

// ---- products ----
#[async_trait::async_trait]
impl MigrationTrait for CreateProducts {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create().table(Products::Table).if_not_exists()
                .col(ColumnDef::new(Products::Id).integer().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Products::CategoryId).integer().not_null())
                .col(ColumnDef::new(Products::Name).string().not_null())
                .col(ColumnDef::new(Products::Sku).string().not_null().unique_key())
                .col(ColumnDef::new(Products::PriceCents).big_integer().not_null())
                .col(ColumnDef::new(Products::Stock).integer().not_null().default(0))
                .col(ColumnDef::new(Products::IsActive).boolean().not_null().default(true))
                .foreign_key(
                    ForeignKey::create().name("fk_product_category")
                        .from(Products::Table, Products::CategoryId)
                        .to(Categories::Table, Categories::Id)
                        .on_delete(ForeignKeyAction::Restrict),
                )
                .to_owned(),
        ).await?;

        // An index to speed up "products in this category" lookups:
        manager.create_index(
            Index::create().name("idx_product_category")
                .table(Products::Table).col(Products::CategoryId).to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Products::Table).to_owned()).await
    }
}

// ---- orders ----
#[async_trait::async_trait]
impl MigrationTrait for CreateOrders {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create().table(Orders::Table).if_not_exists()
                .col(ColumnDef::new(Orders::Id).integer().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Orders::UserId).integer().not_null())
                .col(ColumnDef::new(Orders::Status).string_len(16).not_null().default("pending"))
                .col(ColumnDef::new(Orders::TotalCents).big_integer().not_null().default(0))
                .col(ColumnDef::new(Orders::CreatedAt).timestamp_with_time_zone().not_null())
                .foreign_key(
                    ForeignKey::create().name("fk_order_user")
                        .from(Orders::Table, Orders::UserId)
                        .to(Users::Table, Users::Id)
                        .on_delete(ForeignKeyAction::Cascade),
                )
                .to_owned(),
        ).await
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Orders::Table).to_owned()).await
    }
}

#[derive(DeriveIden)] enum Categories { Table, Id }
#[derive(DeriveIden)] enum Users { Table, Id }
#[derive(DeriveIden)] enum Products { Table, Id, CategoryId, Name, Sku, PriceCents, Stock, IsActive }
#[derive(DeriveIden)] enum Orders { Table, Id, UserId, Status, TotalCents, CreatedAt }

struct CreateProducts;
struct CreateOrders;
```

### Step 2 — the entities

The `order` entity ties much of the schema together — a status enum, a belongs-to `users`, and a
has-many `order_items`:

```rust,ignore
// entities/order.rs
use sea_orm::entity::prelude::*;
use super::sea_orm_active_enums::OrderStatus; // the ActiveEnum from earlier

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "orders")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub user_id: i32,
    pub status: OrderStatus,        // the ActiveEnum column
    pub total_cents: i64,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(belongs_to = "super::user::Entity", from = "Column::UserId", to = "super::user::Column::Id")]
    User,
    #[sea_orm(has_many = "super::order_item::Entity")]
    OrderItem,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef { Relation::User.def() }
}
impl Related<super::order_item::Entity> for Entity {
    fn to() -> RelationDef { Relation::OrderItem.def() }
}
// Many-to-many: an order's products, traversed through the order_item junction.
impl Related<super::product::Entity> for Entity {
    fn to() -> RelationDef { super::order_item::Relation::Product.def() }
    fn via() -> Option<RelationDef> { Some(super::order_item::Relation::Order.def().rev()) }
}

impl ActiveModelBehavior for ActiveModel {}
```

The `order_item` junction carries the foreign keys plus the per-line data:

```rust,ignore
// entities/order_item.rs
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "order_items")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub order_id: i32,
    pub product_id: i32,
    pub quantity: i32,
    pub unit_cents: i64,           // price captured at purchase time
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(belongs_to = "super::order::Entity", from = "Column::OrderId", to = "super::order::Column::Id")]
    Order,
    #[sea_orm(belongs_to = "super::product::Entity", from = "Column::ProductId", to = "super::product::Column::Id")]
    Product,
}
impl ActiveModelBehavior for ActiveModel {}
```

The remaining entities (`user`, `category`, `product`, `address`, `review`) follow the same shape:
a `Model` with the columns from the migration, a `Relation` enum, and `Related` impls for each link.

### Step 3 — placing an order (a transaction)

Checkout is the canonical multi-write operation: create the order, add each line item, decrement
stock, and total it up — all atomically, so a failure leaves the database untouched.

```rust,ignore
use sea_orm::{*, ActiveValue::Set};

struct CartLine { product_id: i32, quantity: i32 }

async fn place_order(db: &DatabaseConnection, user_id: i32, cart: Vec<CartLine>)
    -> Result<i32, DbErr>
{
    db.transaction::<_, i32, DbErr>(|txn| {
        Box::pin(async move {
            // 1. Create the order (empty total for now).
            let order = order::ActiveModel {
                user_id: Set(user_id),
                status: Set(OrderStatus::Pending),
                total_cents: Set(0),
                created_at: Set(chrono::Utc::now()),
                ..Default::default()
            }
            .insert(txn)
            .await?;

            // 2. Add each line item, pricing it from the live product row.
            let mut total = 0i64;
            for line in cart {
                let product = product::Entity::find_by_id(line.product_id)
                    .one(txn)
                    .await?
                    .ok_or(DbErr::Custom("product not found".into()))?;

                let subtotal = product.price_cents * line.quantity as i64;
                total += subtotal;

                order_item::ActiveModel {
                    order_id: Set(order.id),
                    product_id: Set(product.id),
                    quantity: Set(line.quantity),
                    unit_cents: Set(product.price_cents),
                    ..Default::default()
                }
                .insert(txn)
                .await?;

                // 3. Decrement stock.
                let mut p: product::ActiveModel = product.into();
                p.stock = Set(match p.stock.take() { Some(s) => s - line.quantity, None => 0 });
                p.update(txn).await?;
            }

            // 4. Write the computed total back onto the order.
            let mut o: order::ActiveModel = order.into();
            o.total_cents = Set(total);
            o.update(txn).await?;

            Ok(order_id_of(&o)) // return the new order id (committed on Ok)
        })
    })
    .await
}
```

### Step 4 — reading it back (eager loading & aggregates)

```rust,ignore
// A customer's full order history, each order with its line items (one round trip per relation):
async fn order_history(db: &DatabaseConnection, user_id: i32)
    -> Result<Vec<(order::Model, Vec<order_item::Model>)>, DbErr>
{
    order::Entity::find()
        .filter(order::Column::UserId.eq(user_id))
        .order_by_desc(order::Column::CreatedAt)
        .find_with_related(order_item::Entity)
        .all(db)
        .await
}

// Best-selling products by revenue — a join + group-by + aggregate:
#[derive(FromQueryResult)]
struct TopProduct { product_id: i32, revenue_cents: i64, units: i64 }

async fn top_products(db: &DatabaseConnection, limit: u64) -> Result<Vec<TopProduct>, DbErr> {
    use sea_orm::sea_query::Expr;
    order_item::Entity::find()
        .select_only()
        .column(order_item::Column::ProductId)
        .column_as(
            Expr::col(order_item::Column::UnitCents).mul(Expr::col(order_item::Column::Quantity)).sum(),
            "revenue_cents",
        )
        .column_as(order_item::Column::Quantity.sum(), "units")
        .group_by(order_item::Column::ProductId)
        .order_by_desc(Expr::cust("revenue_cents"))
        .limit(limit)
        .into_model::<TopProduct>()
        .all(db)
        .await
}

// Paginate the active catalog, 24 per page:
async fn catalog_page(db: &DatabaseConnection, page: u64) -> Result<Vec<product::Model>, DbErr> {
    product::Entity::find()
        .filter(product::Column::IsActive.eq(true))
        .order_by_asc(product::Column::Name)
        .paginate(db, 24)
        .fetch_page(page)
        .await
}

// Average rating per product:
#[derive(FromQueryResult)]
struct Rating { product_id: i32, avg_rating: Option<f64>, count: i64 }

async fn product_ratings(db: &DatabaseConnection) -> Result<Vec<Rating>, DbErr> {
    review::Entity::find()
        .select_only()
        .column(review::Column::ProductId)
        .column_as(review::Column::Rating.avg(), "avg_rating")
        .column_as(review::Column::Id.count(), "count")
        .group_by(review::Column::ProductId)
        .into_model::<Rating>()
        .all(db)
        .await
}
```

### What this schema demonstrates

| ORM feature | Where it appears |
|---|---|
| Foreign keys + `ON DELETE` behavior | migrations (`fk_order_user` cascade, `fk_product_category` restrict) |
| Indexes & unique constraints | `idx_product_category`, `sku` unique |
| `ActiveEnum` column | `orders.status` = `OrderStatus` |
| `belongs_to` (N:1) | order → user, product → category |
| `has_many` (1:N) | user → orders, order → order_items |
| Many-to-many via junction | order ⇄ product through `order_items` (`via()`) |
| Transactions | `place_order` (all-or-nothing checkout) |
| Eager loading | `order_history` (`find_with_related`) |
| Joins + aggregates + group-by | `top_products`, `product_ratings` |
| Pagination | `catalog_page` |

## When to choose what

> [!key] sqlx vs. SeaORM vs. Diesel
> - **[sqlx](#/ch/sqlx)** — you like writing SQL and want compile-time-checked queries with minimal
>   abstraction. Great for read-heavy apps and hand-tuned queries.
> - **SeaORM** — you want an **async ORM**: entities, relationships, and dynamic query building,
>   with migrations included. Great for CRUD-heavy apps and when queries are assembled at runtime.
> - **Diesel** — a mature, synchronous ORM/query-builder with a powerful type-safe DSL and its own
>   compile-time guarantees. Great when you want maximum type safety and don't need async.
>
> All three are excellent and widely used. Pick based on *async vs sync*, *how much SQL you want to
> write*, and *how relationship-heavy your data is*. And remember SeaORM sits on sqlx, so you can mix
> raw sqlx queries into a SeaORM app when you need precise control.

## Summary

- **SeaORM** is an **async ORM** (built on [sqlx](#/ch/sqlx)) that maps database tables to Rust
  **entities**, so you work with structs and a fluent query API instead of raw SQL.
- A **`Model`** is a fetched row (read); an **`ActiveModel`** is a write buffer whose fields are
  `Set` / `NotSet` / `Unchanged`, so updates touch only the columns you changed.
- CRUD scales up: `insert_many`, `on_conflict` upserts, `update_many`/`delete_many`, `count`. The
  query builder does conditions (`Condition::all/any`), partial selects (`FromQueryResult`),
  **aggregates + group-by**, **pagination**, and **streaming**.
- All four **relationships** are first-class: `belongs_to`, `has_one`, `has_many`, and
  many-to-many via a junction (`Related::via`). Prefer **eager loading** to avoid the **N+1** trap.
- **Transactions** make multi-step writes atomic; **`ActiveEnum`** types status columns; **migrations**
  version your schema; and you can always drop to **raw SQL** or unit-test with **`MockDatabase`**.
- You designed a complete **e-commerce schema** — users, addresses, categories, products, orders,
  order_items, reviews — with foreign keys, an enum, a transactional checkout, and analytics queries.

> [!exercise] Try it yourself (in a local project with a database)
> 1. Scaffold the schema above with SQLite: write the seven migrations, run `migrate up`, then
>    `sea-orm-cli generate entity -o src/entities`.
> 2. Implement `place_order` and confirm a failed line item rolls the whole order back (transactions).
> 3. Write `top_products` and compare the SQL SeaORM logs (`sqlx_logging(true)`) to hand-written SQL.
> 4. Add a **`tags`** table and a **`product_tags`** junction, then load every product for a tag using
>    a `Related::via` many-to-many.

Next: matching and extracting patterns in text with **regex**.
