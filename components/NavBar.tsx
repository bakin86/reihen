"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`relative rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
        active ? "bg-black text-white shadow-sm" : "text-black/42 hover:bg-black/[0.05] hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
}

export function NavBar() {
  const { user, loading } = useAuth();
  const pathname          = usePathname();
  const profileActive     = pathname === "/profile";
  const [open, setOpen]   = useState(false);

  const roleLinks = !loading && user
    ? [
        ...((user.role === "OWNER" || user.role === "ADMIN")
          ? [{ href: "/owner/dashboard", label: "Dashboard" }]
          : []),
        ...(user.role === "STAFF" ? [{ href: "/staff", label: "Staff" }] : []),
      ]
    : [];

  return (
    <header className="anim-fade-down fixed left-0 right-0 top-3 z-50 px-3">
      <nav className="mx-auto max-w-screen-xl rounded-lg border border-black/[0.08] bg-white/82 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl md:px-4">
        <div className="flex items-center justify-between">

        {/* Wordmark */}
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 font-black uppercase text-black transition-colors hover:bg-black hover:text-white"
          style={{ fontSize: "13px", fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: 0 }}
        >
          REIHEN
        </Link>

        {/* Centre nav */}
        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/booking">Book</NavLink>
          <NavLink href="/events">Events</NavLink>
          {roleLinks.map((link) => (
            <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
          ))}
        </div>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-6 w-6 rounded-full bg-black/[0.05]" />
          ) : user ? (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                profileActive
                  ? "bg-black text-white"
                  : "bg-black/[0.07] text-black hover:bg-black hover:text-white"
              }`}
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42 transition-colors hover:bg-black/[0.05] hover:text-black"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="ui-button ui-button-primary hidden h-8 min-h-0 px-3 py-0 md:inline-flex"
              >
                Register
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50 transition-colors hover:bg-black hover:text-white md:hidden"
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        </div>

        {open && (
          <div className="mt-2 grid gap-1 border-t border-black/[0.06] pt-2 md:hidden">
            <MobileNavLink href="/booking" label="Book" onClick={() => setOpen(false)} active={pathname.startsWith("/booking")} />
            <MobileNavLink href="/events" label="Events" onClick={() => setOpen(false)} active={pathname.startsWith("/events")} />
            {roleLinks.map((link) => (
              <MobileNavLink
                key={link.href}
                href={link.href}
                label={link.label}
                onClick={() => setOpen(false)}
                active={pathname.startsWith(link.href)}
              />
            ))}
            {!loading && !user && (
              <MobileNavLink href="/register" label="Register" onClick={() => setOpen(false)} active={pathname.startsWith("/register")} />
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

function MobileNavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
        active ? "bg-black text-white" : "text-black/55 hover:bg-black/[0.05] hover:text-black"
      }`}
    >
      {label}
      <span className="text-black/25">→</span>
    </Link>
  );
}
