<h1><span class="h1-kicker">The Crate Ecosystem</span>ratatui: Terminal User Interfaces</h1>

Some of the best tools you use are terminal applications with a real interface: `htop`, `lazygit`, `k9s`, `bottom`, `gitui`. Several of those are written in Rust with **ratatui** — a library for drawing rich, interactive layouts in a terminal. It's a genuinely enjoyable corner of the ecosystem, and the mental model is different enough from other UI work to be worth learning properly.

```toml
[dependencies]
ratatui = "0.29"
crossterm = "0.28"     # the terminal backend: input events and raw mode
```

## The immediate-mode model

This is the one concept that matters. ratatui does **not** keep a tree of widgets you mutate. Instead, you redraw the entire interface from your own state, every frame.

<figure class="diagram">
<svg viewBox="0 0 640 240" role="img" aria-label="A loop that draws the whole UI from application state, waits for an event, updates the state, and repeats">
  <style>
    .tu-h { font: 700 12px var(--font-sans); }
    .tu-m { font: 600 11px var(--font-mono); fill: var(--text); }
    .tu-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .tu-state { fill: var(--rust-100); stroke: var(--rust-400); stroke-width: 1.5; }
    .tu-draw { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .tu-ev { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
  </style>
  <rect x="240" y="26" width="170" height="46" rx="5" class="tu-state"/>
  <text x="254" y="46" class="tu-m">struct App { … }</text>
  <text x="254" y="63" class="tu-c">the single source of truth</text>
  <rect x="450" y="110" width="170" height="46" rx="5" class="tu-draw"/>
  <text x="464" y="130" class="tu-m">draw(frame, &amp;app)</text>
  <text x="464" y="147" class="tu-c">rebuild EVERY widget</text>
  <rect x="240" y="184" width="170" height="42" rx="5" class="tu-ev"/>
  <text x="254" y="203" class="tu-m">read event</text>
  <text x="254" y="219" class="tu-c">key, resize, tick</text>
  <rect x="30" y="110" width="170" height="46" rx="5" class="tu-state"/>
  <text x="44" y="130" class="tu-m">app.update(event)</text>
  <text x="44" y="147" class="tu-c">mutate state only</text>
  <path d="M412 56 C 480 62, 520 84, 528 106" stroke="var(--blue)" stroke-width="2.2" fill="none" marker-end="url(#arr-tu)"/>
  <path d="M528 160 C 520 186, 470 202, 414 205" stroke="var(--green)" stroke-width="2.2" fill="none" marker-end="url(#arr-tu2)"/>
  <path d="M238 205 C 170 202, 120 186, 112 160" stroke="var(--green)" stroke-width="2.2" fill="none" marker-end="url(#arr-tu2)"/>
  <path d="M112 106 C 120 84, 170 62, 238 56" stroke="var(--rust-500)" stroke-width="2.2" fill="none" marker-end="url(#arr-tu3)"/>
  <text x="285" y="120" class="tu-c">no widget tree</text>
  <text x="285" y="136" class="tu-c">no dirty flags</text>
  <text x="285" y="152" class="tu-c">no callbacks</text>
  <defs>
    <marker id="arr-tu" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="arr-tu2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--green)"/></marker>
    <marker id="arr-tu3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption><b>Immediate mode</b>: state → draw everything → wait for an event → mutate state → repeat. Widgets are throwaway descriptions, not objects you keep.</figcaption>
</figure>

> [!key] Widgets are values you throw away each frame
> A `Paragraph` or `List` in ratatui is a *description* of what to draw, constructed fresh and dropped immediately. There's nothing to keep in sync, no dirty-checking, and no callbacks — so the classic UI bug of "the view disagrees with the model" is structurally impossible. The cost is that you redraw everything, which for a terminal (a few thousand cells) is trivially cheap. If you've used `egui` or React, the model will feel familiar; if you've used GTK or Qt, it's the opposite of what you're used to.

## The skeleton every ratatui app has

```rust,ignore
use std::io;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::execute;
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;

fn main() -> io::Result<()> {
    // ---- setup: take over the terminal ----
    enable_raw_mode()?;                                   // keys arrive unbuffered
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;              // don't clobber scrollback
    let mut terminal = Terminal::new(CrosstermBackend::new(stdout))?;

    let result = run(&mut terminal);

    // ---- teardown: ALWAYS restore, even on error ----
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    result
}

fn run<B: ratatui::backend::Backend>(terminal: &mut Terminal<B>) -> io::Result<()> {
    let mut app = App::new();

    loop {
        // 1. Draw the whole UI from state.
        terminal.draw(|frame| ui(frame, &app))?;

        // 2. Wait for an event, with a timeout so we can also tick.
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                // Windows sends both Press and Release — filter, or every
                // keystroke acts twice.
                if key.kind == KeyEventKind::Press {
                    match key.code {
                        KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                        code => app.on_key(code),
                    }
                }
            }
        } else {
            app.on_tick();
        }
    }
}
```

> [!warning] Always restore the terminal, including on panic
> If your program exits without `disable_raw_mode` and `LeaveAlternateScreen`, the user's shell is left with no echo, no line editing, and a scrambled screen — they have to run `reset` blind. The `?` in the middle of a setup sequence is a classic way to cause this. Two defences: run the app inside a function and restore *after* it returns (as above), and install a panic hook that restores the terminal before printing the panic. `ratatui::init()` and `ratatui::restore()` in recent versions wrap this correctly, and the `color-eyre` integration installs the hook for you.

```rust,ignore
// The panic hook is worth the six lines. Without it, a panic destroys the terminal.
fn install_panic_hook() {
    let original = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let _ = disable_raw_mode();
        let _ = execute!(io::stdout(), LeaveAlternateScreen);
        original(info);
    }));
}
```

## Layout: splitting rectangles

Everything is a rectangle divided into smaller rectangles, using constraints.

```rust,ignore
use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, BorderType, Borders, Gauge, List, ListItem, Paragraph, Wrap};
use ratatui::Frame;

fn ui(frame: &mut Frame, app: &App) {
    // Split the screen vertically: a fixed header, a flexible body, a fixed footer.
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),   // exactly 3 rows
            Constraint::Min(5),      // at least 5, takes the remainder
            Constraint::Length(3),
        ])
        .split(frame.area());

    // Split the body horizontally, 30% / 70%.
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
        .split(chunks[1]);

    // Header
    let header = Paragraph::new("  Task Monitor  ")
        .style(Style::default().fg(Color::White).bg(Color::Blue).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::ALL).border_type(BorderType::Rounded));
    frame.render_widget(header, chunks[0]);

    // Left: a list, with the selected row highlighted.
    let items: Vec<ListItem> = app
        .tasks
        .iter()
        .enumerate()
        .map(|(i, task)| {
            let style = if i == app.selected {
                Style::default().fg(Color::Black).bg(Color::Cyan)
            } else {
                Style::default()
            };
            ListItem::new(Line::from(vec![
                Span::raw(if task.done { "[x] " } else { "[ ] " }),
                Span::styled(task.name.clone(), style),
            ]))
        })
        .collect();
    frame.render_widget(
        List::new(items).block(Block::bordered().title("Tasks")),
        body[0],
    );

    // Right: detail text that wraps.
    let detail = Paragraph::new(app.detail_text())
        .wrap(Wrap { trim: true })
        .block(Block::bordered().title("Detail"));
    frame.render_widget(detail, body[1]);

    // Footer: a progress gauge.
    frame.render_widget(
        Gauge::default()
            .block(Block::bordered().title("Progress"))
            .gauge_style(Style::default().fg(Color::Green))
            .ratio(app.completion_ratio()),
        chunks[2],
    );
}
```

| Constraint | Means |
|---|---|
| `Length(n)` | exactly `n` rows or columns |
| `Min(n)` | at least `n`, expanding to fill |
| `Max(n)` | at most `n` |
| `Percentage(p)` | `p`% of the parent |
| `Ratio(a, b)` | the fraction `a/b` |
| `Fill(weight)` | share the remainder by weight |

> [!best] One `Length` header, one `Min` body, one `Length` footer
> This is the layout that fits almost every TUI: fixed chrome at the top and bottom, and a body that absorbs whatever's left. Using `Min` (or `Fill`) for exactly one region means the layout adapts to any terminal size without arithmetic. If you use `Percentage` everywhere, small terminals collapse your content and large ones leave odd gaps.

> [!mistake] Forgetting that a `Block` border eats two rows and two columns
> A `Block::bordered()` draws its frame *inside* the rect you gave it, so the content area is two smaller in each dimension. Give a bordered widget a `Length(3)` and you have exactly **one** usable row inside. This is why single-line bordered inputs need `Length(3)`, not `Length(1)` — and why content mysteriously vanishes in tight layouts.

## State, and the pattern that scales

The interesting design work in a TUI is the state machine, not the drawing.

```rust
/// The whole application is one struct plus a set of transitions.
/// This is plain Rust — it needs no TUI library and is fully testable.
#[derive(Debug, PartialEq)]
enum Mode {
    Normal,
    Editing,
    Confirming,
}

#[derive(Debug)]
struct Task {
    name: String,
    done: bool,
}

#[derive(Debug)]
struct App {
    tasks: Vec<Task>,
    selected: usize,
    mode: Mode,
    input: String,
}

impl App {
    fn new() -> Self {
        App {
            tasks: vec![
                Task { name: "write chapter".into(), done: true },
                Task { name: "verify code".into(), done: false },
                Task { name: "ship it".into(), done: false },
            ],
            selected: 0,
            mode: Mode::Normal,
            input: String::new(),
        }
    }

    // Movement that can't go out of bounds — saturating, not wrapping.
    fn next(&mut self) {
        if !self.tasks.is_empty() {
            self.selected = (self.selected + 1).min(self.tasks.len() - 1);
        }
    }

    fn previous(&mut self) {
        self.selected = self.selected.saturating_sub(1);
    }

    fn toggle(&mut self) {
        if let Some(task) = self.tasks.get_mut(self.selected) {
            task.done = !task.done;
        }
    }

    fn start_editing(&mut self) {
        self.mode = Mode::Editing;
        self.input.clear();
    }

    fn commit_edit(&mut self) {
        if !self.input.trim().is_empty() {
            self.tasks.push(Task { name: self.input.trim().to_string(), done: false });
            self.selected = self.tasks.len() - 1;
        }
        self.mode = Mode::Normal;
        self.input.clear();
    }

    fn completion_ratio(&self) -> f64 {
        if self.tasks.is_empty() {
            return 0.0;
        }
        self.tasks.iter().filter(|t| t.done).count() as f64 / self.tasks.len() as f64
    }
}

fn main() {
    let mut app = App::new();
    println!("start:    selected={} ratio={:.2}", app.selected, app.completion_ratio());

    app.next();
    app.next();
    app.next(); // clamped — cannot run past the end
    println!("after 3x next: selected={} (only 3 tasks)", app.selected);

    app.toggle();
    println!("toggled:  ratio={:.2}", app.completion_ratio());

    app.start_editing();
    app.input.push_str("  add tests  ");
    app.commit_edit();
    println!("added:    {} tasks, mode={:?}", app.tasks.len(), app.mode);
    println!("last:     {:?}", app.tasks.last());

    app.previous();
    app.previous();
    app.previous();
    app.previous();
    println!("saturated: selected={} (never negative)", app.selected);
}
```

> [!best] Keep the state machine free of TUI types, and unit-test it
> Notice the `App` above imports nothing from ratatui — it's plain Rust, so every transition is testable with an ordinary `#[test]`. That's the whole trick to a maintainable TUI: the drawing function is a pure projection of state (hard to test, but also hard to get wrong), while all the logic that *can* be wrong lives in methods you can call directly. Testing a TUI by driving the terminal is miserable; testing a state machine is easy.

> [!tip] `saturating_sub` and `.min(len - 1)` for cursor movement
> `self.selected -= 1` panics on underflow at index 0, and `+= 1` walks past the end into a panic on the next render. Saturating arithmetic makes both boundaries no-ops, which is exactly the behaviour users expect from a list. Guard `len() - 1` behind an `is_empty()` check too — that subtraction underflows on an empty list.

## Widgets

| Widget | Draws |
|---|---|
| `Paragraph` | wrapped text, with styling and scrolling |
| `Block` | a border, title, and padding around anything |
| `List` / `ListState` | a scrollable, selectable list |
| `Table` / `TableState` | columns with headers and per-row selection |
| `Gauge` / `LineGauge` | a progress bar |
| `Sparkline` | a compact inline trend |
| `Chart` | line, bar, and scatter plots with axes |
| `BarChart` | labelled bars |
| `Tabs` | a tab strip |
| `Scrollbar` | a scroll indicator alongside a list or table |
| `Canvas` | free drawing — maps, shapes, lines |
| `Clear` | erase a region, for modals and popups |

> [!note] Stateful widgets keep their state in *your* struct
> `List` and `Table` come in two forms. `render_widget` is stateless, so you handle selection and scrolling yourself. `render_stateful_widget` takes a `&mut ListState` that *you* own and store in your `App` — it tracks the selected index and scroll offset, and gives you `select_next()`, `select_previous()`, and automatic scrolling when the selection moves off screen. For any list longer than a screen, use the stateful version; reimplementing scroll offsets by hand is a lot of fiddly arithmetic.

## Popups and modals

There's no z-order or window manager. You draw a smaller rect on top, after clearing it.

```rust,ignore
use ratatui::layout::{Constraint, Direction, Flex, Layout, Rect};
use ratatui::widgets::Clear;

/// Centre a rect of the given percentage inside another rect.
fn centered(area: Rect, percent_x: u16, percent_y: u16) -> Rect {
    let vertical = Layout::vertical([Constraint::Percentage(percent_y)]).flex(Flex::Center);
    let horizontal = Layout::horizontal([Constraint::Percentage(percent_x)]).flex(Flex::Center);
    let [area] = vertical.areas(area);
    let [area] = horizontal.areas(area);
    area
}

fn draw_confirm(frame: &mut Frame, app: &App) {
    if app.mode != Mode::Confirming {
        return;
    }
    let area = centered(frame.area(), 40, 20);

    // Clear FIRST, or the content underneath shows through the gaps.
    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new("Delete this task? (y/n)")
            .block(Block::bordered().title("Confirm")),
        area,
    );
}
```

> [!mistake] A popup without `Clear` shows the content underneath
> ratatui composites into a single cell buffer, and a widget only writes the cells it actually draws — so a `Paragraph` with short lines leaves the previous frame's characters visible in the gaps. Rendering `Clear` over the popup's rect first blanks those cells. This produces confusing "ghost text" that people spend a long time debugging.

## Async and long-running work

> [!warning] Never block the draw loop
> The loop must return to `terminal.draw()` promptly or the UI freezes — no redraw, no keypress handling, and the user can't even quit. So a blocking HTTP request, a database query, or a big file read cannot happen inline. Move the work to a thread or a `tokio` task and have it send results over a channel; the loop then polls the channel alongside terminal events with `tokio::select!`. This restructuring is the main source of complexity in a real TUI, and it's worth designing for from the start rather than retrofitting. See [Message Passing with Channels](#/ch/channels) and [The Tokio Runtime](#/ch/tokio).

| Concern | Approach |
|---|---|
| a slow network call | `tokio::spawn` + an `mpsc` channel back to the loop |
| a steady animation or clock | a tick every N ms via `event::poll` timeout |
| CPU-heavy work | `std::thread::spawn` or `rayon`, results over a channel |
| streaming log output | a bounded channel; drop or coalesce when full |
| both events and messages | `tokio::select!` over `EventStream` and the receiver |

## The TUI ecosystem

| Crate | Provides |
|---|---|
| `ratatui` | the widgets and layout engine |
| `crossterm` | cross-platform terminal control and input (the usual backend) |
| `termion` | a Unix-only alternative backend |
| `tui-textarea` | a real multi-line text editor widget |
| `tui-input` | a single-line input with cursor handling |
| `throbber-widgets-tui` | spinners |
| `tui-tree-widget` | collapsible trees |
| `color-eyre` | pretty panics **plus** terminal restoration |
| `indicatif` | progress bars for non-TUI CLIs — simpler, often enough |
| `dialoguer` | prompts, selects, and confirmations without a full TUI |
| `comfy-table` | formatted tables printed and done |

> [!best] Consider whether you need a TUI at all
> A full-screen interactive interface is the right answer for a monitor, a file browser, or a debugger — anything the user *stays in*. For a command that runs and exits, `indicatif` for a progress bar and `comfy-table` for output give you a polished result in a fraction of the code, and compose properly with pipes and scripts. A TUI takes over the terminal, which means it can't be piped, redirected, or run in CI. Choose it because the interaction demands it, not for the aesthetics.

## Summary

- ratatui is **immediate-mode**: you redraw the whole UI from your state every frame, so the view can never disagree with the model.
- **Always restore the terminal** — `disable_raw_mode`, `LeaveAlternateScreen`, and a **panic hook** — or you leave the user's shell broken.
- Layout is **rectangles split by constraints**: `Length` for fixed chrome, `Min`/`Fill` for the body. Remember a `Block` border consumes two rows and two columns.
- Filter for `KeyEventKind::Press`, or Windows processes every keystroke twice.
- Keep the **state machine free of TUI types** and unit-test it; the draw function is a pure projection of state.
- Use **saturating arithmetic** for cursor movement, and guard `len() - 1` against an empty list.
- Use **stateful widgets** (`ListState`, `TableState`) for anything scrollable rather than tracking offsets yourself.
- Draw **`Clear`** before a popup, or the previous frame shows through.
- **Never block the draw loop** — move slow work to a thread or task and communicate over a channel.
- For a command that runs and exits, `indicatif` and `comfy-table` are often the better choice than a full TUI.

> [!exercise] Try it yourself
> 1. Run the `App` state machine above and add a `delete()` method. Make sure `selected` stays valid when you delete the last item.
> 2. Write unit tests for `next`, `previous`, and `completion_ratio`, including the empty-list case. Note that you need no terminal at all.
> 3. Build the skeleton app and confirm it restores your terminal on `q`. Then `panic!()` inside the loop and see what happens — now add the panic hook.
> 4. Lay out a three-pane interface: a fixed 3-row header, a body split 25/75, and a 3-row footer. Resize your terminal and check it adapts.
> 5. Add a popup that only draws when a flag is set, first without `Clear` and then with it. Describe the difference.
> 6. Add a background thread that sends a counter over an `mpsc` channel every 500ms, and display it without blocking key handling.

That's a broad tour of the crates you'll actually reach for. Next, how to become part of that ecosystem yourself: **publishing a crate and designing feature flags**.
