/// PrivateTube Access Gate — Updated Sui Move Contract
/// 
/// This contract handles:
/// - Campaign creation (stores video ID, creator, price, duration, etc.)
/// - Access purchase with payment splitting (90% creator, 10% platform)
/// - Emits events for backend verification
module private_tube::private_tube {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::balance;
    use std::vector;

    // ─── Errors ───────────────────────────────────────────────────────────────
    const EInsufficientPayment: u64 = 1;
    const EInvalidFeePercentage: u64 = 2;
    const EZeroAmount: u64 = 3;
    const ECampaignNotFound: u64 = 4;
    const ECampaignAlreadyExists: u64 = 5;
    const EInvalidDuration: u64 = 6;

    // ─── Events ───────────────────────────────────────────────────────────────
    public struct CampaignCreated has copy, drop {
        video_id: vector<u8>,
        creator: address,
        price_mist: u64,
        duration_seconds: u64,
    }

    public struct AccessPurchased has copy, drop {
        video_id: vector<u8>,
        buyer: address,
        creator: address,
        platform_treasury: address,
        total_amount_mist: u64,
        creator_amount_mist: u64,
        platform_fee_mist: u64,
        duration_seconds: u64,
        expires_at_ms: u64,
    }

    // ─── Campaign Object ───────────────────────────────────────────────────────
    public struct Campaign has key {
        id: UID,
        video_id: vector<u8>,
        creator: address,
        price_mist: u64,
        duration_seconds: u64,
    }

    // ─── Platform Config ──────────────────────────────────────────────────────
    public struct PlatformConfig has key {
        id: UID,
        treasury: address,
        fee_bps: u64,
        admin: address,
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    fun init(ctx: &mut TxContext) {
        let config = PlatformConfig {
            id: object::new(ctx),
            treasury: tx_context::sender(ctx),
            fee_bps: 1000,
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(config);
    }

    // ─── Public Functions ─────────────────────────────────────────────────────

    /// Create a new campaign
    public entry fun create_campaign(
        video_id: vector<u8>,
        price_mist: u64,
        duration_seconds: u64,
        ctx: &mut TxContext
    ) {
        assert!(price_mist > 0, EZeroAmount);
        assert!(duration_seconds > 0, EInvalidDuration);

        let campaign = Campaign {
            id: object::new(ctx),
            video_id: vector::copy(&video_id),
            creator: tx_context::sender(ctx),
            price_mist,
            duration_seconds,
        };

        transfer::transfer(campaign, tx_context::sender(ctx));

        event::emit(CampaignCreated {
            video_id,
            creator: tx_context::sender(ctx),
            price_mist,
            duration_seconds,
        });
    }

    /// Purchase access to a campaign
    public entry fun purchase_access(
        config: &PlatformConfig,
        campaign: &Campaign,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let total_amount = coin::value(&payment);
        assert!(total_amount >= campaign.price_mist, EInsufficientPayment);
        assert!(total_amount > 0, EZeroAmount);

        let fee_bps = config.fee_bps;
        assert!(fee_bps <= 10000, EInvalidFeePercentage);

        let platform_fee = (total_amount * fee_bps) / 10000;
        let creator_amount = total_amount - platform_fee;

        assert!(creator_amount > 0, EInsufficientPayment);

        let mut payment_mut = payment;

        if (platform_fee > 0) {
            let fee_coin = coin::split(&mut payment_mut, platform_fee, ctx);
            transfer::public_transfer(fee_coin, config.treasury);
        };

        transfer::public_transfer(payment_mut, campaign.creator);

        let now_ms = tx_context::epoch_ms(ctx);
        let expires_at_ms = now_ms + (campaign.duration_seconds * 1000);

        event::emit(AccessPurchased {
            video_id: vector::copy(&campaign.video_id),
            buyer: tx_context::sender(ctx),
            creator: campaign.creator,
            platform_treasury: config.treasury,
            total_amount_mist: total_amount,
            creator_amount_mist: creator_amount,
            platform_fee_mist: platform_fee,
            duration_seconds: campaign.duration_seconds,
            expires_at_ms,
        });
    }

    /// Update platform treasury (admin only)
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
        assert!(new_fee_bps <= 2000, EInvalidFeePercentage);
        config.fee_bps = new_fee_bps;
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    public fun get_treasury(config: &PlatformConfig): address {
        config.treasury
    }

    public fun get_fee_bps(config: &PlatformConfig): u64 {
        config.fee_bps
    }

    public fun get_campaign_video_id(campaign: &Campaign): vector<u8> {
        vector::copy(&campaign.video_id)
    }

    public fun get_campaign_creator(campaign: &Campaign): address {
        campaign.creator
    }

    public fun get_campaign_price(campaign: &Campaign): u64 {
        campaign.price_mist
    }

    public fun get_campaign_duration(campaign: &Campaign): u64 {
        campaign.duration_seconds
    }
}
