<h1><span class="h1-kicker">Data Structures & Algorithms</span>Stacks & Queues</h1>

Stacks and queues are the two simplest *disciplined* collections — they restrict *where* you add and remove items, and that restriction is exactly what makes them useful. A **stack** is last-in-first-out (LIFO), a **queue** is first-in-first-out (FIFO). In Rust you rarely build them from scratch — `Vec` is a stack and `VecDeque` is a queue — but understanding them unlocks a huge family of algorithms.

## Stack: last in, first out

A **stack** is like a stack of plates: you add (`push`) and remove (`pop`) only from the *top*. The last thing you put on is the first thing you take off. Rust's `Vec` *is* a stack — `push` and `pop` operate on the end:

```rust
fn main() {
    let mut stack = Vec::new();
    stack.push(1);
    stack.push(2);
    stack.push(3);

    while let Some(top) = stack.pop() {
        print!("{top} "); // 3 2 1 — reverse of insertion (LIFO)
    }
    println!();
}
```

| Stack operation | Method | Cost |
|-----------------|--------|------|
| push (add to top) | `vec.push(x)` | O(1) amortized |
| pop (remove top) | `vec.pop()` | O(1) |
| peek (look at top) | `vec.last()` | O(1) |

### Augmenting a stack: O(1) minimum

A stack can answer more than "what's on top". The trick for tracking the minimum is to store, alongside each element, the minimum *at the time it was pushed* — so popping restores the previous answer automatically:

```rust
/// push, pop, and min are all O(1). The cost is O(n) extra memory.
struct MinStack {
    data: Vec<i32>,
    /// mins[i] is the smallest value among data[0..=i].
    mins: Vec<i32>,
}

impl MinStack {
    fn new() -> Self {
        MinStack { data: Vec::new(), mins: Vec::new() }
    }

    fn push(&mut self, x: i32) {
        let new_min = self.mins.last().copied().map_or(x, |current| current.min(x));
        self.mins.push(new_min);
        self.data.push(x);
    }

    fn pop(&mut self) -> Option<i32> {
        self.mins.pop(); // discarding the old min restores the previous one
        self.data.pop()
    }

    fn min(&self) -> Option<i32> {
        self.mins.last().copied()
    }

    fn peek(&self) -> Option<i32> {
        self.data.last().copied()
    }
}

fn main() {
    let mut stack = MinStack::new();
    for x in [5, 3, 7, 2, 8] {
        stack.push(x);
        println!("pushed {x} → top {:?}, min {:?}", stack.peek(), stack.min());
    }

    stack.pop();
    stack.pop();
    println!("after popping 8 and 2 → min is {:?} again", stack.min());
}
```

> [!key] Why a single "current minimum" variable doesn't work
> The obvious approach — keep one `min` field and update it on push — breaks on **pop**. Once you pop the smallest element, you have no way to recover what the minimum *was* before it arrived, short of rescanning the whole stack in O(n). Storing the min-so-far per level sidesteps that entirely: each entry remembers its own era. This "store the answer alongside each element" idea generalises well — the same shape gives you an O(1) `max`, or an O(1) running sum.

### Classic use: balanced brackets

Stacks are perfect for anything with nesting — matching brackets, evaluating expressions, undo history. Push opening brackets; when you see a closing one, the top of the stack must be its match:

```rust
fn is_balanced(s: &str) -> bool {
    let mut stack = Vec::new();
    for c in s.chars() {
        match c {
            '(' | '[' | '{' => stack.push(c),
            ')' => if stack.pop() != Some('(') { return false; },
            ']' => if stack.pop() != Some('[') { return false; },
            '}' => if stack.pop() != Some('{') { return false; },
            _ => {}
        }
    }
    stack.is_empty() // leftover open brackets → unbalanced
}

fn main() {
    println!("{}", is_balanced("({[]})")); // true
    println!("{}", is_balanced("(]"));      // false
    println!("{}", is_balanced("((("));     // false
}
```

### Classic use: evaluating an expression

The other headline stack application is arithmetic. In **postfix** notation (also called Reverse Polish Notation), operators follow their operands — `3 4 + 2 *` means `(3 + 4) × 2`. That ordering removes the need for parentheses *and* for precedence rules, which is exactly why it's easy to evaluate: push numbers, and when an operator arrives, pop its two operands.

```rust
/// Evaluate a postfix expression. Returns None on malformed input,
/// including a division by zero or a leftover operand.
fn eval_rpn(tokens: &[&str]) -> Option<i64> {
    let mut stack: Vec<i64> = Vec::new();

    for token in tokens {
        match *token {
            "+" | "-" | "*" | "/" => {
                // Order matters: b was pushed last, so it's the RIGHT operand.
                let b = stack.pop()?;
                let a = stack.pop()?;
                stack.push(match *token {
                    "+" => a + b,
                    "-" => a - b,
                    "*" => a * b,
                    "/" => {
                        if b == 0 {
                            return None;
                        }
                        a / b
                    }
                    _ => unreachable!(),
                });
            }
            number => stack.push(number.parse().ok()?),
        }
    }

    // A well-formed expression leaves exactly one value behind.
    if stack.len() == 1 {
        stack.pop()
    } else {
        None
    }
}

fn main() {
    println!("3 4 + 2 *           = {:?}", eval_rpn(&["3", "4", "+", "2", "*"]));
    println!("5 1 2 + 4 * + 3 -   = {:?}", eval_rpn(&["5", "1", "2", "+", "4", "*", "+", "3", "-"]));
    println!("1 +      (malformed) = {:?}", eval_rpn(&["1", "+"]));
    println!("1 2      (leftover)  = {:?}", eval_rpn(&["1", "2"]));
    println!("8 0 /    (div by 0)  = {:?}", eval_rpn(&["8", "0", "/"]));
}
```

> [!mistake] Popping the operands in the wrong order
> `a - b` and `b - a` are not the same, and the stack hands them back **reversed**: the second operand was pushed last, so it pops *first*. Writing `let a = stack.pop()?; let b = stack.pop()?;` and then computing `a - b` silently gives you subtraction and division backwards, while `+` and `*` still look fine — so the bug survives half your tests. Pop into `b` first, then `a`, and the arithmetic reads in the natural order.

> [!deep] From infix to postfix, and why compilers care
> Humans write *infix* (`3 + 4 * 2`), which needs precedence and parentheses to be unambiguous. **Dijkstra's shunting-yard algorithm** converts infix to postfix using a second stack for operators — and the resulting postfix form is essentially what a compiler emits as stack-machine bytecode. The reason your language's expression parser, the JVM, WebAssembly, and a pocket calculator all lean on stacks is the same: nesting is a LIFO problem, and a stack *is* the data structure for nesting.

## Queue: first in, first out

A **queue** is like a line at a shop: you add at the back (`push_back`) and remove from the front (`pop_front`). The first to arrive is the first served. Use [`VecDeque`](#/ch/other-collections) — a `Vec` is slow at the front, but `VecDeque` is O(1) at *both* ends:

```rust
use std::collections::VecDeque;

fn main() {
    let mut queue = VecDeque::new();
    queue.push_back("first");
    queue.push_back("second");
    queue.push_back("third");

    while let Some(front) = queue.pop_front() {
        print!("{front} "); // first second third — order preserved (FIFO)
    }
    println!();
}
```

<figure class="diagram">
<svg viewBox="0 0 640 170" role="img" aria-label="A stack adds and removes at the same end (LIFO); a queue adds at the back and removes at the front (FIFO)">
  <style>
    .sqm { font: 600 12px var(--font-mono); fill: var(--text); }
    .sqc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .cellq { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <text x="20" y="24" class="sqm" fill="var(--rust-600)">STACK (LIFO)</text>
  <rect x="20" y="36" width="60" height="26" class="cellq"/><text x="44" y="54" class="sqm">1</text>
  <rect x="20" y="62" width="60" height="26" class="cellq"/><text x="44" y="80" class="sqm">2</text>
  <rect x="20" y="88" width="60" height="26" class="cellq"/><text x="44" y="106" class="sqm">3</text>
  <text x="95" y="52" class="sqc">← push / pop here (top)</text>
  <text x="20" y="140" class="sqc">Add &amp; remove at the SAME end.</text>
  <text x="360" y="24" class="sqm" fill="var(--blue)">QUEUE (FIFO)</text>
  <rect x="360" y="60" width="50" height="26" class="cellq"/><text x="380" y="78" class="sqm">1</text>
  <rect x="410" y="60" width="50" height="26" class="cellq"/><text x="430" y="78" class="sqm">2</text>
  <rect x="460" y="60" width="50" height="26" class="cellq"/><text x="480" y="78" class="sqm">3</text>
  <text x="360" y="106" class="sqc">↑ pop_front</text>
  <text x="460" y="106" class="sqc">push_back ↑</text>
  <text x="360" y="140" class="sqc">Add at back, remove at front.</text>
</svg>
<figcaption>A stack works one end (LIFO); a queue works both ends (FIFO). Both offer O(1) operations.</figcaption>
</figure>

> [!key] Where stacks and queues secretly power algorithms
> - **Stacks**: matching brackets, evaluating/parsing expressions, undo/redo, function call frames (the "call stack"!), and **depth-first search** ([DFS](#/ch/dsa-graph-traversal)).
> - **Queues**: task scheduling, buffering, and **breadth-first search** ([BFS](#/ch/dsa-graph-traversal)).
>
> In fact, DFS and BFS are *the same algorithm* — the only difference is whether you use a stack or a queue to hold the frontier! Recognizing "this needs LIFO" or "this needs FIFO" points you straight to the right structure.

That claim deserves proof rather than assertion. Here is one traversal function where the **only** variable is which end we remove from:

```rust
use std::collections::VecDeque;

#[derive(Copy, Clone)]
enum Frontier {
    Stack, // LIFO
    Queue, // FIFO
}

/// One algorithm. The single difference between depth-first and breadth-first
/// is `pop_back` versus `pop_front`.
fn traverse(adj: &[Vec<usize>], start: usize, kind: Frontier) -> Vec<usize> {
    let mut seen = vec![false; adj.len()];
    let mut pending: VecDeque<usize> = VecDeque::from([start]);
    seen[start] = true;
    let mut order = Vec::new();

    while let Some(v) = match kind {
        Frontier::Stack => pending.pop_back(),  // newest first  → depth-first
        Frontier::Queue => pending.pop_front(), // oldest first  → breadth-first
    } {
        order.push(v);
        for &to in &adj[v] {
            if !seen[to] {
                seen[to] = true;
                pending.push_back(to);
            }
        }
    }
    order
}

fn main() {
    //   0 — 1 — 3
    //   |   |
    //   2 — 4
    let adj = vec![
        vec![1, 2], // 0
        vec![0, 3, 4], // 1
        vec![0, 4], // 2
        vec![1],    // 3
        vec![1, 2], // 4
    ];

    println!("stack frontier → {:?}   (dives deep)", traverse(&adj, 0, Frontier::Stack));
    println!("queue frontier → {:?}   (spreads level by level)", traverse(&adj, 0, Frontier::Queue));
}
```

> [!key] The frontier's discipline *is* the search strategy
> Both runs push exactly the same neighbours in exactly the same order. The stack version pulls the **most recently discovered** vertex, so it plunges as deep as it can before backtracking. The queue version pulls the **least recently discovered**, so it finishes each ring of neighbours before moving outward. That's the whole difference — and it's why BFS finds shortest paths in an unweighted graph (it can't reach distance 3 before finishing distance 2) while DFS does not. Swap in a **priority** queue ordered by distance and the same skeleton becomes [Dijkstra's algorithm](#/ch/dsa-shortest-path).

## The monotonic stack — a power technique

A **monotonic stack** keeps its elements in sorted order by popping ones that violate the order. It solves "next greater element"-style problems in a single O(n) pass instead of O(n²):

```rust
// For each element, find the next element to its right that is larger (-1 if none).
fn next_greater(nums: &[i32]) -> Vec<i32> {
    let mut result = vec![-1; nums.len()];
    let mut stack: Vec<usize> = Vec::new(); // holds indices, values decreasing

    for i in 0..nums.len() {
        // While the current element beats the stack's top, we've found ITS answer:
        while let Some(&top) = stack.last() {
            if nums[i] > nums[top] {
                result[top] = nums[i];
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
    println!("{:?}", next_greater(&[2, 1, 2, 4, 3]));
    // [4, 2, 4, -1, -1]  — each value's next-greater to the right
}
```

<figure class="diagram">
<svg viewBox="0 0 640 230" role="img" aria-label="A monotonic stack processing the values 2 1 2 4 3, showing how arriving at 4 pops the three smaller values on the stack and resolves their answers at once">
  <style>
    .ms-h { font: 700 11.5px var(--font-sans); fill: var(--text); }
    .ms-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .ms-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .ms-n { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.3; }
    .ms-in { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .ms-pop { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.6; }
  </style>
  <text x="20" y="16" class="ms-h">input: 2 1 2 4 3 — the stack holds indices whose answer isn't known yet</text>
  <text x="20" y="42" class="ms-c">after 2, 1, 2 — stack values are non-increasing, no answers found yet</text>
  <rect x="20" y="52" width="40" height="24" rx="3" class="ms-n"/><text x="34" y="69" class="ms-m">2</text>
  <rect x="64" y="52" width="40" height="24" rx="3" class="ms-n"/><text x="78" y="69" class="ms-m">1</text>
  <rect x="108" y="52" width="40" height="24" rx="3" class="ms-n"/><text x="122" y="69" class="ms-m">2</text>
  <text x="160" y="69" class="ms-c">← top</text>
  <text x="20" y="106" class="ms-h" fill="var(--rust-600)">4 arrives — it is the answer for everything smaller below it</text>
  <rect x="20" y="116" width="40" height="24" rx="3" class="ms-pop"/><text x="34" y="133" class="ms-m">2</text>
  <rect x="64" y="116" width="40" height="24" rx="3" class="ms-pop"/><text x="78" y="133" class="ms-m">1</text>
  <rect x="108" y="116" width="40" height="24" rx="3" class="ms-pop"/><text x="122" y="133" class="ms-m">2</text>
  <rect x="170" y="116" width="40" height="24" rx="3" class="ms-in"/><text x="184" y="133" class="ms-m">4</text>
  <text x="220" y="126" class="ms-c">pop 2 → answer 4</text>
  <text x="220" y="140" class="ms-c">pop 1 → answer 4, pop 2 → answer 4</text>
  <text x="20" y="176" class="ms-h">why it is O(n), not O(n²)</text>
  <text x="20" y="194" class="ms-c">The inner <tspan font-family="var(--font-mono)">while</tspan> looks like a nested loop, but every index is <tspan font-weight="700">pushed once and popped once</tspan>.</text>
  <text x="20" y="208" class="ms-c">Total pops across the entire run is therefore at most n — the work is linear no matter how it clusters.</text>
  <text x="20" y="224" class="ms-c">4 and 3 are never popped: nothing bigger follows them, so their answer stays −1.</text>
</svg>
<figcaption>A <b>monotonic stack</b> resolves several pending answers at once when a large value arrives — and each index is pushed and popped only once, keeping it <b>O(n)</b>.</figcaption>
</figure>

> [!tip] Spot the monotonic-stack pattern
> When a problem asks for the "next/previous greater/smaller element", the size of a histogram rectangle, or a span of stock prices — think **monotonic stack**. Each element is pushed and popped at most once, so the whole thing is O(n) despite the nested-looking `while`. It's a favorite in interviews and a genuinely useful trick.

## The monotonic deque — sliding window maximum

Push the same idea to a **double-ended** queue and you can answer "what is the maximum in every window of size `k`?" in O(n). The deque holds indices whose values decrease from front to back, so the front is always the current window's maximum:

```rust
use std::collections::VecDeque;

/// Maximum of every window of width k — O(n) total, O(k) space.
fn window_max(v: &[i32], k: usize) -> Vec<i32> {
    let mut dq: VecDeque<usize> = VecDeque::new(); // indices, values decreasing
    let mut out = Vec::new();

    for i in 0..v.len() {
        // 1. Drop the front if it has slid out of the window.
        while dq.front().is_some_and(|&f| i >= k && f + k <= i) {
            dq.pop_front();
        }
        // 2. Drop everything at the back that this value dominates —
        //    they can never be the maximum again.
        while dq.back().is_some_and(|&b| v[b] <= v[i]) {
            dq.pop_back();
        }
        dq.push_back(i);

        // 3. Once the first full window exists, the front is its maximum.
        if i + 1 >= k {
            out.push(v[*dq.front().unwrap()]);
        }
    }
    out
}

fn main() {
    let data = [1, 3, -1, -3, 5, 3, 6, 7];
    println!("data          {data:?}");
    println!("window max 3  {:?}", window_max(&data, 3));
    println!("window max 1  {:?}", window_max(&data, 1)); // each element itself
    println!("window max 8  {:?}", window_max(&data, 8)); // the global maximum
}
```

> [!key] Why a heap is the *wrong* tool here
> The instinctive answer to "maximum of a window" is a [max-heap](#/ch/dsa-heaps) — but removing the element that just left the window costs O(n) in a binary heap, because you have to find it first. That makes the whole scan O(n·k) or forces you into lazy deletion with extra bookkeeping. The monotonic deque avoids the problem entirely: elements leave only from the **ends**, and an element is discarded the moment a larger one arrives to its right, because it can never be the answer again. Two `pop`s at the ends beat a search every time.

> [!best] Reach for a monotonic structure when the answer is "recent and extreme"
> The unifying signal for both the stack and the deque version: you need the largest (or smallest) element among a *recent* set, and older elements become irrelevant once a better one arrives. If that's the shape, discarding dominated elements immediately keeps the structure small and the total work linear. Sliding-window minimum/maximum, next-greater-element, largest rectangle in a histogram, and several dynamic-programming optimisations all reduce to it.

## Summary

- A **stack** is **LIFO** (push/pop the same end) — use a **`Vec`** (`push`, `pop`, `last`), all O(1).
- A **queue** is **FIFO** (add back, remove front) — use a **`VecDeque`** (`push_back`, `pop_front`), O(1) both ends.
- Stacks power bracket matching, expression parsing, undo, and **DFS**; queues power scheduling, buffering, and **BFS** — DFS vs BFS is literally `pop_back` vs `pop_front` in the *same* function. Swap in a priority queue and you have Dijkstra.
- **Augment a stack** by storing the answer alongside each element: that's how `MinStack` gets O(1) `min`, which a single `min` field cannot do because `pop` couldn't restore the previous value.
- A stack turns **postfix (RPN)** evaluation into a dozen lines, and is what parsers use to handle nesting and precedence.
- The **monotonic stack** solves next-greater/smaller problems in one O(n) pass — each index is pushed and popped exactly once, which is why the nested `while` isn't quadratic.
- The **monotonic deque** answers sliding-window maximum in O(n), where a heap would be O(n·k) because removing the departing element requires finding it.

> [!exercise] Try it yourself
> 1. Use a stack to reverse a string (push each char, pop them all).
> 2. Extend `is_balanced` to also reject `"([)]"` (it already does — trace *why* through the stack).
> 3. Change `MinStack` to track the **maximum** instead. Then support *both* at once without a third stack.
> 4. Run `traverse` with both frontiers on a graph with a cycle. Confirm neither loops forever, and identify the line that prevents it.
> 5. Modify `traverse` so the stack version produces the *same* order as recursive DFS. (Hint: think about the order neighbours are pushed.)
> 6. Extend `eval_rpn` to support unary negation and a `%` operator. What breaks if you allow `-` to mean both?
> 7. Adapt `window_max` into `window_min` by changing exactly one comparison.
> 8. Implement a **queue using two stacks** with amortized O(1) `push` and `pop`. Why is it amortized rather than worst-case?
> 9. Use a monotonic stack to solve **largest rectangle in a histogram**. What do you push, and what does popping tell you?

Next, the algorithms for *finding* things: **searching**, including the elegant and essential binary search.
