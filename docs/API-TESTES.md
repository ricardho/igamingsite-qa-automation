# Testes de API (`tests/api/`)

Testes via `request`/`APIRequestContext` do Playwright, sem browser — rodam
em segundos (`npx playwright test --project=api`). Arquitetura em Service
Objects (`services/`), equivalente aos Page Objects do lado Web: cada
`*ApiService.ts` estende `BaseApiService`, recebe a URL do serviço de
`config/ambiente.ts` e expõe métodos de negócio, sem nenhuma asserção dentro —
a asserção fica sempre no spec. Cada chamada vira um passo do relatório com
request/response anexadas (senha e token mascarados).

## Por que pre-prod não é staging confiável (e por que ainda vale testar)

Pre-prod é usado pelos devs como ambiente de desenvolvimento — sem controle
de PR/versionamento — então o comportamento muda entre sessões sem aviso
(ver docs/MOCKS.md seção 7 para um exemplo concreto que aconteceu durante
este trabalho). Isso não invalida a suíte, muda o papel dela:

- **Smoke test contínuo** — feedback rápido de "quebrou algo óbvio".
- **Documentação viva do contrato de API** — um teste falhando é sinal de "a
  API mudou", que pode ser bug **ou** mudança intencional não comunicada.
- **Detector de regressão**, mas com triagem manual — nem toda falha aqui é
  bug.

O risco real não é testar em pre-prod, é tratar falha em pre-prod como
release gate sem primeiro confirmar que não é só o ambiente instável.

## Tags de confiabilidade

Cada `describe` declara suas tags pela API oficial do Playwright
(`test.describe(..., { tag: [...] })`), então dá para filtrar com
`npx playwright test --grep @prod-readonly` ou `npm run test:smoke`:

| Tag | Significado | Onde |
|---|---|---|
| `@smoke-preprod` | Roda em pre-prod, feedback rápido pra devs | login, cadastro, saldo, cassino, saque |
| `@prod-readonly` | Seguro rodar direto em produção (só GET/POST sem side-effect financeiro) | saldo (`financial/position`), cassino (`casino/games`) |
| `@integration-only-prod` | Não reproduzível em pre-prod — documentado, não implementado | webhooks PIX |
| `@regression-full` | Suíte completa de regressão (ativar quando/se houver staging real) | ainda não usada — ver "O que falta" |

## O que está coberto agora

| Spec | Cenários | Depende de conta autenticada real? |
|---|---|---|
| `login.api.spec.ts` | credenciais inválidas, verify-login-data inválido, refresh malformado, logout sem token | Não |
| `cadastro.api.spec.ts` | cpf-cadastrado (CPF novo), campos vazios, bloqueio de token de CPF não assinado (regressão) | Não |
| `saldo.api.spec.ts` | sem token → 401 | Não |
| `casino.api.spec.ts` | listagem pública de jogos | Não |
| `saque.api.spec.ts` | listagem de contas bancárias sem token / com token malformado, cadastro de conta bancária sem token | Não |
| `webhooks-pix.api.spec.ts` | — | `test.skip()`, documentado |

## O que falta (bloqueado por não ter uma conta real em pre-prod)

Criar uma conta de verdade em pre-prod exige, no campo `dadosCriptografados`,
um token de CPF assinado pelo servidor que não conseguimos emitir (ver
docs/MOCKS.md seção 2) — e, diferente do Web, testes de API puros não têm
`page.route()` para mockar a resposta. Sem uma conta real logada, os seguintes
fluxos não têm como ser testados com dados reais:

- Login com sucesso, saldo de uma conta real, saque, contas bancárias, KYC
- Cassino (sessão de jogo autenticada) e apostas esportivas
- Promoções e gamificação

**Para destravar:** ou (a) uma conta de teste já existente em pre-prod
(credenciais reais que possam ser usadas pela suíte), ou (b) um modo de
teste no backend que emita/dispense o token de CPF assinado, permitindo
cadastro real de ponta a ponta.

## Divergências confirmadas entre a documentação da API e pre-prod

Vale registrar porque já causou retrabalho — sempre confirmar contra o
ambiente real antes de codar um Service Object novo:

| Documentado | Confirmado em pre-prod |
|---|---|
| `GET /api/clientes/cpf-cadastrado` | Existe e funciona igual |
| — | `verify-exists` (nome usado em versões antigas deste projeto) **nunca existiu** — 404 |
| `GET /casino/games` | Pre-prod exige **POST** — GET retorna 405 |
| — | `POST /api/clientes/registerBankAccount` e `GET /api/clientes/allBankAccounts` (cadastro/listagem de conta bancária para saque) — não documentados, confirmados via inspeção de rede durante a investigação do fluxo de saque (ver docs/MOCKS.md seção 8.2) |

## Saque — cobertura parcial (`services/BackofficeApiService.ts`)

`listarContasBancarias` e `registrarContaBancaria` cobrem só o bloqueio por
autenticação (sem token → `401 {"message":"Login expirado"}`; token
malformado → `401 {"message":"Login expirou, entre novamente."}` — mensagens
diferentes entre os dois casos, confirmado via `curl` direto). O endpoint de
**confirmação do saque em si** (o que dispara ao clicar em "Verifique para
sacar" com conta, valor e saldo válidos) não foi identificado: o saldo
exibido no modal não vem de nenhuma fonte mockável isoladamente que
testamos (`getCliente`, `financial/position`, nem o próprio `auth/login`) —
ver docs/MOCKS.md seção 8.5. Sem saldo suficiente, o fluxo real nunca chega
a esse endpoint, então ele segue desconhecido tanto no lado Web quanto API.

## Próximos passos (não implementados agora)

- `services/PaymentsApiService.ts` (sports/odds, KYC) — não criado ainda,
  pendente dos bloqueios acima. `CenterApiService` acabou não sendo
  necessário: os endpoints de conta bancária/saque já existiam no serviço
  `backoffice-api` (mesmo host do cadastro), cobertos direto em
  `BackofficeApiService.ts`.
- Descobrir o endpoint real de confirmação do saque (ver seção acima) — hoje
  bloqueado pela falta de uma fonte de saldo mockável para esse fluxo
  específico.
