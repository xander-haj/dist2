import { t } from './translations.js';

export function initEvalSimulator() {
  const btn = document.getElementById('eval-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const teacherScore = parseFloat(document.getElementById('eval-teacher').value);
    const ratio = parseFloat(document.getElementById('eval-ratio').value);
    const resultDiv = document.getElementById('eval-result');

    // Logic: Simple retention curve approximation
    const retention = 1 - (0.3 * (1 - ratio));
    const distilledScore = (teacherScore * retention).toFixed(1);
    const baselineScore = (teacherScore * (retention - 0.1)).toFixed(1);

    // Clear previous results safely
    while (resultDiv.firstChild) {
        resultDiv.removeChild(resultDiv.firstChild);
    }

    // Create Result Element (Distilled)
    // Structure: <p>Label <span class="accent">{score}</span></p>
    const pDistilled = document.createElement('p');
    pDistilled.textContent = t('eval_logic.result_label') + ' ';
    
    const spanScore = document.createElement('span');
    spanScore.style.color = 'var(--color-accent)';
    spanScore.style.fontWeight = 'bold';
    spanScore.textContent = distilledScore;
    
    pDistilled.appendChild(spanScore);
    resultDiv.appendChild(pDistilled);

    // Create Baseline Element
    // Structure: <p><small class="muted">Label {base}</small></p>
    const pBase = document.createElement('p');
    const smallBase = document.createElement('small');
    smallBase.style.color = 'var(--color-text-muted)';
    smallBase.textContent = `${t('eval_logic.base_label')} ${baselineScore}`;
    
    pBase.appendChild(smallBase);
    resultDiv.appendChild(pBase);
  });
}