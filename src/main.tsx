import React from "react";
import ReactDOM from "react-dom/client";
import { WalletManager, WalletProvider } from "@txnlab/use-wallet-react";
import { pera } from "@txnlab/use-wallet-pera";
import App from "./App";
import "./styles.css";

const walletManager = new WalletManager({
  wallets: [pera({ chainId: 416002 })],
  defaultNetwork: "testnet",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </React.StrictMode>,
);
