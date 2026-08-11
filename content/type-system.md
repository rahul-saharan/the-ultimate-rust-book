<h1><span class="h1-kicker">The Complete Reference</span>Every Type in Rust, from Basic to Advanced</h1>

Rust is a **statically, strongly typed** language: every value has exactly one type, fixed and known at compile time. This chapter is the **complete catalog** — we walk *every* type in the language, from the humble `bool` to `dyn Trait`, one at a time. For each one you get the same four things: **what it is** (the theory), a **diagram** of how it looks in memory, a runnable **example**, and **when to reach for it** (its usefulness).

It's long by design — treat it as a reference you return to. If you want the deep dive on a specific area, each type links to its dedicated chapter. First, the big picture; then the catalog.

## The type universe at a glance

Every type you will ever write is built from a handful of families. Here is the whole map on one page.

<figure class="diagram">
<svg viewBox="0 0 720 380" role="img" aria-label="The six families of Rust types: primitive/scalar, sequence/compound, pointers and references, user-defined, functions and closures, and abstract/generic types">
  <style>
    .tu-t   { font: 700 13px var(--font-sans); fill: var(--text); }
    .tu-h   { font: 700 12.5px var(--font-sans); fill: var(--text); }
    .tu-m   { font: 11px var(--font-mono); fill: var(--text-soft); }
    .tu-cap { font: italic 12px var(--font-sans); fill: var(--text-mute); }
    .tu-card{ fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <rect x="130" y="8" width="460" height="30" rx="8" fill="var(--rust-100)" stroke="var(--rust-400)" stroke-width="1.4"/>
  <text x="360" y="28" text-anchor="middle" class="tu-t" fill="var(--rust-700)">Every value has ONE type — known at compile time</text>
  <g>
    <rect x="10"  y="58" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="10"  y="58" width="222" height="26"  rx="10" fill="var(--blue-soft)"/>
    <text x="22"  y="76"  class="tu-h" fill="var(--blue)">① Primitive / Scalar</text>
    <text x="22"  y="104" class="tu-m">i8 i16 i32 i64 i128 isize</text>
    <text x="22"  y="124" class="tu-m">u8 u16 u32 u64 u128 usize</text>
    <text x="22"  y="144" class="tu-m">f32   f64</text>
    <text x="22"  y="164" class="tu-m">bool  char  ()</text>
    <text x="22"  y="186" class="tu-cap">one indivisible value</text>
  </g>
  <g>
    <rect x="249" y="58" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="249" y="58" width="222" height="26"  rx="10" fill="var(--green-soft)"/>
    <text x="261" y="76"  class="tu-h" fill="var(--green)">② Sequence / Compound</text>
    <text x="261" y="104" class="tu-m">(T, U, ...)   tuple</text>
    <text x="261" y="124" class="tu-m">[T; N]        array</text>
    <text x="261" y="144" class="tu-m">[T]           slice</text>
    <text x="261" y="164" class="tu-m">str  String  Vec&lt;T&gt;</text>
    <text x="261" y="186" class="tu-cap">values grouped together</text>
  </g>
  <g>
    <rect x="488" y="58" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="488" y="58" width="222" height="26"  rx="10" fill="var(--amber-soft)"/>
    <text x="500" y="76"  class="tu-h" fill="var(--amber)">③ Pointers &amp; References</text>
    <text x="500" y="104" class="tu-m">&amp;T   &amp;mut T</text>
    <text x="500" y="124" class="tu-m">Box&lt;T&gt;  Rc&lt;T&gt;  Arc&lt;T&gt;</text>
    <text x="500" y="144" class="tu-m">*const T  *mut T</text>
    <text x="500" y="164" class="tu-m">Cell  RefCell  Cow</text>
    <text x="500" y="186" class="tu-cap">point at data elsewhere</text>
  </g>
  <g>
    <rect x="10"  y="212" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="10"  y="212" width="222" height="26"  rx="10" fill="var(--purple-soft)"/>
    <text x="22"  y="230" class="tu-h" fill="var(--purple)">④ User-defined (nominal)</text>
    <text x="22"  y="258" class="tu-m">struct  { ... }</text>
    <text x="22"  y="278" class="tu-m">enum    A | B | C</text>
    <text x="22"  y="298" class="tu-m">union   (unsafe)</text>
    <text x="22"  y="318" class="tu-m">Option&lt;T&gt;  Result&lt;T,E&gt;</text>
    <text x="22"  y="340" class="tu-cap">types you name &amp; define</text>
  </g>
  <g>
    <rect x="249" y="212" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="249" y="212" width="222" height="26"  rx="10" fill="var(--teal-soft)"/>
    <text x="261" y="230" class="tu-h" fill="var(--teal)">⑤ Functions &amp; Closures</text>
    <text x="261" y="258" class="tu-m">fn(T) -&gt; U   fn pointer</text>
    <text x="261" y="278" class="tu-m">fn item      (each unique)</text>
    <text x="261" y="298" class="tu-m">Fn / FnMut / FnOnce</text>
    <text x="261" y="318" class="tu-m">|x| x + 1   closure</text>
    <text x="261" y="340" class="tu-cap">code as a value</text>
  </g>
  <g>
    <rect x="488" y="212" width="222" height="140" rx="10" class="tu-card"/>
    <rect x="488" y="212" width="222" height="26"  rx="10" fill="var(--pink-soft)"/>
    <text x="500" y="230" class="tu-h" fill="var(--pink)">⑥ Abstract / Generic</text>
    <text x="500" y="258" class="tu-m">&lt;T&gt;          generics</text>
    <text x="500" y="278" class="tu-m">impl Trait   opaque</text>
    <text x="500" y="298" class="tu-m">dyn Trait    erased</text>
    <text x="500" y="318" class="tu-m">!            never</text>
    <text x="500" y="340" class="tu-cap">stand in for many types</text>
  </g>
</svg>
<figcaption>The six families. Families ①–⑤ are <b>concrete</b>; family ⑥ is how you write code that works over <b>many</b> types at once.</figcaption>
</figure>

Two properties cut across every type below, so we cover them first — then keep them in mind as you read the catalog:

- **`Sized`** — is the size known at compile time? (This whole next section.)
- **Cardinality** — how many values does the type have? This ranges from `0` (the never type `!`) through `1` (zero-sized types) to effectively unbounded (`String`), and it explains why structs and enums are called *product* and *sum* types.

---

# How big is it? `Sized`, unsized types & memory sizes

Before the catalog, the single most important structural question about any type: **does the compiler know its size in bytes at compile time?** The answer splits *all* types in two and determines how you're allowed to store and pass them.

## `Sized` vs. unsized (dynamically sized types)

- **`Sized` types** have a fixed, compile-time-known size: `i32` is 4 bytes, `f64` is 8, a `Point { x: f64, y: f64 }` is 16. **Almost every type is `Sized`.** You can put them on the stack, pass them by value, return them, and store them in variables directly.
- **Unsized types** — also called **DSTs** (*dynamically sized types*) — have a size known only at runtime. There are exactly three you'll meet: **`str`** (some run of UTF-8 bytes), **`[T]`** (a slice of *some* count), and **`dyn Trait`** (some concrete type hidden behind a trait). You can **never hold a DST by value** — only *behind a pointer*.

The reason DSTs work at all is that the pointer to them carries the missing size information. A pointer to a `Sized` type is a **thin pointer** (just an address, one word). A pointer to a DST is a **fat pointer** — an address *plus* a second word: a **length** (for `str`/`[T]`) or a **vtable** address (for `dyn Trait`).

<figure class="diagram">
<svg viewBox="0 0 720 320" role="img" aria-label="Thin pointers store just an address; fat pointers to slices store address plus length, and fat pointers to trait objects store data address plus vtable address">
  <style>
    .fp-l { font: 600 12px var(--font-mono); fill: var(--text); }
    .fp-s { font: 11px var(--font-sans); fill: var(--text-mute); }
    .fp-ptr { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .fp-len { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.4; }
    .fp-vt  { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.4; }
    .fp-data{ fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <text x="10" y="30" class="fp-l">&amp;i32</text>
  <text x="10" y="48" class="fp-s">thin pointer — just an address (1 word)</text>
  <rect x="200" y="14" width="90" height="34" class="fp-ptr"/><text x="215" y="36" class="fp-l">ptr</text>
  <path d="M290 31 L400 31" stroke="var(--text-mute)" stroke-width="1.5" marker-end="url(#fpa)"/>
  <rect x="400" y="14" width="70" height="34" class="fp-data"/><text x="416" y="36" class="fp-l">42</text>
  <text x="10" y="130" class="fp-l">&amp;[u8] / &amp;str</text>
  <text x="10" y="148" class="fp-s">fat pointer — address + length (2 words)</text>
  <rect x="200" y="114" width="90" height="34" class="fp-ptr"/><text x="215" y="136" class="fp-l">ptr</text>
  <rect x="290" y="114" width="80" height="34" class="fp-len"/><text x="302" y="136" class="fp-l">len 4</text>
  <path d="M245 148 L245 176 L400 176 L400 162" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#fpa)"/>
  <rect x="400" y="162" width="200" height="34" class="fp-data"/>
  <text x="414" y="184" class="fp-l">[ b0 b1 b2 b3 ]</text>
  <text x="10" y="248" class="fp-l">&amp;dyn Trait</text>
  <text x="10" y="266" class="fp-s">fat pointer — data + vtable (2 words)</text>
  <rect x="200" y="232" width="90" height="34" class="fp-ptr"/><text x="214" y="254" class="fp-l">data</text>
  <rect x="290" y="232" width="90" height="34" class="fp-vt"/><text x="302" y="254" class="fp-l">vtable</text>
  <path d="M245 266 L245 292 L400 292 L400 280" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#fpa)"/>
  <rect x="400" y="280" width="90" height="30" class="fp-data"/><text x="416" y="300" class="fp-l">value</text>
  <path d="M335 266 L335 300 L520 300 L520 288" stroke="var(--purple)" stroke-width="1.5" fill="none" marker-end="url(#fpa2)"/>
  <rect x="520" y="256" width="150" height="34" class="fp-vt"/><text x="532" y="278" class="fp-l">[ drop, methods ]</text>
  <defs>
    <marker id="fpa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="fpa2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--purple)"/></marker>
  </defs>
</svg>
<figcaption>A pointer to a <b>Sized</b> type is one word; a pointer to a <b>DST</b> carries a second word — a length or a vtable address.</figcaption>
</figure>

```rust,ignore
// Why a DST must live behind a pointer:
let s: str = *"hi";  // ❌ error: the size for `str` cannot be known at compile time
let s: &str = "hi";  // ✅ a reference to str is itself Sized (a fat pointer)
```

> [!jargon] `Sized` — a marker trait
> `Sized` is an automatic [marker trait](#/ch/send-sync): the compiler implements it for every fixed-size type. Generic parameters carry an *implicit* `T: Sized` bound — that's why `fn f<T>(x: T)` only accepts sized types by value. Opt out with `T: ?Sized` ("may or may not be sized") to also accept `str`, `[U]`, or `dyn Trait` — but then you must take `T` behind a pointer (`&T`, `Box<T>`).

## How big is each type? (`size_of` on a 64-bit target)

`std::mem::size_of::<T>()` reports how many bytes a value of `T` occupies. Here is a reference table for common types on a typical **64-bit** machine (where a pointer is 8 bytes). Sizes marked *"—"* are unsized and have no fixed size on their own.

| Type | Size (bytes) | Why |
|---|---|---|
| `()` , unit struct, `[T; 0]` | **0** | zero-sized — one value, no data |
| `bool`, `u8`, `i8` | **1** | smallest addressable unit |
| `u16`, `i16` | **2** | |
| `u32`, `i32`, `f32`, `char` | **4** | `char` is a 4-byte code point |
| `u64`, `i64`, `f64`, `usize`, `isize` | **8** | `usize` = pointer width |
| `u128`, `i128` | **16** | |
| `&T`, `&mut T`, `Box<T>`, `*const T` (T: Sized) | **8** | one thin pointer |
| `&str`, `&[T]`, `Box<str>`, `Box<[T]>` | **16** | fat pointer: ptr + len |
| `&dyn Trait`, `Box<dyn Trait>` | **16** | fat pointer: ptr + vtable |
| `Option<&T>`, `Option<Box<T>>` | **8** | niche optimization — no extra tag |
| `Option<i32>` | **8** | 4-byte payload + tag, padded |
| `String`, `Vec<T>` | **24** | three words: ptr + len + cap |
| `Rc<T>`, `Arc<T>` | **8** | one pointer (counts live on the heap) |
| `(i32, i32)` | **8** | two 4-byte fields |
| `(u8, u64)` | **16** | padded: alignment rounds 1+8 up |
| `str`, `[T]`, `dyn Trait` | **—** | unsized (DSTs) — size known only at runtime |

Run it yourself — the numbers are exactly reproducible:

```rust
use std::mem::size_of;

fn main() {
    // Scalars:
    println!("bool  {}   u8  {}   char {}", size_of::<bool>(), size_of::<u8>(), size_of::<char>());
    println!("i32   {}   f64 {}   u128 {}", size_of::<i32>(), size_of::<f64>(), size_of::<u128>());
    println!("usize {} (pointer width)", size_of::<usize>());

    // Pointers — thin (8) vs fat (16):
    println!("&i32        {}", size_of::<&i32>());           // 8  thin
    println!("Box<i32>    {}", size_of::<Box<i32>>());       // 8  thin
    println!("&str        {}", size_of::<&str>());           // 16 fat (ptr + len)
    println!("&[i32]      {}", size_of::<&[i32]>());         // 16 fat (ptr + len)

    // Owning collections — three words:
    println!("String      {}", size_of::<String>());        // 24 (ptr + len + cap)
    println!("Vec<i32>    {}", size_of::<Vec<i32>>());       // 24

    // The unit type & a zero-sized struct cost nothing:
    struct Marker;
    println!("()          {}", size_of::<()>());             // 0
    println!("Marker      {}", size_of::<Marker>());         // 0

    // Niche optimization — Option is free here:
    println!("Box<i32>         {}", size_of::<Box<i32>>());          // 8
    println!("Option<Box<i32>> {}", size_of::<Option<Box<i32>>>());  // 8 (same!)
}
```

> [!key] Alignment & padding — why sizes round up
> A type's size is always a multiple of its **alignment** (the address boundary it must start on, usually its largest field's size). So `(u8, u64)` is **16** bytes, not 9: the `u8` is followed by 7 bytes of **padding** so the `u64` lands on an 8-byte boundary. Rust may also **reorder** struct fields to minimize padding. Want a compact layout? Order fields large-to-small, or measure with `size_of` — never assume `size = sum of field sizes`.

> [!tip] Keep values small where it counts
> Size matters most for types you **move**, **copy**, or store in **huge collections**. A `Vec<T>` of a million `T`s allocates a million × `size_of::<T>()` bytes, so a 16-byte element vs a 64-byte one is a 48 MB difference. For large enums, box the big variant (`Box<BigThing>`) so every value is just a pointer. `cargo`'s `-Z print-type-sizes` (nightly) or the `top-type-sizes` tooling can audit this.

---

# Part ① — Primitive & scalar types

The atoms of the language: each holds one indivisible value, lives on the stack, and is `Copy` (assigning duplicates the bits instead of moving).

## Integers: `i8` … `i128`, `u8` … `u128`, `isize`, `usize`

**Theory.** An integer type is defined by two things: its **width** in bits (8, 16, 32, 64, 128) and whether it is **signed** (`i`, can be negative) or **unsigned** (`u`, zero and up). Width fixes the range: an `iN` holds `−2ⁿ⁻¹ … 2ⁿ⁻¹−1`, a `uN` holds `0 … 2ⁿ−1`. The default when you don't annotate is **`i32`**. The special pair **`isize`/`usize`** are as wide as a pointer on the target machine (8 bytes on 64-bit) — `usize` is the type of every length and index.

<figure class="diagram">
<svg viewBox="0 0 700 190" role="img" aria-label="Integer types by width: i8/u8 is one byte, i16/u16 two, i32/u32 four, i64/u64 eight, i128/u128 sixteen bytes; isize and usize match the pointer width">
  <style>
    .in-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .in-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .box  { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
    .boxu { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.3; }
  </style>
  <text x="10" y="20" class="in-c">width doubles each step — bigger width, bigger range</text>
  <rect x="10"  y="34" width="30"  height="30" class="box"/><text x="12" y="80" class="in-b">i8</text>
  <rect x="60"  y="34" width="50"  height="30" class="box"/><text x="62" y="80" class="in-b">i16</text>
  <rect x="130" y="34" width="80"  height="30" class="box"/><text x="132" y="80" class="in-b">i32*</text>
  <rect x="230" y="34" width="130" height="30" class="box"/><text x="232" y="80" class="in-b">i64</text>
  <rect x="380" y="34" width="240" height="30" class="box"/><text x="382" y="80" class="in-b">i128</text>
  <text x="628" y="55" class="in-c">signed</text>
  <rect x="10"  y="104" width="30"  height="30" class="boxu"/><text x="12" y="150" class="in-b">u8</text>
  <rect x="60"  y="104" width="50"  height="30" class="boxu"/><text x="62" y="150" class="in-b">u16</text>
  <rect x="130" y="104" width="80"  height="30" class="boxu"/><text x="132" y="150" class="in-b">u32</text>
  <rect x="230" y="104" width="130" height="30" class="boxu"/><text x="232" y="150" class="in-b">u64</text>
  <rect x="380" y="104" width="240" height="30" class="boxu"/><text x="382" y="150" class="in-b">u128</text>
  <text x="628" y="125" class="in-c">unsigned</text>
  <text x="130" y="176" class="in-c">* i32 is the default · usize/isize = pointer width (indexing &amp; lengths)</text>
</svg>
<figcaption>Integer types by byte width. Choose the smallest type that always fits your values; use <code>usize</code> for indices.</figcaption>
</figure>

```rust
fn main() {
    let a: i8 = -128;                 // smallest i8
    let b: u8 = 255;                  // largest u8
    let c = 2_147_483_647;            // inferred i32 (the default), its max
    let big: u64 = 18_446_744_073_709_551_615; // u64::MAX
    let idx: usize = 3;               // pointer-sized — the indexing type
    let list = [10, 20, 30, 40];
    println!("{a} {b} {c} {big}  list[{idx}] = {}", list[idx]);
    println!("i32 is {} bytes, i128 is {} bytes",
             std::mem::size_of::<i32>(), std::mem::size_of::<i128>());
}
```

> [!warning] Overflow is a bug Rust helps you catch
> In debug builds, `250u8 + 10` **panics** (overflow); in release it wraps silently. Don't rely on either — say what you mean with the checked family: `checked_add` (→ `Option`), `wrapping_add` (wraps on purpose), `saturating_add` (clamps to the max), `overflowing_add` (value + a "did it wrap?" flag).
> ```rust
> fn main() {
>     let x: u8 = 250;
>     println!("{:?}", x.checked_add(10));   // None — would overflow
>     println!("{}", x.wrapping_add(10));    // 4   — wraps around
>     println!("{}", x.saturating_add(10));  // 255 — clamps
> }
> ```

**Usefulness.** Integers are everywhere: counts, IDs, indices, byte manipulation. Pick `u8` for raw bytes, `usize` for anything that indexes a collection, `i64`/`u64` for large counts or timestamps, and `i128`/`u128` only when you truly need the range. Defaulting to `i32`/`u32`/`usize` is almost always right.

## Floating-point: `f32` and `f64`

**Theory.** Floats represent real numbers in **IEEE-754** format: a value is split into a **sign** bit, an **exponent**, and a **mantissa** (the significant digits). This lets one type span tiny and huge magnitudes — but it means most decimals (like `0.1`) can't be stored exactly, so floats are *approximate*. `f64` (double precision, the default) has ~15–17 significant digits; `f32` has ~6–9 and half the size.

<figure class="diagram">
<svg viewBox="0 0 700 150" role="img" aria-label="An f64 is 64 bits split into 1 sign bit, 11 exponent bits, and 52 mantissa bits; an f32 is 1 sign, 8 exponent, 23 mantissa">
  <style>
    .fl-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .fl-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .s { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.3; }
    .e { fill: var(--amber-soft); stroke: var(--amber);    stroke-width: 1.3; }
    .m { fill: var(--blue-soft);  stroke: var(--blue);     stroke-width: 1.3; }
  </style>
  <text x="10" y="22" class="fl-b">f64 (8 bytes)</text>
  <rect x="120" y="10" width="30"  height="26" class="s"/><text x="122" y="52" class="fl-c">sign 1</text>
  <rect x="150" y="10" width="120" height="26" class="e"/><text x="152" y="52" class="fl-c">exponent 11</text>
  <rect x="270" y="10" width="410" height="26" class="m"/><text x="272" y="52" class="fl-c">mantissa 52</text>
  <text x="10" y="92" class="fl-b">f32 (4 bytes)</text>
  <rect x="120" y="80" width="30"  height="26" class="s"/><text x="122" y="122" class="fl-c">sign 1</text>
  <rect x="150" y="80" width="90"  height="26" class="e"/><text x="152" y="122" class="fl-c">exponent 8</text>
  <rect x="240" y="80" width="260" height="26" class="m"/><text x="242" y="122" class="fl-c">mantissa 23</text>
</svg>
<figcaption>IEEE-754 layout. The exponent sets the magnitude; the mantissa the precision — which is why decimals are approximate.</figcaption>
</figure>

```rust
fn main() {
    let pi: f64 = 3.141_592_653_589_793;
    let half: f32 = 0.5;
    println!("{pi} {half}");
    // Floats are approximate — never compare with ==:
    println!("0.1 + 0.2 = {}", 0.1_f64 + 0.2);              // 0.30000000000000004
    let close = (0.1_f64 + 0.2 - 0.3).abs() < 1e-10;
    println!("0.1+0.2 ≈ 0.3? {close}");                     // true (compare with a tolerance)
}
```

**Usefulness.** Use `f64` for scientific/graphics/statistics math where fractional precision matters. Use `f32` to halve memory/bandwidth in big buffers (audio, ML tensors, GPU data). **Never** use floats for money — use integer cents or a decimal crate, because rounding error compounds.

## `bool` — true or false

**Theory.** The `bool` type has exactly **two** values, `true` and `false`, and occupies **one byte** (the smallest addressable unit — bits aren't individually addressable). It's the result of every comparison (`==`, `<`, …) and the input to `if`, `while`, and the `&&`/`||`/`!` operators.

```rust
fn main() {
    let is_ready = true;
    let is_done = false;
    println!("{}", is_ready && !is_done);   // true
    println!("{}", 3 > 2);                  // true (comparisons yield bool)
    println!("bool is {} byte", std::mem::size_of::<bool>()); // 1
    println!("true as u8 = {}", is_ready as u8); // 1
}
```

**Usefulness.** Flags, conditions, predicates. In signatures, prefer a two-variant `enum` over a bare `bool` when the meaning isn't obvious at the call site (`set_visible(true)` vs `set_visible(Visibility::Shown)`).

## `char` — one Unicode scalar value

**Theory.** A `char` is a single **Unicode scalar value** and is always **4 bytes** — it is *not* a byte. It can hold any character from any language, plus emoji. This is distinct from how text is *stored*: a `String`/`str` is UTF-8 bytes, where one `char` occupies 1–4 bytes. `'A'` and `'🦀'` are both single `char`s despite very different byte lengths.

<figure class="diagram">
<svg viewBox="0 0 700 140" role="img" aria-label="A char is a fixed 4-byte code point, while the same character encoded in a UTF-8 string may take 1 to 4 bytes">
  <style>
    .ch-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .ch-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cp { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.3; }
    .by { fill: var(--rust-100);  stroke: var(--rust-400); stroke-width: 1.3; }
  </style>
  <text x="10" y="22" class="ch-b">char (always 4 bytes)</text>
  <rect x="200" y="8" width="120" height="28" class="cp"/><text x="212" y="27" class="ch-b">'🦀' = U+1F980</text>
  <text x="10" y="72" class="ch-b">'A' in a String</text>
  <rect x="200" y="58" width="34" height="28" class="by"/><text x="208" y="77" class="ch-b">41</text>
  <text x="250" y="77" class="ch-c">1 UTF-8 byte</text>
  <text x="10" y="112" class="ch-b">'🦀' in a String</text>
  <rect x="200" y="98" width="34" height="28" class="by"/><rect x="236" y="98" width="34" height="28" class="by"/><rect x="272" y="98" width="34" height="28" class="by"/><rect x="308" y="98" width="34" height="28" class="by"/>
  <text x="358" y="117" class="ch-c">4 UTF-8 bytes</text>
</svg>
<figcaption>A <code>char</code> is a fixed 4-byte code point; its <b>encoded</b> length in a UTF-8 string is 1–4 bytes.</figcaption>
</figure>

```rust
fn main() {
    let letter = 'A';
    let crab = '🦀';
    let heart = '\u{2764}';                 // by code point
    println!("{letter} {crab} {heart}");
    println!("char is {} bytes", std::mem::size_of::<char>()); // 4
    println!("'A' as u32 = {}", letter as u32);                // 65
    println!("🦀 needs {} UTF-8 bytes", crab.len_utf8());       // 4
    for c in "hi🦀".chars() { print!("[{c}]"); }               // iterate by char
}
```

**Usefulness.** Character-by-character processing: validating input, parsing, classifying (`is_alphabetic`, `is_numeric`). When you need *text*, use `String`/`&str`; when you need *one symbol*, use `char`.

## `()` — the unit type

**Theory.** The **unit type** `()` has exactly **one** value (also written `()`) and occupies **zero bytes**. It's Rust's "nothing to return" — functions with no `-> Type` implicitly return `()`, and expressions like `println!(...)` evaluate to `()`. It's the simplest [zero-sized type](#zero-sized-types-zsts).

```rust
fn log(msg: &str) { println!("LOG: {msg}"); } // implicitly returns ()

fn main() {
    let nothing: () = ();
    let r: () = log("hi");                  // the return value IS ()
    println!("{nothing:?} {r:?} size = {}", std::mem::size_of::<()>()); // () () size = 0
}
```

**Usefulness.** The "no meaningful value" type: `Result<(), Error>` (succeeds or fails, no payload), `HashSet<T>` = `HashMap<T, ()>`, and channels that signal without sending data (`Sender<()>`).

---

# Part ② — Textual & sequence types

## `str` — the string slice (a DST)

**Theory.** `str` is a run of **UTF-8 bytes** of a length not known at compile time — an *unsized* type, so you never hold a bare `str`; you use **`&str`**, a **fat pointer** (address + byte length). String literals like `"hello"` have type `&'static str` — they point into the program's binary. `str` guarantees valid UTF-8, which is why you can't index it by byte position (that might split a multi-byte character).

```rust
fn main() {
    let literal: &str = "héllo";            // &'static str, points into the binary
    println!("{} bytes, {} chars", literal.len(), literal.chars().count()); // 6 bytes, 5 chars
    println!("upper: {}", literal.to_uppercase());
    println!("starts with 'h'? {}", literal.starts_with('h'));
    println!("&str is {} bytes (ptr + len)", std::mem::size_of::<&str>()); // 16 on 64-bit
}
```

**Usefulness.** `&str` is the universal "borrowed text" type — take `&str` in function parameters (it accepts both literals and `String`s via deref). It's read-only and allocation-free.

## `String` — owned, growable UTF-8 text

**Theory.** `String` **owns** a heap-allocated, growable UTF-8 buffer. On the stack it's **three words**: a pointer to the heap data, a **length** (bytes used), and a **capacity** (bytes allocated). Push onto it and it grows, reallocating when it outgrows its capacity — the same layout as `Vec<u8>`, with the UTF-8 guarantee added.

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A String is three words on the stack — pointer, length, capacity — pointing to a heap buffer of UTF-8 bytes">
  <style>
    .st-b { font: 600 11px var(--font-mono); fill: var(--text); }
    .st-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .stack { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .heap  { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
  </style>
  <text x="10" y="22" class="st-c">stack (the String value, 24 bytes)</text>
  <rect x="10"  y="32" width="90" height="34" class="stack"/><text x="24" y="54" class="st-b">ptr</text>
  <rect x="100" y="32" width="90" height="34" class="stack"/><text x="112" y="54" class="st-b">len 5</text>
  <rect x="190" y="32" width="90" height="34" class="stack"/><text x="202" y="54" class="st-b">cap 8</text>
  <text x="360" y="22" class="st-c">heap (the bytes)</text>
  <path d="M55 66 L55 96 L360 96 L360 84" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#sta)"/>
  <rect x="360" y="84" width="192" height="34" class="heap"/>
  <text x="374" y="106" class="st-b">h e l l o _ _ _</text>
  <text x="360" y="140" class="st-c">len = bytes in use · cap = bytes allocated (spare room to grow)</text>
  <defs><marker id="sta" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>String</code> = {ptr, len, cap} on the stack → a growable UTF-8 buffer on the heap.</figcaption>
</figure>

```rust
fn main() {
    let mut s = String::from("hello");
    s.push(' ');
    s.push_str("world");                    // grows the heap buffer
    println!("{s} (len {}, cap ≥ {})", s.len(), s.capacity() >= s.len());
    let shout = format!("{}!", s.to_uppercase());
    println!("{shout}");
    let borrowed: &str = &s;                // String derefs to &str for free
    println!("borrowed view: {borrowed}");
}
```

**Usefulness.** Any text you build, modify, or own: reading input, formatting output, storing user data. Rule of thumb: **own with `String`, borrow with `&str`.** See [Strings & Text](#/ch/strings).

## Tuple `(T, U, …)` — a fixed group of mixed types

**Theory.** A tuple bundles a **fixed number** of values of **possibly different** types into one value, stored contiguously. It's a **structural** type: `(i32, char)` *is* `(i32, char)` anywhere. Access fields by position (`t.0`) or destructure with a pattern. The empty tuple `()` is the unit type.

<figure class="diagram">
<svg viewBox="0 0 480 90" role="img" aria-label="A tuple stores its fields contiguously side by side">
  <style>.tp-b{font:600 11px var(--font-mono);fill:var(--text);} .f0{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.3;} .f1{fill:var(--green-soft);stroke:var(--green);stroke-width:1.3;} .f2{fill:var(--amber-soft);stroke:var(--amber);stroke-width:1.3;}</style>
  <text x="10" y="22" class="tp-b">(1, 2.0, 'x')</text>
  <rect x="10"  y="34" width="120" height="34" class="f0"/><text x="24" y="56" class="tp-b">.0  i32</text>
  <rect x="130" y="34" width="120" height="34" class="f1"/><text x="144" y="56" class="tp-b">.1  f64</text>
  <rect x="250" y="34" width="120" height="34" class="f2"/><text x="264" y="56" class="tp-b">.2  char</text>
</svg>
<figcaption>A tuple lays its fields out side by side; index them by position.</figcaption>
</figure>

```rust
fn min_max(v: &[i32]) -> (i32, i32) {        // return two values as one
    (*v.iter().min().unwrap(), *v.iter().max().unwrap())
}

fn main() {
    let mixed: (i32, f64, char) = (1, 2.0, 'x');
    let (a, b, c) = mixed;                    // destructure
    println!("{a} {b} {c}  by index: {}", mixed.2);
    let (lo, hi) = min_max(&[3, 9, 1, 7]);
    println!("min {lo}, max {hi}");
}
```

**Usefulness.** Returning several values from a function, grouping temporary related values, and pattern-matching. If a tuple gains meaning or outlives one function, promote it to a named `struct`.

## Array `[T; N]` — a fixed-length block of one type

**Theory.** An array holds exactly **`N`** elements of one type `T`, laid out contiguously, usually on the **stack**. Crucially, **the length `N` is part of the type**: `[u8; 3]` and `[u8; 4]` are different types, and `N` must be known at compile time. Its total size is `N × size_of::<T>()`.

```rust
fn main() {
    let arr: [i32; 5] = [10, 20, 30, 40, 50];
    let zeros = [0u8; 4];                    // [0, 0, 0, 0] — repeat syntax
    println!("{arr:?} {zeros:?}");
    println!("first {}, last {}", arr[0], arr[arr.len() - 1]);
    println!("[i32; 5] is {} bytes", std::mem::size_of::<[i32; 5]>()); // 20
    let total: i32 = arr.iter().sum();       // arrays are iterable
    println!("sum = {total}");
}
```

**Usefulness.** Fixed-size, stack-allocated data where the count is known and constant: RGBA pixels `[u8; 4]`, a 3×3 matrix, lookup tables, embedded buffers. When the size varies at runtime, use `Vec<T>`.

## Slice `[T]` — a borrowed view into a sequence (a DST)

**Theory.** A slice `[T]` is a *view* into a contiguous run of `T` whose length isn't known at compile time — an unsized type used as **`&[T]`** (or `&mut [T]`), a **fat pointer** carrying a pointer + element count. A slice **borrows**; it owns nothing. Both arrays and `Vec`s coerce to slices, so functions taking `&[T]` work with either.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A slice is a fat pointer of address plus length that borrows a window into an array or vector's data">
  <style>.sl-b{font:600 11px var(--font-mono);fill:var(--text);} .sl-c{font:11px var(--font-sans);fill:var(--text-mute);} .ptr{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.4;} .len{fill:var(--amber-soft);stroke:var(--amber);stroke-width:1.4;} .d{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.3;} .dh{fill:var(--green-soft);stroke:var(--green);stroke-width:1.6;}</style>
  <text x="10" y="22" class="sl-c">&amp;arr[1..4]  (a fat pointer)</text>
  <rect x="10"  y="32" width="80" height="32" class="ptr"/><text x="24" y="53" class="sl-b">ptr</text>
  <rect x="90"  y="32" width="80" height="32" class="len"/><text x="102" y="53" class="sl-b">len 3</text>
  <text x="300" y="22" class="sl-c">the array it borrows</text>
  <rect x="300" y="32" width="50" height="32" class="d"/><text x="312" y="53" class="sl-b">10</text>
  <rect x="350" y="32" width="50" height="32" class="dh"/><text x="362" y="53" class="sl-b">20</text>
  <rect x="400" y="32" width="50" height="32" class="dh"/><text x="412" y="53" class="sl-b">30</text>
  <rect x="450" y="32" width="50" height="32" class="dh"/><text x="462" y="53" class="sl-b">40</text>
  <rect x="500" y="32" width="50" height="32" class="d"/><text x="512" y="53" class="sl-b">50</text>
  <path d="M50 64 L50 92 L375 92 L375 68" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#sla)"/>
  <text x="120" y="120" class="sl-c">points at the first element of the window; len says how many follow.</text>
  <defs><marker id="sla" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>A slice borrows a contiguous window; it stores where the window starts and how long it is.</figcaption>
</figure>

```rust
fn average(nums: &[f64]) -> f64 {            // accepts arrays AND vecs
    nums.iter().sum::<f64>() / nums.len() as f64
}

fn main() {
    let arr = [1.0, 2.0, 3.0, 4.0];
    let v = vec![10.0, 20.0, 30.0];
    println!("array avg  = {}", average(&arr));   // slice of an array
    println!("vec avg    = {}", average(&v));      // slice of a vec
    println!("middle     = {:?}", &arr[1..3]);     // [2.0, 3.0]
}
```

**Usefulness.** The idiomatic way to accept "a sequence of T" in a function — take `&[T]` and callers can pass an array, a `Vec`, or a sub-range. `&str` is just a specialized `&[u8]` for text.

---

# Part ③ — Pointers & references

Every type here holds the **address** of data living elsewhere; they differ in *ownership*, *sharing*, and *mutation* rules. See [References & Borrowing](#/ch/references-borrowing) and [Smart Pointers](#/ch/box).

## Shared reference `&T` and mutable reference `&mut T`

**Theory.** A reference **borrows** access to a value it doesn't own. `&T` is a **shared** (read-only) reference — you can have many at once. `&mut T` is an **exclusive** (read-write) reference — you can have only one, and no shared references may coexist with it. This "one writer XOR many readers" rule, checked by the **borrow checker**, is what makes Rust memory-safe without a garbage collector. A reference to a `Sized` type is a **thin pointer** (one address).

```rust
fn main() {
    let mut n = 10;
    let r1 = &n;                 // shared borrow
    let r2 = &n;                 // ...many allowed at once
    println!("read: {r1} {r2}");
    // The shared borrows end above; now an exclusive borrow is allowed:
    let m = &mut n;
    *m += 5;                     // mutate through &mut
    println!("after &mut: {n}"); // 15
}
```

**Usefulness.** The default way to pass data to a function **without giving up ownership** — no copy, no move. Use `&T` to read, `&mut T` to modify in place. References are zero-cost and the backbone of everyday Rust.

## Raw pointers `*const T` and `*mut T`

**Theory.** Raw pointers are plain addresses with **no safety guarantees** — they can be null, dangling, or aliased, and the borrow checker ignores them. *Creating* one is safe; **dereferencing** requires an `unsafe` block, where you promise the compiler the pointer is valid. They're the tool for FFI, custom data structures, and interop.

```rust
fn main() {
    let x = 42;
    let mut y = 10;
    let p: *const i32 = &x;       // create — safe
    let pm: *mut i32 = &mut y;
    unsafe {
        println!("*p = {}", *p);  // 42 — deref needs unsafe
        *pm = 20;                 // write through a raw pointer
    }
    println!("y is now {y}");     // 20
    println!("address: {p:p}");
}
```

**Usefulness.** Only when you truly need them: [FFI](#/ch/ffi) with C, building data structures the borrow checker can't express, or performance-critical `unsafe` code. In safe Rust, reach for references and smart pointers instead.

## `Box<T>` — the simplest heap allocation

**Theory.** `Box<T>` **owns** a single value stored on the **heap**; the `Box` itself is one pointer-word on the stack. When the `Box` drops, the heap value is freed. Because a `Box` is a fixed-size pointer regardless of what it points to, it also lets you store **unsized** or **recursive** types (a struct that contains itself).

<figure class="diagram">
<svg viewBox="0 0 560 130" role="img" aria-label="A Box is a single pointer on the stack owning one value on the heap">
  <style>.bx-b{font:600 11px var(--font-mono);fill:var(--text);} .bx-c{font:11px var(--font-sans);fill:var(--text-mute);} .s{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.4;} .h{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;}</style>
  <text x="10" y="22" class="bx-c">stack</text>
  <rect x="10" y="32" width="100" height="34" class="s"/><text x="30" y="54" class="bx-b">Box(ptr)</text>
  <text x="320" y="22" class="bx-c">heap (owned, freed on drop)</text>
  <path d="M60 66 L60 92 L320 92 L320 82" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#bxa)"/>
  <rect x="320" y="66" width="90" height="34" class="h"/><text x="344" y="88" class="bx-b">42</text>
  <defs><marker id="bxa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>Box&lt;T&gt;</code>: one owner, one pointer on the stack, the value on the heap.</figcaption>
</figure>

```rust
#[derive(Debug)]
enum List { Cons(i32, Box<List>), Nil }     // recursive — needs the Box for a known size

fn main() {
    let boxed = Box::new(42);                 // 42 lives on the heap
    println!("{boxed} + 1 = {}", *boxed + 1); // deref with *
    use List::*;
    let list = Cons(1, Box::new(Cons(2, Box::new(Nil))));
    println!("{list:?}");
}
```

**Usefulness.** Put a large value on the heap to keep moves cheap; enable recursive types (trees, linked lists); store trait objects (`Box<dyn Trait>`); or hand ownership of heap data across boundaries. It's the default heap pointer — reach for `Box` first.

## `Rc<T>` and `Arc<T>` — shared ownership by reference counting

**Theory.** Sometimes data needs **many owners** and no single one can be "the" owner. `Rc<T>` (**R**eference **c**ounted) keeps a count of how many owners exist; `clone` bumps the count (cheap — no deep copy), and the value is freed only when the count hits zero. `Rc` is **single-threaded**. **`Arc<T>`** (**A**tomic **Rc**) is the same idea with a thread-safe atomic counter, so it can be shared across threads (`Send + Sync`).

<figure class="diagram">
<svg viewBox="0 0 600 160" role="img" aria-label="Three Rc handles all point to one heap allocation that holds a strong count and the value; cloning increments the count">
  <style>.rc-b{font:600 11px var(--font-mono);fill:var(--text);} .rc-c{font:11px var(--font-sans);fill:var(--text-mute);} .s{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.4;} .h{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;} .cnt{fill:var(--amber-soft);stroke:var(--amber);stroke-width:1.4;}</style>
  <rect x="10" y="20" width="70" height="28" class="s"/><text x="24" y="39" class="rc-b">a</text>
  <rect x="10" y="60" width="70" height="28" class="s"/><text x="24" y="79" class="rc-b">b</text>
  <rect x="10" y="100" width="70" height="28" class="s"/><text x="24" y="119" class="rc-b">c</text>
  <path d="M80 34 L360 60" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rca)"/>
  <path d="M80 74 L360 74" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rca)"/>
  <path d="M80 114 L360 88" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#rca)"/>
  <text x="360" y="42" class="rc-c">one heap allocation</text>
  <rect x="360" y="50" width="110" height="30" class="cnt"/><text x="372" y="70" class="rc-b">strong = 3</text>
  <rect x="360" y="80" width="110" height="30" class="h"/><text x="372" y="100" class="rc-b">value</text>
  <text x="360" y="140" class="rc-c">count hits 0 → value freed</text>
  <defs><marker id="rca" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption>Every <code>clone</code> is another owner pointing at the same allocation; the value lives until the last one drops.</figcaption>
</figure>

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("shared data"));
    let b = Rc::clone(&a);                    // +1 owner, no copy of the string
    let c = Rc::clone(&a);
    println!("value = {a}, owners = {}", Rc::strong_count(&a)); // 3
    drop(b);
    drop(c);
    println!("after drops, owners = {}", Rc::strong_count(&a)); // 1
}
```

**Usefulness.** Graphs, trees with shared nodes, or any structure where one value is referenced from many places and lifetimes don't nest cleanly. Use `Rc` single-threaded, `Arc` across threads. For *shared mutation*, combine with `RefCell` (`Rc<RefCell<T>>`) or `Mutex` (`Arc<Mutex<T>>`). See [Rc & Arc](#/ch/rc-arc).

## `Cell<T>` / `RefCell<T>` — interior mutability

**Theory.** Normally, mutating requires a `&mut`. **Interior mutability** types let you mutate through a *shared* `&` by moving the borrow check to **runtime**. `Cell<T>` swaps whole values; `RefCell<T>` hands out `borrow()`/`borrow_mut()` guards and **panics** if you break the one-writer rule at runtime instead of compile time.

```rust
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(vec![1, 2, 3]);
    cell.borrow_mut().push(4);                // mutate through a shared reference
    println!("{:?}", cell.borrow());          // [1, 2, 3, 4]
    println!("len = {}", cell.borrow().len());
}
```

**Usefulness.** When you *know* your access is safe but the compiler can't prove it: mutable fields behind a shared handle, caches/memoization, `Rc<RefCell<T>>` for shared-mutable graph nodes. See [RefCell & Interior Mutability](#/ch/refcell).

## `Cow<T>` — clone-on-write

**Theory.** `Cow` ("clone on write") is an enum that is *either* `Borrowed` or `Owned`. It lets an API **avoid allocating** unless it actually has to modify the data — you borrow the input in the common case and only clone when a change is needed.

```rust
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))   // must change it → allocate
    } else {
        Cow::Borrowed(input)                   // already fine → no allocation
    }
}

fn main() {
    println!("{}", normalize("already_clean")); // borrowed, zero allocation
    println!("{}", normalize("needs cleaning")); // owned, allocated once
}
```

**Usefulness.** Hot paths where inputs are *usually* already in the right form (config parsing, escaping/normalizing text) — you pay for an allocation only in the rare case that needs it.

---

# Part ④ — User-defined (nominal) types

The types you name and define. See [Structs](#/ch/structs) and [Enums](#/ch/enums).

## `struct` — group related data (a product type)

**Theory.** A `struct` groups several named values into one type; its fields sit **side by side** in memory. There are three flavors: **named-field** (`struct P { x, y }`), **tuple struct** (`struct Meters(f64)` — fields by position, great for the [newtype pattern](#/ch/advanced-types)), and **unit struct** (`struct Marker;` — no fields, zero-sized). A struct is a **product type**: its number of possible values is the *product* of its fields'.

```rust
struct Point { x: f64, y: f64 }       // named-field
struct Meters(f64);                    // tuple struct (newtype)
struct Marker;                         // unit struct — zero-sized

impl Point {
    fn dist(&self) -> f64 { (self.x * self.x + self.y * self.y).sqrt() }
}

fn main() {
    let p = Point { x: 3.0, y: 4.0 };
    let d = Meters(5.0);
    let _m = Marker;
    println!("distance = {}", p.dist());   // 5
    println!("meters = {}", d.0);           // access tuple-struct field by index
    println!("Marker size = {}", std::mem::size_of::<Marker>()); // 0
}
```

**Usefulness.** The workhorse for modeling domain data: a `User`, a `Config`, a `Request`. Named fields make code self-documenting; the newtype flavor gives you a distinct compiler-checked type (`struct UserId(u64)`).

## `enum` — one of several variants (a sum type)

**Theory.** An `enum` is a value that is **exactly one** of several **variants**, each optionally carrying its own data. In memory it's a small **tag** (which variant) plus space sized for its **largest** variant. It's a **sum type**: its value count is the *sum* of its variants'. Combined with `match`, enums make illegal states unrepresentable — the compiler forces you to handle every case.

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="An enum stores a tag identifying the active variant, followed by space sized for the largest variant's payload">
  <style>.en-b{font:600 11px var(--font-mono);fill:var(--text);} .en-c{font:11px var(--font-sans);fill:var(--text-mute);} .tag{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;} .pl{fill:var(--purple-soft);stroke:var(--purple);stroke-width:1.4;}</style>
  <text x="10" y="22" class="en-b">enum Shape { Circle(f64), Rect { w: f64, h: f64 } }</text>
  <rect x="10" y="34" width="70" height="34" class="tag"/><text x="28" y="56" class="en-b">tag</text>
  <rect x="80" y="34" width="150" height="34" class="pl"/><text x="100" y="56" class="en-b">w / radius (8)</text>
  <rect x="230" y="34" width="150" height="34" class="pl"/><text x="256" y="56" class="en-b">h (8)</text>
  <text x="400" y="55" class="en-c">Circle uses only the first payload slot</text>
  <text x="10" y="98" class="en-c">tag says which variant is active; the payload is sized for the biggest one.</text>
</svg>
<figcaption>An enum = tag + payload sized for its largest variant. <code>match</code> reads the tag and unpacks the right data.</figcaption>
</figure>

```rust
enum Shape { Circle(f64), Rectangle { w: f64, h: f64 }, Empty }

fn area(s: &Shape) -> f64 {
    match s {                                 // must cover every variant
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle { w, h } => w * h,
        Shape::Empty => 0.0,
    }
}

fn main() {
    let shapes = [Shape::Circle(1.0), Shape::Rectangle { w: 2.0, h: 3.0 }, Shape::Empty];
    let total: f64 = shapes.iter().map(area).sum();
    println!("total area = {total:.3}");
}
```

**Usefulness.** State machines, message/command types, ASTs, and anything with a fixed set of alternatives. `Option` and `Result` (below) are enums. Prefer an enum over a bag of booleans — it makes invalid combinations impossible.

## `union` — overlapping memory (unsafe)

**Theory.** A `union` stores all its fields in the **same** memory, so only one is valid at a time — and Rust can't track which. Reading a field is therefore `unsafe`: you assert which one is active. Unlike an enum, there's no tag. It exists almost entirely for **C interop**.

```rust
union IntOrFloat { i: u32, f: f32 }

fn main() {
    let u = IntOrFloat { i: 1_069_547_520 };
    // Reinterpret the same bits as a float — you promise `f` is the right reading:
    unsafe { println!("same bits as f32: {}", u.f); } // 1.5
}
```

**Usefulness.** Rare — [FFI](#/ch/ffi) with C unions, or hand-rolled bit-reinterpretation in `unsafe` code. In normal Rust, use an `enum` instead; it's tagged and safe.

## `Option<T>` — a value that might be absent

**Theory.** `Option<T>` is the standard enum with two variants: `Some(T)` (a value) or `None` (nothing). Rust has **no null**; `Option` makes absence explicit in the type, so the compiler forces you to handle the empty case. Thanks to **niche optimization**, `Option<Box<T>>`, `Option<&T>`, etc. take **no extra space** — the impossible null address encodes `None`.

<figure class="diagram">
<svg viewBox="0 0 620 110" role="img" aria-label="Option of a Box is the same size as a Box because None reuses the null pointer value">
  <style>.op-b{font:600 11px var(--font-mono);fill:var(--text);} .op-c{font:11px var(--font-sans);fill:var(--text-mute);} .a{fill:var(--green-soft);stroke:var(--green);stroke-width:1.4;} .b{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;}</style>
  <text x="10" y="22" class="op-b">Box&lt;i32&gt;  (8 bytes)</text>
  <rect x="230" y="8" width="120" height="28" class="a"/><text x="244" y="27" class="op-b">ptr → heap</text>
  <text x="10" y="72" class="op-b">Option&lt;Box&lt;i32&gt;&gt;  (still 8!)</text>
  <rect x="230" y="58" width="120" height="28" class="a"/><text x="244" y="77" class="op-b">Some → ptr</text>
  <rect x="360" y="58" width="120" height="28" class="b"/><text x="374" y="77" class="op-b">None → null (0)</text>
  <text x="10" y="102" class="op-c">niche optimization: the never-valid null address encodes None, so no tag byte is needed.</text>
</svg>
<figcaption>Because a valid <code>Box</code> is never null, <code>None</code> reuses that null bit-pattern — <code>Option&lt;Box&gt;</code> costs nothing extra.</figcaption>
</figure>

```rust
fn first_even(v: &[i32]) -> Option<i32> {
    v.iter().find(|&&x| x % 2 == 0).copied()  // Some(x) or None
}

fn main() {
    println!("{:?}", first_even(&[1, 3, 4, 5])); // Some(4)
    println!("{:?}", first_even(&[1, 3, 5]));     // None
    let got = first_even(&[2, 4]).unwrap_or(-1);  // default if None
    println!("got = {got}");
    if let Some(x) = first_even(&[7, 8]) { println!("found {x}"); }
    println!("Box={}  Option<Box>={}",
        std::mem::size_of::<Box<i32>>(), std::mem::size_of::<Option<Box<i32>>>()); // 8 8
}
```

**Usefulness.** Anywhere a value may be missing: a map lookup, the first match, an optional field, a not-yet-initialized value. Replaces null-pointer bugs with a case the compiler makes you handle. See [Result & Option](#/ch/result-option).

## `Result<T, E>` — success or failure

**Theory.** `Result<T, E>` is the enum `Ok(T)` (success, with a value) or `Err(E)` (failure, with an error). Rust models recoverable errors as **values**, not exceptions — a fallible function returns a `Result`, and the caller must deal with both outcomes. The **`?` operator** makes propagation ergonomic: it returns early on `Err`, unwraps on `Ok`.

```rust
use std::num::ParseIntError;

fn add_strings(a: &str, b: &str) -> Result<i32, ParseIntError> {
    Ok(a.parse::<i32>()? + b.parse::<i32>()?)   // ? propagates any parse error
}

fn main() {
    println!("{:?}", add_strings("2", "3"));    // Ok(5)
    println!("{:?}", add_strings("x", "3"));    // Err(ParseIntError ...)
    match add_strings("10", "20") {
        Ok(n) => println!("sum is {n}"),
        Err(e) => println!("failed: {e}"),
    }
}
```

**Usefulness.** *Every* operation that can fail: I/O, parsing, network, validation. Combined with `?` and a custom error type, it gives clean, explicit, exception-free error handling. See [The ? Operator](#/ch/question-mark).

---

# Part ⑤ — Collections (standard library)

Growable, heap-backed containers built from the types above. See [Vectors](#/ch/vectors), [Hash Maps](#/ch/hashmaps), and [other collections](#/ch/other-collections).

## `Vec<T>` — the growable array

**Theory.** `Vec<T>` is the workhorse collection: a **growable**, heap-allocated array. Like `String`, its stack value is **three words** — pointer, length, capacity — pointing at a contiguous heap buffer that reallocates (usually doubling) when it fills. Elements are packed tightly, so iteration is cache-friendly and fast.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A Vec is pointer, length, and capacity on the stack pointing to a contiguous heap buffer with spare capacity">
  <style>.ve-b{font:600 11px var(--font-mono);fill:var(--text);} .ve-c{font:11px var(--font-sans);fill:var(--text-mute);} .s{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.4;} .h{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;} .sp{fill:var(--surface-2);stroke:var(--border-strong);stroke-width:1.2;}</style>
  <text x="10" y="22" class="ve-c">stack (24 bytes)</text>
  <rect x="10"  y="32" width="80" height="32" class="s"/><text x="24" y="53" class="ve-b">ptr</text>
  <rect x="90"  y="32" width="80" height="32" class="s"/><text x="102" y="53" class="ve-b">len 3</text>
  <rect x="170" y="32" width="80" height="32" class="s"/><text x="182" y="53" class="ve-b">cap 4</text>
  <text x="360" y="22" class="ve-c">heap buffer</text>
  <path d="M50 64 L50 92 L360 92 L360 82" stroke="var(--text-mute)" stroke-width="1.5" fill="none" marker-end="url(#vea)"/>
  <rect x="360" y="66" width="50" height="32" class="h"/><text x="376" y="87" class="ve-b">1</text>
  <rect x="410" y="66" width="50" height="32" class="h"/><text x="426" y="87" class="ve-b">2</text>
  <rect x="460" y="66" width="50" height="32" class="h"/><text x="476" y="87" class="ve-b">3</text>
  <rect x="510" y="66" width="50" height="32" class="sp"/><text x="524" y="87" class="ve-b">·</text>
  <text x="360" y="128" class="ve-c">len = used · cap = allocated (the trailing spare grows without reallocating).</text>
  <defs><marker id="vea" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>Vec&lt;T&gt;</code> = {ptr, len, cap} → a contiguous heap buffer with room to grow.</figcaption>
</figure>

```rust
fn main() {
    let mut v: Vec<i32> = Vec::new();
    v.push(1);
    v.push(2);
    v.push(3);
    v.extend([4, 5]);
    let doubled: Vec<i32> = v.iter().map(|x| x * 2).collect();
    println!("{v:?} → {doubled:?}");
    println!("len {}, sum {}", v.len(), v.iter().sum::<i32>());
    println!("Vec value is {} bytes", std::mem::size_of::<Vec<i32>>()); // 24 on 64-bit
}
```

**Usefulness.** The default "list of things" whenever the count varies at runtime: collecting results, building buffers, stacks. Reach for `Vec` first; specialize only when you have a reason.

## `VecDeque<T>` — a double-ended queue

**Theory.** A ring-buffer that allows **O(1)** push/pop at **both** ends — something `Vec` can't do efficiently at the front. Otherwise it behaves like a `Vec`.

```rust
use std::collections::VecDeque;

fn main() {
    let mut q: VecDeque<i32> = VecDeque::new();
    q.push_back(1);
    q.push_back(2);
    q.push_front(0);                          // cheap at the front, unlike Vec
    println!("{q:?}");                         // [0, 1, 2]
    println!("popped front: {:?}", q.pop_front()); // Some(0)
}
```

**Usefulness.** Queues (FIFO), work/task buffers, breadth-first search, sliding windows — anything needing efficient access at both ends.

## `HashMap<K, V>` and `BTreeMap<K, V>` — key → value

**Theory.** A **map** associates keys with values. `HashMap` hashes each key to a bucket for average **O(1)** lookup, with **no ordering**. `BTreeMap` stores entries in a balanced tree, giving **sorted** keys and **O(log n)** lookup plus range queries. Keys must be hashable (`HashMap`) or ordered (`BTreeMap`).

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="A HashMap runs each key through a hash function to choose a bucket that stores the key-value pair">
  <style>.hm-b{font:600 11px var(--font-mono);fill:var(--text);} .hm-c{font:11px var(--font-sans);fill:var(--text-mute);} .k{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.3;} .f{fill:var(--amber-soft);stroke:var(--amber);stroke-width:1.3;} .bk{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.3;}</style>
  <rect x="10" y="30" width="80" height="30" class="k"/><text x="20" y="50" class="hm-b">"alice"</text>
  <path d="M90 45 L140 45" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#hma)"/>
  <rect x="140" y="30" width="90" height="30" class="f"/><text x="150" y="50" class="hm-b">hash()</text>
  <path d="M230 45 L280 45" stroke="var(--text-mute)" stroke-width="1.4" marker-end="url(#hma)"/>
  <text x="300" y="20" class="hm-c">buckets</text>
  <rect x="300" y="12" width="140" height="26" class="bk"/><text x="312" y="30" class="hm-b">bucket 0</text>
  <rect x="300" y="42" width="140" height="26" class="bk"/><text x="312" y="60" class="hm-b">bucket 1 → alice:10</text>
  <rect x="300" y="72" width="140" height="26" class="bk"/><text x="312" y="90" class="hm-b">bucket 2</text>
  <text x="10" y="130" class="hm-c">the hash of the key picks a bucket → average O(1) insert &amp; lookup (unordered).</text>
  <defs><marker id="hma" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker></defs>
</svg>
<figcaption><code>HashMap</code> hashes the key to a bucket for O(1) access; <code>BTreeMap</code> keeps keys sorted instead.</figcaption>
</figure>

```rust
use std::collections::{HashMap, BTreeMap};

fn main() {
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert("alice".into(), 10);
    scores.insert("bob".into(), 7);
    *scores.entry("alice".into()).or_insert(0) += 5;  // the entry API: update-or-insert
    println!("alice = {:?}", scores.get("alice"));     // Some(15)

    let mut sorted: BTreeMap<i32, &str> = BTreeMap::new();
    sorted.insert(3, "c");
    sorted.insert(1, "a");
    sorted.insert(2, "b");
    for (k, v) in &sorted { print!("{k}:{v} "); }      // 1:a 2:b 3:c — always sorted
    println!();
}
```

**Usefulness.** `HashMap` for fast lookups by key (caches, indexes, counting/grouping). `BTreeMap` when you need keys **in order** or **range queries** (leaderboards, time buckets). See [Hash Maps](#/ch/hashmaps).

## `HashSet<T>` / `BTreeSet<T>` — unique membership

**Theory.** A **set** stores unique values with fast membership testing — literally a map with `()` values. `HashSet` is unordered O(1); `BTreeSet` is sorted O(log n). They provide mathematical set operations: union, intersection, difference.

```rust
use std::collections::HashSet;

fn main() {
    let a: HashSet<i32> = [1, 2, 3, 4].into_iter().collect();
    let b: HashSet<i32> = [3, 4, 5, 6].into_iter().collect();
    println!("contains 2? {}", a.contains(&2));         // true
    let mut common: Vec<i32> = a.intersection(&b).copied().collect();
    common.sort();
    println!("intersection = {common:?}");              // [3, 4]
}
```

**Usefulness.** De-duplication, "have I seen this?" checks, visited-node tracking in graph algorithms, and set math on tags/permissions.

## Ranges: `Range`, `RangeInclusive`, and friends

**Theory.** Range types describe a span of values. `a..b` is a `Range` (half-open, excludes `b`); `a..=b` is a `RangeInclusive`; `..`, `a..`, `..b` are open-ended forms. Ranges are both **iterators** (`for i in 0..5`) and **slice indices** (`&v[1..3]`).

```rust
fn main() {
    println!("sum 1..5  = {}", (1..5).sum::<i32>());    // 10 (1,2,3,4)
    println!("sum 1..=5 = {}", (1..=5).sum::<i32>());   // 15 (1..5 inclusive)
    let v = [10, 20, 30, 40, 50];
    println!("slice &v[1..3] = {:?}", &v[1..3]);         // [20, 30]
    for i in (0..10).step_by(3) { print!("{i} "); }      // 0 3 6 9
    println!();
}
```

**Usefulness.** Counted loops, slicing, generating sequences, and expressing bounds (`clamp`, pattern ranges `1..=5 => ...`).

---

# Part ⑥ — Functions, closures & abstract types

## Function items and function pointers `fn(T) -> U`

**Theory.** Every `fn` you define has a unique, **zero-sized** *function item type*. When you store it in a variable or pass it where a value is expected, it coerces to a **function pointer** `fn(T) -> U` — a plain one-word pointer to code, with **no captured state**.

```rust
fn add(a: i32, b: i32) -> i32 { a + b }
fn mul(a: i32, b: i32) -> i32 { a * b }

fn main() {
    let ops: [fn(i32, i32) -> i32; 2] = [add, mul]; // an array of function pointers
    for op in ops { println!("{}", op(6, 7)); }      // 13, then 42
    let f: fn(i32, i32) -> i32 = add;
    println!("fn pointer is {} bytes", std::mem::size_of_val(&f)); // 8
}
```

**Usefulness.** Callbacks and dispatch tables where no captured environment is needed; the exact type for C interop function pointers. When you need to capture surrounding variables, use a closure instead.

## Closures — anonymous functions that capture: `Fn` / `FnMut` / `FnOnce`

**Theory.** A closure `|args| body` is an anonymous function that can **capture** variables from its surroundings. Each closure has its own unnamed, compiler-generated type. Which of the three closure **traits** it implements depends on *how* it uses captures: **`Fn`** (only reads them, callable many times), **`FnMut`** (mutates them, callable many times), **`FnOnce`** (consumes them, callable once). They nest: every `Fn` is an `FnMut`, every `FnMut` is an `FnOnce`.

<figure class="diagram">
<svg viewBox="0 0 720 210" role="img" aria-label="FnOnce is the widest set, FnMut is inside it, and Fn is inside FnMut">
  <style>
    .cl-t { font: 700 13px var(--font-mono); fill: var(--text); }
    .cl-c { font: 11px var(--font-sans); fill: var(--text-soft); }
    .cl-1 { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .cl-2 { fill: var(--amber-soft); stroke: var(--amber); stroke-width: 1.5; }
    .cl-3 { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <ellipse cx="360" cy="105" rx="345" ry="90" class="cl-1"/>
  <ellipse cx="360" cy="105" rx="235" ry="66" class="cl-2"/>
  <ellipse cx="360" cy="105" rx="120" ry="40" class="cl-3"/>
  <text x="360" y="102" text-anchor="middle" class="cl-t">Fn</text>
  <text x="360" y="120" text-anchor="middle" class="cl-c">reads captures · call many times</text>
  <text x="360" y="58"  text-anchor="middle" class="cl-t">FnMut</text>
  <text x="360" y="170" text-anchor="middle" class="cl-t">FnOnce</text>
  <text x="360" y="192" text-anchor="middle" class="cl-c">consumes captures · call once</text>
  <text x="145" y="58"  text-anchor="middle" class="cl-c">mutates · call many</text>
</svg>
<figcaption>The closure traits nest. Accept the <b>weakest</b> one your function needs (<code>FnOnce</code> ⊃ <code>FnMut</code> ⊃ <code>Fn</code>).</figcaption>
</figure>

```rust
fn main() {
    let factor = 3;
    let scale = |x: i32| x * factor;          // Fn: only reads `factor`
    println!("{}", scale(10));                 // 30

    let mut total = 0;
    let mut accumulate = |x: i32| { total += x; total }; // FnMut: mutates `total`
    println!("{} {}", accumulate(5), accumulate(7));      // 5 12

    let owned = String::from("moved");
    let consume = move || owned;               // FnOnce: moves `owned` out
    println!("{}", consume());
}
```

**Usefulness.** The heart of functional Rust: iterator adapters (`map`, `filter`), sorting keys, event handlers, and passing behavior into functions. See [Closures](#/ch/closures).

## Generics `<T>` — one definition, many concrete types

**Theory.** Generics let you write a function or type once and use it for *any* type meeting some **trait bounds**. The compiler performs **monomorphization**: it stamps out a specialized copy for each concrete type you actually use — so generics are **zero-cost** (as fast as hand-written specific code), at the price of some code-size growth.

```rust
fn largest<T: PartialOrd + Copy>(items: &[T]) -> T {
    let mut max = items[0];
    for &x in &items[1..] {
        if x > max { max = x; }
    }
    max
}

fn main() {
    println!("{}", largest(&[3, 7, 2, 9, 4]));   // 9   (T = i32)
    println!("{}", largest(&[1.5, 0.2, 3.9]));   // 3.9 (T = f64)
    println!("{}", largest(&['a', 'z', 'm']));   // z   (T = char)
}
```

**Usefulness.** Reusable containers and algorithms without duplication or runtime cost: `Vec<T>`, `Option<T>`, and your own generic data structures and helpers. See [Generics](#/ch/generics).

## Const generics `<const N: usize>` — values in the type

**Theory.** A type can be parameterized by a **constant value**, not just a type — most commonly an array length. `[T; N]` is really a whole family of types indexed by `N`, and you can write code generic over that `N`.

```rust
fn sum<const N: usize>(arr: [i32; N]) -> i32 {   // works for ANY array length
    arr.iter().sum()
}

fn dot<const N: usize>(a: [f64; N], b: [f64; N]) -> f64 {
    (0..N).map(|i| a[i] * b[i]).sum()
}

fn main() {
    println!("{}", sum([1, 2, 3]));               // N = 3 → 6
    println!("{}", sum([10, 20, 30, 40]));        // N = 4 → 100
    println!("{}", dot([1.0, 2.0], [3.0, 4.0]));  // 11.0
}
```

**Usefulness.** Fixed-size math (vectors, matrices), fixed buffers, and APIs where the size is a compile-time constant you want checked — without giving up genericity.

## Trait objects `dyn Trait` — many types behind one pointer

**Theory.** A trait object `dyn Trait` **erases** the concrete type: it's a **fat pointer** carrying a data pointer plus a **vtable** (a table of the type's method addresses). Calls dispatch through the vtable at **runtime** (**dynamic dispatch**). This lets one variable or collection hold *different* concrete types that share a trait — at the cost of one pointer indirection and no inlining.

<figure class="diagram">
<svg viewBox="0 0 560 130" role="img" aria-label="A dyn Trait pointer holds a data pointer and a vtable pointer; method calls jump through the vtable">
  <style>.dy-b{font:600 11px var(--font-mono);fill:var(--text);} .dy-c{font:11px var(--font-sans);fill:var(--text-mute);} .d{fill:var(--blue-soft);stroke:var(--blue);stroke-width:1.4;} .vt{fill:var(--purple-soft);stroke:var(--purple);stroke-width:1.4;} .h{fill:var(--rust-100);stroke:var(--rust-400);stroke-width:1.4;}</style>
  <text x="10" y="22" class="dy-c">&amp;dyn Shape (fat pointer)</text>
  <rect x="10" y="32" width="90" height="30" class="d"/><text x="24" y="52" class="dy-b">data</text>
  <rect x="100" y="32" width="90" height="30" class="vt"/><text x="112" y="52" class="dy-b">vtable</text>
  <path d="M55 62 L55 92 L230 92 L230 82" stroke="var(--text-mute)" stroke-width="1.4" fill="none" marker-end="url(#dya)"/>
  <rect x="230" y="66" width="80" height="26" class="h"/><text x="244" y="84" class="dy-b">value</text>
  <path d="M145 62 L145 108 L360 108 L360 78" stroke="var(--purple)" stroke-width="1.4" fill="none" marker-end="url(#dya2)"/>
  <rect x="360" y="52" width="180" height="26" class="vt"/><text x="372" y="70" class="dy-b">[ drop | area | ... ]</text>
  <defs><marker id="dya" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker><marker id="dya2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--purple)"/></marker></defs>
</svg>
<figcaption><code>dyn Trait</code> = data pointer + vtable pointer; each method call looks up its address in the vtable.</figcaption>
</figure>

```rust
trait Shape { fn area(&self) -> f64; }
struct Circle(f64);
struct Square(f64);
impl Shape for Circle { fn area(&self) -> f64 { std::f64::consts::PI * self.0 * self.0 } }
impl Shape for Square { fn area(&self) -> f64 { self.0 * self.0 } }

fn main() {
    // Different concrete types, stored together behind one trait:
    let shapes: Vec<Box<dyn Shape>> = vec![Box::new(Circle(1.0)), Box::new(Square(2.0))];
    let total: f64 = shapes.iter().map(|s| s.area()).sum();
    println!("total area = {total:.3}");
}
```

**Usefulness.** Heterogeneous collections, plugin systems, and keeping binary size/compile time down. When you *don't* need runtime variety, prefer generics/`impl Trait` (below) for speed. See [Trait Objects](#/ch/trait-objects).

## `impl Trait` — an opaque concrete type

**Theory.** `impl Trait` means "some **single** concrete type that implements this trait, chosen by the compiler, whose name I won't write." As a **return** type it lets you return closures and iterators (whose real types are unnameable) with **static dispatch** (zero cost). As an **argument** type it's shorthand for a generic parameter.

```rust
fn evens_up_to(n: i32) -> impl Iterator<Item = i32> {   // real type is unnameable
    (0..n).filter(|x| x % 2 == 0)
}

fn print_all(items: impl IntoIterator<Item = i32>) {    // = generic argument
    for x in items { print!("{x} "); }
    println!();
}

fn main() {
    let e: Vec<i32> = evens_up_to(10).collect();
    println!("{e:?}");            // [0, 2, 4, 6, 8]
    print_all(vec![1, 2, 3]);
}
```

**Usefulness.** Returning iterators/closures cleanly, hiding complex internal types, and concise generic arguments — all with no runtime cost, unlike `dyn`.

## The never type `!` — the type with no values

**Theory.** `!` (the **never type**) has **zero** possible values, so an expression of type `!` can never finish producing one. That's exactly what `panic!`, `return`, `break`, `continue`, and infinite loops do. Because you can never *hold* a `!`, it **coerces to any other type**, which is why those expressions fit anywhere.

```rust
fn main() {
    let input = "42";
    // The Err arm has type `!` (panic never returns), so it fits where an i32 is needed:
    let n: i32 = match input.parse() {
        Ok(v) => v,
        Err(_) => panic!("expected a number"),
    };
    println!("parsed {n}");
}
```

**Usefulness.** Mostly implicit — it's why `panic!`/`return` type-check inside expressions. Explicitly, `Result<T, !>` (on nightly) or a function returning `!` documents "this never returns" (an event loop, `std::process::exit`).

## Zero-sized types (ZSTs)

**Theory.** A type with exactly **one** value needs **zero bytes** — knowing the *type* is knowing the *value*. The unit `()`, unit structs, empty structs, `[T; 0]`, and `PhantomData` are ZSTs. They're optimized away entirely: a `Vec` of a million ZSTs allocates nothing for elements, and `HashSet<T>` is literally `HashMap<T, ()>`.

```rust
use std::mem::size_of;

#[derive(Clone, Copy)]
struct Marker;               // a unit struct — zero-sized

fn main() {
    println!("()        = {} bytes", size_of::<()>());        // 0
    println!("Marker    = {} bytes", size_of::<Marker>());    // 0
    println!("[u64; 0]  = {} bytes", size_of::<[u64; 0]>());  // 0
    let many = vec![Marker; 1_000_000];
    println!("a million Markers use {} bytes each", size_of::<Marker>()); // 0
    println!("(vec still tracks its len: {})", many.len());
}
```

**Usefulness.** Type-level markers and state (typestate patterns), `PhantomData` to record a type without storing it, and sets/maps where only the key matters — all at **zero runtime cost**.

---

# The traits that classify every type

A few automatic **marker traits** silently sort every type and decide what you may do with it. They have no methods — their presence *is* the fact.

| Marker | Means | Consequence |
|---|---|---|
| `Sized` | size known at compile time | held by value; the default bound on `<T>` |
| `Copy` | duplicable by copying bits | assignment **copies** instead of [moving](#/ch/ownership) |
| `Send` | safe to **move** to another thread | required to transfer across threads |
| `Sync` | safe to **share** (`&T`) across threads | `T: Sync` ⇔ `&T: Send` |

```rust
fn main() {
    // Copy types: the original stays usable after assignment.
    let a = 5;
    let b = a;                 // bit-copy — `a` still valid
    println!("{a} {b}");

    // Non-Copy types move: ownership transfers.
    let s1 = String::from("hi");
    let s2 = s1;               // move — s1 is no longer usable
    println!("{s2}");          // using s1 here would not compile
}
```

**Usefulness.** These traits are why some values copy and others move, why only some types cross thread boundaries, and why `str`/`[T]`/`dyn` need pointers. Understanding them explains most "why won't this compile?" moments. See [Send & Sync](#/ch/send-sync).

---

## The complete cheat-sheet

| Category | Types | Sized? | Owns data? |
|---|---|---|---|
| Integers / floats | `i8…i128`, `u8…u128`, `isize`, `usize`, `f32`, `f64` | ✅ | value |
| Other scalars | `bool`, `char`, `()` | ✅ | value |
| Textual | `char`, `str` (DST), `String` | `str` ❌ | `String` owns |
| Tuple / array / slice | `(A, B, …)`, `[T; N]`, `[T]` (DST) | `[T]` ❌ | array owns |
| Struct / enum / union | `struct`, `enum`, `union`, `Option`, `Result` | ✅ | value |
| References | `&T`, `&mut T` | ✅ | borrows |
| Raw pointers | `*const T`, `*mut T` | ✅ | none |
| Owning / shared pointers | `Box<T>`, `Rc<T>`, `Arc<T>`, `Cow<T>` | ✅ | heap / shared |
| Interior mutability | `Cell<T>`, `RefCell<T>` | ✅ | value |
| Collections | `Vec`, `VecDeque`, `HashMap`, `BTreeMap`, `HashSet`, `String` | ✅ | heap |
| Functions | `fn(T) -> U`, fn items, closures | ✅ | maybe captures |
| Trait objects | `dyn Trait` (DST), `&dyn`, `Box<dyn>` | `dyn` ❌ | — |
| Never / opaque | `!`, `impl Trait` | — | — |

## Summary

You've now met **every type in Rust**, from `bool` to `dyn Trait`. The catalog is unified by a few deep ideas:

- **Everything has one type, fixed at compile time** — the root of Rust's safety and speed.
- **Six families**: primitive, compound, pointer, user-defined, function, and abstract — everything is a combination of these.
- **`Sized` vs. unsized** decides whether a value is held directly or only behind a (thin or **fat**) pointer.
- **Cardinality** — from `!` (0 values) through ZSTs (1 value) — explains ZSTs, the never type, and why structs and enums are **product** and **sum** types.
- **Static vs. dynamic dispatch** is the choice between generics/`impl Trait` (fast, monomorphized) and `dyn Trait` (flexible, vtable-based).
- **Marker traits** (`Sized`, `Copy`, `Send`, `Sync`) classify every type and gate what you may do with it.

For deeper dives, follow the links: [data types](#/ch/data-types), [strings](#/ch/strings), [structs](#/ch/structs), [enums](#/ch/enums), [vectors](#/ch/vectors), [hash maps](#/ch/hashmaps), [generics](#/ch/generics), [traits](#/ch/traits), [smart pointers](#/ch/box), and [advanced types](#/ch/advanced-types) for newtypes, aliases, and `PhantomData`.

> [!exercise] Try it yourself
> 1. Print `size_of` for `Option<&i32>` and `&i32`. Explain why they're equal (niche optimization).
> 2. Write one generic function `fn describe<T: std::fmt::Debug>(x: T)` and call it with an integer, a tuple, and a `Vec` — one definition, three monomorphized copies.
> 3. Define `enum Traffic { Red, Yellow, Green }` and confirm with `size_of` it fits in **one byte** — three variants need only a tiny tag.
> 4. Take a `&[i32]` slice parameter and call your function with both an array and a `Vec`, proving both coerce to a slice.
