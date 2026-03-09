import { test, expect } from "@playwright/test";

test.describe("Página inicial do cliente", () => {
  test("deve exibir o título Matrix Food", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /matrix food/i })).toBeVisible();
  });

  test("deve exibir mensagem de em construção", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/em construção/i)).toBeVisible();
  });
});
