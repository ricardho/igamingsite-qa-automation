# Automação iGamingSite — Web + Mobile + API

[English](README.md) | **Português**

[![CI](https://github.com/ricardho/igamingsite-qa-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/ricardho/igamingsite-qa-automation/actions/workflows/ci.yml)

Suíte de testes automatizados em **Playwright + TypeScript** para uma
plataforma de iGaming. Cobre os fluxos de **Cadastro**, **Login**, **Depósito
via PIX** e **Saque** em 3 browsers desktop e 2 devices mobile, além de testes
de API pura dos principais serviços de backend e testes unitários dos
utilitários da suíte.

| | |
|---|---|
| **Cenários e2e** | 13 cenários × 5 devices (Chromium, Firefox, WebKit, Pixel 5, iPhone 12) |
| **Testes de API** | 12 cenários em 2 serviços + 1 esqueleto documentado (webhooks PIX) |
| **Testes unitários** | 10 (gerador/validador de CPF, massa de dados, utilitários) |
| **Padrões** | Page Objects, Service Objects, fixtures (`test.extend`), mocks de rede |
| **CI** | GitHub Actions — typecheck + unitários em todo push; suíte contra o ambiente sob demanda |

## Contexto deste repositório

A suíte foi desenvolvida para um cliente real, contra um ambiente de pre-prod
privado. Para publicação em portfólio, o projeto foi **anonimizado**: marca,
domínios, nomes de serviços, gateways de pagamento e dados de pagamento foram
substituídos por equivalentes fictícios (`iGamingSite`, `player-api`,
`backoffice-api`, AlphaPay, OneBank, Tetra).

Consequência prática: **os testes e2e e de API não rodam fora do ambiente
original** — o domínio `igamingsite.com` não aponta para a aplicação testada.
O que roda em qualquer máquina e no CI é o `typecheck` e os testes unitários.
A arquitetura, as decisões técnicas e a documentação de investigação
(`docs/`) estão preservadas integralmente.

## Ambiente original e por que há mocks

O pre-prod era usado pelo time como ambiente de **desenvolvimento**, não como
staging — sem controle de versionamento, com comportamento que mudava entre
sessões sem aviso, e principalmente:

- **Sem integrações reais habilitadas.** Validação de CPF na Receita Federal,
  geração de PIX e gateway de pagamento desabilitados ou bloqueados.
- **Sem usuários/contas reais para testar.** Nenhum CPF de terceiro disponível,
  nenhuma conta com saldo, histórico ou conta bancária vinculada.

Testar os fluxos de ponta a ponta contra o backend real era, portanto,
impossível. A estratégia adotada:

1. **Confirmar cada endpoint contra o ambiente real antes de mockar** — nenhuma
   rota foi assumida a partir de documentação; todas foram validadas via
   inspeção de rede (no navegador ou interceptação no próprio teste), e as
   divergências foram documentadas.
2. **Mockar só o mínimo necessário** para o fluxo de UI funcionar, com
   `page.route()` interceptando as respostas de API que o ambiente bloqueia —
   nunca o front-end em si.
3. **Documentar toda decisão de mock**: o quê, por quê, e o caminho para tornar
   o fluxo 100% real quando o ambiente permitir.

Destaques (detalhes em [`docs/MOCKS.md`](docs/MOCKS.md) e
[`docs/API-TESTES.md`](docs/API-TESTES.md)):

- **Cadastro**: o campo `dadosCriptografados` exige um token de CPF assinado
  pelo servidor, que não havia como emitir — o backend rejeita qualquer token
  forjado com `500`. Foram
  mockados o POST de cadastro e a cadeia de sessão pós-login (`auth/login`,
  `auth/refresh`, `getCliente`, `financial/position`, `allBankAccounts`).
- **Depósito via PIX**: geração de PIX desabilitada deliberadamente em pre-prod
  (confirmado fora do navegador). Mockada seguindo o contrato da API,
  com payload PIX fictício (EMV válido, recebedor inexistente).
- **Saque**: o cadastro de conta bancária é um endpoint real, mas exige token
  válido — mockado pela mesma razão. A confirmação final do saque ficou como
  lacuna conhecida, documentada e não mascarada.
- **CPF/KYC**: CPFs sintéticos com dígitos verificadores válidos, e consulta à
  Receita mockada com a mesma estrutura de JWT do contrato da API.
- **Não mockado**: login com credenciais inválidas roda contra o backend real.

## O que está coberto

### E2E — `tests/e2e/`

Os **mesmos specs** rodam nos 3 browsers desktop e nos 2 devices mobile. O site
é responsivo (mesma base de código, sem app nativo), então não existe suíte
mobile duplicada: cada project do `playwright.config.ts` define só o device e
o arquivo de sessão.

| Spec | Cenários |
|---|---|
| `cadastro.spec.ts` | Cadastro com sucesso, CPF já cadastrado, menor de idade, campos vazios |
| `cadastro-login.spec.ts` | Integração: cadastro seguido de login com o mesmo usuário |
| `login.spec.ts` | Bloqueio de login com credenciais inválidas (backend real, sem mock) |
| `deposito.spec.ts` | Depósito PIX com sucesso, valor abaixo do mínimo, valor vazio |
| `saque.spec.ts` | Cadastro de conta bancária, valor abaixo do mínimo, saldo insuficiente, campos vazios |

### API pura (sem browser) — `tests/api/`

| Spec | Serviço | Tags |
|---|---|---|
| `login.api.spec.ts` | player-api — auth | `@smoke-preprod` |
| `cadastro.api.spec.ts` | backoffice-api — cadastro/CPF | `@smoke-preprod` |
| `saldo.api.spec.ts` | player-api — saldo | `@smoke-preprod` `@prod-readonly` |
| `casino.api.spec.ts` | player-api — cassino | `@smoke-preprod` `@prod-readonly` |
| `saque.api.spec.ts` | backoffice-api — contas bancárias | `@smoke-preprod` |
| `webhooks-pix.api.spec.ts` | payment-gateway — `test.skip()`, não reproduzível no ambiente | `@integration-only-prod` |

### Unitários — `tests/unit/`

Gerador e validador de CPF (200 CPFs gerados validados, casos inválidos),
unicidade dos e-mails gerados, massa de dados de cadastro e escape de regex.
Rodam sem browser e sem rede — são o gate do CI.

## Arquitetura

```
config/ambiente.ts        URLs e credenciais (variáveis de ambiente / .env)
pages/                    Page Objects — um por tela/modal
  BasePage.ts               navegação limpa, overlays, visivel(), clicar/marcar/preencher
  HeaderComponent.ts        header, usado por composição em todas as páginas
  HomePage, CadastroPage, LoginPage, DepositoPage, SaquePage
services/                 Service Objects (API) — um por serviço
  BaseApiService.ts         headers, auth, passo no relatório, anexo mascarado
  PlayerApiService.ts, BackofficeApiService.ts
support/
  fixtures.ts               test.extend: páginas, services e sessões prontas
  fluxos.ts                 jornadas compostas (cadastrar, cadastrar + logar)
  relatorio.ts              passo(), registrarAviso(), tentarAte()
helpers/
  testData.ts               massa de dados (Faker) e credenciais de teste
  jwt.ts                    JWT fake no formato da resposta real
  mocks/                    mocks de rede por domínio + mockJson()
  fixtures/                 configuração de pagamentos (anonimizada)
utils/                    funções puras (CPF, texto)
tests/setup/              gera o storageState (desktop e mobile)
tests/e2e/                specs via browser
tests/api/                specs de API pura
tests/unit/               testes unitários
docs/                     investigação de mocks, endpoints e drift do ambiente
```

### Como uma execução acontece

```
setup         (Desktop Chrome) ─► sessao-desktop.json ─► chromium · firefox · webkit
setup-mobile  (Pixel 5)        ─► sessao-mobile.json  ─► Mobile Chrome · Mobile Safari
api · unit                     independentes, sem browser e sem setup
```

Cada setup faz a jornada visual de cadastro+login **uma única vez** no seu
device e grava a sessão em `playwright/.auth/`.

Os testes que só precisam *estar* logados (depósito, saque) reaproveitam o
`storageState` em vez de repetir a jornada de cadastro+login. Cadastro e login
continuam cobertos de ponta a ponta nos próprios specs, que começam com sessão
vazia.

### Como um spec fica

```ts
test('Fluxo Principal: deposita com sucesso e recebe o código PIX',
  { tag: '@happyPath' },
  async ({ sessaoComPix, depositoPage }) => {
    await depositoPage.abrir();
    await depositoPage.selecionarValorRapido('R$ 100,00');
    await depositoPage.submeter();

    await expect(depositoPage.dialog).toContainText('Código PIX gerado com sucesso!');
    await expect(depositoPage.botaoCopiaECola).toBeEnabled();
  });
```

A fixture `sessaoComPix` já abre a home autenticada com os mocks de sessão,
configuração de pagamento e PIX; `depositoPage` chega instanciado. O spec
descreve só o comportamento.

## Decisões técnicas

- **Page Objects sem asserção de negócio.** As páginas expõem localizadores
  `readonly` e ações; o `expect` de regra de negócio fica no spec. Localizadores
  priorizam `getByRole`/`getByLabel`/`getByPlaceholder`.
- **Filtro de visibilidade em vez de `.first()`.** Os modais renderizam duas
  cópias dos campos (mobile e desktop, alternadas via CSS). `BasePage.visivel()`
  seleciona a instância realmente visível, o que faz os mesmos Page Objects
  funcionarem nos dois viewports.
- **Clique com checagens reais.** Toda ação passa pelas verificações do
  Playwright (visível, estável, recebe eventos). Só quando o único impedimento
  é o elemento nunca estabilizar (animação contínua no WebKit) a ação cai para
  `force: true` — e isso é registrado no relatório. Elemento coberto por
  overlay continua sendo falha: um usuário real também não conseguiria clicar.
- **Instabilidade visível, não absorvida.** Retentativas internas (`tentarAte`),
  cliques forçados e o gate de verificação fechado via reload viram
  *annotations* de aviso no relatório. Localmente não há retry de teste — um
  teste instável falha na hora.
- **Relatório legível.** Cada ação de negócio é um `test.step` nomeado ("Abrir
  modal de saque", "Selecionar primeira conta bancária cadastrada"). Nas APIs,
  cada chamada vira um passo com request/response anexadas.
- **Respostas de API tipadas.** Os Service Objects retornam
  `{ status, body, texto }` tipado; `corpoJson()` falha com mensagem clara
  (status + trecho do corpo) quando a resposta não é JSON.
- **Ruído de terceiros bloqueado.** Analytics, ads, chat e imagens são
  abortados antes da navegação, para que o carregamento dependa só do site
  testado. O bloqueio usa `route.fallback()`, preservando os mocks específicos.
- **Dados determinísticos onde importam.** A sessão mockada usa dados fixos (o
  setup e os workers precisam enxergar o mesmo usuário); cadastros usam Faker
  com e-mails únicos entre workers paralelos.

## Configuração

Toda configuração de ambiente vive em [`config/ambiente.ts`](config/ambiente.ts)
e vem de variáveis de ambiente — um arquivo `.env` na raiz (modelo em
[`.env.example`](.env.example), nunca versionado) ou variáveis do CI.

| Variável | Uso |
|---|---|
| `BASE_URL` | URL do site (e2e) |
| `PLAYER_API_URL` | API do jogador (auth, saldo, cassino) |
| `BACKOFFICE_API_URL` | API de cadastro e contas bancárias |
| `QA_SENHA_PADRAO` | Senha sintética usada nos fluxos mockados |

Sem `.env`, valem os defaults do ambiente de demonstração.

## Como rodar

Pré-requisito: **Node.js 20.12+** (o `.env` é carregado com `process.loadEnvFile`).

```bash
npm install
npx playwright install        # browsers (não necessário para api/unit)
cp .env.example .env          # opcional

npm run typecheck             # verificação de tipos
npm run test:unit             # unitários (sem browser, sem rede)

# Contra o ambiente:
npm test                      # tudo (setup + e2e desktop/mobile + api + unit)
npm run test:e2e              # e2e nos 3 browsers desktop
npm run test:mobile           # e2e nos 2 devices mobile
npm run test:api              # API pura
npm run test:smoke            # API com tag @smoke-preprod
npm run test:happy            # só os caminhos felizes (@happyPath)
npm run test:report           # abre o último relatório HTML

npx playwright test --project=webkit --grep @saque   # combinações livres
```

**Tags** (API oficial `tag` do Playwright, filtráveis com `--grep`):

| Tag | Significado |
|---|---|
| `@happyPath` | Caminho feliz de cada funcionalidade |
| `@cadastro` `@login` `@deposito` `@saque` | Funcionalidade |
| `@smoke-preprod` | Feedback rápido de API em pre-prod |
| `@prod-readonly` | Seguro rodar em produção (sem side-effect) |
| `@integration-only-prod` | Não reproduzível em pre-prod — documentado |
| `@unit` | Testes unitários |

**Execução**: retry só no CI (2×, com o teste marcado como *flaky*);
evidências só em falha (trace, screenshot e vídeo); reporter `list` + HTML,
que localmente abre só quando algo falha e no CI nunca abre sozinho.

### CI — [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

- **Todo push/PR**: `typecheck` + testes unitários.
- **Manual (`workflow_dispatch`)**: escolhe a suíte (api, e2e, mobile ou
  completa) para rodar contra o ambiente, com URLs em `vars` e a senha em
  `secrets` do repositório. O relatório HTML fica como artefato do job.

## Stack

- [Playwright Test](https://playwright.dev/) — execução, fixtures, mocks de rede, reporter HTML
- TypeScript (`strict`) — `tsc --noEmit` como gate de CI
- [Faker.js](https://fakerjs.dev/) — dados sintéticos (nomes, e-mails, telefones)
- GitHub Actions — CI

## Limitações conhecidas

- Nenhum cadastro/login real acontece de ponta a ponta — depende de mocks
  documentados (ver `docs/MOCKS.md`).
- A confirmação final de um saque bem-sucedido não foi coberta — o saldo usado
  pela validação do modal não é alimentado por nenhum endpoint mockável
  isoladamente (`docs/MOCKS.md`, seção 8.5).
- O webhook de confirmação de PIX não é reproduzível nesta camada — mantido
  como esqueleto para um ambiente que permita simular o provedor.
- O comportamento do pre-prod pode mudar sem aviso — falhas de API devem ser
  investigadas como possível mudança de contrato antes de assumir bug no teste
  (ver `docs/API-TESTES.md`).
- No WebKit mobile, o clique que abre o menu "Sacar" pode falhar de forma
  intermitente enquanto o menu ainda está em transição — a abertura é refeita
  (`SaquePage.abrir`) e cada retentativa fica registrada no relatório.

## Próximos passos

- Usar uma conta de teste real (ou um modo de teste para o token de CPF) para destravar
  os fluxos de sucesso de ponta a ponta sem mocks.
- Cobrir a confirmação final do saque quando a fonte real do saldo do modal for
  identificada.
- Pedir ao time de front `data-testid` nos campos do modal de nova conta
  bancária, que não têm label/placeholder acessível e hoje dependem de
  seletores por atributo (`input[readonly]`, `input[inputmode="numeric"]`).
