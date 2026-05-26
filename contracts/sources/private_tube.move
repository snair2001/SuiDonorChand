module private_tube::private_tube {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};

    const EInsufficientPayment: u64 = 1;
    const EInvalidFeePercentage: u64 = 2;
    const EZeroAmount: u64 = 3;
    const EZeroDuration: u64 = 4;

    public struct CampaignCreated has copy, drop {
        campaign_id: address,
        video_id: vector<u8>,
        creator: address,
        price_mist: u64,
        duration_hours: u64,
    }

    public struct AccessPurchased has copy, drop {
        campaign_id: address,
        video_id: vector<u8>,
        buyer: address,
        creator: address,
        platform_treasury: address,
        total_amount_mist: u64,
        creator_amount_mist: u64,
        platform_fee_mist: u64,
        platform_fee_bps: u64,
        duration_hours: u64,
        expiration_timestamp_ms: u64,
    }

    public struct Campaign has key, store {
        id: UID,
        video_id: vector<u8>,
        creator: address,
        price_mist: u64,
        duration_hours: u64,
    }

    public struct PlatformConfig has key {
        id: UID,
        treasury: address,
        fee_bps: u64,
        admin: address,
    }

    fun init(ctx: &mut TxContext) {
        let config = PlatformConfig {
            id: object::new(ctx),
            treasury: tx_context::sender(ctx),
            fee_bps: 1000,
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(config);
    }

    public entry fun create_campaign(
        video_id: vector<u8>,
        price_mist: u64,
        duration_hours: u64,
        ctx: &mut TxContext
    ) {
        assert!(price_mist > 0, EZeroAmount);
        assert!(duration_hours > 0, EZeroDuration);

        let campaign = Campaign {
            id: object::new(ctx),
            video_id,
            creator: tx_context::sender(ctx),
            price_mist,
            duration_hours,
        };

        let campaign_id = object::uid_to_address(&campaign.id);

        event::emit(CampaignCreated {
            campaign_id,
            video_id,
            creator: tx_context::sender(ctx),
            price_mist,
            duration_hours,
        });

        transfer::share_object(campaign);
    }

    public entry fun purchase_access(
        config: &PlatformConfig,
        campaign: &Campaign,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let total_amount = coin::value(&payment);
        assert!(total_amount > 0, EZeroAmount);
        assert!(total_amount == campaign.price_mist, EInsufficientPayment);

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

        let expiration_timestamp_ms = tx_context::epoch_timestamp_ms(ctx) + (campaign.duration_hours * 3600 * 1000);
        let campaign_id = object::uid_to_address(&campaign.id);

        event::emit(AccessPurchased {
            campaign_id,
            video_id: campaign.video_id,
            buyer: tx_context::sender(ctx),
            creator: campaign.creator,
            platform_treasury: config.treasury,
            total_amount_mist: total_amount,
            creator_amount_mist: creator_amount,
            platform_fee_mist: platform_fee,
            platform_fee_bps: fee_bps,
            duration_hours: campaign.duration_hours,
            expiration_timestamp_ms,
        });
    }

    public entry fun update_treasury(
        config: &mut PlatformConfig,
        new_treasury: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, 0);
        config.treasury = new_treasury;
    }

    public entry fun update_fee_bps(
        config: &mut PlatformConfig,
        new_fee_bps: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, 0);
        assert!(new_fee_bps <= 2000, EInvalidFeePercentage);
        config.fee_bps = new_fee_bps;
    }

    public fun get_treasury(config: &PlatformConfig): address {
        config.treasury
    }

    public fun get_fee_bps(config: &PlatformConfig): u64 {
        config.fee_bps
    }

    public fun get_campaign_video_id(campaign: &Campaign): vector<u8> {
        campaign.video_id
    }

    public fun get_campaign_creator(campaign: &Campaign): address {
        campaign.creator
    }

    public fun get_campaign_price_mist(campaign: &Campaign): u64 {
        campaign.price_mist
    }

    public fun get_campaign_duration_hours(campaign: &Campaign): u64 {
        campaign.duration_hours
    }
}
