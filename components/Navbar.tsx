"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

interface User {
  email: string;
  suiAddress: string;
  isAdmin?: boolean;
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
      .then((data) => { setUser(data.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLoggingOut(false);
    router.push("/");
  };

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">PT</div>
          <span className="nav-logo-text">PrivateTube</span>
        </Link>

        {/* Nav links */}
        <div className="nav-links">
          <Link href="/marketplace" className={`nav-link${isActive("/marketplace") ? " active" : ""}`}>
            Marketplace
          </Link>
          {user && (
            <Link href="/dashboard" className={`nav-link${isActive("/dashboard") ? " active" : ""}`}>
              Dashboard
            </Link>
          )}
          {user && (
            <Link href="/create" className={`nav-link${isActive("/create") ? " active" : ""}`}>
              Create
            </Link>
          )}
        </div>

        {/* Right side — only zkLogin session, no separate wallet button */}
        <div className="nav-right">
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              {user.isAdmin && (
                <span className="badge badge-yellow" style={{ fontSize: "0.6875rem" }}>
                  🛡️ Admin
                </span>
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }} className="nav-user-info">
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#a855f7", fontFamily: "monospace" }}>
                  {user.suiAddress.slice(0, 6)}...{user.suiAddress.slice(-4)}
                </span>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn btn-outline btn-sm"
              >
                {loggingOut ? <LoadingSpinner size="sm" /> : "Logout"}
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Login
            </Link>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .nav-user-info { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
