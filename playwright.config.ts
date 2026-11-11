import { defineConfig, devices } from '@playwright/test';
import { AMBIENTE, ARQUIVOS_SESSAO } from './config/ambiente.js';

const CI = !!process.env.CI;

/**
 * Viewport desktop mais alta que o padrão (1280x720): os modais de
 * cadastro/login são `position: fixed` ancorados na base da tela, e testes que
 * clicam no submit sem preencher nenhum campo nunca disparam o auto-scroll que
 * o foco em um input causaria. Com mais altura o diálogo inteiro cabe na tela.
 * Precisa ser aplicada em cada project: o `...devices[...]` traz o próprio
 * viewport e sobrescreveria um valor definido só no `use` global.
 */
const VIEWPORT_DESKTOP = { width: 1280, height: 1600 };

const E2E = './tests/e2e';

export default defineConfig<{ arquivoSessao: string }>({
  fullyParallel: true,
  /* Falha o build no CI se um test.only for esquecido no código. */
  forbidOnly: CI,
  /*
   * Retentativas só no CI. Localmente, um teste instável deve falhar na hora —
   * retry local esconde flakiness durante o desenvolvimento. No CI, 2 retries
   * absorvem a instabilidade de rede do ambiente compartilhado, e o relatório
   * marca esses testes como "flaky" para triagem.
   */
  retries: CI ? 2 : 0,
  /*
   * Limitado mesmo fora do CI: rodar muitos testes em paralelo contra o mesmo
   * backend de pre-prod aumenta bastante a flakiness (ambiente fica lento sob
   * carga concorrente).
   */
  workers: CI ? 1 : 3,
  /* Timeout por teste: cada um encadeia várias chamadas contra um backend real. */
  timeout: 60000,
  /*
   * `list` dá progresso no terminal; o HTML nunca abre sozinho no CI (o servidor
   * do relatório ficaria esperando e travaria o job) e localmente abre só quando
   * algo falha.
   */
  reporter: [['list'], ['html', { open: CI ? 'never' : 'on-failure' }]],
  expect: {
    /* O padrão de 5s é curto demais para um site real sob variação de rede. */
    timeout: 12000,
  },
  use: {
    baseURL: AMBIENTE.baseUrl,
    /* Evidências só quando falha: trace (CI: na 1ª retentativa), screenshot e vídeo. */
    trace: CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /*
     * Margem para ações e navegação: WebKit renderiza os overlays iniciais
     * (idade/cookies) mais devagar que Chromium/Firefox.
     */
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    /*
     * Setup: roda a jornada visual de cadastro+login uma vez e grava o
     * storageState. Desktop e mobile têm setups próprios (mesmo arquivo de
     * teste, device e destino diferentes) — ver tests/setup/sessao.setup.ts.
     */
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORT_DESKTOP, arquivoSessao: ARQUIVOS_SESSAO.desktop },
    },
    {
      name: 'setup-mobile',
      testDir: './tests/setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Pixel 5'], arquivoSessao: ARQUIVOS_SESSAO.mobile },
    },

    /*
     * E2E: os MESMOS specs rodam em 3 browsers desktop e 2 devices mobile — o
     * site é responsivo (mesma base de código), só muda o device e o
     * storageState. Specs que precisam começar deslogados (cadastro/login)
     * sobrescrevem com `test.use({ storageState: SEM_SESSAO })`.
     */
    {
      name: 'chromium',
      testDir: E2E,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORT_DESKTOP, storageState: ARQUIVOS_SESSAO.desktop },
    },
    {
      name: 'firefox',
      testDir: E2E,
      dependencies: ['setup'],
      // Margem extra: foi o browser com mais relatos de timeout contra o site real.
      use: {
        ...devices['Desktop Firefox'],
        viewport: VIEWPORT_DESKTOP,
        storageState: ARQUIVOS_SESSAO.desktop,
        actionTimeout: 20000,
        navigationTimeout: 40000,
      },
    },
    {
      name: 'webkit',
      testDir: E2E,
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], viewport: VIEWPORT_DESKTOP, storageState: ARQUIVOS_SESSAO.desktop },
    },
    {
      name: 'Mobile Chrome',
      testDir: E2E,
      dependencies: ['setup-mobile'],
      use: { ...devices['Pixel 5'], storageState: ARQUIVOS_SESSAO.mobile },
    },
    {
      name: 'Mobile Safari',
      testDir: E2E,
      dependencies: ['setup-mobile'],
      use: { ...devices['iPhone 12'], storageState: ARQUIVOS_SESSAO.mobile },
    },

    /*
     * API pura (APIRequestContext, sem browser). Cada Service Object usa a URL do
     * seu serviço (config/ambiente.ts), já que o projeto consome hosts diferentes.
     */
    { name: 'api', testDir: './tests/api' },

    /* Unitários dos utilitários — sem browser e sem rede; é o gate de todo push no CI. */
    { name: 'unit', testDir: './tests/unit' },
  ],
});
