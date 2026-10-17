(function () {
  'use strict';
  const locales = window.TD_LOCALES;
  const textInput = document.getElementById('textInput');
  const localeSelect = document.getElementById('localeSelect');
  const voiceSelect = document.getElementById('voiceSelect');
  const rateInput = document.getElementById('rateInput');
  const rateValue = document.getElementById('rateValue');
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const chapterList = document.getElementById('chapterList');
  const playerStatus = document.getElementById('playerStatus');
  const playButton = document.getElementById('playButton');
  const progressBar = document.getElementById('progressBar');
  const LANG_KEY = 'td-audiobook-language';
  const TEXT_KEY = 'td-audiobook-text';
  const RATE_KEY = 'td-audiobook-rate';
  const VOICE_KEY = 'td-audiobook-voice';
  const THEME_KEY = 'td-audiobook-theme';
  let currentTheme = 'light';
  let currentLocale = 'en';
  let chapters = [];
  let selectedChapter = 0;
  let previousText = null;
  let voiceList = [];
  let token = 0;
  let speechChunks = [];
  let chunkIndex = 0;
  let isPaused = false;

  function safeGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function t(key) { return (locales[currentLocale] && locales[currentLocale][key]) || locales.en[key] || key; }
  function updateThemeControl() {
    const key = currentTheme === 'dark' ? 'themeToLight' : 'themeToDark';
    themeLabel.textContent = t(key);
    themeToggle.setAttribute('aria-label', t(key));
    themeToggle.title = t(key);
  }
  function setTheme(theme, persist) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('theme-dark', currentTheme === 'dark');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = currentTheme === 'dark' ? '#0b1321' : '#101c33';
    if (persist !== false) safeSet(THEME_KEY, currentTheme);
    updateThemeControl();
  }
  function toCyrillic(value) {
    const map = { 'dž':'џ','lj':'љ','nj':'њ','a':'а','b':'б','v':'в','g':'г','d':'д','đ':'ђ','e':'е','ž':'ж','z':'з','i':'и','j':'ј','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','r':'р','s':'с','t':'т','ć':'ћ','u':'у','f':'ф','h':'х','c':'ц','č':'ч','š':'ш' };
    return value.replace(/dž|lj|nj|[abv gdežzijklm noprstćufhcčš]/gi, function (match) {
      const key = match.toLowerCase().replace(/\s/g, '');
      const result = map[key] || match;
      return match[0] === match[0].toUpperCase() ? result[0].toUpperCase() + result.slice(1) : result;
    });
  }
  function detectLocale() {
    const saved = safeGet(LANG_KEY);
    if (saved && locales[saved]) return saved;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('ro')) return 'ro';
    if (nav.startsWith('sr')) return nav.includes('latn') ? 'sr-latn' : (nav.includes('cyrl') ? 'sr-cyrl' : 'sr-latn');
    return 'en';
  }
  function setLocale(locale) {
    currentLocale = locales[locale] ? locale : 'en';
    document.documentElement.lang = currentLocale;
    localeSelect.value = currentLocale;
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      const key = node.getAttribute('data-i18n');
      if (t(key)) node.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) { node.placeholder = t(node.getAttribute('data-i18n-placeholder')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) { node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria'))); });
    const cyrlOption = localeSelect.querySelector('option[value="sr-cyrl"]');
    if (cyrlOption) cyrlOption.textContent = toCyrillic('Srpski (ćirilica)');
    updateThemeControl();
    safeSet(LANG_KEY, currentLocale);
    rebuildChapters();
    populateVoices();
    refreshStatus();
  }
  function splitChunks(text, limit) {
    const result = [];
    let rest = text.trim();
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(' ', limit);
      const sentenceCut = Math.max(rest.lastIndexOf('. ', limit), rest.lastIndexOf('! ', limit), rest.lastIndexOf('? ', limit));
      if (sentenceCut > limit * 0.55) cut = sentenceCut + 1;
      if (cut < limit * 0.45) cut = limit;
      result.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) result.push(rest);
    return result;
  }
  function parseChapters(raw) {
    const lines = raw.replace(/\r/g, '').split('\n');
    const hasHeadings = lines.some(function (line) { return /^\s*#{1,6}\s+\S/.test(line); });
    if (hasHeadings) {
      const result = [];
      let title = '';
      let body = [];
      function push() {
        const content = body.join('\n').trim();
        if (content) result.push({ title: title || (result.length ? t('section') + ' ' + (result.length + 1) : t('section') + ' 1'), text: content });
        body = [];
      }
      lines.forEach(function (line) {
        const match = line.match(/^\s*#{1,6}\s+(.+)$/);
        if (match) { push(); title = match[1].trim(); }
        else body.push(line);
      });
      push();
      return result;
    }
    const paragraphs = raw.split(/\n\s*\n/).map(function (part) { return part.trim(); }).filter(Boolean);
    if (!paragraphs.length && raw.trim()) paragraphs.push(raw.trim());
    const result = [];
    const groupSize = paragraphs.length > 4 ? 4 : Math.max(paragraphs.length, 1);
    for (let i = 0; i < paragraphs.length; i += groupSize) {
      result.push({ title: t('section') + ' ' + (result.length + 1), text: paragraphs.slice(i, i + groupSize).join('\n\n') });
    }
    return result;
  }
  function rebuildChapters() {
    const raw = textInput.value;
    const chars = raw.length;
    document.getElementById('charCount').textContent = chars.toLocaleString(currentLocale) + ' ' + t('characters');
    const minutes = chars ? Math.max(1, Math.round(chars / 850)) : 0;
    document.getElementById('timeEstimate').textContent = minutes + ' min ' + t('estimate');
    chapters = parseChapters(raw);
    selectedChapter = chapters.length ? Math.min(selectedChapter, chapters.length - 1) : 0;
    document.getElementById('chapterCount').textContent = String(chapters.length);
    chapterList.replaceChildren();
    if (!chapters.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-chapters'; empty.textContent = t('noChapters'); chapterList.appendChild(empty);
    } else {
      chapters.forEach(function (chapter, index) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'chapter-item' + (index === selectedChapter ? ' active' : '');
        button.setAttribute('aria-current', index === selectedChapter ? 'true' : 'false');
        const number = document.createElement('span'); number.className = 'chapter-index'; number.textContent = String(index + 1).padStart(2, '0');
        const name = document.createElement('span'); name.className = 'chapter-name'; name.textContent = chapter.title;
        button.append(number, name);
        button.addEventListener('click', function () { chooseChapter(index, false); });
        chapterList.appendChild(button);
      });
    }
    document.getElementById('activeChapter').textContent = chapters[selectedChapter] ? chapters[selectedChapter].title : t('appName');
    if (!chars) progressBar.style.width = '0%';
  }
  function setStatus(key) { playerStatus.textContent = t(key); playerStatus.setAttribute('data-i18n', key); }
  function refreshStatus() {
    if (isPaused) setStatus('paused');
    else if (window.speechSynthesis && speechSynthesis.speaking) setStatus('playing');
    else if (playerStatus.getAttribute('data-i18n') === 'stopped') setStatus('stopped');
    else setStatus('idle');
  }
  function updatePlayButton() {
    const active = !!(window.speechSynthesis && speechSynthesis.speaking && !isPaused);
    playButton.classList.toggle('is-playing', active);
    playButton.setAttribute('aria-label', isPaused ? t('resume') : (active ? t('pause') : t('play')));
  }
  function populateVoices() {
    if (!('speechSynthesis' in window)) {
      voiceSelect.replaceChildren(new Option(t('noVoice'), ''));
      return;
    }
    voiceList = speechSynthesis.getVoices() || [];
    const wanted = currentLocale === 'ro' ? 'ro' : (currentLocale.startsWith('sr') ? 'sr' : 'en');
    const sorted = voiceList.slice().sort(function (a, b) {
      const am = a.lang.toLowerCase().startsWith(wanted) ? 0 : 1;
      const bm = b.lang.toLowerCase().startsWith(wanted) ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
    const saved = safeGet(VOICE_KEY);
    voiceSelect.replaceChildren();
    if (!sorted.length) voiceSelect.add(new Option(t('noVoice'), ''));
    sorted.forEach(function (voice) {
      const source = voice.localService === false ? t('onlineVoice') : (voice.localService === true ? t('localVoice') : t('voiceSourceUnknown'));
      const option = new Option(voice.name + ' (' + voice.lang + ') · ' + source + (voice.default ? ' · default' : ''), voice.voiceURI);
      voiceSelect.add(option);
    });
    if (saved && sorted.some(function (voice) { return voice.voiceURI === saved; })) voiceSelect.value = saved;
    else {
      const match = sorted.find(function (voice) { return voice.lang.toLowerCase().startsWith(wanted); });
      if (match) voiceSelect.value = match.voiceURI;
    }
  }
  function makeUtterance(text, currentToken) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Number(rateInput.value);
    const voice = voiceList.find(function (item) { return item.voiceURI === voiceSelect.value; });
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    else utterance.lang = currentLocale === 'sr-cyrl' || currentLocale === 'sr-latn' ? 'sr-RS' : currentLocale;
    utterance.onstart = function () { if (currentToken === token) { setStatus('playing'); updatePlayButton(); } };
    utterance.onend = function () {
      if (currentToken !== token) return;
      chunkIndex += 1;
      progressBar.style.width = Math.min(100, Math.round(chunkIndex / speechChunks.length * 100)) + '%';
      if (chunkIndex < speechChunks.length) window.setTimeout(function () { speakNext(currentToken); }, 70);
      else {
        isPaused = false; setStatus('idle'); updatePlayButton();
        document.getElementById('progressLabel').textContent = chapters[selectedChapter] ? chapters[selectedChapter].title : '-';
      }
    };
    utterance.onerror = function (event) {
      if (currentToken !== token || event.error === 'canceled' || event.error === 'interrupted') return;
      isPaused = false; setStatus('stopped'); updatePlayButton();
    };
    return utterance;
  }
  function speakNext(currentToken) {
    if (currentToken !== token || chunkIndex >= speechChunks.length) return;
    const utterance = makeUtterance(speechChunks[chunkIndex], currentToken);
    speechSynthesis.speak(utterance);
  }
  function stopPlayback(statusKey) {
    token += 1;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    isPaused = false;
    setStatus(statusKey || 'stopped');
    updatePlayButton();
  }
  function startPlayback(index) {
    if (!('speechSynthesis' in window)) { setStatus('unsupported'); return; }
    if (!chapters.length) { setStatus('emptyError'); return; }
    stopPlayback('idle');
    selectedChapter = index;
    rebuildChapters();
    speechChunks = splitChunks(chapters[selectedChapter].text, 1800);
    chunkIndex = 0;
    progressBar.style.width = '0%';
    document.getElementById('progressLabel').textContent = chapters[selectedChapter].title;
    token += 1;
    speakNext(token);
  }
  function chooseChapter(index, autoplay) {
    if (!chapters[index]) return;
    const wasActive = !!(window.speechSynthesis && (speechSynthesis.speaking || isPaused));
    stopPlayback('idle');
    selectedChapter = index;
    rebuildChapters();
    if (autoplay || wasActive) startPlayback(index);
    else { progressBar.style.width = '0%'; document.getElementById('progressLabel').textContent = chapters[index].title; }
  }
  textInput.addEventListener('input', function () {
    if (window.speechSynthesis && (speechSynthesis.speaking || isPaused)) stopPlayback('stopped');
    selectedChapter = 0;
    rebuildChapters(); safeSet(TEXT_KEY, textInput.value);
  });
  document.getElementById('fileInput').addEventListener('change', function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () { textInput.value = String(reader.result || '').replace(/^\uFEFF/, ''); textInput.dispatchEvent(new Event('input')); setStatus('loaded'); };
    reader.onerror = function () { playerStatus.textContent = t('fileError'); };
    reader.readAsText(file);
    event.target.value = '';
  });
  document.getElementById('sampleButton').addEventListener('click', function () { textInput.value = t('sampleText'); textInput.dispatchEvent(new Event('input')); setStatus('loaded'); });
  document.getElementById('clearButton').addEventListener('click', function () {
    if (!textInput.value) return;
    previousText = textInput.value; document.getElementById('undoButton').disabled = false;
    textInput.value = ''; textInput.dispatchEvent(new Event('input')); setStatus('cleared');
  });
  document.getElementById('undoButton').addEventListener('click', function () {
    if (previousText === null) return;
    textInput.value = previousText; previousText = null; document.getElementById('undoButton').disabled = true;
    textInput.dispatchEvent(new Event('input')); setStatus('loaded');
  });
  playButton.addEventListener('click', function () {
    if (!('speechSynthesis' in window)) { setStatus('unsupported'); return; }
    if (isPaused) { speechSynthesis.resume(); isPaused = false; setStatus('playing'); updatePlayButton(); return; }
    if (speechSynthesis.speaking) { speechSynthesis.pause(); isPaused = true; setStatus('paused'); updatePlayButton(); return; }
    startPlayback(selectedChapter);
  });
  document.getElementById('stopButton').addEventListener('click', function () { stopPlayback('stopped'); });
  document.getElementById('prevButton').addEventListener('click', function () { if (chapters.length) chooseChapter(Math.max(0, selectedChapter - 1), true); });
  document.getElementById('nextButton').addEventListener('click', function () { if (chapters.length) chooseChapter(Math.min(chapters.length - 1, selectedChapter + 1), true); });
  localeSelect.addEventListener('change', function () { setLocale(localeSelect.value); });
  themeToggle.addEventListener('click', function () { setTheme(currentTheme === 'dark' ? 'light' : 'dark'); });
  rateInput.addEventListener('input', function () { rateValue.textContent = Number(rateInput.value).toFixed(1) + '×'; safeSet(RATE_KEY, rateInput.value); });
  voiceSelect.addEventListener('change', function () { safeSet(VOICE_KEY, voiceSelect.value); });
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = populateVoices;

  const initialRate = safeGet(RATE_KEY);
  if (initialRate && Number(initialRate) >= 0.6 && Number(initialRate) <= 1.8) rateInput.value = initialRate;
  rateValue.textContent = Number(rateInput.value).toFixed(1) + '×';
  textInput.value = safeGet(TEXT_KEY) || '';
  setTheme(safeGet(THEME_KEY) === 'dark' ? 'dark' : 'light', false);
  setLocale(detectLocale());
  if ('speechSynthesis' in window) window.setTimeout(populateVoices, 150);
  updatePlayButton();
})();
