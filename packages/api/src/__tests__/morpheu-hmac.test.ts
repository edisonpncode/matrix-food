import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyMetaSignature } from "../services/morpheu/hmac";

function sign(body: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  const secret = "super-secret";
  const body = JSON.stringify({ object: "whatsapp_business_account" });

  it("aceita assinatura válida", () => {
    const sig = sign(body, secret);
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });

  it("rejeita assinatura trocada", () => {
    const sig = sign(body, "outro-secret");
    expect(verifyMetaSignature(body, sig, secret)).toBe(false);
  });

  it("rejeita header ausente", () => {
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
  });

  it("rejeita prefixo errado (sha1)", () => {
    const sig = sign(body, secret).replace("sha256=", "sha1=");
    expect(verifyMetaSignature(body, sig, secret)).toBe(false);
  });

  it("rejeita body adulterado", () => {
    const sig = sign(body, secret);
    expect(verifyMetaSignature(body + "x", sig, secret)).toBe(false);
  });

  it("rejeita header malformado", () => {
    expect(verifyMetaSignature(body, "lixo", secret)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=", secret)).toBe(false);
  });
});
