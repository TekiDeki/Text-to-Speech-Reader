# Text-to-Speech Reader

A free, standalone browser app that reads pasted text or `.txt` files aloud using voices available through the browser. It supports chapter-based playback and has a four-language interface: English, Romanian, Serbian Latin and Serbian Cyrillic.

The published `index.html` is self-contained: markup, styles, application code and translations are embedded in one file. The app does not generate or export audio files.

## Features

- Paste text or load a plain-text `.txt` file.
- Split text into chapters with headings that start with `#`. Without headings, the app divides the text into sections.
- Play, pause, resume or stop playback, and move between chapters.
- Choose an available browser voice and adjust the reading speed.
- Switch between light and dark themes; the preference is stored locally.
- Read sample text and undo the most recent clear action.
- Use the interface in English, Romanian, Serbian Latin or Serbian Cyrillic.
- Install the app as a PWA and open it offline after the first visit over HTTPS. Offline playback depends on an installed local voice.

## Privacy

The app has no application backend, telemetry or analytics. Text and preferences are stored locally on the device. A local voice processes text on the device. Online voices may send the text to their speech provider for synthesis, so check the provider's privacy policy before reading sensitive material. The app labels voices as local, online or unknown when the browser exposes that information.

## Limitations

- Speech is provided by the browser's Web Speech API. Available voices and quality depend on the browser, operating system, locale and installed or online voices.
- Microsoft Edge on desktop may offer a wider selection on some systems, but voice and language availability is not guaranteed.
- Audio-file export is not included. The browser's standard speech interface provides playback, not a downloadable audio file.
- Only `.txt` files are supported. PDF, EPUB and DOCX imports are not included.
- The duration estimate is approximate. Speech language follows the selected voice and available browser configuration.

## Use

Open `index.html` in a recent browser or visit the published app at <https://tekideki.github.io/Text-to-Speech-Reader/>. Paste text or load a `.txt` file. To create chapters, put `# Chapter title` on a separate line, then choose a chapter, voice and speed and press Play.

## Development

```sh
python3 build.py
node tests/logic_test.cjs
python3 tests/ui_test.py
```

To install the UI-test tools:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 -m playwright install-deps chromium
```

## Repository files

| File | Purpose |
| --- | --- |
| `src/template.html` | Page structure and build placeholders |
| `src/styles.css` | Responsive styles |
| `src/app.js` | Playback, chapters, localization and persistence |
| `src/i18n/locales.json` | English, Romanian and Serbian Latin source strings; Serbian Cyrillic is generated deterministically |
| `build.py` | Deterministic standalone build and integrity checks |
| `index.html` | Generated standalone file served by GitHub Pages |
| `sw.js`, `VERSION` | Offline cache and cache version |
| `manifest.json`, icon files | PWA metadata and icons |
| `tests/` | Logic and browser UI tests |

## License and support

Licensed under Apache-2.0. See `LICENSE` and `NOTICE`. Source code and issue tracking: <https://github.com/TekiDeki/Text-to-Speech-Reader>.
