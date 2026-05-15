"use client";

interface RevenueProgressProps {
  totalGrossRevenueUsd: number;
  revenueCapUsd: number;
  totalCreatorRevenueUsd: number;
  totalPlatformRevenueUsd: number;
  purchaseCount: number;
  isSoldOut: boolean;
}

export function RevenueProgress({
  totalGrossRevenueUsd,
  revenueCapUsd,
  totalCreatorRevenueUsd,
  totalPlatformRevenueUsd,
  purchaseCount,
  isSoldOut,
}: RevenueProgressProps) {
  const percentage = Math.min(
    (totalGrossRevenueUsd / revenueCapUsd) * 100,
    100
  );

  const getBarColor = () => {
    if (isSoldOut) return "bg-red-500";
    if (percentage >= 80) return "bg-orange-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-gradient-to-r from-purple-500 to-blue-500";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Revenue Progress</span>
        <span className={isSoldOut ? "text-red-400" : "text-white"}>
          ${totalGrossRevenueUsd.toFixed(2)} / ${revenueCapUsd.toFixed(2)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="glass-card rounded-lg p-2">
          <p className="text-xs text-gray-500">Purchases</p>
          <p className="text-sm font-semibold text-white">{purchaseCount}</p>
        </div>
        <div className="glass-card rounded-lg p-2">
          <p className="text-xs text-gray-500">Creator Earned</p>
          <p className="text-sm font-semibold text-green-400">
            ${totalCreatorRevenueUsd.toFixed(2)}
          </p>
        </div>
        <div className="glass-card rounded-lg p-2">
          <p className="text-xs text-gray-500">Platform Fee</p>
          <p className="text-sm font-semibold text-blue-400">
            ${totalPlatformRevenueUsd.toFixed(2)}
          </p>
        </div>
      </div>

      {isSoldOut && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span>🔒</span>
          <span>Revenue cap reached — no new purchases allowed</span>
        </div>
      )}
    </div>
  );
}
