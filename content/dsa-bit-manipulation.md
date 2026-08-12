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

    // 3. Swap two numbers without a temporary (via XOR).
    //    Historically famous — but see the warning below: don't use this.
    let (mut a, mut b) = (5, 9);
    a ^= b; b ^= a; a ^= b;
    println!("swapped: a={a}, b={b}"); // a=9, b=5

    // 4. Lowest set bit: x & x.wrapping_neg() isolates the rightmost 1.
    let x = 0b10110u32;
    println!("{:05b}", x & x.wrapping_neg()); // 00010

    // 5. Clear the lowest set bit — the basis of "iterate over set bits".
    println!("{:05b}", x & (x - 1)); // 10100
}
```

> [!warning] The XOR swap is a trap, not a technique — use `std::mem::swap`
> That trick is genuinely famous, and genuinely bad advice today. Two reasons.
>
> **It breaks on aliasing.** If both operands are the *same location*, XOR swap zeroes the value instead of doing nothing. Verified:
> ```rust
> fn xor_swap(v: &mut [i32], i: usize, j: usize) {
>     v[i] ^= v[j];
>     v[j] ^= v[i];
>     v[i] ^= v[j];
> }
> fn main() {
>     let mut v = vec![7, 8, 9];
>     xor_swap(&mut v, 1, 1);
>     println!("{v:?}"); // [7, 0, 9] — the 8 is GONE
>     let mut w = vec![7, 8, 9];
>     w.swap(1, 1);
>     println!("{w:?}"); // [7, 8, 9] — correct
> }
> ```
> Note the trick works fine for two *distinct variables* that merely hold equal values; the failure needs genuine aliasing, which is exactly what an index-based or pointer-based helper allows.
>
> **It isn't faster.** It was a micro-optimisation for machines short of registers. A modern compiler turns a three-instruction dependency chain into worse code than a plain swap, which the CPU can reorder freely — and `mem::swap` (or `slice::swap`) compiles to the optimal sequence, works on any type rather than just integers, and cannot alias-fail. Keep the XOR swap as a piece of history and an interview answer, not as code you write.

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

## Shift pitfalls Rust makes you notice

Shifts are where bit manipulation bites, and Rust's behaviour here is worth knowing precisely:

```rust
fn main() {
    let x: u32 = 1;

    println!("u32::BITS = {}", u32::BITS);
    // `x << 32` on a u32 is an overflow: it PANICS in debug builds and
    // wraps in release. Neither is what you want, so be explicit:
    println!("checked_shl(32)  = {:?}   ← None, no valid answer", x.checked_shl(32));
    println!("wrapping_shl(32) = {}      ← wrapped to a shift of 0!", x.wrapping_shl(32));

    // The usual cause is forgetting the literal's type. `1` defaults to i32.
    println!("1u64 << 32 = {}", 1u64 << 32);

    // Right shift differs by signedness — same bits, different result.
    let signed: i8 = -8;
    let unsigned: u8 = 248; // the same bit pattern
    println!("\nbits            {:08b} both", signed as u8);
    println!("i8  -8  >> 1 = {:>4}   (arithmetic: sign bit is copied)", signed >> 1);
    println!("u8  248 >> 1 = {:>4}   (logical: zeros shifted in)", unsigned >> 1);
}
```

> [!mistake] `1 << i` where `i` can reach the width — and the wrong literal type
> Two closely related bugs. First, **shifting by the type's full width is undefined in most languages and an overflow in Rust** — `1u32 << 32` panics in debug and silently becomes `1` in release, because the shift amount wraps. A loop written `for i in 0..=32 { mask |= 1 << i }` looks symmetric and is broken.
>
> Second, **`1` is an `i32` by default**. Writing `let mask = 1 << 40;` fails or overflows even though you meant a 64-bit mask; you need `1u64 << 40`. When building masks for anything wider than 32 bits, always annotate the literal — `1u64`, `1usize`, `1u128`.
>
> Rust also distinguishes the two right shifts by *type* rather than by operator: `>>` on a signed integer is **arithmetic** (copies the sign bit, so `-8 >> 1 == -4`) and on an unsigned integer is **logical** (shifts in zeros). C famously leaves this partly to the implementation; Rust ties it to the type, which is one fewer thing to get wrong — as long as you know which type you have.

## Bitmask DP: subsets as integers

A bitmask's real power in algorithms is as a **state**. If a subset of up to ~20 items can be one integer, then "which items have I used?" becomes an array index — and a factorial problem becomes exponential-but-tractable.

The classic is the **travelling salesman problem**: visit every city once and return home, at minimum cost. Brute force is O(n!). Bitmask DP is O(2ⁿ·n²), which sounds terrible until you compare them at n = 15: `1.3 × 10¹²` versus `7.4 × 10⁶`.

```rust
/// TSP by bitmask DP — O(2^n · n^2) rather than O(n!).
fn tsp(dist: &[Vec<u32>]) -> u32 {
    let n = dist.len();
    let all_visited = 1usize << n;

    // dp[mask][last] = cheapest route that has visited exactly the cities in
    // `mask` and currently sits at `last`. The mask IS the subset.
    let mut dp = vec![vec![u32::MAX; n]; all_visited];
    dp[1][0] = 0; // start at city 0, with only city 0 visited

    for mask in 1..all_visited {
        if mask & 1 == 0 {
            continue; // every route begins at city 0, so bit 0 is always set
        }
        for last in 0..n {
            if mask >> last & 1 == 0 {
                continue; // `last` must actually be in this subset
            }
            let current = dp[mask][last];
            if current == u32::MAX {
                continue; // unreachable state
            }
            for next in 0..n {
                if mask >> next & 1 == 1 {
                    continue; // already visited
                }
                let next_mask = mask | 1 << next;
                let cost = current + dist[last][next];
                if cost < dp[next_mask][next] {
                    dp[next_mask][next] = cost;
                }
            }
        }
    }

    // Close the tour: return to city 0 from wherever we ended.
    (1..n)
        .map(|last| dp[all_visited - 1][last].saturating_add(dist[last][0]))
        .min()
        .unwrap_or(0)
}

/// Enumerate every subset of a mask — a surprisingly useful idiom.
fn submasks(mask: u32) -> Vec<u32> {
    let mut out = Vec::new();
    let mut sub = mask;
    loop {
        out.push(sub);
        if sub == 0 {
            break;
        }
        sub = (sub - 1) & mask; // the standard trick
    }
    out
}

fn main() {
    let dist = vec![
        vec![0, 10, 15, 20],
        vec![10, 0, 35, 25],
        vec![15, 35, 0, 30],
        vec![20, 25, 30, 0],
    ];
    println!("shortest tour of 4 cities: {}", tsp(&dist));

    let five = vec![
        vec![0, 29, 20, 21, 16],
        vec![29, 0, 15, 17, 28],
        vec![20, 15, 0, 28, 14],
        vec![21, 17, 28, 0, 25],
        vec![16, 28, 14, 25, 0],
    ];
    println!("shortest tour of 5 cities: {}", tsp(&five));

    let mask = 0b1011u32;
    let subs = submasks(mask);
    println!("\nsubsets of {mask:04b} — {} of them (2^popcount = 2^{})",
        subs.len(), mask.count_ones());
    println!("  {:?}", subs.iter().map(|s| format!("{s:04b}")).collect::<Vec<_>>());
}
```

> [!key] `sub = (sub - 1) & mask` walks every subset, and nothing else
> That one line is worth memorising. Subtracting 1 borrows through the low zero bits, and `& mask` immediately discards any bit that wasn't in the original — so you step from each subset directly to the next smaller one, touching each exactly once and never visiting a non-subset. Enumerating subsets of a mask with `k` set bits costs O(2ᵏ), not O(2ⁿ), which is what makes "iterate over all partitions" DPs feasible.
>
> Two companion idioms complete the toolkit: **`x & (x - 1)`** clears the lowest set bit (iterate over *set bits* by repeating it), and **`x & x.wrapping_neg()`** isolates it. Together they let you walk a subset's members without testing all 64 positions.

> [!performance] Bitmask DP's ceiling is about 20–25 items, and it's a hard one
> `dp[1 << n][n]` of `u32` needs `2ⁿ · n · 4` bytes: at n = 20 that's 80 MB, at n = 25 it's **3.2 GB**, and at n = 30 you'd need 128 GB. The time grows just as fast. So bitmask DP occupies a narrow but valuable band — hopeless above ~25 items, and unnecessary below ~10 where brute force is fine.
>
> This is exactly why the [complexity-versus-input-size table](#/ch/dsa-intro) is so useful in reverse: a problem stating `n ≤ 20` is *telling you* to think in subsets. That bound is a hint about the technique, not just a limit.

> [!best] When to reach for bits
> Bit manipulation earns its keep for: **flags/permissions** (pack many booleans into one integer), **sets over a small universe** (a `u64` bit set beats a `HashSet` for items 0..64), **performance-critical** inner loops, **DP over subsets** (bitmask DP), and low-level/embedded work. For clarity in ordinary code, named `bool` fields or a `HashSet` are often better — use bit tricks where the **compactness or speed genuinely matters**, and comment them (they're terse). For big bit sets, the `bit-set`/`bitvec` crates give you a growable version.

## Summary

- **Bitwise operators** (`&`, `|`, `^`, `!`, `<<`, `>>`) manipulate all bits in parallel as single CPU instructions.
- Core single-bit ops via a **mask** (`1 << i`): **set** (`| `), **clear** (`& !`), **toggle** (`^`), **test** (`>> & 1`).
- Rust's built-ins (`count_ones`, `leading_zeros`, `is_power_of_two`, `rotate_left`, …) cover common needs.
- Classic tricks: power-of-two check (`n & (n-1) == 0`), **XOR to find the unpaired element** (O(1) space), lowest-set-bit isolation with `x & x.wrapping_neg()`, and clearing it with `x & (x - 1)`.
- **Don't use the XOR swap.** It corrupts the value when the operands alias (verified: an element becomes 0), and it's slower than `mem::swap` on modern CPUs.
- **Shifting by the full type width is an overflow** — panics in debug, wraps in release. And `1` is an `i32`, so wide masks need `1u64` / `1usize`.
- `>>` is **arithmetic on signed** types (copies the sign bit) and **logical on unsigned** (shifts in zeros) — Rust ties it to the type rather than leaving it implementation-defined.
- **Bitmask DP** makes a subset an array index, turning O(n!) into O(2ⁿ·n²) — TSP for 15 cities goes from 10¹² to 10⁷. The ceiling is ~20–25 items; `n ≤ 20` in a problem statement is a hint to think in subsets.
- **`sub = (sub - 1) & mask`** enumerates every subset of a mask in O(2ᵏ), touching each exactly once.
- Pack sets/flags into an integer's bits for a compact, fast **bit set**; use bit tricks where compactness or speed matters, and comment them.

> [!exercise] Try it yourself
> 1. Write a function that returns `true` if a `u32` has an *even* number of set bits (hint: `count_ones() % 2`).
> 2. Use the XOR trick to find the single number that appears an odd number of times in a list where all others appear an even number of times.
> 3. Build a bit set of the even numbers 0..16 in a `u16` and print its `count_ones()`.
> 4. Run `xor_swap(&mut v, 1, 1)` yourself and confirm the element becomes 0. Then explain in one sentence why `v.swap(1, 1)` is safe.
> 5. Write `for i in 0..=32 { mask |= 1u32 << i }` and run it in debug. What happens, and at which `i`?
> 6. Iterate over the *set bits* of a `u32` using `x & (x - 1)` repeatedly, and compare the loop count against testing all 32 positions.
> 7. Verify TSP against a brute-force permutation search for n = 4 and n = 5. Then time both at n = 9.
> 8. Compute the memory `dp[1 << n][n]` needs at n = 20 and n = 25. Which one still fits on your machine?
> 9. Use submask enumeration to solve **set-cover** over a small universe: choose the fewest subsets whose union is everything.

For the finale of the algorithms course, we tackle advanced structures for fast range queries — **segment trees and Fenwick trees**.
