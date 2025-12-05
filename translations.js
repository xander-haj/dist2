/**
 * Translations Module
 * Handles loading language files, switching languages, and updating the DOM.
 */

let currentLang = 'en';
let translations = {};

export async function initTranslations() {
  const savedLang = localStorage.getItem('distill-lang');
  const browserLang = navigator.language.slice(0, 2);
  
  if (savedLang) {
    currentLang = savedLang;
  } else if (['en', 'zh', 'ar'].includes(browserLang)) {
    currentLang = browserLang;
  }

  await loadLanguage(currentLang);
  setupLanguageSelector();
}

export async function loadLanguage(lang) {
  try {



    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    const response = await fetch(`${lang}.json`);
    if (!response.ok) throw new Error(`Could not load ${lang}.json`);
    translations = await response.json();
    currentLang = lang;
    

    localStorage.setItem('distill-lang', lang);
    

    document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }

    updateDOM();
    

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
    
  } catch (e) {
    console.error('Translation load error:', e);
  }
}

function updateDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = getNestedValue(translations, key);
    if (val) el.innerText = val;
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const val = getNestedValue(translations, key);
    if (val) el.innerHTML = val;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = getNestedValue(translations, key);
    if (val) el.placeholder = val;
  });
  

  const selector = document.getElementById('lang-select');
  if (selector) selector.value = currentLang;
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setupLanguageSelector() {
  const selector = document.getElementById('lang-select');
  if (selector) {

    selector.removeEventListener('change', handleLangChange);
    selector.addEventListener('change', handleLangChange);
    selector.value = currentLang;
  }
}

function handleLangChange(e) {
    loadLanguage(e.target.value);
}

export function t(key) {
  return getNestedValue(translations, key) || key;
}
