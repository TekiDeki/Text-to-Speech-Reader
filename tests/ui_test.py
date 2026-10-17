from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
errors = []

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *_args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
Thread(target=server.serve_forever, daemon=True).start()
url = 'http://127.0.0.1:%d/' % server.server_port

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.add_init_script('''
          class MockUtterance { constructor(text) { this.text = text; } }
          const mockSpeech = {
            speaking: false, paused: false, onvoiceschanged: null,
            getVoices: () => [
              { name: 'Test Local', lang: 'en-US', voiceURI: 'local-test', default: true, localService: true },
              { name: 'Test Online', lang: 'ro-RO', voiceURI: 'online-test', default: false, localService: false }
            ],
            speak: function (utterance) { this.speaking = true; setTimeout(() => utterance.onstart && utterance.onstart(), 0); this.lastUtterance = utterance; },
            pause: function () { this.paused = true; },
            resume: function () { this.paused = false; this.speaking = true; },
            cancel: function () { this.paused = false; this.speaking = false; }
          };
          Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: mockSpeech });
          window.SpeechSynthesisUtterance = MockUtterance;
        ''')
        page.on('pageerror', lambda error: errors.append('page: ' + str(error)))
        page.on('console', lambda message: errors.append('console: ' + message.text) if message.type == 'error' else None)
        response = page.goto(url, wait_until='networkidle')
        assert response and response.status == 200
        assert page.locator('h1').inner_text() == 'Your text, ready to be heard.'
        assert 'try Microsoft Edge' in page.locator('.edge-voice-note').inner_text()
        voice_options = page.locator('#voiceSelect option').all_inner_texts()
        assert any('Test Local' in item and 'local voice' in item for item in voice_options)
        assert any('Test Online' in item and 'online voice' in item for item in voice_options)
        assert not page.locator('html').evaluate("el => el.classList.contains('theme-dark')")
        page.locator('#themeToggle').click()
        assert page.locator('html').evaluate("el => el.classList.contains('theme-dark')")
        assert page.locator('#themeLabel').inner_text() == 'Light mode'
        assert page.locator('body').evaluate("el => getComputedStyle(el).backgroundColor") == 'rgb(11, 19, 33)'
        page.locator('#themeToggle').click()
        assert not page.locator('html').evaluate("el => el.classList.contains('theme-dark')")
        page.locator('#sampleButton').click()
        assert page.locator('#chapterCount').inner_text() == '2'
        assert page.locator('#chapterList .chapter-item').count() == 2
        page.locator('#playButton').click()
        page.wait_for_timeout(40)
        assert page.locator('#playerStatus').inner_text() == 'Playing'
        page.locator('#playButton').click()
        assert page.locator('#playerStatus').inner_text() == 'Paused'
        page.locator('#playButton').click()
        assert page.locator('#playerStatus').inner_text() == 'Playing'
        page.locator('#stopButton').click()
        assert page.locator('#playerStatus').inner_text() == 'Playback stopped'
        page.locator('#clearButton').click()
        assert page.locator('#textInput').input_value() == ''
        assert page.locator('#undoButton').is_enabled()
        page.locator('#undoButton').click()
        assert page.locator('#chapterCount').inner_text() == '2'
        page.locator('#localeSelect').select_option('sr-cyrl')
        assert page.locator('html').get_attribute('lang') == 'sr-cyrl'
        assert 'Твој текст' in page.locator('h1').inner_text()
        assert page.locator('.edge-voice-note').inner_text().startswith('За већи избор')
        assert page.locator('#themeLabel').inner_text() == 'Тамни режим'
        assert page.locator('#chapterList .chapter-item').count() == 2
        page.locator('#localeSelect').select_option('en')
        page.locator('#rateInput').fill('1.4')
        assert page.locator('#rateValue').inner_text() == '1.4×'
        page.evaluate('window.scrollTo(0, 0)')
        page.screenshot(path=str(ROOT / 'screenshots' / 'desktop.png'))
        page.locator('#themeToggle').click()
        assert page.locator('#themeLabel').inner_text() == 'Light mode'
        page.reload(wait_until='networkidle')
        assert page.locator('html').evaluate("el => el.classList.contains('theme-dark')")
        assert page.locator('#themeLabel').inner_text() == 'Light mode'
        assert page.locator('#textInput').input_value().startswith('# The beginning')
        assert page.locator('#rateInput').input_value() == '1.4'
        assert page.locator('html').get_attribute('lang') == 'en'
        assert not errors, '\n'.join(errors)

        tablet = browser.new_page(viewport={"width": 820, "height": 1180}, device_scale_factor=1, is_mobile=True, has_touch=True)
        tablet.on('pageerror', lambda error: errors.append('tablet page: ' + str(error)))
        tablet.on('console', lambda message: errors.append('tablet console: ' + message.text) if message.type == 'error' else None)
        tablet.goto(url, wait_until='networkidle')
        tablet.locator('#sampleButton').click()
        tablet.locator('#chapterList .chapter-item').first.click()
        assert tablet.locator('#activeChapter').inner_text() == 'The beginning of a journey'
        assert tablet.locator('#textInput').is_visible()
        assert not errors, '\n'.join(errors)
        browser.close()
    print('UI tests passed on desktop and touch tablet; screenshot saved.')
finally:
    server.shutdown()
