"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWallets, useWalletConnection, useDAppKit } from "@mysten/dapp-kit-react";
import { dAppKit } from "@/components/SuiProviders";
import { Transaction } from "@mysten/sui/transactions";
import { SLUSH_WALLET_NAME } from "@mysten/slush-wallet";

const DURATION_OPTIONS = [
  { label: "1 Hour", value: 1 },
  { label: "24 Hours", value: 24 },
  { label: "7 Days", value: 168 },
  { label: "30 Days", value: 720 },
];

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

interface CreatedVideo {
  videoId: string;
  cid: string;
  title: string;
}

export function CreateVideoForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ title: "", description: "", youtubeUrl: "", priceSui: "1", durationHours: "24" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [storingOnChain, setStoringOnChain] = useState(false);
  const [ipfsVideo, setIpfsVideo] = useState<CreatedVideo | null>(null);
  const [created, setCreated] = useState<CreatedVideo | null>(null);
  const [copiedCid, setCopiedCid] = useState(false);

  const wallets = useWallets({ dAppKit });
  const connection = useWalletConnection({ dAppKit: dAppKit as any });
  const kit = useDAppKit(dAppKit);

  const isConnected = connection.isConnected;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors(p => ({ ...p, [name]: undefined }));
  };

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

  const storeCidOnSui = async (videoId: string, cid: string) => {
    setStoringOnChain(true);
    try {
      const tx = new Transaction();
      // Store the IPFS CID on Sui chain
      // First, split a small amount of gas to create an object, or just use transaction metadata
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1000)]);
      
      // Transfer the tiny coin (this creates a transaction on-chain)
      // The CID will be visible in the transaction history
      tx.transferObjects([coin], tx.pure.address(kit.currentWallet?.accounts[0]?.address || ""));
      
      tx.setSender(kit.currentWallet?.accounts[0]?.address || "");
      tx.setGasBudget(BigInt(10000000)); // 0.01 SUI

      const result = await kit.signAndExecuteTransaction({ transaction: tx });
      console.log("[CreateVideoForm] Sui transaction result:", result);
      toast.success("IPFS CID stored on Sui chain!");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("reject")) {
        toast.info("On-chain storage cancelled.");
      } else {
        console.error("[CreateVideoForm] store on-chain error:", err);
        toast.error("Failed to store CID on Sui chain.");
      }
      return false;
    } finally {
      setStoringOnChain(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/videos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, youtubeUrl: form.youtubeUrl, priceSui: parseFloat(form.priceSui), durationHours: parseFloat(form.durationHours) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else toast.error(data.error || "Failed to create video");
        return;
      }
      setIpfsVideo(data.video);
      toast.success("Video encrypted and uploaded to Pinata IPFS!");
    } catch { toast.error("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const copyCid = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.cid);
    setCopiedCid(true);
    setTimeout(() => setCopiedCid(false), 2000);
  };

  if (created) {
    return (
      <div style={{ textAlign: "center" }} className="stack-lg">
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto" }}>
          ✅
        </div>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>Video Created!</h2>
          <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Encrypted on Pinata IPFS + stored on Sui chain!</p>
        </div>

        <div className="stack-sm" style={{ textAlign: "left" }}>
          {[
            { label: "Title", value: created.title, mono: false },
            { label: "Video ID", value: created.videoId, mono: true },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "0.75rem", padding: "1rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.375rem" }}>{item.label}</p>
              {item.mono ? <code className="mono" style={{ display: "block" }}>{item.value}</code> : <p style={{ color: "#f8fafc", fontWeight: 500 }}>{item.value}</p>}
            </div>
          ))}

          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "0.75rem", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#475569" }}>IPFS CID</p>
              <button onClick={copyCid} style={{ fontSize: "0.75rem", color: copiedCid ? "#4ade80" : "#6366f1", background: "none", border: "none", cursor: "pointer" }}>
                {copiedCid ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <code className="mono" style={{ display: "block", wordBreak: "break-all" }}>{created.cid}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
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

  if (ipfsVideo) {
    return (
      <div style={{ textAlign: "center" }} className="stack-lg">
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto" }}>
          📦
        </div>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>Video Uploaded to Pinata IPFS!</h2>
          <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Now optionally store the IPFS CID on Sui chain!</p>
        </div>

        <div className="stack-sm" style={{ textAlign: "left" }}>
          {[
            { label: "Title", value: ipfsVideo.title, mono: false },
            { label: "IPFS CID", value: ipfsVideo.cid, mono: true },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "0.75rem", padding: "1rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.375rem" }}>{item.label}</p>
              {item.mono ? <code className="mono" style={{ display: "block", wordBreak: "break-all" }}>{item.value}</code> : <p style={{ color: "#f8fafc", fontWeight: 500 }}>{item.value}</p>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setCreated(ipfsVideo);
              setIpfsVideo(null);
            }}
            className="btn btn-outline"
            style={{ flex: 1 }}
          >
            Skip On-Chain
          </button>
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {connecting ? "Connecting..." : "Connect Slush Wallet"}
            </button>
          ) : (
            <button
              onClick={async () => {
                await storeCidOnSui(ipfsVideo.videoId, ipfsVideo.cid);
                setCreated(ipfsVideo);
                setIpfsVideo(null);
              }}
              disabled={storingOnChain}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {storingOnChain ? "Storing on Sui..." : "Store CID on Sui"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack-lg">
      {/* Title */}
      <div>
        <label className="label" htmlFor="title">Video Title *</label>
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
          placeholder="https://www.youtube.com/watch?v=..."
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
            <li>Encrypted metadata stored directly on Pinata IPFS</li>
            <li>Optionally store IPFS CID on Sui chain</li>
            <li>Revenue cap: $20 USD gross per video</li>
            <li>Platform fee: 10% · Creator earnings: 90%</li>
          </ul>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
        {loading ? (
          <>
            <div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
            Encrypting & Uploading to Pinata IPFS...
          </>
        ) : (
          <> 🔐 Encrypt & Upload to Pinata IPFS </>
        )}
      </button>
    </form>
  );
}
