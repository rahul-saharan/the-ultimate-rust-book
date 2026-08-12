<h1><span class="h1-kicker">The Crate Ecosystem</span>clap: Command-Line Parsing</h1>

Any real command-line tool needs to parse arguments: flags like `--verbose`, options like `--output file.txt`, positional arguments, subcommands, and a `--help` screen. Hand-rolling this with [`env::args`](#/ch/std-env-process) gets painful fast. **clap** (Command Line Argument Parser) turns a plain Rust struct into a complete, polished CLI — validation, help text, and error messages included. This chapter shows the derive approach you'll use 99% of the time. (clap isn't on the in-book playground, so examples are illustrative — run them locally.)

## A CLI from a struct

The heart of clap's derive API: define a struct, annotate its fields, and derive **`Parser`**. Each field becomes an argument; doc comments become help text:

```rust,ignore
use clap::Parser;

/// A friendly greeter — this doc comment becomes the tool's description.
#[derive(Parser)]
#[command(name = "greet", version, about)]
struct Args {
    /// Name of the person to greet (a positional argument)
    name: String,

    /// Number of times to greet them
    #[arg(short, long, default_value_t = 1)]
    count: u8,

    /// Shout the greeting in uppercase
    #[arg(short, long)]
    loud: bool,
}

fn main() {
    let args = Args::parse(); // parses std::env::args(), or exits with an error/help

    for _ in 0..args.count {
        let greeting = format!("Hello, {}!", args.name);
        println!("{}", if args.loud { greeting.to_uppercase() } else { greeting });
    }
}
```

Add it with `cargo add clap --features derive`. Now your tool works like a native command:

```bash
$ greet Ferris --count 2 --loud
HELLO, FERRIS!
HELLO, FERRIS!

$ greet --help          # clap generates this automatically!
$ greet --version       # and this
```

> [!key] Types + attributes describe your whole CLI
> clap infers a huge amount from your struct: field **types** set expectations (`u8` must parse as a number, `bool` becomes a flag, `Option<T>` is optional, `Vec<T>` collects multiple values), **doc comments** become help text, and `#[arg(...)]` attributes fine-tune names and defaults. You describe the *shape* of your CLI declaratively; clap generates the parser, validation, help, and error handling.

## Flags, options, and positionals

<figure class="diagram">
<svg viewBox="0 0 640 130" role="img" aria-label="A command line broken into positional arguments, flags, and options">
  <style>
    .clm { font: 600 12px var(--font-mono); }
    .clc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .pos { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .flag { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .opt { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <text x="20" y="30" class="clm" fill="var(--text)">$ mytool</text>
  <rect x="110" y="16" width="90" height="24" class="pos"/><text x="122" y="33" class="clm" fill="var(--text)">input.txt</text>
  <rect x="210" y="16" width="80" height="24" class="flag"/><text x="222" y="33" class="clm" fill="var(--text)">--verbose</text>
  <rect x="300" y="16" width="170" height="24" class="opt"/><text x="312" y="33" class="clm" fill="var(--text)">--output out.txt</text>
  <text x="110" y="70" class="clc">positional</text>
  <text x="210" y="70" class="clc">flag (bool)</text>
  <text x="300" y="70" class="clc">option (takes a value)</text>
  <text x="20" y="105" class="clc">clap maps each of these onto a struct field based on its type and attributes.</text>
</svg>
<figcaption>clap sorts a command line into positionals, boolean flags, and value-taking options — one struct field each.</figcaption>
</figure>

| You want | Field type | Attribute |
|----------|-----------|-----------|
| A required positional | `String` | (none) |
| An optional positional | `Option<String>` | (none) |
| A boolean flag `--loud` | `bool` | `#[arg(short, long)]` |
| An option `--count 5` | `u8` | `#[arg(short, long)]` |
| A default value | any | `#[arg(default_value_t = 1)]` |
| Multiple values `-v -v` | `u8` (count) or `Vec<T>` | `#[arg(action = Count)]` |

## Subcommands

Tools like `git` (`git commit`, `git push`) have **subcommands**. Model them with an `enum` deriving `Subcommand`, and clap dispatches for you:

```rust,ignore
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "todo")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Add a new task
    Add { text: String },
    /// Mark a task done
    Done { id: u32 },
    /// List all tasks
    List,
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Commands::Add { text } => println!("Adding: {text}"),
        Commands::Done { id } => println!("Completing task {id}"),
        Commands::List => println!("Listing all tasks"),
    }
}
```

```bash
$ todo add "Learn clap"
$ todo done 3
$ todo list
```

## Run it here: `parse_from` instead of the real args

`Cli::parse()` reads `std::env::args()`, which you can't control in a book. **`parse_from`** takes an argv-like iterator instead — so you can exercise a real CLI definition with synthetic input, and it's also exactly how you unit-test one:

```rust
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "todo", version = "1.0", about = "A tiny task tracker")]
struct Cli {
    /// Show extra detail
    #[arg(short, long)]
    verbose: bool,

    /// How many items to show
    #[arg(short = 'n', long, default_value_t = 10)]
    limit: u32,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Add a new task
    Add { text: String },
    /// Mark a task done
    Done { id: u32 },
    /// List all tasks
    List,
}

fn main() {
    // Note argv[0] is the program name — clap skips it, just like the real thing.
    let cli = Cli::parse_from(["todo", "--verbose", "-n", "3", "add", "write the docs"]);
    println!("{cli:?}\n");

    match &cli.command {
        Commands::Add { text } => println!("adding {text:?} (verbose={})", cli.verbose),
        Commands::Done { id } => println!("completing {id}"),
        Commands::List => println!("listing up to {}", cli.limit),
    }

    // Defaults apply when a flag is absent:
    let plain = Cli::parse_from(["todo", "list"]);
    println!("\ndefaults → verbose={} limit={}", plain.verbose, plain.limit);
}
```

### Errors are values too — `try_parse_from`

`parse_from` exits the process on bad input, which is right for `main` and useless in a test. **`try_parse_from`** hands you a `Result` instead, so you can inspect exactly what clap rejected:

```rust
use clap::Parser;

#[derive(Parser, Debug)]
struct Cli {
    /// Port to bind (must fit in a u16)
    #[arg(short, long)]
    port: u16,
}

fn main() {
    // Valid:
    println!("{:?}\n", Cli::try_parse_from(["app", "--port", "8080"]).map(|c| c.port));

    // Out of range for u16 — clap validates the TYPE for you:
    match Cli::try_parse_from(["app", "--port", "99999"]) {
        Ok(c) => println!("parsed {}", c.port),
        Err(e) => println!("rejected: {}", e.kind()),
    }

    // Missing a required option:
    match Cli::try_parse_from(["app"]) {
        Ok(c) => println!("parsed {}", c.port),
        Err(e) => println!("rejected: {}", e.kind()),
    }

    // Unknown flag — clap even suggests corrections in its full message:
    match Cli::try_parse_from(["app", "--prot", "80"]) {
        Ok(_) => println!("parsed"),
        Err(e) => println!("rejected: {}", e.kind()),
    }
}
```

> [!key] Your field types *are* your validation
> This is the part that makes clap feel different from argument parsers in other languages. Declaring `port: u16` doesn't just convert the string — it **rejects** `99999` before your code runs, with a proper error message and exit code 2. `Option<T>` means optional, a bare `T` means required, `Vec<T>` means repeatable, `bool` means a flag. The type system you already know *is* the specification.
>
> Push that further with `value_parser`: `#[arg(value_parser = clap::value_parser!(u16).range(1024..))]` enforces a range, and `#[arg(value_enum)]` on an enum restricts the input to its variants — both with generated help text listing the valid values. Every rule you encode this way is one your `main` never has to check.

### Restricting and relating arguments

Real CLIs have rules beyond individual types — mutually exclusive flags, options that require each other:

```rust,ignore
#[derive(Parser)]
struct Cli {
    /// Cannot be used together with --quiet
    #[arg(long, conflicts_with = "quiet")]
    verbose: bool,

    #[arg(long)]
    quiet: bool,

    /// Only meaningful when --output is given
    #[arg(long, requires = "output")]
    overwrite: bool,

    #[arg(long)]
    output: Option<String>,

    /// Restrict to a fixed set, with help text listing the options
    #[arg(long, value_enum, default_value_t = Format::Text)]
    format: Format,
}

#[derive(clap::ValueEnum, Clone, Debug)]
enum Format { Text, Json, Csv }
```

`conflicts_with`, `requires`, and `ArgGroup` let clap enforce these before your code runs — again turning a runtime `if` into a parse-time error with a clear message.

> [!best] Use the derive API and let clap do the work
> clap has a lower-level "builder" API, but the **derive API** (shown here) is what you want almost always — it's declarative, keeps your CLI definition next to your data, and is far less code. Let clap own the tedious parts: `--help`/`--version`, "did you mean…?" suggestions, required-argument errors, and value validation. Your `main` should mostly just `parse()` and `match`.

> [!tip] Free niceties worth knowing
> - Add `#[arg(env = "MY_VAR")]` to let an option fall back to an **environment variable**.
> - Add `#[arg(value_enum)]` on an enum field to restrict an option to a fixed set of choices (with validation and help).
> - Enable shell **completions** and **man page** generation with the `clap_complete` and `clap_mangen` companion crates.
> - Derive `Parser` on a struct and you can also **test** it: `Args::try_parse_from(["prog", "--count", "2"])` returns a `Result` without touching the real args.

## Summary

- **clap** turns a Rust struct (deriving **`Parser`**) into a full CLI: parsing, validation, `--help`, and `--version`, all generated.
- Field **types** and **doc comments** drive the CLI: `bool` → flag, `Option<T>` → optional, `Vec<T>` → multiple, doc comment → help text; `#[arg(...)]` fine-tunes.
- Model **subcommands** with an `enum` deriving **`Subcommand`** and `match` on it.
- Prefer the **derive API**; add `cargo add clap --features derive`, and lean on companions (`clap_complete`, `clap_mangen`) for completions and man pages.

> [!exercise] Try it yourself (locally)
> 1. Build the `greet` tool, run it with `--help`, and try `--count` and `--loud`.
> 2. Add an optional `--greeting <word>` option (`Option<String>`) that replaces "Hello".
> 3. Build a `calc` tool with `Add`, `Sub`, and `Mul` subcommands, each taking two numbers.

Next: making error handling in applications and libraries a pleasure with **anyhow and thiserror**.
