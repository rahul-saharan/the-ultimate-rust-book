<h1><span class="h1-kicker">Advanced Rust</span>FFI: Calling C & Being Called</h1>

Rust doesn't live on an island. Decades of essential libraries — for graphics, cryptography, audio, operating systems — are written in C. And sometimes you want to write a fast, safe component in Rust and call it *from* Python, Node, or C. The bridge is **FFI** (Foreign Function Interface): the ability to call across the language boundary. This closing chapter of advanced Rust shows both directions.

## Calling C from Rust

To call an external C function, declare it in an `extern "C"` block. This tells Rust the function's signature and that it uses the C **ABI** (the low-level calling convention). Because the compiler can't verify anything about foreign code, every call is `unsafe`:

```rust
// Declare a function from the C standard library:
extern "C" {
    fn abs(input: i32) -> i32;
}

fn main() {
    // Calling foreign code is unsafe — Rust can't check C's guarantees:
    unsafe {
        println!("C's abs(-42) = {}", abs(-42)); // 42
    }
}
```

> [!jargon] ABI & `extern`
> An **ABI** (*Application Binary Interface*) is the machine-level contract for how functions receive arguments and return values — where they go in registers/stack, how they're named. `extern "C"` says "use the **C ABI**," the lingua franca that virtually every language can speak. `extern "C" { … }` *imports* foreign functions; `extern "C" fn` (below) *exports* a Rust function with the C ABI.

## Linking to a C library

The `abs` example works because the C standard library is always linked. To use *another* C library, you tell Cargo to link it with a `#[link]` attribute or a build script:

```rust,ignore
#[link(name = "m")] // link libm, the C math library
extern "C" {
    fn sqrt(x: f64) -> f64;
    fn pow(base: f64, exp: f64) -> f64;
}

fn main() {
    unsafe {
        println!("sqrt(2.0) = {}", sqrt(2.0));
        println!("2^10 = {}", pow(2.0, 10.0));
    }
}
```

> [!tip] Don't hand-write bindings — generate them with `bindgen`
> For any real C library, manually transcribing dozens of function signatures and structs is tedious and error-prone. The **`bindgen`** tool reads a C header file and *auto-generates* the Rust `extern` declarations for you. Most `*-sys` crates on crates.io (like `openssl-sys`, `libgit2-sys`) are exactly this: bindgen-produced bindings to a C library, which safe wrapper crates then build upon.

## Exposing Rust to C (and other languages)

The other direction: make a Rust function callable from C. Two annotations do it — **`#[unsafe(no_mangle)]`** to keep the symbol name intact (so the linker can find `add`, not a mangled name), and `extern "C"` to use the C ABI:

```rust,ignore
// This Rust function becomes callable from C as a plain `add`:
#[unsafe(no_mangle)]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

Compile it as a C-compatible library by setting the crate type in `Cargo.toml`, and C code can call it as if it were native:

```toml
[lib]
crate-type = ["cdylib"] # a C-compatible dynamic library (.so/.dll/.dylib)
```

```c
// From C:
extern int add(int a, int b);
int main() { return add(2, 3); } // calls into Rust!
```

> [!jargon] Name mangling & `no_mangle`
> Compilers usually **mangle** function names — encoding types/modules into a unique symbol like `_ZN3app3addE` — to support overloading and generics. C expects plain names (`add`). **`#[unsafe(no_mangle)]`** turns mangling off for that function so C's linker can find it by its literal name. (It's `unsafe` because two `no_mangle` functions with the same name would collide.)

## Working with C data safely

The values crossing the boundary must have layouts both sides agree on:

- Use **`#[repr(C)]`** on structs so Rust lays out fields in the C-compatible order (Rust's default layout is unspecified and may reorder fields).
- Use the C-compatible types from **`std::os::raw`** / the **`libc`** crate (`c_int`, `c_char`, …).
- Strings need care: Rust strings are UTF-8 and *not* null-terminated; C strings are null-terminated bytes. Convert with **`CString`** (Rust → C) and **`CStr`** (C → Rust).

```rust
#[repr(C)] // guarantee C-compatible field layout
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p = Point { x: 3, y: 4 };
    // A #[repr(C)] struct can be passed to/from C by pointer safely.
    println!("({}, {})", p.x, p.y);
}
```

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="Rust and C interoperate in both directions across the C ABI boundary">
  <style>
    .fim { font: 600 12px var(--font-mono); fill: var(--text); }
    .fic { font: 11px var(--font-sans); fill: var(--text-mute); }
    .rust2 { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .c2 { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="30" y="40" width="200" height="60" rx="10" class="rust2"/><text x="90" y="66" class="fim" fill="var(--rust-600)">🦀 Rust</text><text x="44" y="88" class="fic">unsafe + extern "C"</text>
  <rect x="410" y="40" width="200" height="60" rx="10" class="c2"/><text x="490" y="66" class="fim" fill="var(--blue)">C library</text><text x="424" y="88" class="fic">headers, .so / .a</text>
  <path d="M232 60 L408 60" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#afi)"/>
  <text x="250" y="52" class="fic">extern "C" { … }  → call C</text>
  <path d="M408 84 L234 84" stroke="var(--text-mute)" stroke-width="2" marker-end="url(#afi2)"/>
  <text x="240" y="104" class="fic">#[no_mangle] pub extern "C"  ← C calls Rust</text>
  <text x="30" y="135" class="fic">The C ABI is the shared contract; #[repr(C)] and CString/CStr make the data compatible.</text>
  <defs>
    <marker id="afi" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
    <marker id="afi2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-mute)"/></marker>
  </defs>
</svg>
<figcaption>FFI bridges Rust and C in both directions over the shared <b>C ABI</b>.</figcaption>
</figure>

> [!warning] FFI is a safety boundary — you're responsible past it
> The moment you cross into C, Rust's guarantees stop. The C side can dangle pointers, corrupt memory, or ignore your invariants, and the compiler can't help. Treat every FFI call as `unsafe` for real reasons: validate pointers, respect ownership of allocations (who frees what?), never let a Rust panic unwind across the boundary into C (mark handlers `catch_unwind` or use `extern "C-unwind"` deliberately). The idiomatic approach is to **wrap the raw FFI in a safe Rust API** — exactly the pattern from the [unsafe chapter](#/ch/unsafe).

> [!best] Use the ecosystem's FFI tooling
> You rarely write FFI from scratch. **`bindgen`** generates Rust bindings from C headers; **`cbindgen`** generates C headers from your Rust; **`cxx`** provides a safe, ergonomic C++ bridge; and **PyO3** / **napi-rs** / **wasm-bindgen** connect Rust to Python, Node.js, and JavaScript respectively. Reach for these — they handle the fiddly, dangerous details correctly so you can focus on the safe wrapper.

## Summary

- **FFI** lets Rust call C (and be called by C and other languages) across the shared **C ABI**.
- **Call C** by declaring functions in an `extern "C" { … }` block and invoking them inside `unsafe`; link libraries with `#[link(name = "...")]` — but generate real bindings with **`bindgen`**.
- **Expose Rust** with `#[unsafe(no_mangle)] pub extern "C" fn …` and a `cdylib` crate type, so C can call it by its plain name.
- Make data compatible with **`#[repr(C)]`** structs, `std::os::raw`/`libc` types, and **`CString`/`CStr`** for strings.
- FFI is a **safety boundary** — wrap raw calls in a safe API, mind ownership of allocations, and don't unwind panics into C. Lean on **`bindgen`/`cbindgen`/`cxx`/PyO3/wasm-bindgen**.

> [!exercise] Try it yourself
> 1. Declare and call C's `abs` and `sqrt` (link `m`) from Rust in `unsafe` blocks.
> 2. Define a `#[repr(C)] struct Color { r: u8, g: u8, b: u8 }` and explain why `#[repr(C)]` matters for FFI.
> 3. Sketch a `#[unsafe(no_mangle)] pub extern "C" fn multiply(a: i32, b: i32) -> i32` and describe how you'd call it from C.

That completes **Advanced Rust** — `unsafe`, macros, advanced types and functions, and FFI. You've now seen the entire language. Next, we turn from the language itself to mastering its **standard library**.
