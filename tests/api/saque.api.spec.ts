import { test, expect } from '../../support/fixtures.js';
import { corpoJson } from '../../services/BaseApiService.js';
import { CONTA_BANCARIA_MOCK } from '../../helpers/mocks/mockSaque.js';

/**
 * Testes de API pura do serviço backoffice-api-igamingsite — saque (contas
 * bancárias). Cobertura limitada aos cenários que NÃO dependem de uma conta
 * autenticada real: sem uma conta de verdade em pre-prod (ver docs/MOCKS.md),
 * não há token válido para os fluxos de sucesso de listagem/cadastro de conta
 * bancária, nem para a confirmação do saque em si — cujo endpoint real também
 * não foi identificado (ver docs/MOCKS.md seção 8.5).
 *
 * Endpoints confirmados direto contra pre-prod antes de codar (`curl`, sem
 * navegador — mesmo endpoint usado pelo front-end).
 */
const { bankName: _nomeBanco, ...CONTA } = CONTA_BANCARIA_MOCK;

test.describe('Saque — API (backoffice-api-igamingsite)', { tag: '@smoke-preprod' }, () => {
  test('Bloqueia listagem de contas bancárias sem token de autenticação', async ({ backofficeApi }) => {
    const resposta = await backofficeApi.listarContasBancarias();

    expect(resposta.status).toBe(401);
    expect(corpoJson(resposta).message).toBe('Login expirado');
  });

  test('Bloqueia listagem de contas bancárias com token malformado', async ({ backofficeApi }) => {
    const resposta = await backofficeApi.listarContasBancarias('token-completamente-invalido');

    expect(resposta.status).toBe(401);
    expect(corpoJson(resposta).message).toBe('Login expirou, entre novamente.');
  });

  test('Bloqueia cadastro de conta bancária sem token de autenticação', async ({ backofficeApi }) => {
    const resposta = await backofficeApi.registrarContaBancaria(CONTA);

    expect(resposta.status).toBe(401);
    expect(corpoJson(resposta).message).toBe('Login expirado');
  });
});
