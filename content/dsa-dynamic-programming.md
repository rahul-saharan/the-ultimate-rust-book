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

## Classic DP: 0/1 knapsack

The archetypal DP, and the problem where [greedy provably fails](#/ch/dsa-greedy). Given items with a value and a weight, maximise value within a capacity, taking each item at most once.

```rust
/// dp[i][c] = best value using the first i items within capacity c.
fn knapsack_2d(items: &[(u32, u32)], capacity: usize) -> u32 {
    let mut dp = vec![vec![0u32; capacity + 1]; items.len() + 1];

    for i in 1..=items.len() {
        let (value, weight) = items[i - 1];
        for c in 0..=capacity {
            dp[i][c] = dp[i - 1][c]; // option 1: skip this item
            if weight as usize <= c {
                // option 2: take it, and add the best for the remaining capacity
                dp[i][c] = dp[i][c].max(dp[i - 1][c - weight as usize] + value);
            }
        }
    }
    dp[items.len()][capacity]
}

/// The same answer in O(capacity) space, by rolling the row in place.
/// The reversed inner loop is essential — see the warning below.
fn knapsack_1d(items: &[(u32, u32)], capacity: usize) -> u32 {
    let mut dp = vec![0u32; capacity + 1];
    for &(value, weight) in items {
        let w = weight as usize;
        for c in (w..=capacity).rev() {
            dp[c] = dp[c].max(dp[c - w] + value);
        }
    }
    dp[capacity]
}

/// The same code with a FORWARD loop. It compiles, runs, and solves a
/// different problem: the UNBOUNDED knapsack, where items can be reused.
fn knapsack_1d_forward(items: &[(u32, u32)], capacity: usize) -> u32 {
    let mut dp = vec![0u32; capacity + 1];
    for &(value, weight) in items {
        let w = weight as usize;
        for c in w..=capacity {
            dp[c] = dp[c].max(dp[c - w] + value);
        }
    }
    dp[capacity]
}

/// Which items were chosen? Walk the 2D table backwards.
fn knapsack_with_items(items: &[(u32, u32)], capacity: usize) -> (u32, Vec<usize>) {
    let mut dp = vec![vec![0u32; capacity + 1]; items.len() + 1];
    for i in 1..=items.len() {
        let (value, weight) = items[i - 1];
        for c in 0..=capacity {
            dp[i][c] = dp[i - 1][c];
            if weight as usize <= c {
                dp[i][c] = dp[i][c].max(dp[i - 1][c - weight as usize] + value);
            }
        }
    }

    // Reconstruct: if dp[i][c] differs from dp[i-1][c], item i must have been taken.
    let mut chosen = Vec::new();
    let mut c = capacity;
    for i in (1..=items.len()).rev() {
        if dp[i][c] != dp[i - 1][c] {
            chosen.push(i - 1);
            c -= items[i - 1].1 as usize;
        }
    }
    chosen.reverse();
    (dp[items.len()][capacity], chosen)
}

fn main() {
    let items = [(60u32, 10u32), (100, 20), (120, 30)]; // (value, weight)

    println!("2D table      {}", knapsack_2d(&items, 50));
    println!("1D rolling    {}   ← same answer, O(capacity) space", knapsack_1d(&items, 50));
    println!("forward loop  {}   ← WRONG for 0/1: it reused the first item 5×",
        knapsack_1d_forward(&items, 50));

    let (best, chosen) = knapsack_with_items(&items, 50);
    println!("\nbest {best} from items {chosen:?} = {:?}",
        chosen.iter().map(|&i| items[i]).collect::<Vec<_>>());
    println!("(note it skips the BEST ratio item — greedy scores only 160 here)");
}
```

> [!warning] The reversed loop is what makes 1D knapsack correct
> This is the most famous subtle bug in dynamic programming, and the run above shows it plainly: the forward loop returns **300** instead of **220**.
>
> The 1D array is a compressed 2D table where `dp[c]` holds *the previous row* until you overwrite it. Iterating capacity **downward** means `dp[c - w]` hasn't been touched yet this round, so it still refers to the previous row — "best without this item". Iterating **upward**, `dp[c - w]` may already include the current item, so you can take it again, and again: `60/10` gets used five times for 300.
>
> The infuriating part is that the forward version isn't broken code — it's a correct solution to the **unbounded knapsack** (items reusable). Two problems, one array, and a loop direction as the only difference. Whenever you compress a DP to fewer dimensions, the iteration order stops being a style choice and becomes part of the algorithm.

> [!best] Reconstructing the choices, not just the score
> DP naturally computes the *value* of the best solution while discarding which choices produced it. Two ways to recover them: keep the full 2D table and **walk it backwards** (as above — if `dp[i][c] != dp[i-1][c]`, item `i` was taken), or store a parallel `choice[i][c]` array during the fill.
>
> This is the trade-off that decides whether you can use the 1D optimisation: rolling the array away destroys the history, so **space optimisation and reconstruction are mutually exclusive**. If you need the actual answer rather than its score, keep the table.

## Classic DP: edit distance

Edit distance (Levenshtein) is LCS's close cousin, and the engine behind spell-checkers, fuzzy search, and `diff`. `dp[i][j]` is the cheapest way to turn the first `i` characters of `a` into the first `j` of `b`:

```rust
fn edit_distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut dp = vec![vec![0usize; b.len() + 1]; a.len() + 1];

    // Base cases: turning a prefix into "" costs one deletion per character.
    for i in 0..=a.len() {
        dp[i][0] = i;
    }
    for j in 0..=b.len() {
        dp[0][j] = j;
    }

    for i in 1..=a.len() {
        for j in 1..=b.len() {
            dp[i][j] = if a[i - 1] == b[j - 1] {
                dp[i - 1][j - 1] // characters match — nothing to pay
            } else {
                // 1 + the cheapest of: replace, delete from a, insert into a
                1 + dp[i - 1][j - 1].min(dp[i - 1][j]).min(dp[i][j - 1])
            };
        }
    }
    dp[a.len()][b.len()]
}

fn main() {
    println!("kitten → sitting  {}", edit_distance("kitten", "sitting"));
    println!("flaw   → lawn     {}", edit_distance("flaw", "lawn"));
    println!("same   → same     {}", edit_distance("same", "same"));
    println!("\"\"     → abc      {}", edit_distance("", "abc"));
}
```

> [!key] The three neighbours *are* the three edit operations
> Each cell looks at exactly three predecessors, and each corresponds to one operation: `dp[i-1][j-1]` is **replace**, `dp[i-1][j]` is **delete** from `a`, `dp[i][j-1]` is **insert** into `a`. Take the cheapest and add 1 — unless the characters already match, in which case the diagonal costs nothing.
>
> Once you see that a 2D DP's recurrence is "which neighbours can I come from?", most grid DPs become mechanical. LCS uses the same three neighbours with a different rule; so do longest common substring, regular-expression matching, and sequence alignment in bioinformatics.

## Interval DP: matrix chain multiplication

A third shape, where the state is a **range** rather than a prefix. Multiplying an `p×q` matrix by a `q×r` one costs `p·q·r` scalar multiplications, and matrix multiplication is associative — so the *order* you parenthesise a chain in changes the total cost enormously, without changing the result.

```rust
/// Minimum scalar multiplications to multiply a chain of matrices.
/// `dims` has n+1 entries for n matrices: matrix i is dims[i] × dims[i+1].
fn matrix_chain(dims: &[usize]) -> u64 {
    let n = dims.len() - 1; // number of matrices
    if n < 2 {
        return 0;
    }
    // dp[i][j] = cheapest way to multiply matrices i..=j
    let mut dp = vec![vec![0u64; n]; n];

    // Interval LENGTH must be the outer loop: a longer interval depends on
    // shorter ones, so all shorter answers must already exist.
    for len in 2..=n {
        for i in 0..=n - len {
            let j = i + len - 1;
            dp[i][j] = u64::MAX;
            // Try every split point: (i..=k)(k+1..=j)
            for k in i..j {
                let cost = dp[i][k]
                    + dp[k + 1][j]
                    + (dims[i] * dims[k + 1] * dims[j + 1]) as u64;
                dp[i][j] = dp[i][j].min(cost);
            }
        }
    }
    dp[0][n - 1]
}

fn main() {
    // Four matrices: 40×20, 20×30, 30×10, 10×30
    println!("chain [40,20,30,10,30] → {} multiplications", matrix_chain(&[40, 20, 30, 10, 30]));
    println!("chain [10,20,30,40,30] → {}", matrix_chain(&[10, 20, 30, 40, 30]));
    println!("chain [10,20,30]       → {}  (only one way to multiply)", matrix_chain(&[10, 20, 30]));
    println!("\nThe answer is the same matrix either way — only the cost differs.");
}
```

> [!key] Interval DP iterates by *length*, not by index
> This is the structural difference from the prefix DPs above. `dp[i][j]` depends on shorter intervals inside `i..=j`, so you cannot simply loop `i` then `j` — you must loop over interval **length** first, guaranteeing every shorter interval is already solved. Get that wrong and you read uninitialised entries, exactly like [Floyd-Warshall's `k` loop](#/ch/dsa-shortest-path).
>
> The signature of interval DP is "choose a split point inside a range", giving three nested loops and **O(n³)**. It's the shape for optimal binary search trees, burst-balloon problems, palindrome partitioning, and polygon triangulation.

## The shapes of DP

| Pattern | State | Loop order | Complexity | Examples |
|---|---|---|---|---|
| **1D / linear** | `dp[i]` = answer for prefix `i` | forward | O(n·choices) | Fibonacci, coin change, stairs, LIS |
| **2D / grid** | `dp[i][j]` = two prefixes | row by row | O(n·m) | LCS, edit distance, grid paths |
| **Knapsack** | `dp[i][c]` = items × capacity | items outer, capacity **reversed** if 1D | O(n·C) | 0/1 and unbounded knapsack, subset sum |
| **Interval** | `dp[i][j]` = range `i..=j` | by **length** | O(n³) | matrix chain, palindrome partitioning |
| **Tree** | `dp[v]` = subtree at `v` | postorder ([see trees](#/ch/dsa-tree-algorithms)) | O(n) | independent set, subtree sums |
| **Bitmask** | `dp[mask]` = subset used | by popcount or mask value | O(2ⁿ·n) | travelling salesman, assignment |
| **Digit** | `dp[pos][carry/state]` | digit by digit | O(digits·states) | counting numbers with a property |

> [!best] Getting the state right is 90% of the work
> Every one of those rows is the *same* technique; only the state definition differs. So when a DP problem resists you, the issue is almost never the code — it's that the state doesn't capture enough. Two diagnostics:
>
> **Can you compute this state from smaller ones alone?** If you find yourself needing information the state doesn't record ("but I need to know whether I already used an item…"), the state needs another dimension.
>
> **Does the state have overlapping instances?** If every state is reached exactly once, caching buys nothing and you want plain [divide-and-conquer](#/ch/dsa-divide-conquer) instead. That's why memoising N-Queens doesn't help — no two branches ever share a subproblem.

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
- Classics: **coin change**, **LCS**, **0/1 knapsack** (220 where greedy gets 160), **edit distance**, **matrix chain**.
- **Compressing a DP to 1D makes the loop direction part of the algorithm.** Knapsack's capacity loop must run **backwards**; forwards it silently solves the *unbounded* problem instead (300 vs 220).
- **Space optimisation and solution reconstruction are mutually exclusive** — rolling the array away destroys the history you'd walk back through.
- In a 2D DP, the neighbours you read from **are** the operations: diagonal = replace, up = delete, left = insert.
- **Interval DP** iterates by interval **length**, not index, because longer ranges depend on shorter ones.
- Seven recurring shapes — **1D, 2D grid, knapsack, interval, tree, bitmask, digit** — all the same technique with a different state.
- The recipe: **define the state → find the recurrence → set base cases → order the fill → read the answer.** Getting the state right is 90% of the work.

> [!exercise] Try it yourself
> 1. Write a DP for the number of distinct ways to climb `n` stairs taking 1 or 2 steps (hint: it's Fibonacci!).
> 2. Extend `coin_change` to also return *which* coins were used (track choices).
> 3. Reduce `edit_distance` to O(min(m,n)) space with a rolling row. What can you no longer do afterwards?
> 4. Run `knapsack_1d_forward` and work out by hand which item it reused, and how many times, to reach 300.
> 5. Turn `knapsack_1d_forward` into a *deliberate* unbounded-knapsack solver, and check it against a coin-change-style DP.
> 6. Add a `choice` table to `coin_change` so it reports the actual coins. Then try the same with the 1D array and explain why it doesn't work.
> 7. Extend `matrix_chain` to print the optimal **parenthesisation**, not just the cost. (Hint: record the best `k` for each interval.)
> 8. Move `matrix_chain`'s `len` loop inside the `i` loop and find an input where the answer becomes wrong.
> 9. Solve **longest increasing subsequence** in O(n²) with 1D DP, then look up the O(n log n) version using [binary search](#/ch/dsa-searching). Which state definition changes?
> 10. Implement **subset sum** ("is there a subset totalling exactly T?") by changing knapsack's value function. What does `dp[c]` mean now?

Next, a family of problems on text where clever preprocessing beats brute force — **string algorithms**.
