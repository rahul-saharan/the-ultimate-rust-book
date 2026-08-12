<h1><span class="h1-kicker">Data Structures & Algorithms</span>Recursion & Backtracking</h1>

**Recursion** is a function that solves a problem by calling *itself* on smaller versions of that problem. It's the natural way to express anything with a self-similar structure — trees, nested data, and problems that break into subproblems. **Backtracking** is recursion's problem-solving superpower: systematically trying options, undoing them, and trying the next. This chapter builds both intuitions with classic examples.

## The two ingredients of recursion

> [!key] Every recursion needs a base case and a recursive case
> - The **base case** is the smallest version that's solved directly, *without* recursing — it stops the recursion.
> - The **recursive case** breaks the problem into a smaller one and calls itself, trusting that smaller call to work.
>
> Forget the base case and you get infinite recursion → a **stack overflow** (the call stack runs out of room). Every recursive function must make progress *toward* the base case on each call.

```rust
fn factorial(n: u64) -> u64 {
    if n <= 1 {
        1                     // base case: 0! = 1! = 1
    } else {
        n * factorial(n - 1)  // recursive case: n! = n × (n-1)!
    }
}

fn main() {
    println!("{}", factorial(5)); // 120
    // The calls unwind: 5 * (4 * (3 * (2 * 1)))
}
```

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="factorial(4) unwinds into nested calls down to the base case, then multiplies back up">
  <style>
    .rcm { font: 600 11px var(--font-mono); fill: var(--text); }
    .rcc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .call { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .base { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="20" y="20" width="150" height="22" class="call"/><text x="30" y="36" class="rcm">factorial(4)</text>
  <rect x="60" y="48" width="150" height="22" class="call"/><text x="70" y="64" class="rcm">→ 4 * factorial(3)</text>
  <rect x="100" y="76" width="150" height="22" class="call"/><text x="110" y="92" class="rcm">→ 3 * factorial(2)</text>
  <rect x="140" y="104" width="150" height="22" class="call"/><text x="150" y="120" class="rcm">→ 2 * factorial(1)</text>
  <rect x="180" y="132" width="130" height="22" class="base"/><text x="190" y="148" class="rcm">→ 1 (base case)</text>
  <text x="330" y="36" class="rcc">calls go DOWN ↓ (to base case)</text>
  <text x="330" y="120" class="rcc">then multiply back UP ↑</text>
  <text x="330" y="148" class="rcc" fill="var(--green)">= 24</text>
</svg>
<figcaption>Recursion descends to the base case, then combines results on the way back up.</figcaption>
</figure>

## Recursion and the call stack

Each recursive call gets its own [stack frame](#/ch/stack-heap). This is elegant but has a cost:

> [!warning] Deep recursion can overflow the stack
> Rust does **not** guarantee tail-call optimization, so each recursive call really does consume stack space. A recursion millions deep (like `factorial(1_000_000)`) will **overflow the stack and crash**. For deep or unbounded recursion, convert to an **iterative** loop with an explicit `Vec` as a stack, or use an accumulator. Recursion is best when the depth is bounded and modest (tree height, `log n` levels) — which covers most real uses.

"Deep" deserves a number. Here's where the limit actually falls:

```rust
/// A minimal recursive function, purely to measure depth.
fn depth(n: u64) -> u64 {
    if n == 0 { 0 } else { 1 + depth(n - 1) }
}

/// The same computation iteratively — constant stack, any depth.
fn depth_iterative(n: u64) -> u64 {
    (0..n).map(|_| 1).sum()
}

fn main() {
    // Comfortable on the default 8 MB main-thread stack.
    for probe in [1_000u64, 10_000, 100_000] {
        println!("recursive depth {:>7} → ok", depth(probe));
    }
    println!("\n(200,000 aborts with 'has overflowed its stack' on an 8 MB stack)");

    // A thread can be given a much larger stack.
    let deep = std::thread::Builder::new()
        .stack_size(256 * 1024 * 1024) // 256 MB
        .spawn(|| depth(2_000_000))
        .expect("spawn failed")
        .join()
        .expect("thread panicked");
    println!("\nwith a 256 MB thread stack: depth {deep} → ok");

    // Iteration has no such ceiling.
    println!("iteratively:               depth {} → ok", depth_iterative(50_000_000));
}
```

> [!warning] A stack overflow **aborts** — you cannot catch it
> The default main-thread stack is **8 MB**, which on this machine allows roughly 100,000 frames of a trivial function and fails somewhere before 200,000. A real function with locals uses more per frame, so the practical ceiling is lower — and it moves depending on optimisation level, so a release build may survive where a debug build dies.
>
> The critical part: this is **not a panic**. You get `fatal runtime error: stack overflow, aborting` and the process dies immediately. `catch_unwind` won't help, destructors don't run, and `#[should_panic]` can't test it. That makes stack depth a genuine correctness concern rather than a performance note: an input 20× larger than your test data can take the whole program down. If recursion depth scales with your input, either bound it, convert to iteration, or run it on a thread with a stack sized for the worst case.

## Backtracking: try, recurse, undo

**Backtracking** explores all possibilities by making a choice, recursing, then *undoing* the choice to try the next — like exploring a maze and retreating at dead ends. The template: **choose → explore → un-choose**. Generating all subsets of a set shows it cleanly:

```rust
fn subsets(nums: &[i32]) -> Vec<Vec<i32>> {
    let mut result = Vec::new();
    let mut current = Vec::new();
    backtrack(nums, 0, &mut current, &mut result);
    result
}

fn backtrack(nums: &[i32], start: usize, current: &mut Vec<i32>, result: &mut Vec<Vec<i32>>) {
    result.push(current.clone()); // every state is a valid subset

    for i in start..nums.len() {
        current.push(nums[i]);                       // 1. choose
        backtrack(nums, i + 1, current, result);      // 2. explore
        current.pop();                                // 3. un-choose (backtrack!)
    }
}

fn main() {
    let all = subsets(&[1, 2, 3]);
    println!("{} subsets: {:?}", all.len(), all);
    // 8 subsets: [], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]
}
```

The `current.pop()` is the "backtrack" — it undoes the last choice so the loop can try a different one. This choose/explore/undo pattern solves an enormous class of problems.

## The N-Queens problem

The canonical backtracking showcase: place `N` queens on an `N×N` chessboard so none attack each other. We try each column in each row, and backtrack whenever a placement conflicts:

```rust
fn count_n_queens(n: usize) -> usize {
    // Track which columns and diagonals are occupied.
    fn solve(n: usize, row: usize, cols: &mut [bool], diag1: &mut [bool], diag2: &mut [bool]) -> usize {
        if row == n {
            return 1; // placed all N queens — one valid solution
        }
        let mut count = 0;
        for col in 0..n {
            let d1 = row + col;             // ╲ diagonal id
            let d2 = row + n - 1 - col;      // ╱ diagonal id
            if !cols[col] && !diag1[d1] && !diag2[d2] {
                // choose:
                cols[col] = true; diag1[d1] = true; diag2[d2] = true;
                count += solve(n, row + 1, cols, diag1, diag2); // explore
                // un-choose:
                cols[col] = false; diag1[d1] = false; diag2[d2] = false;
            }
        }
        count
    }
    solve(n, 0, &mut vec![false; n], &mut vec![false; 2 * n], &mut vec![false; 2 * n])
}

fn main() {
    println!("4-queens solutions: {}", count_n_queens(4)); // 2
    println!("8-queens solutions: {}", count_n_queens(8)); // 92
}
```

> [!key] The backtracking template
> Almost every backtracking problem — permutations, combinations, Sudoku, maze-solving, word search — follows the same shape:
> ```text
> fn backtrack(state):
>     if state is a complete solution: record it; return
>     for each choice available from state:
>         if choice is valid:
>             apply choice           # choose
>             backtrack(new state)   # explore
>             undo choice            # un-choose
> ```
> Recognize this template and a huge category of "generate all / find all valid" problems becomes routine. The art is *pruning* — skipping invalid choices early (like the diagonal checks above) to avoid exploring doomed branches.

## How expensive is a recursion?

Reading the complexity off a recursive function is a distinct skill, and it comes down to two numbers: **how many calls each call makes** (the branching factor `b`), and **how deep it goes** (`d`). The call tree then has roughly `b^d` nodes.

| Recursion shape | Branching × depth | Total | Example |
|---|---|---|---|
| one call, shrink by 1 | 1 × n | **O(n)** | `factorial`, list length |
| one call, halve the input | 1 × log n | **O(log n)** | binary search |
| two calls, halve the input | 2 × log n | **O(n)** | tree traversal, sum of a tree |
| two calls, halve **plus O(n) work** | — | **O(n log n)** | merge sort, quicksort |
| two calls, shrink by 1 | 2 × n | **O(2ⁿ)** ⚠️ | naive Fibonacci, naive subsets |
| n calls, shrink by 1 | n × n | **O(n!)** ⚠️ | permutations, N-Queens |

> [!key] The danger sign is *two or more* calls that each shrink the problem by only one
> Halving is what keeps recursion cheap: `2 × log n` branches give you O(n) total, which is why tree traversals are linear. But **branching without shrinking fast** is exponential — `fib(n-1) + fib(n-2)` makes two calls that each reduce `n` by one, so the tree has ~2ⁿ nodes. The fix is almost always that the branches **overlap**: `fib(30)` computes `fib(28)` many thousands of times over. Cache those results and the exponential collapses.

```rust
use std::collections::HashMap;

/// Naive: two calls per level, each shrinking n by 1 → O(2ⁿ) calls.
fn fib_naive(n: u64, calls: &mut u64) -> u64 {
    *calls += 1;
    if n < 2 {
        return n;
    }
    fib_naive(n - 1, calls) + fib_naive(n - 2, calls)
}

/// Memoized: each distinct n is computed once → O(n) calls.
/// The recursion is unchanged; only the cache is new.
fn fib_memo(n: u64, memo: &mut HashMap<u64, u64>, calls: &mut u64) -> u64 {
    *calls += 1;
    if n < 2 {
        return n;
    }
    if let Some(&cached) = memo.get(&n) {
        return cached;
    }
    let value = fib_memo(n - 1, memo, calls) + fib_memo(n - 2, memo, calls);
    memo.insert(n, value);
    value
}

/// Iterative with two accumulators: O(n) time, O(1) space, no stack frames.
fn fib_iter(n: u64) -> u64 {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..n {
        let next = a + b;
        a = b;
        b = next;
    }
    a
}

fn main() {
    println!("{:>4} | {:>14} | {:>12} | {:>10}", "n", "naive calls", "memo calls", "ratio");
    println!("{}", "-".repeat(50));
    for n in [10u64, 20, 25, 30] {
        let mut naive_calls = 0;
        let a = fib_naive(n, &mut naive_calls);
        let mut memo_calls = 0;
        let b = fib_memo(n, &mut HashMap::new(), &mut memo_calls);
        assert_eq!(a, b);
        assert_eq!(a, fib_iter(n));
        println!("{:>4} | {:>14} | {:>12} | {:>9.0}x",
            n, naive_calls, memo_calls, naive_calls as f64 / memo_calls as f64);
    }
    println!("\nmemo calls are exactly 2n-1 — linear, not exponential.");
    println!("fib(90) iteratively = {}", fib_iter(90));
    println!("(the naive version would need roughly 2^90 calls — longer than the age of the universe)");
}
```

> [!performance] 2,692,537 calls versus 59
> At `n = 30` the naive version makes **2,692,537** calls and the memoized one **59** — a factor of 45,000, from adding a cache and changing nothing else. And the gap widens without limit: every increment of `n` roughly *doubles* the naive count while adding just two to the memoized one.
>
> This is the entire idea behind [dynamic programming](#/ch/dsa-dynamic-programming). "DP" sounds like a separate technique, but top-down DP *is* recursion plus a cache — the same function, memoized. The bottom-up form (`fib_iter` above) is the same recurrence again, evaluated in dependency order with no recursion at all, which also removes the stack-depth risk.

## Backtracking's other essential shape: permutations

Subsets choose whether to *include* each element. **Permutations** choose the *order*, so instead of a `start` index you track which elements are still unused:

```rust
/// Every ordering of `items`, via choose → explore → un-choose.
fn permutations(items: &[i32]) -> Vec<Vec<i32>> {
    fn go(items: &[i32], used: &mut Vec<bool>, current: &mut Vec<i32>, out: &mut Vec<Vec<i32>>) {
        if current.len() == items.len() {
            out.push(current.clone()); // a complete arrangement
            return;
        }
        for i in 0..items.len() {
            if used[i] {
                continue; // already placed — skip
            }
            used[i] = true;              // choose
            current.push(items[i]);
            go(items, used, current, out); // explore
            current.pop();               // un-choose
            used[i] = false;
        }
    }

    let mut out = Vec::new();
    go(items, &mut vec![false; items.len()], &mut Vec::new(), &mut out);
    out
}

fn main() {
    let three = permutations(&[1, 2, 3]);
    println!("{} permutations of [1,2,3]:", three.len());
    for p in &three {
        println!("  {p:?}");
    }
    println!("\n4 items → {} permutations", permutations(&[1, 2, 3, 4]).len());
    println!("(n! grows brutally: 10 items would be 3,628,800)");
}
```

> [!key] Subsets vs permutations: `start` index vs `used` flags
> The two templates differ in exactly one place, and it encodes the difference between the problems. **Subsets** pass `i + 1` as the next `start`, so each element is considered once and order never varies — 2ⁿ results. **Permutations** loop over *all* positions each time, skipping the used ones, so every ordering is reachable — n! results.
>
> If you ever generate duplicates or miss cases in a backtracking problem, this is the first thing to check: are you preventing revisits with a **`start` index** (combinations) or a **`used` array** (arrangements)? Mixing them up produces subtly wrong output that still looks plausible.

> [!tip] When to prefer iteration over recursion
> Recursion is *clearest* for tree-shaped and self-similar problems (traversals, backtracking, divide-and-conquer). Prefer an **iterative** solution when: the recursion is simple linear repetition (a plain loop is clearer and avoids stack frames), or the depth could be huge (risk of stack overflow). Many recursions have a natural iterative form using an explicit stack — that's exactly how you'd convert a deep DFS to avoid overflow.

## Summary

- **Recursion** = a function calling itself on a smaller problem; every one needs a **base case** (stops it) and a **recursive case** (shrinks toward the base).
- Complexity comes from **branching factor × depth**. Halving keeps it cheap (`2 × log n` → O(n)); **two calls that each shrink by one is O(2ⁿ)**, and n calls shrinking by one is O(n!).
- When exponential branches **overlap**, memoization collapses them: naive `fib(30)` makes **2,692,537** calls, memoized makes **59**. That's what top-down [dynamic programming](#/ch/dsa-dynamic-programming) is.
- Each call uses a **stack frame**. The default 8 MB stack allows roughly **100,000** trivial frames; a stack overflow **aborts** and cannot be caught, so depth is a correctness issue, not a performance note.
- Raise the ceiling with `thread::Builder::new().stack_size(…)`, or remove it by converting to **iteration**.
- **Backtracking** explores choices with **choose → explore → un-choose**.
- **Subsets use a `start` index; permutations use a `used` array.** Mixing them up produces plausible-looking but wrong output.
- The backtracking **template** solves permutations, subsets, N-Queens, Sudoku, and maze problems; **pruning** invalid branches early is the key to efficiency.

> [!exercise] Try it yourself
> 1. Add a call counter to the naive `fib` and plot the count against `n`. Confirm it roughly doubles each step.
> 2. Convert the recursive `factorial` into an iterative loop with an accumulator.
> 3. Run `depth(200_000)` on the main thread. What exactly is printed, and why can't you catch it?
> 4. Wrap the same call in a thread with a 512 MB stack and find the new ceiling. How many bytes per frame does that imply?
> 5. Memoize `count_n_queens`… and then explain why it doesn't help. What property does Fibonacci have that N-Queens lacks?
> 6. Modify `permutations` to handle **duplicate** input values without emitting duplicate orderings. (Hint: sort first, then skip a value if it equals the previous one and that one is unused.)
> 7. Generate all combinations of size `k` from `n` items by adding one condition to the subsets template.
> 8. Add pruning to N-Queens that stops early once the remaining rows can't possibly be filled. Measure the reduction in recursive calls for `n = 10`.

Merge sort and quicksort split problems in half and combine the results — a specific, powerful flavor of recursion called **divide and conquer**.
