// Theme-Persistenz über localStorage
(function () {
  const saved = localStorage.getItem('cb-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateIcon(saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cb-theme', next);
  updateIcon(next);
}

function updateIcon(theme) {
  const el = document.getElementById('theme-icon');
  if (el) el.textContent = theme === 'dark' ? '☀️' : '🌙';
}
