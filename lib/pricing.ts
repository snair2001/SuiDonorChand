/**
 * Pricing utilities for SUI/USD conversion
 * Uses integer MIST to avoid floating point errors
 */

export const MIST_PER_SUI = 1_000_000_000n; // 1 SUI = 1,000,000,000 MIST

/**
 * Get SUI/USD price (with fallback)
 */
export async function getSuiUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
      { next: { revalidate: 300 } } // cache 5 min
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.sui?.usd && typeof data.sui.usd === "number") {
        return data.sui.usd;
      }
    }
  } catch {
    // fall through to fallback
  }
  return parseFloat(process.env.SUI_USD_FALLBACK || "1.5");
}

/**
 * Get ETH/USD price (with fallback)
 */
export async function getEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 300 } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.ethereum?.usd && typeof data.ethereum.usd === "number") {
        return data.ethereum.usd;
      }
    }
  } catch {
    // fall through to fallback
  }
  return parseFloat(process.env.ETH_USD_FALLBACK || "3000");
}

/**
 * Convert MIST to USD
 */
export async function mistToUsd(mistAmount: bigint): Promise<number> {
  const suiPrice = await getSuiUsdPrice();
  const suiAmount = Number(mistAmount) / Number(MIST_PER_SUI);
  return suiAmount * suiPrice;
}

/**
 * Convert SUI to MIST (bigint)
 */
export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * Number(MIST_PER_SUI)));
}

/**
 * Convert MIST to SUI (number)
 */
export function mistToSui(mist: bigint): number {
  return Number(mist) / Number(MIST_PER_SUI);
}

/**
 * Convert USD to MIST using current price
 */
export async function usdToMist(usd: number): Promise<bigint> {
  const suiPrice = await getSuiUsdPrice();
  const suiAmount = usd / suiPrice;
  return BigInt(Math.round(suiAmount * Number(MIST_PER_SUI)));
}

/**
 * Calculate platform fee and creator amount
 */
export function calculateFees(
  grossUsd: number,
  feePercentage: number = 10
): {
  platformFeeUsd: number;
  creatorAmountUsd: number;
} {
  const platformFeeUsd = Math.round(grossUsd * feePercentage) / 100;
  const creatorAmountUsd = Math.round(grossUsd * (100 - feePercentage)) / 100;
  return { platformFeeUsd, creatorAmountUsd };
}

/**
 * Format MIST as SUI string
 */
export function formatSui(mist: bigint | string): string {
  const mistBig = typeof mist === "string" ? BigInt(mist) : mist;
  const sui = Number(mistBig) / Number(MIST_PER_SUI);
  return sui.toFixed(4);
}
