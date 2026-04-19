/**
 * Header Component
 * Top navigation bar with notifications and user menu
 */

import { Bell, User, LogOut, Settings, UserCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuthStore } from "~/lib/stores/auth-store";
import { Breadcrumbs } from "./breadcrumbs";

export function Header() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    // Redirect to login page (if needed)
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white shadow-sm px-6">
      {/* Breadcrumbs */}
      <div className="flex-1">
        <Breadcrumbs />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-lg hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:scale-105 active:scale-95 transition-all duration-200 border border-transparent hover:border-blue-200"
          >
            <div className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full ring-2 ring-white animate-pulse"></span>
            </div>
          </Button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 px-3 rounded-lg hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 hover:scale-105 active:scale-95 transition-all duration-200 border border-transparent hover:border-purple-200 flex items-center gap-2"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md ring-2 ring-purple-100">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 hidden md:inline-block">
                {user?.name || "My Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 shadow-xl border-0 rounded-lg p-0"
          >
            <div className="overflow-hidden rounded-lg">
              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/50">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-base">
                      {user?.name || "User"}
                    </div>
                    <div className="text-purple-100 text-sm">
                      {user?.email || "user@example.com"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <DropdownMenuItem className="cursor-pointer rounded-md hover:bg-purple-50 focus:bg-purple-50 py-3 px-3">
                  <UserCircle className="mr-3 h-4 w-4 text-purple-600" />
                  <span className="font-medium">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer rounded-md hover:bg-purple-50 focus:bg-purple-50 py-3 px-3">
                  <Settings className="mr-3 h-4 w-4 text-purple-600" />
                  <span className="font-medium">Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer rounded-md hover:bg-red-50 focus:bg-red-50 py-3 px-3 text-red-600"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="font-medium">Logout</span>
                </DropdownMenuItem>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
