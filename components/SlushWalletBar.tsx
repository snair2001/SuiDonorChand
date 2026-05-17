"use client";

/**
 * SlushWalletBar — shows connected wallet address in the Navbar.
 * Opens the connect modal when no wallet is connected.
 */

import { useState } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { SlushConnectModal } from "./SlushConnectModal";

export function SlushWalletBar() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const [showConnect, setShowConnect] = useState(false);

  if (!account) {
    return (
      <>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg transition-all"
          title="Connect Slush wallet to make payments"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          Connect Wallet
        </button>
        <SlushConnectModal
          open={showConnect}
          onClose={() => setShowConnect(false)}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono">
          {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </span>
      </div>
      <button
        onClick={() => dAppKit.disconnectWallet()}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        title="Disconnect wallet"
      >
        ✕
      </button>
    </div>
  );
}
