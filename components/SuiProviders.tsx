"use client";

/**
 * SuiProviders — minimal wrapper that provides a Sui RPC client.
 * No wallet connection UI — authentication is handled entirely by zkLogin.
 * The zkLogin Sui address from the session is used directly for payments.
 */

import { createDAppKit } from "@mysten/dapp-kit-core";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet" | "mainnet" | "devnet";

const RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getJsonRpcFullnodeUrl(NETWORK);

const dAppKit = createDAppKit({
  networks: [NETWORK],
  createClient: (network: string) =>
    new SuiJsonRpcClient({
      url: network === NETWORK ? RPC_URL : getJsonRpcFullnodeUrl(network as "testnet" | "mainnet" | "devnet"),
      network: network as "testnet" | "mainnet" | "devnet",
    }),
  defaultNetwork: NETWORK,
  // No slushWalletConfig — we don't want a separate wallet connection
});

export function SuiProviders({ children }: { children: React.ReactNode }) {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      {children}
    </DAppKitProvider>
  );
}

export { dAppKit };
