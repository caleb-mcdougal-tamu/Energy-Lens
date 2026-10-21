import React from "react";
import { TAGS } from "@/lib/photoTag";
import { useActiveTag } from "@/hooks/useActiveTag";
import { cn } from "@/lib/utils";

export default function TagSelector({ contextDefault }) {
  const [active, setActive] = useActiveTag(contextDefault);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="text-[11px] text-neutral-400 shrink-0 mr-0.5">Tag</span>
      {TAGS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setActive(t)}
          className={cn(
            "shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors",
            active === t
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}