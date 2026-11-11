import { test as setup } from '../../support/fixtures.js';
import { cadastrarEFazerLogin } from '../../support/fluxos.js';
import { DADOS_SESSAO_MOCKADA } from '../../helpers/testData.js';

/**
 * Roda UMA VEZ antes dos projects de e2e (ver `dependencies` em
 * playwright.config.ts): faz a jornada visual de cadastro+login e salva o
 * storageState (cookies + localStorage) reaproveitado pelas fixtures `sessao*`.
 *
 * O mesmo arquivo atende desktop e mobile — cada project de setup roda no seu
 * device e grava em `arquivoSessao` próprio. O mobile precisa da jornada no
 * próprio viewport: um storageState gerado em desktop deixa o header mobile
 * preso no estado deslogado num carregamento a frio.
 *
 * Cadastro/login são mockados a nível de rede (nenhuma conta é persistida, ver
 * docs/MOCKS.md): o que saque/depósito validam é o comportamento pós-login.
 */
setup('gerar sessão mockada reaproveitável', async ({ page, arquivoSessao }) => {
  await cadastrarEFazerLogin(page, DADOS_SESSAO_MOCKADA);
  await page.context().storageState({ path: arquivoSessao });
});
