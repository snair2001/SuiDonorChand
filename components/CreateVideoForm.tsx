"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  const [created, setCreated] = useState<CreatedVideo | null>(null);
  const [copiedCid, setCopiedCid] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors(p => ({ ...p, [name]: undefined }));
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
      setCreated(data.video);
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
          <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Encrypted and stored on Pinata IPFS blockchain!</p>
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
