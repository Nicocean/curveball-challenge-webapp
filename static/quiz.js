// Richtige Antworten (NICHT im HTML sichtbar)
const CORRECT = { q1: 'b', q2: 'c', q3: 'c', q4: 'b', q5: 'b', q6: 'c' };
const TOTAL   = Object.keys(CORRECT).length;

function checkAnswers() {
  let score = 0;
  const allCorrect = [];

  for (const [name, correct] of Object.entries(CORRECT)) {
    const block   = document.getElementById(name);
    const chosen  = document.querySelector(`input[name="${name}"]:checked`);
    const labels  = block.querySelectorAll('.option-label');

    // Klassen zurücksetzen
    block.classList.remove('correct', 'incorrect');
    labels.forEach(l => l.classList.remove('was-correct', 'was-wrong'));

    const value = chosen ? chosen.value : null;
    const isCorrect = value === correct;

    if (isCorrect) {
      score++;
      block.classList.add('correct');
      // Nur die ausgewählte (richtige) Option grün markieren — die anderen bleiben neutral
      if (chosen) {
        chosen.closest('.option-label').classList.add('was-correct');
      }
      allCorrect.push(true);
    } else {
      block.classList.add('incorrect');
      allCorrect.push(false);

      // NUR die falsche Auswahl markieren — die richtige Antwort NICHT verraten
      if (chosen) {
        chosen.closest('.option-label').classList.add('was-wrong');
      }
    }
  }

  // Score-Bar
  const bar    = document.getElementById('scoreBar');
  const num    = document.getElementById('scoreNumber');
  const txt    = document.getElementById('scoreText');
  const detail = document.getElementById('scoreDetail');
  const nextBtn = document.getElementById('nextBtn');

  bar.style.display = '';

  num.textContent = `${score} / ${TOTAL}`;
  num.className = 'score-number ' + (score === TOTAL ? 'all-correct' : 'has-errors');

  if (score === TOTAL) {
    txt.textContent = '🎉 Alle Antworten korrekt!';
    detail.textContent = 'Du kannst jetzt zur Durchführung weitergehen.';
    nextBtn.classList.remove('hidden');
    // Progress-Gate: Teil 1 abgeschlossen → Teil 2 auf Landing freischalten
    if (window.Progress) {
      window.Progress.markDone('part1');
    }
    // Direktlink oben aktualisieren (Schloss weg)
    const topLink = document.querySelector('.top-nav a.nav-link.locked');
    if (topLink) {
      topLink.classList.remove('locked');
      topLink.removeAttribute('aria-disabled');
    }
    launchConfetti();
  } else {
    const wrong = TOTAL - score;
    txt.textContent = `${wrong} Antwort${wrong > 1 ? 'en' : ''} noch falsch.`;
    detail.textContent = 'Rot markierte Antworten sind falsch. Passe deine Auswahl an und klicke erneut auf "Korrigieren".';
    nextBtn.classList.add('hidden');
  }
}

// ─── Confetti ────────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const COLORS = ['#4f8ef7','#34c97a','#f5a623','#f05c6e','#a78bfa','#34d1d1'];
  const COUNT  = 120;

  for (let i = 0; i < COUNT; i++) {
    pieces.push({
      x:     Math.random() * canvas.width,
      y:     -Math.random() * canvas.height * 0.5,
      w:     6 + Math.random() * 7,
      h:     10 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx:    (Math.random() - 0.5) * 3,
      vy:    2 + Math.random() * 3,
      rot:   Math.random() * 360,
      rv:    (Math.random() - 0.5) * 6,
      alpha: 1,
    });
  }

  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of pieces) {
      if (p.alpha <= 0) continue;
      alive = true;
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rv;
      // Verblassen wenn unten
      if (p.y > canvas.height * 0.7) p.alpha -= 0.018;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  cancelAnimationFrame(frame);
  draw();
}
