# Bǐshùn Workbook 筆順

An app for learning **stroke order in traditional Chinese characters** (繁體), built to be used on a phone.
Open it in a mobile browser, add it to your home screen, and it works offline from then on.

- **Watch** – press **Next Stroke** to highlight stroke 1, then each following stroke. After the last stroke the highlight clears and the cycle starts again. Back, Play, tap-to-jump, stroke numbers, build-up and a full stroke-order diagram are there too.
- **Write** – draw each stroke with a finger. The app checks the start point, shape and direction, explains misses, and gives a hint after three.
- **Quiz** – "which stroke comes next?" and "what is this stroke called?" in rounds of 10, with score, streak and review of misses.
- **Strokes** – the 18 stroke types used by the 47 characters, each shown as it is written in a real character.
- **Rules** – nine stroke-order habits (top before bottom, left before right, close the box last, …), each drawn step by step.

Only traditional forms are used. `tools/check_static.py` fails the Checks workflow if a simplified-only character gets in.

## On a phone

| | |
|---|---|
| **Android (Chrome)** | Open the site and tap **Install** in the header, or ⋮ → *Install app*. |
| **iPhone / iPad (Safari)** | Tap **Share** → **Add to Home Screen**. The **Install** button in the header shows the same steps. |

Phone layout: a bottom tab bar within thumb reach, **Next Stroke** in the middle of the control row and always on screen, a bottom sheet for choosing a character, safe-area padding for notches, a left-hand tab rail in landscape, and light and dark themes that follow the phone.

## Run it locally

No build step. Any static server works; the service worker needs `localhost` or HTTPS.

```sh
python3 -m http.server 8000 --directory app
# open http://localhost:8000
```

## Deploy

Pushing to `main` deploys the `app/` folder to GitHub Pages through `.github/workflows/pages.yml`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Each deploy stamps the commit hash into `sw.js` and `app.js`. Phones that already have the app see a *"A new version is ready"* prompt and switch when they tap **Reload**, so an update never lands in the middle of writing a character.

All URLs are relative, so the app works at any path (`https://<user>.github.io/<repo>/`).

## Develop

```sh
cd tools
npm install
pip install -r requirements.txt

npm test                 # logic tests (jsdom) + static checks
CHROME_PATH=/path/to/chrome npm run test:browser [screenshot-dir]
```

The browser test needs a Chromium. It drives phone-sized viewports and checks layout, touch writing, the character sheet, installability, the update flow and offline use (it stops its own server and reloads).

| Script | What it regenerates |
|---|---|
| `npm run data` | `app/data.js` from the Hanzi Writer data. Stroke names are hand-checked in `build_data.py`. |
| `npm run icons` | `app/icons/*` (the 永 tile, first stroke in red) |
| `npm run fonts` | `app/fonts/*` subsets (needs the Noto CJK `.ttc` files) |

Adding a character: add a row to `ROWS` in `tools/build_data.py`, run `npm run data`, then `npm run fonts` so the font includes it, then `npm test`.

```
app/
  index.html  styles.css  app.js  data.js
  manifest.webmanifest  sw.js
  icons/  fonts/  ARPHICPL.TXT
tools/        build and test scripts (not deployed)
.github/workflows/
```

## Credits and licences

- **Code**: MIT (`LICENSE`). Covers the app's own code and the tools; the data and fonts below keep their own licences.
- **Stroke outlines and stroke order**: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi), via [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer-data). Derived from fonts by Arphic Technology, used under the **Arphic Public License** (`app/ARPHICPL.TXT`).
- **Fonts**: Noto Serif CJK TC and Noto Sans CJK TC (Adobe / Google) and Schibsted Grotesk (Schibsted Media Group), all under the **SIL Open Font License 1.1** (`app/fonts/OFL-*.txt`). The Noto files here are subsets.
- Stroke names and order follow common practice. Taiwan, Hong Kong and mainland China differ on a few characters, so follow your teacher or textbook where they disagree.
