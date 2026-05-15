import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-20 pb-32">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Powered by Sui zkLogin + Pinata IPFS
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
            <span className="text-white">Encrypted Video</span>
            <br />
            <span className="gradient-text">Access Gate</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Creators encrypt YouTube links with AES-256-GCM. Viewers login with
            Google zkLogin, pay SUI testnet, and watch for limited time — all
            metadata stored on Pinata IPFS.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <LoginButton
              label="Get Started with Google"
              className="w-full sm:w-auto"
            />
            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-6 py-3 border border-white/10 hover:border-white/30 text-gray-300 hover:text-white rounded-xl transition-all text-center"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-gray-400">
            A fully encrypted, decentralized video access system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: "🔐",
              step: "01",
              title: "Creator Encrypts",
              desc: "Upload an unlisted YouTube link. It's encrypted with AES-256-GCM and stored on Pinata IPFS.",
            },
            {
              icon: "🔑",
              step: "02",
              title: "zkLogin Auth",
              desc: "Viewers sign in with Google via Sui zkLogin — no wallet seed phrase needed.",
            },
            {
              icon: "💎",
              step: "03",
              title: "Pay with SUI",
              desc: "Pay SUI testnet tokens. 90% goes to creator, 10% platform fee. All verified on-chain.",
            },
            {
              icon: "▶️",
              step: "04",
              title: "Watch Securely",
              desc: "Backend decrypts the URL server-side and serves only an embed URL for the access period.",
            },
          ].map((item) => (
            <div key={item.step} className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{item.icon}</span>
                <span className="text-xs font-mono text-purple-400/60">
                  {item.step}
                </span>
              </div>
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">
              Built for Security
            </h2>
            <p className="text-gray-400">
              Every layer designed to protect creator content
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🛡️",
                title: "AES-256-GCM Encryption",
                desc: "YouTube URLs encrypted with military-grade encryption. Keys never leave the server.",
              },
              {
                icon: "🌐",
                title: "Pinata IPFS Storage",
                desc: "Encrypted metadata stored on decentralized IPFS. No central database to hack.",
              },
              {
                icon: "🔮",
                title: "Sui zkLogin",
                desc: "Login with Google, get a Sui wallet address. No seed phrases, no extensions.",
              },
              {
                icon: "⏱️",
                title: "Time-Limited Access",
                desc: "Access expires automatically. Creators control how long viewers can watch.",
              },
              {
                icon: "💰",
                title: "Revenue Cap System",
                desc: "$20 USD gross revenue cap per video. Automatic sold-out when cap is reached.",
              },
              {
                icon: "🔒",
                title: "Server-Side Decryption",
                desc: "Raw YouTube URLs never reach the frontend. Decryption only in API routes.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-5 space-y-3 hover:border-purple-500/20 transition-all"
              >
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="font-semibold text-white text-sm">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section className="px-4 py-20 max-w-4xl mx-auto">
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Revenue Model
            </h2>
            <p className="text-gray-400 text-sm">
              Transparent, on-chain payment splits
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-3xl font-bold text-purple-300">90%</p>
              <p className="text-sm text-gray-400 mt-1">Creator Earnings</p>
            </div>
            <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-3xl font-bold text-blue-300">10%</p>
              <p className="text-sm text-gray-400 mt-1">Platform Fee</p>
            </div>
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-3xl font-bold text-green-300">$20</p>
              <p className="text-sm text-gray-400 mt-1">Revenue Cap / Video</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            After a video reaches $20 USD gross revenue, it&apos;s automatically
            removed from the marketplace. Existing paid users retain access until
            expiry.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-4 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>PrivateTube Access Gate — Sui Testnet MVP</p>
          <div className="flex items-center gap-4">
            <Link href="/marketplace" className="hover:text-gray-300 transition-colors">
              Marketplace
            </Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
