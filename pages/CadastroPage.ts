import type { Locator, Page } from '@playwright/test';
import type { DadosCadastro } from '../helpers/testData.js';
import { passo, registrarAviso } from '../support/relatorio.js';
import { BasePage } from './BasePage.js';

type DadosFormularioCadastro = Pick<DadosCadastro, 'cpf' | 'email' | 'telefone' | 'senha'>;

export class CadastroPage extends BasePage {
  readonly campoCpf: Locator;
  readonly campoEmail: Locator;
  readonly campoTelefone: Locator;
  readonly campoSenha: Locator;
  readonly campoConfirmacaoSenha: Locator;
  readonly checkboxTermos: Locator;
  readonly botaoSubmeter: Locator;

  constructor(page: Page) {
    super(page);
    this.campoCpf = this.visivel(this.dialog.getByLabel('CPF'));
    this.campoEmail = this.visivel(this.dialog.getByLabel('E-mail'));
    this.campoTelefone = this.visivel(this.dialog.getByLabel('Número de Telefone'));
    this.campoSenha = this.visivel(this.dialog.getByLabel('Senha', { exact: true }));
    this.campoConfirmacaoSenha = this.visivel(this.dialog.getByLabel('Confirmação de senha'));
    this.checkboxTermos = this.visivel(this.dialog.getByRole('checkbox'));
    this.botaoSubmeter = this.visivel(this.dialog.getByRole('button', { name: 'Registre-se', exact: true }));
  }

  async abrirFormularioDeCadastro(): Promise<void> {
    await passo('Abrir formulário de cadastro', async () => {
      await this.clicar(this.visivel(this.page.getByRole('button', { name: 'Registre-se', exact: true })).first());
      await this.dialog.waitFor({ state: 'visible' });
    });
  }

  /**
   * Preenche o CPF e aguarda a resposta de consultar-cpf, que dispara com debounce
   * e substitui o campo pelo nome retornado. Sem essa espera, os campos seguintes
   * podem ser preenchidos antes da UI se atualizar.
   */
  async preencherCpfEAguardarValidacao(cpf: string): Promise<void> {
    const aguardarConsulta = this.page
      .waitForResponse((res) => res.url().includes('/api/clientes/consultar-cpf'), { timeout: 10000 })
      .then(
        () => true,
        () => false
      );
    await this.preencher(this.campoCpf, cpf);
    if (!(await aguardarConsulta)) {
      registrarAviso('consultar-cpf não respondeu em 10s após preencher o CPF — seguindo sem a validação.');
    }
  }

  /** Preenche todos os campos obrigatórios (sem aceitar termos nem submeter). */
  async preencherFormulario({ cpf, email, telefone, senha }: DadosFormularioCadastro): Promise<void> {
    await passo('Preencher formulário de cadastro', async () => {
      await this.preencherCpfEAguardarValidacao(cpf);
      await this.preencher(this.campoEmail, email);
      await this.preencher(this.campoTelefone, telefone);
      await this.preencher(this.campoSenha, senha);
      await this.preencher(this.campoConfirmacaoSenha, senha);
    });
  }

  async aceitarTermos(): Promise<void> {
    await this.marcar(this.checkboxTermos);
  }

  async submeter(): Promise<void> {
    await passo('Submeter cadastro', () => this.clicar(this.botaoSubmeter));
  }

  /** Jornada completa do formulário: preenche, aceita os termos e submete. */
  async cadastrar(dados: DadosFormularioCadastro): Promise<void> {
    await this.preencherFormulario(dados);
    await this.aceitarTermos();
    await this.submeter();
  }
}
