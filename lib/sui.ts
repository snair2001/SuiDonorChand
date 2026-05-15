/**
 * Sui blockchain utilities
 * Handles transaction verification and payment processing
 * Uses direct JSON-RPC calls for compatibility with @mysten/sui v2.x
 */

const SUI_RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ||
  "https://fullnode.testnet.sui.io:443";

// ─── JSON-RPC Helper ──────────────────────────────────────────────────────────

async function suiRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SUI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sui RPC error: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Sui RPC error: ${JSON.stringify(data.error)}`);
  }

  return data.result as T;
}

// ─── Transaction Verification ─────────────────────────────────────────────────

export interface PaymentVerification {
  valid: boolean;
  senderAddress?: string;
  recipientAddress?: string;
  amountMist?: bigint;
  error?: string;
}

interface SuiTransactionBlock {
  effects?: {
    status?: { status: string; error?: string };
  };
  transaction?: {
    data?: { sender?: string };
  };
  balanceChanges?: Array<{
    owner: unknown;
    coinType: string;
    amount: string;
  }>;
}

/**
 * Verify a SUI payment transaction
 * Checks that the transaction exists and sent funds to the expected address
 */
export async function verifyPaymentTransaction(
  txDigest: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountMist: bigint
): Promise<PaymentVerification> {
  // Allow mock payments in development
  if (
    process.env.ALLOW_MOCK_PAYMENT === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    if (txDigest.startsWith("MOCK_")) {
      return {
        valid: true,
        senderAddress: expectedSender,
        recipientAddress: expectedRecipient,
        amountMist: expectedAmountMist,
      };
    }
  }

  try {
    const tx = await suiRpc<SuiTransactionBlock>(
      "sui_getTransactionBlock",
      [
        txDigest,
        {
          showEffects: true,
          showInput: true,
          showBalanceChanges: true,
        },
      ]
    );

    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    // Check transaction status
    if (tx.effects?.status?.status !== "success") {
      return {
        valid: false,
        error: `Transaction failed: ${tx.effects?.status?.error}`,
      };
    }

    // Check sender
    const sender = tx.transaction?.data?.sender;
    if (sender?.toLowerCase() !== expectedSender.toLowerCase()) {
      return {
        valid: false,
        error: `Sender mismatch: expected ${expectedSender}, got ${sender}`,
      };
    }

    // Check balance changes for payment to creator/treasury
    const balanceChanges = tx.balanceChanges || [];
    let totalSentToRecipient = 0n;

    for (const change of balanceChanges) {
      if (
        change.owner &&
        typeof change.owner === "object" &&
        "AddressOwner" in change.owner
      ) {
        const addr = (change.owner as { AddressOwner: string }).AddressOwner;
        if (addr.toLowerCase() === expectedRecipient.toLowerCase()) {
          const amount = BigInt(change.amount);
          if (amount > 0n) {
            totalSentToRecipient += amount;
          }
        }
      }
    }

    // Allow 1% tolerance for gas
    const tolerance = expectedAmountMist / 100n;
    if (totalSentToRecipient < expectedAmountMist - tolerance) {
      return {
        valid: false,
        error: `Insufficient payment: expected ${expectedAmountMist} MIST, got ${totalSentToRecipient} MIST`,
      };
    }

    return {
      valid: true,
      senderAddress: sender,
      recipientAddress: expectedRecipient,
      amountMist: totalSentToRecipient,
    };
  } catch (err) {
    console.error("Transaction verification error:", err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}

/**
 * Get current Sui epoch
 */
export async function getCurrentEpoch(): Promise<number> {
  try {
    const state = await suiRpc<{ epoch: string }>(
      "suix_getLatestSuiSystemState",
      []
    );
    return parseInt(state.epoch);
  } catch {
    return 0;
  }
}

/**
 * Format Sui address for display (truncated)
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validate Sui address format
 */
export function isValidSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}
