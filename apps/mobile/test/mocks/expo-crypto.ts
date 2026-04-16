export const CryptoDigestAlgorithm = {
  SHA256: "sha256"
};

export const CryptoEncoding = {
  HEX: "hex"
};

export const getRandomBytes = vi.fn((length: number) => new Uint8Array(length));

export const digestStringAsync = vi.fn(async () => "mock-digest");
