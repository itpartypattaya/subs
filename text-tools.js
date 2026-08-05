/* Чистые текстовые функции телесуфлёра: ни одна не трогает DOM и состояние.
   Вынесены из app.js, чтобы их могла гонять тест-страница tests.html —
   именно в этих функциях дважды находились баги (неразрывные пробелы,
   инициалы). Подключается перед app.js, наружу отдаёт window.TextTools. */
(function () {
  'use strict';

  /* ---------- склонения и форматирование ---------- */

  function plural(n, one, few, many) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatTime(seconds) {
    seconds = Math.round(seconds);
    var hours = Math.floor(seconds / 3600);
    var min = Math.floor((seconds % 3600) / 60);
    var sec = seconds % 60;
    // «822 мин 10 сек» читалось как поломка, поэтому от часа считаем в часах
    if (hours > 0) return hours + ' ч ' + pad(min) + ' мин';
    if (min === 0) return sec + ' сек';
    return min + ' мин ' + pad(sec) + ' сек';
  }

  function speedLabel(value) {
    return value + ' ' + plural(value, 'строка', 'строки', 'строк') + '/мин';
  }

  /* ---------- метки пауз ---------- */

  function stripMarks(value) {
    return value.replace(/\|\|?/g, ' ');
  }

  function countMarks(value) {
    var stops = (value.match(/\|\|/g) || []).length;
    var breaths = (value.replace(/\|\|/g, '').match(/\|/g) || []).length;
    return { stops: stops, breaths: breaths };
  }

  // сокращения и инициалы, после которых точка не кончает предложение
  var ABBR = /^(?:т|д|е|п|г|гг|в|вв|см|стр|рис|табл|руб|коп|тыс|млн|млрд|им|др|пр|ул|кв|обл|тел|мин|сек|ч|кг|км|шт|проф|доц|акад)$/i;

  // черновая разметка по концам предложений: дальше человек правит руками,
  // это дешевле, чем размечать пятиминутный текст с нуля.
  // Пробел ищем как [^\S\n]: из Word и с веб-страниц текст приходит
  // с неразрывными пробелами, и на них разметка молча не срабатывала.
  function autoPauses(value) {
    return value.split('\n').map(function (line) {
      return line.replace(/([^\s.!?…]*)([.!?…]+[»"')\]]*)([^\S\n]+)(?=[^\s|])/g, function (all, word, punct) {
        if (word.length <= 1 || ABBR.test(word)) return all; // инициал или сокращение
        return word + punct + ' | ';
      });
    }).join('\n');
  }

  /* ---------- типограф ---------- */

  // короткие слова, которые не должны отрываться от следующего слова
  var SHORT_WORDS = 'а|и|но|да|же|ли|бы|не|ни|в|во|к|ко|с|со|о|об|обо|от|ото|до|из|изо|у|за|на|по|над|под|про|при|для|без|через|что|как|это';

  var NBSP = '\u00A0'; // неразрывный пробел

  // правило применяется дважды: совпадение съедает пробел-разделитель, и в
  // цепочке коротких слов («и не и не») за один проход клеится каждое второе —
  // второй проход видит уже поставленный NBSP как \s и доклеивает остальные
  var SHORT_RE = new RegExp('(^|[\\s(«„])(' + SHORT_WORDS + ') ', 'gi');

  function typograf(value) {
    return value
      .replace(/\r/g, '')
      .replace(/[\u00A0\u202F\u2007\u2009\t]/g, ' ')  // пробелы из Word и табы — к обычным
      .replace(/[ \t]{2,}/g, ' ')                            // двойные пробелы
      .replace(/[ \t]+([,;:.!?…])/g, '$1')                   // пробел перед знаком препинания
      .replace(/\.{3,}/g, '…')                               // многоточие одним знаком
      .replace(/(^|[\s(])-{1,2}(\s)/g, '$1—$2')              // дефис в роли тире
      .replace(/"([^"\n]+)"/g, '«$1»')                       // кавычки-ёлочки
      .replace(/(^|[\s(«])'([^'\n]+)'/g, '$1„$2“')
      .replace(/([(«])[ \t]+/g, '$1')                        // пробел после открывающей скобки
      .replace(/[ \t]+([)»])/g, '$1')
      .replace(SHORT_RE, '$1$2' + NBSP)
      .replace(SHORT_RE, '$1$2' + NBSP)
      .replace(/[ \t]+$/gm, '')                              // хвосты строк
      .replace(/\n{3,}/g, '\n\n')                            // лишние пустые строки
      .trim();
  }

  window.TextTools = {
    plural: plural,
    formatTime: formatTime,
    speedLabel: speedLabel,
    stripMarks: stripMarks,
    countMarks: countMarks,
    autoPauses: autoPauses,
    typograf: typograf
  };
})();
