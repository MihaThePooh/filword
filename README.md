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

Скачать и собрать:

```
curl -L -o raw/ru.jsonl.gz https://kaikki.org/ruwiktionary/raw-wiktextract-data.jsonl.gz
curl -L -o raw/ru_full.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_full.txt
npm run build:dict
```

Формат: массив `{ w, r, d }`, где `w` — слово, `r` — место в частотном
списке (меньше = чаще встречается), `d` — до трёх толкований.

Что отсекается: имена и топонимы, падежные формы, слова короче 3
и длиннее 10 букв, устаревшие, жаргонные, просторечные и бранные значения.

Толкования взяты из Викисловаря и распространяются на условиях CC BY-SA 4.0.

## Тесты

```
npm test
```
