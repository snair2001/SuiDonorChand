"use client";

/**
 * PayButton — Slush Wallet Payment
 *
 * Flow:
 * 1. If wallet not connected → show "Connect Slush Wallet" button
 *    → calls kit.connectWallet() which opens the Slush popup
 * 2. Once connected → show price + confirm dialog
 * 3. On confirm → build SUI transfer Transaction, sign+execute via Slush
 * 4. On success → call onSuccess(txDigest)
 */

import { useState } from "react";
import { toast } from "sonner";
import { formatSui } from "@/lib/pricing";
import { useWallets, useWalletConnection, useDAppKit } from "@mysten/dapp-kit-react";
import { dAppKit } from "@/components/SuiProviders";
import { Transaction } from "@mysten/sui/transactions";

interface PayButtonProps {
  videoId: string;
  priceMist: string;
  creatorAddress: string;
  onSuccess: (txDigest: string) => void;
  disabled?: boolean;
  label?: string;
}

export function PayButton({
  videoId: _videoId,
  priceMist,
  creatorAddress,
  onSuccess,
  disabled = false,
  label,
}: PayButtonProps) {
  const [paying, setPaying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const wallets = useWallets({ dAppKit });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connection = useWalletConnection({ dAppKit: dAppKit as any });
  const kit = useDAppKit(dAppKit);

  const isConnected = connection.isConnected;
  const priceSui = (Number(BigInt(priceMist)) / 1_000_000_000).toFixed(4);
  const btnLabel = label ?? `Pay ${formatSui(priceMist)} SUI`;

  // ── Step 1: Connect wallet ────────────────────────────────────────────────
  const handleConnect = async () => {
    // slushWalletConfig ensures Slush is always registered as the first wallet
    const wallet = wallets[0];

    if (!wallet) {
      toast.error("Slush wallet is not available. Please try refreshing the page.");
      return;
    }

    setConnecting(true);
    try {
      await kit.connectWallet({ wallet });
      // Connection success is reflected via useWalletConnection re-render
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("reject")) {
        console.error("[PayButton] connect error:", err);
        toast.error("Failed to connect wallet. Please try again.");
      }
    } finally {
      setConnecting(false);
    }
  };

  // ── Step 2: Show confirm dialog ───────────────────────────────────────────
  const handleClickPay = () => {
    setShowConfirm(true);
  };

  // ── Step 3: Build tx, sign & execute via Slush ────────────────────────────
  const handleConfirm = async () => {
    setShowConfirm(false);
    setPaying(true);
    try {
      const tx = new Transaction();
      // Split priceMist MIST from gas coin and transfer to creator
      const [coin] = tx.splitCoins(tx.gas, [BigInt(priceMist)]);
      tx.transferObjects([coin], creatorAddress);

      const result = await kit.signAndExecuteTransaction({ transaction: tx });

      // result is a discriminated union: { $kind: "Transaction", Transaction: { digest, ... } }
      const digest =
        result.$kind === "Transaction"
          ? result.Transaction.digest
          : (result as unknown as { digest: string }).digest;

      toast.success("Payment confirmed on Sui testnet!");
      onSuccess(digest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("reject")) {
        toast.info("Payment cancelled.");
      } else {
        console.error("[PayButton] tx error:", err);
        toast.error("Payment failed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  };

  // ── Render: not connected ─────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={disabled || connecting}
        className="btn btn-primary btn-full"
        style={{ gap: "0.625rem" }}
      >
        {connecting ? (
          <>
            <div
              className="spinner spinner-sm"
              style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }}
            />
            Connecting...
          </>
        ) : (
          <>
            <SuiIcon />
            Connect Slush Wallet
          </>
        )}
      </button>
    );
  }

  // ── Render: confirm dialog ────────────────────────────────────────────────
  if (showConfirm) {
    const account = connection.isConnected ? connection.account : null;
    return (
      <div
        style={{
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.25)",
          borderRadius: "0.875rem",
          padding: "1rem",
        }}
      >
        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.375rem" }}>
          Confirm Payment
        </p>
        {account && (
          <p style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.25rem" }}>
            From:{" "}
            <code style={{ color: "#94a3b8" }}>
              {account.address.slice(0, 10)}…{account.address.slice(-6)}
            </code>
          </p>
        )}
        <p style={{ fontSize: "0.8125rem", color: "#94a3b8", marginBottom: "0.875rem" }}>
          Pay <strong style={{ color: "#a855f7" }}>{priceSui} SUI</strong> for
          time-limited access on Sui testnet
        </p>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            onClick={handleConfirm}
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
          >
            ✓ Confirm &amp; Sign
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Render: pay button (connected) ────────────────────────────────────────
  return (
    <button
      onClick={handleClickPay}
      disabled={disabled || paying}
      className="btn btn-primary btn-full"
      style={{ gap: "0.625rem" }}
    >
      {paying ? (
        <>
          <div
            className="spinner spinner-sm"
            style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }}
          />
          Signing transaction...
        </>
      ) : (
        <>
          <SuiIcon />
          {btnLabel}
        </>
      )}
    </button>
  );
}

function SuiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
        S
      </text>
    </svg>
  );
}
