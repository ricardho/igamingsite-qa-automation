import { test, expect } from '../../support/fixtures.js';
import { corpoJson } from '../../services/BaseApiService.js';

/**
 * GET /financial/position é somente leitura (sem side-effect financeiro) —
 * seguro de rodar até direto em produção com um usuário de teste dedicado.
 *
 * O cenário de sucesso (saldo de uma conta autenticada real) está bloqueado:
 * não temos como criar uma conta real em pre-prod (ver docs/MOCKS.md) nem
 * interceptar a rede num teste de API pura como fazemos no Web.
 */
test.describe('Saldo — API (player-api-igamingsite)', { tag: ['@smoke-preprod', '@prod-readonly'] }, () => {
  test('Bloqueia consulta de saldo sem token de autenticação', async ({ playerApi }) => {
    const resposta = await playerApi.getSaldo();

    expect(resposta.status).toBe(401);
    const body = corpoJson(resposta);
    expect(body.success).toBe(false);
    expect(body.errors?.message).toBe('Não autorizado.');
  });
});
