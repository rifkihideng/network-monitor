import type { Metadata } from "next";
import UserNav from "@/components/ui/UserNav";
import NavLinks from "@/components/ui/NavLinks";
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
          <a className="brand" href="/">
            <span className="brand-logo" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M2.5 9.5a15 15 0 0 1 19 0" />
                <path d="M5.5 13a10.5 10.5 0 0 1 13 0" />
                <path d="M8.5 16.5a6 6 0 0 1 7 0" />
                <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="brand-text">
              Network <span>Monitor</span>
            </span>
          </a>
          <NavLinks />
          <div className="spacer" />
          <UserNav />
        </nav>
        <main className="container">{children}</main>
        <footer className="footer">
          Network Monitor · data diperbarui otomatis
        </footer>
      </body>
    </html>
  );
}
