import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Camera, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function Layout() {
  const { user, logout } = useAuth();
  const initial = (user?.full_name || user?.email || "?").trim()[0]?.toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-neutral-200">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-white">
              <Camera className="h-4 w-4" />
            </span>
            <span className="font-semibold tracking-tight text-neutral-900">Energy Lens</span>
          </Link>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-neutral-200 text-sm font-medium text-neutral-700"
                  aria-label="Account"
                >
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-neutral-900">{user.full_name}</p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
