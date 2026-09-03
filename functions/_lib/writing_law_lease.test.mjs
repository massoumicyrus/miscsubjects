
import { describe, expect, it } from "vitest";
import { ATTESTED_CLAUSES, checkAttestations } from "./writing_law_lease.js";

const BODY = "An NSAID is the painkiller in your cupboard. BPC-157 is a lab-made copy of a piece of a "
  + "protein the stomach makes. It grows new blood vessels into damaged tissue, in rats, at 10 "
  + "micrograms per kilo a day, across about 150 animal papers. The painkiller takes the pain away "
  + "and leaves the healed part weaker. Thirty-seven people wrote down what happened to them. "
  + "Losing weight lowers the load the joints carry, which is why knee pain fell in the trial. "
  + "There is no timing window that escapes it. Treat five people and two get real relief.";

const full = (over = {}) => {
  const a = {};
  for (const [id] of ATTESTED_CLAUSES) {
    a[id] = { how: "This article satisfies the clause in the following specific way, stated plainly.", quote: "grows new blood vessels into damaged tissue" };
  }
  return { ...a, ...over };
};

const base = (over = {}) => ({
  law_hash: "abc123", expected_hash: "abc123", slug: "bpc-157", body: BODY, attestations: full(), ...over,
});

describe("the writing-law lease", () => {
  it("issues when every clause is attested with a quote that is really in the body", () => {
    expect(checkAttestations(base()).ok).toBe(true);
  });

  it("refuses a hash that is not the current law", () => {
    const r = checkAttestations(base({ law_hash: "stale" }));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("stale_law_hash");
  });

  it("refuses a quote that is not in the body — the whole point", () => {
    const r = checkAttestations(base({ attestations: full({ W118: { how: "The first thing said about the substance is what it does, not what it lacks, as required.", quote: "a sentence that was never written into this article" } }) }));
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.clause === "W118")?.code).toBe("quote_not_in_body");
  });

  it("refuses a missing clause rather than passing what was skipped", () => {
    const a = full(); delete a.W119;
    const r = checkAttestations(base({ attestations: a }));
    expect(r.issues.find((i) => i.clause === "W119")?.code).toBe("missing_attestation");
  });

  it("refuses an attestation that says nothing", () => {
    const r = checkAttestations(base({ attestations: full({ W21: { how: "yes", quote: "grows new blood vessels into damaged tissue" } }) }));
    expect(r.issues.find((i) => i.clause === "W21")?.code).toBe("thin_attestation");
  });

  it("refuses a lease taken with no body, so it cannot be taken before the work", () => {
    const r = checkAttestations(base({ body: "" }));
    expect(r.issues.map((i) => i.code)).toContain("body_required");
  });

  it("lets W124 attest 'none', because a page can satisfy it by absence", () => {
    const r = checkAttestations(base({ attestations: full({ W124: { how: "No qualifier anywhere narrows a harm without the same narrowing on the benefit.", quote: "none" } }) }));
    expect(r.ok).toBe(true);
  });

  it("reports every issue at once rather than one refusal at a time", () => {
    const r = checkAttestations({ law_hash: "", expected_hash: "x", slug: "", body: "", attestations: {} });
    expect(r.issues.length).toBeGreaterThan(ATTESTED_CLAUSES.length);
  });
});
