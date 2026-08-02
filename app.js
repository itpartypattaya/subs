/* Телесуфлёр — логика. Без зависимостей, работает офлайн. */
(function () {
  'use strict';

  var STORE_KEY = 'teleprompter.v1';

  // чистые текстовые функции живут в text-tools.js (подключается раньше) —
  // отдельно от DOM, чтобы их покрывала тест-страница tests.html
  var T = window.TextTools;
  var plural = T.plural, formatTime = T.formatTime, speedLabel = T.speedLabel;
  var stripMarks = T.stripMarks, countMarks = T.countMarks;
  var autoPauses = T.autoPauses, typograf = T.typograf;

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
    typograf: document.getElementById('typograf'),
    stripPauses: document.getElementById('strip-pauses'),
    toolNote: document.getElementById('tool-note'),
    uiTheme: document.getElementById('ui-theme'),
    uiThemeLabel: document.getElementById('ui-theme-label'),
    previewStrip: document.getElementById('preview-strip'),
    previewText: document.getElementById('preview-text'),
    size: document.getElementById('size'),
    speed: document.getElementById('speed'),
    width: document.getElementById('width'),
    valSize: document.getElementById('val-size'),
    valSpeed: document.getElementById('val-speed'),
    valWidth: document.getElementById('val-width'),
    stage: document.getElementById('stage'),
    align: document.getElementById('align'),
    mirror: document.getElementById('mirror'),
    countdownOn: document.getElementById('countdown-on'),
    start: document.getElementById('start'),
    resume: document.getElementById('resume'),
    prompter: document.getElementById('prompter'),
    exit: document.getElementById('exit'),
    viewer: document.getElementById('viewer'),
    track: document.getElementById('track'),
    measurer: document.getElementById('measurer'),
    progress: document.querySelector('#progress i'),
    pausedBadge: document.getElementById('paused-badge'),
    hud: document.getElementById('hud'),
    keyhelp: document.getElementById('keyhelp'),
    countdown: document.getElementById('countdown')
  };

  // Единственный источник чисел, которые раньше дублировались в HTML и CSS:
  // applySettings() раздаёт LINE_RATIO треку и предпросмотру, init проставляет
  // границы слайдера скорости и CSS-переменную --marker. Двойников больше нет.
  var LINE_RATIO = 1.4;    // межстрочный интервал текста суфлёра
  var MARKER_RATIO = 0.38; // маркер и первая строка текста — на 38% высоты экрана
  var SPEED_MIN = 4;       // строк в минуту
  var SPEED_MAX = 120;
  var WHEEL_STEP = 100;    // накопленная дельта колеса на один шаг скорости

  var settings = {
    text: '',
    size: 64,
    speed: 18,     // строк в минуту
    width: 70,     // % ширины экрана
    stage: 'dark', // экран суфлёра: dark | light | yellow
    ui: '',        // интерфейс: dark | light, пусто — взять системную
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
    wheelAcc: 0,  // накопленная дельта колеса (тачпад шлёт десятки мелких событий)
    atEnd: false, // текст дочитан: клик начинает заново, а не «продолжает» в никуда
    lastFrame: 0,
    raf: 0,
    hudTimer: 0,
    keyhelpTimer: 0,
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
      // до появления светлой темы вариант назывался theme: white | yellow
      if (saved.theme && !saved.stage) settings.stage = saved.theme === 'yellow' ? 'yellow' : 'dark';
    } catch (e) { /* повреждённое хранилище — просто берём значения по умолчанию */ }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // пустое settings.ui означает «пользователь тему не выбирал» — тогда каждый
  // раз берём актуальную системную, а не замораживаем её при первом визите
  function currentUi() {
    return settings.ui === 'light' || settings.ui === 'dark' ? settings.ui : systemTheme();
  }

  var saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeStore, 300);
  }

  function writeStore() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* приватный режим */ }
  }

  function fillControls() {
    el.text.value = settings.text;
    el.size.value = settings.size;
    el.speed.value = settings.speed;
    el.width.value = settings.width;
    el.mirror.checked = settings.mirror;
    el.countdownOn.checked = settings.countdown;
    markSegment(el.stage, 'stage', settings.stage);
    markSegment(el.align, 'align', settings.align);
  }

  function markSegment(group, attr, value) {
    var buttons = group.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-' + attr) === value;
      buttons[i].classList.toggle('on', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false'); // выбор виден скринридеру
    }
  }

  function applySettings() {
    el.body.classList.toggle('stage-light', settings.stage === 'light');
    el.body.classList.toggle('stage-yellow', settings.stage === 'yellow');
    el.body.classList.toggle('ui-light', currentUi() === 'light');
    el.body.classList.toggle('align-center', settings.align === 'center');
    el.body.classList.toggle('mirror', settings.mirror);
    el.uiThemeLabel.textContent = currentUi() === 'light' ? 'Тёмная тема' : 'Светлая тема';

    el.track.style.fontSize = settings.size + 'px';
    el.track.style.lineHeight = String(LINE_RATIO);
    el.track.style.paddingLeft = (100 - settings.width) / 2 + 'vw';
    el.track.style.paddingRight = (100 - settings.width) / 2 + 'vw';

    // измеритель оценки времени вёрстается ровно как трек (кроме вертикальных
    // отступов: их у него нет, чтобы offsetHeight был чистой высотой текста)
    el.measurer.style.fontSize = settings.size + 'px';
    el.measurer.style.lineHeight = String(LINE_RATIO);
    el.measurer.style.paddingLeft = (100 - settings.width) / 2 + 'vw';
    el.measurer.style.paddingRight = (100 - settings.width) / 2 + 'vw';

    el.previewText.style.fontSize = settings.size + 'px';
    el.previewText.style.lineHeight = String(LINE_RATIO);
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

  function updateStats() {
    var value = stripMarks(el.text.value).trim();
    var words = value ? value.split(/\s+/).length : 0;
    el.statWords.textContent = words + ' ' + plural(words, 'слово', 'слова', 'слов');
    el.start.disabled = words === 0;

    el.statTime.textContent = '≈ ' + formatTime(words > 0 ? estimateSeconds() : 0);
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

  // Оценка по фактической вёрстке, а не по «средней ширине символа»:
  // текст рендерится в невидимый измеритель с теми же шрифтом, интервалом
  // и шириной колонки, что у трека, и высота делится на скорость прокрутки.
  // Прежняя эвристика занижала время на ~15–20% для жирной кириллицы.
  function estimateSeconds() {
    renderText(el.measurer);
    var px = el.measurer.offsetHeight;
    el.measurer.textContent = ''; // копию текста в DOM не держим
    return px / pxPerSecond();
  }

  /* ---------- подготовка текста ---------- */

  // target по умолчанию — трек суфлёра; оценка времени рендерит тот же текст
  // в невидимый #measurer, чтобы мерить фактическую вёрстку
  function renderText(target) {
    target = target || el.track;
    target.textContent = '';
    var paragraphs = el.text.value.replace(/\r/g, '').split(/\n{2,}/);
    for (var i = 0; i < paragraphs.length; i++) {
      var block = paragraphs[i].trim();
      if (block) renderBlock(block, target);
    }
    if (!target.childNodes.length) {
      var empty = document.createElement('p');
      empty.textContent = el.text.value.trim();
      target.appendChild(empty);
    }
  }

  // «|» — вдох: знак в строке, прокрутка не прерывается.
  // «||» — остановка: отдельная полоса, на ней суфлёр встаёт и ждёт человека.
  function renderBlock(block, target) {
    var parts = block.split(/(\|\|?)/);
    var nodes = [];

    function flushParagraph() {
      trimEdge(nodes[0], 'start');
      trimEdge(nodes[nodes.length - 1], 'end');
      var p = document.createElement('p');
      for (var n = 0; n < nodes.length; n++) p.appendChild(nodes[n]);
      nodes = [];
      if (p.textContent.trim()) target.appendChild(p);
    }

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '||') {
        flushParagraph();
        var stop = document.createElement('div');
        stop.className = 'stop';
        stop.appendChild(document.createElement('i'));
        target.appendChild(stop);
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

    // таймер именной: без очистки прогон, запущенный повторно раньше 3.5 с,
    // получал бы погашенную подсказку от предыдущего
    el.keyhelp.classList.remove('fade');
    clearTimeout(run.keyhelpTimer);
    run.keyhelpTimer = setTimeout(function () { el.keyhelp.classList.add('fade'); }, 3500);

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
    clearTimeout(run.keyhelpTimer);
    el.countdown.hidden = true;
    releaseWakeLock();
    exitFullscreen();
    // в конце текста продолжать нечего — предлагаем только запуск сначала
    el.resume.hidden = run.pos <= 0 || run.pos >= run.max;
  }

  function play() {
    if (!run.active) return;
    run.playing = true;
    run.atEnd = false;
    run.wheelAcc = 0; // остаток дельты прошлого режима не должен дёргать скорость
    el.pausedBadge.hidden = true;
    run.lastFrame = 0;
    cancelAnimationFrame(run.raf);
    run.raf = requestAnimationFrame(tick);
  }

  var BADGE = {
    stop: 'остановка · клик — дальше',
    end: 'конец · клик — сначала'
  };

  function pause(reason) {
    run.playing = false;
    run.wheelAcc = 0;
    run.atEnd = reason === 'end';
    el.pausedBadge.textContent = BADGE[reason] || 'пауза';
    el.pausedBadge.hidden = !run.active;
    cancelAnimationFrame(run.raf);
  }

  function toggle() {
    if (!el.countdown.hidden) return; // во время отсчёта клик игнорируем
    if (run.atEnd) { setPos(0); play(); return; } // в конце клик отматывает к началу
    if (run.playing) pause(); else play();
  }

  // единственная точка ручного перемещения: клампит, пересобирает ближайшую
  // метку и снимает признак «дочитано», если уехали от конца
  function setPos(px) {
    run.pos = Math.min(run.max, Math.max(0, px));
    if (run.pos < run.max) run.atEnd = false;
    syncStopIndex();
    draw();
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
      pause('end');
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
    setPos(run.pos + px);
  }

  /* ---------- обработчики: экран настройки ---------- */

  el.text.addEventListener('input', commitText);

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

  function commitText() {
    if (el.text.value !== settings.text) {
      settings.text = el.text.value;
      // позиция прошлого прогона в изменённом тексте бессмысленна:
      // «Продолжить» открыл бы новый текст на случайном месте
      run.pos = 0;
      el.resume.hidden = true;
    }
    updateStats();
    save();
  }

  el.marks.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-mark]');
    if (button) insertMark(button.getAttribute('data-mark'));
  });

  // без ответа кнопка выглядит сломанной, когда менять в тексте нечего
  var noteTimer = 0;
  function showNote(message) {
    el.toolNote.textContent = message;
    el.toolNote.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { el.toolNote.hidden = true; }, 3500);
  }

  el.autoPauses.addEventListener('click', function () {
    var before = countMarks(el.text.value).breaths;
    el.text.value = autoPauses(el.text.value);
    commitText();
    var added = countMarks(el.text.value).breaths - before;
    showNote(added > 0
      ? 'расставлено ' + added + ' ' + plural(added, 'вдох', 'вдоха', 'вдохов')
      : 'подходящих мест не нашлось — вдохи ставятся после точки внутри абзаца');
  });

  el.typograf.addEventListener('click', function () {
    var before = el.text.value;
    el.text.value = typograf(before);
    commitText();
    showNote(el.text.value === before ? 'текст уже в порядке' : 'текст причёсан');
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
    commitText();
    el.text.focus();
  });

  [['size', 'size'], ['speed', 'speed'], ['width', 'width']].forEach(function (pair) {
    el[pair[0]].addEventListener('input', function () {
      settings[pair[1]] = Number(this.value);
      applySettings();
      save();
    });
  });

  el.stage.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-stage]');
    if (!button) return;
    settings.stage = button.getAttribute('data-stage');
    markSegment(el.stage, 'stage', settings.stage);
    applySettings();
    save();
  });

  el.uiTheme.addEventListener('click', function () {
    settings.ui = currentUi() === 'light' ? 'dark' : 'light';
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

  // единственный выход без клавиатуры: на iPhone нет ни Esc, ни fullscreen-события
  el.exit.addEventListener('click', function (e) {
    e.stopPropagation(); // иначе клик долетит до prompter и снимет паузу
    stopPrompter();
  });

  // Один шаг скорости на WHEEL_STEP накопленных пикселей: колесо с щелчками
  // даёт ~100 px за щелчок (шаг за щелчок), а тачпад шлёт десятки мелких
  // событий с инерцией — без накопления скорость слетала от 18 к 120 за жест.
  el.prompter.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (!el.countdown.hidden) return; // во время отсчёта колесо не трогаем
    var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // режим «строки» (Firefox) — к пикселям
    if (run.playing) {
      run.wheelAcc += delta;
      while (run.wheelAcc <= -WHEEL_STEP) { changeSpeed(1); run.wheelAcc += WHEEL_STEP; }
      while (run.wheelAcc >= WHEEL_STEP) { changeSpeed(-1); run.wheelAcc -= WHEEL_STEP; }
    } else {
      scrollBy(delta);
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
        setPos(0);
        break;
      case 'End':
        e.preventDefault();
        setPos(run.max);
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

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      // после сворачивания вкладки системная блокировка экрана снимается
      if (run.active) requestWakeLock();
    } else {
      writeStore(); // уход со страницы не должен съедать последние 300 мс ввода
    }
  });

  // pagehide перехватывает закрытие вкладки там, где visibilitychange не успевает
  window.addEventListener('pagehide', writeStore);

  /* ---------- старт ---------- */

  load();

  // границы и геометрия раздаются отсюда — в HTML и CSS их копий нет.
  // dvh вместо vh: в Safari на iPhone vh считается от экрана без учёта
  // адресной строки, и отступ трека разъезжался с markerOffset() по
  // clientHeight — метка вставала мимо визуального маркера.
  el.speed.min = SPEED_MIN;
  el.speed.max = SPEED_MAX;
  var vh = (window.CSS && CSS.supports && CSS.supports('height', '100dvh')) ? 'dvh' : 'vh';
  document.documentElement.style.setProperty('--stage-h', '100' + vh);
  document.documentElement.style.setProperty('--marker', MARKER_RATIO * 100 + vh);

  // пока тема не выбрана явно, интерфейс следует за сменой системной
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    if (mq.addEventListener) {
      mq.addEventListener('change', function () {
        if (!settings.ui) applySettings();
      });
    }
  }

  fillControls();
  applySettings();
})();
