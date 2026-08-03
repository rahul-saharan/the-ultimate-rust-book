<h1><span class="h1-kicker">The Crate Ecosystem</span>SQL: Querying MySQL & PostgreSQL</h1>

Before you can talk to a database from Rust with [sqlx](#/ch/sqlx) or [SeaORM](#/ch/seaorm), you need to speak its language: **SQL** (Structured Query Language). SQL is how you create tables, and store, retrieve, update, and relate data in every relational database — including the two most popular open-source ones, **MySQL** and **PostgreSQL**. This chapter is a practical primer on SQL, calling out the differences between the two dialects as we go.

> [!note] These examples are for reading, not running
> The SQL in this chapter is illustrative — the in-book playground runs Rust, not SQL. To try these
> queries, use a real MySQL or PostgreSQL server (or an online SQL sandbox like DB Fiddle). Focus on
> understanding the shapes; you'll run them for real from Rust in the next chapters.

## The relational model

A relational database stores data in **tables** — grids of **rows** (records) and **columns**
(fields). Each table has a **primary key**: a column whose value uniquely identifies each row.

<figure class="diagram">
<svg viewBox="0 0 640 180" role="img" aria-label="A users table with id, name, and email columns; id is the primary key">
  <style>
    .sqm { font: 600 12px var(--font-mono); fill: var(--text); }
    .sqc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .hdr { fill: var(--rust-500); }
    .pk { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .cell { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1; }
    .hdt { font: 700 12px var(--font-mono); fill: #fff; }
  </style>
  <text x="20" y="24" class="sqc">Table: users</text>
  <!-- header -->
  <rect x="20" y="32" width="80" height="28" class="hdr"/><text x="42" y="51" class="hdt">id</text>
  <rect x="100" y="32" width="160" height="28" class="hdr"/><text x="150" y="51" class="hdt">name</text>
  <rect x="260" y="32" width="240" height="28" class="hdr"/><text x="330" y="51" class="hdt">email</text>
  <!-- rows -->
  <rect x="20" y="60" width="80" height="28" class="pk"/><text x="50" y="79" class="sqm">1</text>
  <rect x="100" y="60" width="160" height="28" class="cell"/><text x="112" y="79" class="sqm">Ferris</text>
  <rect x="260" y="60" width="240" height="28" class="cell"/><text x="272" y="79" class="sqm">ferris@crab.dev</text>
  <rect x="20" y="88" width="80" height="28" class="pk"/><text x="50" y="107" class="sqm">2</text>
  <rect x="100" y="88" width="160" height="28" class="cell"/><text x="112" y="107" class="sqm">Ada</text>
  <rect x="260" y="88" width="240" height="28" class="cell"/><text x="272" y="107" class="sqm">ada@math.org</text>
  <text x="510" y="79" class="sqc">← primary key</text>
  <text x="130" y="150" class="sqc">columns (fields) run across; rows (records) run down; each row is one user.</text>
</svg>
<figcaption>A relational <b>table</b>: columns define the shape, rows hold the data, and the <b>primary key</b> (<code>id</code>) uniquely identifies each row.</figcaption>
</figure>

> [!jargon] Schema, DDL, DML
> A **schema** is the structure of your database — the tables, their columns, and the rules between
> them. **DDL** (Data Definition Language) is the SQL that *defines* that structure (`CREATE TABLE`,
> `ALTER TABLE`). **DML** (Data Manipulation Language) is the SQL that *works with the data*
> (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). You'll write a little DDL up front and a lot of DML
> every day.

## MySQL vs PostgreSQL — the short version

Both are free, mature, battle-tested relational databases, and ~90% of the SQL you write is
identical between them. The differences are in the details.

> [!key] Which one, and how much does it matter?
> - **PostgreSQL** ("Postgres") is known for strict standards-compliance, rich data types (JSON,
>   arrays, full-text search), and advanced features. It's the common default for new projects.
> - **MySQL** (and its drop-in fork **MariaDB**) is known for speed, ubiquity, and huge hosting
>   support; it powers much of the classic web.
>
> The **core SQL — tables, `SELECT`, `JOIN`, `WHERE`, `GROUP BY` — is the same in both.** They differ
> mainly in a handful of syntax details (auto-increment keys, quoting, a few functions), which we'll
> flag as we go. Learn SQL once and you can use either.

## Creating tables (DDL)

`CREATE TABLE` defines a table's columns, their **data types**, and **constraints** (rules the data
must follow). Here's a `users` table — note the two dialects differ mainly on the auto-incrementing
primary key:

```sql
-- PostgreSQL
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,          -- auto-incrementing integer
    name     VARCHAR(100) NOT NULL,
    email    VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

```sql
-- MySQL
CREATE TABLE users (
    id        INT AUTO_INCREMENT PRIMARY KEY,   -- MySQL's auto-increment
    name      VARCHAR(100) NOT NULL,
    email     VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,     -- BOOLEAN is an alias for TINYINT(1)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Common constraints: **`PRIMARY KEY`** (unique row identifier), **`NOT NULL`** (value required),
**`UNIQUE`** (no duplicates in this column), **`DEFAULT`** (a fallback value), **`CHECK`** (a
condition the value must satisfy), and **`FOREIGN KEY`** (a reference to another table — coming up
under Relationships).

| Common data types | PostgreSQL | MySQL |
|-------------------|-----------|-------|
| Auto-increment integer key | `SERIAL` / `GENERATED ... AS IDENTITY` | `INT AUTO_INCREMENT` |
| Whole number | `INTEGER`, `BIGINT` | `INT`, `BIGINT` |
| Decimal | `NUMERIC(p,s)`, `REAL` | `DECIMAL(p,s)`, `DOUBLE` |
| Short text | `VARCHAR(n)` | `VARCHAR(n)` |
| Long text | `TEXT` | `TEXT` |
| True/false | `BOOLEAN` | `BOOLEAN` (= `TINYINT(1)`) |
| Date & time | `TIMESTAMP`, `DATE` | `DATETIME`, `TIMESTAMP`, `DATE` |
| JSON | `JSON`, `JSONB` (indexed) | `JSON` |

## Inserting data (INSERT)

`INSERT` adds rows. You list the columns, then the values:

```sql
INSERT INTO users (name, email) VALUES ('Ferris', 'ferris@crab.dev');

-- Insert several rows at once:
INSERT INTO users (name, email) VALUES
    ('Ada',   'ada@math.org'),
    ('Grace', 'grace@navy.mil');
```

> [!tip] Getting the new row's id back
> After inserting, you often need the generated `id`. **PostgreSQL** adds a `RETURNING` clause:
> `INSERT INTO users (name) VALUES ('Ferris') RETURNING id;`. **MySQL** doesn't have `RETURNING`
> (in most versions); you call `SELECT LAST_INSERT_ID();` right after. Database libraries like sqlx
> expose this for you, but it's good to know why the two differ.

## Querying data (SELECT)

`SELECT` is the workhorse — it *reads* data. Its clauses always appear in this order:

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="The anatomy of a SELECT query: SELECT columns FROM table WHERE condition ORDER BY column LIMIT n">
  <style>
    .qam { font: 600 12px var(--font-mono); fill: var(--text); }
    .qak { font: 700 12px var(--font-mono); fill: #fff; }
    .qac { font: 11px var(--font-sans); fill: var(--text-mute); }
    .kw { fill: var(--rust-500); }
    .val { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1; }
  </style>
  <rect x="14" y="24" width="70" height="26" class="kw"/><text x="24" y="42" class="qak">SELECT</text>
  <rect x="90" y="24" width="90" height="26" class="val"/><text x="100" y="42" class="qam">name, email</text>
  <rect x="14" y="58" width="50" height="26" class="kw"/><text x="24" y="76" class="qak">FROM</text>
  <rect x="70" y="58" width="70" height="26" class="val"/><text x="80" y="76" class="qam">users</text>
  <rect x="14" y="92" width="60" height="26" class="kw"/><text x="22" y="110" class="qak">WHERE</text>
  <rect x="80" y="92" width="150" height="26" class="val"/><text x="90" y="110" class="qam">is_active = TRUE</text>
  <text x="250" y="42" class="qac">which columns to return</text>
  <text x="250" y="76" class="qac">which table to read from</text>
  <text x="250" y="110" class="qac">filter: only rows matching this condition</text>
  <text x="14" y="140" class="qac">…then optionally ORDER BY (sort), LIMIT (cap rows), OFFSET (skip rows).</text>
</svg>
<figcaption>A <code>SELECT</code> reads columns <b>FROM</b> a table, keeps rows matching <b>WHERE</b>, and can sort and limit the result.</figcaption>
</figure>

```sql
-- Every column of every row:
SELECT * FROM users;

-- Specific columns, filtered, sorted, and capped:
SELECT name, email
FROM users
WHERE is_active = TRUE
ORDER BY name ASC
LIMIT 10;

-- DISTINCT removes duplicate rows from the result:
SELECT DISTINCT country FROM users;
```

> [!best] Avoid `SELECT *` in real queries
> `SELECT *` is handy while exploring, but in application code, **list the columns you actually
> need**. It's faster (less data over the wire), and it won't silently break — or change shape —
> when someone later adds a column. This matters especially with [sqlx](#/ch/sqlx), which infers
> result types from your `SELECT` list at compile time.

## Filtering with WHERE

The `WHERE` clause is where most of SQL's expressiveness lives. Combine conditions with `AND`/`OR`:

```sql
SELECT * FROM users
WHERE age >= 18
  AND (country = 'US' OR country = 'CA')
  AND name LIKE 'A%'          -- starts with 'A' (% is a wildcard)
  AND email IS NOT NULL
  AND age BETWEEN 18 AND 65
  AND country IN ('US', 'CA', 'UK');
```

| Operator | Matches |
|----------|---------|
| `=`, `<>` (or `!=`) | equal, not equal |
| `<`, `>`, `<=`, `>=` | comparisons |
| `LIKE 'A%'` | pattern (`%` = any chars, `_` = one char) |
| `IN (a, b, c)` | any of a list |
| `BETWEEN x AND y` | inclusive range |
| `IS NULL` / `IS NOT NULL` | missing / present values |

> [!mistake] NULL is not equal to anything — not even NULL
> A `NULL` means "unknown/missing." Because of that, `WHERE email = NULL` returns **nothing** — even
> for rows that are null! Comparing anything to `NULL` with `=` yields "unknown," not true. You must
> use **`IS NULL`** / **`IS NOT NULL`** to test for null values. This trips up nearly everyone at
> first, in both MySQL and PostgreSQL.

> [!note] Case-insensitive matching differs
> `LIKE` is **case-insensitive by default in MySQL** (depending on the column's collation) but
> **case-sensitive in PostgreSQL**. Postgres offers **`ILIKE`** for case-insensitive matching:
> `WHERE name ILIKE 'ferris'`. If you need portable case-insensitive search, lowercase both sides:
> `WHERE LOWER(name) = LOWER('Ferris')`.

## Aggregation & grouping

Aggregate functions collapse many rows into a summary. `GROUP BY` computes them per group, and
`HAVING` filters the groups:

```sql
-- Count all users:
SELECT COUNT(*) FROM users;

-- Summary stats:
SELECT MIN(age), MAX(age), AVG(age), SUM(orders) FROM users;

-- Per-group: how many users in each country, only countries with more than 100:
SELECT country, COUNT(*) AS user_count
FROM users
GROUP BY country
HAVING COUNT(*) > 100
ORDER BY user_count DESC;
```

> [!key] WHERE vs HAVING
> **`WHERE`** filters *individual rows* **before** grouping; **`HAVING`** filters *groups* **after**
> aggregation. So "users older than 18" is a `WHERE age > 18`, but "countries with more than 100
> users" is a `HAVING COUNT(*) > 100` — because the count only exists after grouping. Using the
> wrong one is a classic SQL error.

## Relationships & JOINs

The real power of relational databases is *relating* tables. A **foreign key** in one table points
at the primary key of another. Say each `order` belongs to a `user`:

```sql
CREATE TABLE orders (
    id      SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),  -- foreign key → users.id
    total   NUMERIC(10, 2) NOT NULL
);
```

A **`JOIN`** combines rows from two tables based on that relationship:

```sql
-- Every order together with the name of the user who placed it:
SELECT users.name, orders.total
FROM orders
INNER JOIN users ON orders.user_id = users.id;
```

There are four join types, differing in how they handle rows with no match on the other side:

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="The four SQL join types: inner, left, right, and full, shown as overlapping sets">
  <style>
    .jm { font: 700 11px var(--font-mono); fill: var(--text); }
    .jc { font: 10.5px var(--font-sans); fill: var(--text-mute); }
    .setA { fill: none; stroke: var(--blue); stroke-width: 1.5; }
    .setB { fill: none; stroke: var(--rust-500); stroke-width: 1.5; }
    .fillsel { fill: var(--rust-300); opacity: 0.55; }
  </style>
  <!-- INNER -->
  <text x="20" y="20" class="jm">INNER JOIN</text>
  <clipPath id="ci"><circle cx="55" cy="70" r="26"/></clipPath>
  <circle cx="55" cy="70" r="26" class="setA"/><circle cx="85" cy="70" r="26" class="setB"/>
  <circle cx="85" cy="70" r="26" class="fillsel" clip-path="url(#ci)"/>
  <text x="20" y="120" class="jc">rows matching in BOTH</text>
  <!-- LEFT -->
  <text x="185" y="20" class="jm">LEFT JOIN</text>
  <circle cx="210" cy="70" r="26" class="fillsel"/>
  <circle cx="210" cy="70" r="26" class="setA"/><circle cx="240" cy="70" r="26" class="setB"/>
  <text x="175" y="120" class="jc">all LEFT + matches</text>
  <!-- RIGHT -->
  <text x="345" y="20" class="jm">RIGHT JOIN</text>
  <circle cx="400" cy="70" r="26" class="fillsel"/>
  <circle cx="370" cy="70" r="26" class="setA"/><circle cx="400" cy="70" r="26" class="setB"/>
  <text x="335" y="120" class="jc">all RIGHT + matches</text>
  <!-- FULL -->
  <text x="510" y="20" class="jm">FULL JOIN</text>
  <circle cx="530" cy="70" r="26" class="fillsel"/><circle cx="560" cy="70" r="26" class="fillsel"/>
  <circle cx="530" cy="70" r="26" class="setA"/><circle cx="560" cy="70" r="26" class="setB"/>
  <text x="505" y="120" class="jc">everything from both</text>
  <text x="20" y="150" class="jc">Left circle = left table, right circle = right table; shaded = rows the join keeps.</text>
</svg>
<figcaption>The four joins differ only in what they do with unmatched rows: <b>INNER</b> keeps only matches; <b>LEFT/RIGHT</b> keep all of one side; <b>FULL</b> keeps everything.</figcaption>
</figure>

```sql
-- LEFT JOIN: every user, plus their orders — users with NO orders still appear
-- (their order columns come back NULL). Great for "who hasn't ordered yet?".
SELECT users.name, orders.total
FROM users
LEFT JOIN orders ON users.id = orders.user_id;
```

> [!warning] MySQL has no FULL OUTER JOIN
> **PostgreSQL** supports all four joins directly. **MySQL** does not have `FULL OUTER JOIN` — you
> emulate it by `UNION`-ing a `LEFT JOIN` and a `RIGHT JOIN`. `INNER` and `LEFT` (the two you'll use
> 95% of the time) work identically in both, so this rarely bites in practice.

## Updating & deleting

`UPDATE` changes existing rows; `DELETE` removes them. Both take a `WHERE` — and forgetting it is
dangerous:

```sql
UPDATE users SET is_active = FALSE WHERE last_login < '2023-01-01';

DELETE FROM users WHERE id = 42;
```

> [!warning] Always double-check your WHERE on UPDATE and DELETE
> `UPDATE users SET is_active = FALSE;` with **no `WHERE`** deactivates *every user in the table*.
> `DELETE FROM users;` deletes *all of them*. There's no undo. Before running an `UPDATE`/`DELETE`,
> it's a good habit to run the same `WHERE` as a `SELECT COUNT(*)` first to see how many rows you're
> about to change — and to wrap risky changes in a transaction (below) so you can roll back.

## Indexes

An **index** is a lookup structure (typically a [B-tree](#/ch/dsa-balanced-trees)) that makes
`WHERE`, `JOIN`, and `ORDER BY` on a column dramatically faster — the difference between scanning
every row and jumping straight to the answer:

```sql
CREATE INDEX idx_users_email ON users(email);
```

> [!performance] Index what you search by — but not everything
> Without an index, finding `WHERE email = '...'` scans the whole table (O(n)); with one, it's
> roughly O(log n). Index the columns you frequently filter, join, or sort on (foreign keys are
> prime candidates). But indexes aren't free — they use disk space and slow down `INSERT`/`UPDATE`
> (the index must be maintained). So index deliberately, based on your real query patterns, not
> reflexively on every column. (Primary keys and `UNIQUE` columns are indexed automatically.)

## Transactions

A **transaction** groups several statements into one all-or-nothing unit: either every statement
succeeds and is committed, or something fails and the whole thing rolls back, leaving the database
untouched. This is essential for operations that must not half-happen, like transferring money:

```sql
BEGIN;                                              -- start the transaction
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;                                             -- both succeed together
-- If anything went wrong, you'd run ROLLBACK; instead, undoing both.
```

> [!key] ACID: what a transaction guarantees
> Relational databases promise **ACID**: **A**tomicity (all-or-nothing), **C**onsistency (the
> database moves from one valid state to another), **I**solation (concurrent transactions don't
> corrupt each other), and **D**urability (once committed, it survives crashes). This is *the*
> reason to use a relational database for money, orders, and anything where correctness under
> concurrency matters. Both MySQL (with the InnoDB engine, the default) and PostgreSQL are fully
> ACID-compliant.

## The dialect differences, in one place

| Task | PostgreSQL | MySQL |
|------|-----------|-------|
| Auto-increment key | `SERIAL` / `IDENTITY` | `AUTO_INCREMENT` |
| Quote an identifier | `"my_column"` (double quotes) | `` `my_column` `` (backticks) |
| Return inserted id | `INSERT ... RETURNING id` | `SELECT LAST_INSERT_ID()` |
| Case-insensitive match | `ILIKE` | `LIKE` (default collation) |
| String concatenation | `'a' \|\| 'b'` | `CONCAT('a', 'b')` |
| Upsert (insert-or-update) | `ON CONFLICT ... DO UPDATE` | `ON DUPLICATE KEY UPDATE` |
| Full outer join | supported | emulate with `UNION` |
| Limit + skip | `LIMIT 10 OFFSET 20` | `LIMIT 10 OFFSET 20` (same) |

## Using SQL from Rust

You now know enough SQL to be productive. From Rust, you have three ways to run it: write SQL
directly with compile-time checks using [**sqlx**](#/ch/sqlx), work with tables as Rust types via
the [**SeaORM**](#/ch/seaorm) ORM, or use the mature Diesel query builder. All of them ultimately
send the SQL you've learned here to MySQL or PostgreSQL — so this knowledge underpins every one.

## Summary

- Relational databases store data in **tables** of **rows** and **columns**, each row identified by
  a **primary key**; **foreign keys** relate tables.
- **DDL** (`CREATE TABLE` with types and constraints) defines structure; **DML** (`SELECT`,
  `INSERT`, `UPDATE`, `DELETE`) works with data.
- **`SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT`** reads and filters; use `IS NULL` for nulls,
  and `GROUP BY`/`HAVING` for aggregation (`WHERE` filters rows, `HAVING` filters groups).
- **`JOIN`** combines related tables — `INNER` (matches only), `LEFT`/`RIGHT` (keep one side),
  `FULL` (everything). **Indexes** speed up lookups; **transactions** give all-or-nothing **ACID**
  guarantees.
- **MySQL and PostgreSQL share the core SQL**; they differ mainly in auto-increment keys, identifier
  quoting, and a few functions — summarized in the table above.
- From Rust, run SQL via **sqlx**, **SeaORM**, or **Diesel**.

> [!exercise] Try it yourself (on a real MySQL or PostgreSQL server, or an online SQL sandbox)
> 1. Create a `products` table (`id`, `name`, `price`, `in_stock`), insert a few rows, and
>    `SELECT` the ones with `price < 20` sorted by price.
> 2. Add an `orders` table with a foreign key to `products`, then write an `INNER JOIN` that lists
>    each order with its product name.
> 3. Write a `GROUP BY` query that counts how many products are in stock vs. out of stock, and wrap
>    two `UPDATE`s in a `BEGIN`/`COMMIT` transaction.

With SQL under your belt, let's run it from Rust with compile-time safety — the **sqlx** crate.
