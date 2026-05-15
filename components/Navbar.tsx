"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

interface User {
  email: string;
  suiAddress: string;
}

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLoggingOut(false);
    router.push("/");
  };

  const formatAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
              PT
            </div>
            <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
              PrivateTube
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/marketplace"
              className={`text-sm transition-colors ${
                pathname === "/marketplace"
                  ? "text-purple-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Marketplace
            </Link>
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm transition-colors ${
                    pathname === "/dashboard"
                      ? "text-purple-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/create"
                  className={`text-sm transition-colors ${
                    pathname === "/create"
                      ? "text-purple-400"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Create
                </Link>
              </>
            )}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-gray-400">{user.email}</span>
                  <span className="text-xs text-purple-400 font-mono">
                    {formatAddress(user.suiAddress)}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-all disabled:opacity-50"
                >
                  {loggingOut ? <LoadingSpinner size="sm" /> : "Logout"}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
