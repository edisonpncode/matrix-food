import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso | Matrix Food",
  description: "Termos de Uso da plataforma Matrix Food",
};

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-primary hover:underline"
      >
        &larr; Voltar
      </Link>

      <h1 className="mb-6 text-3xl font-bold">Termos de Uso</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Última atualização: Março de 2026
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            1. Aceitação dos Termos
          </h2>
          <p>
            Ao acessar e utilizar a plataforma Matrix Food, você concorda com
            estes Termos de Uso. Caso não concorde com qualquer disposição, não
            utilize a plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            2. Descrição do Serviço
          </h2>
          <p>
            A Matrix Food é uma plataforma de pedidos online que conecta
            restaurantes e clientes. Facilitamos o processo de realização de
            pedidos, sem sermos responsáveis pela preparação ou entrega dos
            alimentos, que são de responsabilidade exclusiva dos restaurantes
            parceiros.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            3. Cadastro e Conta
          </h2>
          <p>
            Para realizar pedidos, você pode precisar fornecer informações como
            nome, telefone e endereço. Você é responsável pela veracidade das
            informações fornecidas e pela segurança de sua conta.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            4. Pedidos e Pagamentos
          </h2>
          <p>
            Ao confirmar um pedido, você se compromete a efetuar o pagamento
            pelo método selecionado. Os preços exibidos são definidos pelos
            restaurantes e podem sofrer alterações sem aviso prévio. Taxas de
            entrega, quando aplicáveis, serão informadas antes da confirmação
            do pedido.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            5. Cancelamentos e Reembolsos
          </h2>
          <p>
            Pedidos podem ser cancelados conforme a política de cada
            restaurante. Reembolsos, quando aplicáveis, serão processados pelo
            mesmo método de pagamento utilizado. O prazo para reembolso pode
            variar de acordo com a instituição financeira.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            6. Propriedade Intelectual
          </h2>
          <p>
            Todo o conteúdo da plataforma, incluindo textos, imagens, marcas e
            software, é propriedade da Matrix Food ou de seus licenciadores. É
            proibida a reprodução, distribuição ou modificação sem autorização
            prévia.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            7. Limitação de Responsabilidade
          </h2>
          <p>
            A Matrix Food não se responsabiliza por: qualidade dos alimentos
            preparados pelos restaurantes; atrasos na entrega causados por
            terceiros; indisponibilidade temporária da plataforma; danos
            indiretos decorrentes do uso do serviço.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            8. Alterações nos Termos
          </h2>
          <p>
            Reservamo-nos o direito de alterar estes Termos a qualquer momento.
            As alterações entram em vigor imediatamente após a publicação na
            plataforma. O uso continuado após alterações constitui aceitação
            dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            9. Contato
          </h2>
          <p>
            Em caso de dúvidas sobre estes Termos de Uso, entre em contato
            pelo e-mail: contato@matrixfood.com.br
          </p>
        </section>
      </div>
    </div>
  );
}
