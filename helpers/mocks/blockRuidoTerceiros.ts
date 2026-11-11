import type { Page } from '@playwright/test';

/**
 * A página real tem dezenas de chamadas de analytics/ads/chat/redes sociais em
 * todo carregamento (Google Tag Manager, Google Ads, Doubleclick, Zendesk,
 * TikTok, Facebook, Hotjar/Clarity...). Isso é uma fonte grande e não-determinística
 * de lentidão/instabilidade nos testes: o tempo de resposta desses serviços de
 * terceiros varia por rede, horário do dia e leilões de anúncio — nada disso tem
 * relação com o comportamento do site que estamos testando, mas atrasa o
 * carregamento da página e (no caso do widget de chat) injeta elementos
 * flutuantes/animados na tela que atrapalham cliques.
 *
 * Abortamos essas chamadas antes de qualquer navegação, para que o carregamento
 * da página dependa só da infraestrutura do próprio site.
 */
const PADROES_PARA_BLOQUEAR = [
  /google-analytics\.com/,
  /googletagmanager\.com/,
  /googleadservices\.com/,
  /doubleclick\.net/,
  /google\.com\/(ccm|pagead|g\/collect)/,
  /analytics\.google\.com/,
  /google\.com\/g\/collect/,
  /zdassets\.com/,
  /zendesk\.com/,
  /tiktok\.com/,
  /facebook\.(com|net)/,
  /hotjar\.com/,
  /clarity\.ms/,
  /capi-automation\.s3/,
  /edgeapi\.igamingsite\.com/,
];

/**
 * Tipos de recurso que não afetam nenhuma asserção da suíte (não validamos
 * aparência visual, só texto/estado) mas custam CPU/rede pra baixar e
 * decodificar — abortamos pra acelerar o carregamento. `stylesheet` e `script`
 * ficam de fora de propósito: layout/posicionamento (usado pelas checagens de
 * visibilidade/scroll) depende de CSS, e a aplicação em si depende do JS.
 */
const TIPOS_DE_RECURSO_PARA_BLOQUEAR = new Set(['image', 'font', 'media']);

export async function bloquearRuidoDeTerceiros(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const request = route.request();
    if (TIPOS_DE_RECURSO_PARA_BLOQUEAR.has(request.resourceType())) return route.abort();
    if (PADROES_PARA_BLOQUEAR.some((padrao) => padrao.test(request.url()))) return route.abort();
    // fallback(), não continue(): esta rota casa com QUALQUER URL, então tem
    // prioridade sobre outros page.route() registrados antes dela (Playwright
    // chama o handler registrado mais recentemente primeiro) — isso inclui
    // todo mock de API específico (mockConsultaCpfSucesso, mockSessaoAutenticada
    // etc.), já que bloquearRuidoDeTerceiros normalmente roda depois deles,
    // dentro de BasePage.acessar(). continue() assumiria a requisição e a
    // mandaria direto pro backend real, pulando esses mocks por completo;
    // fallback() devolve a decisão pro handler registrado antes deste (o mock,
    // se houver, senão a rede normal).
    return route.fallback();
  });
}
