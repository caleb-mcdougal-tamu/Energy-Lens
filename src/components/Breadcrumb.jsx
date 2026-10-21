import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap py-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "shrink-0 max-w-[60vw] truncate",
                  isLast ? "font-medium text-neutral-900" : "text-neutral-500"
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}