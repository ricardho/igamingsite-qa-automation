import { test, expect } from '../../support/fixtures.js';
import { corpoJson } from '../../services/BaseApiService.js';

/**
 * A listagem de jogos é pública (não exige token) e somente leitura — seguro
 * de rodar até direto em produção. O endpoint é `POST /casino/games`; a
 * documentação da API descrevia GET, mas pre-prod responde 405 para GET
 * (confirmado direto contra o ambiente antes de codar).
 */
test.describe('Cassino — API (player-api-igamingsite)', { tag: ['@smoke-preprod', '@prod-readonly'] }, () => {
  test('Lista os jogos de cassino sem precisar de autenticação', async ({ playerApi }) => {
    const resposta = await playerApi.listarJogosCassino();

    expect(resposta.status).toBe(200);
    const { gameList } = corpoJson(resposta);
    expect(Array.isArray(gameList)).toBe(true);
    expect(gameList.length).toBeGreaterThan(0);
  });
});
