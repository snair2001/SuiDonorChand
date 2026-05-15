# PrivateTube Access Gate

A deploy-ready MVP for encrypted video access using Sui zkLogin, Pinata IPFS, and AES-256-GCM encryption.

## Overview

PrivateTube allows creators to upload private/unlisted YouTube links, encrypt them, and sell time-limited access to viewers who pay with SUI testnet tokens. All metadata is stored on Pinata IPFS. Authentication uses Sui zkLogin with Google OAuth — no wallet extensions needed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  Landing → Login → Dashboard → Create → Marketplace → Watch │
└──────────────────────────┬──────────────────────────────────┘
                           │ API Routes (Vercel Serverless)
┌──────────────────────────▼──────────────────────────────────┐
│                     Backend API Routes                       │
│  /api/auth/zklogin/*  →  Google OAuth + zkLogin             │
│  /api/videos/*        →  CRUD (encrypted metadata)          │
│  /api/payment/record  →  Payment verification + access      │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
┌──────▼──────┐                    ┌──────────▼──────────┐
│ Pinata IPFS │                    │   Sui Testnet RPC   │
│             │                    │                     │
│ • Video     │                    │ • Tx verification   │
│   metadata  │                    │ • Payment splits    │
│ • Registry  │                    │ • zkLogin address   │
│ • Access    │                    │   derivation        │
│   records   │                    └─────────────────────┘
│ • Purchase  │
│   records   │
└─────────────┘
```

### Key Security Principles

- **YouTube URLs never stored in plaintext** — AES-256-GCM encrypted before IPFS upload
- **Decryption server-side only** — `/api/videos/[videoId]/play` decrypts and returns only embed URL
- **PINATA_JWT never reaches frontend** — all Pinata calls go through API routes
- **ENCRYPTION_MASTER_KEY never reaches frontend** — server-side only
- **Revenue calculations server-side** — frontend cannot manipulate payment amounts

---

## Pinata IPFS Storage Design

Since IPFS is immutable, the system uses a versioned approach:

### Video Metadata
Each video has an encrypted JSON file on IPFS:
```json
{
  "videoId": "uuid",
  "title": "Video title",
  "encryptedUrl": "base64-aes-gcm-ciphertext",
  "iv": "base64-iv",
  "authTag": "base64-auth-tag",
  "priceMist": "1000000000",
  "status": "active",
  ...
}
```

### Registry
A `private-tube-registry-latest` named file on Pinata tracks all videos:
- On each video creation/update, a new registry JSON is uploaded
- Pinata metadata search finds the latest by `date_pinned`
- Registry maps `videoId → CID`

### Access Records
Named `access-{viewerAddress}-{videoId}` — searched by Pinata metadata name.

### Purchase Records
Named `purchase-{videoId}-{txDigest}` — used for duplicate detection.

---

## Setup

### 1. Clone and Install

```bash
git clone <repo>
cd video_sui
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all values (see below).

### 3. Pinata IPFS Setup

1. Go to [pinata.cloud](https://pinata.cloud) and create an account
2. Navigate to **API Keys** → **New Key**
3. Enable: `pinFileToIPFS`, `pinJSONToIPFS`, `pinList`, `unpin`
4. Copy the **JWT** (not the API key/secret)
5. Set `PINATA_JWT=<your-jwt>` in `.env.local`
6. Set `PINATA_GATEWAY_URL=https://gateway.pinata.cloud`

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google+ API** and **Google Identity**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/zklogin/callback` (development)
   - `https://your-app.vercel.app/api/auth/zklogin/callback` (production)
7. Copy **Client ID** and **Client Secret**
8. Set in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=<client-id>
   GOOGLE_CLIENT_SECRET=<client-secret>
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/zklogin/callback
   ```

### 5. Sui zkLogin Setup

zkLogin derives a Sui address from your Google account. No additional setup needed for the address derivation.

For full ZK proof generation (production):
- Integrate with [Mysten Labs Prover Service](https://docs.sui.io/concepts/cryptography/zklogin)
- See `lib/zklogin.ts` → `generateZkLoginProof()` for the TODO placeholder

### 6. Sui Testnet Setup

1. Get testnet SUI from the [faucet](https://faucet.sui.io)
2. Set `NEXT_PUBLIC_SUI_NETWORK=testnet`
3. Set `NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443`

To deploy the Move contract:
```bash
cd contracts
sui client publish --gas-budget 100000000
```
Copy the package ID and set `NEXT_PUBLIC_PACKAGE_ID=<package-id>`.

### 7. Generate Secrets

```bash
# JWT Secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# zkLogin Salt Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Master Key (exactly 32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | App URL (no trailing slash) | Yes |
| `NEXT_PUBLIC_SUI_NETWORK` | `testnet` or `mainnet` | Yes |
| `NEXT_PUBLIC_SUI_RPC_URL` | Sui RPC endpoint | Yes |
| `NEXT_PUBLIC_PACKAGE_ID` | Deployed Move package ID | Optional |
| `NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS` | Platform treasury Sui address | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Yes |
| `JWT_SECRET` | Session JWT signing secret (32+ chars) | Yes |
| `ZKLOGIN_SALT_SECRET` | Salt for zkLogin address derivation | Yes |
| `ENCRYPTION_MASTER_KEY` | AES-256 key (64 hex chars = 32 bytes) | Yes |
| `PINATA_JWT` | Pinata API JWT | Yes |
| `PINATA_GATEWAY_URL` | Pinata gateway URL | Yes |
| `PLATFORM_FEE_PERCENTAGE` | Platform fee % (default: 10) | No |
| `VIDEO_REVENUE_CAP_USD` | Revenue cap per video (default: 20) | No |
| `SUI_USD_FALLBACK` | SUI/USD fallback price | No |
| `ALLOW_MOCK_PAYMENT` | Enable mock payments in dev | Dev only |

---

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Development mock payments**: Set `ALLOW_MOCK_PAYMENT=true` in `.env.local`. Payments will use a mock transaction digest prefixed with `MOCK_`.

---

## Vercel Deployment

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
5. Update `GOOGLE_REDIRECT_URI` to `https://your-app.vercel.app/api/auth/zklogin/callback`
6. Update Google OAuth authorized redirect URIs
7. Deploy

**Important**: No local file writes in production. All state uses Pinata IPFS.

```bash
npm run build  # Verify build passes locally first
```

---

## Demo Flow

1. **Creator** visits the app and clicks "Login with Google"
2. Google OAuth redirects back, zkLogin derives a Sui address
3. Creator goes to `/create`, enters an unlisted YouTube URL
4. Backend encrypts the URL with AES-256-GCM
5. Encrypted metadata JSON is uploaded to Pinata IPFS
6. Video appears in `/marketplace`
7. **Viewer** logs in with Google zkLogin
8. Viewer clicks "Pay X SUI" on a video card
9. (Dev: mock payment; Prod: Sui wallet transaction)
10. Backend verifies payment, creates access record on Pinata
11. Viewer clicks "Watch Now" → `/watch/[videoId]`
12. Backend checks access, decrypts URL server-side, returns embed URL
13. Viewer watches via YouTube iframe
14. After $20 USD gross revenue, video is marked sold out
15. Existing paid users can still watch until their access expires
16. New purchases are blocked

---

## Revenue Cap & Commission Logic

Each video has a `revenueCapUsd` (default: $20 USD).

On each purchase:
```
grossUsd = priceMist / 1e9 * suiUsdPrice
platformFeeUsd = grossUsd * 0.10
creatorAmountUsd = grossUsd * 0.90

totalGrossRevenueUsd += grossUsd

if totalGrossRevenueUsd >= revenueCapUsd:
  status = "sold_out"
  isSoldOut = true
```

The updated metadata is uploaded as a new IPFS file, and the registry is updated to point to the new CID.

---

## Known Limitations

1. **YouTube unlisted only**: Private videos cannot be embedded. Use unlisted.
2. **YouTube iframe security**: Advanced users can inspect network requests to find the embed URL. A stronger solution would use encrypted HLS/DASH stored on Walrus/IPFS.
3. **zkLogin full proof**: The ZK proof generation uses a placeholder. Production requires integration with Mysten Labs' prover service.
4. **IPFS query speed**: Pinata metadata search can be slow (1-3s). Consider caching the registry CID.
5. **Revenue accuracy**: USD conversion uses CoinGecko API with a fallback. Prices may fluctuate between purchase and recording.
6. **No refunds**: Once access is granted, no refund mechanism exists in this MVP.

---

## Future Upgrades

1. **Encrypted HLS/DASH**: Store actual video files encrypted on Walrus or IPFS instead of YouTube links
2. **Full zkLogin proof**: Integrate Mysten Labs prover for production-grade ZK proofs
3. **Sui wallet integration**: Add `@mysten/dapp-kit` for real wallet signing
4. **Subscription model**: Recurring access instead of one-time purchases
5. **Creator analytics**: Dashboard with detailed revenue and viewer analytics
6. **NFT access tokens**: Issue NFTs as access passes (transferable/resellable)
7. **Multi-chain**: Support ETH/USDC payments via bridge
8. **Content moderation**: DAO-based content review system
9. **Registry caching**: Redis/KV cache for registry CID to reduce IPFS latency
10. **Streaming encryption**: Real-time AES encryption of video chunks

---

## Tech Stack

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS
- **Auth**: Sui zkLogin with Google OAuth
- **Storage**: Pinata IPFS (encrypted metadata)
- **Encryption**: AES-256-GCM (Node.js crypto)
- **Blockchain**: Sui Testnet
- **Smart Contract**: Sui Move
- **Deployment**: Vercel
