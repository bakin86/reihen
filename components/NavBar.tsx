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
      className={`relative px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-150 ${
        active ? "text-black" : "text-black/30 hover:text-black"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-px left-3 right-3 h-px bg-black" />
      )}
    </Link>
  );
}

export function NavBar() {
  const { user, loading } = useAuth();
  const pathname          = usePathname();
  const profileActive     = pathname === "/profile";

  return (
    <header className="anim-fade-down fixed left-0 right-0 top-0 z-50 bg-white/90 backdrop-blur-sm">
      <div className="h-px bg-black/[0.06]" />
      <nav className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3.5 md:px-10">

        {/* Wordmark */}
        <Link
          href="/"
          className="font-black uppercase tracking-[-0.04em] text-black transition-opacity hover:opacity-30"
          style={{ fontSize: "13px", fontFamily: "var(--font-display)", fontWeight: 900 }}
        >
          REIHEN
        </Link>

        {/* Centre nav */}
        <div className="hidden items-center gap-0 md:flex">
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
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-6 w-6 rounded-full bg-black/[0.05]" />
          ) : user ? (
            <Link
              href="/profile"
              className={`flex h-7 w-7 items-center justify-center text-[10px] font-bold transition-all ${
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
                className="text-[10px] font-medium uppercase tracking-[0.18em] text-black/30 transition-colors hover:text-black"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="btn-lift bg-black px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white hover:opacity-70"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="h-px bg-black/[0.05]" />
    </header>
  );
}
