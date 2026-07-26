#!/usr/bin/env python3
"""
CurveBall Challenge – Lokaler Webserver
Starten: python3 server.py
Dann im Browser: http://localhost:8080
"""
import http.server
import os
import socketserver

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")


print(f"\n  CurveBall Challenge läuft auf http://localhost:{PORT}")
print("  Zum Beenden: Strg+C\n")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
