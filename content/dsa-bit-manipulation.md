<h1><span class="h1-kicker">Data Structures & Algorithms</span>Bit Manipulation</h1>

Underneath every integer is a row of bits, and manipulating them directly is one of the fastest things a computer can do. **Bit manipulation** lets you pack flags into a single number, test and toggle individual bits, and pull off clever tricks that replace whole loops with one operation. It's essential for performance-critical code, embedded systems, and a favorite of coding interviews. Rust makes it clean and safe.

## The bitwise operators

Rust has the standard bitwise operators, working on each bit in parallel:

```rust
fn main() {
    let a = 0b1100u8; // 12
    let b = 0b1010u8; // 10

    println!("{:04b}", a & b); // AND  → 1000 (bits set in BOTH)
    println!("{:04b}", a | b); // OR   → 1110 (bits set in EITHER)
    println!("{:04b}", a ^ b); // XOR  → 0110 (bits set in exactly ONE)
    println!("{:08b}", !a);    // NOT  → 11110011 (flip all bits)
    println!("{:04b}", a << 1); // shift left  → 11000 (= 24, multiply by 2)
    println!("{:04b}", a >> 1); // shift right → 0110  (= 6, divide by 2)
}
```

> [!jargon] The bitwise operators
> **`&`** (AND) — 1 only where *both* bits are 1. **`|`** (OR) — 1 where *either* is 1. **`^`** (XOR) — 1 where the bits *differ*. **`!`** (NOT) — flips every bit. **`<<`** / **`>>`** — shift bits left/right (left shift by k multiplies by 2ᵏ; right shift divides). These are single CPU instructions — about as fast as computation gets.

## The essential single-bit operations

The four operations you'll use most, each a one-liner using a **mask** (`1 << i` selects bit `i`):

```rust
fn main() {
    let mut flags = 0b0000u8;
    let i = 2; // operate on bit index 2

    flags |= 1 << i;              // SET bit i          → 0100
    println!("{:04b}", flags);

    let is_set = (flags >> i) & 1 == 1; // TEST bit i   → true
    println!("bit {i} set? {is_set}");

    flags &= !(1 << i);          // CLEAR bit i         → 0000
    println!("{:04b}", flags);

    flags ^= 1 << i;             // TOGGLE bit i        → 0100
    println!("{:04b}", flags);
}
```

| Goal | Operation |
|------|-----------|
| **Set** bit `i` | `x \| (1 << i)` |
| **Clear** bit `i` | `x & !(1 << i)` |
| **Toggle** bit `i` | `x ^ (1 << i)` |
| **Test** bit `i` | `(x >> i) & 1 == 1` |

## Rust's built-in bit methods

Rust's integers come with a rich set of bit methods — no need to hand-roll these:

```rust
fn main() {
    let x = 0b1011_0100u8; // 180

    println!("{}", x.count_ones());       // 4  — number of 1 bits (popcount)
    println!("{}", x.count_zeros());      // 4
    println!("{}", x.leading_zeros());    // 0  — bits before the highest 1
    println!("{}", x.trailing_zeros());   // 2  — bits after the lowest 1
    println!("{}", x.is_power_of_two());  // false
    println!("{:08b}", x.rotate_left(2)); // rotate bits around
    println!("{}", x.reverse_bits());     // reverse the bit order
}
```

## Clever bit tricks

Bit manipulation shines in tricks that replace loops or branches with a single operation:

```rust
fn main() {
    // 1. Check if a number is a power of two (exactly one bit set):
    let is_pow2 = |n: u32| n != 0 && (n & (n - 1)) == 0;
    println!("{} {}", is_pow2(16), is_pow2(18)); // true false

    // 2. Find the odd-one-out: XOR all elements — pairs cancel, the loner remains.
    //    (a ^ a == 0, and x ^ 0 == x)
    let nums = [4, 1, 2, 1, 2];
    let unique = nums.iter().fold(0, |acc, &x| acc ^ x);
    println!("the unpaired number is {unique}"); // 4

    // 3. Swap two numbers without a temporary (via XOR):
    let (mut a, mut b) = (5, 9);
    a ^= b; b ^= a; a ^= b;
    println!("swapped: a={a}, b={b}"); // a=9, b=5

    // 4. Lowest set bit: x & x.wrapping_neg() isolates the rightmost 1.
    let x = 0b10110u32;
    println!("{:05b}", x & x.wrapping_neg()); // 00010
}
```

> [!key] The XOR "find the loner" trick
> XOR has two magic properties: `x ^ x == 0` (a value cancels itself) and `x ^ 0 == x`. So if every element in a list appears twice *except one*, XOR-ing them **all** together makes the pairs vanish and leaves just the unique value — in O(n) time and **O(1) space**, no hash set needed. This elegant trick shows up constantly in interviews and is a great demonstration of why bit-level thinking is worth having.

## Bit sets: flags in a single integer

You can pack many boolean flags into the bits of one integer — a compact, cache-friendly **bit set**. Each bit represents membership; set operations become single bitwise ops:

```rust
fn main() {
    // Represent a set of items 0..8 as bits of a u8.
    let mut set: u8 = 0;
    set |= 1 << 1; // add item 1
    set |= 1 << 3; // add item 3
    set |= 1 << 5; // add item 5

    println!("set = {:08b}", set);            // 00101010
    println!("contains 3? {}", (set >> 3) & 1 == 1); // true
    println!("size = {}", set.count_ones());   // 3

    // Set operations are single instructions:
    let other: u8 = 0b0000_1100; // {2, 3}
    println!("union        = {:08b}", set | other);  // combine
    println!("intersection = {:08b}", set & other);  // common → {3}
    println!("difference    = {:08b}", set & !other); // in set, not other
}
```

<figure class="diagram">
<svg viewBox="0 0 640 110" role="img" aria-label="A bit set packs set membership into the bits of one integer; set operations are single bitwise operations">
  <style>
    .bim { font: 600 12px var(--font-mono); fill: var(--text); }
    .bic { font: 11px var(--font-sans); fill: var(--text-mute); }
    .on { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.2; }
    .off { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
  </style>
  <text x="14" y="24" class="bic">u8 as a set of {1,3,5}:</text>
  <g class="bim">
    <rect x="60" y="34" width="34" height="30" class="off"/><text x="73" y="54" fill="var(--text)">0</text>
    <rect x="94" y="34" width="34" height="30" class="off"/><text x="107" y="54" fill="var(--text)">0</text>
    <rect x="128" y="34" width="34" height="30" class="on"/><text x="141" y="54" fill="#fff">1</text>
    <rect x="162" y="34" width="34" height="30" class="off"/><text x="175" y="54" fill="var(--text)">0</text>
    <rect x="196" y="34" width="34" height="30" class="on"/><text x="209" y="54" fill="#fff">1</text>
    <rect x="230" y="34" width="34" height="30" class="off"/><text x="243" y="54" fill="var(--text)">0</text>
    <rect x="264" y="34" width="34" height="30" class="on"/><text x="277" y="54" fill="#fff">1</text>
    <rect x="298" y="34" width="34" height="30" class="off"/><text x="311" y="54" fill="var(--text)">0</text>
  </g>
  <text x="60" y="82" class="bic">bit 7 … bit 0 — a 1 means "in the set". Union/intersection = one | / & instruction.</text>
</svg>
<figcaption>A bit set stores membership in an integer's bits — tiny, cache-friendly, and set operations are single instructions.</figcaption>
</figure>

> [!best] When to reach for bits
> Bit manipulation earns its keep for: **flags/permissions** (pack many booleans into one integer), **sets over a small universe** (a `u64` bit set beats a `HashSet` for items 0..64), **performance-critical** inner loops, **DP over subsets** (bitmask DP), and low-level/embedded work. For clarity in ordinary code, named `bool` fields or a `HashSet` are often better — use bit tricks where the **compactness or speed genuinely matters**, and comment them (they're terse). For big bit sets, the `bit-set`/`bitvec` crates give you a growable version.

## Summary

- **Bitwise operators** (`&`, `|`, `^`, `!`, `<<`, `>>`) manipulate all bits in parallel as single CPU instructions.
- Core single-bit ops via a **mask** (`1 << i`): **set** (`| `), **clear** (`& !`), **toggle** (`^`), **test** (`>> & 1`).
- Rust's built-ins (`count_ones`, `leading_zeros`, `is_power_of_two`, `rotate_left`, …) cover common needs.
- Classic tricks: power-of-two check (`n & (n-1) == 0`), **XOR to find the unpaired element** (O(1) space), lowest-set-bit isolation.
- Pack sets/flags into an integer's bits for a compact, fast **bit set**; use bit tricks where compactness or speed matters, and comment them.

> [!exercise] Try it yourself
> 1. Write a function that returns `true` if a `u32` has an *even* number of set bits (hint: `count_ones() % 2`).
> 2. Use the XOR trick to find the single number that appears an odd number of times in a list where all others appear an even number of times.
> 3. Build a bit set of the even numbers 0..16 in a `u16` and print its `count_ones()`.

For the finale of the algorithms course, we tackle advanced structures for fast range queries — **segment trees and Fenwick trees**.
