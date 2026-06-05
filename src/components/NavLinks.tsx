"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/people", label: "People" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/seniors", label: "Seniors" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="relative px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              color: active ? "var(--akp-gold)" : "rgba(255,255,255,0.65)",
              background: active ? "rgba(201,168,76,0.1)" : "transparent",
            }}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: "var(--akp-gold)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
