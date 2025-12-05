/**
 * Navigation Logic Module
 * Handles active state, mobile menu toggling, language selector injection,
 * and dynamic Speed selector injection.
 */
import { initTranslations, t } from './translations.js';
import { initAudio, setPlaybackSpeed } from './audio.js';

const PAGES = [
  { id: 'home', file: 'index.html', label: 'Introduction' },
  { id: 'what_is', file: 'what_is_distillation.html', label: 'What is Distillation?' },
  { id: 'concepts', file: 'core_concepts.html', label: 'Core Concepts' },
  { id: 'vs', file: 'distillation_vs_compression.html', label: 'Distillation vs Compression' },
  { id: 'sizes', file: 'choosing_model_sizes.html', label: 'Target Model Sizes' },
  { id: 'data', file: 'data_for_distillation.html', label: 'Data Engineering' },
  { id: 'pipelines', file: 'pipelines.html', label: 'Distillation Pipelines' },
  { id: 'eval', file: 'evaluating_distilled_models.html', label: 'Evaluation' },
  { id: 'tradeoffs', file: 'practical_tradeoffs_case_studies.html', label: 'Tradeoffs & Cases' },
  { id: 'glossary', file: 'glossary.html', label: 'Glossary' }
];

export function initNavigation() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    }
  });

  const menuBtn = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && 
          !sidebar.contains(e.target) && 
          !menuBtn.contains(e.target) && 
          sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
      }
    });
  }

  const topBar = document.getElementById('top-bar');
  if (topBar) {
      // Speed Selector added
      const controlsHTML = `
        <select id="lang-select" class="tool-select" style="width: auto; padding: 0.4rem 1.0rem;" title="Select Language">
          <option value="en">English</option>
          <option value="zh">中文</option>
          <option value="ar">العربية</option>
        </select>

        <select id="speed-select" class="tool-select" style="width: auto; padding: 0.4rem 0.5rem;" title="Playback Speed">
          <option value="0.5">0.5x</option>
          <option value="0.8">0.8x</option>
          <option value="1.0" selected>1.0x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
          <option value="2.0">2.0x</option>
          <option value="2.5">2.5x</option>
          <option value="3.0">3.0x</option>
        </select>

        <button id="play-all-btn" class="btn-icon" title="Read Page">
            <i data-lucide="volume-2"></i>
            <span data-i18n="nav.play_all_label">Play</span>
        </button>
      `;
      topBar.innerHTML = controlsHTML;
      
      // Speed Handler
      const speedSelect = document.getElementById('speed-select');
      if (speedSelect) {
        speedSelect.addEventListener('change', (e) => {
          setPlaybackSpeed(e.target.value);
        });
      }
  }

  initTranslations();
  initAudio();

  const currentIndex = PAGES.findIndex(p => p.file === currentPath);
  const mainContent = document.querySelector('main');

  if (currentIndex !== -1 && mainContent && currentPath !== 'glossary.html') {
    const navContainer = document.createElement('div');
    navContainer.className = 'page-nav-buttons';

    const prevPage = currentIndex > 0 ? PAGES[currentIndex - 1] : null;
    const nextPage = currentIndex < PAGES.length - 1 && PAGES[currentIndex + 1].id !== 'glossary' ? PAGES[currentIndex + 1] : null;

    let html = '';
    if (prevPage) {
      html += `<a href="${prevPage.file}" class="nav-btn"><i data-lucide="arrow-left" class="rtl-flip"></i> <span data-i18n="nav.${prevPage.id}">${prevPage.label}</span></a>`;
    } else {
      html += `<span></span>`;
    }

    if (nextPage) {
      html += `<a href="${nextPage.file}" class="nav-btn"><span data-i18n="nav.${nextPage.id}">${nextPage.label}</span> <i data-lucide="arrow-right" class="rtl-flip"></i></a>`;
    }

    navContainer.innerHTML = html;
    mainContent.appendChild(navContainer);
    
    if (window.lucide) window.lucide.createIcons();
  }
}