import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartCustomization {
  groupName: string;
  optionName: string;
  optionId: string;
  price: number;
}

export interface CartIngredientModification {
  ingredientId: string;
  ingredientName: string;
  modification: string; // "SEM Queijo", "+2 Ovo", "MAIS Maionese"
  price: number;
  quantity?: number;
  state?: string;
}

export interface CartItem {
  id: string; // unique ID para o item no carrinho
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number; // preço base (produto ou variante) — zero se paidWithPoints
  customizations: CartCustomization[];
  ingredientModifications: CartIngredientModification[];
  quantity: number;
  notes: string;
  itemTotal: number; // R$ pago no item (customizations + ingredientes; só inclui unitPrice se NÃO for pontos)
  /** Item resgatado com pontos do programa de fidelidade */
  paidWithPoints: boolean;
  /** Custo em pontos por unidade (snapshot na hora de adicionar ao carrinho) */
  pointsUnitCost: number;
}

interface CartState {
  tenantId: string | null;
  tenantSlug: string | null;
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "itemTotal">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setTenant: (tenantId: string, tenantSlug: string) => void;
  getSubtotal: () => number;
  getItemCount: () => number;
  getPointsToSpend: () => number;
}

function calculateItemTotal(item: Omit<CartItem, "id" | "itemTotal">): number {
  const customizationsPrice = item.customizations.reduce(
    (sum, c) => sum + c.price,
    0
  );
  const ingredientsPrice = (item.ingredientModifications ?? []).reduce(
    (sum, m) => sum + m.price,
    0
  );
  // Item pago com pontos: só adicionais entram no R$. Caso contrário, soma o preço base.
  const baseUnit = item.paidWithPoints ? 0 : item.unitPrice;
  return (baseUnit + customizationsPrice + ingredientsPrice) * item.quantity;
}

function generateItemId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      tenantSlug: null,
      items: [],

      setTenant: (tenantId: string, tenantSlug: string) => {
        const state = get();
        // Limpa carrinho se mudou de restaurante
        if (state.tenantId && state.tenantId !== tenantId) {
          set({ tenantId, tenantSlug, items: [] });
        } else {
          set({ tenantId, tenantSlug });
        }
      },

      addItem: (item) => {
        const itemTotal = calculateItemTotal(item);
        set((state) => ({
          items: [
            ...state.items,
            { ...item, id: generateItemId(), itemTotal },
          ],
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity,
                  itemTotal: calculateItemTotal({ ...item, quantity }),
                }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getSubtotal: () =>
        get().items.reduce((sum, item) => sum + item.itemTotal, 0),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getPointsToSpend: () =>
        get().items.reduce(
          (sum, item) =>
            sum + (item.paidWithPoints ? item.pointsUnitCost * item.quantity : 0),
          0
        ),
    }),
    {
      name: "matrix-food-cart",
    }
  )
);
