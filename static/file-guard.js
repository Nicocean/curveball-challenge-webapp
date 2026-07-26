// ─── file:// Guard ───────────────────────────────────────────────────────────
// Erkennt, ob die Seite per Doppelklick als file:// geöffnet wurde.
// In dem Fall funktionieren relative Links nicht, weil der Server umgangen wird.
// Wir zeigen dann einen deutlichen Banner mit Anleitung.

(function () {
  if (window.location.protocol !== 'file:') return;

  const banner = document.createElement('div');
  banner.setAttribute('style', [
    'position:fixed', 'inset:0',
    'background:#1e1e1e', 'color:#f2f2f2',
    'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:2rem',
    'font-family:system-ui, sans-serif',
    'font-size:1rem', 'line-height:1.6',
  ].join(';'));

  banner.innerHTML = `
    <div style="max-width:640px; background:#2a2a2a; border-radius:12px;
                padding:2rem 2.4rem; border:1px solid #444;">
      <h1 style="margin:0 0 1rem; color:#f5a623; font-size:1.4rem;">
        ⚠️ Diese Seite muss über den Webserver geöffnet werden
      </h1>
      <p>
        Du hast diese Datei per Doppelklick geöffnet
        (<code style="background:#111; padding:2px 6px; border-radius:4px;">file://</code>).
        Damit funktionieren die Verlinkungen und das Design nicht richtig.
      </p>
      <p>So startest du korrekt:</p>
      <ol style="padding-left:1.2rem;">
        <li><strong>Server starten:</strong>
            <code style="background:#111; padding:2px 6px; border-radius:4px;">python3 server.py</code>
        </li>
        <li>Im Browser <strong>manuell</strong> eintippen:
            <code style="background:#111; padding:2px 6px; border-radius:4px;">http://localhost:8080</code>
        </li>
      </ol>
      <p style="margin-top:1.4rem;">
        <a href="http://localhost:8080/" style="background:#4f8ef7; color:#fff;
           padding:.6rem 1.2rem; border-radius:6px; text-decoration:none; font-weight:600;">
           → Jetzt öffnen
        </a>
      </p>
    </div>`;

  document.body.appendChild(banner);
})();
