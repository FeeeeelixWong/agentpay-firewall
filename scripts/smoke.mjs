const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8787";

const response = await fetch(`${baseUrl}/api/paid/allowed-risk-scan`);

if (response.status !== 402) {
  throw new Error(`Expected 402 challenge, got ${response.status}`);
}

const challenge = response.headers.get("PAYMENT-REQUIRED");

if (!challenge) {
  throw new Error("Expected PAYMENT-REQUIRED header");
}

console.log("Smoke check passed: API returns a PAYMENT-REQUIRED challenge.");
