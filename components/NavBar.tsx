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
      className={`px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors duration-200 ${
        active ? "text-[#EDE8E0]" : "text-[#6B6560] hover:text-[#EDE8E0]"
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
    <header className="anim-fade-in fixed left-0 right-0 top-0 z-50">
      <nav className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/"
          className="display text-[22px] tracking-[0.04em] text-[#EDE8E0] transition-opacity hover:opacity-40"
        >
          REIHEN
        </Link>

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

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-6 w-6 rounded-full bg-white/[0.06]" />
          ) : user ? (
            <Link
              href="/profile"
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                profileActive
                  ? "bg-[#F5C000] text-[#0C0B09]"
                  : "bg-white/[0.08] text-[#EDE8E0] hover:bg-[#F5C000] hover:text-[#0C0B09]"
              }`}
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[10px] uppercase tracking-[0.18em] text-[#6B6560] transition-colors hover:text-[#EDE8E0]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-[#F5C000] px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#0C0B09] font-semibold transition-all hover:bg-[#EDE8E0]"
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
