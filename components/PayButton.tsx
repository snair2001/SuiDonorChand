"use client";

/**
 * PayButton
 *
 * Single-login flow: user logs in once with Google (zkLogin).
 * Their zkLogin Sui address is used as the payment sender.
 *
 * Dev mode (localhost): uses a mock tx digest — no wallet needed.
 * Production: uses Slush wallet which natively supports zkLogin.
 *   The user signs in to Slush with the same Google account — no
 *   separate "Connect Wallet" step is shown in the UI.
 */

import { useState } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
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
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      // ── Dev / localhost: mock payment ──────────────────────────────────────
      const isDev =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      if (isDev) {
        await new Promise((r) => setTimeout(r, 800)); // simulate delay
        const mockDigest = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        toast.info("Dev mode: mock payment used");
        onSuccess(mockDigest);
        return;
      }

      // ── Production: sign with connected wallet ─────────────────────────────
      const treasuryAddress = process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS;
      if (!treasuryAddress) {
        toast.error("Platform treasury address not configured");
        return;
      }

      if (!account) {
        toast.error(
          "No wallet connected. Open Slush wallet and sign in with your Google account, then try again."
        );
        return;
      }

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

      // Extract digest from result union type
      const digest =
        "digest" in result
          ? (result as { digest: string }).digest
          : result.$kind === "Transaction"
          ? result.Transaction.digest
          : null;

      if (!digest) {
        toast.error("Could not get transaction digest from wallet");
        return;
      }

      toast.success("Payment confirmed!");
      onSuccess(digest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("reject") ||
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("denied")
      ) {
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
    <button
      onClick={handlePay}
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
          Processing...
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
      <circle cx="16" cy="16" r="15" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">S</text>
    </svg>
  );
}
