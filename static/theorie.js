// ─── Theorie-Overlay ─────────────────────────────────────────────────────────
// Fügt einen "📖 Theorie"-Button ein und öffnet ein Modal mit der Kurzerklärung.
// Inhalt kommt aus static/theorie.html (per fetch geladen, ein Mal gecached).

(function () {
  let cachedHTML = null;
  let overlayEl  = null;

  function ensureButton() {
    if (document.getElementById('theorie-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'theorie-fab';
    btn.className = 'theorie-fab';
    btn.type = 'button';
    btn.innerHTML = '<span>📖</span><span>Theorie</span>';
    btn.title = 'Kurzerklärung der Schwachstelle';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'theorie-overlay';
    overlayEl.id = 'theorie-overlay';
    overlayEl.innerHTML = `
      <div class="theorie-modal" role="dialog" aria-labelledby="theorie-title">
        <button class="theorie-close" type="button" aria-label="Schließen">×</button>
        <h2 id="theorie-title">Theorie: Wie funktioniert CurveBall?</h2>
        <div id="theorie-body">
          <p style="color:var(--text-muted); font-size:.9rem;">Lade…</p>
        </div>
      </div>`;

    // Close-Handler
    overlayEl.querySelector('.theorie-close').addEventListener('click', closeModal);
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closeModal();  // Klick auf Backdrop
    });

    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  async function loadContent() {
    if (cachedHTML) return cachedHTML;
    try {
      const res = await fetch('static/theorie.html');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      cachedHTML = await res.text();
      return cachedHTML;
    } catch (err) {
      return `<p style="color:var(--error);">
        Theorie-Inhalt konnte nicht geladen werden (${err.message}).
        Bitte prüfe, dass <code>static/theorie.html</code> ausgeliefert wird.
      </p>`;
    }
  }

  async function openModal() {
    const overlay = ensureOverlay();
    const body    = overlay.querySelector('#theorie-body');
    body.innerHTML = await loadContent();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ESC-Taste schließt
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('open')) {
      closeModal();
    }
  });

  // Init nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton);
  } else {
    ensureButton();
  }
})();
