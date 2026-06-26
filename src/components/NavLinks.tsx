"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ALL_LINKS = [
  { href: "/people",        label: "People",        alumniVisible: true  },
  { href: "/recruitment",   label: "Recruitment",   alumniVisible: false },
  { href: "/opportunities", label: "Opportunities", alumniVisible: true  },
  { href: "/seniors",       label: "Seniors",       alumniVisible: true  },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Admin", alumniVisible: false },
];

export default function NavLinks({
  isAdmin = false,
  isAlumni = false,
}: {
  isAdmin?: boolean;
  isAlumni?: boolean;
}) {
  const pathname = usePathname();
  const base = isAdmin ? [...ALL_LINKS, ...ADMIN_LINKS] : ALL_LINKS;
  const links = isAlumni ? base.filter((l) => l.alumniVisible) : base;

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="relative px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150"
            style={{
              color: active ? "var(--t-primary)" : "var(--t-secondary)",
              background: active ? "var(--s-1)" : "transparent",
              fontWeight: active ? 600 : 500,
            }}
          >
            {label}
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
