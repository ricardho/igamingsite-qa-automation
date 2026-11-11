import { test, expect } from '../../support/fixtures.js';
import { mockRegistrarContaComSucesso } from '../../helpers/mocks/mockSaque.js';
import type { DadosNovaConta } from '../../pages/SaquePage.js';

/**
 * Funcionalidade: Saque
 *
 * Contexto:
 *   Dado que eu tenha uma conta cadastrada e esteja autenticado
 *   E eu tenha aberto o modal de saque clicando no saldo/avatar do header e em "Sacar"
 *
 * Cenário: Cadastra uma nova conta bancária com sucesso (Fluxo Principal)
 *   Quando eu escolher "+ Adicionar nova conta"
 *   E eu preencher banco, agência, número da conta e tipo de conta
 *   E eu confirmar em "Adicionar conta"
 *   Então devo voltar para a tela "Concluir Saque"
 *
 * Cenário: Bloqueia saque com valor abaixo do mínimo permitido
 *   Dado que eu tenha selecionado uma conta bancária já cadastrada
 *   Quando eu informar o valor "R$ 20,00" e confirmar
 *   Então devo ver a mensagem "Saque mínimo de R$ 30,00"
 *
 * Cenário: Bloqueia saque por saldo insuficiente
 *   Dado que meu saldo disponível seja R$ 0,00
 *   Quando eu selecionar uma conta já cadastrada, informar "R$ 100,00" e confirmar
 *   Então devo ver a mensagem "Saldo insuficiente para realizar o saque."
 *
 * Cenário: Bloqueia saque sem conta bancária e sem valor informado
 *   Quando eu confirmar em "Verifique para sacar" sem preencher nada
 *   Então o modal de saque deve permanecer aberto
 *
 * NOTA 1: o botão "Verifique para sacar" nunca fica `disabled` — a validação
 * (conta/valor/saldo) acontece só depois do clique, com mensagem inline. Por
 * isso os testes de exceção clicam e verificam a mensagem.
 *
 * NOTA 2: a confirmação final de um saque bem-sucedido não é reproduzível
 * nesta fase — o saldo do modal vem do mock de sessão e é sempre R$ 0,00, então
 * qualquer valor acima do mínimo cai em "saldo insuficiente" antes do endpoint
 * real de confirmação. Ver docs/MOCKS.md seção 8.
 */
const NOVA_CONTA: DadosNovaConta = {
  banco: 'NU PAGAMENTOS',
  agencia: '0001',
  numeroConta: '1234567',
  tipoConta: 'Conta corrente',
};

test.describe('Saque', { tag: '@saque' }, () => {
  test('Fluxo Principal: cadastra uma nova conta bancária com sucesso', { tag: '@happyPath' }, async ({ page, sessao, saquePage }) => {
    await mockRegistrarContaComSucesso(page);

    await saquePage.abrir();
    await saquePage.abrirCadastroDeNovaConta();
    await saquePage.preencherNovaConta(NOVA_CONTA);
    await saquePage.submeterNovaConta();

    await expect(saquePage.dialog).toContainText('Concluir Saque', { timeout: 10000 });
  });

  const cenariosDeValor = [
    { titulo: 'bloqueia saque com valor abaixo do mínimo permitido', valor: 20, mensagem: 'Saque mínimo de R$ 30,00' },
    { titulo: 'bloqueia saque por saldo insuficiente', valor: 100, mensagem: 'Saldo insuficiente para realizar o saque.' },
  ];

  for (const { titulo, valor, mensagem } of cenariosDeValor) {
    test(`Fluxo Alternativo: ${titulo}`, async ({ sessaoComContaBancaria, saquePage }) => {
      await saquePage.abrir();
      await saquePage.selecionarPrimeiraContaCadastrada();
      await saquePage.preencherValorEmReais(valor);
      await saquePage.submeter();

      await expect(saquePage.dialog).toContainText(mensagem);
    });
  }

  test('Fluxo Alternativo: bloqueia saque sem conta bancária e sem valor informado', async ({ sessao, saquePage }) => {
    await saquePage.abrir();
    await saquePage.submeter();

    await expect(saquePage.dialog).toBeVisible();
    await expect(saquePage.dialog).toContainText('Concluir Saque');
  });
});
