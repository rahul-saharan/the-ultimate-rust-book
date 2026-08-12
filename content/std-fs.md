<h1><span class="h1-kicker">The Standard Library, Deep</span>std::fs — Files & Paths</h1>

Reading and writing files is a daily task, and `std::fs` makes the common cases one-liners while giving you fine control when you need it. Paired with `std::path` for handling file paths portably, it's everything you need to work with the filesystem. This chapter is your reference — and every example is runnable, because each one works inside a fresh temporary directory that it deletes on the way out.

## Three levels of API — pick the lowest one that works

| Level | Use | When |
|-------|-----|------|
| `fs::read_to_string` / `fs::read` / `fs::write` | whole file, one call | the 90% case: config files, small data |
| `File::open` / `File::create` + `BufReader`/`BufWriter` | streaming | files too big for memory, line-by-line processing |
| `OpenOptions::new()…open()` | exact open semantics | appending, `create_new`, no-truncate writes, custom modes |

## The one-line helpers

For the 90% case — "read this whole file" or "write this whole string" — `std::fs` has convenience functions that handle opening, reading/writing, and closing for you:

```rust
use std::fs;
use std::io;

fn main() -> io::Result<()> {
    // Every example in this chapter works inside a temporary directory.
    let dir = std::env::temp_dir().join("rustbook-fs-helpers");
    fs::create_dir_all(&dir)?;
    let file = dir.join("greeting.txt");

    fs::write(&file, "Hello, file!\n")?;               // create or truncate, then write
    println!("read_to_string: {:?}", fs::read_to_string(&file)?);
    println!("read (bytes):   {} bytes", fs::read(&file)?.len());

    fs::copy(&file, dir.join("copy.txt"))?;            // returns bytes copied
    fs::rename(dir.join("copy.txt"), dir.join("moved.txt"))?;
    println!("moved.txt exists: {}", dir.join("moved.txt").exists());

    fs::remove_dir_all(&dir)?;                         // tidy up
    Ok(())
}
```

```text
read_to_string: "Hello, file!\n"
read (bytes):   13 bytes
moved.txt exists: true
```

> [!tip] Reach for `fs::read_to_string` / `fs::write` first
> Don't manually `File::open` + `read_to_string` unless you need to. The free functions **`fs::read_to_string`**, **`fs::read`**, and **`fs::write`** cover the vast majority of file work in a single call, correctly handling open/close and errors. They also pre-allocate from the file's size, so they are *faster* than the hand-written equivalent. Drop to the `File` API only when you need streaming, appending, or custom open options.

## The `File` API and `OpenOptions`

When you need to *append*, stream large data, or set specific open options, use `File` with `OpenOptions` — and wrap it in a `BufReader`/`BufWriter` as the [io chapter](#/ch/std-io) advised:

```rust
use std::fs::{self, OpenOptions};
use std::io::{self, Write, BufWriter, BufReader, BufRead};

fn main() -> io::Result<()> {
    let dir = std::env::temp_dir().join("rustbook-fs-open");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir)?;
    let log = dir.join("app.log");

    // Stream writes through a buffer, and flush explicitly.
    let mut w = BufWriter::new(fs::File::create(&log)?);
    for i in 1..=3 { writeln!(w, "event {i}")?; }
    w.flush()?;

    // Append: writes always go to the end, even with other writers around.
    writeln!(OpenOptions::new().append(true).open(&log)?, "event 4")?;
    print!("{}", fs::read_to_string(&log)?);

    // create_new: succeeds only if the file did not exist -- an atomic name claim.
    let lock = dir.join("app.lock");
    OpenOptions::new().write(true).create_new(true).open(&lock)?;
    println!("second claim -> {:?}",
        OpenOptions::new().write(true).create_new(true).open(&lock).err().map(|e| e.kind()));

    // write(true) WITHOUT truncate(true) overwrites from the start and leaves the tail.
    fs::write(&log, "AAAAAAAA")?;
    OpenOptions::new().write(true).open(&log)?.write_all(b"bb")?;
    println!("no truncate -> {:?}", fs::read_to_string(&log)?);
    OpenOptions::new().write(true).truncate(true).open(&log)?.write_all(b"bb")?;
    println!("truncate    -> {:?}", fs::read_to_string(&log)?);

    // Contradictory options fail at runtime, not at compile time.
    println!("append+truncate -> {:?}",
        OpenOptions::new().append(true).truncate(true).open(&log).err().map(|e| e.kind()));
    println!("create, no write -> {:?}",
        OpenOptions::new().read(true).create(true).open(dir.join("new")).err().map(|e| e.kind()));

    // Read it back line by line.
    fs::write(&log, "one\ntwo\n")?;
    for line in BufReader::new(fs::File::open(&log)?).lines() { println!("line: {}", line?); }

    fs::remove_dir_all(&dir)?;
    Ok(())
}
```

```text
event 1
event 2
event 3
event 4
second claim -> Some(AlreadyExists)
no truncate -> "bbAAAAAA"
truncate    -> "bb"
append+truncate -> Some(InvalidInput)
create, no write -> Some(InvalidInput)
line: one
line: two
```

`OpenOptions` is a builder for exactly how a file is opened:

| Option | Effect |
|--------|--------|
| `.read(true)` | open for reading |
| `.write(true)` | open for writing — **at the start, without erasing what follows** |
| `.append(true)` | every write goes to the end; implies `write` |
| `.truncate(true)` | empty the file on open (requires `write`) |
| `.create(true)` | create if missing (requires `write` or `append`) |
| `.create_new(true)` | create, and **fail with `AlreadyExists`** if it's there; implies `create` |

The two lines worth memorising: `File::create(p)` is exactly `write(true).create(true).truncate(true)`, and `File::open(p)` is `read(true)`.

> [!mistake] `write(true)` is not "replace the file"
> Opening with `.write(true)` alone puts the cursor at byte 0 but keeps the existing length. Writing `"bb"` over `"AAAAAAAA"` leaves `"bbAAAAAA"` — the classic source of corrupted config files with trailing garbage from the previous version. If you mean *replace*, add `.truncate(true)`, or just use `fs::write` / `File::create`.

> [!key] `create_new(true)` is your only atomic "claim this name"
> `if !p.exists() { File::create(p) }` has a gap between the check and the create in which another process can win. `create_new` pushes the test into the same syscall, so exactly one caller succeeds and everyone else gets `AlreadyExists`. That is how lock files, unique output names, and "don't clobber existing data" flags are implemented correctly.

## Paths: `Path` and `PathBuf`

File paths are more than strings — they differ across operating systems (`/` vs `\`) and aren't always valid UTF-8. `std::path` models them properly, mirroring the [`str`/`String` split](#/ch/std-string-str): **`&Path`** is a borrowed path, **`PathBuf`** is an owned, growable one.

<figure class="diagram">
<svg viewBox="0 0 640 176" role="img" aria-label="The path slash home slash user slash archive dot tar dot gz broken down: parent is slash home slash user, file_name is archive.tar.gz, file_stem is archive.tar, and extension is gz">
  <style>
    .pa-p { font: 600 15px var(--font-mono); fill: var(--text); }
    .pa-l { font: 600 10.5px var(--font-mono); }
    .pa-c { font: 10px var(--font-sans); fill: var(--text-mute); }
  </style>
  <text x="60" y="86" class="pa-p">/home/user/</text>
  <text x="164" y="86" class="pa-p" fill="var(--rust-500)">archive.tar</text>
  <text x="269" y="86" class="pa-p">.</text>
  <text x="278" y="86" class="pa-p" fill="var(--blue)">gz</text>
  <path d="M60 62 L60 52 L155 52 L155 62" stroke="var(--text-mute)" stroke-width="1.3" fill="none"/>
  <text x="60" y="42" class="pa-l" fill="var(--text-mute)">parent()</text>
  <path d="M164 62 L164 24 L300 24 L300 62" stroke="var(--green)" stroke-width="1.3" fill="none"/>
  <text x="180" y="18" class="pa-l" fill="var(--green)">file_name()</text>
  <path d="M164 96 L164 116 L268 116 L268 96" stroke="var(--rust-500)" stroke-width="1.3" fill="none"/>
  <text x="164" y="130" class="pa-l" fill="var(--rust-500)">file_stem()</text>
  <path d="M278 96 L278 140 L300 140 L300 96" stroke="var(--blue)" stroke-width="1.3" fill="none"/>
  <text x="308" y="144" class="pa-l" fill="var(--blue)">extension()</text>
  <text x="380" y="46" class="pa-c">Each of these returns an <tspan font-family="var(--font-mono)">Option</tspan> — a path</text>
  <text x="380" y="62" class="pa-c">need not have a parent, a name, or an extension.</text>
  <text x="380" y="86" class="pa-c">Only the <tspan font-style="italic">last</tspan> dot counts, so the stem of</text>
  <text x="380" y="102" class="pa-c"><tspan font-family="var(--font-mono)">archive.tar.gz</tspan> is <tspan font-family="var(--font-mono)">archive.tar</tspan>, not <tspan font-family="var(--font-mono)">archive</tspan>.</text>
  <text x="60" y="166" class="pa-c">A leading dot is part of the name, not an extension: <tspan font-family="var(--font-mono)">.gitignore</tspan> has stem <tspan font-family="var(--font-mono)">.gitignore</tspan> and extension <tspan font-family="var(--font-mono)">None</tspan>.</text>
</svg>
<figcaption>Anatomy of a path: <code>parent</code>, <code>file_name</code>, <code>file_stem</code>, and <code>extension</code> — all of them <code>Option</code>s.</figcaption>
</figure>

```rust
use std::path::{Path, PathBuf};

fn main() {
    let p = Path::new("/home/user/archive.tar.gz");
    println!("file_name  {:?}", p.file_name());
    println!("file_stem  {:?}", p.file_stem());
    println!("extension  {:?}", p.extension());
    println!("parent     {:?}", p.parent());
    println!("components {:?}", p.components().collect::<Vec<_>>());

    // Surprises worth knowing:
    println!("dotfile ext {:?}", Path::new(".gitignore").extension());   // None!
    println!("no parent   {:?}", Path::new("/").parent());               // None
    println!("dotdot name {:?}", Path::new("..").file_name());           // None

    // push/join with an ABSOLUTE path REPLACES -- it does not append:
    let mut a = PathBuf::from("/var/log");
    a.push("/etc/passwd");
    println!("replaced   {}", a.display());
    println!("joined     {}", Path::new("/var/log").join("app.log").display());

    // No normalization happens: `..` stays put (only `.` is dropped by components()).
    let messy = Path::new("a/b/../c/./d");
    println!("messy      {} | {:?}", messy.display(), messy.components().collect::<Vec<_>>());

    // Derive sibling paths instead of doing string surgery:
    let mut f = PathBuf::from("report.txt");
    f.set_extension("md");
    println!("set_ext    {}", f.display());
    println!("with_ext   {}", Path::new("a/b.txt").with_extension("bak").display());

    // starts_with compares whole components, not characters:
    println!("{} {}", Path::new("/usr/local/bin").starts_with("/usr/local"),
                      Path::new("/usr/lib").starts_with("/usr/li"));

    // Paths need not be UTF-8, so display()/to_string_lossy() never panic; to_str() may be None.
    println!("lossy      {:?}", Path::new("café.txt").to_string_lossy());
    println!("to_str     {:?}", Path::new("ok.txt").to_str());
}
```

```text
file_name  Some("archive.tar.gz")
file_stem  Some("archive.tar")
extension  Some("gz")
parent     Some("/home/user")
components [RootDir, Normal("home"), Normal("user"), Normal("archive.tar.gz")]
dotfile ext None
no parent   None
dotdot name None
replaced   /etc/passwd
joined     /var/log/app.log
messy      a/b/../c/./d | [Normal("a"), Normal("b"), ParentDir, Normal("c"), Normal("d")]
set_ext    report.md
with_ext   a/b.bak
true false
lossy      "café.txt"
to_str     Some("ok.txt")
```

> [!warning] `push`/`join` with an absolute path throws away what you had
> `PathBuf::from("/var/log").push("/etc/passwd")` yields `/etc/passwd`, not `/var/log/etc/passwd`. This is by design (it mirrors how shells resolve arguments) and it is a genuine security hole when the second component is user input: a request for `/etc/passwd` escapes your data directory entirely. When joining untrusted input, reject absolute paths and any `..` component first — check `Path::components()` for `Component::ParentDir` and `Component::RootDir` rather than searching the string for `".."`.

> [!best] Build paths with `join`/`push`, never string concatenation
> Writing `format!("{dir}/{file}")` breaks on Windows and mishandles trailing slashes. Use **`Path::join`** or **`PathBuf::push`** — they insert the correct separator for the OS and handle edge cases. Accept **`impl AsRef<Path>`** in your function signatures so callers can pass a `&str`, `String`, `&Path`, or `PathBuf` interchangeably.

<figure class="diagram">
<svg viewBox="0 0 640 120" role="img" aria-label="Path is borrowed and PathBuf is owned, mirroring str and String">
  <style>
    .fsm { font: 600 12px var(--font-mono); fill: var(--text); }
    .fsc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .own { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .bor { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
  </style>
  <rect x="40" y="30" width="240" height="50" rx="8" class="own"/><text x="56" y="52" class="fsm">PathBuf — owned</text><text x="56" y="72" class="fsc">like String; build with push/join</text>
  <rect x="360" y="30" width="240" height="50" rx="8" class="bor"/><text x="376" y="52" class="fsm">&amp;Path — borrowed</text><text x="376" y="72" class="fsc">like &amp;str; inspect with methods</text>
  <path d="M282 55 L358 55" stroke="var(--text-mute)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="285" y="48" class="fsc">&amp;</text>
</svg>
<figcaption><code>PathBuf</code>/<code>&amp;Path</code> mirror <code>String</code>/<code>&amp;str</code> — own to build, borrow to inspect.</figcaption>
</figure>

## Directories: `read_dir` is one level deep

`fs::read_dir` yields the entries of *one* directory, in **unspecified order**, as `io::Result<DirEntry>` items. Recursion and sorting are yours to add:

```rust
use std::fs;
use std::io;
use std::path::Path;

/// read_dir is one level deep, so recursion is yours to write.
fn walk(dir: &Path, depth: usize, out: &mut Vec<String>) -> io::Result<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?.collect::<Result<_, _>>()?;
    entries.sort_by_key(|e| e.file_name());   // read_dir order is UNSPECIFIED -- sort if you care
    for e in entries {
        let kind = e.file_type()?;            // from the directory entry: no extra stat call
        out.push(format!("{}{}{}", "  ".repeat(depth), e.file_name().to_string_lossy(),
                         if kind.is_dir() { "/" } else { "" }));
        if kind.is_dir() { walk(&e.path(), depth + 1, out)?; }
    }
    Ok(())
}

fn main() -> io::Result<()> {
    let dir = std::env::temp_dir().join("rustbook-fs-walk");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("logs/2026"))?;      // create_dir_all makes every parent
    fs::write(dir.join("a.txt"), "hello")?;
    fs::write(dir.join("logs/2026/jan.log"), "entry")?;

    let mut out = Vec::new();
    walk(&dir, 0, &mut out)?;
    println!("{}", out.join("\n"));

    println!("create_dir on an existing dir -> {:?}",
        fs::create_dir(dir.join("logs")).err().map(|e| e.kind()));
    println!("create_dir_all on the same    -> {:?}",
        fs::create_dir_all(dir.join("logs")).is_ok());
    println!("remove_dir on a non-empty dir -> {:?}",
        fs::remove_dir(dir.join("logs")).err().map(|e| e.kind()));

    fs::remove_dir_all(&dir)?;
    Ok(())
}
```

```text
a.txt
logs/
  2026/
    jan.log
create_dir on an existing dir -> Some(AlreadyExists)
create_dir_all on the same    -> true
remove_dir on a non-empty dir -> Some(DirectoryNotEmpty)
```

Note the asymmetry in that output: `create_dir` on an existing directory is an **error**, while `create_dir_all` treats it as success — which makes `create_dir_all` the idempotent, script-friendly choice. On the removal side, `remove_dir` refuses a non-empty directory and `remove_dir_all` deletes the tree recursively, so the latter deserves the same respect as `rm -rf`.

> [!performance] `entry.file_type()` beats `entry.path().is_dir()`
> `DirEntry::file_type()` usually answers from data the directory read already returned; `path.is_dir()` calls `metadata()`, a fresh syscall per entry. Over a large tree that is the difference between one pass and two. Same for `entry.file_name()`, which doesn't allocate a full path the way `entry.path()` does. For real recursive walking with symlink-loop protection and parallelism, the `walkdir` crate is the standard answer — but the loop above is all a simple tool needs.

## Metadata, permissions, and symlinks

```rust
use std::fs;
use std::io;

fn main() -> io::Result<()> {
    let dir = std::env::temp_dir().join("rustbook-fs-meta");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir)?;
    let file = dir.join("a.txt");
    fs::write(&file, "hello")?;

    let m = fs::metadata(&file)?;
    println!("len {} | is_file {} | is_dir {} | readonly {}",
             m.len(), m.is_file(), m.is_dir(), m.permissions().readonly());
    if let Ok(t) = m.modified() {
        println!("modified within the last 5s: {}",
                 t.elapsed().map(|d| d.as_secs() < 5).unwrap_or(false));
    }

    // metadata() follows symlinks; symlink_metadata() reports on the link itself.
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&file, dir.join("link.txt"))?;
        println!("metadata          -> is_symlink {}",
                 fs::metadata(dir.join("link.txt"))?.is_symlink());
        println!("symlink_metadata  -> is_symlink {}",
                 fs::symlink_metadata(dir.join("link.txt"))?.is_symlink());

        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&file)?.permissions();
        println!("unix mode {:o}", perms.mode() & 0o777);
        perms.set_mode(0o444);                       // r--r--r--
        fs::set_permissions(&file, perms)?;
        println!("now readonly {} | writing gives {:?}",
                 fs::metadata(&file)?.permissions().readonly(),
                 fs::write(&file, "nope").err().map(|e| e.kind()));
        let mut perms = fs::metadata(&file)?.permissions();
        perms.set_mode(0o644);
        fs::set_permissions(&file, perms)?;
    }

    // canonicalize resolves . .. and symlinks -- and REQUIRES the path to exist.
    println!("canonicalize missing -> {:?}",
             fs::canonicalize(dir.join("ghost")).err().map(|e| e.kind()));
    println!("resolved ends with a.txt: {}",
             fs::canonicalize(dir.join("./a.txt"))?.ends_with("a.txt"));

    fs::remove_dir_all(&dir)?;
    Ok(())
}
```

```text
len 5 | is_file true | is_dir false | readonly false
modified within the last 5s: true
metadata          -> is_symlink false
symlink_metadata  -> is_symlink true
unix mode 644
now readonly true | writing gives Some(PermissionDenied)
canonicalize missing -> Some(NotFound)
resolved ends with a.txt: true
```

(The `unix mode` line reflects your umask, so `644` or `664` are both normal.)

| Call | Gives you |
|------|-----------|
| `fs::metadata(p)` | size, type, times, permissions — **follows** symlinks |
| `fs::symlink_metadata(p)` | the same, for the **link itself** (`is_symlink()` is only ever true here) |
| `m.len()` / `m.is_file()` / `m.is_dir()` | size in bytes and file type |
| `m.modified()` / `created()` / `accessed()` | `io::Result<SystemTime>` — not every platform records all three |
| `m.permissions().readonly()` | the portable permission bit |
| `PermissionsExt::mode()` / `set_mode()` | the full Unix mode, behind `std::os::unix::fs` |
| `fs::canonicalize(p)` | the absolute, symlink-free path — **errors if `p` doesn't exist** |
| `p.exists()` / `p.is_file()` / `p.is_dir()` | convenience wrappers that swallow errors into `false` |

> [!mistake] `p.exists()` returns `false` for "I couldn't tell"
> `Path::exists()` is `metadata(p).is_ok()`, so a permission error on a parent directory reports the same `false` as a genuinely missing file. When the distinction matters, call `fs::metadata(p)` and inspect the error kind — `NotFound` means absent, `PermissionDenied` means "not your business". `try_exists()` returns `io::Result<bool>` and keeps that difference.

## Saving without corrupting: write, sync, rename

`File::create(target)` truncates immediately, so from that instant until your last write completes, anyone reading the file sees an empty or half-written version. If the process is killed in between, that is the *permanent* state of the file. The fix is to write a sibling temporary file and then rename it over the target — `rename` replaces the directory entry in one indivisible step:

<figure class="diagram">
<svg viewBox="0 0 640 236" role="img" aria-label="Naive save truncates the target so readers can see an empty file, while the atomic pattern writes a temporary file, syncs it, and renames it over the target so readers see either the old or the new content">
  <style>
    .at-h { font: 700 11.5px var(--font-sans); }
    .at-m { font: 600 10.5px var(--font-mono); fill: var(--text); }
    .at-c { font: 10px var(--font-sans); fill: var(--text-mute); }
    .at-bad { fill: var(--red-soft); stroke: var(--red); stroke-width: 1.5; }
    .at-ok { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .at-step { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.4; }
  </style>
  <text x="20" y="16" class="at-h" fill="var(--red)">the naive way — a window where the file is wrong</text>
  <rect x="20" y="26" width="150" height="34" rx="4" class="at-step"/><text x="30" y="47" class="at-m">File::create</text>
  <rect x="196" y="26" width="150" height="34" rx="4" class="at-bad"/><text x="206" y="47" class="at-m">target is EMPTY</text>
  <rect x="372" y="26" width="150" height="34" rx="4" class="at-step"/><text x="382" y="47" class="at-m">write_all</text>
  <text x="20" y="76" class="at-c">A reader — or a crash — landing in the middle sees a truncated file. There is no way to recover the old content.</text>
  <text x="20" y="112" class="at-h" fill="var(--green)">the atomic way — the target is only ever old or new</text>
  <rect x="20" y="122" width="140" height="38" rx="4" class="at-step"/><text x="30" y="138" class="at-m">write config.tmp</text><text x="30" y="153" class="at-c">target untouched</text>
  <rect x="182" y="122" width="140" height="38" rx="4" class="at-step"/><text x="192" y="138" class="at-m">sync_all()</text><text x="192" y="153" class="at-c">bytes on the device</text>
  <rect x="344" y="122" width="140" height="38" rx="4" class="at-ok"/><text x="354" y="138" class="at-m">rename → config</text><text x="354" y="153" class="at-c">one atomic step</text>
  <rect x="506" y="122" width="114" height="38" rx="4" class="at-ok"/><text x="516" y="138" class="at-m">done</text><text x="516" y="153" class="at-c">no partial state</text>
  <text x="20" y="184" class="at-c">Every reader that opens the file gets the complete old version or the complete new one — never a mix.</text>
  <text x="20" y="202" class="at-c">The temporary file must live on the <tspan font-style="italic">same filesystem</tspan> as the target, or the rename becomes a copy and loses atomicity.</text>
  <text x="20" y="220" class="at-c">Put it beside the target (<tspan font-family="var(--font-mono)">config.tmp</tspan>), not in <tspan font-family="var(--font-mono)">/tmp</tspan>.</text>
</svg>
<figcaption>The atomic-save pattern: write a sibling temporary file, <code>sync_all</code>, then <code>rename</code> it over the target.</figcaption>
</figure>

```rust
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;

/// Write so that a reader never observes a half-finished file.
fn save_atomically(target: &Path, bytes: &[u8]) -> io::Result<()> {
    let tmp = target.with_extension("tmp");
    {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;                 // ask the OS to commit the bytes to the device
    }                                  // the file closes here, before the rename
    fs::rename(&tmp, target)           // atomic within one filesystem
}

fn main() -> io::Result<()> {
    let dir = std::env::temp_dir().join("rustbook-fs-atomic");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir)?;
    let config = dir.join("config.json");

    save_atomically(&config, br#"{"version":1}"#)?;
    println!("first  -> {}", fs::read_to_string(&config)?);
    save_atomically(&config, br#"{"version":2}"#)?;
    println!("second -> {}", fs::read_to_string(&config)?);
    println!("no leftover temp file: {}", !dir.join("config.tmp").exists());

    // Check-then-act is a race. Just try the operation and read the error.
    let claim = dir.join("once.txt");
    for attempt in 1..=2 {
        match fs::OpenOptions::new().write(true).create_new(true).open(&claim) {
            Ok(_) => println!("attempt {attempt}: claimed it"),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists =>
                println!("attempt {attempt}: someone else has it"),
            Err(e) => return Err(e),
        }
    }

    fs::remove_dir_all(&dir)?;
    Ok(())
}
```

```text
first  -> {"version":1}
second -> {"version":2}
no leftover temp file: true
attempt 1: claimed it
attempt 2: someone else has it
```

> [!key] Try the operation; don't ask permission first
> Every `if p.exists()` / `if p.is_dir()` followed by an action is a race — the answer can change before the next line runs (a class of bug known as **TOCTOU**, time-of-check to time-of-use). Prefer operations that decide atomically and report back: `create_new` instead of `exists` + `create`, `create_dir_all` instead of `is_dir` + `create_dir`, and `match fs::read_to_string(p)` on `ErrorKind::NotFound` instead of `exists` + read. It is shorter code *and* correct code. For real inter-process locking, note that `std` has no file-locking API — reach for the `fs4` or `fd-lock` crates.

> [!deep] What `sync_all` actually buys you
> `write_all` returning `Ok` means the bytes reached the *operating system*, not the disk — they may sit in the page cache for seconds. `File::sync_all()` asks the OS to push them to the device and returns only when it's done (`sync_data()` skips the metadata). Databases pay this cost deliberately; ordinary programs usually shouldn't, since it can be orders of magnitude slower. The exception is exactly the pattern above: if you skip the sync, a power failure right after the rename can leave the new *name* pointing at a file whose *contents* never landed.

## The error kinds you'll actually see

Every `fs` call returns `io::Result`, and branching on `e.kind()` is how you respond:

| Operation that failed | `ErrorKind` |
|-----------------------|-------------|
| open/read a missing path | `NotFound` |
| `create_new` on an existing path, or `create_dir` on an existing dir | `AlreadyExists` |
| open without rights, or write to a read-only file | `PermissionDenied` |
| `read_to_string` on a directory | `IsADirectory` |
| `remove_dir` on a file | `NotADirectory` |
| `remove_dir` on a non-empty directory | `DirectoryNotEmpty` |
| `append(true).truncate(true)`, or `create` without write access | `InvalidInput` |
| `read_to_string` on non-UTF-8 bytes | `InvalidData` |

> [!warning] Filesystem calls fail for real-world reasons
> Files get deleted between operations; permissions deny access; disks fill up; another process is writing the same file. Every `fs` call returns a `Result` for good reason — handle it, and attach the *path* to the message, because "No such file or directory (os error 2)" with no filename is the least useful error a program can print. [`anyhow`'s `.context`](#/ch/custom-errors) exists for exactly this: `fs::read_to_string(&p).with_context(|| format!("reading {}", p.display()))?`.

## Summary

- Three levels: **`fs::read_to_string`/`read`/`write`** for whole files, **`File` + `BufReader`/`BufWriter`** for streaming, **`OpenOptions`** for exact semantics.
- `File::create` = `write + create + truncate`; **`write(true)` alone does not truncate**, so short writes leave the old tail behind.
- **`create_new(true)`** is the only race-free "claim this name"; `create_dir_all` and `remove_dir_all` are the idempotent/recursive siblings of `create_dir`/`remove_dir`.
- `parent`, `file_name`, `file_stem`, `extension` all return `Option`; only the last dot counts, and a leading dot is part of the name.
- **`push`/`join` with an absolute path replaces the whole path** — validate untrusted input by inspecting `components()` for `RootDir`/`ParentDir`.
- Paths aren't guaranteed UTF-8: `display()`/`to_string_lossy()` always work, `to_str()` returns `Option`. Accept `impl AsRef<Path>` in your APIs.
- `read_dir` is one level deep and unordered; prefer `entry.file_type()` over `path.is_dir()`; use `metadata` vs `symlink_metadata` to follow or not follow links.
- Save with **write-temp → `sync_all` → `rename`** so readers never see a partial file, and avoid **TOCTOU** by letting the operation itself decide (`create_new`, `create_dir_all`, matching on `NotFound`).

> [!exercise] Try it yourself
> 1. Write a `String` to a file with `fs::write`, read it back with `fs::read_to_string`, then delete it — all inside `std::env::temp_dir()`.
> 2. Use `OpenOptions::new().append(true).create(true)` to add a timestamped line to a log file, and run it twice to confirm it accumulates.
> 3. Print the file name, stem, and extension of `/tmp/data.tar.gz`, then build a sibling `/tmp/data.tar.bak` using `with_extension`.
> 4. Write `fn safe_join(base: &Path, user: &str) -> Option<PathBuf>` that returns `None` if `user` is absolute or contains a `..` component, and test it against `"a/b"`, `"/etc/passwd"`, and `"../../etc/passwd"`.
> 5. Extend `walk` to report total bytes and the largest file, using `entry.metadata()` rather than a second `fs::metadata` call.
> 6. Wrap `save_atomically` so it keeps a `.bak` of the previous version: rename the old target aside before the final rename, and confirm both files end up correct.
> 7. Write a `du`-style tool that sums the sizes in a directory tree and prints the ten biggest files, sorted.
> 8. Trigger four different `ErrorKind`s on purpose (`NotFound`, `AlreadyExists`, `IsADirectory`, `DirectoryNotEmpty`) and print a human-readable message for each.

Next in the reference: a decision guide and cheat-sheet for every collection in **`std::collections`**.
