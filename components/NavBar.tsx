"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProfilePopover } from "@/components/ProfilePopover";
import { useAuth } from "@/lib/useAuth";

function NavLink({
  href,
  children,
  exact = false,
  dark = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  dark?: boolean;
}) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`relative rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-200 ${
        active
          ? "bg-white text-black"
          : dark
            ? "text-white/50 hover:bg-white/[0.10] hover:text-white"
            : "text-black/45 hover:bg-black/[0.06] hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
}

export function NavBar({ dark = false }: { dark?: boolean }) {
  const { user, loading } = useAuth();
  const pathname          = usePathname();
  const router            = useRouter();
  const profileActive     = pathname === "/profile";
  const [open, setOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const roleLinks = !loading && user
    ? [
        ...((user.role === "OWNER" || user.role === "ADMIN")
          ? [{ href: "/owner/dashboard", label: "Dashboard" }]
          : []),
        ...(user.role === "STAFF" ? [{ href: "/staff", label: "Staff" }] : []),
      ]
    : [];

  return (
    <header className="anim-fade-down fixed left-0 right-0 top-3 z-[120] isolate flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-fit max-w-[calc(100vw-2rem)]">
        <nav className={`flex max-w-full items-center gap-0.5 rounded-full px-2 py-1.5 backdrop-blur-xl ${
          dark
            ? "border border-white/[0.12] bg-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.40)]"
            : "border border-black/[0.09] bg-white/90 shadow-[0_8px_40px_rgba(0,0,0,0.10)]"
        }`}>

          {/* Wordmark */}
          <Link
            href="/"
            onClick={() => { setOpen(false); setProfileOpen(false); }}
            className={`rounded-full px-3 py-1.5 font-black uppercase transition-colors ${
              dark
                ? "text-white hover:bg-white/10"
                : "text-black hover:bg-black hover:text-white"
            }`}
            style={{ fontSize: "12px", fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: 0 }}
          >
            REIHEN
          </Link>

          {/* Separator */}
          <span className={`mx-1.5 h-3.5 w-px shrink-0 ${dark ? "bg-white/10" : "bg-black/10"}`} />

          {/* Links — desktop */}
          <div className="hidden items-center gap-0.5 md:flex">
            <NavLink href="/centers" dark={dark}>Centers</NavLink>
            <NavLink href="/events" dark={dark}>Events</NavLink>
            {roleLinks.map((link) => (
              <NavLink key={link.href} href={link.href} dark={dark}>{link.label}</NavLink>
            ))}
          </div>

          {/* Separator — desktop only */}
          {!loading && (
            <span className={`mx-1.5 hidden h-3.5 w-px shrink-0 md:block ${dark ? "bg-white/10" : "bg-black/10"}`} />
          )}

          {/* Auth actions */}
          <div className="flex items-center gap-1">
            {loading ? (
              <div className={`h-6 w-6 rounded-full ${dark ? "bg-white/[0.08]" : "bg-black/[0.05]"}`} />
            ) : user ? (
              <div className="relative" data-profile-popover-root>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (window.matchMedia("(max-width: 639px)").matches) {
                      setProfileOpen(false);
                      router.push("/profile");
                      return;
                    }
                    setProfileOpen((v) => !v);
                  }}
                  className={`profile-avatar-button flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    profileActive || profileOpen
                      ? "bg-white text-black"
                      : dark
                        ? "bg-white/10 text-white hover:bg-white hover:text-black"
                        : "bg-black/[0.07] text-black hover:bg-black hover:text-white"
                  }`}
                  aria-expanded={profileOpen}
                  aria-haspopup="dialog"
                  aria-label="Open profile menu"
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
                <ProfilePopover open={profileOpen} onClose={() => setProfileOpen(false)} />
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => { setOpen(false); setProfileOpen(false); }}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    dark
                      ? "text-white/50 hover:bg-white/10 hover:text-white"
                      : "text-black/45 hover:bg-black/[0.06] hover:text-black"
                  }`}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => { setOpen(false); setProfileOpen(false); }}
                  className={`hidden rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors md:inline-flex ${
                    dark
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-black text-white hover:bg-black/80"
                  }`}
                >
                  Register
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={`inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors md:hidden ${
                dark
                  ? "border border-white/10 text-white/50 hover:bg-white hover:text-black"
                  : "border border-black/10 text-black/50 hover:bg-black hover:text-white"
              }`}
              aria-expanded={open}
              aria-label="Toggle navigation"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {open && (
          <div className="nav-menu-enter mt-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white/92 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <div className="grid gap-0.5 p-2">
              <MobileNavLink href="/centers" label="Centers" onClick={() => { setOpen(false); setProfileOpen(false); }} active={pathname.startsWith("/centers")} />
              <MobileNavLink href="/events"  label="Events"  onClick={() => { setOpen(false); setProfileOpen(false); }} active={pathname.startsWith("/events")} />
              {roleLinks.map((link) => (
                <MobileNavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  onClick={() => { setOpen(false); setProfileOpen(false); }}
                  active={pathname.startsWith(link.href)}
                />
              ))}
              {!loading && !user && (
                <MobileNavLink href="/register" label="Register" onClick={() => { setOpen(false); setProfileOpen(false); }} active={pathname.startsWith("/register")} />
              )}
            </div>
          </div>
        )}
      </div>
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
      className={`flex items-center justify-between rounded-xl px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
        active ? "bg-black text-white" : "text-black/55 hover:bg-black/[0.05] hover:text-black"
      }`}
    >
      {label}
      <span className="text-black/25">→</span>
    </Link>
  );
}
