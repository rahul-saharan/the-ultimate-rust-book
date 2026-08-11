<h1><span class="h1-kicker">Data Structures & Algorithms</span>Number Theory & Math Algorithms</h1>

A specific set of mathematical algorithms shows up constantly: in cryptography, in hashing, in competitive programming, and in the everyday problem of "how do I compute this without overflowing". Greatest common divisors, prime sieves, modular arithmetic, fast exponentiation, and combinatorics — each is short, each has a classic implementation, and each has a subtle trap.

This chapter covers them all in idiomatic Rust, with the overflow handling that textbook pseudocode leaves out.

## GCD and LCM

The greatest common divisor is the foundation for fraction reduction, modular inverses, and much else. Euclid's algorithm computes it in O(log min(a, b)).

```rust
/// Euclid's algorithm: gcd(a, b) = gcd(b, a mod b), until b is 0.
fn gcd(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

/// The recursive form — the same algorithm, one line.
fn gcd_recursive(a: u64, b: u64) -> u64 {
    if b == 0 { a } else { gcd_recursive(b, a % b) }
}

/// lcm(a, b) = a * b / gcd(a, b) — but DIVIDE FIRST to avoid overflow.
fn lcm(a: u64, b: u64) -> u64 {
    if a == 0 || b == 0 {
        return 0;
    }
    // a / gcd is exact, so this is safe and can't overflow as easily as a * b.
    (a / gcd(a, b)) * b
}

fn main() {
    println!("gcd(48, 18)  = {}", gcd(48, 18));   // 6
    println!("gcd(17, 5)   = {}", gcd(17, 5));    // 1 — coprime
    println!("gcd(0, 7)    = {}", gcd(0, 7));     // 7
    println!("lcm(4, 6)    = {}", lcm(4, 6));     // 12
    println!("lcm(21, 6)   = {}", lcm(21, 6));    // 42

    // Reducing a fraction is one gcd call.
    let (num, den) = (84u64, 126u64);
    let g = gcd(num, den);
    println!("{num}/{den} = {}/{}", num / g, den / g);

    // gcd of a whole list folds cleanly.
    let all = [24u64, 36, 60];
    println!("gcd of {all:?} = {}", all.iter().copied().fold(0, gcd));

    assert_eq!(gcd(48, 18), gcd_recursive(48, 18));
}
```

> [!mistake] `a * b / gcd(a, b)` overflows long before it needs to
> The textbook LCM formula multiplies first, so `lcm(1_000_000_007, 998_244_353)` overflows a `u64` even though the *answer* fits comfortably. Dividing first — `(a / gcd) * b` — is exact (because `gcd` divides `a`) and keeps the intermediate value small. This same "divide before multiplying" instinct applies to binomial coefficients and averages: `(a + b) / 2` overflows where `a + (b - a) / 2` doesn't.

> [!tip] `fold(0, gcd)` computes the gcd of any collection
> `gcd(0, n) == n`, which makes `0` the correct identity element — so folding a list with `gcd` starting from `0` gives you the gcd of the whole list, with no special case for the first element. It's a small thing, but it's why `gcd` is defined that way at zero.

## Primes: the Sieve of Eratosthenes

Testing each number individually is slow. The sieve finds every prime up to `n` in O(n log log n) — effectively linear.

<figure class="diagram">
<svg viewBox="0 0 640 210" role="img" aria-label="The Sieve of Eratosthenes crossing out multiples of 2 then 3 then 5, leaving the primes" >
  <style>
    .sv-h { font: 700 12px var(--font-sans); }
    .sv-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .sv-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .sv-p { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 1.8; }
    .sv-x { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1; }
    .sv-cur { fill: var(--green-soft); stroke: var(--green); stroke-width: 2; }
  </style>
  <text x="20" y="18" class="sv-c">Numbers 2..30. Repeatedly take the smallest unmarked number (a prime) and cross out its multiples.</text>
  <text x="20" y="44" class="sv-h" fill="var(--green)">p = 2 → cross 4, 6, 8, …</text>
  <text x="20" y="76" class="sv-h" fill="var(--green)">p = 3 → cross 9, 15, 21, 27</text>
  <text x="20" y="108" class="sv-h" fill="var(--green)">p = 5 → cross 25</text>
  <text x="20" y="140" class="sv-h" fill="var(--rust-600)">what remains is prime:</text>
  <g class="sv-m" transform="translate(250,30)">
    <rect x="0" y="0" width="26" height="20" class="sv-cur"/><text x="7" y="15">2</text>
    <rect x="28" y="0" width="26" height="20" class="sv-p"/><text x="35" y="15">3</text>
    <rect x="56" y="0" width="26" height="20" class="sv-x"/><text x="63" y="15" fill="var(--text-mute)">4</text>
    <rect x="84" y="0" width="26" height="20" class="sv-p"/><text x="91" y="15">5</text>
    <rect x="112" y="0" width="26" height="20" class="sv-x"/><text x="119" y="15" fill="var(--text-mute)">6</text>
    <rect x="140" y="0" width="26" height="20" class="sv-p"/><text x="147" y="15">7</text>
    <rect x="168" y="0" width="26" height="20" class="sv-x"/><text x="175" y="15" fill="var(--text-mute)">8</text>
    <rect x="196" y="0" width="26" height="20" class="sv-p"/><text x="203" y="15">9</text>
    <rect x="224" y="0" width="26" height="20" class="sv-x"/><text x="231" y="15" fill="var(--text-mute)">10</text>
    <rect x="252" y="0" width="26" height="20" class="sv-p"/><text x="257" y="15">11</text>
  </g>
  <g class="sv-m" transform="translate(250,62)">
    <rect x="0" y="0" width="26" height="20" class="sv-p"/><text x="7" y="15">2</text>
    <rect x="28" y="0" width="26" height="20" class="sv-cur"/><text x="35" y="15">3</text>
    <rect x="56" y="0" width="26" height="20" class="sv-x"/><text x="63" y="15" fill="var(--text-mute)">4</text>
    <rect x="84" y="0" width="26" height="20" class="sv-p"/><text x="91" y="15">5</text>
    <rect x="112" y="0" width="26" height="20" class="sv-x"/><text x="119" y="15" fill="var(--text-mute)">6</text>
    <rect x="140" y="0" width="26" height="20" class="sv-p"/><text x="147" y="15">7</text>
    <rect x="168" y="0" width="26" height="20" class="sv-x"/><text x="175" y="15" fill="var(--text-mute)">8</text>
    <rect x="196" y="0" width="26" height="20" class="sv-x"/><text x="203" y="15" fill="var(--text-mute)">9</text>
    <rect x="224" y="0" width="26" height="20" class="sv-x"/><text x="231" y="15" fill="var(--text-mute)">10</text>
    <rect x="252" y="0" width="26" height="20" class="sv-p"/><text x="257" y="15">11</text>
  </g>
  <g class="sv-m" transform="translate(250,132)">
    <rect x="0" y="0" width="26" height="20" class="sv-p"/><text x="7" y="15">2</text>
    <rect x="28" y="0" width="26" height="20" class="sv-p"/><text x="35" y="15">3</text>
    <rect x="56" y="0" width="26" height="20" class="sv-p"/><text x="63" y="15">5</text>
    <rect x="84" y="0" width="26" height="20" class="sv-p"/><text x="91" y="15">7</text>
    <rect x="112" y="0" width="26" height="20" class="sv-p"/><text x="117" y="15">11</text>
    <rect x="140" y="0" width="26" height="20" class="sv-p"/><text x="145" y="15">13</text>
    <rect x="168" y="0" width="26" height="20" class="sv-p"/><text x="173" y="15">17</text>
    <rect x="196" y="0" width="26" height="20" class="sv-p"/><text x="201" y="15">19</text>
    <rect x="224" y="0" width="26" height="20" class="sv-p"/><text x="229" y="15">23</text>
    <rect x="252" y="0" width="26" height="20" class="sv-p"/><text x="257" y="15">29</text>
  </g>
  <text x="20" y="176" class="sv-c">Start crossing at p·p, not 2p — smaller multiples were already crossed by a smaller prime.</text>
  <text x="20" y="196" class="sv-c">Stop when p·p &gt; n. Total work is O(n log log n), which is very nearly linear.</text>
</svg>
<figcaption>The <b>sieve</b> works by elimination rather than by testing. Starting each pass at <code>p·p</code> and stopping at <code>√n</code> are the two optimizations that matter.</figcaption>
</figure>

```rust
/// Every prime up to and including n.
fn sieve(n: usize) -> Vec<usize> {
    if n < 2 {
        return Vec::new();
    }
    let mut is_prime = vec![true; n + 1];
    is_prime[0] = false;
    is_prime[1] = false;

    let mut p = 2;
    // Only need to sieve up to sqrt(n) — done with multiplication, not floats.
    while p * p <= n {
        if is_prime[p] {
            // Start at p*p: every smaller multiple of p has a smaller prime factor.
            let mut m = p * p;
            while m <= n {
                is_prime[m] = false;
                m += p;
            }
        }
        p += 1;
    }

    is_prime.iter().enumerate().filter(|(_, &prime)| prime).map(|(i, _)| i).collect()
}

/// Trial division — fine for ONE number, hopeless for a range.
fn is_prime(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n % 2 == 0 {
        return n == 2;
    }
    // Only odd divisors, only up to sqrt(n).
    let mut d = 3;
    while d * d <= n {
        if n % d == 0 {
            return false;
        }
        d += 2;
    }
    true
}

/// Prime factorization by trial division: O(sqrt n).
fn factorize(mut n: u64) -> Vec<(u64, u32)> {
    let mut factors = Vec::new();
    let mut d = 2;
    while d * d <= n {
        let mut count = 0;
        while n % d == 0 {
            n /= d;
            count += 1;
        }
        if count > 0 {
            factors.push((d, count));
        }
        d += if d == 2 { 1 } else { 2 };
    }
    // Whatever remains above sqrt(n) is itself prime.
    if n > 1 {
        factors.push((n, 1));
    }
    factors
}

fn main() {
    println!("primes to 50: {:?}", sieve(50));
    println!("count to 1000: {}", sieve(1000).len()); // 168

    for n in [1u64, 2, 91, 97, 1_000_003] {
        println!("is_prime({n}) = {}", is_prime(n));
    }

    println!("\n360      = {:?}", factorize(360));       // 2^3 * 3^2 * 5
    println!("1000003  = {:?}", factorize(1_000_003));   // prime
    println!("600851475143 = {:?}", factorize(600_851_475_143));
}
```

| Task | Algorithm | Complexity |
|---|---|---|
| all primes up to `n` | sieve of Eratosthenes | O(n log log n) |
| all primes, memory-tight | segmented sieve | O(n log log n), O(√n) space |
| is this one number prime? | trial division to √n | O(√n) |
| is this *large* number prime? | Miller–Rabin | O(k log³ n) |
| prime factorization | trial division to √n | O(√n) |
| factorization of a large number | Pollard's rho | ~O(n^¼) |
| smallest prime factor of many numbers | modified sieve storing SPF | O(n log log n) |

> [!performance] Sieve once, then answer queries in O(1)
> If you need primality for many numbers in a range, don't call `is_prime` in a loop — that's O(n√n). Sieve the whole range once into a `Vec<bool>` and every subsequent query is an array index. A variant stores the *smallest prime factor* of each number instead of a bool, which then gives you factorization of any number in the range in O(log n) by repeatedly dividing. That trade — precompute once, query cheaply — is the recurring theme of this whole chapter.

> [!mistake] `while d * d <= n` overflows for `n` near the type's maximum
> With `n` close to `u64::MAX`, `d * d` can wrap around and the loop exits early, reporting a composite as prime. Use `d <= n / d` instead, which is equivalent and cannot overflow, or use a wider type for the intermediate. The same applies to `p * p <= n` in the sieve — safe there only because `n` is bounded by available memory.

## Modular arithmetic

Working "mod m" keeps numbers bounded, which is why it underpins hashing, cryptography, and any problem that says "output the answer modulo 1e9+7".

```rust
const MOD: u64 = 1_000_000_007;

/// (a + b) mod m — reduce inputs first so the sum can't overflow.
fn add_mod(a: u64, b: u64, m: u64) -> u64 {
    (a % m + b % m) % m
}

/// (a - b) mod m — add m before subtracting to stay non-negative.
fn sub_mod(a: u64, b: u64, m: u64) -> u64 {
    (a % m + m - b % m) % m
}

/// (a * b) mod m — widen to u128 so the product can't overflow.
fn mul_mod(a: u64, b: u64, m: u64) -> u64 {
    ((a as u128 * b as u128) % m as u128) as u64
}

/// Fast modular exponentiation by squaring: O(log e) instead of O(e).
fn pow_mod(mut base: u64, mut exp: u64, m: u64) -> u64 {
    let mut result = 1u64;
    base %= m;
    while exp > 0 {
        // If this bit of the exponent is set, fold base into the result.
        if exp & 1 == 1 {
            result = mul_mod(result, base, m);
        }
        base = mul_mod(base, base, m); // square for the next bit
        exp >>= 1;
    }
    result
}

/// Modular inverse via Fermat's little theorem — requires m PRIME.
/// a^(m-2) ≡ a^(-1) (mod m)
fn inv_mod_prime(a: u64, m: u64) -> u64 {
    pow_mod(a, m - 2, m)
}

/// Division mod a prime: a / b ≡ a * b^(-1)
fn div_mod(a: u64, b: u64, m: u64) -> u64 {
    mul_mod(a, inv_mod_prime(b, m), m)
}

fn main() {
    println!("add:  {}", add_mod(MOD - 1, 5, MOD));       // wraps correctly
    println!("sub:  {}", sub_mod(3, 10, MOD));            // no underflow
    println!("mul:  {}", mul_mod(MOD - 1, MOD - 1, MOD)); // no overflow

    // 2^1000 mod 1e9+7 — instant, despite the number having 302 digits.
    println!("2^1000 mod p = {}", pow_mod(2, 1000, MOD));

    // Naive exponentiation would need 1000 multiplications; this needs 10.
    println!("bits in 1000 = {}", 64 - 1000u64.leading_zeros());

    // Inverses let you divide in modular arithmetic.
    let inv3 = inv_mod_prime(3, MOD);
    println!("3^-1 = {inv3}");
    println!("3 * 3^-1 mod p = {}", mul_mod(3, inv3, MOD)); // 1
    println!("10 / 3 mod p = {}", div_mod(10, 3, MOD));
}
```

> [!key] Widen to `u128` for modular multiplication
> Two numbers just under 10⁹ multiply to just under 10¹⁸, which fits a `u64` — but two numbers near `u64::MAX` do not. Casting to `u128` for the product and back afterwards is a single instruction on 64-bit hardware and removes the whole class of bug. This is the standard idiom, and it's why `mul_mod` above looks the way it does. For moduli above 2⁶⁴ you need Montgomery multiplication or a bignum crate.

> [!warning] The modular inverse via Fermat only works for a **prime** modulus
> `a^(m-2) mod m` is the inverse only when `m` is prime — which is why competitive problems always use 1e9+7 or 998244353. For a composite modulus you need the **extended Euclidean algorithm**, and an inverse exists only when `gcd(a, m) == 1`. Using Fermat with a composite modulus silently produces a wrong answer rather than an error.

```rust
/// Extended Euclid: returns (g, x, y) with a*x + b*y = g = gcd(a, b).
fn ext_gcd(a: i64, b: i64) -> (i64, i64, i64) {
    if b == 0 {
        return (a, 1, 0);
    }
    let (g, x1, y1) = ext_gcd(b, a % b);
    (g, y1, x1 - (a / b) * y1)
}

/// Modular inverse for ANY modulus — None when gcd(a, m) != 1.
fn inv_mod(a: i64, m: i64) -> Option<i64> {
    let (g, x, _) = ext_gcd(a.rem_euclid(m), m);
    if g != 1 {
        None // no inverse exists
    } else {
        Some(x.rem_euclid(m))
    }
}

fn main() {
    let (g, x, y) = ext_gcd(240, 46);
    println!("gcd(240,46) = {g}, and 240*{x} + 46*{y} = {}", 240 * x + 46 * y);

    // Works with a composite modulus, unlike the Fermat version.
    println!("3^-1 mod 10 = {:?}", inv_mod(3, 10));  // Some(7), since 3*7=21≡1
    println!("3 * 7 mod 10 = {}", (3 * 7) % 10);
    println!("4^-1 mod 10 = {:?}", inv_mod(4, 10));  // None — gcd(4,10)=2
}
```

## Combinatorics

Counting arrangements, with the overflow handling that makes it usable.

```rust
const MOD: u64 = 1_000_000_007;

fn mul_mod(a: u64, b: u64, m: u64) -> u64 {
    ((a as u128 * b as u128) % m as u128) as u64
}

fn pow_mod(mut base: u64, mut exp: u64, m: u64) -> u64 {
    let mut result = 1u64;
    base %= m;
    while exp > 0 {
        if exp & 1 == 1 {
            result = mul_mod(result, base, m);
        }
        base = mul_mod(base, base, m);
        exp >>= 1;
    }
    result
}

/// n choose k, exact. Building up one step at a time keeps intermediates
/// far smaller than computing n! / (k!(n-k)!) directly — and each division
/// is exact, because C(n, i+1) = C(n, i) * (n-i) / (i+1).
fn binomial(n: u64, k: u64) -> u64 {
    if k > n {
        return 0;
    }
    let k = k.min(n - k); // C(n,k) == C(n,n-k) — iterate over the smaller
    (0..k).fold(1u64, |acc, i| acc * (n - i) / (i + 1))
}

/// Precomputed factorials give O(1) binomials mod a prime — the standard
/// approach when you need many of them.
struct Combinatorics {
    fact: Vec<u64>,
    inv_fact: Vec<u64>,
}

impl Combinatorics {
    fn new(max: usize) -> Self {
        let mut fact = vec![1u64; max + 1];
        for i in 1..=max {
            fact[i] = mul_mod(fact[i - 1], i as u64, MOD);
        }
        // One modular inverse, then walk backwards — n inverses for the price of one.
        let mut inv_fact = vec![1u64; max + 1];
        inv_fact[max] = pow_mod(fact[max], MOD - 2, MOD);
        for i in (0..max).rev() {
            inv_fact[i] = mul_mod(inv_fact[i + 1], (i + 1) as u64, MOD);
        }
        Combinatorics { fact, inv_fact }
    }

    fn choose(&self, n: usize, k: usize) -> u64 {
        if k > n {
            return 0;
        }
        mul_mod(self.fact[n], mul_mod(self.inv_fact[k], self.inv_fact[n - k], MOD), MOD)
    }

    fn permute(&self, n: usize, k: usize) -> u64 {
        if k > n {
            return 0;
        }
        mul_mod(self.fact[n], self.inv_fact[n - k], MOD)
    }
}

fn main() {
    println!("C(5,2)   = {}", binomial(5, 2));   // 10
    println!("C(52,5)  = {}", binomial(52, 5));  // 2598960 — poker hands
    println!("C(40,20) = {}", binomial(40, 20)); // 137846528820

    // For big n mod a prime, precompute once and query in O(1).
    let c = Combinatorics::new(1_000);
    println!("\nC(1000,500) mod p = {}", c.choose(1000, 500));
    println!("P(1000,3)   mod p = {}", c.permute(1000, 3));

    // Pascal's triangle, for when you want all of them exactly.
    let mut row = vec![1u64];
    for _ in 0..6 {
        println!("{row:?}");
        let mut next = vec![1u64];
        for w in row.windows(2) {
            next.push(w[0] + w[1]);
        }
        next.push(1);
        row = next;
    }
}
```

| Quantity | Formula | Counts |
|---|---|---|
| `n!` | factorial | orderings of `n` items |
| `P(n, k)` = `n!/(n-k)!` | permutations | ordered selections of `k` |
| `C(n, k)` = `n!/(k!(n-k)!)` | combinations | unordered selections of `k` |
| `C(n+k-1, k)` | multiset | selections with repetition |
| `2ⁿ` | powerset | subsets of `n` items |
| Catalan `Cₙ` = `C(2n,n)/(n+1)` | Catalan numbers | balanced bracketings, BST shapes |
| Fibonacci | `F(n) = F(n-1) + F(n-2)` | tilings, rabbit populations |

> [!performance] Precompute factorials and inverse factorials once
> If a problem asks for thousands of binomial coefficients mod a prime, computing each from scratch is wasteful. Build the factorial table in O(n), then get **all** inverse factorials from a *single* modular exponentiation by walking backwards — because `inv_fact[i] = inv_fact[i+1] * (i+1)`. After that every `choose(n, k)` is two multiplications. This precompute-then-query structure is the single most useful trick in competitive combinatorics.

## Overflow: the trap that ties this chapter together

```rust
fn main() {
    let big: u64 = u64::MAX - 1;

    // In debug builds arithmetic overflow PANICS; in release it wraps silently.
    // That difference has produced a lot of "works locally" bugs.
    println!("checked_add:    {:?}", big.checked_add(5));      // None
    println!("saturating_add: {}", big.saturating_add(5));      // clamps to MAX
    println!("wrapping_add:   {}", big.wrapping_add(5));        // wraps
    println!("overflowing_add:{:?}", big.overflowing_add(5));   // (value, did_it?)

    // Widening is the cleanest fix when you have the headroom.
    let a: u64 = 3_000_000_000;
    let b: u64 = 4_000_000_000;
    println!("\nas u128: {}", a as u128 * b as u128);

    // Integer square root without floats — no precision surprises.
    fn isqrt(n: u64) -> u64 {
        if n < 2 {
            return n;
        }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }
    println!("\nisqrt(1000000000000) = {}", isqrt(1_000_000_000_000));
    println!("isqrt(99)            = {}", isqrt(99));
    println!("isqrt(100)           = {}", isqrt(100));

    // Euclidean remainder: always non-negative, unlike %.
    println!("\n(-7) % 3         = {}", -7i32 % 3);            // -1
    println!("(-7).rem_euclid(3) = {}", (-7i32).rem_euclid(3)); // 2 ← usually what you want
}
```

| Operation | Behaviour on overflow |
|---|---|
| `a + b` | panics in debug, **wraps in release** |
| `a.checked_add(b)` | `None` |
| `a.saturating_add(b)` | clamps to `MAX`/`MIN` |
| `a.wrapping_add(b)` | wraps, explicitly |
| `a.overflowing_add(b)` | `(result, overflowed)` |
| `a as u128 * b as u128` | widen — no overflow |
| `a.rem_euclid(b)` | non-negative remainder |
| `a.isqrt()` | integer square root (stable since 1.84) |

> [!warning] Release builds wrap silently, and that's where your algorithm runs
> Rust panics on integer overflow in debug builds and **wraps** in release, because the check costs a branch. So an overflow bug in a maths routine may be caught by your tests and then silently produce garbage in production. For anything computing with large numbers, use the `checked_*` family, widen to `u128`, or set `overflow-checks = true` under `[profile.release]` and accept the small cost. See [Optimization](#/ch/optimization).

> [!tip] `rem_euclid` for anything cyclic
> Rust's `%` follows the sign of the dividend, so `-7 % 3` is `-1` — and using that as an array index panics. `rem_euclid` always returns a non-negative result, which is what you want for wrapping around a circular buffer, a clock, a grid, or a hash table. It's one of those methods that quietly eliminates a whole family of off-by-one bugs.

## Complexity summary

| Algorithm | Time | Space |
|---|---|---|
| Euclid's GCD | O(log min(a,b)) | O(1) |
| extended Euclid | O(log min(a,b)) | O(log n) recursion |
| sieve of Eratosthenes to `n` | O(n log log n) | O(n) |
| segmented sieve | O(n log log n) | O(√n) |
| trial-division primality | O(√n) | O(1) |
| Miller–Rabin (k rounds) | O(k log³ n) | O(1) |
| trial-division factorization | O(√n) | O(log n) output |
| modular exponentiation | O(log e) | O(1) |
| modular inverse (Fermat) | O(log m) | O(1) |
| factorial table build | O(n) | O(n) |
| binomial from tables | O(1) | O(n) precomputed |
| Pascal's triangle to row `n` | O(n²) | O(n) per row |

## Summary

- **Euclid's GCD** is O(log n) and folds over a collection with `0` as the identity. Compute **LCM as `(a / gcd) * b`** to avoid overflow.
- The **sieve of Eratosthenes** finds all primes to `n` in O(n log log n) — start each pass at `p·p` and stop at `√n`. Sieve once, then query in O(1).
- Use `d <= n / d` rather than `d * d <= n` when `n` can approach the type maximum.
- **Modular arithmetic**: reduce before adding, add `m` before subtracting, and **widen to `u128`** before multiplying.
- **Exponentiation by squaring** turns O(e) into O(log e) — the basis of RSA and Diffie-Hellman.
- The **Fermat modular inverse** requires a *prime* modulus; use **extended Euclid** otherwise, and remember an inverse exists only when `gcd(a, m) == 1`.
- For many binomial coefficients mod a prime, **precompute factorials and inverse factorials** — all the inverses come from one exponentiation.
- **Release builds wrap on overflow silently.** Use `checked_*`, widen, or enable `overflow-checks`. Use `rem_euclid` for anything cyclic.

> [!exercise] Try it yourself
> 1. Write `gcd` for three numbers using `fold`, then use it to reduce the fraction 462/1071.
> 2. Modify the sieve to store the *smallest prime factor* of each number instead of a bool, then use it to factorize any number under a million in O(log n).
> 3. Compute `2^1_000_000_007 mod 1_000_000_007` with `pow_mod` and time it. How many multiplications did it perform?
> 4. Implement `inv_mod` with extended Euclid and verify `a * inv_mod(a, m) ≡ 1` for every `a` coprime to 26.
> 5. Compute `C(100, 50)` exactly with a `u128`, then mod 1e9+7 with the factorial tables. Do they agree after reduction?
> 6. Write `fn is_prime_large(n: u64) -> bool` using Miller–Rabin with the deterministic witness set for 64-bit inputs. Compare its speed to trial division on `2^61 - 1`.

Next: algorithms on points, lines and polygons — **computational geometry**.
