<h1><span class="h1-kicker">Data Structures & Algorithms</span>Arrays, Vectors & Dynamic Arrays</h1>

The array is the most fundamental data structure — a block of elements laid out contiguously in memory. Rust gives you fixed-size arrays (`[T; N]`) and the growable `Vec<T>`, which *is* a dynamic array. Because arrays are so simple and cache-friendly, they're the backbone of countless algorithms. This chapter covers how they work under the hood and the essential array techniques (two pointers, sliding window) you'll reuse constantly.

## Contiguous memory = speed

> [!key] Why arrays are fast: cache locality
> An array stores its elements **side by side** in one block of memory. This gives two superpowers: (1) **O(1) random access** — the address of element `i` is just `start + i × size`, one arithmetic step; and (2) **cache locality** — modern CPUs load memory in chunks, so iterating a contiguous array feeds the cache perfectly, often 10×+ faster than chasing scattered pointers (as in a linked list). "Use a `Vec`" is good default advice largely *because* of this.

```rust
fn main() {
    let arr = [10, 20, 30, 40, 50];
    // O(1) access — no scanning, just address arithmetic:
    println!("{}", arr[3]); // 40

    // A Vec is a dynamic array — contiguous, but growable:
    let mut v = vec![1, 2, 3];
    v.push(4);        // amortized O(1)
    println!("{v:?}");
}
```

## The cost of each operation

| Operation | Array / Vec | Why |
|-----------|-------------|-----|
| Access by index | **O(1)** | direct address arithmetic |
| Update by index | **O(1)** | same |
| Push/pop at **end** | **O(1)** amortized | may reallocate occasionally |
| Insert/remove at **front/middle** | **O(n)** | must shift all following elements |
| Search (unsorted) | **O(n)** | must scan |
| Search (sorted) | **O(log n)** | binary search |

> [!key] The array trade-off
> Arrays are unbeatable for **indexing** and **iteration**, but **inserting or removing in the middle is O(n)** — every later element must shift over. If your workload is "add/remove at arbitrary positions a lot," an array isn't ideal (though it's often *still* faster than a linked list thanks to cache locality — measure!). If it's "index and iterate," the array wins hands down.

## How dynamic arrays grow

You saw this in the [Vectors chapter](#/ch/vectors): a `Vec` tracks **length** and **capacity**. When it fills up, it allocates a bigger buffer (typically **doubling**) and moves the elements. Doubling is the key to *amortized* O(1) pushes:

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="A dynamic array doubles its capacity when full, keeping pushes amortized O(1)">
  <style>
    .dam { font: 600 11px var(--font-mono); fill: var(--text); }
    .dac { font: 11px var(--font-sans); fill: var(--text-mute); }
    .u { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.2; }
    .f { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 3 2; }
  </style>
  <text x="14" y="24" class="dac">cap 2 (full) → push → cap 4 → … → cap 8:</text>
  <g class="dam">
    <rect x="14" y="34" width="26" height="24" class="u"/><rect x="40" y="34" width="26" height="24" class="u"/>
    <text x="80" y="51" class="dac">→</text>
    <rect x="100" y="34" width="26" height="24" class="u"/><rect x="126" y="34" width="26" height="24" class="u"/><rect x="152" y="34" width="26" height="24" class="u"/><rect x="178" y="34" width="26" height="24" class="f"/>
    <text x="216" y="51" class="dac">→</text>
    <rect x="236" y="34" width="26" height="24" class="u"/><rect x="262" y="34" width="26" height="24" class="u"/><rect x="288" y="34" width="26" height="24" class="u"/><rect x="314" y="34" width="26" height="24" class="u"/><rect x="340" y="34" width="26" height="24" class="u"/><rect x="366" y="34" width="26" height="24" class="f"/><rect x="392" y="34" width="26" height="24" class="f"/><rect x="418" y="34" width="26" height="24" class="f"/>
  </g>
  <text x="14" y="96" class="dac">Doubling means reallocations get rarer as the array grows, so the average push stays O(1).</text>
  <text x="14" y="116" class="dac">Know the size ahead? Vec::with_capacity(n) skips the intermediate growth entirely.</text>
</svg>
<figcaption>Doubling capacity on growth amortizes the occasional O(n) reallocation to O(1) per push.</figcaption>
</figure>

## Three techniques that solve most array problems

Almost every array question reduces to one of three moves. It's worth seeing them side by side before the code:

<figure class="diagram">
<svg viewBox="0 0 640 300" role="img" aria-label="Three array techniques illustrated: two pointers converging from both ends, a sliding window moving right while adding and removing at its edges, and a prefix sum array enabling constant time range queries">
  <style>
    .at-h { font: 700 11.5px var(--font-sans); }
    .at-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .at-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .at-cell { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; }
    .at-act { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .at-win { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.8; }
    .at-out { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.2; stroke-dasharray: 3 2; }
  </style>
  <text x="20" y="16" class="at-h" fill="var(--rust-600)">1 · two pointers — converge from both ends</text>
  <rect x="20" y="26" width="34" height="26" class="at-act"/><text x="31" y="44" class="at-m">1</text>
  <rect x="54" y="26" width="34" height="26" class="at-cell"/><text x="65" y="44" class="at-m">3</text>
  <rect x="88" y="26" width="34" height="26" class="at-cell"/><text x="99" y="44" class="at-m">4</text>
  <rect x="122" y="26" width="34" height="26" class="at-cell"/><text x="133" y="44" class="at-m">6</text>
  <rect x="156" y="26" width="34" height="26" class="at-cell"/><text x="167" y="44" class="at-m">8</text>
  <rect x="190" y="26" width="34" height="26" class="at-act"/><text x="198" y="44" class="at-m">11</text>
  <text x="30" y="66" class="at-c">lo →</text><text x="196" y="66" class="at-c">← hi</text>
  <text x="248" y="34" class="at-c">sum too small → move lo right</text>
  <text x="248" y="48" class="at-c">sum too big → move hi left</text>
  <text x="248" y="62" class="at-c">each pointer moves at most n times → <tspan font-weight="700">O(n)</tspan></text>
  <text x="20" y="104" class="at-h" fill="var(--green)">2 · sliding window — add at the right, drop at the left</text>
  <rect x="20" y="114" width="34" height="26" class="at-out"/><text x="31" y="132" class="at-m">2</text>
  <rect x="54" y="114" width="34" height="26" class="at-win"/><text x="65" y="132" class="at-m">1</text>
  <rect x="88" y="114" width="34" height="26" class="at-win"/><text x="99" y="132" class="at-m">5</text>
  <rect x="122" y="114" width="34" height="26" class="at-win"/><text x="133" y="132" class="at-m">1</text>
  <rect x="156" y="114" width="34" height="26" class="at-out"/><text x="167" y="132" class="at-m">3</text>
  <rect x="190" y="114" width="34" height="26" class="at-out"/><text x="201" y="132" class="at-m">2</text>
  <path d="M62 148 L148 148" stroke="var(--green)" stroke-width="2" fill="none"/>
  <text x="62" y="162" class="at-c">window sum = 7</text>
  <path d="M96 106 L182 106" stroke="var(--green)" stroke-width="2" stroke-dasharray="4 3" fill="none" marker-end="url(#arr-arrtech)"/>
  <text x="248" y="122" class="at-c">slide: <tspan font-family="var(--font-mono)">sum += new − old</tspan></text>
  <text x="248" y="136" class="at-c">no recomputing the overlap</text>
  <text x="248" y="150" class="at-c">n slides, O(1) each → <tspan font-weight="700">O(n)</tspan></text>
  <text x="20" y="196" class="at-h" fill="var(--blue)">3 · prefix sums — precompute once, then any range in O(1)</text>
  <text x="20" y="216" class="at-c">values</text>
  <rect x="70" y="206" width="30" height="24" class="at-cell"/><text x="80" y="223" class="at-m">3</text>
  <rect x="100" y="206" width="30" height="24" class="at-cell"/><text x="110" y="223" class="at-m">1</text>
  <rect x="130" y="206" width="30" height="24" class="at-cell"/><text x="140" y="223" class="at-m">4</text>
  <rect x="160" y="206" width="30" height="24" class="at-cell"/><text x="170" y="223" class="at-m">1</text>
  <rect x="190" y="206" width="30" height="24" class="at-cell"/><text x="200" y="223" class="at-m">5</text>
  <text x="20" y="256" class="at-c">prefix</text>
  <rect x="55" y="246" width="30" height="24" class="at-cell"/><text x="65" y="263" class="at-m">0</text>
  <rect x="85" y="246" width="30" height="24" class="at-cell"/><text x="95" y="263" class="at-m">3</text>
  <rect x="115" y="246" width="30" height="24" class="at-act"/><text x="125" y="263" class="at-m">4</text>
  <rect x="145" y="246" width="30" height="24" class="at-cell"/><text x="155" y="263" class="at-m">8</text>
  <rect x="175" y="246" width="30" height="24" class="at-cell"/><text x="185" y="263" class="at-m">9</text>
  <rect x="205" y="246" width="30" height="24" class="at-act"/><text x="212" y="263" class="at-m">14</text>
  <text x="248" y="252" class="at-c">sum of values[2..5] = prefix[5] − prefix[2]</text>
  <text x="248" y="266" class="at-c">= 14 − 4 = 10, in <tspan font-weight="700">one subtraction</tspan></text>
  <text x="20" y="290" class="at-c">Two pointers and sliding windows are <tspan font-style="italic">single-pass</tspan>; prefix sums trade <tspan font-family="var(--font-mono)">O(n)</tspan> memory for <tspan font-family="var(--font-mono)">O(1)</tspan> repeated queries.</text>
  <defs><marker id="arr-arrtech" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker></defs>
</svg>
<figcaption>The three moves behind most array algorithms: <b>converge</b> from both ends, <b>slide</b> a window, or <b>precompute</b> prefix sums.</figcaption>
</figure>

## Technique 1: two pointers

Many array problems that *look* like they need `O(n²)` nested loops can be solved in `O(n)` with **two pointers** moving toward each other (or in the same direction). Classic example: find two numbers in a *sorted* array that sum to a target:

```rust
// Two pointers: O(n) time, O(1) space — no nested loop needed.
fn two_sum_sorted(arr: &[i32], target: i32) -> Option<(usize, usize)> {
    let (mut lo, mut hi) = (0usize, arr.len().wrapping_sub(1));
    while lo < hi {
        let sum = arr[lo] + arr[hi];
        if sum == target {
            return Some((lo, hi));
        } else if sum < target {
            lo += 1; // need a bigger sum → move the low pointer up
        } else {
            hi -= 1; // need a smaller sum → move the high pointer down
        }
    }
    None
}

fn main() {
    let sorted = [1, 3, 4, 6, 8, 11];
    println!("{:?}", two_sum_sorted(&sorted, 10)); // Some((2, 3)) → 4 + 6
    println!("{:?}", two_sum_sorted(&sorted, 100)); // None
}
```

> [!key] Two pointers turns O(n²) into O(n)
> Whenever you'd otherwise compare *pairs* of elements with a double loop — and the array is sorted or you can process from both ends — the two-pointer technique collapses it to a single pass. Watch for it in problems about pairs, palindromes, merging, and partitioning. It's one of the highest-leverage patterns in algorithm interviews and real code alike.

## Technique 2: sliding window

For problems about *contiguous subarrays* ("max sum of any 3 consecutive elements", "longest substring without repeats"), a **sliding window** avoids recomputing overlapping work. Slide a window across the array, adding the new element and removing the old one in O(1):

```rust
// Max sum of any window of size k — O(n) instead of O(n·k).
fn max_window_sum(arr: &[i32], k: usize) -> Option<i32> {
    if k == 0 || arr.len() < k {
        return None;
    }
    let mut window: i32 = arr[..k].iter().sum(); // first window
    let mut best = window;
    for i in k..arr.len() {
        window += arr[i] - arr[i - k]; // slide: add new, drop oldest — O(1)
        best = best.max(window);
    }
    Some(best)
}

fn main() {
    println!("{:?}", max_window_sum(&[2, 1, 5, 1, 3, 2], 3)); // Some(9) → 5+1+3
}
```

### The variable-size window

That version has a *fixed* width. The harder and far more common variant lets the window **grow and shrink**: expand the right edge to include more, then contract the left edge while some condition still holds. Both pointers still only ever move forward, so it stays O(n).

```rust
use std::collections::HashMap;

/// Shortest contiguous window whose sum is at least `target`.
/// Grow right to reach the target, then shrink left while it still holds.
fn min_window_at_least(v: &[i64], target: i64) -> Option<usize> {
    let (mut lo, mut sum, mut best) = (0usize, 0i64, usize::MAX);
    for hi in 0..v.len() {
        sum += v[hi];
        while sum >= target {
            best = best.min(hi - lo + 1);
            sum -= v[lo];
            lo += 1;
        }
    }
    (best != usize::MAX).then_some(best)
}

/// Longest window containing no repeated element.
/// When we meet a duplicate, jump `lo` past its previous position.
fn longest_distinct(v: &[i32]) -> usize {
    let mut last_seen: HashMap<i32, usize> = HashMap::new();
    let (mut lo, mut best) = (0usize, 0usize);
    for (hi, &x) in v.iter().enumerate() {
        if let Some(&prev) = last_seen.get(&x) {
            if prev >= lo {
                lo = prev + 1; // shrink past the earlier copy
            }
        }
        last_seen.insert(x, hi);
        best = best.max(hi - lo + 1);
    }
    best
}

fn main() {
    let v = [3i64, 1, 4, 1, 5, 9, 2, 6];
    println!("shortest window summing to >= 15: {:?}", min_window_at_least(&v, 15));
    println!("(that's [5, 9, 2] — length 3)");

    println!("longest all-distinct window: {}", longest_distinct(&[1, 2, 3, 1, 4, 5, 2]));
    println!("(that's [3, 1, 4, 5, 2] — length 5)");
}
```

> [!key] The variable-window template
> Almost every "longest/shortest subarray such that…" problem is this shape:
> ```rust,ignore
> let mut lo = 0;
> for hi in 0..n {
>     // 1. include v[hi] in the window's running state
>     while /* window is invalid, or valid and we want it smaller */ {
>         // 2. remove v[lo] from the state
>         lo += 1;
>     }
>     // 3. record the answer for this window
> }
> ```
> The only decisions are *what state you track* (a sum, a count map, a max) and *what condition drives the inner `while`*. Because `lo` and `hi` each advance at most `n` times in total, the nested loop is still **O(n)** — a point worth pausing on, since it looks quadratic at a glance.

## Technique 3: prefix sums

If you need the sum of many *different* ranges, recomputing each one is O(n) per query. **Prefix sums** precompute cumulative totals once, after which any range costs a single subtraction:

```rust
struct Prefix {
    /// sums[i] is the total of the first i elements, so sums[0] == 0.
    sums: Vec<i64>,
}

impl Prefix {
    fn new(v: &[i64]) -> Self {
        let mut sums = Vec::with_capacity(v.len() + 1);
        sums.push(0);
        for &x in v {
            sums.push(sums[sums.len() - 1] + x);
        }
        Prefix { sums }
    }

    /// Sum of v[lo..hi] — half-open, like every Rust range.
    fn range(&self, lo: usize, hi: usize) -> i64 {
        self.sums[hi] - self.sums[lo]
    }
}

/// Kadane's algorithm: largest sum of any contiguous subarray, in one pass.
/// Returns (sum, start, end_inclusive).
fn max_subarray(v: &[i64]) -> Option<(i64, usize, usize)> {
    if v.is_empty() {
        return None;
    }
    let (mut best, mut current) = (v[0], v[0]);
    let (mut best_start, mut best_end, mut cur_start) = (0usize, 0usize, 0usize);

    for i in 1..v.len() {
        // A negative running total can never help — restart from here.
        if current < 0 {
            current = v[i];
            cur_start = i;
        } else {
            current += v[i];
        }
        if current > best {
            best = current;
            best_start = cur_start;
            best_end = i;
        }
    }
    Some((best, best_start, best_end))
}

fn main() {
    let v = [3i64, 1, 4, 1, 5, 9, 2, 6];
    let prefix = Prefix::new(&v);
    println!("prefix table   {:?}", prefix.sums);
    println!("sum of v[2..5] {}  (4 + 1 + 5)", prefix.range(2, 5));
    println!("sum of all     {}", prefix.range(0, v.len()));

    let mixed = [-2i64, 1, -3, 4, -1, 2, 1, -5, 4];
    let (sum, from, to) = max_subarray(&mixed).unwrap();
    println!("\nbest subarray sum {sum} over indices {from}..={to} → {:?}", &mixed[from..=to]);
}
```

> [!best] The `sums[0] = 0` sentinel is what makes prefix sums painless
> Notice the prefix array has `n + 1` entries with a leading zero. That single extra slot means `range(lo, hi)` is `sums[hi] - sums[lo]` with **no special case** for `lo == 0`. Without it you need an `if lo == 0 { sums[hi] } else { … }` branch, which is exactly where off-by-one bugs breed. The same sentinel trick makes 2D prefix sums (for rectangle queries) and difference arrays (for range *updates*) clean.

> [!performance] Prefix sums pay off from the second query onward
> Building the table is O(n) and costs O(n) memory, so for a **single** range query it's strictly worse than just summing the slice. It wins the moment you have repeated queries: `q` queries cost `O(n + q)` instead of `O(n·q)`. If the underlying data *changes* between queries the table goes stale — at that point you want a [Fenwick tree or segment tree](#/ch/dsa-advanced), which support updates in O(log n).

## Build one yourself

The fastest way to believe "amortized O(1)" is to implement the growth and count the work. This version stores elements in a boxed slice and reallocates by hand — no `unsafe`, at the cost of requiring `T: Default`:

```rust
/// A dynamic array built from a fixed-size boxed slice, so the growth is visible.
/// Real `Vec` uses raw allocation and `MaybeUninit`; requiring `T: Default`
/// lets us stay in safe Rust while keeping the mechanics identical.
struct DynArray<T> {
    buf: Box<[T]>,
    len: usize,
    // Instrumentation, purely so we can measure the amortization.
    reallocations: usize,
    elements_moved: usize,
}

impl<T: Default + Clone> DynArray<T> {
    fn new() -> Self {
        DynArray { buf: Box::new([]), len: 0, reallocations: 0, elements_moved: 0 }
    }

    fn capacity(&self) -> usize { self.buf.len() }
    fn len(&self) -> usize { self.len }

    /// The whole trick: DOUBLE, never grow by a constant.
    fn grow(&mut self) {
        let new_cap = if self.capacity() == 0 { 1 } else { self.capacity() * 2 };
        let mut new_buf = vec![T::default(); new_cap].into_boxed_slice();
        for i in 0..self.len {
            new_buf[i] = std::mem::take(&mut self.buf[i]); // move, don't clone
        }
        self.elements_moved += self.len;
        self.reallocations += 1;
        self.buf = new_buf;
    }

    fn push(&mut self, value: T) {
        if self.len == self.capacity() {
            self.grow();
        }
        self.buf[self.len] = value;
        self.len += 1;
    }

    fn pop(&mut self) -> Option<T> {
        if self.len == 0 {
            return None;
        }
        self.len -= 1;
        Some(std::mem::take(&mut self.buf[self.len]))
    }

    fn get(&self, i: usize) -> Option<&T> {
        if i < self.len { Some(&self.buf[i]) } else { None }
    }
}

fn main() {
    let mut a: DynArray<i32> = DynArray::new();
    for x in 1..=10 {
        let before = a.capacity();
        a.push(x);
        if a.capacity() != before {
            println!("  push {x:>2}: capacity {before} -> {}", a.capacity());
        }
    }
    println!("len {} capacity {}", a.len(), a.capacity());
    println!("get(3) = {:?}", a.get(3).copied());
    println!("pop()  = {:?}", a.pop());

    println!("\nAmortization, measured:");
    for n in [1usize, 10, 100, 1_000, 10_000] {
        let mut d: DynArray<u32> = DynArray::new();
        for i in 0..n {
            d.push(i as u32);
        }
        println!(
            "{n:>6} pushes -> {:>2} reallocations, {:>6} moves ({:.2} per push)",
            d.reallocations,
            d.elements_moved,
            d.elements_moved as f64 / n as f64
        );
    }
    println!("\nMoves per push stay under 2 however large n gets — total moves < 2n.");
    println!("That bound is exactly what 'amortized O(1)' means.");
}
```

> [!key] Why doubling, and not "grow by 10"?
> Growing by a **constant** amount makes push O(n) amortized, not O(1). Adding 10 slots at a time over `n` pushes means about `n/10` reallocations, each copying an average of `n/2` elements — that's `O(n²)` total work. Doubling gives only `log₂ n` reallocations, and the copies form a geometric series `1 + 2 + 4 + … + n < 2n`, so the *total* work is linear and each push averages under two moves. The run above shows that bound holding from 1 push to 10,000. Any constant growth factor above 1 works; the standard library uses 2.

> [!note] `capacity` is not `len`, and `pop` doesn't shrink
> Notice that after 10 pushes the capacity is 16, and popping doesn't give memory back. Real `Vec` behaves the same way: capacity only ever grows unless you ask, because shrinking on every `pop` would reintroduce the reallocation churn doubling exists to avoid. If you've drained a large `Vec` and want the memory returned, call **`shrink_to_fit()`** explicitly.

## In-place operations

Working *in place* (mutating the array without extra space) keeps space at `O(1)`. Rust's slice methods make many of these one-liners — and the standard library is highly optimized, so prefer it over hand-rolling:

```rust
fn main() {
    let mut v = vec![5, 2, 8, 1, 9, 3, 3];

    v.sort();                       // in-place, O(n log n) → [1,2,3,3,5,8,9]
    v.dedup();                      // drops CONSECUTIVE duplicates → [1,2,3,5,8,9]
    println!("sorted & deduped  {v:?}");

    // binary_search requires ASCENDING order — do it before any reverse.
    println!("binary_search(&8) {:?}", v.binary_search(&8));   // Ok(4)
    println!("binary_search(&4) {:?}", v.binary_search(&4));   // Err(3) = insert here

    // partition_point is the "lower bound" you usually actually want.
    println!("first index >= 5   {}", v.partition_point(|&x| x < 5));

    v.rotate_left(2);               // O(n) — moves the first 2 to the end
    println!("rotated left by 2 {v:?}");
    v.reverse();                    // O(n)
    println!("reversed          {v:?}");
}
```

> [!mistake] `binary_search` on descending data returns nonsense, not an error
> `binary_search` and `partition_point` require **ascending** order, and Rust cannot check that for you — the slice methods have no way to know. Call them on a reversed or unsorted slice and you get an arbitrary `Ok`/`Err` with no warning: searching for `8` in a descending `[9,8,5,3,2,1]` returns `Err(6)`, silently claiming the value is absent. For descending data, either search the reversed view or use `binary_search_by(|x| target.cmp(x))` to flip the comparison. Also note `dedup` only removes **adjacent** duplicates, so it's near-useless without sorting first.

> [!best] Reach for `std` slice methods before writing your own
> Rust's slice API (`sort`, `sort_unstable`, `binary_search`, `partition_point`, `rotate_left`, `windows`, `chunks`, `iter().position()`) covers most array algorithms with battle-tested, optimized code. Implement an algorithm from scratch to *learn* it (as we do in this course), but in real code, use `std` — it's faster and correct. `sort_unstable` is often the fastest general sort when you don't need stability.

## Summary

- Arrays/`Vec` store elements **contiguously**, giving **O(1)** indexing and excellent **cache locality** — the reason they're the default collection.
- The trade-off: **insert/remove in the middle is O(n)** (shifting); a dynamic array **doubles capacity** on growth for **amortized O(1)** pushes (pre-size with `with_capacity`).
- **Doubling is essential** — growing by a constant makes total work `O(n²)`. Doubling bounds total element moves at `< 2n`, which is what amortized O(1) means.
- **Two pointers** collapses many pair/palindrome/partition problems from `O(n²)` to `O(n)`.
- **Sliding window** solves contiguous-subarray problems in `O(n)`. Learn the **variable-size template** — expand right, contract left — since most real questions need it.
- **Prefix sums** turn `q` range queries from `O(n·q)` into `O(n + q)`. Keep the leading `0` sentinel to avoid off-by-one branches. If the data changes between queries, use a [Fenwick or segment tree](#/ch/dsa-advanced) instead.
- **Kadane's algorithm** finds the maximum-sum subarray in one pass by restarting whenever the running total goes negative.
- Prefer **`std` slice methods** (`sort`, `binary_search`, `rotate_left`, …) for real work — they're optimized and correct.

> [!exercise] Try it yourself
> 1. Use two pointers to reverse an array in place (swap ends, move inward) — no `.reverse()`.
> 2. Use a sliding window to find the length of the longest run of consecutive equal elements.
> 3. Given a sorted array with duplicates, remove the duplicates in place and return the new length (two pointers).
> 4. Change `DynArray::grow` to add a fixed 4 slots instead of doubling. Re-run the measurement — how do moves-per-push behave as `n` grows now?
> 5. Use the variable-window template for: longest window with **at most two** distinct values.
> 6. Build a **2D prefix sum** over a grid so you can query the sum of any rectangle in O(1). What's the inclusion–exclusion formula?
> 7. Implement a **difference array**: support `add(lo, hi, delta)` in O(1) and produce the final values in one O(n) pass. When is this better than prefix sums?
> 8. Extend Kadane's to return the maximum-**product** subarray. Why do you now need to track a running *minimum* too?

Next, two structures built *on top of* arrays that impose useful discipline on how you add and remove: **stacks and queues**.
