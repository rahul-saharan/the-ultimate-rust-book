<h1><span class="h1-kicker">Getting Started</span>Hello, World! and Hello, Cargo</h1>

Tradition demands that your first program in a new language make the computer greet the world. Let's honor it — and in doing so, meet the anatomy of a Rust program and the tool you'll use to build every project from now on.

Here is the entire program. Press **▶ Run** to compile and execute it right now:

```rust
fn main() {
    println!("Hello, world!");
}
```

Three short lines, but every piece is worth understanding.

## Dissecting your first program

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="The three lines of the hello world program with each piece labelled: fn declares a function, main is the entry point, braces wrap the body, println with an exclamation mark is a macro, the quoted text is a string literal, and the semicolon ends the statement">
  <style>
    .hw-code { font: 600 15px var(--font-mono); fill: var(--text); }
    .hw-hl { font: 600 15px var(--font-mono); fill: var(--rust-600); }
    .hw-lbl { font: 11px var(--font-sans); fill: var(--text-mute); }
    .hw-key { font: 700 11px var(--font-sans); fill: var(--rust-600); }
    .hw-line { stroke: var(--rust-400); stroke-width: 1.3; fill: none; }
    .hw-panel { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="40" y="86" width="380" height="86" rx="5" class="hw-panel"/>
  <text x="60" y="112" class="hw-hl">fn</text>
  <text x="87" y="112" class="hw-hl">main</text>
  <text x="123" y="112" class="hw-code">()</text>
  <text x="150" y="112" class="hw-hl">{</text>
  <text x="96" y="138" class="hw-hl">println!</text>
  <text x="168" y="138" class="hw-code">(</text>
  <text x="177" y="138" class="hw-hl">"Hello, world!"</text>
  <text x="312" y="138" class="hw-code">)</text>
  <text x="321" y="138" class="hw-hl">;</text>
  <text x="60" y="164" class="hw-hl">}</text>
  <path d="M66 98 L66 74 L150 74" class="hw-line"/>
  <text x="156" y="60" class="hw-key">fn</text>
  <text x="176" y="60" class="hw-lbl">declares a function</text>
  <path d="M100 98 L100 50 L150 50" class="hw-line"/>
  <text x="156" y="38" class="hw-key">main</text>
  <text x="188" y="38" class="hw-lbl">the entry point — runs first</text>
  <path d="M155 100 L440 100" class="hw-line"/>
  <text x="446" y="104" class="hw-key">{ }</text>
  <text x="472" y="104" class="hw-lbl">wrap the body</text>
  <path d="M130 148 L130 194 L300 194" class="hw-line"/>
  <text x="306" y="198" class="hw-key">println!</text>
  <text x="362" y="198" class="hw-lbl">a macro — note the !</text>
  <path d="M240 148 L240 218 L300 218" class="hw-line"/>
  <text x="306" y="222" class="hw-key">"…"</text>
  <text x="332" y="222" class="hw-lbl">a string literal: the text to print</text>
  <path d="M325 148 L325 170 L250 170" class="hw-line"/>
  <text x="196" y="174" class="hw-key">;</text>
  <text x="206" y="174" class="hw-lbl">ends the statement</text>
</svg>
<figcaption>Every piece of the smallest possible Rust program. The <b>!</b> on <code>println!</code> is the tell that it's a macro rather than a function.</figcaption>
</figure>

- **`fn main()`** declares a *function* (a named, reusable block of code) called `main`. The `main` function is special: it is the **entry point** — the very first code that runs when your program starts. Every executable Rust program has exactly one.
- **`{ }`** wrap the function's *body* — the statements that run when the function is called.
- **`println!`** prints text to the screen, followed by a newline. That exclamation mark `!` means it's a **macro** (code that generates other code at compile time), not a regular function. You'll learn why later; for now, just read `println!` as "print a line".
- **`"Hello, world!"`** is a *string literal* — the text to print.
- The **`;`** ends the statement. Most lines of Rust end with a semicolon.

> [!jargon] Macro vs. function
> A **macro** is a tool that writes code for you before compilation. `println!` is a macro because it does clever things a normal function can't — like checking your format string at compile time. The `!` is how you spot a macro call in Rust: `println!`, `vec!`, `format!`.

> [!tip] Formatting with `{}`
> `println!` can weave values into text using `{}` placeholders. Even better, you can name a variable directly inside the braces:
> ```rust
> fn main() {
>     let name = "Ferris";
>     let legs = 10;
>     println!("{name} the crab has {legs} legs.");
>     println!("Two plus two is {}.", 2 + 2);
> }
> ```

## Compiling by hand (once)

Behind the scenes, running that program is a two-step dance: **compile**, then **run**. Rust is an *ahead-of-time compiled* language — it translates your whole program into a native executable file *before* running, which is a big reason Rust programs are so fast.

```mermaid
graph LR
    A["main.rs<br/>(your source code)"] -->|rustc| B["an executable<br/>(machine code)"]
    B -->|you run it| C["Hello, world!"]
    style A fill:#79c0ff,color:#000
    style B fill:#f96316,color:#fff
    style C fill:#7ee787,color:#000
```

If you save the program to a file named `main.rs`, you can compile it yourself with `rustc`:

```bash
rustc main.rs      # produces an executable called `main` (or main.exe on Windows)
./main             # run it
# Output: Hello, world!
```

> [!note] Compiled, not interpreted
> Unlike Python or JavaScript, the person running your program doesn't need Rust installed — you hand them a single self-contained executable. The compiler did all the work up front.

### What the compiler actually does

"Compiling" is really five stages, and knowing them tells you where your errors are coming from:

| Stage | What it checks | Error you'd see |
|---|---|---|
| **parse** | is this valid Rust syntax? | `expected ';', found '}'` |
| **name resolution** | does every name you used exist? | `cannot find value 'x' in this scope` |
| **type check** | do the types line up? | `expected i32, found &str` |
| **borrow check** | is every reference valid? | `borrow of moved value` |
| **codegen + link** | produce machine code, stitch it together | `linker 'cc' not found` |

The first four stages are *analysis* — they read your code and decide whether it's correct. Only the last one produces an actual file, and it's by far the slowest.

> [!tip] This is why `cargo check` is so much faster
> `cargo check` runs stages 1–4 and then stops. You get every syntax, type, and borrow error — everything you were actually going to fix — without paying for code generation and linking. That's usually a 3–5× speedup, which is why editors run it on every keystroke and why it's the right command for your inner development loop. Reach for `cargo build` only when you genuinely want to run the program.

## Reading your first compiler error

Rust's error messages are the best in the industry, and learning to read them is the single highest-value skill in this book. Let's break the program on purpose:

```rust,ignore
fn main() {
    println!("Hello, world!")     // ← the semicolon is missing
}
```

The compiler says:

```text
error: expected `;`, found `}`
 --> src/main.rs:2:30
  |
2 |     println!("Hello, world!")
  |                              ^ help: add a `;` here
3 | }
  | - unexpected token
```

Every Rust error has the same four parts, and it's worth naming them once:

1. **The category and summary** — `error: expected ';', found '}'`. Some errors also carry a code like `error[E0382]`, which you can look up with `rustc --explain E0382`.
2. **The location** — `src/main.rs:2:30` is file, line, column. Most editors turn this into a clickable link.
3. **The excerpt with a caret** — the `^` points at the exact character that's wrong, with surrounding lines for context.
4. **A `help:` or `note:` line** — very often the literal fix. Here it tells you precisely what to type.

> [!best] Read the error bottom-up, and fix only the first one
> Start with the `help:` line — it frequently *is* the answer. And when you get twelve errors at once, fix the **first** one and recompile: a single missing brace or semicolon cascades into a wall of nonsense downstream, and the other eleven usually vanish. Beginners often try to fix all twelve and get lost.

> [!mistake] `error` versus `warning`
> A **warning** means your program still compiled — unused variable, dead code, a non-idiomatic pattern. An **error** means nothing was produced. Both are printed in the same stream, so it's easy to see a wall of yellow text and assume the build failed when it succeeded, or to miss a single red error among many warnings. Check the last line: `error: could not compile` means it failed.

## Meet Cargo — you'll never call `rustc` again

Calling `rustc` by hand is fine for one file, but real programs have many files, dependencies, tests, and settings. That's what **Cargo**, Rust's build tool and package manager, is for. From now on, you'll let Cargo drive.

Create a brand-new project with `cargo new`:

```bash
cargo new hello_cargo
cd hello_cargo
```

Cargo scaffolds a tidy project for you:

```text
hello_cargo/
├── Cargo.toml        # project settings & dependency list ("manifest")
└── src/
    └── main.rs       # your code lives here — already contains Hello, world!
```

The **`Cargo.toml`** file (its name is short for *Tom's Obvious Minimal Language*) describes your project:

```toml
[package]
name = "hello_cargo"
version = "0.1.0"
edition = "2021"

[dependencies]
```

## Building and running with Cargo

Inside the project, a single command compiles *and* runs your program:

```bash
cargo run
```

You'll see Cargo compile the project and then print `Hello, world!`. A few commands you'll use constantly:

| Command | What it does |
|---------|--------------|
| `cargo run` | Compile (if needed) and run the program |
| `cargo build` | Compile only, into `target/debug/` |
| `cargo check` | Type-check **without** producing an executable — very fast |
| `cargo build --release` | Compile with optimizations, into `target/release/` |

> [!performance] `cargo run` is a *debug* build, and debug builds are slow
> By default Cargo optimizes for fast *compilation*, not fast *execution* — so `cargo run` can be **10× to 100× slower** than `cargo run --release`. That's the right default while you're writing code, and completely the wrong one the moment you measure anything. If you ever conclude "Rust is slow" or time a loop and get an alarming number, check whether you passed `--release` first. Debug builds also enable extra runtime checks, such as panicking on integer overflow instead of wrapping.

> [!best] Always start projects with `cargo new`
> Even for tiny experiments, reach for `cargo new` instead of loose `.rs` files. You get a standard layout, easy dependency management, and every Cargo command "just works." It's the universal starting point every Rust developer uses.

> [!mistake] "Where did my program go?"
> New users sometimes run `cargo build` and then look for their program in the project folder. It's not there — compiled binaries go into the **`target/`** directory (`target/debug/hello_cargo`). Just use `cargo run` and let Cargo find it for you.

## Summary

- Every Rust program starts in the **`main`** function; **`println!`** prints a line, and the `!` marks it as a **macro**.
- Rust is **compiled ahead of time** into a fast, self-contained native executable.
- Compilation is five stages — parse, name resolution, type check, borrow check, then codegen and link. Only the last produces a file, which is why **`cargo check`** (which stops after stage four) is so much faster.
- Every error message has four parts: **category**, **location**, **a caret excerpt**, and usually a **`help:` line with the fix**. Fix the *first* error and recompile.
- You *could* compile a single file with **`rustc`**, but in practice you always use **Cargo**.
- **`cargo new`** creates a project, **`cargo run`** builds and runs it, and **`cargo check`** gives you lightning-fast error checking.
- `cargo run` produces a **debug** build — use **`--release`** before you measure anything.
- **`Cargo.toml`** is your project's manifest, where the name, version, and dependencies live.

> [!exercise] Try it yourself
> 1. In the first example, change the message and press **Run**. Then add a second `println!` line.
> 2. Use a `{}` placeholder to print the result of a calculation, like `println!("{}", 7 * 6);`.
> 3. Delete the semicolon and press **Run**. Read the error, identify all four parts, and confirm the `help:` line tells you the fix.
> 4. Now cause a *different* error: change `println!` to `printn!`. Which compilation stage caught it, and how do you know?
> 5. On your own machine, run `cargo new my_first` and then `cargo run`. Open `src/main.rs` and make it greet you by name.

Next up, we'll dig into **Cargo** properly — dependencies, profiles, and the commands that will power the rest of your Rust journey.
