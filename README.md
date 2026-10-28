# Филворд

Филворд без рекламы для телефона: поле целиком из слов, слово тянется
змейкой по соседним клеткам (без диагоналей). Тап по найденному слову
показывает толкование.

Чистый JavaScript, без сборщика и фреймворков.

## Словарь

`data/words.json` собирается скриптом из двух открытых источников:

| Файл в `raw/` (не в git) | Что это | Лицензия |
|---|---|---|
| `ru.jsonl.gz` | Русский Викисловарь, разобранный [wiktextract](https://kaikki.org/ruwiktionary/) | CC BY-SA 4.0 |
| `ru_full.txt` | Частотный список слов [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (субтитры OpenSubtitles 2018) | MIT / CC BY-SA 4.0 |
| `wordfreq_ru.txt` | Частотный список [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1: книги (Google Books Ngrams), Википедия, новости, субтитры | данные CC BY-SA 4.0 |

Скачать и собрать:

```
curl -L -o raw/ru.jsonl.gz https://kaikki.org/ruwiktionary/raw-wiktextract-data.jsonl.gz
curl -L -o raw/ru_full.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_full.txt
curl -L -o raw/wordfreq.whl https://files.pythonhosted.org/packages/24/61/62835c475d69872d30689f284497853fe33fe1d6dd18f57346d13305861d/wordfreq-3.1.1-py3-none-any.whl
unzip -p raw/wordfreq.whl wordfreq/data/large_ru.msgpack.gz > raw/large_ru.msgpack.gz
node scripts/wordfreq-to-txt.mjs raw/large_ru.msgpack.gz > raw/wordfreq_ru.txt
npm run build:dict
node scripts/simulate.mjs
```

Скрипт берёт частые слова из расчёта на 2000 полей (`node scripts/build-dict.mjs 2000`).
`simulate.mjs` проходит весь словарь, как игрок, и показывает, сколько полей
получилось на самом деле: 30 прогонов дали 2116–2122. Круг в игре — максимум
с небольшим запасом, 2110 (`CYCLE_BOARDS` в `src/progress.js`).

Частота слова — среднее двух списков: субтитры знают разговорные слова
(«зевок»), wordfreq — книжные («коромысло»). Слова, которые выглядят
как другие слова («дал» — индийское блюдо и глагол), проверяются по падежным
формам. Имена мест, которые совпадают с редкими словами («россия» — кальмар),
перечислены в `scripts/proper-lookalikes.txt`.

Два яруса: частые слова и редкие (`x: 1`, следующие 2600 по частоте).
На каждом поле ровно одно редкое слово — правило генератора, а не случайность.

Формат: массив `{ w, r, d, s, x }`, где `w` — слово, `r` — место в очереди
(меньше = чаще встречается), `d` — до трёх толкований, `s` — слово с ударением,
`x` — редкое слово.

Что отсекается: имена и топонимы, падежные формы, слова короче 3
и длиннее 10 букв, устаревшие, жаргонные, просторечные и бранные значения.

Толкования взяты из Викисловаря и распространяются на условиях CC BY-SA 4.0.
Частоты: FrequencyWords (Hermit Dave, OpenSubtitles 2018) и wordfreq
(Robyn Speer, https://doi.org/10.5281/zenodo.7199437), CC BY-SA 4.0.
Все источники разрешают коммерческое использование при указании авторства;
файлы словаря, производные от них, распространяются на тех же условиях.

## Тесты

```
npm test
```
