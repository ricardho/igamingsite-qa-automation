import { test, expect } from '../../support/fixtures.js';

/**
 * Funcionalidade: Depósito via PIX
 *
 * Contexto:
 *   Dado que eu tenha uma conta cadastrada e esteja autenticado
 *   E eu tenha aberto o modal de depósito clicando em "Depositar"
 *
 * Cenário: Depósito com sucesso (Fluxo Principal)
 *   Quando eu escolher o valor rápido de R$ 100,00
 *   E eu confirmar o depósito
 *   Então devo ver a mensagem "Código PIX gerado com sucesso!"
 *   E o botão "Copia e Cola" deve estar habilitado
 *
 * Cenário: Bloqueia depósito com valor abaixo do mínimo permitido
 *   Quando eu digitar o valor "1,00"
 *   Então devo ver a mensagem "O valor mínimo é de R$ 10,00."
 *   E o botão de confirmar depósito deve permanecer desabilitado
 *
 * Cenário: Bloqueia depósito sem informar nenhum valor
 *   Dado que o campo de valor esteja vazio
 *   Então o botão de confirmar depósito deve permanecer desabilitado
 *
 * NOTA: em pre-prod, a geração real de PIX está desabilitada no ambiente (a
 * configuração de métodos de pagamento, servida por storage estático, retorna 403 para
 * qualquer requisição). O Fluxo Principal mocka esse ambiente e o gateway de PIX
 * seguindo o contrato de resposta da API. Os fluxos de exceção são validações
 * client-side puras. Detalhes em docs/MOCKS.md.
 *
 * Sessão: storageState do project (gerado uma vez pelo setup). Pedir a fixture
 * `sessao`/`sessaoComPix` no teste já abre a home autenticada com os mocks certos.
 */
test.describe('Depósito via PIX', { tag: '@deposito' }, () => {
  test('Fluxo Principal: deposita com sucesso e recebe o código PIX', { tag: '@happyPath' }, async ({ sessaoComPix, depositoPage }) => {
    await depositoPage.abrir();
    await depositoPage.selecionarValorRapido('R$ 100,00');
    await depositoPage.submeter();

    await expect(depositoPage.dialog).toContainText('Código PIX gerado com sucesso!');
    await expect(depositoPage.botaoCopiaECola).toBeEnabled();
  });

  test('Fluxo Alternativo: bloqueia depósito com valor abaixo do mínimo', async ({ sessao, depositoPage }) => {
    await depositoPage.abrir();
    await depositoPage.preencherValor('1,00');

    await expect(depositoPage.dialog).toContainText('O valor mínimo é de R$ 10,00.');
    await expect(depositoPage.botaoSubmeter).toBeDisabled();
  });

  test('Fluxo Alternativo: bloqueia depósito sem informar valor', async ({ sessao, depositoPage }) => {
    await depositoPage.abrir();

    await expect(depositoPage.botaoSubmeter).toBeDisabled();
  });
});
