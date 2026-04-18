/**
 * Criptografia de credenciais Morpheu.
 * Reutiliza o mesmo serviço de criptografia do módulo fiscal
 * (AES-256-GCM com FISCAL_ENCRYPTION_KEY) pra não ter duas chaves na infra.
 */
export { encrypt, decrypt } from "../fiscal/encryption";
