"use client";
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

  return (
    <header className="anim-fade-down fixed left-0 right-0 top-3 z-50 px-3">
      <nav className="mx-auto flex max-w-screen-xl items-center justify-between rounded-lg border border-black/[0.08] bg-white/82 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl md:px-4">

        {/* Wordmark */}
        <Link
          href="/"
          className="rounded-lg px-3 py-2 font-black uppercase text-black transition-colors hover:bg-black hover:text-white"
          style={{ fontSize: "13px", fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: 0 }}
        >
          REIHEN
        </Link>

        {/* Centre nav */}
        <div className="hidden items-center gap-1 md:flex">
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
        </div>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-6 w-6 rounded-full bg-black/[0.05]" />
          ) : user ? (
            <Link
              href="/profile"
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
                className="rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/42 transition-colors hover:bg-black/[0.05] hover:text-black"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="ui-button ui-button-primary hidden h-8 min-h-0 px-3 py-0 md:inline-flex"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
