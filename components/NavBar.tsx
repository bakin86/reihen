"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-all duration-300 ${
        active
          ? "bg-white/[0.10] text-white"
          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function NavBar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const profileActive = pathname === "/profile";

  return (
    <header className="anim-fade-in fixed left-0 right-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass flex items-center gap-1 rounded-full px-2 py-2">
        <Link
          href="/"
          className="display px-4 py-1.5 text-[13px] tracking-tight transition-opacity hover:opacity-60"
        >
          REIHEN
        </Link>

        <div className="mx-1 h-3 w-px bg-white/10" />

        <NavLink href="/booking">Book</NavLink>
        <NavLink href="/events">Events</NavLink>

        {!loading && user && (
          <>
            {(user.role === "OWNER" || user.role === "ADMIN") && (
              <NavLink href="/owner/dashboard">Dashboard</NavLink>
            )}
            {user.role === "STAFF" && (
              <NavLink href="/staff">Staff</NavLink>
            )}
          </>
        )}

        <div className="mx-1 h-3 w-px bg-white/10" />

        {loading ? (
          <div className="h-7 w-7 rounded-full bg-white/[0.04]" />
        ) : user ? (
          <Link
            href="/profile"
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold transition-colors ${
              profileActive ? "bg-white text-black" : "bg-white/[0.06] hover:bg-white/12"
            }`}
          >
            {user.name.charAt(0).toUpperCase()}
          </Link>
        ) : (
          <>
            <NavLink href="/login">Login</NavLink>
            <Link
              href="/register"
              className="rounded-full bg-white/[0.08] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] transition-all duration-300 hover:bg-white/15"
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
