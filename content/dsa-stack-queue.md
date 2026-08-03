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

> [!tip] Spot the monotonic-stack pattern
> When a problem asks for the "next/previous greater/smaller element", the size of a histogram rectangle, or a span of stock prices — think **monotonic stack**. Each element is pushed and popped at most once, so the whole thing is O(n) despite the nested-looking `while`. It's a favorite in interviews and a genuinely useful trick.

## Summary

- A **stack** is **LIFO** (push/pop the same end) — use a **`Vec`** (`push`, `pop`, `last`), all O(1).
- A **queue** is **FIFO** (add back, remove front) — use a **`VecDeque`** (`push_back`, `pop_front`), O(1) both ends.
- Stacks power bracket matching, expression parsing, undo, and **DFS**; queues power scheduling, buffering, and **BFS** — DFS vs BFS is literally "stack vs queue."
- The **monotonic stack** solves next-greater/smaller-style problems in a single O(n) pass.

> [!exercise] Try it yourself
> 1. Use a stack to reverse a string (push each char, pop them all).
> 2. Extend `is_balanced` to also reject `"([)]"` (it already does — trace *why* through the stack).
> 3. Implement a `MinStack` that supports `push`, `pop`, and `min` all in O(1) (hint: keep a second stack of running minimums).

Next, the algorithms for *finding* things: **searching**, including the elegant and essential binary search.
