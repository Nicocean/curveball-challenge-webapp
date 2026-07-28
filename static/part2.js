/* ═══════════════════════════════════════════════════════════════════════════
   Teil 2 — Setup-Landing + One-Step-View + Stepper + Streng-Hybrid-Validierung
   ─────────────────────────────────────────────────────────────────────────── */

const TOTAL_STEPS = 7;
const state = {
  current: 1,
  attempts: {},       // { 1: 0, 2: 0, ... }
  cleanSolves: 0,     // Schritte ohne Fehlversuch UND ohne "Lösung zeigen"
  revealed: {},       // { 1: true, ... } — Lösung wurde offengelegt
  verified: {},       // { 1: true, ... } — Prüfung erfolgreich, Button steht auf "Weiter →"
  optionalDone: false // Bonus-Aufgabe (Nachrechnen) korrekt gelöst?
};

/* ─── Solutions ─────────────────────────────────────────────────────────── */
/*
   Neue Nummerierung (7 Pflichtschritte):
     1 = Zertifikat  (radio)
     2 = Idee        (match)
     3 = Angriff     (order)
     4 = Fake-CA     (radio)
     5 = Code-Sign   (radio)
     6 = EV-Cert     (radio)
     7 = Leitung     (radio)
   Bonus (optional, nicht Teil der SOLUTIONS-Map):
     Nachrechnen · k · k⁻¹ mod n = 1
*/
const SOLUTIONS = {
  1: { type: 'radio',  correct: 'a' },
  2: { type: 'match',  correct: { a: 'inv', b: 'point', c: 'mul', d: 'ret' } },
  3: { type: 'order',  correct: { load: '1', k: '2', gprime: '3', sign: '4' } },
  4: { type: 'radio',  correct: 'c' },
  5: { type: 'radio',  correct: 'a' },
  6: { type: 'radio',  correct: 'a' },
  7: { type: 'radio',  correct: 'b' },
};

const OPTIONAL_ANSWERS = ['1'];

/* ─── Init ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  for (let i = 1; i <= TOTAL_STEPS; i++) state.attempts[i] = 0;
  // Setup-Card ist initial sichtbar, Steps sind komplett hidden bis startSteps().
  initDnD();          // Drag-and-Drop für Schritt 3
  renderStepper();
});

/* ─── Setup → Steps ────────────────────────────────────────────────────── */
function startSteps() {
  const setup = document.getElementById('setupCard');
  const wrap = document.getElementById('stepsWrapper');
  if (setup) setup.hidden = true;
  if (wrap) wrap.hidden = false;
  showStep(1);
}

/* ─── Stepper ──────────────────────────────────────────────────────────── */
function renderStepper() {
  const fill = document.getElementById('stepperFill');
  const nodes = document.querySelectorAll('.stepper-node');
  const done = state.current - 1;
  const pct = (done / (TOTAL_STEPS - 1)) * 100;
  if (fill) {
    fill.style.setProperty('--fill', pct + '%');
    fill.classList.remove('complete');
  }

  nodes.forEach(n => {
    const s = parseInt(n.dataset.step, 10);
    n.classList.remove('active', 'done');
    if (s < state.current) n.classList.add('done');
    if (s === state.current) n.classList.add('active');
  });

  const stepper = document.getElementById('stepper');
  if (stepper) stepper.setAttribute('aria-valuenow', state.current);
}

/* ─── Step-View ────────────────────────────────────────────────────────── */
function showStep(n) {
  document.querySelectorAll('.step-card').forEach(c => c.hidden = true);
  const target = document.querySelector(`.step-card[data-step="${n}"]`);
  if (target) {
    target.hidden = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  state.current = (n === 'finale') ? TOTAL_STEPS : n;
  renderStepper();
}

/* ─── Hint-Toggle ──────────────────────────────────────────────────────── */
function toggleHint(step) {
  const h = document.getElementById('hint-' + step);
  if (h) h.hidden = !h.hidden;
}

/* ─── Validation Dispatch ──────────────────────────────────────────────── */
/*
   Zwei-Phasen-Button:
     1. Klick: "Prüfen"  → validiert. Bei korrekt: Button wird grün + Label "Weiter →".
     2. Klick: "Weiter" → advanceFrom(step) zum nächsten Schritt.
*/
function validateAndNext(step) {
  // Phase 2: bereits geprüft & richtig → jetzt weiter
  if (state.verified[step]) {
    advanceFrom(step);
    return;
  }

  const sol = SOLUTIONS[step];
  let ok = false;

  if (sol.type === 'radio')      ok = validateRadio(step, sol.correct);
  else if (sol.type === 'match') ok = validateMatch(step, sol.correct);
  else if (sol.type === 'text')  ok = validateText(step, sol.correct);
  else if (sol.type === 'order') ok = validateOrder(step, sol.correct);

  const fb = document.getElementById('fb-' + step);
  const att = document.getElementById('att-' + step);
  const solveBtn = document.getElementById('solve-' + step);

  if (ok) {
    if (fb) { fb.textContent = '✓ Richtig! Klicke „Weiter →" für den nächsten Schritt.'; fb.className = 'task-feedback ok'; }
    if (state.attempts[step] === 0 && !state.revealed[step]) state.cleanSolves++;
    lockStep(step);
    markVerified(step);
  } else {
    state.attempts[step]++;
    if (fb) { fb.textContent = '✗ Nicht ganz — probiere es nochmal.'; fb.className = 'task-feedback err'; }
    if (att) att.textContent = `${state.attempts[step]} Fehlversuch${state.attempts[step] === 1 ? '' : 'e'}`;
    if (state.attempts[step] >= 3 && solveBtn) solveBtn.hidden = false;
  }
}

function markVerified(step) {
  state.verified[step] = true;
  const btn = document.getElementById('next-' + step);
  if (!btn) return;
  btn.classList.add('btn-verified');
  btn.disabled = false;
  // Letzter Schritt behält "Abschließen →", alle anderen werden zu "Weiter →"
  if (step < TOTAL_STEPS) btn.innerHTML = 'Weiter →';
  else btn.innerHTML = 'Abschließen →';
}

/* ─── Validators ───────────────────────────────────────────────────────── */
function validateRadio(step, correct) {
  const card = document.querySelector(`.step-card[data-step="${step}"]`);
  const chosen = card.querySelector(`input[name="s${step}"]:checked`);
  if (!chosen) {
    const fb = document.getElementById('fb-' + step);
    if (fb) { fb.textContent = 'Bitte eine Antwort auswählen.'; fb.className = 'task-feedback warn'; }
    return false;
  }
  card.querySelectorAll('.option-label').forEach(l => l.classList.remove('was-correct', 'was-wrong'));
  if (chosen.value === correct) {
    chosen.closest('.option-label').classList.add('was-correct');
    return true;
  }
  chosen.closest('.option-label').classList.add('was-wrong');
  return false;
}

function validateMatch(step, correct) {
  const card = document.querySelector(`.step-card[data-step="${step}"]`);
  const rows = card.querySelectorAll('.match-row');
  let allOk = true;
  rows.forEach(r => {
    const key = r.querySelector('.match-select').dataset.key;
    const val = r.querySelector('.match-select').value;
    r.classList.remove('row-correct', 'row-wrong');
    if (!val) { allOk = false; r.classList.add('row-wrong'); return; }
    if (val === correct[key]) r.classList.add('row-correct');
    else { r.classList.add('row-wrong'); allOk = false; }
  });
  return allOk;
}

function validateText(step, correctArr) {
  const input = document.getElementById(`s${step}-input`);
  if (!input) return false;
  input.classList.remove('input-ok', 'input-err');
  const raw = input.value.trim().toLowerCase();
  if (!raw) {
    const fb = document.getElementById('fb-' + step);
    if (fb) { fb.textContent = 'Bitte einen Wert eingeben.'; fb.className = 'task-feedback warn'; }
    return false;
  }
  const ok = correctArr.map(s => s.toLowerCase()).includes(raw);
  input.classList.add(ok ? 'input-ok' : 'input-err');
  return ok;
}

function validateOrder(step, correct) {
  const card = document.querySelector(`.step-card[data-step="${step}"]`);
  const list = card.querySelector('.dnd-list');
  if (!list) return false;
  const items = Array.from(list.querySelectorAll('.dnd-item'));
  let allOk = true;
  items.forEach((it, idx) => {
    const key = it.dataset.key;
    const pos = String(idx + 1);
    it.classList.remove('row-correct', 'row-wrong');
    if (correct[key] === pos) it.classList.add('row-correct');
    else { it.classList.add('row-wrong'); allOk = false; }
  });
  return allOk;
}

/* ─── Drag-and-Drop für Reihenfolge-Aufgaben ──────────────────── */
function initDnD() {
  document.querySelectorAll('.dnd-list').forEach(list => {
    // Initial: mischen (Fisher-Yates), damit die Aufgabe nicht schon fertig ist
    const items = Array.from(list.children);
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      list.insertBefore(items[j], items[i]);
      items[i] = items[j];
    }
    // Falls Zufall bereits die Loesung ergibt → einen Item-Swap
    const keys = Array.from(list.children).map(el => el.dataset.key);
    if (keys.join(',') === 'load,k,gprime,sign') {
      list.insertBefore(list.children[3], list.children[0]);
    }
    updateDnDNumbers(list);

    list.querySelectorAll('.dnd-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.key);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        updateDnDNumbers(list);
      });
    });

    list.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      if (!dragging) return;
      const after = getDragAfter(list, e.clientY);
      if (after == null) list.appendChild(dragging);
      else list.insertBefore(dragging, after);
    });
  });
}

function getDragAfter(list, y) {
  const items = Array.from(list.querySelectorAll('.dnd-item:not(.dragging)'));
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function updateDnDNumbers(list) {
  list.querySelectorAll('.dnd-item').forEach((it, idx) => {
    const numEl = it.querySelector('.dnd-num');
    if (numEl) numEl.textContent = idx + 1;
  });
}

/* ─── Reveal Solution (nach 3 Fehlversuchen) ──────────────────────────── */
function revealSolution(step) {
  const sol = SOLUTIONS[step];
  state.revealed[step] = true;
  const card = document.querySelector(`.step-card[data-step="${step}"]`);

  if (sol.type === 'radio') {
    const correctInput = card.querySelector(`input[name="s${step}"][value="${sol.correct}"]`);
    if (correctInput) {
      correctInput.checked = true;
      card.querySelectorAll('.option-label').forEach(l => l.classList.remove('was-correct', 'was-wrong'));
      correctInput.closest('.option-label').classList.add('was-correct');
    }
  } else if (sol.type === 'match') {
    card.querySelectorAll('.match-row').forEach(r => {
      const key = r.querySelector('.match-select').dataset.key;
      r.querySelector('.match-select').value = sol.correct[key];
      r.classList.remove('row-wrong');
      r.classList.add('row-correct');
    });
  } else if (sol.type === 'text') {
    const input = document.getElementById(`s${step}-input`);
    if (input) { input.value = sol.correct[0]; input.classList.remove('input-err'); input.classList.add('input-ok'); }
  } else if (sol.type === 'order') {
    const list = card.querySelector('.dnd-list');
    if (list) {
      const items = Array.from(list.querySelectorAll('.dnd-item'));
      const byKey = Object.fromEntries(items.map(it => [it.dataset.key, it]));
      const orderedKeys = Object.entries(sol.correct)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(e => e[0]);
      orderedKeys.forEach(k => list.appendChild(byKey[k]));
      list.querySelectorAll('.dnd-item').forEach(it => {
        it.classList.remove('row-wrong');
        it.classList.add('row-correct');
      });
      updateDnDNumbers(list);
    }
  }

  const fb = document.getElementById('fb-' + step);
  if (fb) { fb.textContent = 'Lösung angezeigt. Klicke auf „Prüfen" um sie zu bestätigen.'; fb.className = 'task-feedback warn'; }
}

/* ─── Optional (Bonus-Aufgabe im Schritt 2) ────────────────────────────── */
function checkOptional() {
  const input = document.getElementById('opt-input');
  const fb = document.getElementById('fb-opt');
  if (!input || !fb) return;
  input.classList.remove('input-ok', 'input-err');
  const raw = input.value.trim().toLowerCase();
  if (!raw) {
    fb.textContent = 'Bitte einen Wert eingeben.';
    fb.className = 'task-feedback warn';
    return;
  }
  if (OPTIONAL_ANSWERS.map(s => s.toLowerCase()).includes(raw)) {
    input.classList.add('input-ok');
    fb.textContent = '⭐ Richtig! k · k⁻¹ ist per Definition das neutrale Element der Multiplikation — also 1 (mod n). Extra-Badge freigeschaltet.';
    fb.className = 'task-feedback ok';
    state.optionalDone = true;
  } else {
    input.classList.add('input-err');
    fb.textContent = '✗ Nicht ganz — denk an das neutrale Element der Multiplikation in (ℤ/nℤ)*.';
    fb.className = 'task-feedback err';
  }
}

/* ─── Lock + Advance ───────────────────────────────────────────────────── */
function lockStep(step) {
  const card = document.querySelector(`.step-card[data-step="${step}"]`);
  if (!card) return;
  // Nur die Antwort-Inputs/Selects sperren — der Weiter-Button bleibt klickbar.
  // Auch die DnD-Items werden non-draggable, damit die richtige Reihenfolge steht.
  card.querySelectorAll('.task-panel:not(.task-panel-optional) input, .task-panel:not(.task-panel-optional) select').forEach(el => el.disabled = true);
  card.querySelectorAll('.task-panel:not(.task-panel-optional) .dnd-item').forEach(el => el.setAttribute('draggable', 'false'));
  const solveBtn = document.getElementById('solve-' + step);
  if (solveBtn) solveBtn.hidden = true;
}

function advanceFrom(step) {
  if (step >= TOTAL_STEPS) {
    showFinale();
  } else {
    showStep(step + 1);
  }
}

/* ─── Finale ───────────────────────────────────────────────────────────── */
function showFinale() {
  document.querySelectorAll('.step-card').forEach(c => c.hidden = true);
  const finale = document.querySelector('.step-card[data-step="finale"]');
  if (finale) {
    finale.hidden = false;
    finale.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('.stepper-node').forEach(n => {
    n.classList.remove('active');
    n.classList.add('done');
  });
  const fill = document.getElementById('stepperFill');
  if (fill) {
    fill.style.setProperty('--fill', '100%');
    fill.classList.add('complete');
  }

  // Scores einsetzen
  const totalAtt = Object.values(state.attempts).reduce((a, b) => a + b, 0);
  const el1 = document.getElementById('totalAttempts');
  const el2 = document.getElementById('cleanSteps');
  if (el1) el1.textContent = totalAtt;
  if (el2) el2.textContent = `${state.cleanSolves}/${TOTAL_STEPS}`;

  // Optional-Badge nur zeigen, wenn der Bonus gelöst wurde
  const optPill = document.getElementById('optionalPill');
  if (optPill && state.optionalDone) optPill.hidden = false;

  try { localStorage.setItem('curveball_part2_done', '1'); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS-SWITCH (Setup-Landing)
   ═════════════════════════════════════════════════════════════════════════ */
function switchOS(os) {
  document.querySelectorAll('.os-panel').forEach(p => { p.hidden = true; });
  document.querySelectorAll('.os-tab').forEach(t => { t.classList.remove('active'); });
  const panel = document.getElementById('os-' + os);
  if (panel) panel.hidden = false;
  const tab = document.querySelector('.os-tab[data-os="' + os + '"]');
  if (tab) tab.classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════════════════
   DOWNLOAD-OVERLAY MODAL
   ═════════════════════════════════════════════════════════════════════════ */

// Datei-spezifische Inhalte für das Overlay
const FILE_CONFIGS = {
  chain: {
    icon: '📜',
    name: 'comodoecccertificationauthority-ev-comodoca-com-chain.pem',
    displayName: 'chain.pem',
    desc: 'Echte COMODO ECC EV CA-Kette — Quelle für den öffentlichen Punkt Q',
    steps: `
      <div class="fmo-section">
        <div class="fmo-label">Was ist diese Datei?</div>
        <p>Die echte, öffentlich abrufbare Zertifikatskette von comodoca.com — drei Zertifikate in
        einer PEM-Datei: Root CA → Intermediate CA (COMODO ECC Extended Validation) → End-Entity.
        <code>badecparams.py</code> liest daraus den öffentlichen Punkt <em>Q</em> des Zwischenzertifikats,
        um daraus den manipulierten Generator <em>G'</em> zu berechnen.</p>
      </div>
      <div class="fmo-section">
        <div class="fmo-label">Nach dem Download</div>
        <div class="fmo-code">mv comodoecccertificationauthority-ev-comodoca-com-chain.pem /pfad/zum/angriffsordner/</div>
        <p class="fmo-hint">Wichtig: Die Datei muss <strong>exakt diesen langen Dateinamen</strong> behalten —
        <code>badecparams.py</code> sucht nach diesem Namen im aktuellen Verzeichnis.</p>
      </div>`,
    errors: []
  },
  attack: {
    icon: '🔑',
    name: 'badecparams.py',
    displayName: 'badecparams.py',
    desc: 'Vollständiges Angriffsskript — erzeugt gefälschte CA und Endzertifikate',
    steps: `
      <div class="fmo-section">
        <div class="fmo-label">Nach dem Download — ausführbar machen</div>
        <div class="fmo-code">chmod +x badecparams.py</div>
      </div>
      <div class="fmo-section">
        <div class="fmo-label">Ausführen (venv muss aktiv sein)</div>
        <div class="fmo-code">source .venv/bin/activate
./badecparams.py</div>
        <p class="fmo-hint">Keine Argumente nötig — das Skript sucht die Chain-Datei automatisch
        im aktuellen Verzeichnis.</p>
      </div>`,
    errors: [
      { err: 'ModuleNotFoundError: No module named \'ecdsa\'',
        fix: 'Virtuelle Umgebung nicht aktiv — zuerst <code>source .venv/bin/activate</code> ausführen.' },
      { err: 'Permission denied: ./badecparams.py',
        fix: 'Einmalig ausführbar machen: <code>chmod +x badecparams.py</code>' },
      { err: 'FileNotFoundError / chain.pem not found',
        fix: 'Die PEM-Datei fehlt im aktuellen Verzeichnis. Beide Dateien müssen im <em>selben Ordner</em> liegen.' }
    ]
  },
  server: {
    icon: '🌐',
    name: 'httpd.py',
    displayName: 'httpd.py',
    desc: 'TLS-Miniserver — liefert die gefälschte Zertifikatskette per Handshake aus',
    steps: `
      <div class="fmo-section">
        <div class="fmo-label">Nach dem Download — ausführbar machen</div>
        <div class="fmo-code">chmod +x httpd.py</div>
      </div>
      <div class="fmo-section">
        <div class="fmo-label">Ausführen (Terminal 1)</div>
        <div class="fmo-code">./httpd.py localhost.key</div>
        <p class="fmo-hint"><code>localhost.key</code> wird von <code>badecparams.py</code> erzeugt (Schritt 3).
        Der Server bindet auf <code>127.0.0.1:8443</code> — Konsole offen lassen, mit
        <kbd>Ctrl</kbd>+<kbd>C</kbd> beenden.</p>
      </div>
      <div class="fmo-section">
        <div class="fmo-label">Verbindung testen (Terminal 2)</div>
        <div class="fmo-code">openssl s_client -connect localhost:8443 -showcerts</div>
      </div>`,
    errors: [
      { err: 'Permission denied: ./httpd.py',
        fix: 'Einmalig ausführbar machen: <code>chmod +x httpd.py</code>' },
      { err: 'FileNotFoundError: localhost.key',
        fix: 'Schritt 3 noch nicht ausgeführt — <code>badecparams.py</code> erzeugt diese Datei.' },
      { err: 'Address already in use (Port 8443)',
        fix: 'Ein anderer Prozess belegt Port 8443. Prüfen: <code>ss -tlnp | grep 8443</code>, dann mit <code>kill &lt;PID&gt;</code> beenden.' }
    ]
  },
  demo: {
    icon: '🐍',
    name: 'curveball_demo.py',
    displayName: 'curveball_demo.py',
    desc: 'Berechnet und verifiziert G\' = k⁻¹ · Q an echten Zahlen',
    steps: `
      <div class="fmo-section">
        <div class="fmo-label">Ausführen (venv muss aktiv sein)</div>
        <div class="fmo-code">python3 curveball_demo.py comodo-intermediate.crt 0</div>
        <p class="fmo-hint">Argument <code>0</code> = zufälliges <em>k</em>. Das Skript liest
        <em>Q</em> aus dem Zwischenzertifikat, berechnet <em>G'</em> und zeigt beide Verifikationen.</p>
      </div>
      <div class="fmo-section">
        <div class="fmo-label">Erwartete Ausgabe</div>
        <div class="fmo-code">  ✓  gültig mit G'   ← Angriff würde funktionieren
  ✗  ungültig mit G  ← gepatchter Verifier würde ablehnen</div>
      </div>`,
    errors: [
      { err: 'ModuleNotFoundError: No module named \'ecdsa\'',
        fix: 'Virtuelle Umgebung nicht aktiv — zuerst <code>source .venv/bin/activate</code> ausführen.' }
    ]
  }
};

function openFileModal(filename, downloadUrl, configKey) {
  const cfg = FILE_CONFIGS[configKey];
  if (!cfg) return;

  document.getElementById('fileModalIcon').textContent  = cfg.icon;
  document.getElementById('fileModalTitle').textContent = cfg.displayName;
  document.getElementById('fileModalDesc').textContent  = cfg.desc;

  let errHTML = '';
  if (cfg.errors && cfg.errors.length) {
    errHTML = `<div class="fmo-section fmo-errors">
      <div class="fmo-label">Häufige Fehler</div>
      <div class="fmo-error-list">` +
      cfg.errors.map(e => `
        <div class="fmo-error-row">
          <div class="fmo-error-msg"><code>${e.err}</code></div>
          <div class="fmo-error-fix">${e.fix}</div>
        </div>`).join('') +
    `</div></div>`;
  }

  document.getElementById('fileModalBody').innerHTML =
    `<a class="fmo-download-btn" href="${downloadUrl}" download="${filename}">
       ↓ ${cfg.displayName} herunterladen
     </a>` +
    cfg.steps +
    errHTML;

  const backdrop = document.getElementById('fileModalBackdrop');
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';

  // Focus auf Schließen-Button
  setTimeout(() => backdrop.querySelector('.file-modal-close').focus(), 50);
}

function closeFileModal(event) {
  // Nur schließen bei Klick auf Backdrop selbst (nicht auf Modal-Inhalt)
  if (event && event.target !== document.getElementById('fileModalBackdrop')) return;
  _doCloseFileModal();
}

function _doCloseFileModal() {
  const backdrop = document.getElementById('fileModalBackdrop');
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = '';
}

// X-Button schließt immer
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fileModalBackdrop')
    ?.querySelector('.file-modal-close')
    ?.addEventListener('click', _doCloseFileModal);
});

// ESC schließt
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') _doCloseFileModal();
});
