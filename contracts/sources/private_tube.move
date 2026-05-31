module private_tube::private_tube {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::dynamic_object_field as dof;
    use sui::vec_map::{Self, VecMap};

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
        title: vector<u8>,
        description: vector<u8>,
        thumbnail_video_id: vector<u8>,
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
        title: vector<u8>,
        description: vector<u8>,
        thumbnail_video_id: vector<u8>,
        encrypted_url: vector<u8>,
        iv: vector<u8>,
        auth_tag: vector<u8>,
        is_disabled: bool,
        disabled_reason: vector<u8>,
        total_purchases: u64,
        total_gross_mist: u64,
    }

    public struct AccessRecord has key, store {
        id: UID,
        buyer: address,
        campaign_id: address,
        expiration_timestamp_ms: u64,
    }

    public struct PlatformConfig has key {
        id: UID,
        treasury: address,
        fee_bps: u64,
        admin: address,
    }

    public struct Registry has key {
        id: UID,
        campaigns: VecMap<address, address>,
    }

    fun init(ctx: &mut TxContext) {
        let config = PlatformConfig {
            id: object::new(ctx),
            treasury: tx_context::sender(ctx),
            fee_bps: 1000,
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(config);

        let registry = Registry {
            id: object::new(ctx),
            campaigns: vec_map::empty(),
        };
        transfer::share_object(registry);
    }

    public entry fun create_campaign(
        registry: &mut Registry,
        video_id: vector<u8>,
        price_mist: u64,
        duration_hours: u64,
        title: vector<u8>,
        description: vector<u8>,
        thumbnail_video_id: vector<u8>,
        encrypted_url: vector<u8>,
        iv: vector<u8>,
        auth_tag: vector<u8>,
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
            title,
            description,
            thumbnail_video_id,
            encrypted_url,
            iv,
            auth_tag,
            is_disabled: false,
            disabled_reason: b"",
            total_purchases: 0,
            total_gross_mist: 0,
        };

        let campaign_id = object::uid_to_address(&campaign.id);

        vec_map::insert(&mut registry.campaigns, campaign_id, campaign_id);

        event::emit(CampaignCreated {
            campaign_id,
            video_id,
            creator: tx_context::sender(ctx),
            price_mist,
            duration_hours,
            title,
            description,
            thumbnail_video_id,
        });

        transfer::share_object(campaign);
    }

    public entry fun purchase_access(
        config: &PlatformConfig,
        campaign: &mut Campaign,
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

        campaign.total_purchases = campaign.total_purchases + 1;
        campaign.total_gross_mist = campaign.total_gross_mist + total_amount;

        let expiration_timestamp_ms = tx_context::epoch_timestamp_ms(ctx) + (campaign.duration_hours * 3600 * 1000);
        let campaign_id = object::uid_to_address(&campaign.id);
        let buyer = tx_context::sender(ctx);

        if (dof::exists(&campaign.id, buyer)) {
            // Update existing access record
            let record: &mut AccessRecord = dof::borrow_mut(&mut campaign.id, buyer);
            record.expiration_timestamp_ms = expiration_timestamp_ms;
        } else {
            // Create new access record
            let access_record = AccessRecord {
                id: object::new(ctx),
                buyer,
                campaign_id,
                expiration_timestamp_ms,
            };

            dof::add(&mut campaign.id, buyer, access_record);
        };

        event::emit(AccessPurchased {
            campaign_id,
            video_id: campaign.video_id,
            buyer,
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

    public fun get_campaign_title(campaign: &Campaign): vector<u8> {
        campaign.title
    }

    public fun get_campaign_description(campaign: &Campaign): vector<u8> {
        campaign.description
    }

    public fun get_campaign_thumbnail_video_id(campaign: &Campaign): vector<u8> {
        campaign.thumbnail_video_id
    }

    public fun get_campaign_encrypted_url(campaign: &Campaign): vector<u8> {
        campaign.encrypted_url
    }

    public fun get_campaign_iv(campaign: &Campaign): vector<u8> {
        campaign.iv
    }

    public fun get_campaign_auth_tag(campaign: &Campaign): vector<u8> {
        campaign.auth_tag
    }

    public fun get_campaign_is_disabled(campaign: &Campaign): bool {
        campaign.is_disabled
    }

    public fun get_campaign_disabled_reason(campaign: &Campaign): vector<u8> {
        campaign.disabled_reason
    }

    public fun get_campaign_total_purchases(campaign: &Campaign): u64 {
        campaign.total_purchases
    }

    public fun get_campaign_total_gross_mist(campaign: &Campaign): u64 {
        campaign.total_gross_mist
    }

    public fun get_registry_campaigns(registry: &Registry): &VecMap<address, address> {
        &registry.campaigns
    }

    public fun get_access_record_expiration(
        campaign: &Campaign,
        buyer: address,
        _ctx: &TxContext
    ): u64 {
        if (dof::exists(&campaign.id, buyer)) {
            let record: &AccessRecord = dof::borrow(&campaign.id, buyer);
            record.expiration_timestamp_ms
        } else {
            0
        }
    }

    public fun has_valid_access(
        campaign: &Campaign,
        buyer: address,
        ctx: &TxContext
    ): bool {
        let expiration = get_access_record_expiration(campaign, buyer, ctx);
        expiration > tx_context::epoch_timestamp_ms(ctx)
    }
}
