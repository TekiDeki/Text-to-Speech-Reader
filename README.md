# Text-to-Speech Reader

Aplicație web gratuită, autonomă, pentru citirea textelor cu vocea disponibilă în browser. Interfața include română, engleză, sârbă latină și sârbă chirilică. Varianta generată `index.html` este un singur fișier HTML cu stilurile, codul și textele interfeței incluse.

## Funcționalități

- Lipește text sau încarcă un fișier text simplu `.txt`.
- Delimitează capitolele cu titluri care încep cu `#`; fără titluri, textul este împărțit în secțiuni.
- Redă capitolul selectat, cu pauză, continuare, oprire, capitol anterior și următor.
- Alege vocea instalată și ajustează viteza.
- Comută între tema luminoasă și tema întunecată; preferința se păstrează local.
- Recomandă Edge desktop pentru o selecție mai bogată de voci, fără să promită disponibilitate identică pe toate dispozitivele.
- Reține textul și preferințele local pe dispozitiv. Aplicația nu are backend; vocile locale procesează textul pe dispozitiv, iar cele online pot trimite textul furnizorului de voce.
- Include redare demonstrativă și anularea ultimei ștergeri.
- Interfața poate funcționa offline după prima încărcare pe GitHub Pages sau altă origine HTTPS, prin service worker; redarea offline depinde de existența unei voci locale instalate.

## Limitări

- Folosește Web Speech API. Vocile și calitatea depind de browser și de sistemul de operare. Vocile marcate online necesită internet și pot trimite textul furnizorului pentru sinteză; alege o voce locală dacă textul trebuie să rămână pe dispozitiv.
- Exportul în fișier audio nu este inclus. Interfața vocală nativă a browserului oferă redare, dar nu furnizează în mod fiabil un fișier descărcabil. Generarea și exportul audio necesită o integrare separată cu un motor TTS.
- Import acceptă doar `.txt`; PDF, EPUB și DOCX nu sunt incluse.
- Estimarea duratei este orientativă. Limba de sinteză urmează limba interfeței sau vocea selectată.

## Utilizare

Deschide `index.html` într-un browser recent sau publică directorul pe GitHub Pages. Încarcă un fișier `.txt` ori lipește textul. Pentru separarea capitolelor, pune `# Titlul capitolului` pe o linie separată. Selectează capitolul, vocea și viteza, apoi apasă butonul de redare.

## Dezvoltare

```sh
python3 build.py
node tests/logic_test.cjs
python3 tests/ui_test.py
```

Pentru testele UI, instalează Playwright și Chromium:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 -m playwright install-deps chromium
```

## Fișiere

| Fișier | Rol |
| --- | --- |
| `src/template.html` | Structura paginii și punctele de inserare |
| `src/styles.css` | Stilurile responsive |
| `src/app.js` | Redare, capitole, localizare și persistență |
| `src/i18n/locales.json` | Texte RO, EN și SR latin; SR chirilic este generat determinist |
| `build.py` | Build determinist și verificări de integritate |
| `index.html` | Fișierul standalone destinat utilizării și publicării |
| `sw.js`, `VERSION` | Cache offline și versiune |
| `manifest.json`, fișiere icon | Instalare ca aplicație web și pictograme |
| `tests/` | Teste de logică și UI |

## Licență și suport

Licență Apache-2.0. Vezi `LICENSE` și `NOTICE`. Cod sursă: https://github.com/TekiDeki/Text-to-Speech-Reader. Pentru raportarea problemelor sau solicitări de funcționalități, folosește pagina Issues a depozitului.
