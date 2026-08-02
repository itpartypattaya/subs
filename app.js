/* Телесуфлёр — логика. Без зависимостей, работает офлайн. */
(function () {
  'use strict';

  var STORE_KEY = 'teleprompter.v1';

  var el = {
    body: document.body,
    setup: document.getElementById('setup'),
    text: document.getElementById('text'),
    statWords: document.getElementById('stat-words'),
    statTime: document.getElementById('stat-time'),
    statPauses: document.getElementById('stat-pauses'),
    clear: document.getElementById('clear'),
    marks: document.getElementById('marks'),
    autoPauses: document.getElementById('auto-pauses'),
    stripPauses: document.getElementById('strip-pauses'),
    previewStrip: document.getElementById('preview-strip'),
    previewText: document.getElementById('preview-text'),
    size: document.getElementById('size'),
    speed: document.getElementById('speed'),
    width: document.getElementById('width'),
    valSize: document.getElementById('val-size'),
    valSpeed: document.getElementById('val-speed'),
    valWidth: document.getElementById('val-width'),
    theme: document.getElementById('theme'),
    align: document.getElementById('align'),
    mirror: document.getElementById('mirror'),
    countdownOn: document.getElementById('countdown-on'),
    start: document.getElementById('start'),
    resume: document.getElementById('resume'),
    prompter: document.getElementById('prompter'),
    viewer: document.getElementById('viewer'),
    track: document.getElementById('track'),
    progress: document.querySelector('#progress i'),
    pausedBadge: document.getElementById('paused-badge'),
    hud: document.getElementById('hud'),
    keyhelp: document.getElementById('keyhelp'),
    countdown: document.getElementById('countdown')
  };

  var LINE_RATIO = 1.4;    // должно совпадать с line-height блока #track в style.css
  var MARKER_RATIO = 0.38; // должно совпадать с top у #marker и padding-top у #track

  var settings = {
    text: '',
    size: 64,
    speed: 18,   // строк в минуту
    width: 70,   // % ширины экрана
    theme: 'white',
    align: 'left',
    mirror: false,
    countdown: true
  };

  var run = {
    active: false,
    playing: false,
    pos: 0,
    max: 0,
    stops: [],    // позиции меток «||» внутри текста
    nextStop: 0,  // ближайшая метка, которую суфлёр ещё не проехал
    lastFrame: 0,
    raf: 0,
    hudTimer: 0,
    countdownTimer: 0,
    wakeLock: null
  };

  /* ---------- настройки: хранение и применение ---------- */

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      Object.keys(settings).forEach(function (k) {
        if (saved[k] !== undefined && saved[k] !== null) settings[k] = saved[k];
      });
    } catch (e) { /* повреждённое хранилище — просто берём значения по умолчанию */ }
  }

  var saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* приватный режим */ }
    }, 300);
  }

  function fillControls() {
    el.text.value = settings.text;
    el.size.value = settings.size;
    el.speed.value = settings.speed;
    el.width.value = settings.width;
    el.mirror.checked = settings.mirror;
    el.countdownOn.checked = settings.countdown;
    markSegment(el.theme, 'theme', settings.theme);
    markSegment(el.align, 'align', settings.align);
  }

  function markSegment(group, attr, value) {
    var buttons = group.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('on', buttons[i].getAttribute('data-' + attr) === value);
    }
  }

  function applySettings() {
    el.body.classList.toggle('theme-yellow', settings.theme === 'yellow');
    el.body.classList.toggle('theme-white', settings.theme !== 'yellow');
    el.body.classList.toggle('align-center', settings.align === 'center');
    el.body.classList.toggle('mirror', settings.mirror);

    el.track.style.fontSize = settings.size + 'px';
    el.track.style.paddingLeft = (100 - settings.width) / 2 + 'vw';
    el.track.style.paddingRight = (100 - settings.width) / 2 + 'vw';

    el.previewText.style.fontSize = settings.size + 'px';
    el.previewText.style.width = settings.width + '%';
    el.previewText.style.textAlign = settings.align;

    el.valSize.textContent = settings.size + ' px';
    el.valSpeed.textContent = speedLabel(settings.speed);
    el.valWidth.textContent = settings.width + ' %';

    updateStats();
  }

  /* ---------- статистика и оценка времени ---------- */

  function pxPerSecond() {
    return settings.speed * settings.size * LINE_RATIO / 60;
  }

  function stripMarks(value) {
    return value.replace(/\|\|?/g, ' ');
  }

  function countMarks(value) {
    var stops = (value.match(/\|\|/g) || []).length;
    var breaths = (value.replace(/\|\|/g, '').match(/\|/g) || []).length;
    return { stops: stops, breaths: breaths };
  }

  function updateStats() {
    var value = stripMarks(el.text.value).trim();
    var words = value ? value.split(/\s+/).length : 0;
    el.statWords.textContent = words + ' ' + plural(words, 'слово', 'слова', 'слов');
    el.start.disabled = words === 0;

    // Оценка: сколько строк займёт текст при выбранной ширине и размере,
    // делённое на скорость. Считаем по фактической ширине окна.
    var seconds = 0;
    if (words > 0) {
      var lines = estimateLines(value);
      seconds = lines / settings.speed * 60;
    }
    el.statTime.textContent = '≈ ' + formatTime(seconds);
    el.previewText.textContent = value ? firstLine(value) : 'Пример строки текста';

    var marks = countMarks(el.text.value);
    var parts = [];
    if (marks.breaths) parts.push(marks.breaths + ' ' + plural(marks.breaths, 'вдох', 'вдоха', 'вдохов'));
    if (marks.stops) parts.push(marks.stops + ' ' + plural(marks.stops, 'остановка', 'остановки', 'остановок'));
    el.statPauses.textContent = parts.join(' · ');
    el.statPauses.hidden = parts.length === 0;
  }

  function firstLine(value) {
    var line = value.split(/\n/)[0];
    return line.length > 200 ? line.slice(0, 200) : line;
  }

  // Приблизительное число строк: ширина колонки / средняя ширина символа.
  function estimateLines(value) {
    var columnPx = window.innerWidth * settings.width / 100;
    var charsPerLine = Math.max(8, Math.floor(columnPx / (settings.size * 0.5)));
    var total = 0;
    var paragraphs = value.split(/\n/);
    for (var i = 0; i < paragraphs.length; i++) {
      var len = paragraphs[i].trim().length;
      total += len ? Math.ceil(len / charsPerLine) : 0.5;
    }
    return Math.max(1, total);
  }

  function formatTime(seconds) {
    seconds = Math.round(seconds);
    var min = Math.floor(seconds / 60);
    var sec = seconds % 60;
    if (min === 0) return sec + ' сек';
    return min + ' ' + plural(min, 'мин', 'мин', 'мин') + ' ' + (sec < 10 ? '0' : '') + sec + ' сек';
  }

  function speedLabel(value) {
    return value + ' ' + plural(value, 'строка', 'строки', 'строк') + '/мин';
  }

  function plural(n, one, few, many) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  /* ---------- подготовка текста ---------- */

  function renderText() {
    el.track.textContent = '';
    var paragraphs = el.text.value.replace(/\r/g, '').split(/\n{2,}/);
    for (var i = 0; i < paragraphs.length; i++) {
      var block = paragraphs[i].trim();
      if (block) renderBlock(block);
    }
    if (!el.track.childNodes.length) {
      var empty = document.createElement('p');
      empty.textContent = el.text.value.trim();
      el.track.appendChild(empty);
    }
  }

  // «|» — вдох: знак в строке, прокрутка не прерывается.
  // «||» — остановка: отдельная полоса, на ней суфлёр встаёт и ждёт человека.
  function renderBlock(block) {
    var parts = block.split(/(\|\|?)/);
    var nodes = [];

    function flushParagraph() {
      trimEdge(nodes[0], 'start');
      trimEdge(nodes[nodes.length - 1], 'end');
      var p = document.createElement('p');
      for (var n = 0; n < nodes.length; n++) p.appendChild(nodes[n]);
      nodes = [];
      if (p.textContent.trim()) el.track.appendChild(p);
    }

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '||') {
        flushParagraph();
        var stop = document.createElement('div');
        stop.className = 'stop';
        stop.appendChild(document.createElement('i'));
        el.track.appendChild(stop);
      } else if (part === '|') {
        var breath = document.createElement('span');
        breath.className = 'breath';
        breath.textContent = '|';
        nodes.push(breath);
      } else if (part) {
        nodes.push(document.createTextNode(part));
      }
    }
    flushParagraph();
  }

  // текст рисуется с pre-wrap, поэтому пробелы у краёв абзаца пришлось бы видно
  function trimEdge(node, side) {
    if (!node || node.nodeType !== 3) return;
    node.nodeValue = side === 'start'
      ? node.nodeValue.replace(/^\s+/, '')
      : node.nodeValue.replace(/\s+$/, '');
  }

  function markerOffset() {
    return el.viewer.clientHeight * MARKER_RATIO;
  }

  function collectStops() {
    run.stops = [];
    var list = el.track.querySelectorAll('.stop');
    for (var i = 0; i < list.length; i++) run.stops.push(list[i].offsetTop);
    syncStopIndex();
  }

  // после ручной перемотки ближайшая метка другая — иначе суфлёр
  // либо встанет на уже пройденной, либо проедет мимо непройденной
  function syncStopIndex() {
    var line = run.pos + markerOffset();
    run.nextStop = 0;
    while (run.nextStop < run.stops.length && run.stops[run.nextStop] <= line + 1) run.nextStop++;
  }

  function measure() {
    run.max = Math.max(0, el.track.offsetHeight - el.viewer.clientHeight);
    if (run.pos > run.max) run.pos = run.max;
    collectStops();
    draw();
  }

  function draw() {
    el.track.style.transform = 'translate3d(0,' + (-run.pos) + 'px,0)';
    el.progress.style.width = (run.max > 0 ? (run.pos / run.max) * 100 : 0) + '%';
  }

  /* ---------- запуск и остановка ---------- */

  function startPrompter(fromStart) {
    if (!el.text.value.trim()) return;

    renderText();
    el.prompter.hidden = false;
    el.body.classList.add('running');
    el.pausedBadge.hidden = true;
    run.active = true;
    if (fromStart) run.pos = 0;

    requestFullscreen();
    requestWakeLock();

    // сразу — чтобы цикл прокрутки знал длину текста с первого кадра,
    // и ещё раз, когда браузер применит полноэкранный режим и высота изменится
    measure();
    setTimeout(measure, 60);
    setTimeout(measure, 400);

    el.keyhelp.classList.remove('fade');
    setTimeout(function () { el.keyhelp.classList.add('fade'); }, 3500);

    if (settings.countdown) {
      runCountdown(function () { play(); });
    } else {
      play();
    }
  }

  function stopPrompter() {
    if (!run.active) return;
    pause();
    run.active = false;
    el.prompter.hidden = true;
    el.body.classList.remove('running');
    clearTimeout(run.countdownTimer);
    el.countdown.hidden = true;
    releaseWakeLock();
    exitFullscreen();
    el.resume.hidden = run.pos <= 0;
  }

  function play() {
    if (!run.active) return;
    run.playing = true;
    el.pausedBadge.hidden = true;
    run.lastFrame = 0;
    cancelAnimationFrame(run.raf);
    run.raf = requestAnimationFrame(tick);
  }

  function pause(reason) {
    run.playing = false;
    el.pausedBadge.textContent = reason === 'stop' ? 'остановка · клик — дальше' : 'пауза';
    el.pausedBadge.hidden = !run.active;
    cancelAnimationFrame(run.raf);
  }

  function toggle() {
    if (!el.countdown.hidden) return; // во время отсчёта клик игнорируем
    if (run.playing) pause(); else play();
  }

  function tick(now) {
    if (!run.playing) return;
    if (!run.lastFrame) run.lastFrame = now;
    var dt = Math.min((now - run.lastFrame) / 1000, 0.1); // защита от скачка после сворачивания окна
    run.lastFrame = now;

    // высота ещё не измерена (первые кадры после входа в полноэкранный режим) —
    // без этого нулевой run.max читался бы как «текст закончился»
    if (run.max <= 0) {
      measure();
      if (run.max <= 0) {
        if (el.track.offsetHeight > 0 && el.viewer.clientHeight > 0) {
          pause(); // текст короче экрана — прокручивать нечего
          return;
        }
        run.raf = requestAnimationFrame(tick);
        return;
      }
    }

    run.pos += pxPerSecond() * dt;

    // метка «||» доехала до маркера — встаём ровно на ней и ждём человека
    if (run.nextStop < run.stops.length && run.pos + markerOffset() >= run.stops[run.nextStop]) {
      run.pos = Math.max(0, run.stops[run.nextStop] - markerOffset());
      run.nextStop += 1;
      draw();
      pause('stop');
      return;
    }

    if (run.pos >= run.max) {
      run.pos = run.max;
      draw();
      pause();
      return;
    }
    draw();
    run.raf = requestAnimationFrame(tick);
  }

  function runCountdown(done) {
    var n = 3;
    var span = el.countdown.querySelector('span');
    el.countdown.hidden = false;
    span.textContent = n;

    (function step() {
      run.countdownTimer = setTimeout(function () {
        n -= 1;
        if (n === 0) {
          el.countdown.hidden = true;
          done();
          return;
        }
        span.textContent = n;
        // перезапуск анимации цифры
        span.style.animation = 'none';
        void span.offsetWidth;
        span.style.animation = '';
        step();
      }, 900);
    })();
  }

  /* ---------- полноэкранный режим и подсветка экрана ---------- */

  function requestFullscreen() {
    var root = document.documentElement;
    var fn = root.requestFullscreen || root.webkitRequestFullscreen;
    if (fn) {
      try {
        var result = fn.call(root);
        if (result && result.catch) result.catch(function () { /* браузер отказал — работаем окном */ });
      } catch (e) { /* file:// или запрет политики — не критично */ }
    }
  }

  function exitFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
    var fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) {
      try {
        var result = fn.call(document);
        if (result && result.catch) result.catch(function () {});
      } catch (e) { /* уже вышли */ }
    }
  }

  function requestWakeLock() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      run.wakeLock = lock;
    }).catch(function () { /* не поддержано или вкладка неактивна */ });
  }

  function releaseWakeLock() {
    if (run.wakeLock) {
      try { run.wakeLock.release(); } catch (e) { /* уже освобождён */ }
      run.wakeLock = null;
    }
  }

  /* ---------- HUD скорости ---------- */

  function showHud(message) {
    el.hud.textContent = message;
    el.hud.hidden = false;
    el.hud.classList.remove('fade');
    clearTimeout(run.hudTimer);
    run.hudTimer = setTimeout(function () { el.hud.classList.add('fade'); }, 1100);
  }

  var SPEED_MIN = 4;
  var SPEED_MAX = 120;

  // на медленных скоростях важна точность, на быстрых — быстрый разгон,
  // иначе от рабочих 18 до потолка пришлось бы крутить колесо сотню раз
  function speedStep(value) {
    if (value < 30) return 1;
    if (value < 60) return 2;
    return 5;
  }

  function changeSpeed(direction) {
    var step = speedStep(direction > 0 ? settings.speed : settings.speed - 1);
    var next = Math.min(SPEED_MAX, Math.max(SPEED_MIN, settings.speed + direction * step));
    if (next === settings.speed) return;
    settings.speed = next;
    el.speed.value = next;
    el.valSpeed.textContent = speedLabel(next);
    save();
    showHud(speedLabel(next));
  }

  function scrollBy(px) {
    run.pos = Math.min(run.max, Math.max(0, run.pos + px));
    syncStopIndex();
    draw();
  }

  /* ---------- обработчики: экран настройки ---------- */

  el.text.addEventListener('input', function () {
    settings.text = el.text.value;
    updateStats();
    save();
  });

  // вставка метки в позицию курсора — чтобы не держать синтаксис в голове
  function insertMark(mark) {
    var ta = el.text;
    var before = ta.value.slice(0, ta.selectionStart).replace(/[ \t]+$/, '');
    var after = ta.value.slice(ta.selectionEnd).replace(/^[ \t]+/, '');
    var head = before + (before && !/\n$/.test(before) ? ' ' : '') + mark + ' ';
    ta.value = head + after;
    ta.setSelectionRange(head.length, head.length);
    ta.focus();
    commitText();
  }

  // черновая разметка по концам предложений: дальше человек правит руками,
  // это дешевле, чем размечать пятиминутный текст с нуля
  function autoPauses(value) {
    return value.split('\n').map(function (line) {
      return line.replace(/([.!?…])([ \t]+)(?=[^\s|])/g, '$1 | ');
    }).join('\n');
  }

  function commitText() {
    settings.text = el.text.value;
    updateStats();
    save();
  }

  el.marks.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-mark]');
    if (button) insertMark(button.getAttribute('data-mark'));
  });

  el.autoPauses.addEventListener('click', function () {
    el.text.value = autoPauses(el.text.value);
    commitText();
  });

  el.stripPauses.addEventListener('click', function () {
    el.text.value = el.text.value
      .replace(/[ \t]*\|\|?[ \t]*/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/^[ \t]+/gm, '');
    commitText();
  });

  el.clear.addEventListener('click', function () {
    el.text.value = '';
    settings.text = '';
    run.pos = 0;
    el.resume.hidden = true;
    updateStats();
    save();
    el.text.focus();
  });

  [['size', 'size'], ['speed', 'speed'], ['width', 'width']].forEach(function (pair) {
    el[pair[0]].addEventListener('input', function () {
      settings[pair[1]] = Number(this.value);
      applySettings();
      save();
    });
  });

  el.theme.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-theme]');
    if (!button) return;
    settings.theme = button.getAttribute('data-theme');
    markSegment(el.theme, 'theme', settings.theme);
    applySettings();
    save();
  });

  el.align.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-align]');
    if (!button) return;
    settings.align = button.getAttribute('data-align');
    markSegment(el.align, 'align', settings.align);
    applySettings();
    save();
  });

  el.mirror.addEventListener('change', function () {
    settings.mirror = this.checked;
    applySettings();
    save();
  });

  el.countdownOn.addEventListener('change', function () {
    settings.countdown = this.checked;
    save();
  });

  el.start.addEventListener('click', function () { startPrompter(true); });
  el.resume.addEventListener('click', function () { startPrompter(false); });

  el.text.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      startPrompter(true);
    }
  });

  /* ---------- обработчики: экран суфлёра ---------- */

  el.prompter.addEventListener('click', toggle);

  el.prompter.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (run.playing) {
      changeSpeed(e.deltaY < 0 ? 1 : -1);
    } else {
      scrollBy(e.deltaY);
    }
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (!run.active) return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        toggle();
        break;
      case 'Escape':
        stopPrompter();
        break;
      case 'ArrowUp':
        e.preventDefault();
        changeSpeed(1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        changeSpeed(-1);
        break;
      case 'PageUp':
        e.preventDefault();
        scrollBy(-el.viewer.clientHeight * 0.8);
        break;
      case 'PageDown':
        e.preventDefault();
        scrollBy(el.viewer.clientHeight * 0.8);
        break;
      case 'Home':
        e.preventDefault();
        run.pos = 0;
        syncStopIndex();
        draw();
        break;
      case 'End':
        e.preventDefault();
        run.pos = run.max;
        syncStopIndex();
        draw();
        break;
      default:
        break;
    }
  });

  // выход из полноэкранного режима крестиком/Esc браузера — возвращаемся в настройки
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (event) {
    document.addEventListener(event, function () {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && run.active) stopPrompter();
    });
  });

  window.addEventListener('resize', function () {
    if (run.active) measure(); else updateStats();
  });

  // после сворачивания вкладки системная блокировка экрана снимается — берём её заново
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && run.active) requestWakeLock();
  });

  /* ---------- старт ---------- */

  load();
  fillControls();
  applySettings();
})();
