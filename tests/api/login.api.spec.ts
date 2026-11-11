import { test, expect } from '../../support/fixtures.js';
import { corpoJson } from '../../services/BaseApiService.js';
import { CREDENCIAIS_INVALIDAS } from '../../helpers/testData.js';

/**
 * Testes de API pura (request, sem browser) do serviço player-api-igamingsite —
 * auth. Cobertura limitada aos cenários que NÃO dependem de uma conta
 * autenticada real: criar uma conta de verdade em pre-prod está bloqueado
 * pela validação de assinatura do token de CPF (ver docs/MOCKS.md). Sem uma
 * conta real, não há como obter um token válido para testar os fluxos de
 * sucesso de login/refresh/logout — documentado como bloqueio conhecido, não
 * fabricado com dados falsos.
 */
test.describe('Login — API (player-api-igamingsite)', { tag: '@smoke-preprod' }, () => {
  test('Bloqueia login com credenciais inválidas', async ({ playerApi }) => {
    const resposta = await playerApi.login(CREDENCIAIS_INVALIDAS.login, CREDENCIAIS_INVALIDAS.senha);

    expect(resposta.status).toBe(401);
    const body = corpoJson(resposta);
    expect(body.success).toBe(false);
    expect(body.errors?.message).toBe('Usuário ou Senha inválido.');
  });

  test('verify-login-data também bloqueia credenciais inválidas', async ({ playerApi }) => {
    const resposta = await playerApi.verifyLoginData(CREDENCIAIS_INVALIDAS.login, CREDENCIAIS_INVALIDAS.senha);

    expect(resposta.status).toBe(401);
    expect(corpoJson(resposta).success).toBe(false);
  });

  test('Bloqueia refresh com refreshToken malformado', async ({ playerApi }) => {
    const resposta = await playerApi.refreshToken('token-completamente-invalido');

    expect(resposta.status).toBe(500);
    expect(corpoJson(resposta).success).toBe(false);
  });

  test('Bloqueia logout sem token de autenticação', async ({ playerApi }) => {
    const resposta = await playerApi.logout();

    expect(resposta.status).toBe(401);
    expect(corpoJson(resposta).errors?.message).toBe('Não autorizado.');
  });
});
