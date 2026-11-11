import { expect, type Locator, type Page } from '@playwright/test';
import { passo, tentarAte } from '../support/relatorio.js';
import { escaparRegex } from '../utils/texto.js';
import { BasePage } from './BasePage.js';

export type TipoConta = 'Conta corrente' | 'Conta poupança';

export interface DadosNovaConta {
  banco: string;
  agencia: string;
  numeroConta: string;
  tipoConta: TipoConta;
}

export class SaquePage extends BasePage {
  /** Modal "Nova conta" abre empilhado sobre o de "Concluir Saque" — são dois dialogs distintos. */
  readonly dialogNovaConta: Locator;
  readonly selectConta: Locator;
  readonly campoValor: Locator;
  readonly botaoSubmeter: Locator;

  constructor(page: Page) {
    super(page);
    // Identificado pelo próprio conteúdo, e não pela posição no DOM (`.last()`).
    this.dialogNovaConta = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Adicionar conta' }) });
    /**
     * CSS attribute selector, não `getByRole('combobox')`: uma vez que o Radix
     * Select abre (`aria-expanded="true"`), o Chrome deixa de expor esse botão
     * com a role acessível "combobox" (o atributo continua lá, só a role
     * computada muda) — `getByRole` some do locator nesse momento e trava
     * qualquer clique/assert seguinte. O seletor por atributo funciona igual
     * fechado ou aberto.
     */
    this.selectConta = this.visivel(this.dialog.locator('[role="combobox"]'));
    this.campoValor = this.visivel(this.dialog.getByPlaceholder('R$ 0,00'));
    this.botaoSubmeter = this.visivel(this.dialog.getByRole('button', { name: 'Verifique para sacar' }));
  }

  /**
   * Abre pelo dropdown do saldo/avatar do header. Sob carga, no WebKit, o clique
   * em "Sacar" às vezes cai enquanto o menu ainda está em transição e o dialog
   * nunca abre — então a sequência inteira (abrir dropdown -> Sacar -> dialog
   * visível) é refeita do zero, fechando o dropdown com Escape entre tentativas
   * para não deixá-lo num estado preso. Cada retentativa fica no relatório.
   */
  async abrir(): Promise<void> {
    await passo('Abrir modal de saque', () =>
      tentarAte(
        'Abrir modal de saque',
        async () => {
          await this.clicar(this.header.botaoSaldo);
          await this.clicar(this.page.getByRole('button', { name: 'Sacar', exact: true }));
          await this.dialog.waitFor({ state: 'visible', timeout: 10000 });
        },
        { tentativas: 2, antesDeRepetir: () => this.page.keyboard.press('Escape') }
      )
    );
  }

  /**
   * Abre o dropdown de conta bancária e confirma pelo `aria-expanded` que ele de
   * fato abriu — se o clique não chegar a abrir o Radix Select, as chamadas
   * seguintes ficariam esperando opções que nunca vão aparecer.
   *
   * Clique direto em vez de `clicar()`: especificamente para este trigger, o
   * `toBeVisible()` às vezes não resolve mesmo com o elemento genuinamente
   * visível (confirmado via `isVisible()` no mesmo instante).
   */
  private async abrirSelectConta(): Promise<void> {
    await tentarAte('Abrir dropdown de conta bancária', async () => {
      await this.selectConta.click({ force: true, timeout: 10000 });
      await expect(this.selectConta).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    });
  }

  async abrirCadastroDeNovaConta(): Promise<void> {
    await passo('Abrir cadastro de nova conta bancária', async () => {
      await this.abrirSelectConta();
      await this.clicar(this.page.getByRole('option', { name: /adicionar nova conta/i }));
      await this.dialogNovaConta.waitFor({ state: 'visible' });
    });
  }

  /**
   * Seleciona a primeira conta já cadastrada — excluindo explicitamente a opção
   * "+ Adicionar nova conta" em vez de confiar na ordem do DOM (observado
   * invertendo de forma intermitente, o que abriria um SEGUNDO dialog empilhado).
   *
   * A seleção é confirmada pelo atributo `data-placeholder` do trigger (padrão
   * shadcn/ui: presente só enquanto nenhum valor foi escolhido) em vez do texto
   * da opção — a conta mockada renderiza o label vazio (limitação do ambiente),
   * então checar por texto sempre falharia.
   */
  async selecionarPrimeiraContaCadastrada(): Promise<void> {
    const opcaoConta = this.page.getByRole('option').filter({ hasNotText: /adicionar nova conta/i }).first();

    await passo('Selecionar primeira conta bancária cadastrada', () =>
      tentarAte(
        'Selecionar conta bancária',
        async () => {
          await this.abrirSelectConta();
          await opcaoConta.click({ force: true, timeout: 10000 });
          // O portal do Radix Select às vezes fica no DOM e intercepta o próximo clique.
          const listaFechou = await opcaoConta.waitFor({ state: 'hidden', timeout: 5000 }).then(
            () => true,
            () => false
          );
          if (!listaFechou) await this.page.keyboard.press('Escape');
          await expect
            .poll(() => this.selectConta.getAttribute('data-placeholder'), {
              message: 'trigger ainda sem conta selecionada',
              timeout: 3000,
            })
            .toBeNull();
        },
        { tentativas: 2 }
      )
    );
  }

  /**
   * Preenche o formulário de "Nova conta". O campo de banco é uma busca (não um
   * select nativo) — o nome oficial na FEBRABAN muitas vezes difere do nome
   * popular (ex.: Nubank é registrado como "NU PAGAMENTOS S.A.", código 260).
   */
  async preencherNovaConta({ banco, agencia, numeroConta, tipoConta }: DadosNovaConta): Promise<void> {
    await passo(`Preencher nova conta (${banco})`, async () => {
      const formulario = this.dialogNovaConta;
      await formulario.getByPlaceholder('Digite para buscar...').fill(banco);
      await this.clicar(formulario.getByText(new RegExp(escaparRegex(banco), 'i')).first());

      // Sem label/placeholder acessível no front: seletores por atributo, escopados ao modal.
      await formulario.locator('input[inputmode="numeric"]').fill(agencia);
      await formulario.getByPlaceholder('Ex: 1234567 ou 1234567-X').fill(numeroConta);

      await this.clicar(formulario.locator('input[readonly]'));
      await this.clicar(formulario.getByText(tipoConta, { exact: true }));
    });
  }

  async submeterNovaConta(): Promise<void> {
    await passo('Confirmar nova conta', () =>
      this.clicar(this.dialogNovaConta.getByRole('button', { name: 'Adicionar conta' }))
    );
  }

  /**
   * O campo de valor usa máscara de centavos: os dígitos digitados são
   * interpretados da direita para a esquerda ("10000" vira "R$ 100,00"). Por isso
   * `pressSequentially` (eventos de teclado reais) em vez de `fill()`, que não
   * aciona a máscara e deixa o estado interno do formulário desatualizado.
   */
  async preencherValorEmReais(valorEmReais: number): Promise<void> {
    const centavos = Math.round(valorEmReais * 100).toString();
    await passo(`Preencher valor de saque R$ ${valorEmReais}`, async () => {
      await this.clicar(this.campoValor);
      await this.campoValor.pressSequentially(centavos, { delay: 50 });
    });
  }

  async submeter(): Promise<void> {
    await passo('Solicitar saque', () => this.clicar(this.botaoSubmeter));
  }
}
