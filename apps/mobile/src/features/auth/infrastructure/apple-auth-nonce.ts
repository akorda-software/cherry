import * as Crypto from "expo-crypto";

interface CryptoModule {
  CryptoDigestAlgorithm: {
    SHA256: string;
  };
  CryptoEncoding: {
    HEX: string;
  };
  getRandomBytes(length: number): Uint8Array;
  digestStringAsync(
    algorithm: string,
    data: string,
    options: { encoding: string }
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
