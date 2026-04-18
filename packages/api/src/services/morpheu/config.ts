import { getDb, morpheuConfig } from "@matrix-food/database";
import { decrypt } from "./crypto";

export interface MorpheuRuntimeConfig {
  id: string;
  metaAppId: string;
  accessToken: string;
  metaPhoneNumberId: string;
  metaBusinessAccountId: string | null;
  graphApiVersion: string;
  webhookVerifyToken: string;
  webhookSecret: string;
  displayName: string;
  defaultSystemPrompt: string | null;
  enabled: boolean;
}

/**
 * Carrega a configuração global do Morpheu e decripta credenciais.
 * Retorna null se ainda não foi configurado pelo superadmin ou se está desabilitado.
 */
export async function loadMorpheuConfig(): Promise<MorpheuRuntimeConfig | null> {
  const db = getDb();
  const [row] = await db.select().from(morpheuConfig).limit(1);
  if (!row) return null;
  if (!row.enabled) return null;
  if (
    !row.metaAppId ||
    !row.encryptedAccessToken ||
    !row.metaPhoneNumberId ||
    !row.webhookVerifyToken ||
    !row.encryptedWebhookSecret
  ) {
    return null;
  }
  return {
    id: row.id,
    metaAppId: row.metaAppId,
    accessToken: decrypt(row.encryptedAccessToken),
    metaPhoneNumberId: row.metaPhoneNumberId,
    metaBusinessAccountId: row.metaBusinessAccountId,
    graphApiVersion: row.graphApiVersion,
    webhookVerifyToken: row.webhookVerifyToken,
    webhookSecret: decrypt(row.encryptedWebhookSecret),
    displayName: row.displayName,
    defaultSystemPrompt: row.defaultSystemPrompt,
    enabled: row.enabled,
  };
}

/**
 * Versão que não exige enabled=true — usada pelo endpoint "testar conexão"
 * do superadmin quando ainda não ligou a integração.
 */
export async function loadMorpheuConfigRaw(): Promise<MorpheuRuntimeConfig | null> {
  const db = getDb();
  const [row] = await db.select().from(morpheuConfig).limit(1);
  if (!row) return null;
  if (
    !row.metaAppId ||
    !row.encryptedAccessToken ||
    !row.metaPhoneNumberId ||
    !row.webhookVerifyToken ||
    !row.encryptedWebhookSecret
  ) {
    return null;
  }
  return {
    id: row.id,
    metaAppId: row.metaAppId,
    accessToken: decrypt(row.encryptedAccessToken),
    metaPhoneNumberId: row.metaPhoneNumberId,
    metaBusinessAccountId: row.metaBusinessAccountId,
    graphApiVersion: row.graphApiVersion,
    webhookVerifyToken: row.webhookVerifyToken,
    webhookSecret: decrypt(row.encryptedWebhookSecret),
    displayName: row.displayName,
    defaultSystemPrompt: row.defaultSystemPrompt,
    enabled: row.enabled,
  };
}
