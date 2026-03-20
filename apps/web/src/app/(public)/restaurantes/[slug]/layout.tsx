import type { Metadata } from "next";
import { getDb, tenants, eq } from "@matrix-food/database";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const db = getDb();
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!tenant) {
      return { title: "Restaurante não encontrado | Matrix Food" };
    }

    const title = `${tenant.name} - Cardápio Online | Matrix Food`;
    const description = tenant.description
      ? `${tenant.description} - Peça online pelo Matrix Food`
      : `Faça seu pedido online no ${tenant.name} pelo Matrix Food`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Matrix Food",
        ...(tenant.bannerUrl && {
          images: [{ url: tenant.bannerUrl, width: 1200, height: 630 }],
        }),
      },
    };
  } catch {
    return { title: "Cardápio | Matrix Food" };
  }
}

export default async function RestaurantLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
