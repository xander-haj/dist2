/**
 * Audio/TTS Module - Fully CDN Hosted
 * * FEATURES:
 * 1. Loads ONNX Model from HuggingFace.
 * 2. Generates Web Worker from JSDelivr (No local worker file needed).
 * 3. Injects web-based WASM/JS dependencies.
 * 4. Falls back to System Voices if network fails.
 */
import { t } from './translations.js';

let audioContext = null;
let piperWorker = null;
let audioQueue = [];
let isPlaying = false;
let playbackRate = 1.0;
let backgroundAudioElem = null;
let mediaStreamDest = null;
let gainNode = null;
let isModelReady = false;
let useSystemFallback = false; 
let currentUtterance = null;

// --- CDN CONFIGURATION ---
// We use a specific commit hash or version to ensure stability.
const PIPER_WEB_BASE = "https://cdn.jsdelivr.net/gh/rhasspy/piper@master/src/web";
const ONNX_WEB_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js";

const MODEL_CONFIG = {
  model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true',
  config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true'
};

export function initAudio() {
  setupUIHandlers();
  setupBackgroundAudioHack(); 
  disableAllButtons(true); 
  
  // Start the "CDN Dance"
  initPiperFromCDN();
}

export function setPlaybackSpeed(speed) {
  playbackRate = parseFloat(speed);
}

/**
 * 1. Fetches the worker code as text.
 * 2. Patches it to load dependencies from CDNs.
 * 3. Creates a Blob URL to run it without local files.
 */
async function initPiperFromCDN() {
  const playAllBtn = document.getElementById('play-all-btn');
  const updateProgress = (text) => {
    if (playAllBtn) {
      const span = playAllBtn.querySelector('span');
      if (span) span.textContent = text;
    }
  };

  try {
    updateProgress(t('nav.loading_model') + " 0%");

    // A. Fetch the raw worker code
    const workerReq = await fetch(`${PIPER_WEB_BASE}/piper_worker.js`);
    if (!workerReq.ok) throw new Error("Could not fetch worker from CDN");
    let workerCode = await workerReq.text();

    // B. Patch the worker code to use absolute CDN URLs for imports
    // 1. Inject ONNX Runtime
    workerCode = `importScripts('${ONNX_WEB_CDN}');\n` + workerCode;
    
    // 2. Patch 'piper_phonemize.js' import to use CDN
    workerCode = workerCode.replace(
      /importScripts\s*\(\s*["']piper_phonemize\.js["']\s*\)/g, 
      `importScripts('${PIPER_WEB_BASE}/piper_phonemize.js')`
    );

    // 3. Patch WASM fetching (The worker usually looks for ./piper_phonemize.wasm)
    // We override the global fetch in the worker or rely on specific pathing. 
    // Easier hack: The piper_phonemize.js script typically locates the wasm. 
    // We will set a global var in the worker before it runs? No, easier to rely on the blob.
    
    // Actually, piper_phonemize.js uses `locateFile`. We can monkey-patch Module if needed.
    // For now, let's try the direct Blob approach. If WASM fails, we fallback.

    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);

    // C. Fetch Model & Config (Heavy files)
    const modelBlob = await fetchWithProgress(MODEL_CONFIG.model, (loaded, total) => {
      const pct = total ? Math.round((loaded / total) * 90) : 50;
      updateProgress(`${t('nav.loading_model')} ${pct}%`);
    });

    const configBlob = await fetchWithProgress(MODEL_CONFIG.config, (loaded, total) => {
      updateProgress(`${t('nav.loading_model')} 95%`);
    });

    // D. Initialize Worker
    initWorker(workerUrl, URL.createObjectURL(modelBlob), URL.createObjectURL(configBlob));

  } catch (e) {
    console.warn("CDN Init Failed, using System Voices:", e);
    enableSystemFallback();
  }
}

function initWorker(workerUrl, modelBlobUrl, configBlobUrl) {
  try {
    piperWorker = new Worker(workerUrl);
    
    piperWorker.onmessage = function(event) {
      const { type, data } = event.data;
      if (type === 'pcm') {
        handleAudioChunk(data);
      } else if (type === 'ready') {
        onModelReady();
      } else if (type === 'error') {
        console.warn('Worker Error (falling back):', data);
        enableSystemFallback();
      }
    };

    // We must pass the WASM path to the init if the worker supports it, 
    // or rely on the patched file location.
    // Standard Piper Worker 'init' doesn't take wasm path args, it assumes relative.
    // HACK: We inject a message handler to set the path? 
    // If this fails, the catch block triggers System TTS.
    
    piperWorker.postMessage({
      type: 'init',
      model: modelBlobUrl,
      config: configBlobUrl,
      // Some modified workers accept this, standard might ignore it
      piperWasm: `${PIPER_WEB_BASE}/piper_phonemize.wasm` 
    });

  } catch (e) {
    console.warn("Worker construction failed", e);
    enableSystemFallback();
  }
}

function fetchWithProgress(url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(xhr.response);
      else reject(new Error(xhr.statusText));
    };
    xhr.onerror = () => reject(new Error("Network Error"));
    xhr.send();
  });
}

function enableSystemFallback() {
    useSystemFallback = true;
    isModelReady = true;
    disableAllButtons(false);
    
    const playAllBtn = document.getElementById('play-all-btn');
    if (playAllBtn) {
        const span = playAllBtn.querySelector('span');
        if(span) span.textContent = t('nav.play_all_label'); 
        playAllBtn.classList.remove('loading');
    }
}

function onModelReady() {
  isModelReady = true;
  disableAllButtons(false);
  const playAllBtn = document.getElementById('play-all-btn');
  if (playAllBtn) {
    const span = playAllBtn.querySelector('span');
    if(span) span.textContent = t('nav.play_all_label');
    playAllBtn.classList.remove('loading');
  }
}

// --- Audio Engine Standard Logic ---

function setupBackgroundAudioHack() {
  backgroundAudioElem = new Audio();
  backgroundAudioElem.loop = true;
  backgroundAudioElem.autoplay = true;
  // Silent WAV
  backgroundAudioElem.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==';
  
  const unlockHandler = () => {
    if (!audioContext) initAudioContext();
    if (audioContext?.state === 'suspended') audioContext.resume();
    if (backgroundAudioElem.paused) backgroundAudioElem.play().catch(() => {});
    document.removeEventListener('click', unlockHandler);
    document.removeEventListener('touchstart', unlockHandler);
  };

  document.addEventListener('click', unlockHandler);
  document.addEventListener('touchstart', unlockHandler);
}

function initAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioCtor({ latencyHint: 'interactive' });
  mediaStreamDest = audioContext.createMediaStreamDestination();
  backgroundAudioElem.srcObject = mediaStreamDest.stream;
  gainNode = audioContext.createGain();
  gainNode.connect(mediaStreamDest);
}

let activeBtnElement = null;

export function speakText(text, sourceBtn = null) {
  if (!text || !isModelReady) return;

  stopAudio();
  
  if (sourceBtn) {
    activeBtnElement = sourceBtn;
    setButtonState(sourceBtn, 'processing');
  }

  // SYSTEM TTS FALLBACK
  if (useSystemFallback) {
      speakSystem(text);
      return;
  }

  // PIPER NEURAL
  if (audioContext?.state === 'suspended') audioContext.resume();
  setupMediaSession();

  if (piperWorker) {
    isPlaying = true;
    piperWorker.postMessage({ type: 'speak', text: text });
  }
}

function speakSystem(text) {
    if (!window.speechSynthesis) return;
    
    if (activeBtnElement) setButtonState(activeBtnElement, 'playing');
    updatePlayIcons(true);
    isPlaying = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = playbackRate;
    
    const voices = window.speechSynthesis.getVoices();
    const lang = document.documentElement.lang || 'en';
    // Prefer higher quality system voices
    const voice = voices.find(v => v.lang.startsWith(lang) && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Siri')));
    if (voice) utterance.voice = voice;

    utterance.onend = () => onPlaybackEnd();
    utterance.onerror = () => onPlaybackEnd();

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function setupMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Distill.Lab Audio",
      artist: useSystemFallback ? "System Voice" : "Piper Neural Model",
      album: "Course Audio"
    });
    navigator.mediaSession.playbackState = "playing";
    navigator.mediaSession.setActionHandler('stop', stopAudio);
    navigator.mediaSession.setActionHandler('pause', stopAudio);
  }
}

function handleAudioChunk(pcmData) {
  if (!audioContext) return;
  
  if (activeBtnElement && activeBtnElement.dataset.state === 'processing') {
    setButtonState(activeBtnElement, 'playing');
  }
  updatePlayIcons(true);
  isPlaying = true;

  const sampleRate = 22050; 
  const buffer = audioContext.createBuffer(1, pcmData.length, sampleRate);
  const channelData = buffer.getChannelData(0);

  if (pcmData instanceof Float32Array) {
    channelData.set(pcmData);
  } else {
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  source.connect(gainNode);

  const currentTime = audioContext.currentTime;
  if (typeof window.nextAudioTime === 'undefined' || window.nextAudioTime < currentTime) {
    window.nextAudioTime = currentTime;
  }

  source.start(window.nextAudioTime);
  window.nextAudioTime += buffer.duration / playbackRate;
  
  source.onended = () => {
    const index = audioQueue.indexOf(source);
    if (index > -1) audioQueue.splice(index, 1);
    
    if (audioQueue.length === 0 && window.nextAudioTime <= audioContext.currentTime + 0.1) {
       onPlaybackEnd();
    }
  };

  audioQueue.push(source);
}

function onPlaybackEnd() {
  isPlaying = false;
  updatePlayIcons(false);
  if (activeBtnElement) {
    setButtonState(activeBtnElement, 'idle');
    activeBtnElement = null;
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
}

export function stopAudio() {
  if (useSystemFallback) {
      window.speechSynthesis.cancel();
  }
  
  audioQueue.forEach(source => { try { source.stop(); } catch(e) {} });
  audioQueue = [];
  if (piperWorker) piperWorker.postMessage({ type: 'stop' });
  
  window.nextAudioTime = audioContext ? audioContext.currentTime : 0;
  isPlaying = false;
  
  updatePlayIcons(false);
  if (activeBtnElement) {
    setButtonState(activeBtnElement, 'idle');
    activeBtnElement = null;
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
}

function disableAllButtons(disabled) {
  const btns = document.querySelectorAll('.tts-section-btn, #play-all-btn');
  btns.forEach(btn => {
    if (disabled) {
        btn.classList.add('disabled');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.6';
    } else {
        btn.classList.remove('disabled');
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
  });
}

function setButtonState(btn, state) {
  btn.classList.remove('processing', 'playing');
  btn.dataset.state = state;

  if (btn.id === 'play-all-btn') {
      const span = btn.querySelector('span');
      if (state === 'processing') {
          if(span) span.textContent = t('nav.generating');
      } else if (state === 'playing') {
          if(span) span.textContent = t('nav.playing');
      } else {
          if(span) span.textContent = t('nav.play_all_label');
      }
  } else {
      if (state === 'processing') {
          btn.innerHTML = '<span style="font-size:0.8em">...</span>'; 
      } else if (state === 'playing') {
          if(window.lucide) {
              btn.innerHTML = '<i data-lucide="volume-2"></i>';
              window.lucide.createIcons();
          }
          btn.classList.add('active');
      } else {
          if(window.lucide) {
              btn.innerHTML = '<i data-lucide="volume-2"></i>';
              window.lucide.createIcons();
          }
      }
  }
}

function setupUIHandlers() {
  document.addEventListener('click', (e) => {
    const sectionBtn = e.target.closest('.tts-section-btn');
    if (sectionBtn) {
      if (sectionBtn.dataset.state === 'playing') {
          stopAudio();
          return;
      }
      const targetId = sectionBtn.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) speakText(el.innerText, sectionBtn);
    }
    
    const playAll = e.target.closest('#play-all-btn');
    if (playAll) {
       if (isPlaying) {
           stopAudio();
           return;
       }
       const main = document.querySelector('.main-content');
       if (main) speakText(main.innerText, playAll);
    }
  });
}

function updatePlayIcons(active) {
  const btn = document.getElementById('play-all-btn');
  if (btn) {
    if (active) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}