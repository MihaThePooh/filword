// Board time: a stopwatch that runs only while the board is in play and the
// game is on screen (the page hides it - the clock pauses). Pure: the time
// source is injected, so it can be tested without a browser.
//
// lap() and pause() return how much ran since the last call, so the caller can
// add exactly that to the lifetime «Время на полях» - nothing counted twice.

export function createClock(now = () => performance.now()) {
  let base = 0; // ms already folded in
  let since = null; // when the current run started; null - paused
  const fold = () => {
    if (since === null) return 0;
    const t = now();
    const ran = t - since;
    base += ran;
    since = t;
    return ran;
  };
  return {
    start() { if (since === null) since = now(); },
    lap: fold,
    pause() {
      const ran = fold();
      since = null;
      return ran;
    },
    elapsed: () => base + (since === null ? 0 : now() - since),
    reset(ms = 0) {
      base = ms > 0 ? ms : 0;
      since = null;
    },
    running: () => since !== null,
  };
}

const pad = (v) => String(v).padStart(2, '0');

// 3:07, 1:02:09 - a board's time.
export function fmtClock(ms) {
  // Whole seconds, cut down like a stopwatch - the same as fmtSpan.
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// 4,2 с under a minute (pauses between words are often short), else 3:07.
export function fmtGap(ms) {
  if (ms < 60000) return `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')} с`;
  return fmtClock(ms);
}

// 45 с, 14 мин, 3 ч 05 мин - total time.
export function fmtSpan(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} с`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${pad(min % 60)} мин`;
}
