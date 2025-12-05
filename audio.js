/**
 * Audio/TTS Module with Piper Support & Background Playback
 * * FEATURES:
 * - Uses Piper WASM for local neural TTS (requires /piper/ directory with models).
 * - Background Audio Support via MediaStreamDestination & <audio> hack.
 * - Playback Speed Control (0.5x - 3.0x).
 * - Media Session API integration for lock-screen controls.
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

// Configuration for Piper
// NOTE: You must place 'piper_worker.js', 'piper.wasm', and model files in /piper/
const PIPER_CONFIG = {
  workerUrl: './piper/piper_worker.js', 
  modelUrl: './piper/en_US-lessac-medium.onnx',
  modelConfigUrl: './piper/en_US-lessac-medium.onnx.json'
};

export function initAudio() {
  setupUIHandlers();
  setupBackgroundAudioHack(); // Crucial for mobile lock screen
}

export function setPlaybackSpeed(speed) {
  playbackRate = parseFloat(speed);
  // If we were using native AudioBufferSourceNodes directly, we'd update them here.
  // Since we process a queue, the next chunk will pick up the speed.
}

function setupBackgroundAudioHack() {
  // To keep audio alive in background on iOS/Android, we pipe WebAudio 
  // into an HTML <audio> element.
  backgroundAudioElem = new Audio();
  backgroundAudioElem.loop = true;
  backgroundAudioElem.autoplay = true;
  // Silent track to unlock audio on interaction if needed, 
  // but mostly we rely on srcObject later.
  backgroundAudioElem.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==';
  
  // Interaction listener to unlock AudioContext
  const unlockHandler = () => {
    if (!audioContext) {
      initAudioContext();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    if (backgroundAudioElem.paused) {
      backgroundAudioElem.play().catch(e => console.log("Background audio play error", e));
    }
    document.removeEventListener('click', unlockHandler);
    document.removeEventListener('touchstart', unlockHandler);
  };

  document.addEventListener('click', unlockHandler);
  document.addEventListener('touchstart', unlockHandler);
}

function initAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioCtor({ latencyHint: 'interactive' });
  
  // Create a destination that flows into the HTML Audio Element
  mediaStreamDest = audioContext.createMediaStreamDestination();
  backgroundAudioElem.srcObject = mediaStreamDest.stream;
  
  // Gain node for volume/mute control
  gainNode = audioContext.createGain();
  gainNode.connect(mediaStreamDest); // Connect graph to the stream
  
  initPiperWorker();
}

function initPiperWorker() {
  try {
    piperWorker = new Worker(PIPER_CONFIG.workerUrl);
    
    piperWorker.onmessage = function(event) {
      const { type, data } = event.data;
      if (type === 'pcm') {
        queueAudioChunk(data); // data is Float32Array or Int16Array
      } else if (type === 'done') {
        // End of utterance
      } else if (type === 'error') {
        console.error('Piper Worker Error:', data);
      }
    };

    // Initialize Piper with Model
    piperWorker.postMessage({
      type: 'init',
      model: PIPER_CONFIG.modelUrl,
      config: PIPER_CONFIG.modelConfigUrl
    });

  } catch (e) {
    console.warn("Piper Worker failed to initialize. Ensure files exist in /piper/", e);
  }
}

/**
 * Main function to speak text
 */
export function speakText(text) {
  if (!text) return;

  // Cancel current
  stopAudio();
  
  // Ensure context is running
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Update Media Session Metadata
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

  // Send text to worker
  if (piperWorker) {
    isPlaying = true;
    updatePlayIcons(true);
    piperWorker.postMessage({ type: 'speak', text: text });
  } else {
    console.warn("Piper not ready. Fallback to Synthesis not implemented to strictly follow Piper request.");
  }
}

function queueAudioChunk(pcmData) {
  if (!audioContext) return;

  // Piper usually outputs 16-bit mono PCM at 22050Hz (dependent on model)
  // We need to convert to Float32 AudioBuffer
  
  const sampleRate = 22050; // Standard for Lessac model, adjust based on config
  const buffer = audioContext.createBuffer(1, pcmData.length, sampleRate);
  const channelData = buffer.getChannelData(0);

  // If data is Float32, copy. If Int16, convert.
  if (pcmData instanceof Float32Array) {
    channelData.set(pcmData);
  } else {
    // Int16 to Float32
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  source.connect(gainNode);

  // Simple scheduling: Play immediately or append to end
  // For a robust queue, we'd track `nextStartTime`
  // Here we just play as they arrive for streaming effect, assuming worker is fast enough
  // or simple sequencing.
  
  const currentTime = audioContext.currentTime;
  // A real implementation needs a proper scheduler to avoid gaps/overlaps
  // For simplicity in this demo, we assume chunks arrive in order and we rely on 'ended'.
  
  if (audioQueue.length > 0) {
     const lastNode = audioQueue[audioQueue.length - 1];
     // We can't easily query 'when it ends' on raw nodes without tracking duration
     // We'll stick to a simple strategy:
     // If this is a stream, we really need a ScriptProcessor or AudioWorklet, 
     // but sticking to BufferSourceNode is easier for compatibility.
  }
  
  // Track start times to ensure continuity would require a variable: nextTime
  // Let's implement a basic `nextTime` scheduler.
  
  if (typeof window.nextAudioTime === 'undefined' || window.nextAudioTime < currentTime) {
    window.nextAudioTime = currentTime;
  }

  source.start(window.nextAudioTime);
  window.nextAudioTime += buffer.duration / playbackRate;
  
  source.onended = () => {
    // Cleanup if needed
    const index = audioQueue.indexOf(source);
    if (index > -1) audioQueue.splice(index, 1);
    
    if (audioQueue.length === 0 && window.nextAudioTime <= audioContext.currentTime + 0.1) {
       isPlaying = false;
       updatePlayIcons(false);
       if ('mediaSession' in navigator) {
         navigator.mediaSession.playbackState = "none";
       }
    }
  };

  audioQueue.push(source);
}

export function stopAudio() {
  // Stop all sources
  audioQueue.forEach(source => {
    try { source.stop(); } catch(e) {}
  });
  audioQueue = [];
  
  if (piperWorker) {
    piperWorker.postMessage({ type: 'stop' });
  }
  
  window.nextAudioTime = audioContext ? audioContext.currentTime : 0;
  
  isPlaying = false;
  updatePlayIcons(false);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = "none";
  }
}

function setupUIHandlers() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tts-section-btn');
    if (btn) {
      const targetId = btn.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) speakText(el.innerText);
    }
    
    const playAll = e.target.closest('#play-all-btn');
    if (playAll) {
       // Just reading main content for simplicity
       const main = document.querySelector('.main-content');
       if (main) speakText(main.innerText);
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