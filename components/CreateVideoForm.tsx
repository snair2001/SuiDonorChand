"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    youtubeUrl: "",
    priceSui: "1",
    durationHours: "24",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedVideo | null>(null);
  const [copiedCid, setCopiedCid] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
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
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          youtubeUrl: form.youtubeUrl,
          priceSui: parseFloat(form.priceSui),
          durationHours: parseFloat(form.durationHours),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          toast.error(data.error || "Failed to create video");
        }
        return;
      }

      setCreated(data.video);
      toast.success("Video created and encrypted on IPFS!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyCid = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.cid);
    setCopiedCid(true);
    setTimeout(() => setCopiedCid(false), 2000);
  };

  if (created) {
    return (
      <div className="glass-card rounded-2xl p-8 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto text-3xl">
          ✅
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Video Created!
          </h2>
          <p className="text-gray-400">
            Your video has been encrypted and stored on Pinata IPFS
          </p>
        </div>

        <div className="space-y-3 text-left">
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500">Video Title</p>
            <p className="text-white font-medium">{created.title}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500">Video ID</p>
            <code className="text-purple-300 text-sm font-mono break-all">
              {created.videoId}
            </code>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">IPFS CID</p>
              <button
                onClick={copyCid}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {copiedCid ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <code className="text-blue-300 text-xs font-mono break-all">
              {created.cid}
            </code>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setCreated(null);
              setForm({
                title: "",
                description: "",
                youtubeUrl: "",
                priceSui: "1",
                durationHours: "24",
              });
            }}
            className="flex-1 px-4 py-2.5 border border-white/10 hover:border-white/30 text-gray-300 rounded-xl transition-all"
          >
            Create Another
          </button>
          <button
            onClick={() => router.push("/marketplace")}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl transition-all"
          >
            View Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300" htmlFor="title">
          Video Title *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={form.title}
          onChange={handleChange}
          placeholder="Enter a descriptive title"
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${
            errors.title ? "border-red-500/50" : "border-white/10"
          }`}
          maxLength={100}
        />
        {errors.title && (
          <p className="text-xs text-red-400">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-gray-300"
          htmlFor="description"
        >
          Description *
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Describe what viewers will get access to"
          rows={3}
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none ${
            errors.description ? "border-red-500/50" : "border-white/10"
          }`}
          maxLength={1000}
        />
        {errors.description && (
          <p className="text-xs text-red-400">{errors.description}</p>
        )}
      </div>

      {/* YouTube URL */}
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-gray-300"
          htmlFor="youtubeUrl"
        >
          YouTube URL (Unlisted) *
        </label>
        <input
          id="youtubeUrl"
          name="youtubeUrl"
          type="url"
          value={form.youtubeUrl}
          onChange={handleChange}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono text-sm ${
            errors.youtubeUrl ? "border-red-500/50" : "border-white/10"
          }`}
        />
        {errors.youtubeUrl && (
          <p className="text-xs text-red-400">{errors.youtubeUrl}</p>
        )}
        <p className="text-xs text-gray-500">
          ⚠️ Use unlisted YouTube videos only. The URL will be AES-256-GCM
          encrypted before storage.
        </p>
      </div>

      {/* Price & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-gray-300"
            htmlFor="priceSui"
          >
            Price (SUI) *
          </label>
          <div className="relative">
            <input
              id="priceSui"
              name="priceSui"
              type="number"
              value={form.priceSui}
              onChange={handleChange}
              min="0.001"
              max="10000"
              step="0.001"
              className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${
                errors.priceSui ? "border-red-500/50" : "border-white/10"
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              SUI
            </span>
          </div>
          {errors.priceSui && (
            <p className="text-xs text-red-400">{errors.priceSui}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-gray-300"
            htmlFor="durationHours"
          >
            Access Duration *
          </label>
          <div className="relative">
            <input
              id="durationHours"
              name="durationHours"
              type="number"
              value={form.durationHours}
              onChange={handleChange}
              min="1"
              max="8760"
              step="1"
              className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${
                errors.durationHours ? "border-red-500/50" : "border-white/10"
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              hrs
            </span>
          </div>
          {errors.durationHours && (
            <p className="text-xs text-red-400">{errors.durationHours}</p>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-blue-300">How it works</p>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Your YouTube URL is encrypted with AES-256-GCM</li>
          <li>• Encrypted metadata is stored on Pinata IPFS</li>
          <li>• Revenue cap: $20 USD gross per video</li>
          <li>• Platform fee: 10% | Creator earnings: 90%</li>
          <li>• Viewers pay SUI testnet for time-limited access</li>
        </ul>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Encrypting & Uploading to IPFS...
          </>
        ) : (
          <>
            <span>🔐</span>
            Encrypt & Publish to IPFS
          </>
        )}
      </button>
    </form>
  );
}
