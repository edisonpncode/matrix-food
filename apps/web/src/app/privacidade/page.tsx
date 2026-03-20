import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Matrix Food",
  description: "Política de Privacidade e LGPD da plataforma Matrix Food",
};

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-primary hover:underline"
      >
        &larr; Voltar
      </Link>

      <h1 className="mb-6 text-3xl font-bold">Política de Privacidade</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Última atualização: Março de 2026 | Em conformidade com a LGPD (Lei
        13.709/2018)
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            1. Dados Coletados
          </h2>
          <p>Coletamos os seguintes dados pessoais:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Dados de identificação:</strong> nome, telefone, e-mail
            </li>
            <li>
              <strong>Dados de localização:</strong> endereço de entrega
            </li>
            <li>
              <strong>Dados de uso:</strong> histórico de pedidos, preferências,
              avaliações
            </li>
            <li>
              <strong>Dados técnicos:</strong> endereço IP, tipo de navegador,
              sistema operacional
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            2. Finalidade do Tratamento
          </h2>
          <p>Seus dados são utilizados para:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Processar e entregar seus pedidos</li>
            <li>Comunicação sobre status do pedido</li>
            <li>Programa de fidelidade e promoções</li>
            <li>Melhoria dos nossos serviços</li>
            <li>Cumprimento de obrigações legais</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            3. Base Legal (LGPD)
          </h2>
          <p>
            O tratamento dos seus dados pessoais é realizado com base nas
            seguintes hipóteses da LGPD: execução de contrato (Art. 7º, V);
            consentimento do titular (Art. 7º, I); legítimo interesse (Art. 7º,
            IX); e cumprimento de obrigação legal (Art. 7º, II).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            4. Compartilhamento de Dados
          </h2>
          <p>Seus dados podem ser compartilhados com:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Restaurantes parceiros:</strong> dados necessários para
              preparação e entrega do pedido
            </li>
            <li>
              <strong>Processadores de pagamento:</strong> dados para
              processamento de transações
            </li>
            <li>
              <strong>Autoridades:</strong> quando exigido por lei ou ordem
              judicial
            </li>
          </ul>
          <p className="mt-2">
            Não vendemos ou compartilhamos seus dados com terceiros para fins de
            marketing sem seu consentimento expresso.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            5. Armazenamento e Segurança
          </h2>
          <p>
            Seus dados são armazenados em servidores seguros com criptografia.
            Adotamos medidas técnicas e organizacionais para proteger seus dados
            contra acesso não autorizado, perda ou destruição. Os dados são
            mantidos pelo tempo necessário para cumprir as finalidades descritas
            ou conforme exigido por lei.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            6. Seus Direitos (LGPD Art. 18)
          </h2>
          <p>Você tem direito a:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Confirmar a existência de tratamento dos seus dados</li>
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados</li>
            <li>Solicitar portabilidade dos dados</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>
              Opor-se ao tratamento realizado com base em legítimo interesse
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            7. Cookies
          </h2>
          <p>
            Utilizamos cookies essenciais para o funcionamento da plataforma e
            cookies de desempenho para melhorar sua experiência. Você pode
            configurar seu navegador para recusar cookies, mas isso pode afetar
            funcionalidades do serviço.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            8. Encarregado de Proteção de Dados (DPO)
          </h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento
            de dados pessoais, entre em contato com nosso Encarregado de
            Proteção de Dados:
          </p>
          <p className="mt-2">
            <strong>E-mail:</strong> privacidade@matrixfood.com.br
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            9. Alterações nesta Política
          </h2>
          <p>
            Esta Política de Privacidade pode ser atualizada periodicamente.
            Recomendamos que a consulte regularmente. Alterações significativas
            serão comunicadas através da plataforma.
          </p>
        </section>
      </div>
    </div>
  );
}
