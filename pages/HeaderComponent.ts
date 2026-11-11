import { expect, type Locator, type Page } from '@playwright/test';

/** Componente do header, compartilhado entre páginas logadas e deslogadas. */
export class HeaderComponent {
  readonly page: Page;
  readonly header: Locator;
  readonly botaoEntrar: Locator;
  readonly botaoRegistrar: Locator;
  readonly botaoDepositar: Locator;
  /** O saque não tem botão próprio: abre pelo dropdown do saldo/avatar ("R$ ..."). */
  readonly botaoSaldo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header').first();
    this.botaoEntrar = this.header.getByRole('button', { name: 'Entrar', exact: true });
    this.botaoRegistrar = this.header.getByRole('button', { name: 'Registre-se', exact: true });
    this.botaoDepositar = this.header.getByRole('button', { name: 'Depositar' });
    this.botaoSaldo = this.header.getByRole('button').filter({ hasText: /R\$/ }).first();
  }

  /**
   * Sinal de sessão autenticada: o botão "Depositar" só existe no header logado.
   * Há uma janela entre o modal de login fechar e as chamadas pós-login
   * (refresh/getCliente/saldo) resolverem e o React re-renderizar o header —
   * qualquer ação que dependa do header autenticado precisa esperar por isso.
   */
  async aguardarSessaoAutenticada(timeout = 15000): Promise<void> {
    await expect(this.botaoDepositar, 'header deveria refletir a sessão autenticada').toBeVisible({ timeout });
  }
}
