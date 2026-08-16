import app from "../api/x402/official";
import { readAlgorandX402Config } from "../src/lib/x402-algorand";

const config = readAlgorandX402Config();
const port = Number(process.env.ALGORAND_X402_PORT ?? 8791);

if (!config.payTo) {
  console.error("ALGORAND_PAY_TO is required to run the Algorand x402 resource server.");
  process.exit(1);
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Algorand x402 resource listening on http://127.0.0.1:${port}`);
  console.log(`Network: ${config.network}`);
  console.log(`Facilitator: ${config.facilitatorUrl}`);
  console.log(`Pay to: ${config.payTo}`);
});
