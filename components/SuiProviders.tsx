"use client";

/**
 * SuiProviders — wraps the app with dApp Kit v2 + Slush wallet.
 * Must be "use client" — wallet state lives in the browser.
 *
 * Slush (https://slush.app) is the official Sui wallet by Mysten Labs.
 * Supports: Google/Apple zkLogin, recovery passphrase, browser extension,
 * iOS, Android, and web app.
 *
 * The @mysten/slush-wallet package registers the Slush *web app* as a wallet
 * option via the Wallet Standard. The browser extension registers itself
 * automatically — no extra package needed for it.
 */

import { createDAppKit } from "@mysten/dapp-kit-core";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { registerSlushWallet } from "@mysten/slush-wallet";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { useEffect, useRef, useState } from "react";

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet"
  | "devnet";

const RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getJsonRpcFullnodeUrl(NETWORK);

// Create the dAppKit instance once (module-level singleton)
const dAppKit = createDAppKit({
  networks: [NETWORK],
  createClient: (network: string) =>
    new SuiJsonRpcClient({
      url: network === NETWORK ? RPC_URL : getJsonRpcFullnodeUrl(network as "testnet" | "mainnet" | "devnet"),
      network: network as "testnet" | "mainnet" | "devnet",
    }),
  defaultNetwork: NETWORK,
  slushWalletConfig: { appName: "PrivateTube Access Gate" },
});

export function SuiProviders({ children }: { children: React.ReactNode }) {
  const registered = useRef(false);

  useEffect(() => {
    if (!registered.current) {
      // Register Slush web wallet (extension registers itself automatically)
      registerSlushWallet("PrivateTube Access Gate");
      registered.current = true;
    }
  }, []);

  return (
    <DAppKitProvider dAppKit={dAppKit}>
      {children}
    </DAppKitProvider>
  );
}

// Export the singleton so components can use it directly
export { dAppKit };
