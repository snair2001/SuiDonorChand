"use client";

import { useState } from "react";

interface WalletStatusProps {
  email: string;
  suiAddress: string;
}

export function WalletStatus({ email, suiAddress }: WalletStatusProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(suiAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 10)}...${addr.slice(-8)}`;

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm text-gray-400">Connected via zkLogin</span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Email</p>
          <p className="text-sm text-white">{email}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Sui Address (Testnet)</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-purple-300 font-mono bg-purple-500/10 px-2 py-1 rounded">
              {formatAddress(suiAddress)}
            </code>
            <button
              onClick={copyAddress}
              className="text-xs text-gray-400 hover:text-white transition-colors"
              title="Copy full address"
            >
              {copied ? (
                <span className="text-green-400">✓ Copied</span>
              ) : (
                <span>Copy</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/10">
        <a
          href={`https://suiexplorer.com/address/${suiAddress}?network=testnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View on Sui Explorer →
        </a>
      </div>
    </div>
  );
}
