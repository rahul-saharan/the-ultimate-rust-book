<h1><span class="h1-kicker">The Crate Ecosystem</span>serde: Serialize & Deserialize</h1>

**serde** (SERialize/DEserialize) is *the* framework for converting Rust data structures to and from formats like JSON, YAML, TOML, MessagePack, and dozens more — and back again. It is one of the most-used crates in the entire ecosystem, and once you've derived `Serialize`/`Deserialize` on a type, moving your data in and out of any format is nearly free and completely type-safe. This chapter takes you from the two derives all the way to custom (de)serialization, zero-copy parsing, streaming, and the internals of how it all works. (serde and serde_json are on the in-book playground, so these examples run.)

## The two traits, derived

serde's magic is two traits — **`Serialize`** (Rust value → data) and **`Deserialize`** (data → Rust value) — that you get by `#[derive]`. serde reads your type's *structure* at compile time and generates all the conversion code:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 1, y: 2 };

    // Serialize to a JSON string:
    let json = serde_json::to_string(&p).unwrap();
    println!("serialized: {json}"); // {"x":1,"y":2}

    // Deserialize back into a Point:
    let parsed: Point = serde_json::from_str(&json).unwrap();
    println!("deserialized: {parsed:?}"); // Point { x: 1, y: 2 }
}
```

Add it to a project with:

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## serde's data model: the hourglass

The single most important idea in serde is that types and formats never talk to each other directly. In between sits a fixed, abstract **data model** of 29 types — booleans, integers, strings, sequences, maps, structs, enums, and so on. Every Rust type knows how to describe *itself* in terms of this data model; every format knows how to turn the data model into bytes (and back). Your type is compiled against the model, not against JSON.

<figure class="diagram">
<svg viewBox="0 0 700 330" role="img" aria-label="An hourglass: many Rust types at the top funnel through serde's abstract 29-type data model in the middle, then fan out to many formats at the bottom; serialization flows down and deserialization flows up">
  <style>
    .hg-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .hg-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .hg-h { font: 700 12px var(--font-sans); fill: var(--text); }
    .rust { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.3; }
    .core { fill: var(--amber-soft); stroke: var(--amber);    stroke-width: 1.6; }
    .fmt  { fill: var(--blue-soft);  stroke: var(--blue);     stroke-width: 1.3; }
  </style>
  <text x="20" y="20" class="hg-h">Rust types</text>
  <rect x="20"  y="30" width="90"  height="26" rx="5" class="rust"/><text x="32" y="48" class="hg-b">struct</text>
  <rect x="118" y="30" width="80"  height="26" rx="5" class="rust"/><text x="130" y="48" class="hg-b">enum</text>
  <rect x="206" y="30" width="90"  height="26" rx="5" class="rust"/><text x="218" y="48" class="hg-b">Vec&lt;T&gt;</text>
  <rect x="304" y="30" width="120" height="26" rx="5" class="rust"/><text x="316" y="48" class="hg-b">HashMap</text>
  <rect x="432" y="30" width="100" height="26" rx="5" class="rust"/><text x="444" y="48" class="hg-b">Option&lt;T&gt;</text>
  <rect x="540" y="30" width="120" height="26" rx="5" class="rust"/><text x="552" y="48" class="hg-b">your types</text>

  <path d="M60 56 L300 128" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M640 56 L400 128" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M200 56 L320 128" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M480 56 L380 128" stroke="var(--text-mute)" stroke-width="1"/>

  <rect x="230" y="130" width="240" height="66" rx="10" class="core"/>
  <text x="252" y="156" class="hg-h" fill="var(--amber)">serde data model</text>
  <text x="252" y="176" class="hg-c">29 abstract types: bool, i/u*, str,</text>
  <text x="252" y="190" class="hg-c">seq, map, struct, enum, option…</text>

  <path d="M300 196 L60 268" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M400 196 L640 268" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M320 196 L200 268" stroke="var(--text-mute)" stroke-width="1"/>
  <path d="M380 196 L480 268" stroke="var(--text-mute)" stroke-width="1"/>

  <text x="20" y="286" class="hg-h">Formats</text>
  <rect x="20"  y="292" width="80"  height="26" rx="5" class="fmt"/><text x="34" y="310" class="hg-b">JSON</text>
  <rect x="108" y="292" width="80"  height="26" rx="5" class="fmt"/><text x="122" y="310" class="hg-b">YAML</text>
  <rect x="196" y="292" width="80"  height="26" rx="5" class="fmt"/><text x="210" y="310" class="hg-b">TOML</text>
  <rect x="284" y="292" width="110" height="26" rx="5" class="fmt"/><text x="298" y="310" class="hg-b">bincode</text>
  <rect x="402" y="292" width="140" height="26" rx="5" class="fmt"/><text x="416" y="310" class="hg-b">MessagePack</text>
  <rect x="550" y="292" width="110" height="26" rx="5" class="fmt"/><text x="564" y="310" class="hg-b">CSV / RON</text>
  <text x="486" y="150" class="hg-c">↓ serialize</text>
  <text x="486" y="176" class="hg-c">↑ deserialize</text>
</svg>
<figcaption>The serde <b>hourglass</b>: N types × M formats become N + M implementations, because everything meets in one abstract data model.</figcaption>
</figure>

> [!key] Why the data model matters: N + M, not N × M
> Without an intermediary, supporting *N* types across *M* formats would need *N × M* pieces of code. serde's data model collapses this to **N + M**: each type implements `Serialize`/`Deserialize` *once* (against the model), each format implements a `Serializer`/`Deserializer` *once*, and any type works with any format automatically. Swap `serde_json::to_string` for `serde_yaml::to_string` and your structs don't change — that's the whole point.

## How the derive works: `Serializer`, `Deserializer` & `Visitor`

Understanding the moving parts demystifies serde's error messages and unlocks custom behavior. `#[derive(Serialize)]` generates an implementation that *describes* your value to a **`Serializer`** — calling methods like `serialize_struct("Point", 2)` then `serialize_field("x", &self.x)`. The format's `Serializer` turns those calls into bytes. Deserialization runs in reverse: the format's **`Deserializer`** reads bytes and drives a derive-generated **`Visitor`**, calling `visit_map`/`visit_str`/etc., which assembles your struct.

<figure class="diagram">
<svg viewBox="0 0 720 190" role="img" aria-label="Serialization: a value's derived Serialize impl calls methods on a Serializer which writes bytes. Deserialization: a Deserializer reads bytes and drives a Visitor which builds the value.">
  <style>
    .dv-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .dv-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .val { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.4; }
    .imp { fill: var(--green-soft); stroke: var(--green);   stroke-width: 1.4; }
    .fmt { fill: var(--blue-soft);  stroke: var(--blue);    stroke-width: 1.4; }
    .byt { fill: var(--surface-2);  stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <text x="10" y="20" class="dv-c">Serialize — value describes itself to the Serializer:</text>
  <rect x="10"  y="30" width="120" height="34" rx="7" class="val"/><text x="24" y="52" class="dv-b">Point value</text>
  <rect x="160" y="30" width="180" height="34" rx="7" class="imp"/><text x="172" y="52" class="dv-b">derived Serialize</text>
  <rect x="370" y="30" width="170" height="34" rx="7" class="fmt"/><text x="382" y="52" class="dv-b">Serializer (json)</text>
  <rect x="570" y="30" width="120" height="34" rx="7" class="byt"/><text x="582" y="52" class="dv-b">{"x":1,…}</text>
  <path d="M130 47 L158 47" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>
  <path d="M340 47 L368 47" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>
  <path d="M540 47 L568 47" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>

  <text x="10" y="110" class="dv-c">Deserialize — Deserializer drives a Visitor that builds the value:</text>
  <rect x="10"  y="120" width="120" height="34" rx="7" class="byt"/><text x="24" y="142" class="dv-b">{"x":1,…}</text>
  <rect x="160" y="120" width="180" height="34" rx="7" class="fmt"/><text x="172" y="142" class="dv-b">Deserializer (json)</text>
  <rect x="370" y="120" width="170" height="34" rx="7" class="imp"/><text x="382" y="142" class="dv-b">derived Visitor</text>
  <rect x="570" y="120" width="120" height="34" rx="7" class="val"/><text x="584" y="142" class="dv-b">Point value</text>
  <path d="M130 137 L158 137" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>
  <path d="M340 137 L368 137" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>
  <path d="M540 137 L568 137" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#dva)"/>
  <defs><marker id="dva" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>The derive generates the middle boxes for you. The format crate provides the <code>Serializer</code>/<code>Deserializer</code>; both meet at the data model.</figcaption>
</figure>

## Nested and collection types just work

serde handles nesting, `Vec`, `HashMap`, `Option`, enums — anything composed of serde-able parts:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
struct Team {
    name: String,
    members: Vec<Player>,
    active: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct Player {
    name: String,
    score: u32,
}

fn main() {
    let team = Team {
        name: "Crustaceans".into(),
        members: vec![
            Player { name: "Ferris".into(), score: 100 },
            Player { name: "Corro".into(), score: 85 },
        ],
        active: true,
    };

    // Pretty-print the nested structure as JSON:
    let json = serde_json::to_string_pretty(&team).unwrap();
    println!("{json}");

    // Round-trip it back:
    let restored: Team = serde_json::from_str(&json).unwrap();
    println!("{} has {} members", restored.name, restored.members.len());
}
```

## Enums and their four representations

Enums are where serde is most flexible — and most misunderstood. The *same* Rust enum can map to four different JSON shapes, chosen with a container attribute. Match the one your API expects.

<figure class="diagram">
<svg viewBox="0 0 700 230" role="img" aria-label="Four ways serde represents the enum variant Click with fields x and y: externally tagged, internally tagged, adjacently tagged, and untagged, each producing different JSON">
  <style>
    .er-t { font: 700 11px var(--font-mono); fill: var(--text); }
    .er-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .er-j { font: 11px var(--font-mono); fill: var(--blue); }
    .row  { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="10" y="18" class="er-c">Enum: <tspan class="er-t">Event::Click { x: 10, y: 20 }</tspan>  →  JSON depends on the attribute:</text>
  <rect x="10" y="30"  width="680" height="40" rx="6" class="row"/>
  <text x="22" y="46" class="er-t">default (external)</text><text x="22" y="63" class="er-j">{"Click":{"x":10,"y":20}}</text>
  <rect x="10" y="76"  width="680" height="40" rx="6" class="row"/>
  <text x="22" y="92" class="er-t">#[serde(tag = "t")]  (internal)</text><text x="22" y="109" class="er-j">{"t":"Click","x":10,"y":20}</text>
  <rect x="10" y="122" width="680" height="40" rx="6" class="row"/>
  <text x="22" y="138" class="er-t">#[serde(tag="t", content="c")]  (adjacent)</text><text x="22" y="155" class="er-j">{"t":"Click","c":{"x":10,"y":20}}</text>
  <rect x="10" y="168" width="680" height="40" rx="6" class="row"/>
  <text x="22" y="184" class="er-t">#[serde(untagged)]</text><text x="22" y="201" class="er-j">{"x":10,"y":20}   (matched by shape — no tag)</text>
</svg>
<figcaption>One enum, four wire formats. Pick the representation that matches the data you must read or produce.</figcaption>
</figure>

**Externally tagged** is the default; **internally tagged** (`tag = "..."`) is the common "type field" style used by many APIs:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]                 // internally tagged
enum Event {
    Click { x: i64, y: i64 },
    KeyPress { key: String },
}

fn main() {
    let e = Event::Click { x: 10, y: 20 };
    println!("{}", serde_json::to_string(&e).unwrap());
    // {"type":"Click","x":10,"y":20}

    let parsed: Event = serde_json::from_str(r#"{"type":"KeyPress","key":"Enter"}"#).unwrap();
    println!("{parsed:?}");             // KeyPress { key: "Enter" }
}
```

**Untagged** picks the first variant whose shape matches — perfect for a field that can be one of several types:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum Id {
    Number(u64),
    Text(String),
}

fn main() {
    let a: Id = serde_json::from_str("42").unwrap();       // matches Number
    let b: Id = serde_json::from_str(r#""abc123""#).unwrap(); // matches Text
    println!("{a:?} / {b:?}");                              // Number(42) / Text("abc123")
}
```

## The `serde_json` API surface

`serde_json` exposes the same conversion in several shapes — to/from a `String`, a byte slice, a reader/writer, or an in-memory `Value`. Learn the matrix and you'll never guess a function name:

| Direction | To/From `String` | To/From bytes | To/From reader/writer | To/From `Value` |
|---|---|---|---|---|
| **Serialize** | `to_string`, `to_string_pretty` | `to_vec`, `to_vec_pretty` | `to_writer`, `to_writer_pretty` | `to_value` |
| **Deserialize** | `from_str` | `from_slice` | `from_reader` | `from_value` |

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
struct Msg { id: u32, text: String }

fn main() {
    let m = Msg { id: 1, text: "hi".into() };

    let s = serde_json::to_string(&m).unwrap();       // → String
    let bytes = serde_json::to_vec(&m).unwrap();       // → Vec<u8>
    let value = serde_json::to_value(&m).unwrap();     // → serde_json::Value (in memory)
    println!("string : {s}");
    println!("bytes  : {} bytes", bytes.len());
    println!("value  : {}", value["text"]);

    let a: Msg = serde_json::from_str(&s).unwrap();     // from a String
    let b: Msg = serde_json::from_slice(&bytes).unwrap(); // from bytes
    let c: Msg = serde_json::from_value(value).unwrap();  // from a Value
    println!("{a:?} / {b:?} / {c:?}");
}
```

> [!performance] Skip the intermediate `String` for I/O
> When reading a file/socket or writing a response, use **`from_reader`** / **`to_writer`** (with a `BufReader`/`BufWriter` — see [Files & Streams](#/ch/io-streams)). They stream straight between the byte source/sink and your type, avoiding an extra full-size `String` allocation. Use `to_value`/`from_value` only when you genuinely need the in-memory tree.

## Working with dynamic JSON: `Value`

Sometimes you don't have a struct (an API returns arbitrary shapes). serde_json's **`Value`** enum represents *any* JSON — `Null`, `Bool`, `Number`, `String`, `Array`, `Object`. Build it with `json!`, and inspect it with typed accessors that return `Option` (no panics):

```rust
use serde_json::{json, Value};

fn main() {
    let v = json!({
        "user": { "name": "Ferris", "age": 10 },
        "tags": ["rust", "crab"]
    });

    // Typed accessors — each returns Option so missing/mistyped data can't panic:
    println!("name : {:?}", v["user"]["name"].as_str()); // Some("Ferris")
    println!("age  : {:?}", v["user"]["age"].as_i64());  // Some(10)
    println!("tag0 : {:?}", v["tags"][0].as_str());       // Some("rust")

    // get() returns None instead of Null for missing keys; pointer() walks a JSON path:
    println!("miss : {:?}", v.get("nope"));               // None
    println!("ptr  : {:?}", v.pointer("/user/name"));     // Some(String("Ferris"))

    if let Value::Object(map) = &v {
        println!("top-level keys: {}", map.len());         // 2
    }
}
```

Accessors mirror the variants: `as_str`, `as_i64`/`as_u64`/`as_f64`, `as_bool`, `as_array`, `as_object`, `is_null`. Indexing with `[...]` returns `Value::Null` for missing keys (convenient but silent); `get(...)` returns `Option` (safe).

> [!tip] Prefer typed structs over `Value` when you know the shape
> `Value` is right for truly dynamic or exploratory data, but if you know the JSON's structure, define a **struct** and deserialize into it. You then get compile-time field names, real types, autocomplete, and validation — `data.name` (a `String`) instead of `data["name"]` (a `Value` you must coerce). Reach for `Value` only when the shape is genuinely unknown.

## Customizing with attributes

serde is highly configurable via `#[serde(...)]` attributes at three levels: on the **container** (struct/enum), on a **field**, and on an enum **variant**. This is how you match an external API without renaming your Rust fields:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]     // container: every field → camelCase
struct Config {
    user_name: String,                  // ↔ "userName"

    #[serde(default)]                   // field: use Default if missing on input
    retries: u32,

    #[serde(skip_serializing_if = "Option::is_none")] // omit from output when None
    nickname: Option<String>,
}

fn main() {
    let json = r#"{ "userName": "ferris" }"#;    // retries & nickname omitted
    let config: Config = serde_json::from_str(json).unwrap();
    println!("{config:?}");                        // retries: 0, nickname: None

    println!("{}", serde_json::to_string(&config).unwrap()); // {"userName":"ferris","retries":0}
}
```

The attributes you'll actually use, grouped by where they go:

| Level | Attribute | Effect |
|---|---|---|
| container | `rename_all = "camelCase"` | rename every field by convention |
| container | `deny_unknown_fields` | error on unexpected input fields (strict parsing) |
| container | `tag` / `tag`+`content` / `untagged` | choose the enum representation |
| container | `transparent` | a 1-field newtype serializes as its inner value |
| field | `rename = "x"` | use a different name for this field |
| field | `alias = "x"` | accept an extra name on **input** |
| field | `default` / `default = "path"` | fill missing input via `Default` or a function |
| field | `skip` / `skip_serializing` / `skip_deserializing` | ignore the field (one or both directions) |
| field | `skip_serializing_if = "path"` | conditionally omit from output |
| field | `flatten` | inline a nested struct's fields at this level |
| field | `serialize_with` / `deserialize_with` / `with` | custom conversion (next section) |
| variant | `rename` / `other` | rename a variant, or catch-all for unknown tags |

Two of the most useful in practice — strict parsing with input aliases, and flattening:

```rust
use serde::{Serialize, Deserialize};

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]           // reject anything we didn't declare
struct Strict {
    #[serde(alias = "user_name", alias = "userName")] // accept either spelling
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct Page { page: u32, per_page: u32 }

#[derive(Serialize, Deserialize, Debug)]
struct Query {
    q: String,
    #[serde(flatten)]                   // hoist Page's fields to the top level
    page: Page,
}

fn main() {
    let a: Strict = serde_json::from_str(r#"{"userName":"ferris"}"#).unwrap();
    println!("{a:?}");
    let rejected = serde_json::from_str::<Strict>(r#"{"name":"x","extra":1}"#);
    println!("unknown field rejected? {}", rejected.is_err()); // true

    let query = Query { q: "rust".into(), page: Page { page: 2, per_page: 20 } };
    println!("{}", serde_json::to_string(&query).unwrap());
    // {"q":"rust","page":2,"per_page":20}  ← flattened, not nested
}
```

## Custom (de)serialization

When a field needs special handling — a number stored as a string, a custom date format, an enum encoded oddly — provide your own functions with `serialize_with` / `deserialize_with`:

```rust
use serde::{Serialize, Deserialize, Serializer, Deserializer};

#[derive(Serialize, Deserialize, Debug)]
struct Record {
    // This u64 is written and read as a JSON *string*, not a number:
    #[serde(serialize_with = "as_string", deserialize_with = "from_string")]
    id: u64,
}

fn as_string<S: Serializer>(value: &u64, s: S) -> Result<S::Ok, S::Error> {
    s.serialize_str(&value.to_string())
}

fn from_string<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
    let s = String::deserialize(d)?;
    s.parse().map_err(serde::de::Error::custom) // turn a parse error into a serde error
}

fn main() {
    let r = Record { id: 42 };
    let json = serde_json::to_string(&r).unwrap();
    println!("{json}");                    // {"id":"42"}  ← quoted
    let back: Record = serde_json::from_str(&json).unwrap();
    println!("{back:?}");                   // Record { id: 42 }
}
```

> [!tip] The `with` module pattern and `remote`
> If both functions belong together, put them in a module with `serialize`/`deserialize` items and use `#[serde(with = "my_module")]` — this is exactly how `chrono` and `time` provide `#[serde(with = "...")]` date helpers. To derive serde for a type you don't own (from another crate), use the **`remote`** derive pattern with a local mirror struct.

## Zero-copy deserialization

For maximum speed, string fields can **borrow directly from the input buffer** instead of allocating new `String`s — a huge win when parsing large payloads. Use `&'a str` fields with `#[serde(borrow)]`; the parsed struct then holds slices into the original data:

```rust
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct View<'a> {
    #[serde(borrow)]
    name: &'a str,   // points INTO the input, no allocation
    id: u32,
}

fn main() {
    let data = r#"{"name":"Ferris","id":7}"#;
    let view: View = serde_json::from_str(data).unwrap();
    println!("{} / {}", view.name, view.id); // `name` borrows from `data`
}
```

> [!note] Zero-copy only works when the bytes can be borrowed as-is
> A borrowed `&str` requires the input to outlive the struct and to contain the string verbatim (no escape sequences to unescape). When that can't hold — the input is temporary, or a `\n` must be decoded — serde falls back to an owned `String`, or you use [`Cow<str>`](#/ch/type-system) with `#[serde(borrow)]` to get "borrow if possible, allocate if not."

## Streaming: readers, writers & many values

For data too large to hold in memory, or a continuous feed, stream it. `from_reader`/`to_writer` work directly over any [`Read`/`Write`](#/ch/io-streams). And `Deserializer::into_iter` reads a sequence of concatenated JSON values (the NDJSON / JSON-lines pattern) one at a time:

```rust
use serde::Deserialize;
use serde_json::Deserializer;

#[derive(Deserialize, Debug)]
struct Row { n: u32 }

fn main() {
    // A stream of back-to-back JSON values (e.g. one per line from a log):
    let feed = r#"{"n":1} {"n":2} {"n":3}"#;

    let stream = Deserializer::from_str(feed).into_iter::<Row>();
    let mut total = 0;
    for row in stream {
        total += row.unwrap().n;         // each value parsed lazily, not all at once
    }
    println!("total = {total}");         // 6
}
```

## Handling errors

Deserialization fails for real reasons — malformed syntax, a missing field, a type mismatch. `serde_json::Error` tells you *what* and *where*, and `classify()` buckets it so you can react:

```rust
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct P { x: i32 }

fn main() {
    let bad = r#"{"x": "not a number"}"#;
    match serde_json::from_str::<P>(bad) {
        Ok(p) => println!("{p:?}"),
        Err(e) => {
            println!("error   : {e}");
            println!("location: line {}, column {}", e.line(), e.column());
            println!("category: {:?}", e.classify()); // Data | Syntax | Io | Eof
        }
    }
}
```

`classify()` returns `Syntax` (invalid JSON), `Data` (valid JSON but wrong shape/type for your struct), `Io` (underlying reader failed), or `Eof` (unexpected end). In applications, wrap these with [anyhow/thiserror](#/ch/anyhow-thiserror) for context.

## Beyond JSON: the format ecosystem

Because your types target the data model, any serde format crate works with the *same* derives — just change the format crate:

| Crate | Format | Typical use |
|---|---|---|
| `serde_json` | JSON | web APIs, config, interchange |
| `serde_yaml` | YAML | human-edited config |
| `toml` | TOML | Rust config (`Cargo.toml`!) |
| `bincode` | compact binary | fast internal storage / IPC |
| `rmp-serde` | MessagePack | compact cross-language binary |
| `csv` | CSV | tabular data, spreadsheets |
| `ron` | Rusty Object Notation | Rust-flavored, great for game data |

## Summary

- **serde** converts Rust types to/from data formats via two derived traits: **`Serialize`** and **`Deserialize`**.
- Everything meets at serde's **29-type data model** — the hourglass that turns *N × M* into *N + M*, so one derive works with every format by swapping the format crate.
- The derive generates code that talks to a **`Serializer`** (out) or is driven by a **`Deserializer` + `Visitor`** (in).
- **Enums** have four wire representations — external (default), internal (`tag`), adjacent (`tag`+`content`), and `untagged` — chosen with a container attribute.
- Know the **`serde_json` matrix**: `to_string`/`to_vec`/`to_writer`/`to_value` and `from_str`/`from_slice`/`from_reader`/`from_value`; stream large data with readers/writers and `Deserializer::into_iter`.
- Use **`Value`** (+ `json!`, `as_*`, `get`, `pointer`) for dynamic JSON; prefer typed structs when you know the shape.
- Customize with **`#[serde(...)]`** attributes (`rename_all`, `default`, `flatten`, `deny_unknown_fields`, `alias`, tagging…), drop to **`serialize_with`/`deserialize_with`** for full control, and borrow with **`#[serde(borrow)]`** for zero-copy speed.

> [!exercise] Try it yourself
> 1. Derive serde on `struct Book { title: String, pages: u32 }`, serialize to pretty JSON, and round-trip it back.
> 2. Make an internally-tagged enum `#[serde(tag = "kind")]` and confirm the JSON has a `"kind"` field.
> 3. Add `#[serde(deny_unknown_fields)]` to a struct and verify an extra field is rejected.
> 4. Write a `deserialize_with` function that parses a `"true"`/`"false"` **string** into a `bool` field.
> 5. Parse `{"n":1}{"n":2}` with `Deserializer::into_iter` and sum the `n` values.

Next: turning your program into a proper command-line tool with **clap**.
