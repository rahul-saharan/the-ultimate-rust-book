<h1><span class="h1-kicker">Advanced Rust</span>Const Generics & Compile-Time Evaluation</h1>

You already know generics over *types*: `Vec<T>` works for any `T`. **Const generics** let you be generic over *values* — usually numbers — so one piece of code can work for any array length, any matrix dimension, any buffer size, with the size checked at compile time and no runtime cost whatsoever.

Alongside them sits a related idea: `const fn` and const evaluation, which run your code at compile time so the result is baked into the binary.

## Generic over a value

The syntax is `<const N: usize>`, and `N` behaves like a compile-time constant inside the item.

```rust
// One function, every array length. N is inferred at each call site.
fn sum<const N: usize>(values: [i32; N]) -> i32 {
    // N is usable as an ordinary value here.
    println!("  summing {N} elements");
    values.iter().sum()
}

// A type parameterized by a value.
#[derive(Debug)]
struct RingBuffer<const CAP: usize> {
    slots: [u8; CAP],
    len: usize,
}

impl<const CAP: usize> RingBuffer<CAP> {
    fn new() -> Self {
        RingBuffer { slots: [0; CAP], len: 0 }
    }

    fn capacity(&self) -> usize {
        CAP
    }

    fn push(&mut self, byte: u8) -> bool {
        if self.len < CAP {
            self.slots[self.len] = byte;
            self.len += 1;
            true
        } else {
            false
        }
    }
}

fn main() {
    println!("{}", sum([1, 2, 3]));
    println!("{}", sum([1, 2, 3, 4, 5, 6]));

    let mut small: RingBuffer<3> = RingBuffer::new();
    for b in [10, 20, 30, 40] {
        let ok = small.push(b);
        println!("push {b}: {}", if ok { "accepted" } else { "FULL" });
    }
    println!("capacity {}, len {}", small.capacity(), small.len);
}
```

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="One generic source function is monomorphized into a separate specialized machine-code function for each const value used">
  <style>
    .cg-h { font: 700 12px var(--font-sans); }
    .cg-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .cg-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cg-src { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
    .cg-out { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="cg-h" fill="var(--text-mute)">you write once…</text>
  <rect x="20" y="76" width="200" height="70" rx="5" class="cg-src"/>
  <text x="32" y="100" class="cg-m">fn sum&lt;const N: usize&gt;(</text>
  <text x="32" y="118" class="cg-m">    v: [i32; N]</text>
  <text x="32" y="136" class="cg-m">) -&gt; i32</text>
  <text x="360" y="18" class="cg-h" fill="var(--rust-600)">…the compiler emits one per N used</text>
  <rect x="360" y="30" width="250" height="44" rx="5" class="cg-out"/>
  <text x="372" y="49" class="cg-m">sum::&lt;3&gt;</text>
  <text x="372" y="66" class="cg-c">loop fully unrolled, 0 bounds checks</text>
  <rect x="360" y="82" width="250" height="44" rx="5" class="cg-out"/>
  <text x="372" y="101" class="cg-m">sum::&lt;6&gt;</text>
  <text x="372" y="118" class="cg-c">vectorized for exactly 6 elements</text>
  <rect x="360" y="134" width="250" height="44" rx="5" class="cg-out"/>
  <text x="372" y="153" class="cg-m">sum::&lt;1024&gt;</text>
  <text x="372" y="170" class="cg-c">separate copy again</text>
  <path d="M222 100 L356 52" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#arr-cg)"/>
  <path d="M222 111 L356 104" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#arr-cg)"/>
  <path d="M222 122 L356 156" stroke="var(--rust-500)" stroke-width="1.8" marker-end="url(#arr-cg)"/>
  <text x="20" y="206" class="cg-c">This is why const generics are fast: each copy has a <tspan font-weight="700">literal</tspan> loop count, so nothing is checked or computed at runtime.</text>
  <text x="20" y="224" class="cg-c">It is also why they can bloat a binary — three sizes means three complete copies of every method.</text>
  <defs><marker id="arr-cg" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker></defs>
</svg>
<figcaption><b>Monomorphization</b> over values: each distinct <code>N</code> becomes its own specialized function. The speed and the bloat are the same mechanism.</figcaption>
</figure>

> [!key] `N` is known at compile time, so the compiler can specialize
> Each distinct `N` produces its own monomorphized copy — `sum::<3>` and `sum::<6>` are separate functions. That means the compiler knows the exact loop count, can fully unroll it, can vectorize it, and can eliminate every bounds check. A `[f64; 4]` dot product with const generics compiles to the same instructions as hand-written code for exactly four elements, while the source stays generic.

## Why arrays needed this

Before const generics, the standard library had to *manually* implement traits for each array size, and stopped at 32. That's why old Rust code has strange limits.

```rust
// This works for ANY length now. Before Rust 1.51 it worked up to 32 only,
// and beyond that you got "the trait bound is not satisfied".
fn describe<const N: usize>(arr: [u8; N]) -> String {
    format!("{N} bytes, first = {:?}, sum = {}", arr.first(), arr.iter().map(|&b| b as u32).sum::<u32>())
}

fn main() {
    println!("{}", describe([1, 2, 3]));
    println!("{}", describe([7; 100]));   // 100 elements — fine
    println!("{}", describe([0; 1024]));  // 1024 — also fine

    // Debug, PartialEq, Default etc. now work for any array length too.
    let big = [0u8; 64];
    let other = [0u8; 64];
    println!("equal? {}", big == other);
    println!("{:?}", [0u8; 40].len());
}
```

| Const generics enable | Example |
|---|---|
| traits implemented for all array lengths | `[T; N]: Debug`, `PartialEq`, `Default` |
| dimensioned types | `Matrix<3, 4>`, `Vector<3>` |
| fixed-capacity collections without heap | `ArrayVec<T, N>`, `heapless::Vec<T, N>` |
| compile-time-checked buffer sizes | `Hash<32>` for a 32-byte digest |
| unit-safe numeric types | `Fixed<SCALE>` for fixed-point maths |
| stack-only data structures for embedded | no allocator required |

## Dimension safety: the compelling use case

This is where const generics earn their place — encoding dimensions in the type so mismatched maths cannot compile.

```rust
#[derive(Debug, Clone, Copy)]
struct Matrix<const R: usize, const C: usize> {
    data: [[f64; C]; R],
}

impl<const R: usize, const C: usize> Matrix<R, C> {
    fn zeros() -> Self {
        Matrix { data: [[0.0; C]; R] }
    }

    fn from(data: [[f64; C]; R]) -> Self {
        Matrix { data }
    }

    fn dims(&self) -> (usize, usize) {
        (R, C)
    }

    // Transposing swaps the dimensions IN THE TYPE.
    fn transpose(&self) -> Matrix<C, R> {
        let mut out = Matrix::<C, R>::zeros();
        for i in 0..R {
            for j in 0..C {
                out.data[j][i] = self.data[i][j];
            }
        }
        out
    }

    // Multiplication is only defined when self's columns match other's rows —
    // and the compiler enforces exactly that.
    fn multiply<const K: usize>(&self, other: &Matrix<C, K>) -> Matrix<R, K> {
        let mut out = Matrix::<R, K>::zeros();
        for i in 0..R {
            for j in 0..K {
                let mut acc = 0.0;
                for k in 0..C {
                    acc += self.data[i][k] * other.data[k][j];
                }
                out.data[i][j] = acc;
            }
        }
        out
    }
}

fn main() {
    let a = Matrix::<2, 3>::from([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]);
    let b = Matrix::<3, 2>::from([[7.0, 8.0], [9.0, 10.0], [11.0, 12.0]]);

    // (2x3) * (3x2) = (2x2) — the result type is computed by the compiler.
    let product = a.multiply(&b);
    println!("dims {:?}", product.dims());
    println!("{:?}", product.data);

    println!("a transposed dims {:?}", a.transpose().dims()); // (3, 2)

    // a.multiply(&a);
    // ❌ error: expected Matrix<3, K>, found Matrix<2, 3>
    // A dimension mismatch is now a COMPILE error, not a runtime panic.
}
```

> [!best] Encode dimensions in types when the shapes are known statically
> A runtime `assert_eq!(self.cols, other.rows)` catches the bug on the unlucky code path, in production, having already done work. The const-generic version catches it while you type. This is the same "make illegal states unrepresentable" principle from [API Design](#/ch/api-design), applied to numbers. Use it when dimensions are compile-time constants — for genuinely dynamic shapes (a matrix read from a file) you need runtime checks and a crate like `ndarray`.

## What you can and can't do (yet)

Const generics are deliberately conservative. Knowing the boundary saves frustration.

| Allowed | Example |
|---|---|
| integer, `bool`, and `char` parameters | `<const N: usize>`, `<const FLAG: bool>` |
| using the parameter as a value | `if N > 4 { … }` |
| using it as an array length | `[T; N]` |
| passing it to another generic | `Matrix<C, R>` |
| a literal or another const as the argument | `Buf<1024>`, `Buf<SIZE>` |
| `{ ... }` braces for an expression argument | `Buf<{ 4 * 256 }>` |

| Not allowed on stable | Why / workaround |
|---|---|
| arithmetic on parameters in a type | `[T; N + 1]` needs `generic_const_exprs` (nightly) |
| floating-point parameters | no stable `const` float equality |
| `String` or `&str` parameters | not a permitted const-generic type |
| bounds like `where N > 0` | use a const assertion (below) |
| specializing behaviour per value | no `impl Foo<0>` specialization on stable |

```rust
// The workaround for `where N > 0`: a compile-time assertion.
struct NonEmpty<const N: usize> {
    items: [u8; N],
}

impl<const N: usize> NonEmpty<N> {
    // This const is evaluated at compile time whenever new() is instantiated.
    // A panic during const evaluation is a COMPILE error.
    const CHECK: () = assert!(N > 0, "NonEmpty requires N > 0");

    fn new(items: [u8; N]) -> Self {
        let _ = Self::CHECK; // force the evaluation
        NonEmpty { items }
    }

    fn first(&self) -> u8 {
        self.items[0] // safe: CHECK guaranteed N > 0
    }
}

fn main() {
    let ok = NonEmpty::new([1, 2, 3]);
    println!("first = {}", ok.first());

    // let bad = NonEmpty::new([]);
    // ❌ error: evaluation of `NonEmpty::<0>::CHECK` failed
    //    the evaluated program panicked at 'NonEmpty requires N > 0'
    println!("a zero-length one would fail to COMPILE, not panic at runtime");
}
```

> [!tip] Const assertions turn invariants into compile errors
> `const CHECK: () = assert!(condition);` is evaluated during compilation, so a violation is a build failure with your message in it. It's the stable workaround for missing const-generic bounds, and it's genuinely useful beyond that — asserting `size_of::<T>() == 8`, or that a lookup table has the length you expect. The `static_assertions` crate wraps the pattern with nicer names.

## `const fn`: running code at compile time

A `const fn` can be called in a constant context, so its result is computed during compilation and embedded in the binary.

```rust
// Evaluated at compile time when used in a const context, at runtime otherwise.
const fn kib(n: usize) -> usize {
    n * 1024
}

const fn fib(n: u32) -> u64 {
    // Loops, if/else, and match are all allowed in const fn.
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    let mut i = 0;
    while i < n {
        let next = a + b;
        a = b;
        b = next;
        i += 1;
    }
    a
}

// These are computed by the compiler. There is zero runtime work.
const BUFFER: usize = kib(64);
const FIB_40: u64 = fib(40);
static LOOKUP: [u64; 10] = build_table();

const fn build_table() -> [u64; 10] {
    let mut table = [0u64; 10];
    let mut i = 0;
    while i < 10 {
        table[i] = fib(i as u32);
        i += 1;
    }
    table
}

fn main() {
    println!("BUFFER = {BUFFER}");
    println!("fib(40) = {FIB_40}  ← computed during compilation");
    println!("LOOKUP  = {LOOKUP:?}");

    // An inline const block forces evaluation at compile time, in place.
    let size = const { kib(4) };
    println!("inline const = {size}");

    // The same function also works at runtime, with a runtime argument.
    let n = std::env::args().count() as u32;
    println!("fib(runtime {n}) = {}", fib(n));
}
```

| Allowed in `const fn` | Not allowed |
|---|---|
| arithmetic, comparisons, `if`/`match` | heap allocation (`Vec`, `String`, `Box`) |
| `while` and `loop` | trait methods (except some `const trait` on nightly) |
| arrays, tuples, structs, references | floating-point in most contexts |
| calling other `const fn`s | `for` loops (they need `Iterator`) |
| `assert!` and `panic!` (fail the build) | anything I/O, random, or time-based |
| `&mut` to locals | dereferencing a raw pointer to non-const memory |

> [!performance] Move work to compile time when the inputs are constant
> A lookup table, a parsed configuration constant, a precomputed CRC table, a bitmask — computing these in a `const fn` costs nothing at runtime and nothing in startup time, because the answer is a literal in the binary. The trade-off is compile time (const evaluation is interpreted and slow, and there's a step limit for runaway loops). For a ten-element table it's free; for a million-element one, generate it with a [build script](#/ch/build-scripts) instead.

> [!note] `const` versus `static`
> A **`const`** is inlined at each use — it has no address, and each mention is a fresh copy of the value. A **`static`** has a single fixed memory location for the whole program. Use `const` for values (`const MAX: u32 = 100;`), and `static` when you need a stable address or a large table you don't want duplicated. Both are computed at compile time; only `static` occupies a defined place in the binary.

## Where you'll meet const generics in the wild

| Crate | Uses them for |
|---|---|
| `heapless` | `Vec<T, N>`, `String<N>`, queues — no allocator, for embedded |
| `arrayvec` | stack-allocated `ArrayVec<T, CAP>` |
| `nalgebra` | statically-sized vectors and matrices with dimension checking |
| `generic-array` | the older pre-const-generics approach (still widespread) |
| `sha2` / `digest` | fixed-size output types like `[u8; 32]` |
| `bitvec` | fixed-width bit arrays |
| `smallvec` | inline capacity before spilling to the heap |

```rust
// A pattern worth knowing: a stack-allocated, fixed-capacity Vec.
// This is `arrayvec`/`heapless` in miniature — no heap allocation at all.
struct StackVec<T, const N: usize> {
    // Option<T> avoids needing T: Default or unsafe MaybeUninit.
    items: [Option<T>; N],
    len: usize,
}

impl<T: Copy, const N: usize> StackVec<T, N> {
    fn new() -> Self {
        StackVec { items: [None; N], len: 0 }
    }

    fn push(&mut self, item: T) -> Result<(), &'static str> {
        if self.len == N {
            return Err("capacity exceeded");
        }
        self.items[self.len] = Some(item);
        self.len += 1;
        Ok(())
    }

    fn iter(&self) -> impl Iterator<Item = &T> {
        self.items[..self.len].iter().filter_map(|o| o.as_ref())
    }
}

fn main() {
    let mut v: StackVec<u32, 4> = StackVec::new();
    for n in [1, 2, 3, 4, 5] {
        match v.push(n) {
            Ok(()) => println!("pushed {n}"),
            Err(e) => println!("push {n}: {e}"),
        }
    }
    println!("contents: {:?}", v.iter().collect::<Vec<_>>());
    println!("all on the stack — no allocator needed");
}
```

> [!warning] Each distinct `N` is a separate copy of the code
> `RingBuffer<16>`, `RingBuffer<64>`, and `RingBuffer<1024>` produce three complete monomorphizations of every method. That's what makes them fast, and it's also code bloat if you instantiate a dozen sizes. If you find yourself with many instantiations of a large generic type, either standardize on fewer sizes or move the shared logic into a non-generic helper that takes a slice — `cargo llvm-lines` will show you the damage. See [Optimization](#/ch/optimization).

## Summary

- **Const generics** (`<const N: usize>`) make a type or function generic over a **value**, not just a type. `N` is a compile-time constant you can use as a value or an array length.
- They're why traits now work for **arrays of any length** — the old 32-element limit is gone.
- The compelling use is **dimension safety**: `Matrix<R, C>` makes a shape mismatch a compile error rather than a runtime panic, at zero cost.
- Stable const generics allow integer/`bool`/`char` parameters but **not arithmetic in types** (`[T; N+1]`), floats, or `where N > 0` bounds. Use a **const assertion** (`const CHECK: () = assert!(…)`) as the workaround.
- **`const fn`** runs at compile time in a const context — loops, `match`, and arrays are allowed; heap allocation and I/O are not. `const { … }` forces inline evaluation.
- Move constant work to compile time for lookup tables and precomputed values; use a build script if it's large.
- **`const`** is inlined per use; **`static`** has one address.
- Every distinct `N` is a separate monomorphization — great for speed, watch for **code bloat**.

> [!exercise] Try it yourself
> 1. Write `fn average<const N: usize>(xs: [f64; N]) -> f64` and call it with arrays of three and seven elements. Where does `N` come from?
> 2. Add a `Vector<const N: usize>` type with a `dot` method that only accepts another `Vector<N>`. Try to dot a `Vector<3>` with a `Vector<4>` and read the error.
> 3. Write a `const fn` that computes a table of the first 16 powers of two into a `static`, and print it. Confirm with `cargo asm` or reasoning that no work happens at runtime.
> 4. Add a const assertion to a `Buffer<const N: usize>` requiring `N` to be a power of two. Instantiate it with 64 and then with 100.
> 5. Implement `transpose` for `Matrix<R, C>` returning `Matrix<C, R>` and verify the dimensions in the type, not just at runtime.
> 6. Try to write a function returning `[u8; N + 1]`. Read the error, then find the nightly feature it names.

Next, the syntax that arrived most recently and quietly improves everyday code — **let-else, let-chains, and modern patterns**.
