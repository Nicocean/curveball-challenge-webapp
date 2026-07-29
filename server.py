#!/usr/bin/env python3
"""
CurveBall Challenge – Lokaler Webserver

Starten:
    python3 server.py

Der Server läuft auf http://localhost:8080 und liefert die Dateien aus
dem Verzeichnis, in dem server.py liegt — unabhängig davon, aus welchem
Working Directory er gestartet wird (wichtig für IDEs wie PyCharm).
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8080
OPEN_BROWSER = True  # auf False setzen, wenn du das nicht willst

# WICHTIG: Wir wechseln in das Verzeichnis, in dem diese Datei liegt.
# Damit funktioniert der Server auch, wenn PyCharm ihn mit einem anderen
# Working Directory startet (typische Ursache für 404-Fehler).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)


class Handler(http.server.SimpleHTTPRequestHandler):
    """Standard-Handler, der explizit aus BASE_DIR ausliefert."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Farbige, gut lesbare Konsolenausgabe
        print(f"  [{self.log_date_time_string()}] {format % args}")

    def end_headers(self):
        # Aggressiv Caching deaktivieren: In der Entwicklung ist es lästig,
        # wenn der Browser altes JS/CSS ausliefert. HTML wird ohnehin schon
        # unten mit no-store versehen, aber wir setzen es hier für alle
        # Antworten inklusive statischer Assets.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()



def main() -> None:
    print()
    print("  ╔═══════════════════════════════════════════════════╗")
    print("  ║   CurveBall Challenge — Lokaler Server            ║")
    print("  ╠═══════════════════════════════════════════════════╣")
    print(f"  ║   URL:   http://localhost:{PORT}                    ║")
    print(f"  ║   Root:  {BASE_DIR[:38]:<38}   ║")
    print("  ║   Stop:  Strg+C                                   ║")
    print("  ╚═══════════════════════════════════════════════════╝")
    print()

    # Falls ein Vorgänger den Port noch blockiert
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            if OPEN_BROWSER:
                # Browser leicht verzögert öffnen, damit der Server sicher lauscht
                threading.Timer(
                    0.6,
                    lambda: webbrowser.open(f"http://localhost:{PORT}/"),
                ).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server beendet.")
        sys.exit(0)
    except OSError as e:
        print(f"\n  Fehler: {e}")
        print(f"  Vermutlich läuft schon ein anderer Prozess auf Port {PORT}.")
        sys.exit(1)


if __name__ == "__main__":
    main()
