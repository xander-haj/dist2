/**
 * Theme Toggle Logic
 * Handles light/dark mode switching and persistence.
 */
export function initTheme() {
  const themeBtns = document.querySelectorAll('.theme-toggle-btn');
  const savedTheme = localStorage.getItem('distill-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateIcons(true);
  }

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('distill-theme', newTheme);
      
      updateIcons(newTheme === 'dark');
    });
  });
}

function updateIcons(isDark) {
  const icons = document.querySelectorAll('.theme-toggle-btn i');
  icons.forEach(icon => {




  });
}
