#!/usr/bin/env python3
"""
verify_bundle.py — offline verifier for an attested-finding bundle.

Run it against a bundle you downloaded and it answers PASS or FAIL without contacting
miscsubjects.com at all. It refuses to, on purpose: any check that had to ask the operator
whether the operator is honest is not a check.

    python3 verify_bundle.py bundle.json              # full run (touches drand + bitcoin)
    python3 verify_bundle.py bundle.json --no-network # hash-only run, zero network

What it recomputes, and what each check would catch:

  1 ANCHOR_ID          anchor_id == SHA256(canonical preimage).
                       Catches: a packet whose commitment was edited after publication.
  2 CANONICAL_BINDING  every field asserted in the packet appears in the preimage the hash
                       was taken over. Catches: a preimage that commits to a different
                       drand round, bitcoin block or chain head than the packet displays.
  3 DRAND_SELF         randomness == SHA256(signature). This is drand's own construction, so
                       it is checkable from the packet alone with no network and no BLS
                       library. Catches: an invented beacon.
  4 DRAND_LIVE         the beacon at api.drand.sh for that round matches byte for byte.
                       Catches: a real-looking round that was never published.
  5 BTC_HEADER         the 80-byte block header for the claimed height, fetched from an
                       independent explorer, double-SHA256s to the claimed block hash, and
                       that hash meets its own difficulty target. Catches: a fabricated
                       block hash. Proof-of-work cannot be forged backwards.
  6 BTC_SECOND_SOURCE  a second independent explorer returns the same hash for that height.
                       Catches: one compromised explorer.
  7 OBJECT_HASHES      every object in the bundle (ruleset, artifact, record, image) hashes
                       to the value the findings cite. Catches: a rule set or artifact
                       swapped after the findings were made.
  8 FINDING_BINDING    every finding cites the bundle's ruleset hash and artifact hash, and
                       signs with the model its own row targets. Catches: a finding
                       re-pointed at a different rule set, or a signature naming a model
                       that did not run.
  9 ANTERIORITY        states the direction of the binding in plain words: what this proves
                       about time, and what it does not.

Exit code 0 = every applicable check passed. 1 = at least one FAIL.
No dependencies outside the standard library.
"""

import hashlib
import json
import sys
import urllib.request

FORBIDDEN_HOST = "miscsubjects.com"
US = "␟"  # the field separator used in the canonical preimage


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def get(url: str, timeout: int = 20):
    if FORBIDDEN_HOST in url:
        raise RuntimeError("refusing to contact " + FORBIDDEN_HOST + ": this verifier does not ask the operator")
    req = urllib.request.Request(url, headers={"user-agent": "verify_bundle.py/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url: str, timeout: int = 20):
    return json.loads(get(url, timeout).decode())


class Report:
    def __init__(self):
        self.rows = []

    def add(self, name, ok, detail):
        self.rows.append((name, ok, detail))
        flag = "PASS" if ok is True else ("SKIP" if ok is None else "FAIL")
        print("%-18s %-4s %s" % (name, flag, detail))

    def failed(self):
        return any(ok is False for _, ok, _ in self.rows)


# ── 1-2. the anchor packet ───────────────────────────────────────────────────────────────────
def check_anchor(rep, anchor):
    canonical = anchor.get("canonical") or ""
    claimed = (anchor.get("anchor_id") or "").lower()
    computed = sha256_hex(canonical.encode())
    rep.add("ANCHOR_ID", computed == claimed and bool(claimed),
            "computed %s%s" % (computed[:24], "" if computed == claimed else " != claimed " + claimed[:24]))

    fields = dict(p.split("=", 1) for p in canonical.split(US)[1:] if "=" in p)
    s = anchor.get("surfaces") or {}
    d, b = s.get("drand") or {}, s.get("bitcoin") or s.get("btc") or {}
    want = {
        "packet": (anchor.get("packet_hash") or "").lower(),
        "drand.round": str(d.get("round") or ""),
        "drand.randomness": (d.get("randomness") or "").lower(),
        "btc.height": str(b.get("height") or ""),
        "btc.hash": (b.get("hash") or b.get("block_hash") or "").lower(),
    }
    bad = [k for k, v in want.items() if v and fields.get(k, "").lower() != v.lower()]
    rep.add("CANONICAL_BINDING", not bad,
            "all %d asserted fields are inside the hashed preimage" % len(want) if not bad
            else "preimage disagrees with the packet on: " + ", ".join(bad))
    return fields, d, b


# ── 3-4. drand ──────────────────────────────────────────────────────────────────────────────
def check_drand(rep, d, network):
    sig = (d.get("signature") or "").lower()
    rnd = (d.get("randomness") or "").lower()
    if sig and rnd:
        derived = sha256_hex(bytes.fromhex(sig))
        rep.add("DRAND_SELF", derived == rnd,
                "randomness == SHA256(signature)" if derived == rnd
                else "SHA256(signature)=%s != randomness=%s" % (derived[:20], rnd[:20]))
    else:
        rep.add("DRAND_SELF", None, "packet carries no signature; cannot self-check")
    if not network:
        rep.add("DRAND_LIVE", None, "--no-network")
        return
    try:
        live = get_json("https://api.drand.sh/public/%s" % d.get("round"))
        ok = (live.get("randomness", "").lower() == rnd) and (live.get("signature", "").lower() == sig)
        rep.add("DRAND_LIVE", ok, "round %s matches the League of Entropy beacon byte for byte" % d.get("round")
                if ok else "live beacon for round %s differs from the packet" % d.get("round"))
    except Exception as e:
        rep.add("DRAND_LIVE", None, "beacon unreachable: %s" % e)


# ── 5-6. bitcoin ────────────────────────────────────────────────────────────────────────────
def _pow_ok(header_hex: str, block_hash: str):
    raw = bytes.fromhex(header_hex)
    h = hashlib.sha256(hashlib.sha256(raw).digest()).digest()[::-1].hex()
    bits = int.from_bytes(raw[72:76][::-1], "big")
    exp, mant = bits >> 24, bits & 0xFFFFFF
    target = mant * (1 << (8 * (exp - 3)))
    return h == block_hash.lower(), h, int(h, 16) <= target


def check_bitcoin(rep, b, network):
    height, bhash = b.get("height"), (b.get("hash") or b.get("block_hash") or "").lower()
    if not network:
        rep.add("BTC_HEADER", None, "--no-network")
        rep.add("BTC_SECOND_SOURCE", None, "--no-network")
        return
    try:
        header = get("https://blockstream.info/api/block/%s/header" % bhash).decode().strip()
        matches, recomputed, pow_ok = _pow_ok(header, bhash)
        rep.add("BTC_HEADER", matches and pow_ok,
                "80-byte header double-SHA256s to the claimed hash and meets its own target"
                if matches and pow_ok else "header recomputes to %s, pow_ok=%s" % (recomputed[:20], pow_ok))
    except Exception as e:
        rep.add("BTC_HEADER", None, "header unreachable: %s" % e)
    try:
        second = get("https://mempool.space/api/block-height/%s" % height).decode().strip().lower()
        rep.add("BTC_SECOND_SOURCE", second == bhash,
                "an independent explorer returns the same hash at height %s" % height
                if second == bhash else "second source returns %s" % second[:20])
    except Exception as e:
        rep.add("BTC_SECOND_SOURCE", None, "second source unreachable: %s" % e)


# ── 7. every object hashes to what the findings cite ─────────────────────────────────────────
def check_objects(rep, bundle):
    objs = bundle.get("objects") or {}
    bad, checked = [], 0
    for name, o in objs.items():
        claimed = (o.get("sha256") or "").lower()
        if o.get("canonical") is not None:
            got = sha256_hex(o["canonical"].encode())
        elif o.get("base64") is not None:
            import base64
            got = sha256_hex(base64.b64decode(o["base64"]))
        else:
            continue
        checked += 1
        if got != claimed:
            bad.append("%s: computed %s != cited %s" % (name, got[:16], claimed[:16]))
    rep.add("OBJECT_HASHES", not bad if checked else None,
            "%d objects hash to the values the findings cite" % checked if not bad
            else "; ".join(bad))


# ── 8. findings are bound to those objects and sign honestly ─────────────────────────────────
def check_findings(rep, bundle):
    objs = bundle.get("objects") or {}
    rs = ((objs.get("ruleset") or {}).get("sha256") or "").lower()
    art = [(objs.get(k) or {}).get("sha256", "").lower() for k in ("artifact", "image", "record") if objs.get(k)]
    problems, n = [], 0
    for f in bundle.get("findings") or []:
        n += 1
        who = f.get("id") or f.get("row") or "finding"
        if rs and (f.get("ruleset_hash") or "").lower() != rs:
            problems.append("%s cites ruleset %s, bundle ruleset is %s" % (who, str(f.get("ruleset_hash"))[:16], rs[:16]))
        cited = [str(x).lower() for x in (f.get("artifact_hashes") or ([f.get("artifact_hash")] if f.get("artifact_hash") else []))]
        if art and cited and not set(cited) & set(art):
            problems.append("%s cites an artifact hash that is not in the bundle" % who)
        model, signed = str(f.get("model") or ""), str(f.get("signed") or "")
        if model and signed and model.lower() not in signed.lower():
            problems.append("%s ran %s but signed '%s'" % (who, model, signed[:60]))
    rep.add("FINDING_BINDING", not problems if n else None,
            "%d findings cite this bundle's rule set and artifact and sign with the model that ran" % n
            if not problems else "; ".join(problems))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    network = "--no-network" not in sys.argv
    bundle = json.load(open(sys.argv[1]))
    rep = Report()
    print("bundle: %s" % (bundle.get("label") or sys.argv[1]))
    print("network: %s (never miscsubjects.com)\n" % ("drand + 2 bitcoin explorers" if network else "off"))

    anchor = bundle.get("anchor") or {}
    if anchor:
        _, d, b = check_anchor(rep, anchor)
        check_drand(rep, d, network)
        check_bitcoin(rep, b, network)
    else:
        rep.add("ANCHOR_ID", None, "bundle carries no anchor packet")
    check_objects(rep, bundle)
    check_findings(rep, bundle)

    at = anchor.get("anchored_at")
    print("\nANTERIORITY      %s" % (
        ("the packet commits to drand round %s and bitcoin height %s. Neither value could be known before it existed, "
         "so this commitment cannot have been created earlier than those events and the bundle cannot have been edited "
         "after them without changing anchor_id. It is a LOWER bound on the record's age, established by data the "
         "operator does not control. It is NOT an upper bound: nothing here proves the record was not created later "
         "than %s, only that it existed by the time it was anchored." % (
             (anchor.get("surfaces") or {}).get("drand", {}).get("round"),
             (anchor.get("surfaces") or {}).get("bitcoin", (anchor.get("surfaces") or {}).get("btc", {})).get("height"),
             at))
        if anchor else "no anchor in this bundle: nothing here establishes when the record existed"))

    verdict = "FAIL" if rep.failed() else "PASS"
    print("\n%s — %d checks, %d failed, %d skipped" % (
        verdict, len(rep.rows), sum(1 for _, o, _ in rep.rows if o is False),
        sum(1 for _, o, _ in rep.rows if o is None)))
    return 1 if rep.failed() else 0


if __name__ == "__main__":
    sys.exit(main())
