<h1><span class="h1-kicker">Getting Started</span>Welcome & How to Use This Book</h1>

Welcome! 🦀 You're about to learn **Rust** — a programming language that gives you the raw speed of C and C++ *together with* a guarantee that entire categories of bugs simply cannot happen. Rust has been voted the most-loved programming language for years running, and it now powers Windows, Linux, Android, Firefox, Discord, Dropbox, Cloudflare, and huge parts of the cloud.

This book is designed to take you **all the way** — from your very first `println!` to writing async network servers, `unsafe` code, and your own procedural macros — without ever losing you along the way.

> [!key] Who this book is for
> **Complete beginners** can read straight through from the top. **Working programmers** new to Rust can skim the fundamentals and dive into ownership, traits, and async. **Experienced Rustaceans** will find the standard-library and algorithms sections a handy reference. There's a path for you no matter where you're starting.

## What makes this book different

- **🎨 Visual.** Concepts like ownership, borrowing, lifetimes, and async are shown with colorful diagrams — not just described in words. If you can *see* it, you can understand it.
- **▶️ Runnable.** Nearly every code example has a **Run** button. It compiles and executes your code live using the official Rust compiler — no installation needed to follow along. Click **Edit** to change any example and run your own version.
- **📖 Plain English.** We keep the language friendly and explain every piece of jargon (technical vocabulary) *the moment* it appears, right there in parentheses.
- **💡 Tips everywhere.** Throughout the book you'll find colored boxes with tips, warnings, common mistakes, and deep dives — the kind of hard-won advice you'd get from a mentor sitting beside you.

## How to read the code boxes

Here's a live example. Press **▶ Run** to compile and execute it on the spot, then try clicking **✎ Edit** and changing the message:

```rust
fn main() {
    let name = "future Rustacean";
    println!("Hello, {name}! Your Rust journey starts now. 🦀");
}
```

You'll meet several kinds of callout boxes. Here's the whole family, so you'll recognize them:

> [!tip] Tip
> A handy shortcut, best practice, or piece of practical advice.

> [!note] Note
> Extra context or a clarification worth keeping in mind.

> [!warning] Warning
> A pitfall, gotcha, or something that can bite you. Read these carefully.

> [!key] Key Idea
> A core concept. If you remember nothing else from a section, remember this.

> [!jargon] Jargon Buster
> A plain-English definition of a technical term.

> [!mistake] Common Mistake
> An error nearly everyone makes at first — and how to avoid it.

> [!best] Best Practice
> The idiomatic, "this is how Rustaceans do it" way.

> [!deep] Deep Dive
> An optional, deeper look under the hood. Safe to skip on a first read.

> [!performance] Performance
> A note about speed, memory, or efficiency.

> [!exercise] Try It Yourself
> A small challenge to cement what you just learned.

## The plan

The book is organized so each part builds on the last:

1. **Getting Started & Foundations** — install Rust, then learn variables, types, functions, and control flow.
2. **Ownership** — the heart of Rust, and the thing that makes it unique.
3. **Structuring data & organizing code** — structs, enums, pattern matching, and modules.
4. **Collections, error handling, generics, traits & lifetimes** — the daily tools of a Rust programmer.
5. **Functional Rust, testing, and smart pointers** — closures, iterators, and `Box`/`Rc`/`RefCell`.
6. **Concurrency & async** — fearless multithreading and `async`/`await`.
7. **Advanced Rust** — `unsafe`, macros, and FFI.
8. **The standard library & the crate ecosystem** — deep references and the best libraries.
9. **Real projects & a full Data Structures & Algorithms course** — put it all to work.

> [!tip] You don't have to install anything yet
> Because every example runs in your browser, you can read the first several chapters on any device — even your phone. When you're ready to build real projects, the very next chapter shows you how to install Rust properly.

Ready? Let's install Rust and write your first real program. 👉
