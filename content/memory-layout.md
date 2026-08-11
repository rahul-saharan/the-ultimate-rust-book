<h1><span class="h1-kicker">Performance & Production</span>Memory Layout & Representation</h1>

Every type you write occupies a specific number of bytes, arranged in a specific order, at a specific alignment. Most of the time you can happily ignore this. But when you're shrinking a struct that exists a million times, talking to C, writing a binary format, or wondering why `Option<Box<T>>` is the same size as `Box<T>`, you need to know what the compiler is actually doing.

The good news: Rust's defaults are smarter than C's, and it does several optimizations for free that you'd have to do by hand elsewhere.

## Size, alignment, and padding

Three numbers describe any type:

- **size** — how many bytes it occupies (`size_of::<T>()`)
- **alignment** — the byte boundary its address must be a multiple of (`align_of::<T>()`)
- **padding** — wasted bytes inserted to satisfy alignment

Alignment exists because CPUs read memory in aligned chunks. A `u64` at an address not divisible by 8 would require two reads (or, on some architectures, fault outright), so the compiler guarantees it never happens.

```rust
use std::mem::{align_of, size_of};

fn main() {
    println!("{:<12} {:>4} {:>6}", "type", "size", "align");
    println!("{:<12} {:>4} {:>6}", "()", size_of::<()>(), align_of::<()>());
    println!("{:<12} {:>4} {:>6}", "bool", size_of::<bool>(), align_of::<bool>());
    println!("{:<12} {:>4} {:>6}", "u8", size_of::<u8>(), align_of::<u8>());
    println!("{:<12} {:>4} {:>6}", "char", size_of::<char>(), align_of::<char>());
    println!("{:<12} {:>4} {:>6}", "u32", size_of::<u32>(), align_of::<u32>());
    println!("{:<12} {:>4} {:>6}", "u64", size_of::<u64>(), align_of::<u64>());
    println!("{:<12} {:>4} {:>6}", "&u8", size_of::<&u8>(), align_of::<&u8>());
    println!("{:<12} {:>4} {:>6}", "&[u8]", size_of::<&[u8]>(), align_of::<&[u8]>());
    println!("{:<12} {:>4} {:>6}", "String", size_of::<String>(), align_of::<String>());

    // A struct's alignment is that of its most-demanding field,
    // and its size is rounded up to a multiple of that alignment.
    struct Mixed {
        flag: bool,
        count: u64,
    }
    println!("\nMixed: size {} align {}", size_of::<Mixed>(), align_of::<Mixed>());
    println!("1 byte of data + 8 = 9, rounded up to 16");
}
```

> [!jargon] Zero-sized types
> `()`, an empty struct, `PhantomData<T>`, and `[u8; 0]` all have size **zero**. They occupy no memory, so a `Vec<()>` of a million elements allocates nothing at all, and `HashSet<T>` is `HashMap<T, ()>` with no per-entry cost for the value. Zero-sized types are how Rust expresses "this exists only at compile time" — the basis of the typestate pattern in [Rust Design Patterns](#/ch/idioms-patterns).

## Rust reorders your fields (and C doesn't)

Here's where Rust differs from the C advice you may have absorbed. The default representation, `repr(Rust)`, gives the compiler permission to **reorder fields** to minimize padding.

```rust
use std::mem::size_of;

// Declaration order interleaves small and large fields — in C this would
// waste 14 bytes on padding.
struct Naive {
    a: u8,
    b: u64,
    c: u8,
}

// The "hand-optimized" version, large fields first.
struct HandTuned {
    b: u64,
    a: u8,
    c: u8,
}

// repr(C) FORCES declaration order, disabling the optimization.
#[repr(C)]
struct CLayout {
    a: u8,
    b: u64,
    c: u8,
}

fn main() {
    println!("Naive      {} bytes", size_of::<Naive>());     // 16
    println!("HandTuned  {} bytes", size_of::<HandTuned>()); // 16 — identical!
    println!("CLayout    {} bytes", size_of::<CLayout>());   // 24 — padding restored

    println!("\nRust reordered Naive for you. repr(C) is what costs 8 extra bytes.");
}
```

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="With repr C the fields stay in declaration order and require padding, while the default Rust representation reorders them to eliminate it">
  <style>
    .ml-h { font: 700 12px var(--font-sans); }
    .ml-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .ml-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .ml-d { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .ml-p { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.2; stroke-dasharray: 3 2; }
    .ml-big { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <text x="20" y="20" class="ml-h" fill="var(--red)">#[repr(C)] — declaration order, 24 bytes</text>
  <g class="ml-m">
    <rect x="20" y="32" width="30" height="32" class="ml-d"/><text x="30" y="53">a</text>
    <rect x="50" y="32" width="210" height="32" class="ml-p"/><text x="110" y="53" fill="var(--red)">7 bytes padding</text>
    <rect x="260" y="32" width="240" height="32" class="ml-big"/><text x="355" y="53">b (u64)</text>
    <rect x="500" y="32" width="30" height="32" class="ml-d"/><text x="510" y="53">c</text>
    <rect x="530" y="32" width="90" height="32" class="ml-p"/><text x="540" y="53" fill="var(--red)">7 pad</text>
  </g>
  <text x="20" y="82" class="ml-c">14 of 24 bytes are padding — 58% waste.</text>
  <text x="20" y="122" class="ml-h" fill="var(--green)">default repr(Rust) — reordered, 16 bytes</text>
  <g class="ml-m">
    <rect x="20" y="134" width="240" height="32" class="ml-big"/><text x="115" y="155">b (u64)</text>
    <rect x="260" y="134" width="30" height="32" class="ml-d"/><text x="270" y="155">a</text>
    <rect x="290" y="134" width="30" height="32" class="ml-d"/><text x="300" y="155">c</text>
    <rect x="320" y="134" width="180" height="32" class="ml-p"/><text x="360" y="155" fill="var(--red)">6 bytes padding</text>
  </g>
  <text x="20" y="184" class="ml-c">The compiler grouped the u64 first, then packed both u8s together. You wrote nothing.</text>
  <text x="20" y="212" class="ml-c">Consequence: field ORDER in a normal Rust struct does not affect size. Only <tspan font-family="var(--font-mono)">repr(C)</tspan> makes it matter.</text>
  <text x="20" y="230" class="ml-c">Consequence: you must never assume the in-memory order matches your source — unless you asked for <tspan font-family="var(--font-mono)">repr(C)</tspan>.</text>
</svg>
<figcaption>Rust's default representation <b>reorders fields</b> to minimize padding. The classic C advice to hand-sort fields by size is unnecessary — and <code>repr(C)</code> is what reintroduces the cost.</figcaption>
</figure>

> [!key] Don't hand-sort fields in normal Rust structs
> The advice "declare large fields first" is correct for C and pointless for `repr(Rust)` — the compiler already does better than you would, and it's free to change strategy between releases. Order your fields for *readability*. The one exception is `#[repr(C)]`, where you've explicitly asked for declaration order and padding becomes your problem again.

> [!warning] `repr(Rust)` layout is not stable — don't depend on it
> The compiler makes no promise about field order, and it may differ between compiler versions, targets, or even generic instantiations. So you may not `transmute` between two structs with the same fields, write a struct's raw bytes to a file and read them back with a different compiler, or pass one to C. For any of those, `#[repr(C)]` is mandatory — that's the whole point of it.

## The `repr` attributes

| Attribute | Guarantees | Use for |
|---|---|---|
| (default) `repr(Rust)` | nothing about order; minimal size | ordinary Rust code |
| `#[repr(C)]` | declaration order, C-compatible padding | FFI, binary formats, `transmute` |
| `#[repr(transparent)]` | identical layout/ABI to the single field | newtypes crossing FFI |
| `#[repr(packed)]` | no padding at all, alignment 1 | wire formats; **dangerous** |
| `#[repr(packed(N))]` | alignment capped at `N` | a compromise |
| `#[repr(align(N))]` | alignment raised to at least `N` | cache-line alignment |
| `#[repr(u8)]` / `u16` / … | the enum's discriminant type | FFI enums, compact storage |
| `#[repr(C, u8)]` | C-compatible tagged union | FFI with data-carrying enums |

```rust
use std::mem::{align_of, size_of};

// transparent: a newtype that is ABI-identical to its contents.
// Required if you want to pass Handle where C expects a u64.
#[repr(transparent)]
struct Handle(u64);

// packed: zero padding. Smallest possible, but fields become MISALIGNED.
#[repr(packed)]
struct WireHeader {
    kind: u8,
    length: u64,
    flags: u8,
}

// align: force a larger alignment — here, a whole cache line, so that
// two of these can never share one and cause false sharing between cores.
#[repr(align(64))]
struct CachePadded {
    counter: u64,
}

fn main() {
    println!("Handle      size {} align {}", size_of::<Handle>(), align_of::<Handle>());
    println!("WireHeader  size {} align {}", size_of::<WireHeader>(), align_of::<WireHeader>());
    println!("CachePadded size {} align {}", size_of::<CachePadded>(), align_of::<CachePadded>());

    // Reading a packed field must go through a copy, because the compiler
    // cannot hand out a reference to a misaligned u64.
    let h = WireHeader { kind: 1, length: 4096, flags: 0 };
    let len = h.length; // ✅ copies the value out
    println!("length = {len}");
    // println!("{}", &h.length); // ❌ error: reference to packed field
}
```

> [!warning] `#[repr(packed)]` creates references you're not allowed to take
> Because fields may be misaligned, you cannot borrow one — `&packed.field` is a compile error (it was undefined behaviour before the compiler started rejecting it). You must copy the value out first. That also means `#[derive(Debug)]` and any method taking `&self.field` become awkward, and on architectures that fault on misaligned access the reads are slower. Use `packed` only for genuine wire formats, and prefer explicit `to_be_bytes` serialization instead — see [Cross-Compilation](#/ch/cross-compilation).

> [!performance] `#[repr(align(64))]` prevents false sharing
> When two threads write to different variables that happen to live in the *same cache line*, every write invalidates the other core's copy — the line ping-pongs between cores and performance collapses, even though the threads never touch the same data. This is **false sharing**. Padding each counter to its own cache line with `#[repr(align(64))]` fixes it, at the cost of memory. It's why `crossbeam` provides a `CachePadded` type. See [Atomics](#/ch/atomics).

## Enums and the niche optimization

An enum needs to store which variant it holds (the **discriminant**) plus that variant's data. The clever part is when it can store the discriminant for free.

```rust
use std::mem::size_of;

// No data: only the discriminant is needed, and 3 variants fit in one byte.
enum Direction {
    North,
    South,
    East,
}

// Largest variant is u64 (8 bytes), plus a discriminant, plus padding.
enum Message {
    Ping,
    Id(u64),
    Flag(bool),
}

fn main() {
    println!("Direction              {} byte(s)", size_of::<Direction>());  // 1
    println!("Message                {} bytes", size_of::<Message>());     // 16

    // A u64 has no invalid bit patterns, so None needs its own tag → 16 bytes.
    println!("u64                    {}", size_of::<u64>());               // 8
    println!("Option<u64>            {}", size_of::<Option<u64>>());       // 16

    // A reference can never be null — so the compiler uses null as "None".
    // This is the NICHE OPTIMIZATION, and it costs nothing.
    println!("&u64                   {}", size_of::<&u64>());              // 8
    println!("Option<&u64>           {}", size_of::<Option<&u64>>());      // 8  ← free!
    println!("Box<u64>               {}", size_of::<Box<u64>>());          // 8
    println!("Option<Box<u64>>       {}", size_of::<Option<Box<u64>>>());  // 8  ← free!

    // bool only uses 0 and 1, leaving 254 spare values as niches.
    println!("Option<bool>           {}", size_of::<Option<bool>>());      // 1
    println!("Option<Option<bool>>   {}", size_of::<Option<Option<bool>>>()); // 1 — still!

    // Same reasoning for the most common return type in Rust:
    println!("Result<(), Box<dyn std::error::Error>> {}",
             size_of::<Result<(), Box<dyn std::error::Error>>>());          // 16
}
```

| Type | Size | Why |
|---|---|---|
| `Option<&T>` | 8 | null is the niche — **free** |
| `Option<Box<T>>` | 8 | same |
| `Option<NonZeroU32>` | 4 | zero is the niche — free |
| `Option<bool>` | 1 | 254 unused byte values |
| `Option<char>` | 4 | not all `u32`s are valid scalar values |
| `Option<u64>` | 16 | every bit pattern is a valid `u64` — needs a real tag |
| `Option<Vec<T>>` | 24 | the pointer is non-null, so it's free |
| `Option<f64>` | 16 | all bit patterns valid (NaN included) |

> [!key] The niche optimization is why `Option` is free for pointers
> Rust looks for an **invalid bit pattern** ("niche") in the inner type and uses it as the `None` tag. A reference or `Box` can never be null, so null becomes `None` — meaning `Option<Box<T>>` is exactly as cheap as a nullable pointer in C, with none of the risk. This is one of the most elegant things in the language: the safety costs *nothing*.

> [!tip] `NonZeroU32` and friends make your own types niche-friendly
> If an integer field is never zero — an ID, a length, a port — use `NonZeroU32` instead of `u32`. Then `Option<MyId>` is the same size as `MyId`, and the type documents the invariant. In a struct with several optional IDs, this can meaningfully shrink it. `std::num` has `NonZeroU8` through `NonZeroU128` and the signed versions.

## Shrinking a struct that exists a million times

For a type you allocate in bulk, size is throughput: smaller means more per cache line means fewer memory stalls.

```rust
use std::mem::size_of;
use std::num::NonZeroU32;

// ❌ 1: the obvious version.
struct EventFat {
    id: u64,               // 8
    kind: String,          // 24 — a heap allocation per event!
    user: Option<u64>,     // 16
    retries: u64,          // 8  — never exceeds 10
    important: bool,       // 1
}

// ✅ 2: right-sized primitives, an enum instead of a String,
// and NonZeroU32 so the Option is free.
#[derive(Clone, Copy)]
enum Kind {
    Click,
    View,
    Purchase,
}

struct EventLean {
    id: u64,                    // 8
    user: Option<NonZeroU32>,   // 4 — niche optimization
    retries: u8,                // 1
    kind: Kind,                 // 1
    important: bool,            // 1
}

fn main() {
    println!("EventFat   {} bytes", size_of::<EventFat>());
    println!("EventLean  {} bytes", size_of::<EventLean>());

    let fat = size_of::<EventFat>();
    let lean = size_of::<EventLean>();
    println!("\nFor 10 million events:");
    println!("  fat:  {:.1} MB (plus one heap String each)", (fat * 10_000_000) as f64 / 1e6);
    println!("  lean: {:.1} MB (no heap at all)", (lean * 10_000_000) as f64 / 1e6);
    println!("\nPer 64-byte cache line: {} fat vs {} lean", 64 / fat, 64 / lean);
}
```

| Technique | Saves |
|---|---|
| an `enum` instead of a `String` for a known set | 24 bytes + a heap allocation each |
| `u8`/`u32` instead of `u64` where the range allows | 1–7 bytes per field |
| `NonZeroU32` so `Option` uses a niche | 4–8 bytes per optional field |
| `Box<T>` for a rarely-used large variant | shrinks the whole enum to the common case |
| `Box<str>` instead of `String` | 8 bytes (no capacity field) |
| `Rc<str>` for many copies of the same text | one allocation instead of n |
| interning strings to a `u32` index | 24 bytes → 4, plus locality |
| struct-of-arrays instead of array-of-structs | perfect locality per field scanned |

> [!performance] Box the rare large variant
> An enum is as big as its largest variant. If `Error::Io(io::Error)` is 8 bytes but `Error::Validation(ValidationReport)` is 200, every `Result<T, Error>` in your program is 200+ bytes — including the millions that succeed. `Error::Validation(Box<ValidationReport>)` shrinks the enum to 16 and moves the cost onto the rare failure path. Clippy's `large_enum_variant` lint finds these for you, and it's one of the highest-value lints there is.

## Struct-of-arrays: when layout beats everything

If you scan one field across many records, storing each field in its own array means every cache line you load is 100% data you need.

```rust
// Array of structs: a scan of `price` loads name and stock too, wasting cache.
struct ItemAos {
    name: String,
    price: f64,
    stock: u32,
}

// Struct of arrays: scanning prices touches only prices.
struct Inventory {
    names: Vec<String>,
    prices: Vec<f64>,
    stocks: Vec<u32>,
}

impl Inventory {
    fn total_value(&self) -> f64 {
        // This loop reads ONLY the prices and stocks arrays — contiguous,
        // predictable, and vectorizable.
        self.prices.iter().zip(&self.stocks).map(|(p, s)| p * *s as f64).sum()
    }
}

fn main() {
    let inv = Inventory {
        names: vec!["bolt".into(), "nut".into(), "nail".into()],
        prices: vec![0.25, 0.10, 0.05],
        stocks: vec![1000, 5000, 20_000],
    };
    println!("total value = {:.2}", inv.total_value());

    let aos = vec![ItemAos { name: "bolt".into(), price: 0.25, stock: 1000 }];
    println!("{} item in the AoS version", aos.len());
}
```

> [!best] Reach for struct-of-arrays only when you've measured a locality problem
> It's a real technique — game engines, columnar databases, and numerical code live on it — but it makes the code notably less pleasant: no single `Item` value to pass around, and you must keep the arrays in lockstep. Use it when profiling shows memory stalls dominating a hot scan over many records. For everything else, an ordinary `Vec<Item>` is clearer and fast enough. The `soa_derive` crate can generate the boilerplate if you do need it.

## Where values actually live

```rust
fn main() {
    // Stack: known size, automatically freed, extremely fast.
    let on_stack: [u8; 16] = [0; 16];

    // Heap: size decided at runtime, one allocation, freed on drop.
    let on_heap: Vec<u8> = vec![0; 16];

    // Static: baked into the binary, lives for the whole program.
    static GREETING: &str = "hello";
    const LIMIT: usize = 100;

    println!("{} {} {} {}", on_stack.len(), on_heap.len(), GREETING, LIMIT);

    // The handle is on the stack; the DATA is on the heap.
    println!("Vec handle is {} bytes on the stack", std::mem::size_of_val(&on_heap));
    println!("…pointing at {} bytes on the heap", on_heap.len());
}
```

| Location | Cost to allocate | Lifetime | Size |
|---|---|---|---|
| stack | ~free (a register add) | until scope ends | must be known at compile time |
| heap | a real allocator call | until dropped | runtime |
| static / `const` | none — it's in the binary | whole program | compile time |
| thread-local | one-time init per thread | thread lifetime | compile time |

> [!deep] Why `Box<T>` exists at all
> A value must have a known size to live on the stack. That's a problem for recursive types (`enum List { Cons(i32, List) }` would be infinitely large) and for trait objects (a `dyn Trait` could be any size). `Box<T>` solves both: it's always one pointer, and it moves the unknown-sized thing to the heap. That's the whole reason it's the first smart pointer you learn. See [Box](#/ch/box).

## Summary

- Every type has a **size**, an **alignment**, and possibly **padding**. Size is always a multiple of alignment.
- Rust's default **`repr(Rust)` reorders fields** to minimize padding — so hand-sorting fields by size is C advice that doesn't apply. Order for readability.
- Because layout isn't guaranteed, you must use **`#[repr(C)]`** for FFI, binary formats, and `transmute`.
- `#[repr(transparent)]` for newtypes crossing FFI, `#[repr(align(64))]` to prevent **false sharing**, and `#[repr(packed)]` only for real wire formats (you can't even borrow its fields).
- The **niche optimization** makes `Option<&T>`, `Option<Box<T>>`, and `Option<NonZeroU32>` completely free — use `NonZero*` types to get it on your own fields.
- Shrink bulk types with **enums instead of `String`s**, right-sized integers, `NonZero*`, and by **boxing the rare large enum variant** (watch for Clippy's `large_enum_variant`).
- **Struct-of-arrays** wins on field scans over many records — but only reach for it after measuring.
- **Zero-sized types** cost nothing and are the basis of compile-time-only markers.

> [!exercise] Try it yourself
> 1. Write a struct with a `u8`, a `u64`, and a `u16` in that order. Print its size, then add `#[repr(C)]` and print it again. Explain the difference.
> 2. Print `size_of` for `Option<u32>`, `Option<NonZeroU32>`, `Option<&u32>`, and `Option<String>`. Which are free and why?
> 3. Build an enum where one variant holds a `[u8; 512]` and the others are tiny. Print `size_of`, then box the big variant and print again.
> 4. Take the `EventFat` struct and shrink it as far as you can. How many fit in a 64-byte cache line before and after?
> 5. Run `cargo clippy` on a project and look for `large_enum_variant` or `result_large_err`. Did it find anything?
> 6. Create a `#[repr(packed)]` struct and try to write `println!("{}", &s.field)`. Read the error, then fix it by copying the value out.

Next: getting all of this onto a real machine — **deployment, Docker, and binary size**.
