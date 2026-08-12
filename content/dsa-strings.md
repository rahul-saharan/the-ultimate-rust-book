<h1><span class="h1-kicker">Data Structures & Algorithms</span>String Algorithms</h1>

Searching for a pattern inside a larger text — "does *needle* appear in *haystack*, and where?" — seems trivial until the strings get large. The naive approach is O(n·m); clever algorithms like **KMP** and **Rabin-Karp** get it down to O(n+m) by never re-examining characters they've already ruled out. This chapter covers the essential string-matching algorithms in Rust.

## The naive approach and its cost

The obvious method: try matching the pattern at every position in the text. It works, but re-checks characters wastefully:

```rust
fn naive_search(text: &str, pattern: &str) -> Vec<usize> {
    let text: Vec<char> = text.chars().collect();
    let pat: Vec<char> = pattern.chars().collect();
    let mut matches = Vec::new();
    if pat.is_empty() || pat.len() > text.len() {
        return matches;
    }
    for start in 0..=(text.len() - pat.len()) {
        if text[start..start + pat.len()] == pat[..] {
            matches.push(start);
        }
    }
    matches
}

fn main() {
    println!("{:?}", naive_search("abababab", "abab")); // [0, 2, 4]
}
```

This is **O(n·m)** worst case (text length n, pattern length m): at each of n positions it may compare up to m characters. For a pattern like `"aaaa...ab"` in `"aaaa...aa"`, that's genuinely slow.

## KMP: never look back

The **Knuth-Morris-Pratt (KMP)** algorithm achieves **O(n + m)** by a clever insight: when a match fails partway, we already know some of the text matched the pattern's prefix — so we can skip ahead *without re-reading* those characters. It precomputes a **failure function** (the "LPS" — longest proper prefix that's also a suffix) telling it how far to jump on a mismatch:

```rust
fn kmp_search(text: &str, pattern: &str) -> Vec<usize> {
    let text: Vec<char> = text.chars().collect();
    let pat: Vec<char> = pattern.chars().collect();
    if pat.is_empty() {
        return vec![];
    }

    // 1. Build the LPS ("longest prefix that is also a suffix") table.
    let mut lps = vec![0usize; pat.len()];
    let mut len = 0;
    let mut i = 1;
    while i < pat.len() {
        if pat[i] == pat[len] {
            len += 1;
            lps[i] = len;
            i += 1;
        } else if len > 0 {
            len = lps[len - 1]; // fall back — reuse what we know
        } else {
            lps[i] = 0;
            i += 1;
        }
    }

    // 2. Scan the text, using lps to skip on mismatch (never re-reading text[i]).
    let mut result = Vec::new();
    let (mut i, mut j) = (0, 0); // i over text, j over pattern
    while i < text.len() {
        if text[i] == pat[j] {
            i += 1;
            j += 1;
            if j == pat.len() {
                result.push(i - j);   // full match found
                j = lps[j - 1];       // continue searching for more
            }
        } else if j > 0 {
            j = lps[j - 1];           // skip ahead using the table
        } else {
            i += 1;
        }
    }
    result
}

fn main() {
    println!("{:?}", kmp_search("abababcab", "abab")); // [0, 2]
    println!("{:?}", kmp_search("aaaaa", "aa"));         // [0, 1, 2, 3]
}
```

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="KMP uses the failure table to skip ahead on a mismatch instead of restarting">
  <style>
    .stm { font: 600 12px var(--font-mono); fill: var(--text); }
    .stc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .m { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .x { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <text x="14" y="24" class="stc">On a mismatch, naive restarts one position over (slow). KMP jumps using the LPS table:</text>
  <g class="stm">
    <rect x="60" y="40" width="26" height="26" class="m"/><text x="68" y="58">a</text>
    <rect x="86" y="40" width="26" height="26" class="m"/><text x="94" y="58">b</text>
    <rect x="112" y="40" width="26" height="26" class="m"/><text x="120" y="58">a</text>
    <rect x="138" y="40" width="26" height="26" class="x"/><text x="146" y="58">x</text>
  </g>
  <text x="180" y="58" class="stc">mismatch here → LPS says "the 'a' prefix still matched,"</text>
  <text x="180" y="76" class="stc">so resume comparing there — text pointer never moves back.</text>
  <text x="14" y="115" class="stc" fill="var(--green)">Result: each text character is examined at most a constant number of times → O(n + m).</text>
</svg>
<figcaption>KMP's failure table lets it skip ahead on mismatch without ever re-reading text characters — O(n+m).</figcaption>
</figure>

> [!key] Why KMP is O(n + m)
> The magic is that the text pointer `i` **never moves backward**. When a mismatch happens, KMP consults the precomputed LPS table to slide the *pattern* forward by the right amount, reusing knowledge of what already matched. Each text character is looked at a constant number of times, giving O(n) for the search plus O(m) to build the table — versus the naive O(n·m). The one-time preprocessing pays for itself many times over.

## Rabin-Karp: matching by hashing

**Rabin-Karp** takes a different tack: compute a **hash** of the pattern and of each window of the text, and compare hashes (cheap) instead of characters (expensive). The trick is a **rolling hash** that updates in O(1) as the window slides — remove the leaving character's contribution, add the entering one:

```text
Rabin-Karp outline:
  pattern_hash = hash(pattern)
  window_hash  = hash(text[0..m])
  for each position:
      if window_hash == pattern_hash:
          verify character-by-character (hashes can collide)
      roll the hash forward one position in O(1)
```

Average case is **O(n + m)**; it shines for **multiple-pattern** search (hash many patterns, one text pass) and plagiarism/fingerprinting. The catch is hash *collisions*, so a match must be verified. Here it is for real:

```rust
/// Rabin-Karp using a polynomial rolling hash. Average O(n + m).
fn rabin_karp(text: &str, pattern: &str) -> Vec<usize> {
    // Bytes, not chars: a rolling hash needs fixed-width units.
    let t: Vec<u8> = text.bytes().collect();
    let p: Vec<u8> = pattern.bytes().collect();
    let (n, m) = (t.len(), p.len());
    if m == 0 || m > n {
        return Vec::new();
    }

    const BASE: u64 = 256;
    const MOD: u64 = 1_000_000_007; // prime, and small enough that BASE*MOD can't overflow u64

    // BASE^(m-1) mod MOD — the weight of the character leaving the window.
    let mut leading = 1u64;
    for _ in 1..m {
        leading = leading * BASE % MOD;
    }

    let hash = |bytes: &[u8]| bytes.iter().fold(0u64, |h, &b| (h * BASE + b as u64) % MOD);
    let target = hash(&p);
    let mut window = hash(&t[..m]);

    let mut matches = Vec::new();
    for start in 0..=(n - m) {
        if window == target {
            // Hashes can collide, so a hit MUST be verified.
            if t[start..start + m] == p[..] {
                matches.push(start);
            }
        }
        if start + m < n {
            // Roll in O(1): remove the leaving byte, shift up, add the entering byte.
            window = (window + MOD - t[start] as u64 * leading % MOD) % MOD;
            window = (window * BASE + t[start + m] as u64) % MOD;
        }
    }
    matches
}

fn main() {
    for (text, pattern) in [
        ("abababab", "abab"),
        ("hello world", "o w"),
        ("aaaaa", "aa"),
        ("abc", "xyz"),
    ] {
        println!("{pattern:?} in {text:?} → {:?}", rabin_karp(text, pattern));
    }
}
```

> [!warning] A hash match is a *hint*, never a conclusion
> The verification step (`t[start..start+m] == p[..]`) is not optional. Different strings can hash to the same value, so skipping it gives false positives — and on a modest 32-bit hash over a large text, collisions are not hypothetical. That's why Rabin-Karp is **O(n+m) average** rather than worst case: an adversary who knows your `BASE` and `MOD` can craft input where every window collides, forcing a full verification each time and degrading to O(n·m).
>
> Two practical notes. Choose `MOD` prime and small enough that `window * BASE + byte` can't overflow — with `BASE = 256` and `MOD ≈ 10⁹`, a `u64` has ample room. And hash **bytes rather than `char`s**: a rolling hash needs fixed-width units, and Rust's `char` is 4 bytes of variable-width UTF-8 in the source text, which makes the arithmetic wrong as well as slow.

> [!key] The rolling hash is the reusable idea here
> Rabin-Karp itself is rarely the best substring search — `str::find` beats it. But the **rolling hash** is genuinely useful on its own: it gives you an O(1) "fingerprint of a sliding window", which powers content-defined chunking in deduplicating backup tools (`rsync`, `restic`), plagiarism detection, near-duplicate detection over shingles, and the fast paths of several competitive-programming string techniques. Learn the technique, not just the search.

## Manacher's algorithm: longest palindrome in O(n)

Finding the longest palindromic substring looks like it needs O(n²) — try every centre and expand. **Manacher's algorithm** does it in O(n) by reusing what earlier centres already proved.

```rust
/// Longest palindromic substring in O(n).
fn longest_palindrome(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.is_empty() {
        return String::new();
    }

    // Interleave a separator so even- and odd-length palindromes are uniform:
    // "aba" → "\0a\0b\0a\0". Every palindrome now has an odd length.
    let mut t: Vec<char> = Vec::with_capacity(2 * chars.len() + 1);
    t.push('\u{0}');
    for &c in &chars {
        t.push(c);
        t.push('\u{0}');
    }

    let n = t.len();
    let mut radius = vec![0usize; n]; // radius[i] = palindrome radius around i
    let (mut centre, mut right) = (0usize, 0usize); // rightmost palindrome found

    for i in 0..n {
        if i < right {
            // i sits inside a known palindrome, so its mirror's radius is a
            // free lower bound — this is what removes the quadratic factor.
            let mirror = 2 * centre - i;
            radius[i] = radius[mirror].min(right - i);
        }
        // Expand outward from whatever we already knew.
        while i >= radius[i] + 1
            && i + radius[i] + 1 < n
            && t[i - radius[i] - 1] == t[i + radius[i] + 1]
        {
            radius[i] += 1;
        }
        if i + radius[i] > right {
            centre = i;
            right = i + radius[i];
        }
    }

    let (best_len, best_centre) = radius
        .iter()
        .enumerate()
        .map(|(i, &r)| (r, i))
        .max()
        .expect("non-empty");
    // Map back from the padded string to the original indices.
    let start = (best_centre - best_len) / 2;
    chars[start..start + best_len].iter().collect()
}

/// The obvious O(n³) version, to check against.
fn brute_force(s: &str) -> String {
    let c: Vec<char> = s.chars().collect();
    let mut best = String::new();
    for i in 0..c.len() {
        for j in i..c.len() {
            let sub = &c[i..=j];
            let is_palindrome = sub.iter().eq(sub.iter().rev());
            if is_palindrome && sub.len() > best.chars().count() {
                best = sub.iter().collect();
            }
        }
    }
    best
}

fn main() {
    for s in ["babad", "cbbd", "forgeeksskeegfor", "a", "", "abcde", "aaaa"] {
        let fast = longest_palindrome(s);
        let slow = brute_force(s);
        println!("{:>18?} → {:>12?}   (brute {:>12?}) {}", s, fast, slow,
            if fast.chars().count() == slow.chars().count() { "✓" } else { "✗" });
    }
    println!("\nTies are legitimate: \"babad\" contains both \"bab\" and \"aba\".");
}
```

> [!key] Two tricks, and the second one is the algorithm
> **The separator trick** removes an annoying special case. Palindromes come in odd (`aba`) and even (`abba`) lengths, needing different centre handling. Interleaving a character that appears nowhere in the input makes every palindrome odd-length, so one loop covers both — the padded `\0a\0b\0b\0a\0` has an odd palindrome centred on the middle `\0`.
>
> **The mirror trick** is where the linear time comes from. If `i` lies inside a palindrome already known to extend to `right`, then the text around `i` mirrors the text around `2*centre - i`. So `radius[mirror]` is a *free lower bound* on `radius[i]` — you skip straight to it and only expand beyond. Since `right` never decreases and each expansion step advances it, the total expansion work across the whole scan is O(n).

## Naive versus KMP, measured

The chapter claims naive search is O(n·m) and KMP is O(n+m). On the worst-case input the difference is easy to see by counting comparisons:

| text length | pattern | naive comparisons | KMP comparisons | ratio |
|---|---|---|---|---|
| 1,000 | 50 | 47,550 | 2,048 | 23× |
| 4,000 | 50 | 197,550 | 8,048 | 25× |
| 16,000 | 50 | 797,550 | 32,048 | 25× |
| 64,000 | 50 | 3,197,550 | 128,048 | 25× |

> [!performance] The ratio settles at about m/2 — and that's the point
> Searching for `"aaa…ab"` (50 characters) inside `"aaa…a"`, the naive algorithm matches 49 characters at every position before failing on the last, so it does roughly `n·m` work. KMP's LPS table tells it exactly how far to slide, so it does roughly `n + m`. The measured ratio holds steady at ~25 — which is `m/2`, independent of `n`.
>
> Note what that means: the advantage scales with **pattern length**, not text length. For short patterns the constant factors dominate and `str::find` — which uses a tuned two-way algorithm with SIMD-friendly memory scanning — beats a hand-written KMP comfortably. KMP earns its place when patterns are long, when you need a *guaranteed* linear bound against adversarial input, or when you want the LPS table for its own sake (it also solves "shortest repeating unit" and periodicity questions).

## Choosing a string algorithm

| Algorithm | Time | Best for |
|-----------|------|----------|
| Naive | O(n·m) | tiny inputs, one-off checks |
| **KMP** | O(n + m) | single-pattern search, guaranteed linear |
| **Rabin-Karp** | O(n + m) avg | multiple patterns, fingerprinting |
| `str::find` / `contains` | optimized | **real code** — use the standard library! |

> [!best] In real Rust, use `str::find` and the `regex` crate
> Rust's standard library `str::find`, `str::contains`, and `str::matches` are highly optimized (using efficient substring-search algorithms internally) — **use them for ordinary substring search**. For complex patterns, the [`regex`](#/ch/regex) crate is fast and safe. Implement KMP/Rabin-Karp to *understand* the theory (and for the occasional specialized need like a custom rolling hash), but don't hand-roll string matching in production when `str::find` and `regex` exist.

> [!tip] Other string structures worth knowing
> Beyond matching: **[tries](#/ch/dsa-tries)** for prefix queries and multi-word dictionaries; **suffix arrays** and **suffix trees** for advanced substring problems (all substrings, longest repeated substring); the **Z-algorithm** and **Aho-Corasick** (multi-pattern matching in one pass). These power search engines, bioinformatics, and text editors. Reach for a crate (`aho-corasick`, `suffix`) rather than implementing them from scratch.

## Summary

- Substring search is **O(n·m)** naively (re-checking characters), but **O(n + m)** with smarter algorithms. Measured on the worst case: **3,197,550 comparisons vs 128,048** — a ratio of `m/2`, independent of text length.
- **KMP** precomputes a **failure (LPS) table** so its text pointer never moves backward — guaranteed linear single-pattern search.
- **Rabin-Karp** compares **rolling hashes** instead of characters (O(1) window updates). A hash match is a *hint* — **always verify**, or you get false positives and an adversary can force O(n·m).
- Hash **bytes, not `char`s** — a rolling hash needs fixed-width units.
- The **rolling hash** is the transferable idea: it powers deduplicating backup tools, plagiarism detection, and near-duplicate search.
- **Manacher** finds the longest palindromic substring in **O(n)** using two tricks: a **separator** so every palindrome is odd-length, and a **mirror** giving each centre a free lower bound from an earlier one.
- In real code, use **`str::find`/`contains`** and the **`regex`** crate — they beat hand-written KMP for short patterns. KMP earns its place for long patterns, guaranteed bounds, or when you want the LPS table itself.
- For richer needs, know tries, suffix arrays/trees, and Aho-Corasick (via crates).

> [!exercise] Try it yourself
> 1. Trace `kmp_search("aaaaa", "aa")` by hand and confirm the LPS table is `[0, 1]` and the matches are `[0,1,2,3]`.
> 2. Remove the verification step from `rabin_karp` and construct two strings that hash identically under `BASE = 256, MOD = 101`. How many false positives do you get?
> 3. Reproduce the comparison-count table above, then vary the pattern length. Confirm the ratio tracks `m/2`.
> 4. Extend `rabin_karp` to search for **several** patterns of the same length in one pass. What do you store, and why is this Rabin-Karp's real strength?
> 5. Remove the separator padding from Manacher and try `"abba"`. What breaks, and why does the padding fix it?
> 6. Modify Manacher to return **all** maximal palindromes, not just the longest.
> 7. Use the LPS table on its own to find the **shortest repeating unit** of a string (`"abcabcabc"` → `"abc"`). What does `lps[n-1]` tell you?
> 8. Time `kmp_search` against `str::find` on a short pattern in a large text. Which wins, and does that match the callout above?

Next, a technique that operates at the level of individual bits — compact, fast, and surprisingly powerful: **bit manipulation**.
