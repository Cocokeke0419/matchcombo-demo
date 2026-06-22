const SOUND_PATHS = {
  uiTap: "../assets/audio/sfx-ui-tap.wav",
  match: "../assets/audio/sfx-match.wav",
  cascade: "../assets/audio/sfx-cascade.wav",
  createPropeller: "../assets/audio/sfx-create-propeller.wav",
  createRocket: "../assets/audio/sfx-create-rocket.wav",
  createBomb: "../assets/audio/sfx-create-bomb.wav",
  createColorBall: "../assets/audio/sfx-create-color-ball.wav",
  propeller: "../assets/audio/sfx-propeller.wav",
  rocket: "../assets/audio/sfx-rocket.wav",
  bomb: "../assets/audio/sfx-bomb.wav",
  colorBall: "../assets/audio/sfx-color-ball.wav",
  attack: "../assets/audio/sfx-attack.wav",
  crate: "../assets/audio/sfx-crate.wav",
  win: "../assets/audio/sfx-win.wav",
  lose: "../assets/audio/sfx-lose.wav",
  draw: "../assets/audio/sfx-draw.wav",
};

let audioContext = null;
let preloadPromise = null;
const buffers = new Map();
const loading = new Map();

function soundUrl(path) {
  return new URL(path, import.meta.url).href;
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

async function loadSound(name) {
  if (buffers.has(name)) {
    return buffers.get(name);
  }

  if (loading.has(name)) {
    return loading.get(name);
  }

  const path = SOUND_PATHS[name];
  const context = getAudioContext();
  if (!path || !context || typeof fetch === "undefined") {
    return null;
  }

  const promise = fetch(soundUrl(path))
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((arrayBuffer) => (arrayBuffer ? context.decodeAudioData(arrayBuffer) : null))
    .then((buffer) => {
      if (buffer) {
        buffers.set(name, buffer);
      }
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      loading.delete(name);
    });

  loading.set(name, promise);
  return promise;
}

export async function primeAudio() {
  const context = getAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    await context.resume().catch(() => {});
  }

  if (!preloadPromise) {
    preloadPromise = Promise.all(Object.keys(SOUND_PATHS).map((name) => loadSound(name)));
  }

  return context.state === "running";
}

function startBuffer(buffer, options = {}) {
  const context = getAudioContext();
  if (!context || context.state !== "running" || !buffer) {
    return;
  }

  const {
    volume = 1,
    delay = 0,
    rate = 1,
    rateJitter = 0,
  } = options;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const jitter = rateJitter ? 1 + (Math.random() * 2 - 1) * rateJitter : 1;
  const startAt = context.currentTime + delay;

  source.buffer = buffer;
  source.playbackRate.setValueAtTime(Math.max(0.25, rate * jitter), startAt);
  gain.gain.setValueAtTime(Math.max(0, volume), startAt);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(startAt);
}

export function playSound(name, options = {}) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    void context.resume().then(() => playSound(name, options));
    return;
  }

  if (context.state !== "running") {
    return;
  }

  const buffer = buffers.get(name);
  if (buffer) {
    startBuffer(buffer, options);
    return;
  }

  void loadSound(name).then((loadedBuffer) => {
    startBuffer(loadedBuffer, options);
  });
}
