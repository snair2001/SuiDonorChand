"use client";

/**
 * SlushPayButton
 * Full Slush wallet payment flow:
 *   1. If no wallet connected → open connect modal
 *   2. Build SUI transfer: 90% to creator, 10% to platform treasury
 *   3. Sign & execute via connected wallet (Slush extension / web / mobile)
 *   4. Return txDigest to parent for backend recording
 */

import { useState } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from "sonner";
import { formatSui } from "@/lib/pricing";
import { SlushConnectModal } from "./SlushConnectModal";

interface SlushPayButtonProps {
  videoId: string;
  priceMist: string;
  creatorAddress: string;
  onSuccess: (txDigest: string) => void;
  disabled?: boolean;
  label?: string;
}

const PLATFORM_FEE_BPS = 1000n; // 10%

export function SlushPayButton({
  videoId,
  priceMist,
  creatorAddress,
  onSuccess,
  disabled = false,
  label,
}: SlushPayButtonProps) {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const [paying, setPaying] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  const treasuryAddress = process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS;
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet";

  const handlePay = async () => {
    if (!account) {
      setShowConnect(true);
      return;
    }

    if (!treasuryAddress) {
      toast.error("Platform treasury address not configured");
      return;
    }

    setPaying(true);
    try {
      const totalMist = BigInt(priceMist);
      const platformFeeMist = (totalMist * PLATFORM_FEE_BPS) / 10000n;
      const creatorMist = totalMist - platformFeeMist;

      // Build programmable transaction
      const tx = new Transaction();
      tx.setSender(account.address);

      // Split gas coin into two payment amounts
      const [creatorCoin, feeCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(creatorMist),
        tx.pure.u64(platformFeeMist),
      ]);

      // 90% → creator
      tx.transferObjects([creatorCoin], tx.pure.address(creatorAddress));
      // 10% → platform treasury
      tx.transferObjects([feeCoin], tx.pure.address(treasuryAddress));

      // Sign and execute via Slush wallet
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
      });

      // Extract digest from the result union type
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

  const buttonLabel =
    label ?? (account ? `Pay ${formatSui(priceMist)} SUI` : "Connect Slush to Pay");

  return (
    <>
      <button
        onClick={handlePay}
        disabled={disabled || paying}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {paying ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Waiting for Slush...
          </>
        ) : (
          <>
            <SlushIcon />
            {buttonLabel}
          </>
        )}
      </button>

      {/* Show connected address */}
      {account && !paying && (
        <p className="text-xs text-center text-gray-500 mt-1">
          via{" "}
          <span className="text-purple-400 font-mono">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </span>
        </p>
      )}

      <SlushConnectModal
        open={showConnect}
        onClose={() => setShowConnect(false)}
      />
    </>
  );
}

function SlushIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#6366f1" />
      <path
        d="M8 20c2-4 6-8 8-8s6 4 8 8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="14" r="2.5" fill="white" />
    </svg>
  );
}
