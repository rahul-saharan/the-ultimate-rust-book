<h1><span class="h1-kicker">Building Real Projects</span>A Taste of Embedded Rust</h1>

At the opposite extreme from web servers lies **embedded** development: programming tiny microcontrollers with kilobytes of RAM, no operating system, and no heap — the chips inside sensors, drones, keyboards, and IoT devices. Rust is a superb fit here: the same memory safety, but with total control and zero runtime overhead. This chapter is a *taste* — enough to understand `no_std` Rust and blink an LED, the embedded "hello world".

The code here can't run in the browser playground, but it isn't hand-waving either: every example was **cross-compiled for a real ARM Cortex-M4F target** (`thumbv7em-none-eabihf`), and every byte count and error message below came out of that build.

## Why Rust for embedded?

> [!key] Rust brings safety to bare metal
> Embedded C is notoriously bug-prone — a single stray pointer or buffer overflow can brick a device with no OS to catch it. Rust brings its **compile-time memory safety** to these constraints *without* adding a garbage collector or runtime, so you get C-level control and predictability with far fewer catastrophic bugs. For safety-critical devices (medical, automotive, industrial), that's transformative — which is why Rust's embedded ecosystem is growing fast.

## `#![no_std]`: life without the standard library

A microcontroller has no operating system and often no heap allocator, so the full [`std`](#/ch/std-overview) library (which assumes both) isn't available. Embedded Rust uses **`#![no_std]`**, which drops `std` and gives you only **`core`** — the OS-free, heap-free subset (primitives, `Option`, `Result`, `Iterator`, slices, `Ordering`):

```rust,ignore
#![no_std]  // no standard library — only `core`
#![no_main] // no standard main entry point; the runtime provides one

use panic_halt as _; // define what happens on panic (here: halt the CPU)

// Everything from `core` still works: Option, Result, iterators, slices, math…
// But no Vec, String, HashMap, files, threads, or println! (there's no console).
```

> [!key] `no_std` = `core` only (no heap, no OS)
> With **`#![no_std]`** you lose everything that needs an OS or allocator: **`Vec`, `String`, `HashMap`, `Box`, files, networking, threads, `println!`**. You keep everything in **`core`**: integers/floats, `Option`/`Result`, `Iterator`, slices, `match`, traits, generics. If you *do* have an allocator, you can opt back into the **`alloc`** crate for `Vec`/`String`/`Box` — but many embedded programs avoid heap allocation entirely for predictability.

### What that actually feels like

The compiler is blunt about it. Reach for a `std` type under `#![no_std]` and you don't get a helpful "enable a feature" message — the name simply doesn't exist, because the prelude that provided it is gone:

```text
error: cannot find macro `println` in this scope
error[E0425]: cannot find type `Vec` in this scope
error[E0433]: cannot find type `String` in this scope
```

And the very first thing a `no_std` binary needs is somewhere for a panic to go. Omit it and the build stops before anything else:

```text
error: `#[panic_handler]` function required, but not found
```

That's what `use panic_halt as _;` is for — the odd-looking `as _` imports the crate purely for its `#[panic_handler]`, since you never call anything from it. Your choice of panic crate *is* your device's failure policy:

| Crate | On panic |
|---|---|
| `panic-halt` | spin forever — the device freezes, safe for a bench prototype |
| `panic-reset` | reboot the chip, which is usually what shipping firmware wants |
| `panic-probe` | print the message and location over the debug probe, then halt — the development default |
| `panic-semihosting` | print via the debugger's semihosting channel (slow, needs a debugger attached) |
| hand-written | log to flash, set an error LED, put actuators in a safe state, *then* reset |

| Layer | Provides | Needs |
|---|---|---|
| **`core`** | primitives, `Option`/`Result`, `Iterator`, slices, `fmt`, atomics, `PhantomData` | nothing — always available |
| **`alloc`** | `Vec`, `String`, `Box`, `BTreeMap`, `Rc`, `Arc` | a `#[global_allocator]` (e.g. `embedded-alloc`) |
| **`std`** | files, threads, networking, `println!`, `HashMap`, time | an operating system |

> [!key] `no_std` is a subtraction, not a different language
> Ownership, borrowing, traits, generics, iterators, closures, pattern matching, `?`, and `core::fmt` all work exactly as they do on a server — this is the same Rust you already know. What disappears is everything that assumed an OS or a heap. That's why the borrow checker is such a good deal here: on a chip with no MMU, no OS, and no way to print a stack trace, a use-after-free doesn't segfault politely — it silently corrupts a register bank and the device starts behaving strangely three days later.

## The project setup

A `no_std` binary needs a target, a memory layout, and a linker script — three files you write once and forget:

```toml
# Cargo.toml
[dependencies]
cortex-m = { version = "0.7", features = ["critical-section-single-core"] }
cortex-m-rt = "0.7"                 # startup code, vector table, #[entry], #[exception]
panic-halt = "0.2"
embedded-hal = "1.0"                # portable peripheral traits
heapless = "0.8"                    # fixed-capacity Vec/String, no allocator

[profile.release]
opt-level = "z"                     # size matters more than speed on a 512 KB chip
lto = true
codegen-units = 1
debug = true                        # debug info lives in the ELF, not on the device
```

```text
# memory.x -- where flash and RAM actually are on this chip
MEMORY
{
  FLASH : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   : ORIGIN = 0x20000000, LENGTH = 128K
}
```

```toml
# .cargo/config.toml -- so plain `cargo build` cross-compiles
[build]
target = "thumbv7em-none-eabihf"    # ARM Cortex-M4/M7 with hardware floating point

[target.thumbv7em-none-eabihf]
rustflags = ["-C", "link-arg=-Tlink.x"]   # cortex-m-rt's linker script
```

Then `rustup target add thumbv7em-none-eabihf` and `cargo build --release` produces an ELF you can flash. The `-none-` in the target triple is the operating system field: there isn't one.

## Blinking an LED

The embedded "hello world" is blinking an LED. Using the `embedded-hal` traits (a portable hardware abstraction) and a board support crate, it looks remarkably readable for bare-metal code:

```rust,ignore
#![no_std]
#![no_main]

use panic_halt as _;
use cortex_m_rt::entry;       // provides the real entry point
use embedded_hal::digital::OutputPin;

#[entry]
fn main() -> ! {              // note: returns `!` (never) — embedded main never returns
    let mut board = setup_board();     // board-specific initialization
    let mut led = board.led;
    let mut delay = board.delay;

    loop {
        led.set_high().unwrap();       // LED on
        delay.delay_ms(500);
        led.set_low().unwrap();        // LED off
        delay.delay_ms(500);
    }
}
```

Note the signature `fn main() -> !` — an embedded program's `main` **never returns** (there's nothing to return *to*); it loops forever. That `!` is the [never type](#/ch/advanced-types) doing exactly its job.

<figure class="diagram">
<svg viewBox="0 0 640 150" role="img" aria-label="The embedded stack: your code on HAL traits, on a peripheral access crate, on the chip">
  <style>
    .emb { font: 600 11px var(--font-mono); fill: var(--text); }
    .emc { font: 11px var(--font-sans); fill: var(--text-mute); }
    .l1e { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .l2e { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .l3e { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .l4e { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
  </style>
  <rect x="120" y="14" width="400" height="26" class="l1e"/><text x="134" y="32" class="emb">your app (no_std) — led.set_high()</text>
  <rect x="120" y="44" width="400" height="26" class="l2e"/><text x="134" y="62" class="emb">embedded-hal — portable traits (OutputPin, DelayMs)</text>
  <rect x="120" y="74" width="400" height="26" class="l3e"/><text x="134" y="92" class="emb">HAL / PAC crate — this chip's registers</text>
  <rect x="120" y="104" width="400" height="26" class="l4e"/><text x="134" y="122" class="emb">the microcontroller hardware</text>
</svg>
<figcaption>Embedded Rust layers your <code>no_std</code> code on portable <b>embedded-hal</b> traits, on a chip-specific crate, on the metal.</figcaption>
</figure>

## No heap: fixed capacity instead

Without an allocator, "grow as needed" isn't available — so capacity becomes part of the *type*. `heapless::Vec<u16, 8>` is eight `u16`s inline, and `push` returns a `Result` instead of allocating:

```rust,ignore
use heapless::Vec;

/// A fixed-capacity buffer: no heap, capacity known at compile time.
fn moving_average(samples: &Vec<u16, 8>) -> u16 {
    if samples.is_empty() { return 0; }
    let sum: u32 = samples.iter().map(|&s| s as u32).sum();
    (sum / samples.len() as u32) as u16
}

let mut window: Vec<u16, 8> = Vec::new();

// push returns Err when full -- the type carries the capacity, so
// "buffer overflow" becomes a value you must handle, not memory corruption.
if window.push(reading).is_err() {
    window.remove(0);
    let _ = window.push(reading);
}
let avg = moving_average(&window);
```

| Instead of | Use | Notes |
|---|---|---|
| `Vec<T>` | `heapless::Vec<T, N>` | `push` → `Result`; lives inline, so it can be a `static` |
| `String` | `heapless::String<N>`, or `write!` into one | `core::fmt` needs no allocator |
| `HashMap` | `heapless::FnvIndexMap<K, V, N>` (N a power of two) | or a sorted array + binary search |
| `VecDeque` | `heapless::Deque<T, N>` | the natural fit for a ring buffer |
| `Box<dyn Trait>` | generics, or `&dyn Trait` to a `static` | monomorphisation costs flash, `dyn` costs a jump |
| a channel | `heapless::spsc::Queue` | lock-free, designed for interrupt ↔ main |

If you genuinely need dynamic allocation, you can have it: add an allocator (`embedded-alloc`) and `extern crate alloc;` brings back `Vec`, `String`, and `Box`. Most firmware deliberately doesn't, because a fixed memory budget you can prove at compile time beats a runtime `OutOfMemory` you can't recover from.

## Sharing data with an interrupt

An interrupt handler is a function the hardware can call *between any two instructions* of your main loop. That's concurrency without threads, and `static mut` is the unsound way to handle it. The safe pattern pairs a critical section with interior mutability:

```rust,ignore
use core::cell::RefCell;
use cortex_m::interrupt::{self, Mutex};
use cortex_m_rt::exception;

/// Shared between the interrupt handler and main. A plain `static mut` would be
/// unsound; this is the standard safe pattern.
static TICKS: Mutex<RefCell<u32>> = Mutex::new(RefCell::new(0));

/// Fires on every SysTick interrupt.
#[exception]
fn SysTick() {
    interrupt::free(|cs| {                     // briefly disable interrupts
        let mut t = TICKS.borrow(cs).borrow_mut();
        *t = t.wrapping_add(1);
    });
}

// ...and in main, the same key (`cs`) is required to read it:
let ticks = interrupt::free(|cs| *TICKS.borrow(cs).borrow());
```

`cortex_m::interrupt::Mutex` is not `std`'s — it never blocks. Access requires a `CriticalSection` token, and the only way to obtain one is inside `interrupt::free`, where interrupts are disabled. The type system therefore *proves* the handler can't fire mid-update. The modern, chip-independent spelling of the same idea is the `critical-section` crate.

| Sharing need | Reach for |
|---|---|
| a counter or flag | `AtomicU32`/`AtomicBool` — no critical section at all |
| a small struct read by main, written by an ISR | `Mutex<RefCell<T>>` + `interrupt::free` |
| a peripheral handle moved into an ISR | `Mutex<RefCell<Option<Peripheral>>>`, filled during init |
| a stream of samples | `heapless::spsc::Queue` — producer in the ISR, consumer in main |
| anything more structured | **RTIC** (compile-time-scheduled tasks with priorities) or **embassy** (`async` tasks) |

> [!warning] Keep critical sections microscopic
> `interrupt::free` disables *every* interrupt on the core. Do arithmetic on a shared counter there, not a UART transmission or a 500 ms delay — while interrupts are off, timer ticks are missed, incoming bytes are dropped, and a motor-control loop misses its deadline. The habit from the [`std::sync` chapter](#/ch/std-sync) applies here with the volume turned up: copy the value out, close the critical section, then do the work.

## Where the bytes go

With no OS to load your program, the linker script places everything itself: code and constants in flash, mutable data in RAM. Here is the actual layout of the sensor firmware above, straight from `size -A`:

<figure class="diagram">
<svg viewBox="0 0 640 258" role="img" aria-label="The memory map of the compiled firmware: flash holds a 1024-byte vector table and 1912 bytes of code, while RAM holds 4 bytes of zero-initialised statics plus the stack growing downward from the top">
  <style>
    .mm-h { font: 700 11px var(--font-sans); }
    .mm-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .mm-c { font: 9.5px var(--font-sans); fill: var(--text-mute); }
    .mm-f { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.4; }
    .mm-r { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.4; }
    .mm-free { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.1; }
  </style>
  <text x="20" y="16" class="mm-h" fill="var(--rust-500)">FLASH — 512 KB at 0x0800_0000</text>
  <text x="340" y="16" class="mm-h" fill="var(--blue)">RAM — 128 KB at 0x2000_0000</text>
  <rect x="20" y="26" width="280" height="30" class="mm-f"/><text x="30" y="45" class="mm-m">.vector_table   1024 B</text>
  <text x="200" y="45" class="mm-c">reset + interrupt addresses</text>
  <rect x="20" y="58" width="280" height="30" class="mm-f"/><text x="30" y="77" class="mm-m">.text           1912 B</text>
  <text x="200" y="77" class="mm-c">all your code</text>
  <rect x="20" y="90" width="280" height="22" class="mm-f"/><text x="30" y="105" class="mm-m">.rodata            0 B</text>
  <text x="200" y="105" class="mm-c">string/const data</text>
  <rect x="20" y="114" width="280" height="54" class="mm-free"/><text x="30" y="136" class="mm-m">unused flash   ~521 KB</text>
  <text x="30" y="152" class="mm-c">the whole firmware is 2936 bytes</text>
  <rect x="340" y="26" width="280" height="24" class="mm-r"/><text x="350" y="42" class="mm-m">.data              0 B</text>
  <text x="500" y="42" class="mm-c">initialised statics</text>
  <rect x="340" y="52" width="280" height="24" class="mm-r"/><text x="350" y="68" class="mm-m">.bss               4 B</text>
  <text x="500" y="68" class="mm-c">the TICKS counter</text>
  <rect x="340" y="78" width="280" height="66" class="mm-free"/><text x="350" y="98" class="mm-m">free RAM</text>
  <text x="350" y="114" class="mm-c">no heap exists unless you add an allocator</text>
  <text x="350" y="130" class="mm-c">nothing here is reserved for you</text>
  <rect x="340" y="146" width="280" height="22" class="mm-r"/><text x="350" y="161" class="mm-m">stack ↓ grows down from the top</text>
  <text x="20" y="192" class="mm-c">Startup, before <tspan font-family="var(--font-mono)">main</tspan>: <tspan font-family="var(--font-mono)">cortex-m-rt</tspan> copies <tspan font-family="var(--font-mono)">.data</tspan> from flash into RAM, zeroes <tspan font-family="var(--font-mono)">.bss</tspan>, sets the stack pointer, then jumps to <tspan font-family="var(--font-mono)">#[entry]</tspan>.</text>
  <text x="20" y="212" class="mm-c">Nothing checks that the stack won't grow into your statics — that collision is the embedded equivalent of a segfault,</text>
  <text x="20" y="226" class="mm-c">and it is why <tspan font-family="var(--font-mono)">flip-link</tspan> (which puts the stack at the <tspan font-style="italic">bottom</tspan>, so overflow faults instead of corrupting) is worth adding.</text>
  <text x="20" y="248" class="mm-c">Debug info lives in the ELF on your laptop, not on the chip: <tspan font-family="var(--font-mono)">debug = true</tspan> costs zero flash.</text>
</svg>
<figcaption>The real memory map of this chapter's firmware: 2,936 bytes of flash, 4 bytes of RAM, and no heap at all.</figcaption>
</figure>

```text
$ size -A target/thumbv7em-none-eabihf/release/blinky
section            size        addr
.vector_table      1024   134217728
.text              1912   134218752
.rodata               0   134220664
.data                 0   536870912
.bss                  4   536870912
.uninit               0   536870916

$ size target/thumbv7em-none-eabihf/release/blinky
   text    data     bss     dec     hex
   2936       0       4    2940     b7c

$ nm target/…/blinky | grep -c -i 'alloc\|malloc'
0
```

A moving average over an 8-sample window, a `heapless::Vec`, an interrupt handler, and a shared counter: **2,936 bytes of flash and 4 bytes of RAM**, with not one allocator symbol in the binary.

### The one line that can cost you 13 KB

Formatting is where embedded binaries quietly explode. Three builds of the same firmware, differing only in what they format:

| What the program formats | Total flash | Cost |
|---|---|---|
| a fixed `&str` (no formatting) | 1,212 B | baseline |
| `write!(s, "raw={}", reading)` — an integer | 2,464 B | **+1.2 KB** |
| `write!(s, "temp={:.1}C", celsius)` — an `f32` | 14,948 B | **+13.7 KB** |

Float formatting drags in the whole shortest-round-trip float printer. On a chip with 16 KB of flash, that one `{:.1}` is your entire budget — which is why embedded code prints fixed-point integers (`temp={}.{}`, dividing by ten yourself) and why **`defmt`** exists: it sends the *format string's id* and the raw arguments over the wire, and does the formatting on your laptop. Log lines then cost a few bytes each instead of kilobytes of formatter.

## No `std::time`, either

There is no clock. `Instant`, `SystemTime`, and `thread::sleep` are all gone, because they need an OS. What you have instead:

| Instead of | On a microcontroller |
|---|---|
| `Instant::now()` | a hardware timer or `SysTick` counter you configure and read |
| `Duration` | still available — it's in `core`… but nothing produces one for you |
| `thread::sleep(d)` | `embedded_hal::delay::DelayNs` (`delay_ms`), or a timer interrupt |
| a scheduler | RTIC's task priorities, or embassy's `Timer::after(…).await` |
| wall-clock date/time | an external RTC chip, or NTP if you have a network |

Busy-wait delays (`delay_ms`) are fine for blinking an LED and wrong for anything else — they burn power and block every other job. Real firmware sleeps the core (`cortex_m::asm::wfi`, "wait for interrupt") and lets a timer wake it, which is the difference between a coin cell lasting days and lasting years.

## The embedded toolkit

> [!tip] The ecosystem that makes this pleasant
> - **`embedded-hal`** — portable traits (`OutputPin`, `DelayMs`, `Spi`, `I2c`) so a *driver* written against them works on any chip. This is the ecosystem's superpower: write a sensor driver once, use it everywhere.
> - **HAL/PAC crates** — per-chip crates (`stm32f4xx-hal`, `rp2040-hal`, `esp-hal`) implementing those traits for real hardware.
> - **`cortex-m` / `cortex-m-rt`** — runtime and utilities for ARM Cortex-M chips.
> - **`probe-rs`** — flash and debug your program on the device over USB (`cargo embed`, `cargo flash`, plus a real GDB/DAP bridge for VS Code breakpoints).
> - **`defmt`** — logging that costs bytes instead of kilobytes: the format string stays on your laptop, so `defmt::info!("temp={}", t)` sends an id and the raw value.
> - **`heapless`** — the fixed-capacity collections above; **`fixed`** for fixed-point arithmetic instead of dragging in floats.
> - **`rtic`** — tasks with compile-time-verified priorities and lock-free resource sharing, no RTOS required.
> - **`embassy`** — a remarkable **async** framework for embedded: `async`/`await` on a microcontroller, with no OS, for elegant concurrent firmware.
> - **`flip-link`** — moves the stack so that overflowing it faults immediately instead of silently corrupting your statics.
> - **`svd2rust`** — generates a typed peripheral-access crate from the vendor's register description, which is where "the compiler knows this register is read-only" comes from.

> [!performance] The typed peripheral API is genuinely free
> `led.set_high()` looks like a method call over three layers of abstraction — your code, `embedded-hal`'s `OutputPin` trait, the chip HAL, the PAC's register block. After monomorphisation and inlining it compiles to a single store to a memory-mapped register: the same instruction the C version emits. That's the whole bargain of zero-cost abstraction, and it's why the 2,936-byte binary above can afford traits, generics, iterators, and a `Result`-returning buffer. Check it yourself with `cargo objdump --release -- -d` (from `cargo-binutils`) — the disassembly is short enough to read.

## Where to go next

Embedded is a deep field, but Rust makes it approachable. To actually get hands-on:

> [!best] Start with a dev board and the official guide
> Grab an inexpensive, well-supported board — a **micro:bit v2**, **Raspberry Pi Pico** (RP2040), or an **STM32 "blue/black pill"**. Then work through **[The Embedded Rust Book](https://docs.rust-embedded.org/book/)** and the **Discovery** book, which walk you from blinking an LED to reading sensors and driving displays on real hardware. The `probe-rs`/`cargo embed` tooling makes flash-and-debug genuinely pleasant — a world away from traditional embedded workflows.

> [!note] `no_std` isn't only for microcontrollers
> The `#![no_std]` technique also powers **WASM** modules, OS kernels, bootloaders, and any environment without a standard OS. Understanding `core` vs `std` (from the [std overview](#/ch/std-overview)) is what unlocks all of these "Rust in unusual places" domains. The same language scales from a cloud server down to an 8-KB microcontroller.

## Summary

- **Embedded Rust** brings compile-time memory safety to bare-metal microcontrollers — C-level control, far fewer catastrophic bugs, no GC or runtime.
- **`#![no_std]`** drops `std` for **`core`** only: no heap, `Vec`, `String`, files, threads, or `println!` — but `Option`, `Result`, `Iterator`, slices, `core::fmt`, and traits remain (add **`alloc`** if you have an allocator). The compiler's message is simply `cannot find type Vec in this scope`.
- Every `no_std` binary needs a **`#[panic_handler]`** — and which crate you pick (`panic-halt`, `panic-reset`, `panic-probe`) *is* your device's failure policy.
- Setup is three files: a target in `.cargo/config.toml`, a `memory.x` describing where flash and RAM live, and `cortex-m-rt` providing startup, the vector table, `#[entry]`, and `#[exception]`. Embedded `main` is `fn main() -> !` — it never returns.
- **No heap means capacity is part of the type**: `heapless::Vec<u16, 8>` returns `Err` from `push` instead of allocating, turning buffer overflow into a value you must handle.
- **Interrupts are concurrency without threads.** Share with atomics, or `Mutex<RefCell<T>>` + `interrupt::free`, where the `CriticalSection` token *proves* the handler can't fire mid-update — and keep those sections microscopic.
- Measured on a real Cortex-M4F build: the sample firmware (interrupt handler, shared counter, `heapless` window, moving average) is **2,936 bytes of flash and 4 bytes of RAM**, with zero allocator symbols.
- **Formatting is the size trap**: an integer `write!` costs about +1.2 KB, an `f32` `{:.1}` costs **+13.7 KB**. Use fixed-point, or `defmt`, which formats on your laptop.
- There is **no clock**: no `Instant`, no `thread::sleep`. Use a timer, `DelayNs`, or `wfi` and a timer interrupt — busy-waiting costs battery.
- The ecosystem — `embedded-hal`, HAL/PAC crates, `cortex-m`, **`probe-rs`**, `defmt`, `flip-link`, and **`rtic`**/**`embassy`** — makes it productive, and the typed peripheral API compiles down to the same single store a C program emits.
- The same `no_std`/`core` knowledge also powers WASM, kernels, and bootloaders.

> [!exercise] Try it yourself (with hardware)
> 1. Get a Raspberry Pi Pico or micro:bit and follow The Embedded Rust Book's "blink an LED" chapter.
> 2. Explain, in one sentence, what you lose and what you keep under `#![no_std]`.
> 3. Explore `embassy` and describe how `async`/`await` could simplify concurrent firmware.
> 4. Reproduce the formatting measurement: build the same firmware three times — a fixed string, an integer `write!`, and an `f32` `{:.1}` — and compare `size` output. Then replace the float with fixed-point maths and measure again.
> 5. Delete the `use panic_halt as _;` line and read the error; then write your own `#[panic_handler]` that lights an LED and calls `cortex_m::peripheral::SCB::sys_reset()`.
> 6. Fill a `heapless::Vec<u16, 4>` past its capacity and handle the `Err` by dropping the oldest sample; assert the length never exceeds 4.
> 7. Share a `heapless::spsc::Queue` between a `SysTick` handler (producer) and `main` (consumer), and confirm you never need a critical section for it.
> 8. Add `flip-link` to `.cargo/config.toml`, then deliberately recurse until the stack overflows, and compare what happens with and without it.

That completes the projects part — you've seen Rust build a CLI, a web service, a browser module, and firmware. Next is the crown jewel of this book: a complete course in **Data Structures & Algorithms** in Rust.
