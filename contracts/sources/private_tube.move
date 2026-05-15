/// PrivateTube Access Gate — Sui Move Contract
/// 
/// This contract handles payment splitting for video access purchases.
/// Video metadata is stored off-chain on Pinata IPFS (encrypted).
/// The contract only handles the payment split logic.
///
/// Payment flow:
/// 1. Viewer calls purchase_access with SUI payment
/// 2. Contract splits: 90% to creator, 10% to platform treasury
/// 3. Emits AccessPurchased event with txDigest for backend verification
module private_tube::private_tube {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};

    // ─── Errors ───────────────────────────────────────────────────────────────

    const EInsufficientPayment: u64 = 1;
    const EInvalidFeePercentage: u64 = 2;
    const EZeroAmount: u64 = 3;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// Emitted when a viewer purchases access to a video
    public struct AccessPurchased has copy, drop {
        video_id: vector<u8>,       // UTF-8 encoded video UUID
        buyer: address,
        creator: address,
        platform_treasury: address,
        total_amount_mist: u64,
        creator_amount_mist: u64,
        platform_fee_mist: u64,
        platform_fee_bps: u64,      // basis points (1000 = 10%)
    }

    // ─── Platform Config ──────────────────────────────────────────────────────

    /// Shared platform configuration object
    public struct PlatformConfig has key {
        id: UID,
        treasury: address,
        fee_bps: u64,               // fee in basis points (1000 = 10%)
        admin: address,
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        let config = PlatformConfig {
            id: object::new(ctx),
            treasury: tx_context::sender(ctx),
            fee_bps: 1000, // 10%
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(config);
    }

    // ─── Public Functions ─────────────────────────────────────────────────────

    /// Purchase access to a video
    /// Splits payment between creator (90%) and platform treasury (10%)
    public entry fun purchase_access(
        config: &PlatformConfig,
        video_id: vector<u8>,
        creator: address,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let total_amount = coin::value(&payment);
        assert!(total_amount > 0, EZeroAmount);

        let fee_bps = config.fee_bps;
        assert!(fee_bps <= 10000, EInvalidFeePercentage);

        // Calculate split
        let platform_fee = (total_amount * fee_bps) / 10000;
        let creator_amount = total_amount - platform_fee;

        assert!(creator_amount > 0, EInsufficientPayment);

        let mut payment_mut = payment;

        // Send platform fee to treasury
        if (platform_fee > 0) {
            let fee_coin = coin::split(&mut payment_mut, platform_fee, ctx);
            transfer::public_transfer(fee_coin, config.treasury);
        };

        // Send remainder to creator
        transfer::public_transfer(payment_mut, creator);

        // Emit event for backend verification
        event::emit(AccessPurchased {
            video_id,
            buyer: tx_context::sender(ctx),
            creator,
            platform_treasury: config.treasury,
            total_amount_mist: total_amount,
            creator_amount_mist: creator_amount,
            platform_fee_mist: platform_fee,
            platform_fee_bps: fee_bps,
        });
    }

    /// Update platform treasury address (admin only)
    public entry fun update_treasury(
        config: &mut PlatformConfig,
        new_treasury: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, 0);
        config.treasury = new_treasury;
    }

    /// Update platform fee (admin only, max 20%)
    public entry fun update_fee_bps(
        config: &mut PlatformConfig,
        new_fee_bps: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, 0);
        assert!(new_fee_bps <= 2000, EInvalidFeePercentage); // max 20%
        config.fee_bps = new_fee_bps;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    public fun get_treasury(config: &PlatformConfig): address {
        config.treasury
    }

    public fun get_fee_bps(config: &PlatformConfig): u64 {
        config.fee_bps
    }
}
