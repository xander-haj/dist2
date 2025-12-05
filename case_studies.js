import { t } from './translations.js';

export function initSimulator() {
  const runBtn = document.getElementById('sim-run-btn');
  if (!runBtn) return;

  runBtn.addEventListener('click', () => {
    const device = document.getElementById('sim-device').value;
    const task = document.getElementById('sim-task').value;
    const outDiv = document.getElementById('sim-output');
    const outTitle = document.getElementById('sim-title');
    const outDesc = document.getElementById('sim-desc');
    const outList = document.getElementById('sim-details');

    let titleKey, descKey, stepsKeys;

    if (device === 'mobile') {
      if (task === 'coding') {
        titleKey = "simulator.m_code_title";
        descKey = "simulator.m_code_desc";
        stepsKeys = ["simulator.m_code_s1", "simulator.m_code_s2"];
      } else {
        titleKey = "simulator.m_gen_title";
        descKey = "simulator.m_gen_desc";
        stepsKeys = ["simulator.m_gen_s1", "simulator.m_gen_s2"];
      }
    } else if (device === 'laptop') {
        titleKey = "simulator.l_title";
        descKey = "simulator.l_desc";
        stepsKeys = ["simulator.l_s1", "simulator.l_s2"];
    } else {
        titleKey = "simulator.d_title";
        descKey = "simulator.d_desc";
        stepsKeys = ["simulator.d_s1", "simulator.d_s2", "simulator.d_s3"];
    }

    outTitle.innerText = t(titleKey);
    outDesc.innerText = t(descKey);
    outList.innerHTML = stepsKeys.map(k => `<li>${t(k)}</li>`).join('');
    outDiv.style.display = 'block';
  });
}
