<h1><span class="h1-kicker">Appendices</span>A · Keywords</h1>

Rust reserves a set of **keywords** — words with special meaning that (mostly) can't be used as ordinary names. This appendix is a quick reference to all of them, grouped by purpose. You've met nearly all of them throughout the book; here they are in one place.

## Keywords in current use

| Keyword | Meaning |
|---------|---------|
| `as` | type casting (`x as u8`); renaming in `use` |
| `async` | define an [async](#/ch/async-intro) function/block returning a future |
| `await` | wait for a future to complete |
| `break` | exit a loop (optionally with a value) |
| `const` | a compile-time [constant](#/ch/variables); a const function |
| `continue` | skip to the next loop iteration |
| `crate` | refer to the current crate root in a path |
| `dyn` | a [trait object](#/ch/trait-objects) (`dyn Trait`) |
| `else` | the alternative branch of an `if` / `let…else` |
| `enum` | define an [enumeration](#/ch/enums) |
| `extern` | link an external function/crate ([FFI](#/ch/ffi)) |
| `false` | the boolean false literal |
| `fn` | define a [function](#/ch/functions) |
| `for` | loop over an [iterator](#/ch/iterators); implement a trait (`impl Trait for Type`) |
| `if` | conditional branch |
| `impl` | [implement](#/ch/methods) methods or a trait; `impl Trait` types |
| `in` | part of `for … in …` |
| `let` | bind a [variable](#/ch/variables) |
| `loop` | an infinite loop |
| `match` | [pattern matching](#/ch/pattern-matching) |
| `mod` | define a [module](#/ch/modules) |
| `move` | force a [closure](#/ch/closures) to take ownership of captures |
| `mut` | mark a binding or reference as mutable |
| `pub` | make an item public (visibility) |
| `ref` | bind by reference in a pattern |
| `return` | return early from a function |
| `Self` | the type being implemented (in an `impl`/trait) |
| `self` | the method receiver; the current module |
| `static` | a global with `'static` lifetime |
| `struct` | define a [struct](#/ch/structs) |
| `super` | the parent module in a path |
| `trait` | define a [trait](#/ch/traits) |
| `true` | the boolean true literal |
| `type` | a [type alias](#/ch/advanced-types) or associated type |
| `union` | a C-style union (unsafe) |
| `unsafe` | mark [unsafe](#/ch/unsafe) code |
| `use` | bring paths into scope |
| `where` | constrain generics with a [where clause](#/ch/generics) |
| `while` | conditional loop (incl. `while let`) |

> [!note] Contextual keywords
> A few words are keywords **only in certain positions** and can otherwise be used as names: `union` (only before a name defining a union), `'static` (a lifetime), and the *weak* keywords `dyn`, `async`, `await` (stabilized over time). Don't worry about the distinction — the compiler tells you if a name clashes.

## Reserved for the future

These are **reserved but not yet used** — you can't name anything with them, so the language can adopt them later without breaking your code:

```text
abstract   become   box     do      final
gen        macro    override priv   try
typeof     unsized  virtual  yield
```

> [!jargon] Raw identifiers
> If you *must* use a keyword as a name (common when calling code generated for another language, or an older crate), prefix it with **`r#`**: `let r#match = 5;` or `foo.r#type()`. This "raw identifier" syntax escapes the keyword-ness. You'll rarely need it, but it's there when FFI or macros demand a name that happens to be a keyword.

## Summary

- Rust reserves **keywords** with special syntactic meaning; most can't be used as ordinary identifiers.
- They cover declarations (`fn`, `struct`, `enum`, `trait`, `mod`), control flow (`if`, `match`, `loop`, `for`, `while`), paths/visibility (`use`, `pub`, `crate`, `super`, `self`), and more.
- Some words are **reserved for the future** so the language can grow compatibly.
- Use **`r#name`** (raw identifiers) if you ever need a keyword as a name.

> [!tip] You don't memorize these — you absorb them
> Nobody sits down to memorize the keyword list. By the time you've worked through this book, you use almost all of them fluently. This appendix is just a handy lookup for "wait, what does `ref` do again?" or confirming a name isn't reserved.
