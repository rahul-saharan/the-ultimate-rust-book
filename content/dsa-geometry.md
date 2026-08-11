<h1><span class="h1-kicker">Data Structures & Algorithms</span>Computational Geometry</h1>

Geometry problems look intimidating and are mostly built from one primitive: the **cross product**. Once you can answer "is this point left or right of that line?", you can determine orientation, find intersections, compute areas, and build convex hulls. This chapter develops that one tool and then uses it everywhere.

The other half of the chapter is about a trap that catches everyone: floating-point comparison.

## Points and vectors

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    /// The vector from self to other.
    fn to(self, other: Point) -> Point {
        Point::new(other.x - self.x, other.y - self.y)
    }

    /// Dot product: |a||b|cos θ. Positive when the vectors point the same way.
    fn dot(self, other: Point) -> f64 {
        self.x * other.x + self.y * other.y
    }

    /// 2D cross product (really the z-component of the 3D one).
    /// This single number is the workhorse of the whole chapter.
    fn cross(self, other: Point) -> f64 {
        self.x * other.y - self.y * other.x
    }

    fn length(self) -> f64 {
        self.dot(self).sqrt()
    }

    /// Squared distance — prefer this for COMPARISONS: no sqrt, no precision loss.
    fn dist_sq(self, other: Point) -> f64 {
        let d = self.to(other);
        d.dot(d)
    }

    fn dist(self, other: Point) -> f64 {
        self.dist_sq(other).sqrt()
    }
}

fn main() {
    let a = Point::new(0.0, 0.0);
    let b = Point::new(3.0, 4.0);

    println!("a → b        = {:?}", a.to(b));
    println!("|a → b|      = {}", a.dist(b));          // 5.0
    println!("dist_sq      = {}", a.dist_sq(b));       // 25.0 — no sqrt needed
    println!("dot          = {}", b.dot(Point::new(1.0, 0.0)));
    println!("cross        = {}", b.cross(Point::new(1.0, 0.0)));
}
```

> [!performance] Compare squared distances, never distances
> `sqrt` is relatively slow and introduces rounding error. Since `sqrt` is monotonic, `a.dist(b) < a.dist(c)` is exactly equivalent to `a.dist_sq(b) < a.dist_sq(c)` — so for finding the nearest point, sorting by distance, or testing "is it within radius r" (compare against `r*r`), you never need the square root at all. Take it only when you must report an actual length to a human.

## The cross product: orientation

The sign of the cross product tells you which way three points turn. This is the primitive everything else is built from.

<figure class="diagram">
<svg viewBox="0 0 640 220" role="img" aria-label="Three points turning counter-clockwise give a positive cross product, clockwise gives negative, and collinear gives zero">
  <style>
    .gm-h { font: 700 12px var(--font-sans); }
    .gm-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .gm-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .gm-pt { fill: var(--rust-500); }
    .gm-l { stroke: var(--rust-500); stroke-width: 2; fill: none; }
    .gm-lb { stroke: var(--blue); stroke-width: 2; fill: none; }
    .gm-lg { stroke: var(--text-mute); stroke-width: 2; fill: none; stroke-dasharray: 4 3; }
  </style>
  <text x="30" y="18" class="gm-h" fill="var(--green)">cross &gt; 0 — counter-clockwise (left turn)</text>
  <g transform="translate(40,30)">
    <path d="M0 100 L70 100 L100 30" class="gm-l"/>
    <circle cx="0" cy="100" r="4" class="gm-pt"/><text x="-6" y="118" class="gm-m">a</text>
    <circle cx="70" cy="100" r="4" class="gm-pt"/><text x="64" y="118" class="gm-m">b</text>
    <circle cx="100" cy="30" r="4" class="gm-pt"/><text x="106" y="28" class="gm-m">c</text>
    <path d="M60 92 A 18 18 0 0 0 76 84" stroke="var(--green)" stroke-width="2" fill="none"/>
  </g>
  <text x="250" y="18" class="gm-h" fill="var(--red)">cross &lt; 0 — clockwise (right turn)</text>
  <g transform="translate(255,30)">
    <path d="M0 30 L70 30 L100 100" class="gm-lb"/>
    <circle cx="0" cy="30" r="4" class="gm-pt"/><text x="-6" y="22" class="gm-m">a</text>
    <circle cx="70" cy="30" r="4" class="gm-pt"/><text x="64" y="22" class="gm-m">b</text>
    <circle cx="100" cy="100" r="4" class="gm-pt"/><text x="106" y="112" class="gm-m">c</text>
    <path d="M60 38 A 18 18 0 0 1 76 46" stroke="var(--red)" stroke-width="2" fill="none"/>
  </g>
  <text x="460" y="18" class="gm-h" fill="var(--text-mute)">cross = 0 — collinear</text>
  <g transform="translate(465,30)">
    <path d="M0 70 L100 70" class="gm-lg"/>
    <circle cx="0" cy="70" r="4" class="gm-pt"/><text x="-6" y="88" class="gm-m">a</text>
    <circle cx="50" cy="70" r="4" class="gm-pt"/><text x="44" y="88" class="gm-m">b</text>
    <circle cx="100" cy="70" r="4" class="gm-pt"/><text x="94" y="88" class="gm-m">c</text>
  </g>
  <text x="30" y="176" class="gm-m">cross(a→b, a→c) = (bx−ax)(cy−ay) − (by−ay)(cx−ax)</text>
  <text x="30" y="196" class="gm-c">Its magnitude is TWICE the area of triangle abc — which is why the same formula gives polygon area.</text>
  <text x="30" y="212" class="gm-c">Every algorithm below is this one expression, applied in a loop.</text>
</svg>
<figcaption>The <b>sign</b> of the cross product gives orientation; its <b>magnitude</b> gives twice the triangle area. Two answers from one multiplication.</figcaption>
</figure>

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
    fn to(self, other: Point) -> Point {
        Point::new(other.x - self.x, other.y - self.y)
    }
    fn cross(self, other: Point) -> f64 {
        self.x * other.y - self.y * other.x
    }
}

#[derive(Debug, PartialEq)]
enum Turn {
    Left,      // counter-clockwise
    Right,     // clockwise
    Collinear,
}

/// Which way do we turn going a → b → c?
fn orientation(a: Point, b: Point, c: Point) -> Turn {
    let cross = a.to(b).cross(a.to(c));
    // Compare against an epsilon, NOT against 0.0 — see the warning below.
    const EPS: f64 = 1e-9;
    if cross > EPS {
        Turn::Left
    } else if cross < -EPS {
        Turn::Right
    } else {
        Turn::Collinear
    }
}

/// Twice the signed area of triangle abc.
fn triangle_area2(a: Point, b: Point, c: Point) -> f64 {
    a.to(b).cross(a.to(c))
}

fn main() {
    let a = Point::new(0.0, 0.0);
    let b = Point::new(4.0, 0.0);

    println!("{:?}", orientation(a, b, Point::new(2.0, 3.0)));  // Left
    println!("{:?}", orientation(a, b, Point::new(2.0, -3.0))); // Right
    println!("{:?}", orientation(a, b, Point::new(8.0, 0.0)));  // Collinear

    // Area of a triangle, straight from the cross product.
    let area = triangle_area2(a, b, Point::new(0.0, 3.0)).abs() / 2.0;
    println!("triangle area = {area}"); // 6.0

    // Collinearity is just orientation == Collinear.
    let pts = [Point::new(1.0, 1.0), Point::new(2.0, 2.0), Point::new(3.0, 3.0)];
    println!("collinear? {}", orientation(pts[0], pts[1], pts[2]) == Turn::Collinear);
}
```

> [!key] Everything in this chapter is the cross product in a loop
> Segment intersection is four orientation tests. Convex hull is "keep turning the same way". Polygon area is a sum of cross products. Point-in-polygon is a sequence of orientation tests. Learn to compute and interpret `cross` and you have the whole toolkit — which is why this is the first thing any geometry course teaches.

## Floating point: the real difficulty

> [!warning] Never compare geometric floats with `==` or against exact `0.0`
> `0.1 + 0.2 != 0.3` in binary floating point, and three points that are mathematically collinear will produce a cross product of `-2.2e-16` rather than `0.0`. Comparing against exact zero therefore misclassifies them, and a convex-hull algorithm that mis-detects collinearity can loop forever or produce a broken polygon. Always compare against an **epsilon** — and choose it relative to your coordinate magnitudes, because `1e-9` is far too small for coordinates in the millions.

```rust
fn main() {
    // The classic demonstration.
    println!("0.1 + 0.2 == 0.3 ? {}", 0.1 + 0.2 == 0.3);
    println!("0.1 + 0.2         = {:.20}", 0.1 + 0.2);

    // An absolute epsilon works when magnitudes are known and modest.
    fn approx_eq_abs(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    // A RELATIVE epsilon scales with the values — necessary for large coordinates.
    fn approx_eq(a: f64, b: f64) -> bool {
        const EPS: f64 = 1e-9;
        let diff = (a - b).abs();
        if diff < EPS {
            return true; // handles values near zero
        }
        diff < EPS * a.abs().max(b.abs())
    }

    println!("\nabs eps at small scale:  {}", approx_eq_abs(0.1 + 0.2, 0.3, 1e-9));
    println!("abs eps at large scale:  {}", approx_eq_abs(1e9 + 0.1, 1e9 + 0.2, 1e-9));
    println!("rel eps at large scale:  {}", approx_eq(1e9, 1e9 + 1.0));

    // The bulletproof alternative: use integers when your input is integral.
    // Cross products of i64 coordinates are EXACT — no epsilon needed at all.
    fn cross_i64(ax: i64, ay: i64, bx: i64, by: i64, cx: i64, cy: i64) -> i64 {
        (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    }
    println!("\nexact integer cross: {}", cross_i64(0, 0, 4, 0, 2, 3));
    println!("exact collinear:     {}", cross_i64(0, 0, 2, 2, 4, 4)); // exactly 0
}
```

> [!best] Use integer coordinates whenever your input is integral
> If points come from a grid, pixels, or map tiles scaled to integers, do all your cross products in `i64` (or `i128` for large coordinates). The results are **exact**: collinear means exactly zero, and no epsilon is needed anywhere. This eliminates the entire category of floating-point geometry bug, and it's why competitive programming problems specify integer coordinates. Convert to floats only at the very end, to report a length or an area.

## Convex hull: the Andrew monotone chain

The **convex hull** is the smallest convex polygon containing every point — imagine a rubber band snapped around a set of pins. Andrew's monotone chain sorts the points and builds the lower and upper boundaries in O(n log n).

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct Point {
    x: i64,
    y: i64,
}

/// Exact cross product with integer coordinates — no epsilon required.
fn cross(o: Point, a: Point, b: Point) -> i64 {
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/// Andrew's monotone chain. Returns the hull counter-clockwise.
fn convex_hull(mut pts: Vec<Point>) -> Vec<Point> {
    if pts.len() < 3 {
        return pts;
    }

    // Sort by x, then y. This is what makes the two-chain approach work.
    pts.sort_by(|p, q| p.x.cmp(&q.x).then(p.y.cmp(&q.y)));
    pts.dedup();

    let mut hull: Vec<Point> = Vec::with_capacity(pts.len() * 2);

    // Lower hull: walk left to right, popping any clockwise turn.
    for &p in &pts {
        while hull.len() >= 2 && cross(hull[hull.len() - 2], hull[hull.len() - 1], p) <= 0 {
            hull.pop();
        }
        hull.push(p);
    }

    // Upper hull: walk right to left, same rule.
    let lower_len = hull.len() + 1;
    for &p in pts.iter().rev().skip(1) {
        while hull.len() >= lower_len && cross(hull[hull.len() - 2], hull[hull.len() - 1], p) <= 0 {
            hull.pop();
        }
        hull.push(p);
    }

    hull.pop(); // the first point appears twice
    hull
}

fn main() {
    let points = vec![
        Point { x: 0, y: 0 },
        Point { x: 4, y: 0 },
        Point { x: 4, y: 4 },
        Point { x: 0, y: 4 },
        Point { x: 2, y: 2 }, // interior — must be excluded
        Point { x: 2, y: 1 }, // interior
        Point { x: 1, y: 3 }, // interior
    ];

    let hull = convex_hull(points.clone());
    println!("{} points → hull of {}", points.len(), hull.len());
    for p in &hull {
        println!("  ({}, {})", p.x, p.y);
    }

    // Degenerate cases behave sensibly.
    println!("\ncollinear input: {:?}", convex_hull(vec![
        Point { x: 0, y: 0 },
        Point { x: 1, y: 1 },
        Point { x: 2, y: 2 },
    ]).len());
}
```

> [!mistake] `<= 0` versus `< 0` decides whether collinear points stay on the hull
> With `<= 0` the algorithm pops collinear points, so the hull contains only true corners. With `< 0` it keeps them, so a hull edge may include intermediate points. Both are legitimate — but problems differ on which they want, and mixing the two between the lower and upper chains produces a subtly broken hull. Pick one and use it in both loops.

## Polygon area and point containment

```rust
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

/// The shoelace formula: sum of cross products around the boundary.
/// Positive result → counter-clockwise winding; negative → clockwise.
fn signed_area(poly: &[Point]) -> f64 {
    if poly.len() < 3 {
        return 0.0;
    }
    let mut sum = 0.0;
    for i in 0..poly.len() {
        let a = poly[i];
        let b = poly[(i + 1) % poly.len()]; // wrap to close the polygon
        sum += a.x * b.y - b.x * a.y;
    }
    sum / 2.0
}

fn area(poly: &[Point]) -> f64 {
    signed_area(poly).abs()
}

/// Ray casting: count how many edges a ray to the right crosses.
/// Odd → inside, even → outside. Works for concave polygons too.
fn contains(poly: &[Point], p: Point) -> bool {
    let mut inside = false;
    let n = poly.len();
    for i in 0..n {
        let a = poly[i];
        let b = poly[(i + 1) % n];

        // Does the edge straddle p's horizontal line?
        let straddles = (a.y > p.y) != (b.y > p.y);
        if straddles {
            // Where does the edge cross that line?
            let x_cross = a.x + (p.y - a.y) / (b.y - a.y) * (b.x - a.x);
            if p.x < x_cross {
                inside = !inside;
            }
        }
    }
    inside
}

/// Perimeter — the one place you genuinely need sqrt.
fn perimeter(poly: &[Point]) -> f64 {
    (0..poly.len())
        .map(|i| {
            let a = poly[i];
            let b = poly[(i + 1) % poly.len()];
            ((b.x - a.x).powi(2) + (b.y - a.y).powi(2)).sqrt()
        })
        .sum()
}

fn main() {
    // A unit square, counter-clockwise.
    let square = [
        Point { x: 0.0, y: 0.0 },
        Point { x: 4.0, y: 0.0 },
        Point { x: 4.0, y: 4.0 },
        Point { x: 0.0, y: 4.0 },
    ];
    println!("area        = {}", area(&square));            // 16
    println!("signed area = {}", signed_area(&square));      // +16 → CCW
    println!("perimeter   = {}", perimeter(&square));        // 16

    // Reversing the winding flips the sign but not the area.
    let mut cw = square.to_vec();
    cw.reverse();
    println!("reversed    = {}", signed_area(&cw));          // -16

    println!("\ncontains (2,2)?  {}", contains(&square, Point { x: 2.0, y: 2.0 }));
    println!("contains (5,2)?  {}", contains(&square, Point { x: 5.0, y: 2.0 }));

    // An L-shape — concave, and ray casting still handles it.
    let l_shape = [
        Point { x: 0.0, y: 0.0 },
        Point { x: 4.0, y: 0.0 },
        Point { x: 4.0, y: 2.0 },
        Point { x: 2.0, y: 2.0 },
        Point { x: 2.0, y: 4.0 },
        Point { x: 0.0, y: 4.0 },
    ];
    println!("\nL area = {}", area(&l_shape));                           // 12
    println!("L contains (1,3)? {}", contains(&l_shape, Point { x: 1.0, y: 3.0 })); // true
    println!("L contains (3,3)? {}", contains(&l_shape, Point { x: 3.0, y: 3.0 })); // false
}
```

> [!tip] The sign of the shoelace area tells you the winding order
> A positive signed area means the vertices go counter-clockwise; negative means clockwise. That's genuinely useful: many algorithms (including the convex hull above) assume a particular winding, and rendering libraries use it to decide which side of a face is visible. Getting the winding from the area is one line, and free — you were computing the area anyway.

## Segment intersection

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
struct Point {
    x: i64,
    y: i64,
}

fn cross(o: Point, a: Point, b: Point) -> i64 {
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

fn on_segment(a: Point, b: Point, p: Point) -> bool {
    // Assumes p is collinear with a-b; checks it lies within the bounding box.
    p.x >= a.x.min(b.x) && p.x <= a.x.max(b.x) && p.y >= a.y.min(b.y) && p.y <= a.y.max(b.y)
}

/// Do segments p1-p2 and p3-p4 intersect (touching counts)?
fn segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool {
    let d1 = cross(p3, p4, p1);
    let d2 = cross(p3, p4, p2);
    let d3 = cross(p1, p2, p3);
    let d4 = cross(p1, p2, p4);

    // The general case: each segment straddles the other's line.
    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)) {
        return true;
    }

    // The collinear/touching cases, which are where bugs live.
    (d1 == 0 && on_segment(p3, p4, p1))
        || (d2 == 0 && on_segment(p3, p4, p2))
        || (d3 == 0 && on_segment(p1, p2, p3))
        || (d4 == 0 && on_segment(p1, p2, p4))
}

fn main() {
    let cases = [
        // crossing
        ((0, 0), (4, 4), (0, 4), (4, 0), true),
        // parallel, never meet
        ((0, 0), (4, 0), (0, 1), (4, 1), false),
        // touching at an endpoint
        ((0, 0), (2, 2), (2, 2), (4, 0), true),
        // collinear and overlapping
        ((0, 0), (4, 0), (2, 0), (6, 0), true),
        // collinear but disjoint
        ((0, 0), (2, 0), (4, 0), (6, 0), false),
        // T-junction: endpoint on the middle of the other
        ((0, 0), (4, 0), (2, 0), (2, 3), true),
    ];

    for (a, b, c, d, expected) in cases {
        let got = segments_intersect(
            Point { x: a.0, y: a.1 },
            Point { x: b.0, y: b.1 },
            Point { x: c.0, y: c.1 },
            Point { x: d.0, y: d.1 },
        );
        println!("{a:?}-{b:?} × {c:?}-{d:?} → {got} {}", if got == expected { "✓" } else { "✗" });
    }
}
```

> [!warning] The collinear cases are where segment intersection goes wrong
> The general "each straddles the other" test handles crossing segments correctly and silently fails on everything degenerate: shared endpoints, T-junctions, collinear overlap, and zero-length segments. Those are exactly the cases real data contains — a polygon's adjacent edges *always* share an endpoint. Test all six cases above explicitly; a geometry routine that only handles the general case will pass your first test and fail on real input.

## Closest pair of points

Brute force is O(n²). Divide and conquer gets O(n log n) — and the clever part is the strip.

```rust
#[derive(Debug, Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

fn dist_sq(a: Point, b: Point) -> f64 {
    (a.x - b.x).powi(2) + (a.y - b.y).powi(2)
}

/// O(n²) — correct, simple, and the right choice below a few hundred points.
fn closest_brute(pts: &[Point]) -> Option<(usize, usize, f64)> {
    let mut best: Option<(usize, usize, f64)> = None;
    for i in 0..pts.len() {
        for j in (i + 1)..pts.len() {
            let d = dist_sq(pts[i], pts[j]);
            if best.is_none_or(|(_, _, bd)| d < bd) {
                best = Some((i, j, d));
            }
        }
    }
    best
}

/// O(n log n) divide and conquer.
fn closest_pair(pts: &mut Vec<Point>) -> f64 {
    pts.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap());
    let mut sorted = pts.clone();
    solve(&mut sorted).sqrt()
}

fn solve(pts: &mut [Point]) -> f64 {
    let n = pts.len();
    if n <= 3 {
        // Base case: brute force over at most 3 points.
        let mut best = f64::INFINITY;
        for i in 0..n {
            for j in (i + 1)..n {
                best = best.min(dist_sq(pts[i], pts[j]));
            }
        }
        return best;
    }

    let mid = n / 2;
    let mid_x = pts[mid].x;
    let (left, right) = pts.split_at_mut(mid);
    let d = solve(left).min(solve(right));

    // The strip: only points within sqrt(d) of the dividing line can beat d.
    let mut strip: Vec<Point> = pts.iter().copied().filter(|p| (p.x - mid_x).powi(2) < d).collect();
    strip.sort_by(|a, b| a.y.partial_cmp(&b.y).unwrap());

    // The key insight: sorted by y, each point needs to look at only a few
    // neighbours — geometry bounds it at 7, so this inner loop is O(1).
    let mut best = d;
    for i in 0..strip.len() {
        for j in (i + 1)..strip.len() {
            if (strip[j].y - strip[i].y).powi(2) >= best {
                break; // no later point can be closer
            }
            best = best.min(dist_sq(strip[i], strip[j]));
        }
    }
    best
}

fn main() {
    let mut pts = vec![
        Point { x: 2.0, y: 3.0 },
        Point { x: 12.0, y: 30.0 },
        Point { x: 40.0, y: 50.0 },
        Point { x: 5.0, y: 1.0 },
        Point { x: 12.0, y: 10.0 },
        Point { x: 3.0, y: 4.0 },
    ];

    let brute = closest_brute(&pts).unwrap();
    println!("brute force: points {} and {}, distance {:.4}", brute.0, brute.1, brute.2.sqrt());
    println!("divide & conquer: distance {:.4}", closest_pair(&mut pts));
}
```

> [!deep] Why the strip's inner loop is O(1), not O(n)
> The strip can contain every point, so the nested loop *looks* quadratic. But within a strip of width 2·d, sorted by y, no two points are closer than `d` (or we'd already have found them) — so a geometric packing argument shows at most **7** points can lie within `d` of any given point. The `break` on the y-difference exploits that: each point examines a constant number of neighbours. This is the trick that makes the whole algorithm O(n log n), and it's a lovely example of a proof changing an algorithm's complexity without changing its code.

## Complexity summary

| Problem | Algorithm | Time | Space |
|---|---|---|---|
| orientation of 3 points | cross product | O(1) | O(1) |
| triangle area | cross product | O(1) | O(1) |
| polygon area | shoelace | O(n) | O(1) |
| polygon perimeter | sum of distances | O(n) | O(1) |
| point in polygon | ray casting | O(n) | O(1) |
| point in **convex** polygon | binary search on angle | O(log n) | O(1) |
| segment intersection (2 segments) | 4 orientation tests | O(1) | O(1) |
| all intersections among n segments | Bentley–Ottmann sweep | O((n+k) log n) | O(n) |
| convex hull | Andrew monotone chain | O(n log n) | O(n) |
| convex hull (output-sensitive) | Chan's algorithm | O(n log h) | O(n) |
| closest pair | divide and conquer | O(n log n) | O(n) |
| farthest pair (diameter) | rotating calipers on the hull | O(n log n) | O(n) |
| Delaunay triangulation | incremental / divide & conquer | O(n log n) | O(n) |
| smallest enclosing circle | Welzl's algorithm | O(n) expected | O(n) |

## Summary

- The **cross product** is the whole toolkit: its **sign** gives orientation (left/right/collinear) and its **magnitude** gives twice the triangle area.
- Compare **squared distances** rather than distances — `sqrt` is slower and lossy, and monotonic so it changes no comparison.
- **Never compare geometric floats against exact `0.0`.** Use an epsilon, scaled relative to your coordinate magnitudes.
- Better still, **use integer coordinates** when the input is integral — then cross products are exact and no epsilon is needed anywhere.
- **Andrew's monotone chain** builds a convex hull in O(n log n) by sorting and popping wrong-way turns. `<=` versus `<` decides whether collinear points survive.
- The **shoelace formula** gives polygon area in O(n), and its **sign** tells you the winding order for free.
- **Ray casting** answers point-in-polygon in O(n), including for concave polygons.
- Segment intersection is four orientation tests plus the **degenerate cases** — shared endpoints and collinear overlap are where the bugs are.
- **Closest pair** is O(n log n) because a packing argument bounds the strip's inner loop to a constant.

> [!exercise] Try it yourself
> 1. Write `fn is_convex(poly: &[Point]) -> bool` by checking that every consecutive triple turns the same way.
> 2. Compute the area of a triangle two ways — the shoelace formula and Heron's formula — and compare the results for a very thin triangle. Which is more numerically stable?
> 3. Take the convex hull code, switch the comparison from `<= 0` to `< 0`, and run it on a square with a point in the middle of one edge. What changes?
> 4. Implement the `contains` test for a *convex* polygon in O(log n) using binary search, and verify it agrees with ray casting.
> 5. Add a zero-length segment (both endpoints identical) to the segment-intersection test cases. Does your implementation handle it?
> 6. Generate 5,000 random points and compare timings of `closest_brute` against `closest_pair`. At what size does the divide-and-conquer version win?

Next: pushing quantities through a network of edges — **maximum flow and matching**.
