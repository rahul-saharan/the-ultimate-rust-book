<h1><span class="h1-kicker">Advanced Rust</span>Declarative Macros: macro_rules!</h1>

You've used macros since chapter one — `println!`, `vec!`, `format!`. Now you'll write your own. **Declarative macros** (`macro_rules!`) are pattern-matching templates: they match the *syntax* you pass in and expand it into other code at compile time. They let you reduce boilerplate and build mini-languages — with the same zero runtime cost as hand-written code, because the expansion happens before compilation.

## Macros vs. functions

> [!key] What macros can do that functions can't
> A function receives *values*; a **macro** receives *syntax* and generates *code*. That lets macros do things functions fundamentally cannot:
> - Take a **variable number** of arguments (`println!("{}", a)` vs `println!("{} {}", a, b)`).
> - Accept different **types** in the same call (`vec![1, 2]` and `vec!["a", "b"]`).
> - Generate **items** like structs, functions, or trait impls.
> - Inspect and transform the code passed to them.
>
> The cost: macros are harder to write and read than functions. Reach for a function first; use a macro only when you need one of these superpowers.

## A first macro

Macros are defined with `macro_rules!`. The body looks like a `match`: each arm is `(pattern) => { expansion }`. Here's a tiny one:

```rust
macro_rules! say_hello {
    () => {
        println!("Hello from a macro!");
    };
}

fn main() {
    say_hello!(); // expands to println!("Hello from a macro!");
}
```

## Capturing input with fragment specifiers

Macros capture pieces of syntax into **metavariables** (written `$name`), each tagged with a **fragment specifier** that says what kind of syntax to match:

```rust
macro_rules! print_twice {
    ($x:expr) => {  // $x captures any expression
        println!("{}", $x);
        println!("{}", $x);
    };
}

fn main() {
    print_twice!(2 + 3);       // works with an expression
    print_twice!("hello");      // and a different type — 5 and 5, then hello hello
}
```

The common fragment specifiers:

| Specifier | Matches | Example |
|-----------|---------|---------|
| `expr` | an expression | `2 + 2`, `foo()` |
| `ident` | an identifier | `my_var`, `Foo` |
| `ty` | a type | `i32`, `Vec<String>` |
| `literal` | a literal | `42`, `"hi"` |
| `pat` | a pattern | `Some(x)`, `_` |
| `block` | a `{ … }` block | `{ do_thing(); }` |
| `stmt` | a statement | `let x = 5` |
| `tt` | a single "token tree" (most flexible) | almost anything |

## Repetition: variable numbers of arguments

The real power is **repetition**. `$( … )*` matches a pattern zero or more times, and re-emits it once per match. This is how `vec!` accepts any number of elements — let's build our own:

```rust
macro_rules! my_vec {
    // Match a comma-separated list of expressions:
    ( $( $x:expr ),* ) => {
        {
            let mut temp = Vec::new();
            $(
                temp.push($x); // repeated once for EACH matched $x
            )*
            temp
        }
    };
}

fn main() {
    let v = my_vec![1, 2, 3, 4];
    println!("{v:?}"); // [1, 2, 3, 4]
    let words = my_vec!["a", "b"];
    println!("{words:?}");
}
```

Read the repetition syntax as: **`$( … ),*`** means "the stuff inside, repeated, separated by commas." Inside the expansion, `$( … )*` replays the body once per captured item.

<figure class="diagram">
<svg viewBox="0 0 640 160" role="img" aria-label="A macro call is expanded at compile time into the code its template generates">
  <style>
    .mdm { font: 600 11px var(--font-mono); fill: var(--text); }
    .mdc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .call { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
    .exp { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
  </style>
  <rect x="20" y="30" width="180" height="30" class="call"/><text x="34" y="50" class="mdm">my_vec![1, 2, 3]</text>
  <text x="230" y="40" class="mdc">expands at</text><text x="230" y="56" class="mdc">COMPILE time ⟶</text>
  <rect x="360" y="18" width="260" height="120" rx="8" class="exp"/>
  <text x="374" y="40" class="mdm">{ let mut temp = Vec::new();</text>
  <text x="374" y="58" class="mdm">  temp.push(1);</text>
  <text x="374" y="76" class="mdm">  temp.push(2);</text>
  <text x="374" y="94" class="mdm">  temp.push(3);</text>
  <text x="374" y="112" class="mdm">  temp }</text>
  <text x="20" y="150" class="mdc">The macro is gone by runtime — only the generated code remains. Zero overhead.</text>
</svg>
<figcaption>A macro call is <b>expanded into real code at compile time</b>, so there's no runtime cost.</figcaption>
</figure>

## Multiple arms and recursion

Like `match`, a macro can have several arms, tried top to bottom. Macros can even call *themselves*, enabling recursive expansion. Here's a `max!` that handles any number of arguments by peeling one off and recursing:

```rust
macro_rules! max {
    // Base case: one argument — it's the max of itself.
    ($a:expr) => { $a };
    // Recursive case: compare the first with the max of the rest.
    ($a:expr, $($rest:expr),+) => {
        {
            let a = $a;
            let b = max!($($rest),+); // recurse on the remaining args
            if a > b { a } else { b }
        }
    };
}

fn main() {
    println!("{}", max!(3));             // 3
    println!("{}", max!(3, 7, 2, 9, 4)); // 9
}
```

## Hygiene

> [!key] Macros are hygienic
> Notice `my_vec!` created a variable named `temp`. What if *your* code already had a `temp`? In many languages' macros, that would clash disastrously. Rust macros are **hygienic**: identifiers a macro introduces live in their own separate scope and can't accidentally collide with or capture the caller's variables. This makes `macro_rules!` far safer than the naive text-substitution macros of C.

> [!best] Prefer functions; reach for macros deliberately
> Macros are powerful but they're a *cost*: they're harder to write, harder to read, produce cryptic errors, and IDEs support them less well. Use a **function** or **generics** whenever they'd do. Justify a declarative macro when you genuinely need variadic arguments, code generation, or a DSL — and keep it as simple as the job allows. When you need to derive behavior for a *type* (like `#[derive(Debug)]`), that's the domain of **procedural macros**, next.

> [!warning] Export macros with `#[macro_export]`
> A `macro_rules!` macro is only visible *after* its definition in the same crate unless you annotate it with **`#[macro_export]`**, which makes it available to the whole crate and to crates that depend on yours. Forgetting this is a common "why can't I use my macro?" stumble. (Order matters too: a macro must be defined textually before it's used, unless exported.)

## Summary

- **Declarative macros** (`macro_rules!`) are compile-time pattern-matching templates that transform **syntax** into code — with no runtime cost.
- They can do what functions can't: **variadic** arguments, mixed **types**, and generating **items**.
- Capture syntax with **metavariables** (`$x`) tagged by **fragment specifiers** (`expr`, `ident`, `ty`, `tt`, …); handle lists with **repetition** `$( … ),*`.
- Macros support **multiple arms** and **recursion** (like `max!`), and are **hygienic** — their variables never clash with the caller's.
- Prefer functions/generics; use macros deliberately, and remember **`#[macro_export]`** to share them.

> [!exercise] Try it yourself
> 1. Write a `square!($x:expr)` macro that expands to `$x * $x`, and call it on `5` and on `2 + 1` (watch out — why might you want parentheses?).
> 2. Build a `min!` macro mirroring the recursive `max!`.
> 3. Write a `hashmap!` macro so `hashmap!{"a" => 1, "b" => 2}` builds a `HashMap` (hint: repetition with `$k:expr => $v:expr`).

`macro_rules!` matches syntax patterns. For the ultimate power — generating code from the *structure* of your types, like `#[derive(Debug)]` does — you need **procedural macros**.
