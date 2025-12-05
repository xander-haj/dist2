export function initGlossarySearch() {
  const input = document.getElementById('glossary-search');
  const groups = document.querySelectorAll('.term-group');
  const noResults = document.getElementById('no-results');

  if (!input) return;

  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    let hasVisible = false;

    groups.forEach(group => {

      const text = group.innerText.toLowerCase();
      if (text.includes(query)) {
        group.style.display = 'block';
        hasVisible = true;
      } else {
        group.style.display = 'none';
      }
    });

    noResults.style.display = hasVisible ? 'none' : 'block';
  });
}
