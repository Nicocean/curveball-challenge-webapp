/* ═══════════════════════════════════════════════════════════════════════
   Teil 2 — One-Step-View, Stepper, Streng-Hybrid-Validierung
   ─────────────────────────────────────────────────────────────────────── */

const TOTAL_STEPS = 8;
const state = {
  current: 1,
  attempts: {},       // { 1: 0, 2: 0, ... }
  cleanSolves: 0,     // Schritte ohne Fehlversuch UND ohne "Lösung zeigen"
  revealed: {},       // { 1: true, ... } — Lösung wurde offengelegt
};

/* ─── Solutions ────────────────────────────────────────────────────────── */
const SOLUTIONS = {
  1: { type: 'radio',  correct: 'a' },
  2: { type: 'match',  correct: { a: 'inv', b: 'point', c: 'mul', d: 'ret' } },
  3: { type: 'text',   correct: ['1'] },
  4: { type: 'order',  correct: { load: '1', k: '2', gprime: '3', sign: '4' } },
  5: { type: 'radio',  correct: 'c' },
  6: { type: 'radio',  correct: 'a' },
  7: { type: 'radio',  correct: 'a' },
  8: { type: 'radio',  correct: 'b' },
};

/* ─── Init ─────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  for (let i = 1; i <= TOTAL_STEPS; i++) state.attempts[i] = 0;
  renderStepper();
  showStep(1);
});

/* ─── Stepper ──────────────────────────────────────────────────────────── */
function renderStepper() {
  const fill = document.getElementById('stepperFill');
  const nodes = document.querySelectorAll('.stepper-node');
  const done = state.current - 1;
  const pct = (done / (TOTAL_STEPS - 1)) * 100;
  if (fill) fill.style.setProperty('--fill', pct + '%');

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
function validateAndNext(step) {
  const sol = SOLUTIONS[step];
  let ok = false;

  if (sol.type === 'radio') ok = validateRadio(step, sol.correct);
  else if (sol.type === 'match') ok = validateMatch(step, sol.correct);
  else if (sol.type === 'text')  ok = validateText(step, sol.correct);
  else if (sol.type === 'order') ok = validateOrder(step, sol.correct);

  const fb = document.getElementById('fb-' + step);
  const att = document.getElementById('att-' + step);
  const solveBtn = document.getElementById('solve-' + step);

  if (ok) {
    if (fb) { fb.textContent = '✓ Richtig!'; fb.className = 'task-feedback ok'; }
    if (state.attempts[step] === 0 && !state.revealed[step]) state.cleanSolves++;
    lockStep(step);
    setTimeout(() => advanceFrom(step), 450);
  } else {
    state.attempts[step]++;
    if (fb) { fb.textContent = '✗ Nicht ganz — probiere es nochmal.'; fb.className = 'task-feedback err'; }
    if (att) att.textContent = `${state.attempts[step]} Fehlversuch${state.attempts[step] === 1 ? '' : 'e'}`;
    if (state.attempts[step] >= 3 && solveBtn) solveBtn.hidden = false;
  }
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
  // Vorherige Markierungen zurück
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
  const rows = card.querySelectorAll('.order-row');
  let allOk = true;
  const chosen = {};
  rows.forEach(r => {
    const key = r.dataset.key;
    const val = r.querySelector('.order-select').value;
    chosen[key] = val;
    r.classList.remove('row-correct', 'row-wrong');
  });
  // Doppelte Zahlen finden
  const seen = {};
  Object.values(chosen).forEach(v => { if (v) seen[v] = (seen[v] || 0) + 1; });
  rows.forEach(r => {
    const key = r.dataset.key;
    const val = chosen[key];
    if (!val || seen[val] > 1 || val !== correct[key]) { r.classList.add('row-wrong'); allOk = false; }
    else r.classList.add('row-correct');
  });
  return allOk;
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
    card.querySelectorAll('.order-row').forEach(r => {
      const key = r.dataset.key;
      r.querySelector('.order-select').value = sol.correct[key];
      r.classList.remove('row-wrong');
      r.classList.add('row-correct');
    });
  }

  const fb = document.getElementById('fb-' + step);
  if (fb) { fb.textContent = 'Lösung angezeigt. Klicke auf „Prüfen & Weiter" um fortzufahren.'; fb.className = 'task-feedback warn'; }
}

/* ─── Lock + Advance ───────────────────────────────────────────────────── */
function lockStep(step) {
  const card = document.querySelector(`.step-card[data-step="${step}"]`);
  if (!card) return;
  card.querySelectorAll('input, select').forEach(el => el.disabled = true);
  const nextBtn = document.getElementById('next-' + step);
  if (nextBtn) nextBtn.disabled = true;
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
  // Stepper: alle als "done" markieren
  document.querySelectorAll('.stepper-node').forEach(n => {
    n.classList.remove('active');
    n.classList.add('done');
  });
  const fill = document.getElementById('stepperFill');
  if (fill) fill.style.setProperty('--fill', '100%');

  // Scores einsetzen
  const totalAtt = Object.values(state.attempts).reduce((a, b) => a + b, 0);
  const el1 = document.getElementById('totalAttempts');
  const el2 = document.getElementById('cleanSteps');
  if (el1) el1.textContent = totalAtt;
  if (el2) el2.textContent = `${state.cleanSolves}/${TOTAL_STEPS}`;

  // Teil 2 als abgeschlossen markieren (für ggf. Gesamt-Finale-Check)
  try { localStorage.setItem('curveball_part2_done', '1'); } catch (e) {}
}
