"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWallets, useWalletConnection, useDAppKit } from "@mysten/dapp-kit-react";
import { dAppKit } from "@/components/SuiProviders";
import { Transaction } from "@mysten/sui/transactions";
import { SLUSH_WALLET_NAME } from "@mysten/slush-wallet";
import { validateYouTubeUrl, extractYouTubeId } from "@/lib/youtube";
import { suiToMist } from "@/lib/pricing";

const DURATION_OPTIONS = [
  { label: "1 Hour", value: 1 },
  { label: "24 Hours", value: 24 },
  { label: "7 Days", value: 168 },
  { label: "30 Days", value: 720 },
];

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "";

interface FormData {
  title: string;
  description: string;
  youtubeUrl: string;
  priceSui: string;
  durationHours: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  youtubeUrl?: string;
  priceSui?: string;
  durationHours?: string;
}

interface CreatedCampaign {
  videoId: string;
  campaignId?: string;
  title: string;
}

export function CreateVideoForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ title: "", description: "", youtubeUrl: "", priceSui: "1", durationHours: "24" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedCampaign | null>(null);
  const [connecting, setConnecting] = useState(false);

  const wallets = useWallets({ dAppKit });
  const connection = useWalletConnection({ dAppKit: dAppKit as any });
  const kit = useDAppKit(dAppKit);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors(p => ({ ...p, [name]: undefined }));
  };

  // ── Step 1: Connect wallet ─────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    try {
      let slush = wallets.find((w) => w.name === SLUSH_WALLET_NAME);
      if (!slush) {
        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const fresh = kit.stores.$wallets.get();
          slush = fresh.find((w) => w.name === SLUSH_WALLET_NAME) ?? fresh[0];
          if (slush) break;
        }
      }

      if (!slush) {
        toast.error("Slush wallet not found. Make sure you are using a supported browser.");
        return;
      }

      await kit.connectWallet({ wallet: slush });
      toast.success("Slush wallet connected!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("reject")) {
        toast.error("Failed to connect wallet. Please try again.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Validate inputs
      const newErrors: FormErrors = {};
      if (!form.title.trim()) newErrors.title = "Title is required";
      if (!form.description.trim()) newErrors.description = "Description is required";
      
      const ytValidation = validateYouTubeUrl(form.youtubeUrl);
      if (!ytValidation.valid || !ytValidation.videoId) {
        newErrors.youtubeUrl = ytValidation.error || "Invalid YouTube URL";
      }
      
      const price = parseFloat(form.priceSui);
      if (isNaN(price) || price <= 0) newErrors.priceSui = "Price must be greater than 0";
      
      const duration = parseInt(form.durationHours);
      if (isNaN(duration) || duration <= 0) newErrors.durationHours = "Invalid duration";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setLoading(false);
        return;
      }

      // Check one-active-campaign limit before doing anything
      const checkRes = await fetch("/api/videos/create/check");
      if (checkRes.status === 409) {
        const data = await checkRes.json();
        toast.error(data.error || "You already have an active campaign. Remove it from your dashboard first.");
        setLoading(false);
        return;
      }

      // Encrypt YouTube URL on server
      const encryptRes = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: form.youtubeUrl }),
      });

      if (!encryptRes.ok) {
        throw new Error("Failed to encrypt video URL");
      }

      const { encrypted } = await encryptRes.json();

      // Generate video ID
      const videoId = crypto.randomUUID();
      const thumbnailVideoId = ytValidation.videoId!;
      const priceMist = suiToMist(price);
      const durationHours = BigInt(duration);

      // Create transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::private_tube::create_campaign`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.string(videoId),
          tx.pure.u64(priceMist),
          tx.pure.u64(durationHours),
          tx.pure.string(form.title),
          tx.pure.string(form.description),
          tx.pure.string(thumbnailVideoId),
          tx.pure.string(encrypted.encryptedText),
          tx.pure.string(encrypted.iv),
          tx.pure.string(encrypted.authTag),
        ],
      });

      // Sign and execute transaction
      const result = await kit.signAndExecuteTransaction({ transaction: tx });
      const digest =
        result.$kind === "Transaction"
          ? result.Transaction.digest
          : (result as unknown as { digest: string }).digest;

      toast.success("Campaign created successfully!");
      
      setCreated({
        videoId,
        title: form.title,
      });

    } catch (err: unknown) {
      console.error("Error creating campaign:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("reject")) {
        toast.info("Transaction cancelled.");
      } else {
        toast.error("Failed to create campaign. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div style={{ textAlign: "center" }} className="stack-lg">
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto" }}>
          ✅
        </div>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>Campaign Created!</h2>
          <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Your video campaign is now live on Sui testnet!</p>
        </div>

        <div className="stack-sm" style={{ textAlign: "left" }}>
          {[
            { label: "Title", value: created.title, mono: false },
            { label: "Video ID", value: created.videoId, mono: true },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "0.875rem", padding: "1rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.375rem" }}>{item.label}</p>
              {item.mono ? <code className="mono" style={{ display: "block" }}>{item.value}</code> : <p style={{ color: "#f8fafc", fontWeight: 500 }}>{item.value}</p>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.875rem" }}>
          <button
            onClick={() => { setCreated(null); setForm({ title: "", description: "", youtubeUrl: "", priceSui: "1", durationHours: "24" }); }}
            className="btn btn-outline"
            style={{ flex: 1 }}
          >
            Create Another
          </button>
          <button onClick={() => router.push("/marketplace")} className="btn btn-primary" style={{ flex: 1 }}>
            View Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack-lg">
      {/* Title */}
      <div>
        <label className="label" htmlFor="title">Campaign Title *</label>
        <input id="title" name="title" type="text" value={form.title} onChange={handleChange}
          placeholder="Enter a descriptive title" maxLength={100}
          className={`input${errors.title ? " input-error" : ""}`} />
        {errors.title && <p className="field-error">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="label" htmlFor="description">Description *</label>
        <textarea id="description" name="description" value={form.description} onChange={handleChange}
          placeholder="Describe what viewers will get access to" rows={3} maxLength={1000}
          className={`input${errors.description ? " input-error" : ""}`} />
        {errors.description && <p className="field-error">{errors.description}</p>}
      </div>

      {/* YouTube URL */}
      <div>
        <label className="label" htmlFor="youtubeUrl">YouTube URL (Unlisted) *</label>
        <input id="youtubeUrl" name="youtubeUrl" type="url" value={form.youtubeUrl} onChange={handleChange}
          placeholder="https://www.youtube.com/watch?v="
          className={`input${errors.youtubeUrl ? " input-error" : ""}`}
          style={{ fontFamily: "monospace", fontSize: "0.875rem" }} />
        {errors.youtubeUrl && <p className="field-error">{errors.youtubeUrl}</p>}
        <p style={{ fontSize: "0.8125rem", color: "#475569", marginTop: "0.375rem" }}>
          ⚠️ Use unlisted videos only. URL is AES-256-GCM encrypted before storage.
        </p>
      </div>

      {/* Price & Duration */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label className="label" htmlFor="priceSui">Price (SUI) *</label>
          <div style={{ position: "relative" }}>
            <input id="priceSui" name="priceSui" type="number" value={form.priceSui} onChange={handleChange}
              min="0.001" max="10000" step="0.001"
              className={`input${errors.priceSui ? " input-error" : ""}`}
              style={{ paddingRight: "3rem" }} />
            <span style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.8125rem", color: "#475569" }}>SUI</span>
          </div>
          {errors.priceSui && <p className="field-error">{errors.priceSui}</p>}
        </div>
        <div>
          <label className="label" htmlFor="durationHours">Access Duration *</label>
          <select
            id="durationHours"
            name="durationHours"
            value={form.durationHours}
            onChange={handleChange}
            className={`input${errors.durationHours ? " input-error" : ""}`}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.durationHours && <p className="field-error">{errors.durationHours}</p>}
        </div>
      </div>

      {/* Info */}
      <div className="alert alert-info">
        <span>ℹ️</span>
        <div>
          <p style={{ fontWeight: 600, marginBottom: "0.375rem", color: "#93c5fd" }}>How it works</p>
          <ul style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.7, paddingLeft: "1rem" }}>
            <li>YouTube URL encrypted with AES-256-GCM</li>
            <li>All data stored on-chain on Sui testnet</li>
            <li>Viewers pay with SUI via Slush Wallet</li>
          </ul>
        </div>
      </div>

      {!connection.isConnected ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="btn btn-primary btn-lg btn-full"
          style={{ gap: "0.625rem" }}
        >
          {connecting ? (
            <>
              <div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="15" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" />
                <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">S</text>
              </svg>
              Connect Slush Wallet
            </>
          )}
        </button>
      ) : (
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
          {loading ? (
            <>
              <div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
              Creating Campaign...
            </>
          ) : (
            <> 🔐 Create Campaign on Sui </>
          )}
        </button>
      )}
    </form>
  );
}
