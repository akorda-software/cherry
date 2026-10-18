import * as Crypto from "expo-crypto";
import type * as WebBrowser from "expo-web-browser";
import type { HttpClient } from "@cherry/mobile-shared";

import { createAppleAuthNonce } from "./apple-auth-nonce";
import type { AppleCredential } from "./apple-provider";

interface Options {
  httpClient: HttpClient;
  browser: Pick<typeof WebBrowser, "openAuthSessionAsync">;
  scheme: string;
  cryptoModule?: typeof Crypto;
}

export function createAppleBrowserAdapter({
  httpClient,
  browser,
  scheme,
  cryptoModule = Crypto
}: Options) {
  return {
    async signIn(): Promise<AppleCredential> {
      if (
        !/^[a-z][a-z0-9+.-]*$/i.test(scheme) ||
        /^(https?|exp|exps|intent|file|data|javascript)$/i.test(scheme)
      ) {
        throw new Error("Apple browser return scheme is not configured");
      }

      const redirectUri = `${scheme}://auth/apple`;
      const { hashedNonce } = await createAppleAuthNonce(cryptoModule);
      const { rawNonce: verifier } = await createAppleAuthNonce(cryptoModule);
      const { rawNonce: state } = await createAppleAuthNonce(cryptoModule);
      const challenge = (
        await cryptoModule.digestStringAsync(
          cryptoModule.CryptoDigestAlgorithm.SHA256,
          verifier,
          { encoding: cryptoModule.CryptoEncoding.BASE64 }
        )
      ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const { authorizationUrl } = await httpClient.post<{ authorizationUrl: string }>(
        "/api/auth/apple/browser",
        { codeChallenge: challenge, nonce: hashedNonce, state, redirectUri }
      );

      // Never open an arbitrary URL supplied by a server or expose tokens in a
      // browser URL. Apple returns its code to the backend over HTTPS form_post.
      let authorization: URL;
      try {
        authorization = new URL(authorizationUrl);
      } catch {
        throw new Error("Invalid Apple authorization URL");
      }
      if (
        authorization.origin !== "https://appleid.apple.com" ||
        authorization.pathname !== "/auth/authorize" ||
        authorization.username || authorization.password || authorization.hash ||
        authorization.searchParams.get("nonce") !== hashedNonce ||
        authorization.searchParams.get("response_type") !== "code"
      ) {
        throw new Error("Invalid Apple authorization URL");
      }

      const result = await browser.openAuthSessionAsync(authorizationUrl, redirectUri);
      if (result.type === "cancel" || result.type === "dismiss") {
        throw Object.assign(new Error("Apple Sign-In cancelled"), { code: "ERR_REQUEST_CANCELED" });
      }
      if (result.type !== "success") throw new Error("Apple Sign-In did not complete");

      let returned: URL;
      try {
        returned = new URL(result.url);
      } catch {
        throw new Error("Invalid Apple app return");
      }
      if (
        `${returned.protocol}//${returned.host}${returned.pathname}` !== redirectUri ||
        returned.username || returned.password || returned.hash ||
        returned.searchParams.getAll("state").length !== 1 ||
        returned.searchParams.get("state") !== state ||
        Array.from(returned.searchParams.keys()).some((key) => !["state", "code", "error"].includes(key))
      ) {
        throw new Error("Invalid Apple app return");
      }
      if (returned.searchParams.has("error")) throw new Error("Apple Sign-In failed. Please try again.");
      const grant = returned.searchParams.get("code");
      if (returned.searchParams.getAll("code").length !== 1 || !grant || !/^[A-Za-z0-9_-]{43}$/.test(grant)) {
        throw new Error("Invalid Apple app return");
      }

      // Opaque, one-use handoff + proof of possession, not an Apple identity token.
      return { providerToken: `apple-browser:${grant}`, nonce: verifier };
    }
  };
}
