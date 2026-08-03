<h1><span class="h1-kicker">Data Structures & Algorithms</span>Greedy Algorithms</h1>

A **greedy algorithm** builds a solution step by step, always making the choice that looks best *right now* — the locally optimal move — hoping it leads to a globally optimal answer. When it works, it's wonderfully simple and fast. The catch: it *doesn't always work*, and knowing when a greedy choice is safe is the real skill. [Kruskal's MST](#/ch/dsa-mst) and [Dijkstra](#/ch/dsa-shortest-path) are greedy; this chapter makes the strategy explicit.

## The greedy strategy

> [!key] Greedy = commit to the best local choice, never reconsider
> A greedy algorithm makes a sequence of choices, each the best available *at that moment*, and **never backtracks**. This makes it fast (often O(n log n), dominated by a sort) and simple. But because it commits without looking ahead, it's only correct when the problem has the **greedy-choice property**: a locally optimal choice is always part of *some* globally optimal solution. Proving that property (or knowing it holds) is what separates a correct greedy algorithm from a plausible-but-wrong one.

## A greedy success: activity selection

Given activities with start and end times, select the maximum number that don't overlap. The greedy insight: **always pick the activity that finishes earliest** — it leaves the most room for the rest.

```rust
// Select the maximum number of non-overlapping intervals.
fn max_activities(mut intervals: Vec<(u32, u32)>) -> usize {
    // Greedy choice: sort by END time, then take each that starts after the last chosen ends.
    intervals.sort_by_key(|&(_start, end)| end);

    let mut count = 0;
    let mut last_end = 0;
    for (start, end) in intervals {
        if start >= last_end {
            count += 1;      // this activity fits — take it
            last_end = end;
        }
    }
    count
}

fn main() {
    // (start, end) pairs:
    let activities = vec![(1, 3), (2, 4), (3, 5), (5, 7)];
    println!("{}", max_activities(activities)); // 3 → (1,3), (3,5), (5,7)
}
```

Sorting by *earliest finish* is the greedy choice, and for this problem it's provably optimal — finishing earliest maximizes the remaining time for other activities.

<figure class="diagram">
<svg viewBox="0 0 640 140" role="img" aria-label="Activity selection: sorting by end time and greedily picking non-overlapping activities">
  <style>
    .grm2 { font: 600 11px var(--font-mono); fill: var(--text); }
    .grc2 { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pick { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .skip2 { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 4 3; }
  </style>
  <text x="14" y="22" class="grc2">Timeline (chosen = green):</text>
  <rect x="60" y="34" width="100" height="20" class="pick"/><text x="95" y="49" class="grm2">(1,3)</text>
  <rect x="110" y="60" width="100" height="20" class="skip2"/><text x="140" y="75" class="grc2">(2,4) skip</text>
  <rect x="160" y="86" width="100" height="20" class="pick"/><text x="195" y="101" class="grm2">(3,5)</text>
  <rect x="260" y="112" width="100" height="20" class="pick"/><text x="295" y="127" class="grm2">(5,7)</text>
  <text x="380" y="70" class="grc2">Pick earliest-finishing that</text>
  <text x="380" y="88" class="grc2">starts after the last one ends.</text>
</svg>
<figcaption>Activity selection: sort by end time, greedily take each activity that fits — provably optimal.</figcaption>
</figure>

## When greedy works — and when it fails

The danger of greedy is that it *feels* right even when it's wrong. Coin change is the classic cautionary tale:

```rust
// Greedy coin change: always take the largest coin that fits.
fn greedy_coins(mut amount: u32, coins: &[u32]) -> u32 {
    let mut count = 0;
    for &coin in coins { // assumes coins sorted descending
        count += amount / coin;
        amount %= coin;
    }
    count
}

fn main() {
    // With "canonical" coin systems (like US coins), greedy IS optimal:
    println!("{}", greedy_coins(63, &[25, 10, 5, 1])); // 6 coins ✅ (25+25+10+1+1+1)

    // But with an odd system, greedy FAILS:
    // amount 6 with coins [4, 3, 1]: greedy gives 4+1+1 = 3 coins,
    // but the optimal is 3+3 = 2 coins!
    println!("{}", greedy_coins(6, &[4, 3, 1])); // 3 — WRONG (optimal is 2)
}
```

> [!mistake] Greedy is not always optimal — prove it or test it
> For US coins (`[25,10,5,1]`), grabbing the biggest coin each time is optimal. But for coins `[4,3,1]` making 6, greedy takes `4+1+1` (three coins) when `3+3` (two coins) is better. **Greedy failed.** The lesson: a greedy approach that *seems* obvious can be wrong. Before trusting it, either prove the greedy-choice property holds, or verify against known cases (and consider whether [dynamic programming](#/ch/dsa-dynamic-programming) — which *does* solve coin change optimally for any system — is needed instead).

## Classic greedy algorithms that DO work

> [!key] Provably-correct greedy algorithms
> These are greedy and always optimal (the greedy-choice property is proven):
> - **Activity selection** (earliest finish first) — shown above.
> - **[Kruskal's & Prim's MST](#/ch/dsa-mst)** — cheapest safe edge each step.
> - **[Dijkstra's shortest path](#/ch/dsa-shortest-path)** — settle the nearest node each step (needs non-negative weights).
> - **Huffman coding** — repeatedly merge the two least-frequent symbols (optimal prefix codes for compression).
> - **Fractional knapsack** — take items by best value/weight ratio (unlike the 0/1 knapsack, which needs DP).
>
> The pattern in each: there's a *safe* greedy choice provably part of an optimal solution.

## Greedy vs. dynamic programming

> [!best] How to tell greedy from DP
> Both build solutions from subproblems, but:
> - **Greedy** commits to one choice at each step and never reconsiders — fast, but only correct when the greedy-choice property holds.
> - **[Dynamic programming](#/ch/dsa-dynamic-programming)** considers *all* choices at each step and remembers subproblem results — slower, but correct whenever there's *optimal substructure*.
>
> Rule of thumb: **try greedy first** (it's simpler); if you can find a counterexample where a locally optimal choice leads to a globally worse answer (like coin change with `[4,3,1]`), fall back to DP. When in doubt, DP is the safe hammer.

## Summary

- A **greedy algorithm** makes the locally best choice at each step and never backtracks — simple and fast (often O(n log n)).
- It's correct **only** when the **greedy-choice property** holds (a local optimum is part of a global optimum) — otherwise it silently gives wrong answers (e.g. coin change with `[4,3,1]`).
- Proven-correct greedy algorithms: **activity selection**, **Kruskal/Prim MST**, **Dijkstra**, **Huffman coding**, **fractional knapsack**.
- **Try greedy first**; if a counterexample exists, use **dynamic programming** instead.

> [!exercise] Try it yourself
> 1. Find a set of coins and an amount where `greedy_coins` gives a non-optimal answer (like the `[4,3,1]` case), and compute the true optimum by hand.
> 2. Implement "maximum meetings in one room" using the activity-selection greedy.
> 3. Explain in one sentence why Dijkstra is greedy and why it needs non-negative edge weights for that greed to be safe.

When greedy fails because choices interact, the answer is to remember and reuse subproblem results — **dynamic programming**, next.
