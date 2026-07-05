/**
 * Decodifica uma string Base32 para um Uint8Array.
 */
function base32ToBuf(str: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanStr = str.toUpperCase().replace(/=+$/, "");
  const len = cleanStr.length;
  const buf = new Uint8Array(Math.floor((len * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < len; i++) {
    const val = alphabet.indexOf(cleanStr[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buf[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buf;
}

/**
 * Gera um código TOTP de 6 dígitos usando a Web Crypto API nativa.
 */
export async function generateTOTP(secret: string, time: number = Date.now()): Promise<string> {
  try {
    const keyBytes = base32ToBuf(secret);
    const epoch = Math.floor(time / 1000);
    const timeStep = Math.floor(epoch / 30);
    
    // Converte o timeStep para um buffer de 8 bytes big-endian
    const msg = new Uint8Array(8);
    let temp = timeStep;
    for (let i = 7; i >= 0; i--) {
      msg[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    // Importa a chave para HMAC-SHA1
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    // Assina a mensagem
    const signature = await window.crypto.subtle.sign("HMAC", key, msg);
    const hmac = new Uint8Array(signature);

    // Truncamento dinâmico (Dynamic Truncation)
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = code % 1000000;
    return String(otp).padStart(6, "0");
  } catch (e) {
    console.error("Erro ao gerar TOTP:", e);
    return "";
  }
}

/**
 * Valida um código TOTP com uma janela de tolerância de 1 passo (30 segundos) para clock drift.
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const now = Date.now();
  // Verifica o passo atual, o anterior e o próximo
  for (let i = -1; i <= 1; i++) {
    const generated = await generateTOTP(secret, now + i * 30000);
    if (generated === code && code !== "") return true;
  }
  return false;
}