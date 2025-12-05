import { t } from './translations.js';

export function initHardwareRecommender() {
  const btn = document.getElementById('hw-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const vram = parseInt(document.getElementById('hw-vram').value);
    const use = document.getElementById('hw-use').value;
    const resultDiv = document.getElementById('hw-result');
    const title = document.getElementById('rec-title');
    const text = document.getElementById('rec-text');

    resultDiv.style.display = 'block';


    let titleKey, textKey;

    if (vram < 6) {
      titleKey = "recommender.r1_title";
      textKey = "recommender.r1_text";
    } else if (vram < 10) {
      if (use === 'code') {
        titleKey = "recommender.r2_code_title";
        textKey = "recommender.r2_code_text";
      } else {
        titleKey = "recommender.r2_std_title";
        textKey = "recommender.r2_std_text";
      }
    } else if (vram < 20) {
      titleKey = "recommender.r3_title";
      textKey = "recommender.r3_text";
    } else {
      titleKey = "recommender.r4_title";
      textKey = "recommender.r4_text";
    }


    title.innerText = t(titleKey);
    text.innerText = t(textKey);
  });
}
