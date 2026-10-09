#!/usr/bin/env bash
# Regenerates the OpenSSL interoperability fixtures for passive authentication.
#
# Everything is synthetic: a throwaway CSCA → Document Signer PKI, a fake MRZ
# (PRUEBA SNACK TEST, DNI 12345678Z) and a DG2 made of random bytes. The SODs
# are signed by `openssl cms`, an implementation independent from ours, so the
# tests prove we read real-world CMS (signingTime and other extra attributes,
# RSASSA-PSS, ECDSA over brainpoolP256r1 with explicit domain parameters).
#
# Usage: test/fixtures/document/generate.sh   (needs openssl 3 and python3)
set -euo pipefail
cd "$(dirname "$0")"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

days=36500 # ~100 years: the fixtures must not expire

# DG1, DG2 and the LDSSecurityObject (SHA-256), with a minimal DER writer.
python3 - "$tmp" <<'PY'
import hashlib, os, sys
out = sys.argv[1]
def tlv(tag, content):
    n = len(content)
    if n < 0x80: l = bytes([n])
    else:
        b = n.to_bytes((n.bit_length() + 7) // 8, 'big'); l = bytes([0x80 | len(b)]) + b
    return tag + l + content
def seq(*items): return tlv(b'\x30', b''.join(items))
def integer(i): return tlv(b'\x02', i.to_bytes(max(1, (i.bit_length() + 8) // 8), 'big'))
sha256_oid = bytes.fromhex('0609608648016503040201')
def cd(s):
    v = lambda c: int(c) if c.isdigit() else (0 if c == '<' else ord(c) - 55)
    return str(sum(v(c) * (7, 3, 1)[i % 3] for i, c in enumerate(s)) % 10)
num, opt, birth, exp = 'ZZZ000002', '12345678Z<<<<<<', '900517', '310517'
l1 = 'IDESP' + num + cd(num) + opt
l2h = birth + cd(birth) + 'F' + exp + cd(exp) + 'ESP' + '<' * 11
comp = l1[5:30] + l2h[0:7] + l2h[8:15] + l2h[18:29]
l3 = 'PRUEBA<<SNACK<TEST'.ljust(30, '<')
mrz = (l1 + l2h + cd(comp) + l3).encode()
assert len(mrz) == 90
dg1 = tlv(b'\x61', tlv(b'\x5f\x1f', mrz))
dg2 = tlv(b'\x75', tlv(b'\x7f\x61', b'\xff\xd8\xff' + os.urandom(1500)))
hashes = seq(*[seq(integer(n), tlv(b'\x04', hashlib.sha256(d).digest())) for n, d in ((1, dg1), (2, dg2))])
lds = seq(integer(0), seq(sha256_oid), hashes)
for name, data in (('dg1', dg1), ('dg2', dg2), ('lds', lds)):
    open(os.path.join(out, name + '.der'), 'wb').write(data)
PY

cp "$tmp/dg1.der" dg1.der
cp "$tmp/dg2.der" dg2.der

wrap() { # EF.SOD = [APPLICATION 23] ContentInfo
  python3 -c '
import sys
d = open(sys.argv[1], "rb").read(); n = len(d)
b = n.to_bytes((n.bit_length() + 7) // 8, "big")
l = bytes([n]) if n < 0x80 else bytes([0x80 | len(b)]) + b
open(sys.argv[2], "wb").write(b"\x77" + l + d)' "$1" "$2"
}

ext_ca="basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash"
ext_ds="keyUsage=critical,digitalSignature
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid"

# RSA: CSCA → DS (PKCS#1 v1.5); SignerInfo with RSASSA-PSS.
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$tmp/csca_rsa.key" -out csca_rsa.pem \
  -subj "/C=XX/O=Snack Test PKI/CN=CSCA TEST OPENSSL RSA" -days $days \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -keyout "$tmp/ds_rsa.key" -out "$tmp/ds_rsa.csr" \
  -subj "/C=XX/O=Snack Test PKI/CN=DS TEST OPENSSL RSA" 2>/dev/null
openssl x509 -req -in "$tmp/ds_rsa.csr" -CA csca_rsa.pem -CAkey "$tmp/csca_rsa.key" -set_serial 4242 \
  -days $days -extfile <(echo "$ext_ds") -out "$tmp/ds_rsa.pem" 2>/dev/null
openssl cms -sign -binary -nodetach -nosmimecap -in "$tmp/lds.der" -econtent_type 2.23.136.1.1.1 \
  -signer "$tmp/ds_rsa.pem" -inkey "$tmp/ds_rsa.key" -md sha256 \
  -keyopt rsa_padding_mode:pss -keyopt rsa_pss_saltlen:32 -outform DER -out "$tmp/ci_rsa.der"
wrap "$tmp/ci_rsa.der" sod_rsa_pss.der

# EC: brainpoolP256r1 with explicit domain parameters (ICAO recommendation).
openssl ecparam -name brainpoolP256r1 -param_enc explicit -genkey -noout -out "$tmp/csca_ec.key"
openssl req -x509 -key "$tmp/csca_ec.key" -out csca_ec.pem -days $days \
  -subj "/C=XX/O=Snack Test PKI/CN=CSCA TEST OPENSSL EC" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
openssl ecparam -name brainpoolP256r1 -param_enc explicit -genkey -noout -out "$tmp/ds_ec.key"
openssl req -new -key "$tmp/ds_ec.key" -out "$tmp/ds_ec.csr" -subj "/C=XX/O=Snack Test PKI/CN=DS TEST OPENSSL EC" 2>/dev/null
openssl x509 -req -in "$tmp/ds_ec.csr" -CA csca_ec.pem -CAkey "$tmp/csca_ec.key" -set_serial 4343 \
  -days $days -extfile <(echo "$ext_ds") -out "$tmp/ds_ec.pem" 2>/dev/null
openssl cms -sign -binary -nodetach -in "$tmp/lds.der" -econtent_type 2.23.136.1.1.1 \
  -signer "$tmp/ds_ec.pem" -inkey "$tmp/ds_ec.key" -md sha256 -keyid -outform DER -out "$tmp/ci_ec.der"
wrap "$tmp/ci_ec.der" sod_ec_explicit.der

# Sanity check with OpenSSL itself.
openssl cms -verify -binary -inform DER -in "$tmp/ci_rsa.der" -CAfile csca_rsa.pem -purpose any -out /dev/null
# OpenSSL 3 refuses explicit EC parameters in chain validation; check the signature only.
openssl cms -verify -binary -inform DER -in "$tmp/ci_ec.der" -noverify -out /dev/null
echo "fixtures regenerated"
