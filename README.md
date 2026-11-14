# iGamingSite Automation — Web + Mobile + API

**English** | [Português](README.pt-BR.md)

[![CI](https://github.com/ricardho/igamingsite-qa-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/ricardho/igamingsite-qa-automation/actions/workflows/ci.yml)

Automated test suite in **Playwright + TypeScript** for an iGaming
platform. It covers the **Sign-up**, **Login**, **PIX deposit** and
**Withdrawal** flows on 3 desktop browsers and 2 mobile devices, plus pure
API tests of the main backend services and unit tests of the suite's
utilities.

| | |
|---|---|
| **E2E scenarios** | 13 scenarios × 5 devices (Chromium, Firefox, WebKit, Pixel 5, iPhone 12) |
| **API tests** | 12 scenarios across 2 services + 1 documented skeleton (PIX webhooks) |
| **Unit tests** | 10 (CPF generator/validator, test data, utilities) |
| **Patterns** | Page Objects, Service Objects, fixtures (`test.extend`), network mocks |
| **CI** | GitHub Actions — typecheck + unit tests on every push; suite against the environment on demand |

> **Glossary for non-Brazilian readers:** **PIX** is Brazil's instant payment
> system, and **CPF** is the Brazilian individual taxpayer ID, validated
> against the federal tax authority (Receita Federal).

## About this repository

The suite was built for a real client, against a private pre-prod
environment. For portfolio publication the project was **anonymized**: brand,
domains, service names, payment gateways and payment data were replaced with
fictitious equivalents (`iGamingSite`, `player-api`, `backoffice-api`,
AlphaPay, OneBank, Tetra).

In practice, this means **the E2E and API tests do not run outside the
original environment** — the `igamingsite.com` domain does not point to the
application under test. What runs on any machine and in CI is the `typecheck`
and the unit tests. The architecture, technical decisions and investigation
documentation (`docs/`) are fully preserved.

## The original environment and why there are mocks

The team used pre-prod as a **development** environment, not as staging — no
version control, behavior that changed between sessions without notice, and
above all:

- **No real integrations enabled.** CPF validation with the Receita Federal,
  PIX generation and the payment gateway were disabled or blocked.
- **No real users/accounts to test with.** No third-party CPF available, no
  account with balance, history or a linked bank account.

Testing the flows end to end against the real backend was therefore
impossible. The strategy adopted:

1. **Confirm every endpoint against the real environment before mocking it** —
   no route was assumed from documentation; all of them were validated through
   network inspection (in the browser or by interception within the test
   itself), and discrepancies were documented.
2. **Mock only the minimum required** for the UI flow to work, with
   `page.route()` intercepting the API responses the environment blocks —
   never the front end itself.
3. **Document every mocking decision**: what, why, and the path to make the
   flow 100% real once the environment allows it.

Highlights (details in [`docs/MOCKS.md`](docs/MOCKS.md) and
[`docs/API-TESTES.md`](docs/API-TESTES.md), both in Portuguese):

- **Sign-up**: the `dadosCriptografados` field requires a server-signed CPF
  token that could not be issued — the backend rejects any forged token with
  `500`. The sign-up POST and the post-login session chain (`auth/login`,
  `auth/refresh`, `getCliente`, `financial/position`, `allBankAccounts`) were
  mocked.
- **PIX deposit**: PIX generation is deliberately disabled in pre-prod
  (confirmed outside the browser). It was mocked following the API contract,
  with a fictitious PIX payload (valid EMV, non-existent recipient).
- **Withdrawal**: bank account registration is a real endpoint, but it
  requires a valid token — mocked for the same reason. The final confirmation
  of the withdrawal remains a known gap, documented and not masked.
- **CPF/KYC**: synthetic CPFs with valid check digits, and the Receita Federal
  lookup mocked with the same JWT structure as the API contract.
- **Not mocked**: login with invalid credentials runs against the real backend.

## What is covered

### E2E — `tests/e2e/`

The **same specs** run on the 3 desktop browsers and the 2 mobile devices. The
site is responsive (same code base, no native app), so there is no duplicated
mobile suite: each project in `playwright.config.ts` only defines the device
and the session file.

| Spec | Scenarios |
|---|---|
| `cadastro.spec.ts` | Successful sign-up, CPF already registered, underage user, empty fields |
| `cadastro-login.spec.ts` | Integration: sign-up followed by login with the same user |
| `login.spec.ts` | Login blocked with invalid credentials (real backend, no mock) |
| `deposito.spec.ts` | Successful PIX deposit, amount below the minimum, empty amount |
| `saque.spec.ts` | Bank account registration, amount below the minimum, insufficient balance, empty fields |

### Pure API (no browser) — `tests/api/`

| Spec | Service | Tags |
|---|---|---|
| `login.api.spec.ts` | player-api — auth | `@smoke-preprod` |
| `cadastro.api.spec.ts` | backoffice-api — sign-up/CPF | `@smoke-preprod` |
| `saldo.api.spec.ts` | player-api — balance | `@smoke-preprod` `@prod-readonly` |
| `casino.api.spec.ts` | player-api — casino | `@smoke-preprod` `@prod-readonly` |
| `saque.api.spec.ts` | backoffice-api — bank accounts | `@smoke-preprod` |
| `webhooks-pix.api.spec.ts` | payment-gateway — `test.skip()`, not reproducible in the environment | `@integration-only-prod` |

### Unit — `tests/unit/`

CPF generator and validator (200 generated CPFs validated, invalid cases),
uniqueness of generated e-mails, sign-up test data and regex escaping.
They run without a browser and without network — they are the CI gate.

## Architecture

```
config/ambiente.ts        URLs and credentials (environment variables / .env)
pages/                    Page Objects — one per screen/modal
  BasePage.ts               clean navigation, overlays, visivel(), click/check/fill
  HeaderComponent.ts        header, used by composition in every page
  HomePage, CadastroPage, LoginPage, DepositoPage, SaquePage
services/                 Service Objects (API) — one per service
  BaseApiService.ts         headers, auth, report step, masked attachment
  PlayerApiService.ts, BackofficeApiService.ts
support/
  fixtures.ts               test.extend: ready-to-use pages, services and sessions
  fluxos.ts                 composed journeys (sign up, sign up + log in)
  relatorio.ts              passo(), registrarAviso(), tentarAte()
helpers/
  testData.ts               test data (Faker) and test credentials
  jwt.ts                    fake JWT in the format of the real response
  mocks/                    network mocks per domain + mockJson()
  fixtures/                 payment configuration (anonymized)
utils/                    pure functions (CPF, text)
tests/setup/              generates the storageState (desktop and mobile)
tests/e2e/                browser specs
tests/api/                pure API specs
tests/unit/               unit tests
docs/                     investigation of mocks, endpoints and environment drift
```

### How a run works

```
setup         (Desktop Chrome) ─► sessao-desktop.json ─► chromium · firefox · webkit
setup-mobile  (Pixel 5)        ─► sessao-mobile.json  ─► Mobile Chrome · Mobile Safari
api · unit                     independent, no browser and no setup
```

Each setup goes through the visual sign-up + login journey **only once** on
its device and saves the session in `playwright/.auth/`.

Tests that only need to *be* logged in (deposit, withdrawal) reuse the
`storageState` instead of repeating the sign-up + login journey. Sign-up and
login are still covered end to end in their own specs, which start with an
empty session.

### What a spec looks like

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

The `sessaoComPix` fixture already opens the authenticated home page with the
session, payment configuration and PIX mocks; `depositoPage` arrives
instantiated. The spec describes only the behavior.

## Technical decisions

- **Page Objects without business assertions.** Pages expose `readonly`
  locators and actions; business-rule `expect`s live in the spec. Locators
  prefer `getByRole`/`getByLabel`/`getByPlaceholder`.
- **Visibility filter instead of `.first()`.** The modals render two copies of
  the fields (mobile and desktop, toggled via CSS). `BasePage.visivel()`
  selects the instance that is actually visible, which makes the same Page
  Objects work on both viewports.
- **Clicks with real checks.** Every action goes through Playwright's
  actionability checks (visible, stable, receives events). Only when the sole
  obstacle is an element that never stabilizes (continuous animation on
  WebKit) does the action fall back to `force: true` — and that is recorded in
  the report. An element covered by an overlay is still a failure: a real user
  would not be able to click it either.
- **Instability made visible, not absorbed.** Internal retries (`tentarAte`),
  forced clicks and the verification gate closed via reload become warning
  *annotations* in the report. Locally there are no test retries — a flaky
  test fails immediately.
- **Readable report.** Every business action is a named `test.step` ("Abrir
  modal de saque" — open withdrawal modal, "Selecionar primeira conta bancária
  cadastrada" — select first registered bank account). For APIs, each call
  becomes a step with the request/response attached.
- **Typed API responses.** Service Objects return a typed
  `{ status, body, texto }`; `corpoJson()` fails with a clear message
  (status + body excerpt) when the response is not JSON.
- **Third-party noise blocked.** Analytics, ads, chat and images are aborted
  before navigation, so page loading depends only on the site under test. The
  blocking uses `route.fallback()`, preserving the specific mocks.
- **Deterministic data where it matters.** The mocked session uses fixed data
  (the setup and the workers must see the same user); sign-ups use Faker with
  e-mails that are unique across parallel workers.

## Configuration

All environment configuration lives in [`config/ambiente.ts`](config/ambiente.ts)
and comes from environment variables — a `.env` file at the root (template in
[`.env.example`](.env.example), never committed) or CI variables.

| Variable | Purpose |
|---|---|
| `BASE_URL` | Site URL (E2E) |
| `PLAYER_API_URL` | Player API (auth, balance, casino) |
| `BACKOFFICE_API_URL` | Sign-up and bank accounts API |
| `QA_SENHA_PADRAO` | Synthetic password used in the mocked flows |

Without a `.env`, the demo environment defaults apply.

## How to run

Prerequisite: **Node.js 20.12+** (the `.env` is loaded with `process.loadEnvFile`).

```bash
npm install
npx playwright install        # browsers (not needed for api/unit)
cp .env.example .env          # optional

npm run typecheck             # type checking
npm run test:unit             # unit tests (no browser, no network)

# Against the environment:
npm test                      # everything (setup + desktop/mobile e2e + api + unit)
npm run test:e2e              # e2e on the 3 desktop browsers
npm run test:mobile           # e2e on the 2 mobile devices
npm run test:api              # pure API
npm run test:smoke            # API tagged @smoke-preprod
npm run test:happy            # happy paths only (@happyPath)
npm run test:report           # opens the latest HTML report

npx playwright test --project=webkit --grep @saque   # any combination
```

**Tags** (Playwright's official `tag` API, filterable with `--grep`):

| Tag | Meaning |
|---|---|
| `@happyPath` | Happy path of each feature |
| `@cadastro` `@login` `@deposito` `@saque` | Feature (sign-up, login, deposit, withdrawal) |
| `@smoke-preprod` | Fast API feedback on pre-prod |
| `@prod-readonly` | Safe to run in production (no side effects) |
| `@integration-only-prod` | Not reproducible on pre-prod — documented |
| `@unit` | Unit tests |

**Execution**: retries only in CI (2×, with the test marked as *flaky*);
evidence only on failure (trace, screenshot and video); `list` + HTML
reporters, where the HTML report opens locally only when something fails and
never opens automatically in CI.

### CI — [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

- **Every push/PR**: `typecheck` + unit tests.
- **Manual (`workflow_dispatch`)**: choose the suite (api, e2e, mobile or
  full) to run against the environment, with URLs in repository `vars` and the
  password in repository `secrets`. The HTML report is kept as a job artifact.

## Stack

- [Playwright Test](https://playwright.dev/) — execution, fixtures, network mocks, HTML reporter
- TypeScript (`strict`) — `tsc --noEmit` as a CI gate
- [Faker.js](https://fakerjs.dev/) — synthetic data (names, e-mails, phone numbers)
- GitHub Actions — CI

## Known limitations

- No real sign-up/login happens end to end — it relies on documented mocks
  (see `docs/MOCKS.md`).
- The final confirmation of a successful withdrawal is not covered — the
  balance used by the modal's validation is not fed by any endpoint that can be
  mocked in isolation (`docs/MOCKS.md`, section 8.5).
- The PIX confirmation webhook cannot be reproduced at this layer — kept as a
  skeleton for an environment that allows simulating the provider.
- Pre-prod behavior may change without notice — API failures should be
  investigated as a possible contract change before assuming a test bug
  (see `docs/API-TESTES.md`).
- On mobile WebKit, the click that opens the "Sacar" (withdraw) menu may fail
  intermittently while the menu is still transitioning — opening is retried
  (`SaquePage.abrir`) and each retry is recorded in the report.

## Next steps

- Use a real test account (or a test mode for the CPF token) to unlock the
  successful end-to-end flows without mocks.
- Cover the final withdrawal confirmation once the real source of the modal's
  balance is identified.
- Ask the front-end team for `data-testid` on the fields of the new bank
  account modal, which have no accessible label/placeholder and currently rely
  on attribute selectors (`input[readonly]`, `input[inputmode="numeric"]`).
