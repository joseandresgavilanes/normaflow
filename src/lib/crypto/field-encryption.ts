import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Field-level encryption factory, AES-256-GCM. The key is derived once per
 * passphrase env var via scrypt (so the env var can be any passphrase, not a
 * raw 32-byte key).
 *
 * This is defense in depth on top of RLS + a module permission gate — those
 * already control *who* can query the row; this protects the column content
 * itself (at rest in a DB dump/backup, or if RLS is ever misconfigured). It
 * does not replace transport encryption (TLS, already enforced by Supabase)
 * or disk-level encryption (provided by the managed Postgres host) — those
 * are separate, already-covered layers.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function createFieldCipher(envVar: string, salt: string, purpose: string) {
  let cachedKey: Buffer | null = null;
  function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const passphrase = process.env[envVar]?.trim();
    if (!passphrase) {
      throw new Error(`${envVar} no está configurada. Es obligatoria para ${purpose}.`);
    }
    cachedKey = scryptSync(passphrase, salt, 32);
    return cachedKey;
  }

  /** Returns null unencrypted (never throws on empty input — nothing to protect). */
  function encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null || plaintext === "") return null;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // v1:<iv>:<authTag>:<ciphertext>, all base64 — versioned so the format can evolve.
    return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
  }

  /** Returns the original plaintext, or the raw stored value if it isn't in the expected encrypted format (defensive — never throws on read). */
  function decrypt(stored: string | null | undefined): string | null {
    if (stored == null || stored === "") return null;
    const parts = stored.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") return stored; // legacy/plaintext row — surface as-is rather than fail closed on read
    try {
      const [, ivB64, authTagB64, ciphertextB64] = parts;
      const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
      return plaintext.toString("utf8");
    } catch {
      return `[dato ilegible — verifica ${envVar}]`;
    }
  }

  return { encrypt, decrypt };
}

/** Occupational-health data (exposure, protocol, restrictions on `OccupationalHealthSurveillance`) — ISO 45001 §7.1.2. */
const healthCipher = createFieldCipher(
  "HEALTH_DATA_ENCRYPTION_KEY",
  "normaflow-health-surveillance-v1",
  "registrar vigilancia de la salud (ISO 45001 §7.1.2/privacidad de datos de salud)",
);
export const encryptHealthField = healthCipher.encrypt;
export const decryptHealthField = healthCipher.decrypt;

/** Speak-up channel reporter identity (name, email, phone on `SpeakUpReport`) — ISO 37301 §8.3 / ISO 37002. */
const speakUpCipher = createFieldCipher(
  "SPEAKUP_DATA_ENCRYPTION_KEY",
  "normaflow-speak-up-channel-v1",
  "recibir denuncias identificadas o confidenciales en el canal de denuncias (ISO 37301 §8.3)",
);
export const encryptSpeakUpField = speakUpCipher.encrypt;
export const decryptSpeakUpField = speakUpCipher.decrypt;

/**
 * Medical device vigilance narrative text (Complaint.description/investigationSummary,
 * AdverseEvent.description, PostMarketSurveillance.findings, FieldSafetyAction.reason)
 * — ISO 13485 §8.2/§8.3. `assertNoUnnecessaryPersonalData` already rejects obvious PII
 * patterns (emails, long digit sequences, clinical keywords) before these fields are
 * written, but free text can still carry subtler personal/clinical context that the
 * heuristic misses — this encrypts the column at rest as a second layer. It does NOT
 * apply to `anonymizedSubjectRef`/`customerAccountRef`: those are meant to stay short
 * opaque codes (validated by a DB CHECK against email/digit patterns), and encrypting
 * them would defeat that check by hiding the plaintext the CHECK inspects.
 */
const mdSensitiveCipher = createFieldCipher(
  "MD_SENSITIVE_DATA_ENCRYPTION_KEY",
  "normaflow-medical-devices-vigilance-v1",
  "registrar quejas, eventos adversos, PMS o acciones de campo de dispositivos médicos (ISO 13485 §8.2/§8.3)",
);
export const encryptMdSensitiveField = mdSensitiveCipher.encrypt;
export const decryptMdSensitiveField = mdSensitiveCipher.decrypt;
