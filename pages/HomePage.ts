import { expect, type Locator, type Page } from '@playwright/test';
import { passo } from '../support/relatorio.js';
import { BasePage } from './BasePage.js';

/** Home do site — ponto de entrada das sessões já autenticadas via storageState. */
export class HomePage extends BasePage {
  /**
   * Modal em tela cheia "Bem vindo(a)! ... Realize o primeiro depósito", que o app
   * mostra no primeiro carregamento autenticado com saldo zerado — e de novo em
   * toda página nova via storageState (não depende de nenhuma flag persistida).
   */
  readonly modalBoasVindas: Locator;

  constructor(page: Page) {
    super(page);
    this.modalBoasVindas = page.getByRole('dialog').filter({ hasText: /bem[- ]?vindo/i });
  }

  /** Escape fecha o modal (ele tem `data-slot="dialog-close"`) sem afetar a sessão. */
  async fecharModalDeBoasVindasSeAberto(): Promise<void> {
    if (!(await this.apareceEm(this.modalBoasVindas, 3000))) return;
    await this.page.keyboard.press('Escape');
    await expect(this.modalBoasVindas, 'modal de boas-vindas deveria fechar com Escape').toBeHidden({ timeout: 3000 });
  }

  /**
   * Abre a home já autenticada (storageState carregado pelo project) e só
   * retorna quando o header refletir a sessão.
   */
  async abrirComSessaoAtiva(): Promise<void> {
    await passo('Abrir home com sessão autenticada', async () => {
      await this.page.goto('/');
      await this.fecharModalDeBoasVindasSeAberto();
      await this.header.aguardarSessaoAutenticada();
    });
  }
}
