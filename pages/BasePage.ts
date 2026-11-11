import { expect, type Locator, type Page } from '@playwright/test';
import { bloquearRuidoDeTerceiros } from '../helpers/mocks/blockRuidoTerceiros.js';
import { passo, registrarAviso } from '../support/relatorio.js';
import { HeaderComponent } from './HeaderComponent.js';

/**
 * Seletor dos modais próprios do app (Radix Dialog). Precisa de duas exclusões,
 * ambas por drift do ambiente de pre-prod (ver docs/MOCKS.md):
 *  - `data-slot="dialog-content"` exclui o modal novo de "Verificação da
 *    conta", que também tem role="dialog" mas não é um Radix Dialog.
 *  - `:not([aria-hidden="true"])` exclui a instância antiga que o Radix deixa
 *    no DOM por um instante (saindo, com aria-hidden) quando o conteúdo do
 *    modal muda para uma nova tela (ex.: cadastro -> sucesso, depósito ->
 *    QR gerado) — sem isso, o locator casa duas instâncias ao mesmo tempo.
 */
export const SELETOR_DIALOG_APP = '[role="dialog"][data-slot="dialog-content"]:not([aria-hidden="true"])';

/** Tempo do clique "normal" (com checagem de estabilidade) antes de cair no clique forçado. */
const TIMEOUT_CLIQUE_NORMAL = 5000;

/**
 * Overlay cobrindo o elemento: é exatamente o tipo de problema que um usuário
 * real também teria, então NUNCA é contornado com clique forçado.
 */
const ERRO_ELEMENTO_COBERTO = /intercepts pointer events/i;
/** Elemento visível e livre, mas que nunca para de se mover (animação contínua). */
const ERRO_ELEMENTO_INSTAVEL = /not stable/i;

export abstract class BasePage {
  readonly page: Page;
  readonly header: HeaderComponent;
  /** Modal do app atualmente aberto (cadastro, login, depósito, saque...). */
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
    this.dialog = page.locator(SELETOR_DIALOG_APP);
  }

  /**
   * Restringe o locator à instância VISÍVEL do elemento. Os modais renderizam
   * duas cópias dos campos (variante mobile e desktop, alternadas via CSS
   * responsivo, não por JS condicional) — sem esse filtro, um locator sem
   * `.first()` vira "strict mode violation" e um com `.first()` pega a ordem do
   * DOM, que no viewport mobile é a instância ESCONDIDA.
   */
  protected visivel(locator: Locator): Locator {
    return locator.and(this.page.locator(':visible'));
  }

  /**
   * Navega garantindo um ambiente limpo: cookies e storage são zerados antes de
   * qualquer script da página rodar, para que nenhum estado de execuções
   * anteriores (consentimento de idade/cookies, sessão...) vaze entre testes.
   * `caminho` é relativo ao `baseURL` do playwright.config.ts.
   */
  async acessar(caminho = '/'): Promise<void> {
    await passo(`Acessar ${caminho} com ambiente limpo`, async () => {
      await this.page.context().clearCookies();
      /*
       * O script roda em toda navegação (inclusive reload — necessário para
       * fecharGateDeVerificacaoSeAberto()). Por isso só zera o storage na
       * PRIMEIRA carga: um marcador em cookie (não afetado pelo clear de
       * storage) sinaliza que já limpamos — senão um reload depois do login
       * apagaria o token que acabamos de obter.
       */
      await this.page.addInitScript(() => {
        try {
          if (!document.cookie.includes('qaAmbienteLimpo=1')) {
            window.localStorage.clear();
            window.sessionStorage.clear();
            document.cookie = 'qaAmbienteLimpo=1; path=/';
          }
        } catch {
          // Storage pode não estar disponível antes da navegação em alguns browsers.
        }
      });
      await bloquearRuidoDeTerceiros(this.page);

      await this.page.goto(caminho);
      await this.fecharOverlaysIniciais();
    });
  }

  /**
   * Espera até `timeout` por um elemento OPCIONAL (overlay que pode ou não
   * aparecer). Retorna se ele apareceu — não é erro ele não aparecer.
   */
  protected async apareceEm(locator: Locator, timeout: number): Promise<boolean> {
    return locator.waitFor({ state: 'visible', timeout }).then(
      () => true,
      () => false
    );
  }

  /** Se o elemento opcional aparecer, clica nele e confirma que sumiu. */
  protected async fecharSeVisivel(locator: Locator, timeout: number): Promise<void> {
    if (!(await this.apareceEm(locator, timeout))) return;
    await this.clicar(locator);
    await expect(locator, 'overlay deveria fechar após o clique').toBeHidden({ timeout: 6000 });
  }

  /**
   * Pre-prod mostra, logo após cadastro OU login, um modal de "Verificação da
   * conta" (onboarding sem botão de fechar) — reação do client-side, não depende
   * de dado do servidor. Um reload descarta esse estado efêmero sem derrubar a
   * sessão (ver o marcador de cookie em acessar()), mas volta a mostrar os
   * overlays de idade/cookies. Ver docs/MOCKS.md.
   */
  async fecharGateDeVerificacaoSeAberto(): Promise<void> {
    const gate = this.page.locator('[aria-labelledby="verification-title"]');
    if (!(await this.apareceEm(gate, 5000))) return;

    await passo('Descartar gate de "Verificação da conta" via reload', async () => {
      registrarAviso('Gate de "Verificação da conta" apareceu e foi descartado com reload.');
      await this.page.reload();
      await this.fecharOverlaysIniciais();
    });
  }

  /**
   * Fecha os overlays iniciais (verificação de idade e aviso de cookies). Ambos
   * renderizam de forma assíncrona e com tempos diferentes entre browsers — no
   * WebKit a renderização é mais lenta e uma checagem imediata não pega o modal
   * a tempo, deixando-o aparecer depois e bloquear o próximo clique. Por isso
   * cada overlay tem sua própria janela de espera.
   */
  async fecharOverlaysIniciais(): Promise<void> {
    await passo('Fechar overlays de idade e cookies', async () => {
      await this.fecharSeVisivel(this.page.getByRole('button', { name: 'Sim', exact: true }), 12000);
      await this.fecharSeVisivel(this.page.getByRole('button', { name: 'Sim, eu aceito', exact: true }), 8000);
    });
  }

  /**
   * Confirma que o elemento está de fato visível (não só presente no DOM) e o
   * traz para o centro da tela.
   *
   * Nem `toBeInViewport()` nem `scrollIntoViewIfNeeded()` funcionam aqui — os
   * dois esperam o elemento "parar de se mexer", e a página tem banners
   * animados que nunca deixam isso convergir no WebKit. Rolamos via
   * `Element.scrollIntoView()` direto no DOM com `behavior: 'instant'` (o
   * container pode ter scroll suave via CSS). A rolagem é best-effort: se o
   * elemento for desanexado no meio, a próxima ação já reporta o erro real.
   */
  protected async garantirVisivel(locator: Locator, timeout = 10000): Promise<void> {
    await expect(locator, 'elemento deveria estar visível antes da interação').toBeVisible({ timeout });
    await locator
      .evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
      .catch(() => undefined);
    await this.esperarTransicaoDeEntrada(locator);
  }

  /**
   * Espera dinâmica pela transição de entrada de dialogs, dropdowns e selects
   * (primitivos Radix usam `data-state`) em vez de um sleep fixo: resolve assim
   * que as animações do container animado mais próximo terminam. O teto de
   * 400ms evita esperar para sempre por widgets que animam continuamente.
   */
  protected async esperarTransicaoDeEntrada(locator: Locator): Promise<void> {
    await Promise.race([
      locator
        .evaluate((el) => {
          const alvo = el.closest('[data-state]') ?? el;
          return Promise.all(alvo.getAnimations({ subtree: true }).map((animacao) => animacao.finished));
        })
        .catch(() => undefined),
      this.page.waitForTimeout(400),
    ]);
  }

  /**
   * Clique com todas as checagens do Playwright (visível, estável, recebe
   * eventos, habilitado). Só se o ÚNICO impedimento for o elemento nunca
   * estabilizar (animação contínua no WebKit), cai para o clique forçado — e
   * isso fica registrado como aviso no relatório. Elemento coberto por
   * overlay continua sendo falha: um usuário real também não conseguiria clicar.
   */
  async clicar(locator: Locator, timeout?: number): Promise<void> {
    await this.garantirVisivel(locator, timeout);
    try {
      await locator.click({ timeout: TIMEOUT_CLIQUE_NORMAL });
      return;
    } catch (erro) {
      const mensagem = String(erro);
      if (ERRO_ELEMENTO_COBERTO.test(mensagem) || !ERRO_ELEMENTO_INSTAVEL.test(mensagem)) throw erro;
      registrarAviso(`Clique forçado em ${locator}: elemento visível, mas não estabilizou.`);
    }
    await this.clicarForcado(locator);
  }

  /**
   * Com `force: true` o Playwright pula a actionability e não tem retry
   * próprio. Se a transição de entrada (ex.: Radix) ainda estiver deslocando o
   * elemento via `transform`, o clique cai "outside of the viewport" — só esse
   * erro específico é repetido, dando à transição mais uma chance de terminar.
   */
  private async clicarForcado(locator: Locator): Promise<void> {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        await locator.click({ force: true });
        return;
      } catch (erro) {
        if (tentativa === 3 || !/outside of the viewport/i.test(String(erro))) throw erro;
        await this.esperarTransicaoDeEntrada(locator);
      }
    }
  }

  /** Mesma política de clicar(), para checkboxes. */
  async marcar(locator: Locator, timeout?: number): Promise<void> {
    await this.garantirVisivel(locator, timeout);
    try {
      await locator.check({ timeout: TIMEOUT_CLIQUE_NORMAL });
    } catch (erro) {
      const mensagem = String(erro);
      if (ERRO_ELEMENTO_COBERTO.test(mensagem) || !ERRO_ELEMENTO_INSTAVEL.test(mensagem)) throw erro;
      registrarAviso(`Check forçado em ${locator}: elemento visível, mas não estabilizou.`);
      await locator.check({ force: true });
    }
  }

  /**
   * Preenchimento com a mesma rolagem/espera dos cliques — em viewports
   * pequenos os campos dos modais ficam mais sujeitos a estar fora da área
   * visível. Sem `force`: o `fill()` não exige estabilidade, então não sofre
   * do problema de animação que motiva o fallback dos cliques.
   */
  async preencher(locator: Locator, valor: string, timeout?: number): Promise<void> {
    await this.garantirVisivel(locator, timeout);
    await locator.fill(valor);
  }
}
