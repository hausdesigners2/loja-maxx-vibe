import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export const TERMS_VERSION = "v1.0 (Maio de 2026)";
export const PRIVACY_VERSION = "v1.0 (Maio de 2026)";

export function TermsOfUseContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">1. Aceitação dos Termos</h3>
        <p>
          Ao acessar e utilizar a plataforma <strong>Lojas Maxx</strong>, você concorda expressamente em cumprir e estar vinculado aos presentes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá efetuar o seu cadastro ou utilizar nossos serviços de compras online.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">2. Cadastro e Segurança da Conta</h3>
        <p>
          Para realizar compras em nossa plataforma, é necessário efetuar um cadastro fornecendo informações verdadeiras, exatas, atuais e completas. Você é o único responsável por manter a confidencialidade de suas credenciais de acesso (e-mail e senha) e por todas as atividades que ocorram sob sua conta.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">3. Compras, Preços e Pagamentos</h3>
        <p>
          Todos os preços e produtos exibidos na plataforma estão sujeitos a alteração sem aviso prévio e à disponibilidade de estoque. As formas de pagamento aceitas incluem Pix, Cartão de Débito, Cartão de Crédito e Dinheiro. No caso de pagamentos via Pix, o pedido só será processado após a confirmação automática do pagamento.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">4. Entregas e Prazos</h3>
        <p>
          As entregas são realizadas no endereço indicado pelo usuário no momento do cadastro ou da finalização da compra. O prazo de entrega e a taxa de frete (se aplicável) serão informados durante o processo de finalização do pedido. É de responsabilidade do usuário garantir que haverá alguém autorizado para receber a entrega no local indicado.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">5. Cancelamentos, Trocas e Devoluções</h3>
        <p>
          Em conformidade com o Código de Defesa do Consumidor (CDC), o cliente possui o direito de arrependimento, podendo solicitar a devolução de produtos não perecíveis em até 7 (sete) dias corridos a contar da data de recebimento. Produtos perecíveis com qualquer vício ou defeito de qualidade devem ser reportados imediatamente para que possamos efetuar a troca ou reembolso.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">6. Responsabilidades do Usuário</h3>
        <p>
          O usuário compromete-se a utilizar a plataforma de boa-fé, abstendo-se de qualquer prática fraudulenta, invasiva, ilegal ou que possa comprometer a segurança e o funcionamento do sistema. Qualquer violação destes termos poderá resultar na suspensão imediata ou cancelamento definitivo da conta do usuário.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">7. Responsabilidades da Empresa</h3>
        <p>
          A Lojas Maxx envida seus melhores esforços para manter a plataforma segura, funcional e livre de interrupções. Contudo, não nos responsabilizamos por instabilidades técnicas temporárias decorrentes de fatores externos, conexões de internet do usuário ou casos fortuitos e de força maior.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">8. Alterações nos Termos</h3>
        <p>
          Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação da versão atualizada na plataforma. O uso continuado dos serviços após tais modificações constituirá sua aceitação dos novos termos.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">9. Lei Aplicável e Foro</h3>
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de domicílio do consumidor para dirimir quaisquer controvérsias decorrentes deste documento.
        </p>
      </div>
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">1. Introdução e Compromisso</h3>
        <p>
          A <strong>Lojas Maxx</strong> valoriza a sua privacidade e está totalmente comprometida com a proteção dos seus dados pessoais. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">2. Dados Coletados</h3>
        <p>
          Coletamos apenas as informações estritamente necessárias para viabilizar suas compras e entregas, incluindo:
        </p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
          <li>Nome completo (para identificação e emissão de pedidos);</li>
          <li>Telefone/WhatsApp (para contato sobre a entrega e confirmação de pedidos);</li>
          <li>Endereço completo, complemento e CEP (para logística de entrega);</li>
          <li>E-mail (para login, recuperação de senha e comunicações de segurança);</li>
          <li>CPF (exclusivo para geração segura de pagamentos via Pix através do Mercado Pago).</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">3. Finalidade do Tratamento de Dados</h3>
        <p>
          Seus dados pessoais são utilizados exclusivamente para:
        </p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
          <li>Processar, faturar e entregar seus pedidos de compras;</li>
          <li>Autenticar seu acesso à plataforma de forma segura;</li>
          <li>Enviar atualizações sobre o status do seu pedido;</li>
          <li>Prevenir fraudes e garantir a segurança cibernética da plataforma;</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">4. Compartilhamento de Dados</h3>
        <p>
          A Lojas Maxx <strong>não vende, aluga ou comercializa</strong> seus dados pessoais com terceiros. O compartilhamento de informações ocorre única e exclusivamente com parceiros essenciais para a operação, tais como:
        </p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
          <li><strong>Mercado Pago:</strong> para processamento seguro de pagamentos via Pix (exige CPF);</li>
          <li><strong>Serviços de Hospedagem e Banco de Dados (Supabase):</strong> para armazenamento seguro das informações sob criptografia.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">5. Armazenamento e Segurança</h3>
        <p>
          Todos os dados coletados são armazenados em servidores de alta segurança, utilizando criptografia de ponta a ponta e protocolos de segurança modernos. Mantemos seus dados apenas pelo tempo necessário para cumprir as finalidades descritas nesta política ou para cumprir obrigações legais de guarda de registros.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">6. Seus Direitos (LGPD)</h3>
        <p>
          Como titular dos dados, você possui o direito de, a qualquer momento, solicitar:
        </p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
          <li>Confirmação da existência de tratamento de seus dados;</li>
          <li>Acesso aos dados armazenados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Eliminação de dados pessoais desnecessários ou tratados em desconformidade;</li>
          <li>Revogação do consentimento e exclusão definitiva de sua conta.</li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">7. Uso de Cookies</h3>
        <p>
          Utilizamos cookies essenciais apenas para manter sua sessão ativa (login) e lembrar os itens adicionados ao seu carrinho de compras, garantindo uma experiência de navegação fluida e personalizada.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">8. Contato e Encarregado de Dados</h3>
        <p>
          Para exercer qualquer um de seus direitos relacionados à privacidade ou esclarecer dúvidas sobre esta política, você pode entrar em contato diretamente com nosso Encarregado de Proteção de Dados (DPO) através do e-mail: <strong className="text-primary">privacidade@lojasmaxx.com.br</strong>.
        </p>
      </div>
    </div>
  );
}

interface LegalModalProps {
  type: "terms" | "privacy";
  onClose: () => void;
}

export function LegalDocumentModal({ type, onClose }: LegalModalProps) {
  const isTerms = type === "terms";

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <h2 className="text-xl font-extrabold text-foreground">
          {isTerms ? "Termos de Uso" : "Política de Privacidade"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Última atualização: {isTerms ? TERMS_VERSION : PRIVACY_VERSION}
        </p>
      </div>

      <ScrollArea className="h-[60vh] pr-3">
        {isTerms ? <TermsOfUseContent /> : <PrivacyPolicyContent />}
      </ScrollArea>

      <div className="flex justify-end pt-2 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          Entendi e Fechar
        </button>
      </div>
    </div>
  );
}