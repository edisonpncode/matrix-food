/**
 * Script para criar dados de desenvolvimento.
 * Uso: DATABASE_URL=... npx tsx src/seed.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL é obrigatório");
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("Criando tenant de desenvolvimento...");

  // Criar restaurante de exemplo
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: "Point Lanches",
      slug: "point-lanches",
      description: "O melhor lanche da cidade!",
      phone: "(51) 99999-9999",
      whatsapp: "(51) 99999-9999",
      email: "contato@pointlanches.net",
      address: "Rua Exemplo, 123",
      city: "Porto Alegre",
      state: "RS",
      zipCode: "90000-000",
      operatingHours: {
        seg: { open: "18:00", close: "23:00", isOpen: true },
        ter: { open: "18:00", close: "23:00", isOpen: true },
        qua: { open: "18:00", close: "23:00", isOpen: true },
        qui: { open: "18:00", close: "23:00", isOpen: true },
        sex: { open: "18:00", close: "00:00", isOpen: true },
        sab: { open: "18:00", close: "00:00", isOpen: true },
        dom: { open: "18:00", close: "23:00", isOpen: true },
      },
      deliverySettings: {
        minOrder: 20,
        deliveryFee: 5,
        maxRadius: 10,
        estimatedMinutes: { min: 30, max: 50 },
      },
      paymentMethodsAccepted: ["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"],
      themeSettings: {
        primaryColor: "#7c3aed",
        secondaryColor: "#f59e0b",
      },
    })
    .returning();

  if (!tenant) {
    throw new Error("Falha ao criar tenant");
  }

  console.log(`Tenant criado: ${tenant.name} (ID: ${tenant.id})`);
  console.log(`\nAdicione ao seu .env.local:`);
  console.log(`DEV_TENANT_ID=${tenant.id}`);

  // Criar categorias de exemplo
  const categoryData = [
    { name: "Hambúrgueres", description: "Os melhores hambúrgueres artesanais", sortOrder: 0 },
    { name: "Pizzas", description: "Pizzas tradicionais e especiais", sortOrder: 1 },
    { name: "Bebidas", description: "Refrigerantes, sucos e mais", sortOrder: 2 },
    { name: "Sobremesas", description: "Doces para finalizar", sortOrder: 3 },
  ];

  const createdCategories = await db
    .insert(schema.categories)
    .values(
      categoryData.map((c) => ({
        ...c,
        tenantId: tenant.id,
      }))
    )
    .returning();

  console.log(`${createdCategories.length} categorias criadas`);

  // Criar produtos de exemplo
  const hamburguerCat = createdCategories.find((c) => c.name === "Hambúrgueres");
  const pizzaCat = createdCategories.find((c) => c.name === "Pizzas");
  const bebidaCat = createdCategories.find((c) => c.name === "Bebidas");

  if (hamburguerCat) {
    // Hambúrguer simples
    const [burger] = await db
      .insert(schema.products)
      .values({
        tenantId: tenant.id,
        categoryId: hamburguerCat.id,
        name: "X-Burger Clássico",
        description: "Pão, hambúrguer 150g, queijo, alface, tomate e maionese da casa",
        price: "22.90",
        isNew: false,
        hasVariants: false,
        sortOrder: 0,
      })
      .returning();

    if (burger) {
      // Grupo de adicionais
      const [addGroup] = await db
        .insert(schema.customizationGroups)
        .values({
          productId: burger.id,
          name: "Adicionais",
          description: "Escolha seus extras",
          minSelections: 0,
          maxSelections: 5,
          isRequired: false,
          sortOrder: 0,
        })
        .returning();

      if (addGroup) {
        await db.insert(schema.customizationOptions).values([
          { groupId: addGroup.id, name: "Bacon", price: "5.00", sortOrder: 0 },
          { groupId: addGroup.id, name: "Ovo", price: "3.00", sortOrder: 1 },
          { groupId: addGroup.id, name: "Cheddar extra", price: "4.00", sortOrder: 2 },
          { groupId: addGroup.id, name: "Onion rings", price: "6.00", sortOrder: 3 },
        ]);
      }

      // Grupo de remover ingredientes
      const [removeGroup] = await db
        .insert(schema.customizationGroups)
        .values({
          productId: burger.id,
          name: "Remover ingredientes",
          description: "O que você NÃO quer?",
          minSelections: 0,
          maxSelections: 5,
          isRequired: false,
          sortOrder: 1,
        })
        .returning();

      if (removeGroup) {
        await db.insert(schema.customizationOptions).values([
          { groupId: removeGroup.id, name: "Sem alface", price: "0", sortOrder: 0 },
          { groupId: removeGroup.id, name: "Sem tomate", price: "0", sortOrder: 1 },
          { groupId: removeGroup.id, name: "Sem maionese", price: "0", sortOrder: 2 },
        ]);
      }
    }

    // X-Tudo (com tag Novo)
    await db.insert(schema.products).values({
      tenantId: tenant.id,
      categoryId: hamburguerCat.id,
      name: "X-Tudo Especial",
      description: "Pão, 2x hambúrguer, queijo, bacon, ovo, presunto, alface, tomate e molho especial",
      price: "34.90",
      originalPrice: "39.90",
      isNew: true,
      hasVariants: false,
      sortOrder: 1,
    });
  }

  if (pizzaCat) {
    // Pizza com variantes (tamanhos)
    const [pizza] = await db
      .insert(schema.products)
      .values({
        tenantId: tenant.id,
        categoryId: pizzaCat.id,
        name: "Pizza Margherita",
        description: "Molho de tomate, mussarela, tomate e manjericão fresco",
        price: "0",
        hasVariants: true,
        sortOrder: 0,
      })
      .returning();

    if (pizza) {
      await db.insert(schema.productVariants).values([
        { productId: pizza.id, name: "Pequena (4 fatias)", price: "29.90", sortOrder: 0 },
        { productId: pizza.id, name: "Média (6 fatias)", price: "39.90", sortOrder: 1 },
        { productId: pizza.id, name: "Grande (8 fatias)", price: "49.90", sortOrder: 2 },
        { productId: pizza.id, name: "Família (12 fatias)", price: "64.90", sortOrder: 3 },
      ]);
    }
  }

  if (bebidaCat) {
    await db.insert(schema.products).values([
      {
        tenantId: tenant.id,
        categoryId: bebidaCat.id,
        name: "Coca-Cola 350ml",
        price: "6.00",
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        categoryId: bebidaCat.id,
        name: "Guaraná Antarctica 350ml",
        price: "5.50",
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        categoryId: bebidaCat.id,
        name: "Suco Natural 500ml",
        price: "10.00",
        isNew: true,
        hasVariants: false,
        sortOrder: 2,
      },
    ]);
  }

  console.log("Produtos de exemplo criados!");
  console.log("\nSeed concluído com sucesso!");

  await client.end();
}

seed().catch((err) => {
  console.error("Erro no seed:", err);
  process.exit(1);
});
