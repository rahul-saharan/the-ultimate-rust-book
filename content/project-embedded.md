<h1><span class="h1-kicker">Building Real Projects</span>A Taste of Embedded Rust</h1>

At the opposite extreme from web servers lies **embedded** development: programming tiny microcontrollers with kilobytes of RAM, no operating system, and no heap — the chips inside sensors, drones, keyboards, and IoT devices. Rust is a superb fit here: the same memory safety, but with total control and zero runtime overhead. This chapter is a *taste* — enough to understand `no_std` Rust and blink an LED, the embedded "hello world". (This targets real hardware, so the code is illustrative.)

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

## The embedded toolkit

> [!tip] The ecosystem that makes this pleasant
> - **`embedded-hal`** — portable traits (`OutputPin`, `DelayMs`, `Spi`, `I2c`) so a *driver* written against them works on any chip. This is the ecosystem's superpower: write a sensor driver once, use it everywhere.
> - **HAL/PAC crates** — per-chip crates (`stm32f4xx-hal`, `rp2040-hal`, `esp-hal`) implementing those traits for real hardware.
> - **`cortex-m` / `cortex-m-rt`** — runtime and utilities for ARM Cortex-M chips.
> - **`probe-rs`** — flash and debug your program on the device over USB (`cargo embed`).
> - **`embassy`** — a remarkable **async** framework for embedded: `async`/`await` on a microcontroller, with no OS, for elegant concurrent firmware.

## Where to go next

Embedded is a deep field, but Rust makes it approachable. To actually get hands-on:

> [!best] Start with a dev board and the official guide
> Grab an inexpensive, well-supported board — a **micro:bit v2**, **Raspberry Pi Pico** (RP2040), or an **STM32 "blue/black pill"**. Then work through **[The Embedded Rust Book](https://docs.rust-embedded.org/book/)** and the **Discovery** book, which walk you from blinking an LED to reading sensors and driving displays on real hardware. The `probe-rs`/`cargo embed` tooling makes flash-and-debug genuinely pleasant — a world away from traditional embedded workflows.

> [!note] `no_std` isn't only for microcontrollers
> The `#![no_std]` technique also powers **WASM** modules, OS kernels, bootloaders, and any environment without a standard OS. Understanding `core` vs `std` (from the [std overview](#/ch/std-overview)) is what unlocks all of these "Rust in unusual places" domains. The same language scales from a cloud server down to an 8-KB microcontroller.

## Summary

- **Embedded Rust** brings compile-time memory safety to bare-metal microcontrollers — C-level control, far fewer catastrophic bugs, no GC or runtime.
- **`#![no_std]`** drops `std` for **`core`** only: no heap, `Vec`, `String`, files, threads, or `println!` — but `Option`, `Result`, `Iterator`, slices, and traits remain (add **`alloc`** if you have an allocator).
- Blinking an LED uses **`embedded-hal`** traits over a chip-specific HAL crate; embedded `main` is `fn main() -> !` (it never returns).
- The ecosystem — `embedded-hal`, HAL/PAC crates, `cortex-m`, **`probe-rs`**, and the async framework **`embassy`** — makes it productive.
- The same `no_std`/`core` knowledge also powers WASM, kernels, and bootloaders.

> [!exercise] Try it yourself (with hardware)
> 1. Get a Raspberry Pi Pico or micro:bit and follow The Embedded Rust Book's "blink an LED" chapter.
> 2. Explain, in one sentence, what you lose and what you keep under `#![no_std]`.
> 3. Explore `embassy` and describe how `async`/`await` could simplify concurrent firmware.

That completes the projects part — you've seen Rust build a CLI, a web service, a browser module, and firmware. Next is the crown jewel of this book: a complete course in **Data Structures & Algorithms** in Rust.
