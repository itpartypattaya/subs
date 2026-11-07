# Teleprompter

A simple teleprompter in the browser: paste your text, pick a font size and speed,
and read from the screen while you record a video. No build, no dependencies, no
backend. Once loaded, the page works fully on its own, offline included.

Live version: <https://subs.itparty.club/>

## Controls while reading

| Action | Result |
|---|---|
| Mouse click, tap or Space | pause and resume |
| Mouse wheel | speed on the fly (one step per ~100 px of delta, so a touchpad gesture does not send it racing) |
| Swipe up/down | speed on the fly; while paused, the finger drags the text along |
| Wheel while paused | scroll the text |
| ↑ / ↓ | speed |
| PgUp / PgDn | scroll by one screen |
| Home / End | to the start / to the end |
| Esc or the ✕ button | back to settings (✕ is the only way out on a tablet or phone) |

## Pauses in the text

Live speech is uneven and scrolling is even, so pauses are marked right in the
text with two signs:

| Mark | What it does |
|---|---|
| `\|` | breath mark: visible in the line ahead of time, scrolling keeps going |
| `\|\|` | stop: the prompter halts when the mark reaches the marker line and waits for a click |

Both marks are inserted with buttons under the text field, so there is no syntax
to remember. **Add breaths automatically** marks a draft at sentence ends; after
that you edit the marks by hand, removing the extra ones and turning the
important ones into stops. Pressing it again does not create duplicates.
**Remove all pauses** clears the marks entirely.

Automatic marking skips initials and abbreviations (Russian «А. С. Пушкин»,
«и т. д.», English “Dr.”, “Mr.”) and understands non-breaking spaces, which is
exactly what text from Word and web pages arrives with. The button reports how
many breaths it placed, or explains why it found no suitable spots.

Two things worth knowing:

- The initials filter also cuts off genuine one-word sentences: no breath is
  placed after a Russian «Я.» or «Да.». This is the deliberate price for not
  turning «А. С. Пушкин» into three breaths; such spots are marked by hand with
  the button.
- The `|` character in the text is always read as a mark. If you need it as an
  ordinary character (almost unheard of in speech), the prompter will still show
  it as a breath mark.

**Tidy up** cleans up the text: proper quotes, dashes instead of hyphens, the
ellipsis as one character, double spaces and spaces before punctuation removed,
non-breaking spaces after short prepositions and conjunctions. It leaves the
pause marks alone.

Stops are handy where you need to change the shot, pick something up or tell a
part in your own words: the prompter waits for the person, not the other way
round.

## What it is made of

| File | Contents |
|---|---|
| `index.html` | markup of both screens: settings and the prompter |
| `style.css` | themes, full-screen mode, the marker line |
| `app.js` | state, the scrolling engine, controls, localStorage |
| `text-tools.js` | pure text functions: tidy-up, automatic breaths, plural forms |
| `i18n.js` | RU/EN interface dictionaries and language choice |
| `sw.js` | service worker: the page opens without internet |
| `tests.html` | tests of the text functions: open it in a browser, all green means all good |

## Languages

The interface is in Russian and English. The button in the header is labelled
with the language it switches to (“EN” / “RU”). Until a language is chosen with
the button, the browser language decides: Russian for `ru*`, English for
everything else. An explicit choice is saved along with the other settings.

All strings live in `i18n.js`. In the markup they are tagged with attributes:
`data-i18n` for text, `data-i18n-html` for our own markup with `<b>`,
`data-i18n-attr="title:key;aria-label:key"` for attributes. The Russian text in
`index.html` is a fallback until the script has run. A new string goes into both
dictionaries at once: `tests.html` checks that the key sets match and that the
English dictionary has no Cyrillic.

The interface language and the language of the text are different things: an
English interface over a Russian script is fine. So the tidy-up picks its rules
from the text itself: more Latin than Cyrillic means English rules (“curly
quotes”, the ’ apostrophe, no Russian non-breaking spaces), otherwise Russian
ones («guillemets»). Automatic breaths know the abbreviations of both languages
(«т. д.», “Dr.”, “Mr.”).

## Themes

The interface theme (the button in the header) and the prompter screen theme
(the **Prompter screen** switch) are independent: you can keep a light
interface and read from a black screen. The prompter has three variants: dark,
light, and yellow on black. Until a theme is chosen with the button, the
interface follows the system one, including when it changes on the fly. The
first click on the switch fixes an explicit choice.

Both themes run on CSS variables: interface ones in `:root` and `body.ui-light`,
screen ones (`--stage-*`) in `:root`, `body.stage-light` and `body.stage-yellow`.
A new look is added as one block of variables.

The page background is set on `body` only, where the theme classes also live.
`html` must have no background of its own: otherwise the `body` background stops
propagating to the canvas and ends below the first screen. `app.js` keeps
`theme-color` (the browser bar on a phone) equal to the actual `body`
background, so it matches both the light interface and the prompter screen.

The numbers that reading geometry depends on (line spacing, marker height, speed
limits) live only in the constants of `app.js`. JS hands them to CSS (`--marker`,
`line-height`) and to the sliders at startup; there are no copies in HTML or CSS.

## How it works: details

Things worth knowing before changing the code:

- **Speed is set in lines per minute, not in pixels.** When the font size
  changes, the reading pace stays the same: pixels per second are computed from
  the font size and `LINE_RATIO` in `app.js`, which must match the `line-height`
  of the `#track` block in `style.css`.
- Scrolling runs on `requestAnimationFrame` and `transform: translate3d`, and the
  position is computed from the frame time, so the pace does not depend on the
  frame rate.
- The reading-time estimate is measured on the actual layout: the text is
  rendered into an invisible `#measurer` with the same font and column width as
  the track. The width comes from the screen, not the window (after the first
  run, from the measured width of the stage): the prompter is read in full-screen
  mode, and in a window that is not maximized the estimate would otherwise come
  out too high. Recalculation is delayed by 180 ms because it renders the whole
  text.
- The reading position is stored as a share of what has been read
  (`run.share`), not in pixels, so it survives a change of font, column width
  and screen rotation. The pixel position is derived; `measure()` recomputes it.
- Heights use `dvh` where the browser supports it: in Safari on iPhone, `vh`
  ignores the address bar, and the track offset drifted away from the marker.
- A run lives in the `run` object; `setPos()` is the single point of manual
  movement (it clamps, rebuilds the nearest `||` mark and clears “finished”).
- On a tablet or phone every control works without a keyboard: tap to pause,
  swipe for speed and scrolling, ✕ to exit. A swipe is told from a tap by the
  `TAP_SLOP` threshold, and the `click` generated after the gesture is
  swallowed, otherwise every swipe would also pause. The hint at the bottom of
  the screen is rebuilt on every start and speaks the device’s language.
- The text functions (tidy-up, automatic breaths) do not touch the DOM and live
  in `text-tools.js`, covered by `tests.html`; after changing them, open the test
  page and make sure everything is green.
- The text and all settings are saved in `localStorage` (key `teleprompter.v1`).
- The screen does not go dark during recording (Wake Lock API), where the
  browser supports it.

## Offline

After the first visit over http(s), the app opens without internet: the service
worker keeps a copy of five files. The strategy is **network first, cache as the
fallback**, with a 2.5 s timeout. Two practical consequences:

- Updates arrive as soon as there is a network: upload the files and the next
  visit is already fresh. No “new HTML with old JS” mismatch, no “update
  available” banners.
- You do **not** need to change `VERSION` in `sw.js` for an ordinary file
  change; the cache refreshes itself. The version matters only when the `ASSETS`
  list changes or the old cache must be thrown out for everyone.

The worker is not available on `file://`, but there the app opens from disk
anyway.

## Running locally

Double-clicking `index.html` is enough. To check it “as on the server”:

```bash
python -m http.server 8123 --bind 127.0.0.1
```

Open <http://localhost:8123>.

## Hosting

It is static, so any hosting or CDN will do: upload the files to the site
directory, no build and no runtime needed. The one request to the web server is
to serve `.html`, `.css` and `.js` with `Cache-Control: no-cache`, otherwise
changes do not reach people who have opened the prompter before. Offline mode
needs https (or localhost), otherwise the browser will not register the service
worker.

The details of the current deployment (server paths, nginx config, certificate)
are in `DEPLOY.local.md`, which is deliberately kept out of the repository.

## License

MIT, see [LICENSE](LICENSE).
