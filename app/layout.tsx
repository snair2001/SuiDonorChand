import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SuiProviders } from "@/components/SuiProviders";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrivateTube Access Gate",
  description:
    "Encrypted video access platform powered by Sui zkLogin and Pinata IPFS",
  keywords: ["Sui", "zkLogin", "IPFS", "encrypted video", "Web3", "Slush"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SuiProviders>
          <Navbar />
          <main className="pt-16">{children}</main>
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "rgba(15, 10, 46, 0.95)",
                border: "1px solid rgba(168, 85, 247, 0.2)",
                color: "#f8fafc",
              },
            }}
          />
        </SuiProviders>
      </body>
    </html>
  );
}
