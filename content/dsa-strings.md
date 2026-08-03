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

Average case is **O(n + m)**; it shines for **multiple-pattern** search (hash many patterns, one text pass) and plagiarism/fingerprinting. The catch is hash *collisions*, so a match must be verified.

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

- Substring search is **O(n·m)** naively (re-checking characters), but **O(n + m)** with smarter algorithms.
- **KMP** precomputes a **failure (LPS) table** so its text pointer never moves backward — guaranteed linear single-pattern search.
- **Rabin-Karp** compares **rolling hashes** instead of characters (O(1) window updates), excelling at **multiple-pattern** and fingerprinting tasks (verify matches to handle collisions).
- In real code, use **`str::find`/`contains`** and the **`regex`** crate; implement KMP/Rabin-Karp to learn the ideas.
- For richer needs, know tries, suffix arrays/trees, and Aho-Corasick (via crates).

> [!exercise] Try it yourself
> 1. Trace `kmp_search("aaaaa", "aa")` by hand and confirm the LPS table is `[0, 1]` and the matches are `[0,1,2,3]`.
> 2. Implement a simple rolling hash and use it to find a pattern (verify on hash-match).
> 3. Compare `naive_search` and `kmp_search` on a worst-case input like `"aaaa...aab"` searching `"aaaab"` and reason about the difference.

Next, a technique that operates at the level of individual bits — compact, fast, and surprisingly powerful: **bit manipulation**.
