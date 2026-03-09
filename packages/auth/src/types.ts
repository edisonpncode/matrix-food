export type UserRole = "OWNER" | "MANAGER" | "CASHIER" | "DELIVERY";

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  tenantId: string | null;
  role: UserRole | null;
}
