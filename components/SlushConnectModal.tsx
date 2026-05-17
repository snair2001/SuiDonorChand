"use client";

/**
 * SlushConnectModal — custom wallet selection modal.
 * Lists all detected wallets (Slush extension, Slush web, etc.)
 * and connects the chosen one via dAppKit.
 */

import { useWallets, useDAppKit } from "@mysten/dapp-kit-react";
import { useEffect, useRef } from "react";

interface SlushConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export function SlushConnectModal({ open, onClose }: SlushConnectModalProps) {
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleConnect = async (wallet: ReturnType<typeof useWallets>[number]) => {
    try {
      await dAppKit.connectWallet({ wallet });
      onClose();
    } catch {
      // user cancelled or wallet unavailable
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm space-y-5 border border-purple-500/20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Select a Sui wallet to pay
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Wallet list */}
        {wallets.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-4xl">🔌</div>
            <p className="text-sm text-gray-400">No wallets detected</p>
            <a
              href="https://slush.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 text-sm rounded-xl transition-all"
            >
              Get Slush Wallet →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl transition-all text-left"
              >
                {wallet.icon ? (
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    className="w-8 h-8 rounded-lg"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-purple-600/30 flex items-center justify-center text-purple-300 text-sm font-bold">
                    {wallet.name[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">{wallet.name}</p>
                  <p className="text-xs text-gray-500">
                    {wallet.accounts?.length
                      ? `${wallet.accounts.length} account${wallet.accounts.length > 1 ? "s" : ""}`
                      : "Click to connect"}
                  </p>
                </div>
                <span className="ml-auto text-gray-500 text-sm">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Slush download hint */}
        <div className="pt-2 border-t border-white/10 text-center">
          <p className="text-xs text-gray-600">
            Don&apos;t have Slush?{" "}
            <a
              href="https://slush.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Download at slush.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
