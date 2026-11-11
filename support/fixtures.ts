import { test as base, expect, type Page } from '@playwright/test';
import { ARQUIVOS_SESSAO } from '../config/ambiente.js';
import { DADOS_SESSAO_MOCKADA, type DadosCadastro } from '../helpers/testData.js';
import { bloquearRuidoDeTerceiros } from '../helpers/mocks/blockRuidoTerceiros.js';
import { mockAmbienteDeConfiguracao, mockDepositoPixComSucesso } from '../helpers/mocks/mockDeposito.js';
import { mockContaBancariaExistente } from '../helpers/mocks/mockSaque.js';
import { mockSessaoAutenticada } from '../helpers/mocks/mockSessao.js';
import { CadastroPage } from '../pages/CadastroPage.js';
import { DepositoPage } from '../pages/DepositoPage.js';
import { HomePage } from '../pages/HomePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { SaquePage } from '../pages/SaquePage.js';
import { BackofficeApiService } from '../services/BackofficeApiService.js';
import { PlayerApiService } from '../services/PlayerApiService.js';

type MockAdicional = (page: Page, dados: DadosCadastro) => Promise<void>;

/**
 * Prepara uma página autenticada SEM repetir a jornada visual de cadastro+login:
 * o `page` já chega com o storageState gerado uma única vez pelo project de
 * setup (ver playwright.config.ts). Só falta re-registrar os mocks de rede —
 * `page.route` é por página e não é persistido no storageState, então toda
 * página nova precisa registrá-los antes das chamadas de boot
 * (getCliente/refresh/financial-position) — e confirmar o header autenticado.
 */
async function abrirComSessao(page: Page, mocksAdicionais: MockAdicional[]): Promise<DadosCadastro> {
  const dados = DADOS_SESSAO_MOCKADA;
  await bloquearRuidoDeTerceiros(page);
  await mockSessaoAutenticada(page, dados);
  for (const registrarMock of mocksAdicionais) await registrarMock(page, dados);

  await new HomePage(page).abrirComSessaoAtiva();
  return dados;
}

interface OpcoesProjeto {
  /** Onde o project de setup grava o storageState (desktop ou mobile — ver playwright.config.ts). */
  arquivoSessao: string;
}

interface FixturesSuite {
  // Page Objects, instanciados sob demanda sobre o `page` do teste.
  homePage: HomePage;
  cadastroPage: CadastroPage;
  loginPage: LoginPage;
  depositoPage: DepositoPage;
  saquePage: SaquePage;

  /**
   * Sessões autenticadas prontas (home aberta, header confirmado). Variam só nos
   * mocks extras — o teste pede a que precisa e recebe os dados do usuário:
   *  - `sessao`: sessão + configuração de pagamentos.
   *  - `sessaoComPix`: + geração de PIX mockada (gateway desabilitado em pre-prod).
   *  - `sessaoComContaBancaria`: + uma conta bancária já cadastrada (saque).
   */
  sessao: DadosCadastro;
  sessaoComPix: DadosCadastro;
  sessaoComContaBancaria: DadosCadastro;

  // Service Objects de API.
  playerApi: PlayerApiService;
  backofficeApi: BackofficeApiService;
}

/**
 * Fixtures customizadas via `test.extend()` — abordagem oficial do Playwright
 * para ações repetitivas entre specs, em vez de objetos globais. Um único
 * arquivo serve desktop e mobile: o que muda entre eles (device e storageState)
 * vem da configuração de cada project.
 */
export const test = base.extend<FixturesSuite & OpcoesProjeto>({
  arquivoSessao: [ARQUIVOS_SESSAO.desktop, { option: true }],

  homePage: async ({ page }, use) => use(new HomePage(page)),
  cadastroPage: async ({ page }, use) => use(new CadastroPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  depositoPage: async ({ page }, use) => use(new DepositoPage(page)),
  saquePage: async ({ page }, use) => use(new SaquePage(page)),

  sessao: async ({ page }, use) => use(await abrirComSessao(page, [mockAmbienteDeConfiguracao])),
  sessaoComPix: async ({ page }, use) =>
    use(
      await abrirComSessao(page, [
        mockAmbienteDeConfiguracao,
        (p, dados) => mockDepositoPixComSucesso(p, { nomeCliente: dados.nome }),
      ])
    ),
  sessaoComContaBancaria: async ({ page }, use) => use(await abrirComSessao(page, [mockContaBancariaExistente])),

  playerApi: async ({ request }, use) => use(new PlayerApiService(request)),
  backofficeApi: async ({ request }, use) => use(new BackofficeApiService(request)),
});

export { expect };
