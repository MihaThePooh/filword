// Offline readiness is independent of the browser's shortcut/install event.
let state = { phase: 'loading', completed: 0, total: 0 };
const listeners = new Set();
let registration;
let started = false;
function publish(next) {
  state = next;
  listeners.forEach(listener => listener(state));
}
async function inspect() {
  const active = registration?.active;
  if (!active) return;
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); resolve(); }, 4000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close(); publish(event.data); resolve();
    };
    active.postMessage({ type: 'offline-status' }, [channel.port2]);
  });
}
function watch(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'activated') inspect();
    if (worker.state === 'redundant' && state.phase !== 'ready') publish({ ...state, phase: 'error' });
  });
}
export function offlineStatus(listener) {
  listeners.add(listener); listener(state);
}
export async function retryOffline() {
  publish({ phase: 'loading', completed: 0, total: 0 });
  try {
    registration = await navigator.serviceWorker.getRegistration('./');
    await inspect();
    registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));
    if (!registration.installing) await registration.update();
    await inspect();
  } catch { if (state.phase !== 'ready') publish({ ...state, phase: 'error' }); }
}
export function startOffline() {
  if (started) return;
  started = true;
  if (!('serviceWorker' in navigator)) { publish({ phase: 'unsupported' }); return; }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'offline-status') publish(event.data);
  });
  navigator.serviceWorker.addEventListener('controllerchange', inspect);
  window.addEventListener('online', () => { if (state.phase !== 'ready') retryOffline(); });
  retryOffline();
}
