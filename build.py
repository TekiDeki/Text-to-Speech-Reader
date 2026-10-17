#!/usr/bin/env python3
"""Build the standalone, deterministic Text-to-Speech Reader HTML file."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"


def to_cyrillic(text):
    pairs = [
        ("DŽ", "Џ"), ("Dž", "Џ"), ("dž", "џ"),
        ("LJ", "Љ"), ("Lj", "Љ"), ("lj", "љ"),
        ("NJ", "Њ"), ("Nj", "Њ"), ("nj", "њ"),
    ]
    singles = {
        "a":"а", "b":"б", "v":"в", "g":"г", "d":"д", "đ":"ђ", "e":"е",
        "ž":"ж", "z":"з", "i":"и", "j":"ј", "k":"к", "l":"л", "m":"м", "n":"н",
        "o":"о", "p":"п", "r":"р", "s":"с", "t":"т", "ć":"ћ", "u":"у", "f":"ф",
        "h":"х", "c":"ц", "č":"ч", "š":"ш",
    }
    out = []
    i = 0
    while i < len(text):
        found = False
        for latin, cyr in pairs:
            if text.startswith(latin, i):
                out.append(cyr)
                i += len(latin)
                found = True
                break
        if found:
            continue
        char = text[i]
        lower = char.lower()
        converted = singles.get(lower)
        out.append(converted.upper() if converted and char.isupper() else converted if converted else char)
        i += 1
    return "".join(out)


def main():
    locales = json.loads((SRC / "i18n" / "locales.json").read_text(encoding="utf-8"))
    if set(locales) != {"ro", "en", "sr-latn"}:
        raise SystemExit("Locale source must contain exactly ro, en, and sr-latn; sr-cyrl is generated.")
    key_sets = [set(item) for item in locales.values()]
    if any(keys != key_sets[0] for keys in key_sets[1:]):
        raise SystemExit("Locale keys are inconsistent.")
    locales["sr-cyrl"] = {key: to_cyrillic(value) for key, value in locales["sr-latn"].items()}
    all_keys = [set(item) for item in locales.values()]
    if any(keys != all_keys[0] for keys in all_keys[1:]):
        raise SystemExit("Generated locale keys are inconsistent.")

    template = (SRC / "template.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8")
    source_files = [template, css, js, json.dumps(locales, ensure_ascii=False)]
    for content in source_files:
        if content.startswith("\ufeff"):
            raise SystemExit("BOM found in source.")
        if "\u2013" in content or "\u2014" in content:
            raise SystemExit("En dash or em dash found in source.")
    if "</script" in js.lower():
        raise SystemExit("Unsafe </script sequence found in JavaScript.")
    if template.count("/*CSS*/") != 1 or template.count("/*JS*/") != 1:
        raise SystemExit("Template must contain one CSS and one JS placeholder.")

    embedded_js = "window.TD_LOCALES=" + json.dumps(locales, ensure_ascii=False, separators=(",", ":")) + ";\n" + js
    html = template.replace("/*CSS*/", css).replace("/*JS*/", embedded_js)
    if "\ufeff" in html or "\u2013" in html or "\u2014" in html:
        raise SystemExit("Forbidden character found in generated HTML.")
    (ROOT / "index.html").write_text(html, encoding="utf-8", newline="\n")
    print("Built index.html (%d bytes)." % len(html.encode("utf-8")))


if __name__ == "__main__":
    main()
