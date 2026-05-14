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
      className={`px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition-all duration-200 ${
        active
          ? "text-[#0A0A0A] font-semibold"
          : "text-[#888] hover:text-[#0A0A0A]"
      }`}
      style={active ? { borderBottom: "2px solid #F5C000" } : {}}
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
    <header className="anim-fade-in fixed left-0 right-0 top-0 z-50 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-black/[0.06]">
      <nav className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-3 md:px-10">
        {/* Logo */}
        <Link
          href="/"
          className="display text-[22px] tracking-[0.04em] text-[#0A0A0A] transition-opacity hover:opacity-60"
        >
          REIHEN
        </Link>

        {/* Center links */}
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

        {/* Right: auth */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-7 w-7 rounded-full bg-black/[0.04]" />
          ) : user ? (
            <Link
              href="/profile"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                profileActive
                  ? "bg-[#F5C000] text-black"
                  : "bg-black/[0.06] text-black hover:bg-[#F5C000] hover:text-black"
              }`}
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#888] transition-colors hover:text-[#0A0A0A]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-sm bg-[#0A0A0A] px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white transition-all hover:bg-[#F5C000] hover:text-black"
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
