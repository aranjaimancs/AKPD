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
        className="relative w-8 h-8 rounded-full overflow-hidden transition-all duration-200 hover:ring-2 focus:outline-none focus:ring-2"
        style={{ ringColor: "var(--akp-gold)" } as React.CSSProperties}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName} fill className="object-cover" sizes="32px" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[11px] font-extrabold"
            style={{ background: "var(--akp-gold)", color: "var(--akp-navy)" }}
          >
            {initials}
          </div>
        )}
        {/* Online indicator */}
        <span
          className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2"
          style={{
            background: "#22c55e",
            borderColor: "var(--akp-navy)",
          }}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-3 w-60 rounded-2xl overflow-hidden animate-fade-up"
          style={{
            background: "var(--akp-white)",
            border: "1px solid var(--akp-gray-200)",
            boxShadow: "0 16px 48px rgba(10,34,64,0.18), 0 4px 16px rgba(10,34,64,0.1)",
            animationDuration: "0.15s",
          }}
        >
          {/* ── Header ── */}
          <div
            className="px-4 py-4 flex items-center gap-3"
            style={{ background: "var(--akp-off-white)", borderBottom: "1px solid var(--akp-gray-200)" }}
          >
            <div
              className="relative shrink-0 w-11 h-11 rounded-full overflow-hidden"
              style={{ boxShadow: "0 0 0 2px var(--akp-gold)" }}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill className="object-cover" sizes="44px" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-extrabold text-sm"
                  style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
                >
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p
                className="text-sm font-bold truncate leading-tight"
                style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
              >
                {displayName}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--akp-gray-400)" }}>
                {email}
              </p>
              {isAdmin && (
                <span
                  className="inline-block mt-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
                >
                  Admin
                </span>
              )}
            </div>
          </div>

          {/* ── Menu items ── */}
          <div className="p-1.5">
            <MenuItem
              href="/settings"
              onClick={close}
              icon={
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              label="Edit Profile"
            />
            <MenuItem
              href="/settings"
              onClick={close}
              icon={
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              label="Settings"
            />

            <div className="my-1 h-px mx-2" style={{ background: "var(--akp-gray-200)" }} />

            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors duration-150 hover:bg-red-50"
                style={{ color: "#dc2626" }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150"
      style={{ color: "var(--akp-gray-800)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--akp-off-white)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ color: "var(--akp-gray-400)" }}>{icon}</span>
      {label}
    </Link>
  );
}
