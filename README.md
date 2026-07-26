# Curveball Challenge

Dieses Projekt bietet eine interaktive Lernumgebung zur CVE-2020-0601 (Curveball) Schwachstelle.

## Technischer Aufbau

```text
curveball-challenge/
├── server.py              # Python http.server, serviert /static, routing
├── static/
│   ├── index.html         # Landing: wähle Teil 1 oder Teil 2
│   ├── part1.html         # Einführungs-Quiz
│   ├── part2.html         # Durchführungs-Anleitung
│   └── style.css
├── downloads/             # die 3 herunterladbaren Skripte
│   ├── curveball_demo.py  # Schritt 3 - Demo-Skript
│   ├── badecparams.py     # Schritt 4 - Attack-Skript (aus dem Branch)
│   └── httpd.py           # Schritt 8 - Server-Skript
└── README.md
```

## Projektstruktur im Detail

- **server.py**: Der zentrale Einstiegspunkt. Startet einen lokalen Webserver, der die statischen Dateien ausliefert und das Routing übernimmt.
- **static/**: Enthält das Frontend der Webanwendung inklusive HTML-Seiten für das Quiz und die Anleitung sowie CSS für das Styling.
- **downloads/**: Beinhaltet die Python-Skripte, die im Rahmen der Challenge heruntergeladen und lokal ausgeführt werden müssen.

## Ausführung

Um die Webanwendung lokal zu starten, folge diesen Schritten:

1. Navigiere in das Projektverzeichnis.
2. Starte den Webserver mit Python:

```bash
python3 server.py
```

3. Dein Browser ruft nun automatisch die Seite auf, aber falls nicht: 
[http://localhost:8080](http://localhost:8080)

4. Viel Spass! :)
