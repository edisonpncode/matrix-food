import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.FISCAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "FISCAL_ENCRYPTION_KEY não configurada. Gere uma chave com: openssl rand -hex 32"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Criptografa texto com AES-256-GCM.
 * Retorna string no formato: iv:tag:ciphertext (hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decriptografa texto criptografado com encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = ciphertext.split(":");

  if (!ivHex || !tagHex || !encrypted) {
    throw new Error("Formato de texto criptografado inválido");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
