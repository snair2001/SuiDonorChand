# PrivateTube Access Gate — Development Prompt Document

A complete record of the engineering requirements and feature specifications used to build this project, written as clean, reusable prompts.

---

## 1. Project Specification — Initial Build

**Prompt:**

Build a complete deploy-ready MVP called **PrivateTube Access Gate**.

The platform allows creators to upload private/unlisted YouTube links, encrypt them, store the encrypted metadata on Pinata IPFS, authenticate users via Sui zkLogin with Google OAuth, accept SUI testnet payments for limited-time access, and serve the video inside the website only to users with valid paid access.

### Core Rules
- Use Pinata IPFS instead of any database (MongoDB, Supabase, etc.) for storing encrypted video data
- Do not store raw YouTube links anywhere in plaintext
- Do not expose decrypted YouTube links to the frontend under any circumstances
- Use unlisted YouTube videos for the MVP
- Use encrypted IPFS metadata for all video listings
- Use Sui testnet for all payment and access logic
- Deploy frontend and backend API routes on Vercel

### Tech Stack
- Next.js App Router with TypeScript
- Tailwind CSS and shadcn/ui
- Pinata IPFS for all persistent storage
- Sui TypeScript SDK (`@mysten/sui`)
- Sui zkLogin with Google OAuth for authentication
- AES-256-GCM encryption for YouTube URLs
- HTTP-only cookie sessions
- Vercel serverless API routes

### Project Structure

```
/app
  /page.tsx
  /login/page.tsx
  /dashboard/page.tsx
  /create/page.tsx
  /marketplace/page.tsx
  /watch/[videoId]/page.tsx
  /api/auth/zklogin/start/route.ts
  /api/auth/zklogin/callback/route.ts
  /api/auth/session/route.ts
  /api/auth/logout/route.ts
  /api/videos/create/route.ts
  /api/videos/list/route.ts
  /api/videos/[videoId]/route.ts
  /api/videos/[videoId]/access/route.ts
  /api/videos/[videoId]/play/route.ts
  /api/payment/record/route.ts
  /api/pinata/upload/route.ts
/components
  Navbar.tsx
  VideoCard.tsx
  CreateVideoForm.tsx
  SecureVideoPlayer.tsx
  LoginButton.tsx
  WalletStatus.tsx
  LoadingSpinner.tsx
  RevenueProgress.tsx
/lib
  encryption.ts
  auth.ts
  session.ts
  sui.ts
  zklogin.ts
  youtube.ts
  validation.ts
  pinata.ts
  pricing.ts
  accessStore.ts
  videoRegistry.ts
/contracts
  Move.toml
  /sources/private_tube.move
.env.example
README.md
```

### Environment Variables

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_PACKAGE_ID=
NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/zklogin/callback
JWT_SECRET=
ZKLOGIN_SALT_SECRET=
ENCRYPTION_MASTER_KEY=
PINATA_JWT=
PINATA_GATEWAY_URL=
PLATFORM_FEE_PERCENTAGE=10
VIDEO_REVENUE_CAP_USD=20
SUI_USD_FALLBACK=1.5
ETH_USD_FALLBACK=3000
ALLOW_MOCK_PAYMENT=true
```

### Pinata IPFS Storage Design

Since IPFS data is immutable, never attempt to update the same file. When video metadata changes, upload a new JSON file to Pinata and store the latest CID in the video registry.

**Encrypted video metadata JSON structure:**
```json
{
  "videoId": "unique-id",
  "title": "Video title",
  "description": "Video description",
  "creatorEmail": "creator@gmail.com",
  "creatorAddress": "0xcreator",
  "encryptedUrl": "...",
  "iv": "...",
  "authTag": "...",
  "priceMist": "1000000000",
  "priceSui": "1",
  "durationMs": 86400000,
  "revenueCapUsd": 20,
  "platformFeePercentage": 10,
  "createdAt": "...",
  "status": "active"
}
```

**Registry design:** Maintain a pinned registry JSON on Pinata named `private-tube-registry-latest`. Every time a creator creates a video: encrypt the URL, upload encrypted metadata to Pinata, fetch the latest registry, append the new video summary, upload a new registry JSON to Pinata.

**Access records:** Named `access-{viewerAddress}-{videoId}` — searched by Pinata metadata name.

**Purchase records:** Named `purchase-{videoId}-{txDigest}` — used for duplicate detection.

### Revenue Cap System

- Each video has a `revenueCapUsd` of $20 USD gross
- Platform commission: 10%
- Creator receives: 90%
- When `totalGrossRevenueUsd >= 20`: mark `status = "sold_out"`, `isSoldOut = true`
- Marketplace hides sold-out videos
- Existing users with access can still watch until expiry after sold out
- New purchases must be blocked after sold out

### Pinata Library (`/lib/pinata.ts`)

Implement the following functions:
- `uploadJsonToPinata(data, metadataName)`
- `getJsonFromCid(cid)`
- `findLatestFileByMetadataName(name)`
- `updateVideoRegistry(newEntry)`
- `getLatestRegistry()`
- `getVideoMetadata(videoId)`
- `updateVideoMetadata(videoId, updatedData)`
- `createAccessRecord(accessData)`
- `findActiveAccess(viewerAddress, videoId)`
- `createPurchaseRecord(purchaseData)`

### Encryption (`/lib/encryption.ts`)

Use AES-256-GCM. Functions: `encryptText(plainText)`, `decryptText(encryptedText, iv, authTag)`. The `ENCRYPTION_MASTER_KEY` must be 32 bytes (64 hex characters). Return base64 encrypted text, IV, and authTag. Never expose the encryption key to the frontend. Never decrypt on the frontend.

### YouTube Handling (`/lib/youtube.ts`)

Accept all YouTube URL formats. Extract video ID safely. Validate using regex. Convert to embed URL: `https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1`. Never return the original YouTube URL.

### Auth and zkLogin Flow

1. User clicks Login with Google
2. Generate ephemeral Sui keypair
3. Generate nonce and randomness
4. Redirect to Google OAuth with nonce
5. On callback, get Google ID token
6. Decode JWT, extract email and subject
7. Generate deterministic salt using `ZKLOGIN_SALT_SECRET + Google subject`
8. Derive zkLogin Sui address
9. Store session in HTTP-only cookie (email, suiAddress)
10. Redirect to dashboard

### SUI Payment Flow

1. User clicks Pay to Unlock
2. Frontend creates Sui transaction
3. Payment split: 90% to creator address, 10% to platform treasury
4. Sign and execute transaction using Slush wallet
5. Get txDigest
6. Call `/api/payment/record` with videoId and txDigest
7. Backend verifies: user is logged in, video exists, video is active, video is not sold out, txDigest is not already processed
8. Backend calculates USD equivalent
9. Backend uploads purchase record and access record to Pinata
10. Backend updates video revenue metadata on Pinata

### API Routes

**POST `/api/videos/create`** — Require session. Validate all inputs. Encrypt YouTube URL. Upload encrypted metadata to Pinata. Update registry. Return safe metadata only (no encrypted fields).

**GET `/api/videos/list`** — Public. Return only active, non-sold-out, non-disabled videos. Never return `encryptedUrl`, `iv`, or `authTag`.

**GET `/api/videos/[videoId]/play`** — Require session. Check active access from Pinata. If no valid access, return 403. Decrypt YouTube URL server-side. Return only `embedUrl`, `expiresAt`, and `title`.

**POST `/api/payment/record`** — Require session. Validate videoId and txDigest. Check duplicate txDigest. Fetch video metadata. Block if sold out or disabled. Calculate payment USD equivalent server-side. Create purchase and access records on Pinata. Update video revenue. Return access status.

### Security Rules

- `PINATA_JWT` must never reach the frontend
- `ENCRYPTION_MASTER_KEY` must never reach the frontend
- Raw YouTube URLs must never reach the frontend
- Decrypt only inside API routes
- Validate all YouTube URLs and payment amounts server-side
- Prevent duplicate txDigest processing
- Do not allow purchase if sold out or disabled
- Do not allow watch if access expired
- Never trust frontend revenue calculations

### README Requirements

Include: project overview, architecture, Pinata IPFS storage design, Google OAuth setup, Sui zkLogin setup, Sui testnet setup, environment variables reference, local run commands, Vercel deployment steps, demo flow, revenue cap and commission logic, known limitations, and future upgrades.

---

## 2. Business Logic — One Campaign Per Email

**Prompt:**

Enforce a rule that only one donation campaign (video listing) is allowed per email account at a time. Additionally, add a platform admin disable button for each campaign that is visible only to the admin. The disable button should be enabled by default and toggleable by the admin.

### Requirements

**One campaign per email:**
- A creator with an existing active campaign must not be able to create a new one
- The check must happen server-side in the video creation API route
- Return a clear error message identifying the existing campaign by title

**Admin disable button:**
- Add an `ADMIN_EMAIL` environment variable — the Google account email that receives admin privileges
- The `/api/auth/session` endpoint must return `isAdmin: true/false` based on this env var
- Create `POST /api/admin/videos/[videoId]/disable` — admin-only route that toggles `isDisabled` on a video
- Body: `{ disable: boolean, reason?: string }`
- Disabled campaigns: hidden from marketplace for regular users, blocked from new purchases
- Existing paid users with valid access records can still watch until expiry
- Admin can re-enable a disabled campaign
- The disable button must only be visible to the admin user in the marketplace UI

**Data model additions to `VideoMetadata` and `RegistryEntry`:**
```typescript
isDisabled: boolean
disabledReason: string | null
disabledAt: string | null
```

**New environment variable:**
```
ADMIN_EMAIL=admin@example.com
```

---

## 3. Wallet Integration — Slush Wallet

**Prompt:**

Integrate Slush wallet as the required wallet for SUI payments. Replace all mock payment logic with real Slush wallet transaction signing.

### Requirements

- Install `@mysten/dapp-kit-react`, `@mysten/dapp-kit-core`, and `@mysten/slush-wallet`
- Create a `SuiProviders` component that wraps the app with `DAppKitProvider` and registers the Slush web wallet via `registerSlushWallet`
- Create a `SlushConnectModal` component that lists all detected wallets and connects via `dAppKit.connectWallet({ wallet })`
- Create a `SlushPayButton` component that:
  - Opens the connect modal if no wallet is connected
  - Builds a `Transaction` splitting the gas coin: 90% to creator, 10% to platform treasury
  - Calls `dAppKit.signAndExecuteTransaction({ transaction: tx })`
  - Returns the `txDigest` to the parent for backend recording
- Create a `SlushWalletBar` component in the Navbar showing the connected wallet address
- Remove all mock payment code from the marketplace page
- The payment flow: Slush wallet signs → `txDigest` returned → `/api/payment/record` called → access granted

---

## 4. UI Overhaul — Premium Design System

**Prompt:**

Perform a complete UI overhaul of all pages and components. The current layout has alignment issues, missing spacing, and broken Tailwind utility classes. Build a premium, advanced design system using pure CSS classes that work reliably with Tailwind v4.

### Requirements

**Design system (`globals.css`):**
- Define a complete CSS design system with named classes — do not rely on Tailwind utility classes for critical layout
- Include: container classes, card/glassmorphism styles, button variants, form inputs, badge variants, alert boxes, grid helpers, flex helpers, spacing stacks, animations, progress bars, stat cards, feature cards, step cards, navbar styles, hero section styles, video grid, sidebar layout, breadcrumb, empty state, loading spinner, and wallet pill
- Use `radial-gradient` background with purple/blue glow effects
- Dark theme throughout with `#050814` base background

**Pages to rewrite:**
- Landing page (`/`) — hero with gradient headline, how-it-works steps, security features grid, revenue model stats, CTA banner, footer
- Login page (`/login`) — centered card with Google login button, zkLogin explanation steps
- Dashboard (`/dashboard`) — sidebar layout with wallet status, creator stats, quick actions; main area with video list and revenue progress bars
- Create page (`/create`) — centered form with security badges and info card
- Marketplace (`/marketplace`) — responsive video grid with admin controls, access status, transaction digest notification
- Watch page (`/watch/[videoId]`) — breadcrumb, video title, secure player, description, security info

**Components to rewrite:**
- `Navbar` — fixed glassmorphism bar with logo, nav links, wallet bar, user info, logout
- `VideoCard` — thumbnail with overlay badges, price, duration, access countdown, Slush pay button, admin disable controls
- `CreateVideoForm` — styled inputs with validation errors, success state with CID display
- `SecureVideoPlayer` — access timer bar, iframe player, error/locked states
- `LoadingSpinner` — CSS spinner variants (sm/md/lg)
- `WalletStatus` — connected address display with copy button
- `RevenueProgress` — progress bar with creator/platform split stats
- `SlushWalletBar` — wallet pill with green pulse dot
- `SlushConnectModal` — wallet selection modal with keyboard close support
- `SlushPayButton` — gradient button with Slush icon and wallet address display

**Remove:** Google Fonts import (`next/font/google`) — use system font stack instead to avoid network dependency during build.

---

## 5. Bug Fix — Registry Null Safety

**Prompt:**

Fix a critical 500 error on `/api/videos/list` and related routes. The error is:

```
TypeError: Cannot read properties of undefined (reading 'filter')
at getActiveVideos (lib/videoRegistry.ts)
```

### Root Cause

`getLatestRegistry()` returns the raw IPFS JSON which may not have a `videos` array when: the registry does not exist yet (first run), the IPFS gateway returns a malformed response, or the registry was created with a different schema.

### Fix Required

Add defensive null-safety checks throughout all functions that access `registry.videos`:

- `getLatestRegistry()` — validate the fetched JSON has an `Array` for `videos`; fall back to `{ videos: [] }` on any failure
- `updateVideoRegistry()` — guard with `Array.isArray()` before mutating
- `getVideoMetadata()` — guard before `.find()`
- `getActiveVideoByCreatorEmail()` — guard before `.find()`
- `updateVideoMetadata()` — guard before `.find()`
- `getActiveVideos()` — guard before `.filter()`
- `getCreatorVideos()` — guard before `.filter()`
- `/api/videos/list` route — guard before filtering entries
- `/api/payment/record` route — guard before updating registry after payment

The app must return `{ videos: [] }` gracefully instead of crashing with a 500 when the registry is empty or malformed.

---

## 6. Business Logic — One Video Per Account (Lifetime)

**Prompt:**

Strengthen the one-campaign-per-account rule. Currently the system only blocks a second video if the first is still active. Change this to block any second video regardless of the first video's status (active, sold_out, removed, or disabled).

### Requirements

- Add a new helper `getAnyVideoByCreatorEmail(email)` in `lib/pinata.ts` that searches the registry for any entry matching the creator's email, regardless of status
- Update `createVideo()` in `lib/videoRegistry.ts` to use this new helper instead of `getActiveVideoByCreatorEmail()`
- Error message when blocked: `"Your account already has a video ("[title]"). Only one video is allowed per account."`
- This check must happen server-side before any encryption or IPFS upload

---

## 7. Deployment — Vercel Configuration

**Prompt:**

Create a complete Vercel deployment configuration for the project hosted at `https://video-sui.vercel.app`.

### Requirements

- Create a `vercel.json` with framework, build, and security headers configuration
- Create a `.env.vercel` template file (committed to git, no real secrets) with instructions for each variable
- Create a `.env.vercel.local` file (gitignored, contains real values) that can be imported directly into Vercel via the "Import .env file" feature
- Update `.gitignore` to exclude `.env.vercel.local` and `.env.vercel`
- Update `GOOGLE_REDIRECT_URI` to use the production Vercel URL
- Update `NEXT_PUBLIC_APP_URL` to use the production Vercel URL
- Set `ADMIN_EMAIL` to the platform admin's Google account email
- Do NOT include `ALLOW_MOCK_PAYMENT` in the production environment

### Production environment variables

```
NEXT_PUBLIC_APP_URL=https://video-sui.vercel.app
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
GOOGLE_CLIENT_ID=[from Google Cloud Console]
GOOGLE_CLIENT_SECRET=[from Google Cloud Console]
GOOGLE_REDIRECT_URI=https://video-sui.vercel.app/api/auth/zklogin/callback
JWT_SECRET=[64 hex chars]
ZKLOGIN_SALT_SECRET=[64 hex chars]
ENCRYPTION_MASTER_KEY=[64 hex chars]
PINATA_JWT=[from pinata.cloud API Keys]
PINATA_GATEWAY_URL=https://gateway.pinata.cloud
PLATFORM_FEE_PERCENTAGE=10
VIDEO_REVENUE_CAP_USD=20
SUI_USD_FALLBACK=1.5
ETH_USD_FALLBACK=3000
ADMIN_EMAIL=[admin Google account email]
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  Landing → Login → Dashboard → Create → Marketplace → Watch │
│  Slush Wallet (dApp Kit v2) for transaction signing          │
└──────────────────────────┬──────────────────────────────────┘
                           │ Vercel Serverless API Routes
┌──────────────────────────▼──────────────────────────────────┐
│                     Backend API Routes                       │
│  /api/auth/zklogin/*  →  Google OAuth + zkLogin             │
│  /api/videos/*        →  CRUD (encrypted metadata)          │
│  /api/payment/record  →  Payment verification + access      │
│  /api/admin/*         →  Admin-only campaign controls       │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
┌──────▼──────┐                    ┌──────────▼──────────┐
│ Pinata IPFS │                    │   Sui Testnet RPC   │
│             │                    │                     │
│ • Encrypted │                    │ • Tx verification   │
│   video     │                    │ • Slush wallet      │
│   metadata  │                    │   signing           │
│ • Registry  │                    │ • zkLogin address   │
│ • Access    │                    │   derivation        │
│   records   │                    └─────────────────────┘
│ • Purchase  │
│   records   │
└─────────────┘
```

### Key Security Principles

| Rule | Implementation |
|---|---|
| YouTube URLs never stored in plaintext | AES-256-GCM encrypted before IPFS upload |
| Decryption server-side only | `/api/videos/[videoId]/play` decrypts and returns only embed URL |
| PINATA_JWT never reaches frontend | All Pinata calls go through API routes |
| ENCRYPTION_MASTER_KEY never reaches frontend | Server-side only |
| Revenue calculations server-side | Frontend cannot manipulate payment amounts |
| One video per account | Enforced server-side before any IPFS upload |
| Admin controls | Protected by `ADMIN_EMAIL` env var comparison |
