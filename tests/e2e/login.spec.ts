import { test, expect } from '../../support/fixtures.js';
import { SEM_SESSAO } from '../../config/ambiente.js';
import { CREDENCIAIS_INVALIDAS } from '../../helpers/testData.js';

/**
 * Funcionalidade: Login
 *
 * Roda contra o backend real (sem mock): credenciais inexistentes devem ser
 * rejeitadas. O login com sucesso é coberto por cadastro-login.spec.ts, que
 * autentica com um usuário criado no próprio fluxo de UI.
 */
test.use({ storageState: SEM_SESSAO });

test.describe('Login', { tag: '@login' }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.acessar();
    await loginPage.abrirFormularioDeLogin();
  });

  test('Fluxo alternativo: bloqueia login com credenciais inválidas', async ({ loginPage }) => {
    await loginPage.logar(CREDENCIAIS_INVALIDAS);

    await expect(loginPage.dialog).toContainText('Usuário ou senha incorretos');
  });
});
