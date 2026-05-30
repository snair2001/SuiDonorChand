"use client";

/**
 * SuiProviders — wraps app with dApp Kit + Slush wallet for payment signing.
 * Authentication is handled by zkLogin (Google). Slush is used ONLY for
 * signing payment transactions — it is NOT a second login.
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
  slushWalletConfig: { appName: "PrivateTube Access Gate" },
});

export function SuiProviders({ children }: { children: React.ReactNode }) {
  return <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>;
}

export { dAppKit };
