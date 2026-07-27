# Curveball Challenge

Dieses Projekt bietet eine interaktive Lernumgebung zur CVE-2020-0601 (Curveball) Schwachstelle.

## Technischer Aufbau

```text
curveball-challenge/
├── downloads/             # Herunterladbare Python-Skripte für die Challenge
│   ├── badecparams.py     
│   ├── curveball_demo.py  
│   └── httpd.py           
├── static/                # Statische Assets, Theorie und JavaScript-Logik
│   ├── style.css          
│   ├── theorie.html       
│   └── *.js               
├── index.html             # Landing-Page aka. Main-Menu
├── part1.html             # Teil 1: Einführung
├── part2.html             # Teil 2: Durchführung
├── server.py              # Python Webserver (Einstiegspunkt)
└── README.md
```

## Projektstruktur im Detail

- **server.py**: Der zentrale Einstiegspunkt. Startet einen lokalen Webserver, der die Dateien ausliefert.
- **index.html / part1.html / part2.html**: Die Haupt-HTML-Seiten der Webanwendung.
- **static/**: Enthält CSS-Styling, JavaScript-Logik für Quiz und Interaktionen sowie die Theorie-Seite.
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
