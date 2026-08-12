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

> [!deep] The exchange argument — how greedy proofs actually work
> "Provably optimal" is easy to say, so here's the proof, because the technique generalises to every greedy algorithm.
>
> Let `g` be the activity that finishes earliest, and let `O` be *any* optimal solution. If `O` already contains `g`, we're done. If not, let `f` be the first activity in `O`. Since `g` finishes no later than `f`, swapping `f` for `g` cannot conflict with anything else in `O` — everything after `f` starts after `f` ends, which is at or after when `g` ends. So `O − {f} + {g}` is *also* optimal, and it contains `g`.
>
> That's the **exchange argument**: show that any optimal solution can be transformed into one containing your greedy choice, without getting worse. Apply it repeatedly and the greedy solution is optimal. Every proven greedy algorithm has an argument of this shape — Kruskal's uses the cut property, Huffman's exchanges the two least-frequent symbols. When you *can't* construct such an argument, that's your signal to look for a counterexample instead.

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

Comparing greedy against the optimal answer side by side is the cheapest way to find out whether you can trust it:

```rust
/// Greedy: always take the largest coin that fits. Assumes descending order.
fn coins_greedy(mut amount: u32, coins: &[u32]) -> u32 {
    let mut count = 0;
    for &coin in coins {
        count += amount / coin;
        amount %= coin;
    }
    count
}

/// The optimal answer for ANY coin system, via dynamic programming.
fn coins_optimal(amount: u32, coins: &[u32]) -> Option<u32> {
    let mut best = vec![u32::MAX; amount as usize + 1];
    best[0] = 0;
    for a in 1..=amount as usize {
        for &coin in coins {
            let c = coin as usize;
            if c <= a && best[a - c] != u32::MAX {
                best[a] = best[a].min(best[a - c] + 1);
            }
        }
    }
    (best[amount as usize] != u32::MAX).then_some(best[amount as usize])
}

/// 0/1 knapsack the greedy way: best value-per-weight first, take it or leave it.
fn knapsack_greedy(items: &[(u32, u32)], capacity: u32) -> u32 {
    let mut sorted = items.to_vec();
    sorted.sort_by(|a, b| {
        (b.0 as f64 / b.1 as f64)
            .partial_cmp(&(a.0 as f64 / a.1 as f64))
            .expect("no NaN")
    });
    let (mut remaining, mut total) = (capacity, 0);
    for &(value, weight) in &sorted {
        if weight <= remaining {
            total += value;
            remaining -= weight;
        }
    }
    total
}

/// The same problem solved optimally with DP.
fn knapsack_optimal(items: &[(u32, u32)], capacity: u32) -> u32 {
    let mut best = vec![0u32; capacity as usize + 1];
    for &(value, weight) in items {
        for c in (weight..=capacity).rev() {
            best[c as usize] = best[c as usize].max(best[(c - weight) as usize] + value);
        }
    }
    best[capacity as usize]
}

fn main() {
    println!("coin change — greedy vs optimal:");
    for (amount, coins) in [
        (63u32, vec![25u32, 10, 5, 1]),
        (6, vec![4, 3, 1]),
        (30, vec![25, 10, 1]),
    ] {
        let g = coins_greedy(amount, &coins);
        let o = coins_optimal(amount, &coins).expect("1 is present");
        println!("  {amount:>3} with {coins:?}  greedy {g} | optimal {o}  {}",
            if g == o { "✓" } else { "← GREEDY WRONG" });
    }

    // (value, weight) — the classic textbook instance.
    let items = [(60u32, 10u32), (100, 20), (120, 30)];
    println!("\n0/1 knapsack, capacity 50:");
    println!("  greedy  {}", knapsack_greedy(&items, 50));
    println!("  optimal {}  ← greedy misses by 60", knapsack_optimal(&items, 50));
}
```

> [!warning] `[25, 10, 1]` making 30: greedy needs **twice** the coins
> The `[4,3,1]` example is the one textbooks use, but this is worse. Greedy takes the 25, then five 1s — **six coins**. The optimum is three 10s — **three coins**. Removing the nickel from a currency is enough to break the algorithm entirely.
>
> Worth knowing *why* US coins are safe: a coin system is called **canonical** when greedy is optimal for every amount, and determining whether an arbitrary system is canonical is itself a non-trivial computation. So "greedy works for the coins I tested" generalises far less than it appears to. This is the sharpest available argument for testing a greedy algorithm against a known-optimal one before shipping it.

> [!key] Fractional knapsack is greedy; 0/1 knapsack is not
> These two problems look almost identical and sit on opposite sides of the line.
>
> **Fractional knapsack** lets you take *part* of an item. Sort by value-per-weight, fill greedily, and take a fraction of whatever you hit the capacity on — provably optimal, because any leftover capacity is always best filled with the highest remaining ratio.
>
> **0/1 knapsack** forces take-it-or-leave-it, and greedy breaks. In the run above it scores **160** against the optimum of **220**: it grabs the two best ratios (60/10 and 100/20, filling 30 of 50 units) and then can't fit the 30-weight item, wasting 20 units of capacity. The optimum skips the *best* ratio entirely and takes the 20 and 30 items for 220.
>
> The difference is that indivisibility makes the choices **interact** — what you take now changes which combinations remain feasible. That interaction is precisely what greedy cannot see and [dynamic programming](#/ch/dsa-dynamic-programming) can.

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

### Huffman coding, implemented

Huffman is the most satisfying of these, because the greedy choice is so unobvious: **repeatedly merge the two least-frequent symbols**. Frequent symbols end up near the root with short codes, rare ones deep with long codes.

```rust
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

/// Nodes live in an arena so the heap only has to order (frequency, index) —
/// no `Ord` implementation on the tree itself.
enum Node {
    Leaf(char),
    Internal(usize, usize),
}

fn huffman(freqs: &[(char, u32)]) -> (Vec<Node>, Option<usize>) {
    let mut arena: Vec<Node> = freqs.iter().map(|&(c, _)| Node::Leaf(c)).collect();

    // A min-heap of (frequency, arena index) — Reverse flips BinaryHeap.
    let mut heap: BinaryHeap<Reverse<(u32, usize)>> =
        freqs.iter().enumerate().map(|(i, &(_, f))| Reverse((f, i))).collect();

    while heap.len() > 1 {
        // The greedy choice: the two RAREST symbols get merged, so they sink
        // deepest and receive the longest codes.
        let Reverse((f1, i1)) = heap.pop().expect("len > 1");
        let Reverse((f2, i2)) = heap.pop().expect("len > 1");
        arena.push(Node::Internal(i1, i2));
        heap.push(Reverse((f1 + f2, arena.len() - 1)));
    }

    let root = heap.pop().map(|Reverse((_, i))| i);
    (arena, root)
}

/// Walk the tree assigning 0 for left, 1 for right.
fn build_codes(arena: &[Node], node: usize, prefix: String, out: &mut HashMap<char, String>) {
    match arena[node] {
        Node::Leaf(c) => {
            // A single-symbol alphabet still needs one bit.
            out.insert(c, if prefix.is_empty() { "0".into() } else { prefix });
        }
        Node::Internal(left, right) => {
            build_codes(arena, left, format!("{prefix}0"), out);
            build_codes(arena, right, format!("{prefix}1"), out);
        }
    }
}

fn main() {
    let freqs = [('a', 45u32), ('b', 13), ('c', 12), ('d', 16), ('e', 9), ('f', 5)];

    let (arena, root) = huffman(&freqs);
    let mut codes = HashMap::new();
    build_codes(&arena, root.expect("non-empty alphabet"), String::new(), &mut codes);

    let mut rows: Vec<_> = freqs.iter().map(|&(c, f)| (c, f, codes[&c].clone())).collect();
    rows.sort_by_key(|&(_, f, _)| f);

    println!("{:>5} {:>6} {:>7}", "char", "freq", "code");
    let mut huffman_bits = 0u32;
    for (c, f, code) in &rows {
        println!("{:>5} {:>6} {:>7}", c, f, code);
        huffman_bits += f * code.len() as u32;
    }

    let total: u32 = freqs.iter().map(|&(_, f)| f).sum();
    println!("\nHuffman   {huffman_bits} bits");
    println!("fixed 3-bit {} bits  ({} symbols × 3)", total * 3, total);
    println!("saving      {:.0}%", (1.0 - huffman_bits as f64 / (total * 3) as f64) * 100.0);
    println!("\nNote no code is a prefix of another — that's what makes it decodable.");
}
```

> [!key] Why merging the two rarest symbols is the safe choice
> The exchange argument again. In an optimal prefix code, the two **deepest** leaves must be siblings — otherwise you could move one up and shorten the encoding. And the deepest leaves should hold the *least* frequent symbols, since depth is what you pay per occurrence. So the two rarest symbols can always be placed as siblings at the bottom of *some* optimal tree — which is exactly what merging them does. Recurse on the merged node and the argument repeats.
>
> The resulting code is **prefix-free**: no code is a prefix of another, because every symbol sits at a *leaf*. That's what lets a decoder read a bit stream with no separators and never be ambiguous.

## Greedy at a glance

| Problem | Greedy choice | Optimal? | If not, use |
|---|---|---|---|
| Activity selection | earliest finish time | ✅ | — |
| Kruskal / Prim MST | cheapest safe edge | ✅ | — |
| Dijkstra | nearest unsettled vertex | ✅ (non-negative weights) | Bellman-Ford |
| Huffman coding | merge the two rarest | ✅ | — |
| **Fractional** knapsack | best value/weight ratio | ✅ | — |
| **0/1** knapsack | best value/weight ratio | ❌ (160 vs 220) | DP |
| Coin change, canonical coins | largest coin first | ✅ | — |
| Coin change, arbitrary coins | largest coin first | ❌ (6 vs 3) | DP |
| Longest increasing subsequence | extend greedily | ❌ | DP / patience sorting |
| Travelling salesman | nearest unvisited city | ❌ (only an approximation) | DP / heuristics |

> [!best] The two-minute greedy check
> Before committing to a greedy algorithm:
> 1. **State the greedy choice precisely** — "earliest finishing", "largest coin", "best ratio". Vagueness hides bugs.
> 2. **Try the exchange argument.** Can any optimal solution be rewritten to include your choice without getting worse? If yes, you likely have a proof.
> 3. **If step 2 stalls, hunt for a counterexample** — and hunt in the *small* cases. Both failures in this chapter are tiny: three coin denominations, three knapsack items. Greedy failures rarely need large inputs to appear.
> 4. **Test against a brute-force or DP solution** on random small inputs. This is the step that actually catches mistakes, and it's a few lines, as the comparisons above show.

## Greedy vs. dynamic programming

> [!best] How to tell greedy from DP
> Both build solutions from subproblems, but:
> - **Greedy** commits to one choice at each step and never reconsiders — fast, but only correct when the greedy-choice property holds.
> - **[Dynamic programming](#/ch/dsa-dynamic-programming)** considers *all* choices at each step and remembers subproblem results — slower, but correct whenever there's *optimal substructure*.
>
> Rule of thumb: **try greedy first** (it's simpler); if you can find a counterexample where a locally optimal choice leads to a globally worse answer (like coin change with `[4,3,1]`), fall back to DP. When in doubt, DP is the safe hammer.

## Summary

- A **greedy algorithm** makes the locally best choice at each step and never backtracks — simple and fast (often O(n log n)).
- It's correct **only** when the **greedy-choice property** holds — otherwise it silently gives wrong answers.
- The **exchange argument** is how greedy proofs work: show any optimal solution can be rewritten to include your greedy choice without getting worse.
- Measured failures: coin change `[25,10,1]` for 30 needs **6 greedy coins vs 3 optimal**; 0/1 knapsack scores **160 vs 220**. Both counterexamples are tiny — greedy failures show up in small cases.
- **Fractional knapsack is greedy; 0/1 knapsack is not.** Indivisibility makes the choices *interact*, and interaction is what greedy can't see.
- **Huffman coding** merges the two rarest symbols; the result is **prefix-free** because every symbol sits at a leaf. Verified 224 bits vs 300 for a fixed 3-bit code.
- Proven-correct greedy algorithms: **activity selection**, **Kruskal/Prim MST**, **Dijkstra**, **Huffman coding**, **fractional knapsack**.
- **Try greedy first**, then prove it or break it — and **test against a DP or brute-force answer**, which takes only a few lines.

> [!exercise] Try it yourself
> 1. Write the exchange argument for Kruskal's algorithm: why is the cheapest edge that doesn't form a cycle always safe?
> 2. Implement "minimum number of rooms for all these meetings". Which greedy choice works, and why does it need a heap rather than a single `last_end`?
> 3. Explain in one sentence why Dijkstra is greedy and why it needs non-negative edge weights for that greed to be safe.
> 4. Fuzz `coins_greedy` against `coins_optimal` over random coin sets and amounts. How often does greedy fail, and what do the failing sets have in common?
> 5. Add a third item to the knapsack instance that makes greedy match the optimum. Does that prove anything?
> 6. Decode `1100` and `0` using the Huffman table produced above. Why can you do this without any separator between codes?
> 7. Run `huffman` on an alphabet where all frequencies are equal. What shape is the tree, and what does that say about when compression helps?
> 8. Implement fractional knapsack and confirm it reaches 240 on the same items where 0/1 greedy manages only 160.

When greedy fails because choices interact, the answer is to remember and reuse subproblem results — **dynamic programming**, next.
