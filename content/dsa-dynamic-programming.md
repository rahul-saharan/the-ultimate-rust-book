<h1><span class="h1-kicker">Data Structures & Algorithms</span>Dynamic Programming</h1>

**Dynamic programming (DP)** is the technique that intimidates people most — and it needn't. The core idea is simple: when a problem breaks into overlapping subproblems, **solve each subproblem once and remember the answer** instead of recomputing it. That single trick turns exponential algorithms into polynomial ones. This chapter demystifies DP with the classic problems, in Rust.

## The core idea: don't repeat work

Consider the naive recursive Fibonacci — it's beautiful and *catastrophically slow*, because it recomputes the same values exponentially many times:

```rust
// Naive: O(2^n) — recomputes fib(n-2), fib(n-3)... over and over.
fn fib_slow(n: u64) -> u64 {
    if n < 2 { n } else { fib_slow(n - 1) + fib_slow(n - 2) }
}

fn main() {
    println!("{}", fib_slow(30)); // works, but fib_slow(50) would take ages
}
```

`fib_slow(30)` computes `fib(28)` twice, `fib(27)` three times, `fib(26)` five times… an exponential explosion of *repeated* work.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="The Fibonacci recursion tree recomputes the same subproblems many times">
  <style>
    .dpm { font: 600 10px var(--font-mono); fill: #fff; }
    .dpc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .dpn { fill: var(--rust-500); stroke: var(--rust-700); stroke-width: 1.2; }
    .dup { fill: var(--red); stroke: var(--red); stroke-width: 1.5; }
  </style>
  <circle cx="320" cy="20" r="13" class="dpn"/><text x="311" y="24" class="dpm">f(5)</text>
  <circle cx="220" cy="60" r="13" class="dpn"/><text x="211" y="64" class="dpm">f(4)</text>
  <circle cx="420" cy="60" r="13" class="dup"/><text x="411" y="64" class="dpm">f(3)</text>
  <circle cx="150" cy="100" r="13" class="dup"/><text x="141" y="104" class="dpm">f(3)</text>
  <circle cx="290" cy="100" r="13" class="dup"/><text x="281" y="104" class="dpm">f(2)</text>
  <circle cx="380" cy="100" r="13" class="dup"/><text x="371" y="104" class="dpm">f(2)</text>
  <circle cx="460" cy="100" r="13" class="dpn"/><text x="451" y="104" class="dpm">f(1)</text>
  <line x1="310" y1="30" x2="230" y2="52" stroke="var(--text-mute)"/><line x1="330" y1="30" x2="410" y2="52" stroke="var(--text-mute)"/>
  <line x1="210" y1="70" x2="160" y2="90" stroke="var(--text-mute)"/><line x1="230" y1="70" x2="285" y2="90" stroke="var(--text-mute)"/>
  <line x1="412" y1="70" x2="385" y2="90" stroke="var(--text-mute)"/><line x1="428" y1="70" x2="455" y2="90" stroke="var(--text-mute)"/>
  <text x="120" y="140" class="dpc" fill="var(--red)">Red nodes = recomputed subproblems (wasted work). DP computes each ONCE.</text>
</svg>
<figcaption>Naive recursion recomputes the same subproblems (red) exponentially often; DP computes each exactly once.</figcaption>
</figure>

## The two DP styles

> [!key] Memoization (top-down) vs. tabulation (bottom-up)
> DP has two equivalent flavors:
> - **Memoization (top-down)**: keep the natural recursion, but **cache** each result so you never recompute it. Add a "have I solved this already?" check.
> - **Tabulation (bottom-up)**: solve the *smallest* subproblems first and fill a **table**, building up to the answer with loops — no recursion.
>
> Both turn exponential into polynomial. Memoization is closer to your original recursive thinking; tabulation is often faster (no recursion overhead) and avoids stack-overflow risk. Use whichever is clearer for the problem.

Here's Fibonacci both ways — now O(n):

```rust
use std::collections::HashMap;

// Top-down: recursion + a cache.
fn fib_memo(n: u64, cache: &mut HashMap<u64, u64>) -> u64 {
    if n < 2 { return n; }
    if let Some(&cached) = cache.get(&n) {
        return cached; // already computed — reuse it
    }
    let result = fib_memo(n - 1, cache) + fib_memo(n - 2, cache);
    cache.insert(n, result);
    result
}

// Bottom-up: fill a table from the base cases upward.
fn fib_tab(n: usize) -> u64 {
    if n < 2 { return n as u64; }
    let mut dp = vec![0u64; n + 1];
    dp[1] = 1;
    for i in 2..=n {
        dp[i] = dp[i - 1] + dp[i - 2]; // each depends only on earlier entries
    }
    dp[n]
}

fn main() {
    println!("memo: {}", fib_memo(50, &mut HashMap::new())); // instant now
    println!("tab:  {}", fib_tab(50));
}
```

## When DP applies

> [!key] The two signatures of a DP problem
> A problem is solvable by DP when it has:
> 1. **Optimal substructure** — the optimal answer is built from optimal answers to subproblems.
> 2. **Overlapping subproblems** — the *same* subproblems recur many times (so caching pays off).
>
> Fibonacci has both. So do coin change, longest common subsequence, edit distance, knapsack, and many others. If subproblems *don't* overlap (each is distinct), plain [divide-and-conquer](#/ch/dsa-divide-conquer) suffices — DP's caching only helps when work repeats.

## Classic DP: coin change (min coins)

Unlike the [greedy](#/ch/dsa-greedy) version that fails on odd coin systems, DP finds the true minimum for *any* coins. `dp[amount]` = fewest coins to make `amount`:

```rust
fn coin_change(coins: &[u32], amount: u32) -> Option<u32> {
    let amount = amount as usize;
    let mut dp = vec![u32::MAX; amount + 1];
    dp[0] = 0; // zero coins to make amount 0

    for target in 1..=amount {
        for &coin in coins {
            let coin = coin as usize;
            if coin <= target && dp[target - coin] != u32::MAX {
                dp[target] = dp[target].min(dp[target - coin] + 1);
            }
        }
    }
    (dp[amount] != u32::MAX).then_some(dp[amount])
}

fn main() {
    println!("{:?}", coin_change(&[1, 5, 10, 25], 63)); // Some(6): 25+25+10+1+1+1
    println!("{:?}", coin_change(&[4, 3, 1], 6));         // Some(2): 3+3 (greedy got 3!)
    println!("{:?}", coin_change(&[5], 3));               // None (impossible)
}
```

Notice DP gets `6 = 3+3` (2 coins) where greedy wrongly took `4+1+1` (3 coins).

## Classic DP: longest common subsequence

The **LCS** of two strings is the longest sequence of characters appearing (in order) in both — the basis of `diff` tools and DNA analysis. A 2D table captures it:

```rust
fn lcs_length(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    // dp[i][j] = LCS length of a[..i] and b[..j]
    let mut dp = vec![vec![0usize; b.len() + 1]; a.len() + 1];

    for i in 1..=a.len() {
        for j in 1..=b.len() {
            dp[i][j] = if a[i - 1] == b[j - 1] {
                dp[i - 1][j - 1] + 1                 // chars match → extend the LCS
            } else {
                dp[i - 1][j].max(dp[i][j - 1])        // skip one char from either
            };
        }
    }
    dp[a.len()][b.len()]
}

fn main() {
    println!("{}", lcs_length("ABCBDAB", "BDCAB")); // 4 (e.g. "BCAB")
    println!("{}", lcs_length("hello", "world"));    // 1 (the 'l' or 'o')
}
```

## The DP recipe

> [!best] How to solve a DP problem
> 1. **Define the state**: what does `dp[i]` (or `dp[i][j]`) *mean*? (e.g. "min coins for amount i".) This is the hardest and most important step.
> 2. **Find the recurrence**: how does a state relate to *smaller* states? (e.g. `dp[t] = min over coins of dp[t-coin] + 1`.)
> 3. **Set the base cases**: the smallest states you know directly (`dp[0] = 0`).
> 4. **Choose an order**: fill the table so each state's dependencies are computed first (bottom-up), or memoize (top-down).
> 5. **Read off the answer** from the final state.
>
> Get the *state definition* right and the recurrence usually follows. This recipe unlocks the whole family: knapsack, edit distance, matrix-chain, longest increasing subsequence, and countless interview problems.

## Summary

- **Dynamic programming** solves problems with **overlapping subproblems** by computing each subproblem **once** and reusing the result — turning exponential into polynomial.
- Two styles: **memoization** (top-down recursion + cache) and **tabulation** (bottom-up table + loops); both are O(n) for Fibonacci.
- DP applies when a problem has **optimal substructure** *and* **overlapping subproblems** (otherwise use divide-and-conquer or greedy).
- Classics: **coin change** (min coins — correct where greedy fails), **longest common subsequence** (diff/DNA), knapsack, edit distance.
- The recipe: **define the state → find the recurrence → set base cases → order the fill → read the answer.**

> [!exercise] Try it yourself
> 1. Write a DP for the number of distinct ways to climb `n` stairs taking 1 or 2 steps (hint: it's Fibonacci!).
> 2. Extend `coin_change` to also return *which* coins were used (track choices).
> 3. Implement "edit distance" (min insert/delete/replace to turn string A into B) — a close cousin of LCS.

Next, a family of problems on text where clever preprocessing beats brute force — **string algorithms**.
