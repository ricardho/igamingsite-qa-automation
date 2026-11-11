import type { Locator, Page } from '@playwright/test';
import { passo } from '../support/relatorio.js';
import { BasePage } from './BasePage.js';

export class DepositoPage extends BasePage {
  readonly campoValor: Locator;
  readonly botaoSubmeter: Locator;
  readonly botaoCopiaECola: Locator;

  constructor(page: Page) {
    super(page);
    this.campoValor = this.visivel(this.dialog.getByPlaceholder('Valor do pagamento'));
    this.botaoSubmeter = this.visivel(this.dialog.getByRole('button', { name: 'Depósito', exact: true }));
    this.botaoCopiaECola = this.visivel(this.dialog.getByRole('button', { name: 'Copia e Cola' }));
  }

  async abrir(): Promise<void> {
    await passo('Abrir modal de depósito', async () => {
      await this.clicar(this.header.botaoDepositar);
      await this.dialog.waitFor({ state: 'visible' });
    });
  }

  async selecionarValorRapido(valor: string): Promise<void> {
    await passo(`Selecionar valor rápido ${valor}`, () =>
      this.clicar(this.visivel(this.dialog.getByRole('button', { name: valor, exact: true })))
    );
  }

  async preencherValor(valor: string): Promise<void> {
    await passo(`Preencher valor ${valor}`, () => this.preencher(this.campoValor, valor));
  }

  async submeter(): Promise<void> {
    await passo('Confirmar depósito', () => this.clicar(this.botaoSubmeter));
  }
}
