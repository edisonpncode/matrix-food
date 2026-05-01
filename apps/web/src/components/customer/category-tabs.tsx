"use client";

import { useRef, useEffect } from "react";

interface Category {
  id: string;
  name: string;
}

interface CategoryBarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  onScrollspy?: (id: string) => void;
}

export function CategoryBar({
  categories,
  activeCategoryId,
  onSelect,
  onScrollspy,
}: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const isUserClick = useRef(false);

  // Mantem refs sempre com os callbacks mais recentes para nao recriar
  // o listener de scroll a cada render do pai.
  const onScrollspyRef = useRef(onScrollspy);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onScrollspyRef.current = onScrollspy;
    onSelectRef.current = onSelect;
  });

  // Centraliza horizontalmente o tab ativo na barra.
  // Usa getBoundingClientRect porque tab.offsetLeft eh relativo ao
  // offsetParent (a div sticky) e nao ao container de scroll, que tem
  // mx-auto e ganha margem automatica em telas largas.
  useEffect(() => {
    if (!activeRef.current || !scrollRef.current) return;

    const container = scrollRef.current;
    const tab = activeRef.current;
    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    const tabOffsetInContent =
      tabRect.left - containerRect.left + container.scrollLeft;
    const target =
      tabOffsetInContent + tab.offsetWidth / 2 - container.offsetWidth / 2;

    container.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [activeCategoryId]);

  // Scrollspy baseado em scroll: a categoria ativa eh a ULTIMA cuja
  // secao tem o topo acima da linha de gatilho (logo abaixo da barra
  // sticky). Mais previsivel que o IntersectionObserver com faixa larga.
  useEffect(() => {
    let frameId: number | null = null;

    const update = () => {
      frameId = null;
      if (isUserClick.current) return;

      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("[data-category-id]")
      );
      const first = sections[0];
      if (!first) return;

      const triggerY = 100;
      let activeId = first.getAttribute("data-category-id");

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= triggerY) {
          activeId = section.getAttribute("data-category-id");
        } else {
          break;
        }
      }

      if (activeId) {
        const cb = onScrollspyRef.current ?? onSelectRef.current;
        cb(activeId);
      }
    };

    const onScroll = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  // Quando o usuario clica, desabilita scrollspy por 1s para nao
  // brigar com o scroll suave acionado pelo onSelect.
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
