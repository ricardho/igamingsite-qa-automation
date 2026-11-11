import type { Page } from '@playwright/test';
import { mockJson } from './http.js';

interface DadosLogin {
  id?: number;
  nome: string;
  sobrenome?: string;
  email: string;
  telefone: string;
  nascimento: string;
}

function construirRespostaLogin({ id = 999999, nome, sobrenome = 'Automation', email, telefone, nascimento }: DadosLogin) {
  return {
    success: true,
    results: {
      token: 'fake.token.acesso',
      tokenCassino: 'fake.token.cassino',
      refreshToken: 'fake.refresh.token',
      user: {
        id,
        nome,
        tipo_usuario: 'cliente',
        cookie: 'fakecookie',
        google_login: false,
        phone_validated: 0,
        // true evita o modal de boas-vindas/"faça seu primeiro depósito" em tela cheia,
        // que a UI mostra sobre toda a página logo após o boot quando esse campo é false
        // (nenhum teste depende desse modal — ver docs/MOCKS.md seção 8/9).
        first_deposit: true,
        // true evita que o gate "Verificação da conta" reapareça pós-login (ver docs/MOCKS.md).
        verifiedIdentity: true,
        /*
         * O front-end só dispensa de vez o gate "Verificação da conta" quando
         * `verifiedIdentity` E `email_validado` são ambos truthy — faltando esse campo,
         * o app trava no passo "email" com um gate `required: true` (sem botão de
         * fechar, sem Escape), cobrindo o header inteiro.
         */
        email_validado: true,
        balance: '0.00',
        sobrenome,
        telefone,
        email,
        data_nascimento: nascimento,
      },
    },
  };
}

/**
 * Mocka toda a cadeia de sessão pós-login (login, refresh, cliente, saldo e
 * contas bancárias) — um token fake não é aceito por nenhum desses endpoints
 * reais (ver docs/MOCKS.md).
 */
export async function mockSessaoAutenticada(page: Page, dados: DadosLogin): Promise<void> {
  const resposta = construirRespostaLogin(dados);

  await mockJson(page, '**/auth/login', resposta);
  await mockJson(page, '**/auth/refresh', resposta);
  await mockJson(page, '**/api/clientes/getCliente/**', { success: true, results: resposta.results.user });
  await mockJson(page, '**/financial/position**', { success: true, results: { balance: '0.00', bonusBalance: '0.00' } });
  await mockJson(page, '**/api/clientes/allBankAccounts**', { success: true, results: [] });
}
