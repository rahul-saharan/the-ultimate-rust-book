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

```rust,ignore
fn main() {
    println!("Hello, world!");
}
```

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

> [!tip] `cargo check` is your fast feedback loop
> While coding, run `cargo check` constantly. It runs the full compiler *analysis* (catching all your errors) but skips the slow final step of generating the executable, so it's dramatically faster than a full build. Many editors run it for you automatically.

> [!best] Always start projects with `cargo new`
> Even for tiny experiments, reach for `cargo new` instead of loose `.rs` files. You get a standard layout, easy dependency management, and every Cargo command "just works." It's the universal starting point every Rust developer uses.

> [!mistake] "Where did my program go?"
> New users sometimes run `cargo build` and then look for their program in the project folder. It's not there — compiled binaries go into the **`target/`** directory (`target/debug/hello_cargo`). Just use `cargo run` and let Cargo find it for you.

## Summary

- Every Rust program starts in the **`main`** function; **`println!`** prints a line, and the `!` marks it as a **macro**.
- Rust is **compiled ahead of time** into a fast, self-contained native executable.
- You *could* compile a single file with **`rustc`**, but in practice you always use **Cargo**.
- **`cargo new`** creates a project, **`cargo run`** builds and runs it, and **`cargo check`** gives you lightning-fast error checking.
- **`Cargo.toml`** is your project's manifest, where the name, version, and dependencies live.

> [!exercise] Try it yourself
> 1. In the first example, change the message and press **Run**. Then add a second `println!` line.
> 2. Use a `{}` placeholder to print the result of a calculation, like `println!("{}", 7 * 6);`.
> 3. On your own machine, run `cargo new my_first` and then `cargo run`. Open `src/main.rs` and make it greet you by name.

Next up, we'll dig into **Cargo** properly — dependencies, profiles, and the commands that will power the rest of your Rust journey.
