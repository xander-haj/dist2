/**
 * Audio/TTS Module with Piper Support, Background Playback & Visual Feedback
 * FEATURES:
 * - Real-time Model Download Progress (Numerical %).
 * - Button State Management (Disabled until Ready).
 * - Visual "Processing" feedback on click.
 * - Background Audio Support via MediaStreamDestination.
 * - Playback Speed Control.
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

// Configuration for Piper
const PIPER_CONFIG = {
  workerUrl: './piper/piper_worker.js', 
  modelUrl: './piper/en_US-lessac-medium.onnx',
  modelConfigUrl: './piper/en_US-lessac-medium.onnx.json'
};

export function initAudio() {
  setupUIHandlers();
  setupBackgroundAudioHack(); 
  disableAllButtons(true); // Disable until model loads
  initPiperWithProgress();
}

export function setPlaybackSpeed(speed) {
  playbackRate = parseFloat(speed);
}

/**
 * Manages the download of Piper models with numerical progress updates.
 */
async function initPiperWithProgress() {
  const playAllBtn = document.getElementById('play-all-btn');
  const updateProgress = (pct) => {
    if (playAllBtn) {
      // Find the text span or replace content safely
      const span = playAllBtn.querySelector('span');
      if (span) span.textContent = `${t('nav.loading_model')} ${pct}%`;
    }
  };

  try {
    updateProgress(0);

    // 1. Fetch Model (ONNX)
    const modelBlob = await fetchWithProgress(PIPER_CONFIG.modelUrl, (loaded, total) => {
      // Model is ~90% of the weight
      const pct = Math.round((loaded / total) * 90);
      updateProgress(pct);
    });

    // 2. Fetch Config (JSON)
    const configBlob = await fetchWithProgress(PIPER_CONFIG.modelConfigUrl, (loaded, total) => {
      // Config is small, represents last 10%
      const pct = 90 + Math.round((loaded / total) * 10);
      updateProgress(pct);
    });

    // 3. Initialize Worker with Blob URLs
    const modelUrl = URL.createObjectURL(modelBlob);
    const configUrl = URL.createObjectURL(configBlob);

    initWorker(modelUrl, configUrl);

  } catch (e) {
    console.error("Model Load Failed", e);
    if (playAllBtn) {
        const span = playAllBtn.querySelector('span');
        if(span) span.textContent = "Load Error";
    }
  }
}

function fetchWithProgress(url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) resolve(xhr.response);
      else reject(new Error(`Fetch failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send();
  });
}

function initWorker(modelBlobUrl, configBlobUrl) {
  try {
    piperWorker = new Worker(PIPER_CONFIG.workerUrl);
    
    piperWorker.onmessage = function(event) {
      const { type, data } = event.data;
      if (type === 'pcm') {
        // Audio Data Received
        handleAudioChunk(data);
      } else if (type === 'done') {
        // Utterance Complete
      } else if (type === 'ready') {
        // Worker is ready
        onModelReady();
      } else if (type === 'error') {
        console.error('Piper Worker Error:', data);
      }
    };

    piperWorker.postMessage({
      type: 'init',
      model: modelBlobUrl,
      config: configBlobUrl
    });
    
    // Some workers don't send explicit 'ready', so we might assume ready after init post
    // But standard piper usually confirms. If not, we can force ready state here:
    // onModelReady(); // Uncomment if your worker is silent on init

  } catch (e) {
    console.warn("Piper Worker failed.", e);
  }
}

function onModelReady() {
  isModelReady = true;
  disableAllButtons(false);
  
  // Reset Play All Button Text
  const playAllBtn = document.getElementById('play-all-btn');
  if (playAllBtn) {
    const span = playAllBtn.querySelector('span');
    if(span) span.textContent = t('nav.play_all_label');
    playAllBtn.classList.remove('loading');
  }
}

function setupBackgroundAudioHack() {
  backgroundAudioElem = new Audio();
  backgroundAudioElem.loop = true;
  backgroundAudioElem.autoplay = true;
  // Silent wav
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

// Track the currently active button to show visual feedback
let activeBtnElement = null;

export function speakText(text, sourceBtn = null) {
  if (!text || !isModelReady) return;

  stopAudio();
  
  // Visual Feedback: Set Processing State
  if (sourceBtn) {
    activeBtnElement = sourceBtn;
    setButtonState(sourceBtn, 'processing');
  }

  if (audioContext?.state === 'suspended') audioContext.resume();

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Distill.Lab TTS",
      artist: "Piper Neural Model",
      album: "Course Audio"
    });
    navigator.mediaSession.playbackState = "playing";
    navigator.mediaSession.setActionHandler('stop', stopAudio);
    navigator.mediaSession.setActionHandler('pause', stopAudio);
  }

  if (piperWorker) {
    isPlaying = true;
    piperWorker.postMessage({ type: 'speak', text: text });
  }
}

function handleAudioChunk(pcmData) {
  if (!audioContext) return;
  
  // Received audio means processing is done, we are now playing
  if (activeBtnElement && activeBtnElement.dataset.state === 'processing') {
    setButtonState(activeBtnElement, 'playing');
  }
  updatePlayIcons(true); // Ensure Play All is active if needed

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

/**
 * UI Helpers
 */

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
  // Reset
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
      // Section buttons (Icons)
      // We assume lucide icons are present. 
      // We can swap the inner SVG or add a class for CSS animation.
      if (state === 'processing') {
          btn.innerHTML = '...'; // Simple visual for "busy"
      } else if (state === 'playing') {
          // Keep default icon but add active class
          if(window.lucide) {
              btn.innerHTML = '<i data-lucide="volume-2"></i>';
              window.lucide.createIcons();
          }
          btn.classList.add('active');
      } else {
          // Reset
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