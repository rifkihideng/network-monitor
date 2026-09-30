"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/speed-test", label: "Speed Test" },
  { href: "/devices", label: "Devices" },
  { href: "/wifi-quality", label: "Wi-Fi Quality" },
  { href: "/history", label: "History" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="nav-links">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
