import type { Locator, Page } from '@playwright/test';
import { passo } from '../support/relatorio.js';
import { BasePage } from './BasePage.js';

export interface Credenciais {
  login: string;
  senha: string;
}

export class LoginPage extends BasePage {
  readonly campoLogin: Locator;
  readonly campoSenha: Locator;
  readonly botaoSubmeter: Locator;

  constructor(page: Page) {
    super(page);
    this.campoLogin = this.visivel(this.dialog.getByPlaceholder('Informe seu e-mail ou CPF'));
    this.campoSenha = this.visivel(this.dialog.getByPlaceholder('Senha'));
    this.botaoSubmeter = this.visivel(this.dialog.getByRole('button', { name: 'Entrar', exact: true }));
  }

  async abrirFormularioDeLogin(): Promise<void> {
    await passo('Abrir formulário de login', async () => {
      await this.clicar(this.visivel(this.page.getByRole('button', { name: 'Entrar', exact: true })).first());
      await this.dialog.waitFor({ state: 'visible' });
    });
  }

  /** Preenche e submete o formulário de login com as credenciais informadas. */
  async logar({ login, senha }: Credenciais): Promise<void> {
    await passo(`Logar como ${login}`, async () => {
      await this.preencher(this.campoLogin, login);
      await this.preencher(this.campoSenha, senha);
      await this.clicar(this.botaoSubmeter);
    });
  }
}
