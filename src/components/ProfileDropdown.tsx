"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/lib/actions/auth";

type Props = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  isAdmin: boolean;
};

export default function ProfileDropdown({
  email,
  displayName,
  avatarUrl,
  initials,
  isAdmin,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={containerRef} className="relative">
      {/* ── Avatar button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 focus:outline-none"
        style={{
          background: open ? "var(--s-1)" : "transparent",
          border: "1px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "var(--s-1)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={displayName} fill className="object-cover" sizes="28px" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[10px] font-extrabold"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
            >
              {initials}
            </div>
          )}
        </div>
        <span className="text-[13px] font-medium hidden sm:block" style={{ color: "var(--t-secondary)" }}>
          {displayName.split(" ")[0]}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hidden sm:block"
          style={{ color: "var(--t-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden animate-scale-in"
          style={{
            background: "var(--s-0)",
            border: "1px solid var(--b-default)",
            boxShadow: "var(--shadow-xl)",
            transformOrigin: "top right",
          }}
        >
          {/* ── Header ── */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ borderBottom: "1px solid var(--b-subtle)" }}
          >
            <div className="relative shrink-0 w-9 h-9 rounded-full overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill className="object-cover" sizes="36px" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-bold text-xs"
                  style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
                >
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--t-primary)" }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
                {email}
              </p>
            </div>
          </div>

          {/* ── Menu items ── */}
          <div className="p-1.5">
            {isAdmin && (
              <div className="px-3 py-1.5 mb-1">
                <span className="badge badge-navy text-[10px]">Admin</span>
              </div>
            )}

            <MenuItem
              href="/settings"
              onClick={close}
              icon={
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              label="Edit Profile"
            />
            <MenuItem
              href="/settings"
              onClick={close}
              icon={
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              label="Settings"
            />

            <div className="my-1 h-px mx-1" style={{ background: "var(--b-subtle)" }} />

            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors duration-150 hover:bg-red-50"
                style={{ color: "#dc2626" }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  onClick,
  icon,
  label,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150"
      style={{ color: "var(--t-primary)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--s-1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ color: "var(--t-muted)" }}>{icon}</span>
      {label}
    </Link>
  );
}
