import * as Crypto from "expo-crypto";

type CryptoDigestAlgorithmValue =
  (typeof Crypto.CryptoDigestAlgorithm)[keyof typeof Crypto.CryptoDigestAlgorithm];
type CryptoEncodingValue =
  (typeof Crypto.CryptoEncoding)[keyof typeof Crypto.CryptoEncoding];

interface CryptoModule {
  CryptoDigestAlgorithm: { SHA256: CryptoDigestAlgorithmValue };
  CryptoEncoding: { HEX: CryptoEncodingValue };
  getRandomBytes(length: number): Uint8Array;
  digestStringAsync(
    algorithm: CryptoDigestAlgorithmValue,
    data: string,
    options: { encoding: CryptoEncodingValue }
  ): Promise<string>;
}

export async function createAppleAuthNonce(cryptoModule: CryptoModule = Crypto) {
  const rawNonce = bytesToHex(cryptoModule.getRandomBytes(32));
  const hashedNonce = await cryptoModule.digestStringAsync(
    cryptoModule.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: cryptoModule.CryptoEncoding.HEX }
  );

  return {
    rawNonce,
    hashedNonce
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
