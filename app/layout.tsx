import type { Metadata } from "next";
import UserNav from "@/components/ui/UserNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Network Monitor",
  description:
    "Dashboard monitoring jaringan: speed test, device monitor, Wi-Fi quality, dan internet history",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <nav className="nav">
          <span className="brand">Network Monitor</span>
          <div className="nav-links">
            <a href="/">Dashboard</a>
            <a href="/speed-test">Speed Test</a>
            <a href="/devices">Devices</a>
            <a href="/wifi-quality">Wi-Fi Quality</a>
            <a href="/history">History</a>
          </div>
          <div className="spacer" />
          <UserNav />
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
