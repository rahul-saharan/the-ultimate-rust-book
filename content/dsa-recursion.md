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

> [!tip] When to prefer iteration over recursion
> Recursion is *clearest* for tree-shaped and self-similar problems (traversals, backtracking, divide-and-conquer). Prefer an **iterative** solution when: the recursion is simple linear repetition (a plain loop is clearer and avoids stack frames), or the depth could be huge (risk of stack overflow). Many recursions have a natural iterative form using an explicit stack — that's exactly how you'd convert a deep DFS to avoid overflow.

## Summary

- **Recursion** = a function calling itself on a smaller problem; every one needs a **base case** (stops it) and a **recursive case** (shrinks toward the base).
- Each call uses a **stack frame**, so **deep recursion can overflow the stack** (Rust has no guaranteed tail-call optimization) — use iteration for unbounded depth.
- **Backtracking** systematically explores choices with the **choose → explore → un-choose** pattern, undoing decisions to try alternatives.
- The backtracking **template** solves permutations, subsets, N-Queens, Sudoku, and maze problems; **pruning** invalid branches early is the key to efficiency.

> [!exercise] Try it yourself
> 1. Write a recursive `fib(n)` and observe it's slow for large `n` — then note why (it recomputes subproblems; [dynamic programming](#/ch/dsa-dynamic-programming) fixes this).
> 2. Modify `subsets` to generate all **permutations** of a slice instead (choose from unused elements each step).
> 3. Convert the recursive `factorial` into an iterative loop with an accumulator.

Merge sort and quicksort split problems in half and combine the results — a specific, powerful flavor of recursion called **divide and conquer**.
