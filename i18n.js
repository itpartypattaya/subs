/* Словари интерфейса RU/EN. Подключается после text-tools.js и перед app.js,
   наружу отдаёт window.I18n. DOM не трогает — раскладку строк по странице
   делает app.js (applyLanguage), поэтому словари покрывает tests.html.

   Строки с суффиксом Html — наша разметка (<b>, &nbsp;), а не ввод
   пользователя: их можно класть в innerHTML. Существительные для счётчиков —
   массивы форм: для русского [1, 2–4, 5+], для английского [1, остальные]. */
(function () {
  'use strict';

  var LANGS = ['ru', 'en'];

  var dict = {
    ru: {
      title: 'Телесуфлёр',
      description: 'Простой телесуфлёр в браузере: вставьте текст, выберите размер и скорость — и читайте с экрана во время записи видео.',
      sub: 'Вставьте текст, подберите размер и скорость — и читайте прямо с экрана во время записи.',

      // кнопка языка показывает язык, на который переключит, — и подписана
      // на нём же: кто не читает текущий язык, прочтёт целевой
      langSwitch: 'EN',
      langSwitchTitle: 'Switch to English',
      themeTitle: 'Тема интерфейса',
      themeToLight: 'Светлая тема',
      themeToDark: 'Тёмная тема',

      textPlaceholder: 'Вставьте сюда текст выступления…',
      textAria: 'Текст выступления',
      markBreathHtml: 'Вдох&nbsp;<b>|</b>',
      markBreathTitle: 'Знак вдоха: прокрутка не останавливается',
      markStopHtml: 'Остановка&nbsp;<b>||</b>',
      markStopTitle: 'Остановка: суфлёр встанет и подождёт клика',
      autoPauses: 'Расставить вдохи автоматически',
      typograf: 'Типограф',
      typografTitle: 'Кавычки, тире, чистка лишних пробелов',
      stripPauses: 'Убрать все паузы',
      clear: 'Очистить',

      preview: 'Предпросмотр',
      previewSample: 'Пример строки текста',
      size: 'Размер букв',
      speed: 'Скорость',
      width: 'Ширина текста',
      stage: 'Экран суфлёра',
      stageAria: 'Тема экрана суфлёра',
      stageDark: 'Тёмный',
      stageLight: 'Светлый',
      stageYellow: 'Жёлтый',
      align: 'Выравнивание',
      alignAria: 'Выравнивание текста',
      alignLeft: 'Слева',
      alignCenter: 'По центру',
      mirror: 'Зеркальное отражение',
      countdown: 'Отсчёт 3-2-1 перед стартом',
      start: 'Запустить',
      resume: 'Продолжить с места остановки',

      legend1Html: '<b>|</b> в тексте — знак вдоха, прокрутка идёт дальше · <b>||</b> — остановка до клика',
      legend2Html: '<b>Клик мыши</b>, <b>тап</b> или <b>пробел</b> — пауза и продолжение',
      legend3Html: '<b>Колесо мыши</b> или <b>свайп</b> — скорость (на паузе — перемотка текста)',
      legend4Html: '<b>↑ ↓</b> — скорость · <b>PgUp/PgDn</b> — перемотка · <b>Home</b> — в начало',
      legend5Html: '<b>Esc</b> или <b>✕</b> в углу — выход в настройки',

      exit: 'Выход в настройки',
      exitTitle: 'Выход (Esc)',
      keyhelpTouch: 'тап — пауза · свайп — скорость · ✕ — выход',
      keyhelpMouse: 'клик — пауза · колесо — скорость · Esc — выход',
      badgePause: 'пауза',
      badgeStop: 'остановка · клик — дальше',
      badgeEnd: 'конец · клик — сначала',

      noteAdded: 'расставлено {count}',
      noteNone: 'подходящих мест не нашлось — вдохи ставятся после точки внутри абзаца',
      noteTidied: 'текст причёсан',
      noteClean: 'текст уже в порядке',

      words: ['слово', 'слова', 'слов'],
      breaths: ['вдох', 'вдоха', 'вдохов'],
      stops: ['остановка', 'остановки', 'остановок']
    },

    en: {
      title: 'Teleprompter',
      description: 'A simple browser teleprompter: paste your text, choose size and speed, and read from the screen while recording video.',
      sub: 'Paste your text, pick a size and speed — and read right off the screen while you record.',

      langSwitch: 'RU',
      langSwitchTitle: 'Переключить на русский',
      themeTitle: 'Interface theme',
      themeToLight: 'Light theme',
      themeToDark: 'Dark theme',

      textPlaceholder: 'Paste your script here…',
      textAria: 'Script text',
      markBreathHtml: 'Breath&nbsp;<b>|</b>',
      markBreathTitle: 'Breath mark: scrolling keeps going',
      markStopHtml: 'Stop&nbsp;<b>||</b>',
      markStopTitle: 'Stop: the prompter halts and waits for a click',
      autoPauses: 'Add breaths automatically',
      typograf: 'Tidy up',
      typografTitle: 'Curly quotes, dashes, extra spaces cleanup',
      stripPauses: 'Remove all pauses',
      clear: 'Clear',

      preview: 'Preview',
      previewSample: 'Sample line of text',
      size: 'Font size',
      speed: 'Speed',
      width: 'Text width',
      stage: 'Prompter screen',
      stageAria: 'Prompter screen theme',
      stageDark: 'Dark',
      stageLight: 'Light',
      stageYellow: 'Yellow',
      align: 'Alignment',
      alignAria: 'Text alignment',
      alignLeft: 'Left',
      alignCenter: 'Center',
      mirror: 'Mirror mode',
      countdown: '3-2-1 countdown before start',
      start: 'Start',
      resume: 'Resume where you left off',

      legend1Html: '<b>|</b> in the text — breath mark, scrolling keeps going · <b>||</b> — stop until click',
      legend2Html: '<b>Mouse click</b>, <b>tap</b> or <b>Space</b> — pause and resume',
      legend3Html: '<b>Mouse wheel</b> or <b>swipe</b> — speed (while paused — scroll the text)',
      legend4Html: '<b>↑ ↓</b> — speed · <b>PgUp/PgDn</b> — scroll · <b>Home</b> — to the start',
      legend5Html: '<b>Esc</b> or <b>✕</b> in the corner — back to settings',

      exit: 'Back to settings',
      exitTitle: 'Exit (Esc)',
      keyhelpTouch: 'tap — pause · swipe — speed · ✕ — exit',
      keyhelpMouse: 'click — pause · wheel — speed · Esc — exit',
      badgePause: 'paused',
      badgeStop: 'stop · click to continue',
      badgeEnd: 'the end · click to restart',

      noteAdded: 'added {count}',
      noteNone: 'no suitable spots found — breaths go after a full stop inside a paragraph',
      noteTidied: 'text tidied up',
      noteClean: 'text is already tidy',

      words: ['word', 'words'],
      breaths: ['breath', 'breaths'],
      stops: ['stop', 'stops']
    }
  };

  function norm(lang) {
    return LANGS.indexOf(lang) >= 0 ? lang : 'ru';
  }

  // язык браузера: первый в списке предпочтений. Угадывать по соседним
  // языкам (uk, be, kk) не берёмся — им по умолчанию английский, а русский
  // в один клик
  function detect() {
    var list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    var first = String(list[0] || '').toLowerCase();
    return first.indexOf('ru') === 0 ? 'ru' : 'en';
  }

  function t(lang, key, params) {
    var table = dict[norm(lang)];
    var value = table[key];
    if (value === undefined) value = dict.ru[key]; // недопереведённое лучше, чем пустота
    if (value === undefined) return key;
    if (params) {
      value = value.replace(/\{(\w+)\}/g, function (all, name) {
        return params[name] !== undefined ? params[name] : all;
      });
    }
    return value;
  }

  // «5 слов» / «5 words»: число плюс существительное в нужной форме
  function count(lang, n, key) {
    lang = norm(lang);
    var forms = dict[lang][key];
    var word = lang === 'ru'
      ? window.TextTools.plural(n, forms[0], forms[1], forms[2])
      : (n === 1 ? forms[0] : forms[1]);
    return n + ' ' + word;
  }

  window.I18n = {
    LANGS: LANGS,
    dict: dict,
    detect: detect,
    t: t,
    count: count
  };
})();
