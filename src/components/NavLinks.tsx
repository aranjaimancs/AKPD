"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MEMBER_LINKS = [
  { href: "/people",        label: "People" },
  { href: "/recruitment",   label: "Recruitment" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/seniors",       label: "Seniors" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Admin" },
];

export default function NavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...MEMBER_LINKS, ...ADMIN_LINKS] : MEMBER_LINKS;

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const isAdmin = href.startsWith("/admin");
        return (
          <Link
            key={href}
            href={href}
            className="relative px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150"
            style={{
              color: active
                ? "var(--t-primary)"
                : "var(--t-secondary)",
              background: active ? "var(--s-1)" : "transparent",
              fontWeight: active ? 600 : 500,
            }}
          >
            {label}
            {/* Active underline */}
            {active && (
              <span
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                style={{ background: "var(--akp-gold)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
