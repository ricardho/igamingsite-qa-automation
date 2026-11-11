import { test } from '../../support/fixtures.js';
import { SEM_SESSAO } from '../../config/ambiente.js';
import { cadastrarEFazerLogin } from '../../support/fluxos.js';

/**
 * Funcionalidade: Integração — Cadastro seguido de Login
 *
 * Cadastra um usuário com CPF mockado e, na sequência, faz login com as mesmas
 * credenciais — cobre o "login com sucesso" de forma mais realista do que um
 * mock isolado, já que usa um usuário criado no fluxo de UI.
 *
 * Toda a cadeia de rede (validação de CPF, criação de conta, login e sessão) é
 * mockada — ver docs/MOCKS.md (token de CPF assinado no servidor e cascata de
 * deslogamento automático não seriam contornáveis de outra forma).
 */
test.use({ storageState: SEM_SESSAO });

test.describe('Integração: cadastro seguido de login', { tag: ['@cadastro', '@login'] }, () => {
  test('Cadastra um novo usuário e realiza login com sucesso na sequência', { tag: '@happyPath' }, async ({ page }) => {
    // O fluxo termina com a asserção de header autenticado (aguardarSessaoAutenticada).
    await cadastrarEFazerLogin(page);
  });
});
