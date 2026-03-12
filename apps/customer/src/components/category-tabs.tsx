"use client";

import { useRef, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface CategoryTabsProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategoryId,
  onSelect,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll ao tab ativo
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const scrollLeft =
        tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeCategoryId]);

  return (
    <div className="sticky top-0 z-10 bg-white shadow-sm">
      <div
        ref={scrollRef}
        className="mx-auto max-w-2xl overflow-x-auto scrollbar-hide"
      >
        <div className="flex gap-1 px-4 py-2">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            return (
              <button
                key={category.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => onSelect(category.id)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
