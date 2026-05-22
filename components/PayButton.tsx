"use client";

/**
 * PayButton
 *
 * Payment flow:
 * 1. User logs in with Google (zkLogin) — this is the ONLY login.
 * 2. When they click Pay, if Slush wallet is not connected, a small
 *    inline prompt appears asking them to connect Slush for signing.
 * 3. Once Slush is connected, the transaction is built and sent.
 * 4. Slush signs it — user approves in the extension popup.
 * 5. txDigest is returned to the backend to record access.
 *
 * Dev mode (localhost): mock payment, no wallet needed.
 */

import { useState, useRef, useEffect } from "react";
import { useDAppKit, useCurrentAccount, useWallets } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from "sonner";
import { formatSui } from "@/lib/pricing";

interface PayButtonProps {
  videoId: string;
  priceMist: string;
  creatorAddress: string;
  onSuccess: (txDigest: string) => void;
  disabled?: boolean;
  label?: string;
}

const PLATFORM_FEE_BPS = 1000n;

export function PayButton({
  videoId,
  priceMist,
  creatorAddress,
  onSuccess,
  disabled = false,
  label,
}: PayButtonProps) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const wallets = useWallets();
  const [paying, setPaying] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showWalletPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowWalletPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showWalletPicker]);

  const isDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const connectWallet = async (wallet: ReturnType<typeof useWallets>[number]) => {
    setConnecting(true);
    try {
      await dAppKit.connectWallet({ wallet });
      setShowWalletPicker(false);
      toast.success(`${wallet.name} connected`);
    } catch {
      toast.error("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handlePay = async () => {
    // Dev mock
    if (isDev) {
      setPaying(true);
      await new Promise((r) => setTimeout(r, 600));
      const mockDigest = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      toast.info("Dev mode: mock payment");
      onSuccess(mockDigest);
      setPaying(false);
      return;
    }

    // Production: need wallet connected
    if (!account) {
      setShowWalletPicker(true);
      return;
    }

    const treasuryAddress = process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS;
    if (!treasuryAddress) {
      toast.error("Platform treasury not configured");
      return;
    }

    setPaying(true);
    try {
      const totalMist = BigInt(priceMist);
      const feeMist = (totalMist * PLATFORM_FEE_BPS) / 10000n;
      const creatorMist = totalMist - feeMist;

      const tx = new Transaction();
      tx.setSender(account.address);
      const [creatorCoin, feeCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(creatorMist),
        tx.pure.u64(feeMist),
      ]);
      tx.transferObjects([creatorCoin], tx.pure.address(creatorAddress));
      tx.transferObjects([feeCoin], tx.pure.address(treasuryAddress));

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      const digest =
        "digest" in result
          ? (result as { digest: string }).digest
          : result.$kind === "Transaction"
          ? result.Transaction.digest
          : null;

      if (!digest) { toast.error("Could not get transaction digest"); return; }
      toast.success("Payment confirmed!");
      onSuccess(digest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) {
        toast.info("Payment cancelled");
      } else {
        toast.error(`Payment failed: ${msg}`);
      }
    } finally {
      setPaying(false);
    }
  };

  const btnLabel = label ?? `Pay ${formatSui(priceMist)} SUI`;

  return (
    <div style={{ position: "relative" }}>
      {/* Main pay button */}
      <button
        onClick={handlePay}
        disabled={disabled || paying || connecting}
        className="btn btn-primary btn-full"
        style={{ gap: "0.625rem" }}
      >
        {paying ? (
          <>
            <div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
            Waiting for Slush...
          </>
        ) : connecting ? (
          <>
            <div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
            Connecting...
          </>
        ) : (
          <>
            <SuiIcon />
            {!account && !isDev ? "Connect Slush to Pay" : btnLabel}
          </>
        )}
      </button>

      {/* Connected wallet indicator */}
      {account && !paying && (
        <p style={{ fontSize: "0.75rem", textAlign: "center", color: "#475569", marginTop: "0.375rem" }}>
          via{" "}
          <span style={{ color: "#a855f7", fontFamily: "monospace" }}>
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </span>
          {" · "}
          <button
            onClick={() => dAppKit.disconnectWallet()}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
          >
            disconnect
          </button>
        </p>
      )}

      {/* Wallet picker dropdown */}
      {showWalletPicker && (
        <div
          ref={pickerRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 0.5rem)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#0f0a2e",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: "0.875rem",
            padding: "1rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.75rem" }}>
            Connect Slush wallet to pay
          </p>

          {wallets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "0.75rem 0" }}>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.625rem" }}>
                No wallets detected
              </p>
              <a
                href="https://slush.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ display: "inline-flex" }}
              >
                Install Slush →
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => connectWallet(wallet)}
                  disabled={connecting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.875rem",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0.625rem",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.08)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                >
                  {wallet.icon ? (
                    <img src={wallet.icon} alt={wallet.name} style={{ width: "28px", height: "28px", borderRadius: "6px" }} />
                  ) : (
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", fontWeight: 700, fontSize: "0.875rem" }}>
                      {wallet.name[0]}
                    </div>
                  )}
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#f8fafc" }}>{wallet.name}</span>
                  <span style={{ marginLeft: "auto", color: "#475569", fontSize: "0.875rem" }}>→</span>
                </button>
              ))}
            </div>
          )}

          <p style={{ fontSize: "0.75rem", color: "#334155", marginTop: "0.75rem", textAlign: "center" }}>
            Use the same Google account as your zkLogin
          </p>
        </div>
      )}
    </div>
  );
}

function SuiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">S</text>
    </svg>
  );
}
