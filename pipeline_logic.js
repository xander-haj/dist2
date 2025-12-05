/**
 * Pipeline Logic Module
 * Handles the interactive accordion/steps in pipelines.html.
 */
export function initPipelineLogic() {
  const steps = document.querySelectorAll('.pipeline-step');
  
  steps.forEach(step => {
    const header = step.querySelector('h3');
    const content = step.querySelector('.step-content');
    const icon = header.querySelector('i'); // Chevron

    header.addEventListener('click', () => {
      const isVisible = content.style.display === 'block';
      

      steps.forEach(s => {
        s.querySelector('.step-content').style.display = 'none';
        s.querySelector('i').style.transform = 'rotate(0deg)';
      });

      if (!isVisible) {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
      }
    });
  });
}
