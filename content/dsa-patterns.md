<h1><span class="h1-kicker">Data Structures & Algorithms</span>Algorithm Patterns & Problem-Solving</h1>

Most algorithm problems aren't solved by inventing something new — they're solved by **recognizing a pattern** you've seen before and adapting it. A handful of reusable techniques cover a huge fraction of real coding problems and interviews. This chapter teaches that toolkit: how to *approach* any problem, then the core patterns — **two pointers, sliding window, prefix sums, fast & slow pointers, binary search on the answer, backtracking, and monotonic stacks** — each with the trigger that signals it, a runnable Rust solution, and a tip.

## A framework for any problem

Before reaching for a pattern, run this loop. It turns "I have no idea" into a plan:

1. **Understand** — restate the problem; nail down inputs, outputs, and constraints (how big is `n`? sorted? duplicates? negatives?).
2. **Examples** — work 2–3 small examples by hand, including an edge case (empty, single element, all-equal).
3. **Brute force first** — write the obvious `O(n²)`/`O(2ⁿ)` solution in your head. It's your correctness baseline.
4. **Spot the pattern** — the constraints hint at the target complexity, which hints at the pattern (table below).
5. **Code it** — small, named helpers; handle the edges you found in step 2.
6. **Test** — run your examples, then the edges.

> [!key] Constraints tell you the target complexity
> The size of `n` is a giant clue to which pattern fits. Rough guide: `n ≤ 20` → exponential is fine (**backtracking**); `n ≤ 3000` → `O(n²)` is fine; `n ≤ 10⁶` → you need `O(n log n)` or `O(n)` (**sorting, sliding window, prefix sums, binary search**). If a brute force is `O(n²)` and `n` is a million, the problem is *telling* you to find a linear or log-linear pattern.

## The pattern-recognition cheat sheet

| If you see… | Reach for… |
|---|---|
| a **sorted** array, or "find a pair/triplet" | **two pointers** |
| "longest/shortest **subarray/substring** with property X" | **sliding window** |
| many "**sum of range [i, j]**" queries | **prefix sums** |
| a **linked list** cycle, or "find the middle/duplicate" | **fast & slow pointers** |
| "**minimum/maximum value** such that [condition] holds" | **binary search on the answer** |
| "generate **all** subsets/permutations/combinations" | **backtracking** |
| "**next greater/smaller** element", spans, histograms | **monotonic stack** |
| shortest path in an **unweighted grid/graph** | **BFS** ([graph traversal](#/ch/dsa-graph-traversal)) |
| "**number of ways**", "optimal with overlapping subproblems" | **dynamic programming** ([DP](#/ch/dsa-dynamic-programming)) |

## Two pointers

Keep two indices and move them toward each other (or in the same direction) so each element is visited once — turning an `O(n²)` scan into `O(n)`. The classic setup: a **sorted** array with two pointers at the ends that converge based on a comparison.

<figure class="diagram">
<svg viewBox="0 0 620 120" role="img" aria-label="Two pointers start at opposite ends of a sorted array and move inward based on whether their sum is too small or too large">
  <style>
    .tp-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .tp-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cell { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .lo { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .hi { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="30"  y="40" width="70" height="40" class="lo"/><text x="55" y="65" class="tp-b">1</text>
  <rect x="100" y="40" width="70" height="40" class="cell"/><text x="130" y="65" class="tp-b">2</text>
  <rect x="170" y="40" width="70" height="40" class="cell"/><text x="200" y="65" class="tp-b">4</text>
  <rect x="240" y="40" width="70" height="40" class="cell"/><text x="270" y="65" class="tp-b">7</text>
  <rect x="310" y="40" width="70" height="40" class="cell"/><text x="340" y="65" class="tp-b">11</text>
  <rect x="380" y="40" width="70" height="40" class="hi"/><text x="405" y="65" class="tp-b">15</text>
  <text x="40"  y="30" class="tp-c" fill="var(--blue)">lo →</text>
  <text x="390" y="30" class="tp-c" fill="var(--rust-600)">← hi</text>
  <text x="30" y="104" class="tp-c">sum too small? move lo right (bigger). too big? move hi left (smaller). Equal? found it.</text>
</svg>
<figcaption>Two converging pointers on a sorted array find a target pair in one pass.</figcaption>
</figure>

```rust
fn two_sum_sorted(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    let (mut lo, mut hi) = (0, nums.len() - 1);
    while lo < hi {
        let sum = nums[lo] + nums[hi];
        if sum == target      { return Some((lo, hi)); }
        else if sum < target  { lo += 1; } // need a bigger sum
        else                  { hi -= 1; } // need a smaller sum
    }
    None
}

fn main() {
    let nums = [1, 2, 4, 7, 11, 15];
    println!("{:?}", two_sum_sorted(&nums, 15)); // Some((2, 4)) → 4 + 11
    println!("{:?}", two_sum_sorted(&nums, 3));  // Some((0, 1)) → 1 + 2
}
```

> [!tip] Recognize it by "sorted" or "pair/triplet"
> Two pointers shine when the data is sorted (or you can sort it) and you're hunting a pair, triplet, or partition. It's also the engine of palindrome checks (pointers from both ends) and in-place array partitioning (e.g. Dutch-national-flag).

## Sliding window

For "the best contiguous **subarray/substring** with property X," don't re-scan every window from scratch. Keep a window `[start, end]` and *slide* it: extend `end` to grow, advance `start` to shrink when the window breaks the property. Each element enters and leaves once → `O(n)`.

<figure class="diagram">
<svg viewBox="0 0 620 120" role="img" aria-label="A window covering a run of array cells slides right, adding a new cell on the right and dropping one on the left">
  <style>
    .sw-b { font: 600 12px var(--font-mono); fill: var(--text); }
    .sw-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cell { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .win  { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <rect x="30"  y="45" width="70" height="40" class="cell"/><text x="60" y="70" class="sw-b">2</text>
  <rect x="100" y="45" width="70" height="40" class="win"/><text x="130" y="70" class="sw-b">1</text>
  <rect x="170" y="45" width="70" height="40" class="win"/><text x="200" y="70" class="sw-b">5</text>
  <rect x="240" y="45" width="70" height="40" class="win"/><text x="270" y="70" class="sw-b">1</text>
  <rect x="310" y="45" width="70" height="40" class="cell"/><text x="340" y="70" class="sw-b">3</text>
  <rect x="380" y="45" width="70" height="40" class="cell"/><text x="410" y="70" class="sw-b">2</text>
  <path d="M135 38 L275 38" stroke="var(--green)" stroke-width="2" marker-end="url(#swa)"/>
  <text x="150" y="30" class="sw-c" fill="var(--green)">window slides right →</text>
  <text x="30" y="108" class="sw-c">add the entering element, drop the leaving one — never recompute the whole window.</text>
  <defs><marker id="swa" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption>Slide the window and update incrementally: O(n) instead of O(n·k).</figcaption>
</figure>

A **fixed-size** window (max sum of any `k` consecutive elements) just adds the new element and subtracts the old:

```rust
fn max_window_sum(nums: &[i32], k: usize) -> Option<i32> {
    if k == 0 || k > nums.len() { return None; }
    let mut sum: i32 = nums[..k].iter().sum();
    let mut best = sum;
    for i in k..nums.len() {
        sum += nums[i] - nums[i - k]; // slide: +entering, −leaving
        best = best.max(sum);
    }
    Some(best)
}

fn main() {
    println!("{:?}", max_window_sum(&[2, 1, 5, 1, 3, 2], 3)); // Some(9) → 5+1+3
}
```

A **variable-size** window (longest substring with all-unique characters) grows the right edge and jumps the left edge past any repeat:

```rust
use std::collections::HashMap;

fn longest_unique(s: &str) -> usize {
    let mut last_seen: HashMap<u8, usize> = HashMap::new();
    let (mut start, mut best) = (0usize, 0usize);
    for (i, &b) in s.as_bytes().iter().enumerate() {
        if let Some(&prev) = last_seen.get(&b) {
            if prev >= start { start = prev + 1; } // shrink past the duplicate
        }
        last_seen.insert(b, i);
        best = best.max(i - start + 1);
    }
    best
}

fn main() {
    println!("{}", longest_unique("abcabcbb")); // 3  ("abc")
    println!("{}", longest_unique("pwwkew"));    // 3  ("wke")
}
```

## Prefix sums

When a problem fires many "**sum of the range `[i, j]`**" questions, precompute a running total once so each query is `O(1)`: `sum(i..j) = prefix[j] − prefix[i]`. Paired with a hash map, the same idea counts subarrays with a target sum in one pass:

```rust
use std::collections::HashMap;

// How many contiguous subarrays sum exactly to k?
fn subarrays_summing_to(nums: &[i32], k: i32) -> usize {
    let mut seen: HashMap<i32, usize> = HashMap::new();
    seen.insert(0, 1);          // one "empty" prefix of sum 0
    let (mut running, mut total) = (0, 0);
    for &n in nums {
        running += n;
        // a subarray ending here sums to k iff some earlier prefix was running − k:
        if let Some(&count) = seen.get(&(running - k)) { total += count; }
        *seen.entry(running).or_insert(0) += 1;
    }
    total
}

fn main() {
    println!("{}", subarrays_summing_to(&[1, 1, 1], 2)); // 2
    println!("{}", subarrays_summing_to(&[1, 2, 3], 3)); // 2  → [1,2] and [3]
}
```

> [!tip] Prefix sums generalize
> The same "precompute cumulative, then subtract" trick gives 2-D range sums (integral images), prefix XORs, and prefix counts. When you need *updatable* range sums, graduate to a [Fenwick/segment tree](#/ch/dsa-advanced).

## Fast & slow pointers (Floyd's)

Move one pointer one step and another two steps. If there's a **cycle**, the fast one laps the slow one and they meet; the gap logic also finds a list's middle or a duplicated value. Here it finds the duplicate in an array of `n+1` values in `1..=n` — treating the array as a linked list of "next = value":

```rust
fn find_duplicate(nums: &[usize]) -> usize {
    // Phase 1: find a meeting point inside the cycle.
    let (mut slow, mut fast) = (nums[0], nums[nums[0]]);
    while slow != fast {
        slow = nums[slow];
        fast = nums[nums[fast]];
    }
    // Phase 2: a pointer from the start meets slow at the cycle's entrance = the duplicate.
    slow = 0;
    while slow != fast {
        slow = nums[slow];
        fast = nums[fast];
    }
    slow
}

fn main() {
    println!("{}", find_duplicate(&[1, 3, 4, 2, 2])); // 2
    println!("{}", find_duplicate(&[3, 1, 3, 4, 2])); // 3
}
```

> [!tip] Constant memory is the giveaway
> Fast/slow is the go-to when you must detect a cycle or find a midpoint **without extra memory** (`O(1)` space). For linked lists it also avoids a second pass to find the middle.

## Binary search on the answer

Binary search isn't only for finding a value in a sorted array — it finds the **smallest/largest answer that satisfies a monotonic condition**. If "can we do it with budget `x`?" is *false, false, …, true, true, …* as `x` grows, binary-search the boundary. You supply a `feasible(x)` predicate; the search does the rest in `O(log range · cost of check)`.

```rust
// Smallest eating speed so all piles are finished within `hours`.
fn min_speed(piles: &[u64], hours: u64) -> u64 {
    let feasible = |speed: u64| -> bool {
        // hours needed = sum of ceil(pile / speed)
        piles.iter().map(|&p| (p + speed - 1) / speed).sum::<u64>() <= hours
    };
    let (mut lo, mut hi) = (1, *piles.iter().max().unwrap());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if feasible(mid) { hi = mid; } else { lo = mid + 1; } // shrink toward the boundary
    }
    lo
}

fn main() {
    println!("{}", min_speed(&[3, 6, 7, 11], 8));        // 4
    println!("{}", min_speed(&[30, 11, 23, 4, 20], 5));  // 30
}
```

> [!key] The trick is spotting monotonicity
> Ask: "if `x` works, does every larger `x` also work?" If yes, the yes/no boundary is binary-searchable. This pattern hides in "minimum capacity", "smallest max", "largest minimum", and "minimum days" problems — the phrase *minimize/maximize a value subject to a feasibility check* is the tell.

## Backtracking

To generate **all** valid configurations (subsets, permutations, combinations, board placements), build a candidate step by step: **choose** an option, **explore** deeper, then **un-choose** to try the next. It's a depth-first walk over the decision tree that prunes dead branches.

```rust
fn subsets(nums: &[i32]) -> Vec<Vec<i32>> {
    fn backtrack(start: usize, nums: &[i32], current: &mut Vec<i32>, out: &mut Vec<Vec<i32>>) {
        out.push(current.clone());            // every node on the path is a valid subset
        for i in start..nums.len() {
            current.push(nums[i]);            // choose
            backtrack(i + 1, nums, current, out); // explore
            current.pop();                    // un-choose (backtrack)
        }
    }
    let mut out = Vec::new();
    backtrack(0, nums, &mut Vec::new(), &mut out);
    out
}

fn main() {
    let all = subsets(&[1, 2, 3]);
    println!("{} subsets: {:?}", all.len(), all); // 8
}
```

> [!mistake] Forgetting to un-choose
> The single most common backtracking bug is mutating shared state (`current`) and not undoing it after the recursive call — every branch then sees the previous branch's leftovers. The rhythm is always **choose → recurse → un-choose**. Prune early (skip choices that can't lead to a solution) to cut the exponential search.

## Monotonic stack

A stack kept in sorted (monotonic) order answers "**next greater/smaller element**", stock spans, and histogram problems in `O(n)`. You push indices; before pushing, pop everything the new element "beats," resolving those answers as you go.

```rust
// For each element, the next element to its right that is strictly greater (or -1).
fn next_greater(nums: &[i32]) -> Vec<i32> {
    let mut result = vec![-1; nums.len()];
    let mut stack: Vec<usize> = Vec::new(); // indices with decreasing values
    for i in 0..nums.len() {
        while let Some(&top) = stack.last() {
            if nums[i] > nums[top] {
                result[top] = nums[i]; // nums[i] is `top`'s next-greater
                stack.pop();
            } else {
                break;
            }
        }
        stack.push(i);
    }
    result
}

fn main() {
    println!("{:?}", next_greater(&[2, 1, 2, 4, 3])); // [4, 2, 4, -1, -1]
}
```

## Summary

- Solve problems with a **loop**: understand → examples → brute force → spot the pattern → code → test. **Constraints reveal the target complexity**, which reveals the pattern.
- **Two pointers** — sorted data, pairs/partitions (`O(n)`).
- **Sliding window** — best contiguous subarray/substring (`O(n)`), fixed or variable size.
- **Prefix sums** — many range-sum queries (`O(1)` each after `O(n)` setup); with a hash map, count target-sum subarrays.
- **Fast & slow pointers** — cycles, middles, duplicates in `O(1)` space.
- **Binary search on the answer** — minimize/maximize a value behind a monotonic `feasible(x)` check.
- **Backtracking** — enumerate all configurations via choose → explore → un-choose.
- **Monotonic stack** — next-greater/smaller and span problems in `O(n)`.

> [!exercise] Try it yourself
> 1. **Two pointers:** reverse a `&mut [i32]` in place using pointers from both ends.
> 2. **Sliding window:** find the smallest subarray length whose sum is ≥ a target.
> 3. **Binary search on answer:** given board lengths, find the minimum largest-cut so you get at least `k` pieces.
> 4. **Backtracking:** generate all permutations of `[1, 2, 3]`.

Next, we turn from *using* structures to *building* them: how to design your own data structure in Rust.
