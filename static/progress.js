/**
 * Progress-Gate für CurveBall Challenge
 *
 * State liegt in localStorage → überlebt F5, Tab-Wechsel und Tab-Close.
 * Bei jedem Server-Start injiziert server.py eine neue __SERVER_SESSION__
 * in die HTML-Antworten – wenn die im localStorage abgelegte ID nicht mehr
 * matcht, wird der komplette Progress-State verworfen.
 *
 * So gilt: "Server-Neustart = alles zurück auf Default" (die einzige
 * definierte Reset-Bedingung), Rest bleibt persistent.
 */
(function () {
  const KEY = 'curveball:progress';
  const SESSION_KEY = 'curveball:session';

  const currentSession = (typeof window !== 'undefined' && window.__SERVER_SESSION__) || null;
  if (currentSession) {
    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession !== currentSession) {
      // Alle curveball-eigenen localStorage-Keys leeren
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('curveball:')) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      // Auch alte sessionStorage-Reste aus der vorherigen Version wegräumen
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('curveball:'))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {}
      localStorage.setItem(SESSION_KEY, currentSession);
    }
  }

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  function write(obj) {
    localStorage.setItem(KEY, JSON.stringify(obj));
  }

  window.Progress = {
    isDone(part) {
      return read()[part] === true;
    },
    markDone(part) {
      const s = read();
      s[part] = true;
      write(s);
    },
    reset() {
      localStorage.removeItem(KEY);
    },
    // Diagnostik: in der Browser-Konsole `Progress.debug()` aufrufen
    debug() {
      return {
        currentSession: currentSession,
        storedSession: localStorage.getItem(SESSION_KEY),
        progress: localStorage.getItem(KEY),
        parsed: read(),
      };
    },
  };
})();
