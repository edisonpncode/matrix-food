"use client";

import { useRef, useEffect, useCallback } from "react";

interface Category {
  id: string;
  name: string;
}

interface CategoryBarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryBar({
  categories,
  activeCategoryId,
  onSelect,
}: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const isUserClick = useRef(false);

  // Auto-scroll a barra ao tab ativo
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const scrollLeft =
        tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeCategoryId]);

  // IntersectionObserver para scrollspy
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (isUserClick.current) return;

      for (const entry of entries) {
        if (entry.isIntersecting) {
          const categoryId = entry.target.getAttribute("data-category-id");
          if (categoryId) {
            onSelect(categoryId);
          }
          break;
        }
      }
    },
    [onSelect]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "-120px 0px -60% 0px",
      threshold: 0,
    });

    const sections = document.querySelectorAll("[data-category-id]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [handleIntersection]);

  // Quando o usuario clica, desabilita scrollspy por 1s
  function handleClick(id: string) {
    isUserClick.current = true;
    onSelect(id);
    setTimeout(() => {
      isUserClick.current = false;
    }, 1000);
  }

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
                onClick={() => handleClick(category.id)}
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

// Mantém export com nome antigo para compatibilidade
export { CategoryBar as CategoryTabs };
