import { Redirect } from "expo-router";

// The in-flight browser adapter alone consumes the return and proves possession
// of its verifier. A cold start or an unsolicited deep link never logs anyone in.
export default function AppleAuthReturn() {
  return <Redirect href="/(public)/login" />;
}
