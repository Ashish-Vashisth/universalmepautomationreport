"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Droplets } from "lucide-react";

export function Header() {
  return (
    <header className="glass-card mx-4 mt-4 mb-0 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ff4b4b]/20 border border-[#ff4b4b]/30">
          <Droplets className="h-5 w-5 text-[#ff4b4b]" />
        </div>
        <div>
          <h1 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg leading-tight">
            UNIVERSAL MEP JJM SWSM
          </h1>
          <p className="text-slate-500 dark:text-white/50 text-xs sm:text-sm leading-tight">
            Daily Report Generator
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs text-slate-500 dark:text-white/60">
          v2.0
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
