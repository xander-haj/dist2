/**
 * Audio/TTS Module - Powered by @mintplex-labs/piper-tts-web
 * FEATURES:
 * - Uses CDN-hosted library (No local binary files required).
 * - Caches voice models in browser storage (OPFS).
 * - Native HTML5 Audio element for robust mobile background playback.
 * - Numerical progress for Model Download.
 * - Visual feedback during Audio Generation.
 */
import * as tts from 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm';
import { t } from './translations.js';

// Configuration
const VOICE_ID = 'en_US-amy-medium'; // High quality, reliable voice
let isEngineReady = false;
let playbackRate = 1.0;
let activeBtnElement = null; // Track which button triggered audio

// Create a persistent Audio element for the DOM
// This is crucial for iOS/Android lock screen playback
const audioEl = document.createElement('audio');
audioEl.id = 'piper-audio-element';
audioEl.playsInline = true; 
document.body.appendChild(audioEl);

export function initAudio() {
  disableAllButtons(true);
  initPiperEngine();
  setupUIHandlers();
}

export function setPlaybackSpeed(speed) {
  playbackRate = parseFloat(speed);
  if (audioEl) {
    audioEl.playbackRate = playbackRate;
  }
}

/**
 * Initializes the Piper WASM engine and downloads the voice model.
 */
async function initPiperEngine() {
  const playAllBtn = document.getElementById('play-all-btn');
  const updateStatus = (text) => {
    if (playAllBtn) {
      const span = playAllBtn.querySelector('span');
      if (span) span.textContent = text;
    }
  };

  try {
    updateStatus(t('nav.loading_model') + " 0%");

    // Check if voice is already cached
    const storedVoices = await tts.stored();
    const isStored = storedVoices.includes(VOICE_ID);

    if (!isStored) {
      // Download with progress callback
      await tts.download(VOICE_ID, (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        updateStatus(`${t('nav.loading_model')} ${percent}%`);
      });
    }

    isEngineReady = true;
    disableAllButtons(false);
    
    // Reset UI
    if (playAllBtn) {
      const span = playAllBtn.querySelector('span');
      if (span) span.textContent = t('nav.play_all_label');
      playAllBtn.classList.remove('loading');
    }

    // Initialize Media Session for Lock Screen
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => audioEl.play());
        navigator.mediaSession.setActionHandler('pause', () => audioEl.pause());
        navigator.mediaSession.setActionHandler('stop', stopAudio);
    }

  } catch (error) {
    console.error("Piper Init Error:", error);
    updateStatus("TTS Error");
    // Fallback?
    // In a real app, you might fall back to window.speechSynthesis here
  }
}

/**
 * Generates audio and plays it.
 */
export async function speakText(text, sourceBtn = null) {
  if (!text || !isEngineReady) return;

  // Stop any current playback
  stopAudio();

  // Update UI to "Generating" state
  if (sourceBtn) {
    activeBtnElement = sourceBtn;
    setButtonState(sourceBtn, 'processing');
  }

  try {
    // 1. Generate (Inference)
    // The library returns a Blob (WAV)
    const wavBlob = await tts.predict({
      text: text,
      voiceId: VOICE_ID,
    });

    // 2. Play
    const audioUrl = URL.createObjectURL(wavBlob);
    
    // Set Visual State to Playing
    if (activeBtnElement) {
        setButtonState(activeBtnElement, 'playing');
    }
    updatePlayIcons(true);

    audioEl.src = audioUrl;
    audioEl.playbackRate = playbackRate;
    
    // iOS requires a user interaction chain, which we have via the click event
    await audioEl.play();

    // Update Lock Screen Metadata
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: "Distill.Lab Audio",
            artist: "Piper Neural TTS",
            album: "Curriculum"
        });
        navigator.mediaSession.playbackState = "playing";
    }

    // Cleanup when done
    audioEl.onended = () => {
        onPlaybackEnd();
        URL.revokeObjectURL(audioUrl); // Free memory
    };

    audioEl.onerror = (e) => {
        console.error("Audio Playback Error", e);
        onPlaybackEnd();
    };

  } catch (err) {
    console.error("Generation Error:", err);
    onPlaybackEnd();
  }
}

export function stopAudio() {
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
    // We don't clear src immediately to avoid promise interruption errors if called rapidly
  }
  onPlaybackEnd();
}

function onPlaybackEnd() {
  updatePlayIcons(false);
  if (activeBtnElement) {
    setButtonState(activeBtnElement, 'idle');
    activeBtnElement = null;
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
}

/* --- UI HELPERS --- */

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
      // Icon Buttons
      if (state === 'processing') {
          // Spinner or dots
          btn.innerHTML = '<span style="font-weight:bold; font-size: 14px;">...</span>'; 
      } else if (state === 'playing') {
          if(window.lucide) {
              btn.innerHTML = '<i data-lucide="volume-2"></i>';
              window.lucide.createIcons();
          }
          btn.classList.add('active');
      } else {
          // Idle
          if(window.lucide) {
              btn.innerHTML = '<i data-lucide="volume-2"></i>';
              window.lucide.createIcons();
          }
          btn.classList.remove('active');
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
      // If processing, ignore click
      if (sectionBtn.dataset.state === 'processing') return;

      const targetId = sectionBtn.getAttribute('data-target');
      const el = document.getElementById(targetId);
      if (el) speakText(el.innerText, sectionBtn);
    }
    
    const playAll = e.target.closest('#play-all-btn');
    if (playAll) {
       if (playAll.dataset.state === 'playing') {
           stopAudio();
           return;
       }
       if (playAll.dataset.state === 'processing') return;

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