# Mocks de rede — Cadastro, Login e Depósito (pre-prod)

Este documento resume o que é mockado nos testes, por quê, e o que foi
descoberto investigando o ambiente de pre-prod (`https://pre-prod.igamingsite.com`).

## Contexto

Os testes de cadastro precisam de um CPF válido para passar da validação de
KYC, mas não temos CPFs reais de terceiros para usar. A ideia original era
mockar só as duas chamadas que consultam a Receita Federal. Na prática,
descobrimos que isso não é suficiente — o restante deste documento explica
por quê.

## 1. Validação de CPF — `helpers/mocks/mockCpfValidation.js`

| Rota | Mock | Observação |
|---|---|---|
| `GET /api/clientes/verify-exists?doc_number={cpf}` | `{ success: true, results: { alreadyExists } }` | **Não é chamada pela versão atual do front-end** durante o preenchimento do cadastro (confirmado navegando o fluxo). Mantido mesmo assim, por conformidade com o contrato de API e para quando o front-end passar a usá-la. |
| `GET /api/clientes/consultar-cpf?cpf={cpf}` | `{ success: true, results: { validarCpfAtivado, nome, menorDeIdade, genero, dados } }` | Essa é a chamada que **realmente** dispara ao preencher o CPF (debounce). O front-end troca o campo CPF pelo nome retornado. `dados` é um JWT (`header.payload.signature`) com os claims `nascimento`, `nome` e `genero` — o mock gera um token com essa estrutura e assinatura aleatória (`helpers/jwt.ts`). |

Cenário de erro de validação na Receita (`422`, `"CPF deu erro ao validar na
receita federal"`) também está implementado em `mockErroValidacaoReceita`,
mas sem teste dedicado — não fazia parte do escopo de cobertura combinado.

## 2. Achado crítico: o POST de cadastro rejeita o token forjado

`POST https://backoffice.pre-prod.igamingsite.com/api/clientes/cadastro` (a
criação de conta de verdade) **retorna 500** — `"Ocorreu um problema
inesperado, tente novamente."` — sempre que o campo `dadosCriptografados`
contém um token forjado, mesmo com a estrutura de claims correta. O backend
só aceita tokens assinados pelo próprio serviço de validação de CPF — e esse
token não pode ser emitido de fora do ambiente.

**Decisão tomada:** mockar também esse POST (`helpers/mockCadastroApi.js`),
para os cenários que dependem de cadastro bem-sucedido ou de um erro
específico do backend:

- `mockCadastroComSucesso` → `201` + `{ success: true, message: "Cadastro realizado com sucesso" }` (`helpers/mocks/mockCadastroApi.js`)
- `mockCadastroComErro(page, { status, message })` → usado para simular
  "CPF já cadastrado" (mensagem confirmada aparecendo inline no dialog) e
  "menor de idade" (mensagem **inferida**, já que o front-end não bloqueia
  isso no client-side — o bloqueio observável é sempre um erro do POST).

Consequência prática: o usuário criado nesses testes **não é persistido de
verdade** no backend do pre-prod (diferente do que estava previsto
originalmente).

## 3. Login e sessão — `helpers/mockSessao.js`

Como a conta não é real, o login que vem depois de um cadastro mockado
também precisa ser mockado — senão falha com "Usuário ou senha incorretos"
(a conta genuinamente não existe no banco).

Mockar só `POST /auth/login` não é suficiente: o front-end, logo após o
login, chama em sequência:

- `POST /auth/refresh`
- `GET /api/clientes/getCliente/:id`
- `GET /financial/position` (saldo)
- `GET /api/clientes/allBankAccounts`

Com um token fake, o backend real rejeita essas chamadas (401/500) e o
próprio app **desloga automaticamente** (dispara `POST /auth/logout`),
voltando ao estado de visitante. `getCliente` é especificamente o que
dispara o "Sessão expirada" que causa o logout — por isso os cinco
endpoints acima são mockados juntos em `mockSessaoAutenticada`.

A resposta de sucesso do login segue o contrato da API (`{ success, results:
{ token, tokenCassino, refreshToken, user: {...} } }`).

## 4. O que NÃO é mockado

- `tests/e2e/login.spec.ts` (credenciais inválidas) roda contra o backend real —
  não depende de nenhuma conta existir, então não precisa de mock.
- A mensagem de erro real da API (`"Usuário ou Senha inválido."`) é
  diferente da exibida na UI (`"Usuário ou senha incorretos"`) — os testes
  verificam o texto da UI.

## 5. Indicador de sessão autenticada

Sem estar logado, o header só mostra os botões **"Registre-se"** e
**"Entrar"**. Autenticado, esses somem e aparece o botão **"Depositar"** —
esse é o sinal usado pelos testes (`HeaderComponent.botaoDepositar`) para
confirmar que a sessão está de fato ativa.

## 6. Depósito via PIX — `helpers/mockDeposito.js`

Assim como o cadastro, gerar um PIX de verdade não é possível em pre-prod —
mas por um motivo diferente: **o ambiente desabilita deliberadamente a
geração real de PIX**, não é um bug. Confirmado assim:

- `GET .../config/parametros-site.json` (config de métodos de pagamento,
  servida por um storage estático) retorna **403** em pre-prod para qualquer
  requisição — testado até fora do navegador (`curl`/PowerShell direto), então
  não é algo causado pelo nosso teste.

**Decisão tomada:** mockar essa configuração com uma **config mínima** (só os
campos que o fluxo de depósito usa, em `helpers/fixtures/parametrosSite.json`),
e mockar também os dois endpoints de PIX que dependem dela:

| Rota | Mock | Observação |
|---|---|---|
| `GET /api/clientes/configs` | `{ success: true, results: {} }` | Sem isso, causa a mesma cascata de "sessão expirada" → logout automático que já resolvemos para login. |
| `GET .../config/parametros-site.json` | `helpers/fixtures/parametrosSite.json` | Contém `payment_methods.alphapay.enabled: true` e `valor_min_deposito_cliente: 10` — esse último bate exatamente com a mensagem "O valor mínimo é de R$ 10,00." que a UI mostra, boa validação cruzada. |
| `POST /api/financeiro/processar-pagamento` | `{ qr_code, pagamento_id, status: "pending", ... }` com payload PIX fictício | Endpoint que efetivamente gera o PIX. Com token fake, o backend rejeita com 401 — mockado seguindo o contrato de resposta da API. |
| `GET /api/financeiro/verificar-pagamento?pagamento_id=...` | `{ deposito_status: "pending", ... }` | Endpoint de polling de status que o front-end chama logo após gerar o PIX. |

Fluxos de exceção (valor abaixo do mínimo, campo vazio) são validações
**puramente client-side** — não dependem de nenhum desses mocks, funcionam
igual com ou sem o ambiente de pagamento mockado.

## 7. Drift do ambiente (pre-prod = dev, não staging)

Pre-prod é usado pelos devs como ambiente de desenvolvimento — não tem
controle de PR/versionamento — então o comportamento do site muda entre
sessões de teste, sem aviso. Dois achados concretos durante este trabalho:

### 7.1 Novo gate de "Verificação da conta"

Em algum momento entre sessões, o front-end passou a mostrar um modal
**"Verificação da conta"** (identidade + e-mail, sem botão de fechar) logo
após o cadastro **e** logo após o login. Investigação:

- Depois do **cadastro**, o modal é puramente uma reação efêmera do
  client-side ao sucesso do cadastro (não depende de dado do servidor) — um
  `page.reload()` descarta esse estado.
- Depois do **login**, o modal reaparece pelo campo `verifiedIdentity` do
  usuário retornado por `auth/login`/`getCliente`/`auth/refresh` — se
  `false`, o gate aparece sempre, e nem reload resolve (o dado persiste na
  sessão). **Corrigido** setando `verifiedIdentity: true` no mock de sessão
  (`helpers/mocks/mockSessao.js`) — o campo já existia no mock, só estava
  `false` por herança de antes desse recurso existir no site.
- O modal usa `role="dialog"` mas **não** é um Radix Dialog como os nossos
  (cadastro/login/depósito) — não tem `data-slot="dialog-content"`. Os Page
  Objects agora usam um seletor mais específico
  (`SELETOR_DIALOG_APP` em `pages/BasePage.js`) que exclui esse modal
  explicitamente, e também exclui instâncias com `aria-hidden="true"` (o
  Radix mantém a versão antiga do dialog no DOM por um instante, saindo,
  quando o conteúdo muda de tela — ex.: cadastro → sucesso).
- `BasePage.fecharGateDeVerificacaoSeAberto()` ainda existe e é chamado após
  o cadastro (útil, cobre o caso efêmero); não é mais chamado após o login
  (deixou de ser necessário com o `verifiedIdentity: true`, e chamá-lo lá só
  adicionava uma espera de 5s à toa).
- `BasePage.acessar()` agora só zera `localStorage`/`sessionStorage` na
  **primeira** carga (marcador via cookie) — antes zerava em toda navegação,
  o que apagaria o token de login se precisássemos dar reload depois de
  logado.

### 7.2 Endpoints de CPF — nomes corrigidos

Durante uma investigação de API pura (`request`, sem mock), descobrimos que
o nome de rota que estávamos mockando desde o início (`verify-exists`) nunca
existiu de verdade:

| Rota testada diretamente | Resultado |
|---|---|
| `GET backoffice.../api/clientes/verify-exists?doc_number=X` | **404** — nunca existiu. Era uma suposição do prompt original; inofensiva de mockar porque o front-end nunca chamou mesmo. |
| `GET backoffice.../api/clientes/cpf-cadastrado?cpf=X` | **200**, `{"success":true,"results":{"alreadyExists":false}}` — esse é o endpoint correto (confere com a documentação da API). |

O fluxo atual de cadastro chama `consultar-cpf` (não chama `cpf-cadastrado`)
— mais uma confirmação de que o comportamento real diverge do que qualquer
documento possa afirmar sem validação direta.

## 8. Saque — `helpers/mocks/mockSaque.ts`

O saque não tem botão próprio no header — abre pelo dropdown do saldo/avatar
(clicar no botão com "R$..." → botão "Sacar"). O modal "Concluir Saque" tem:
saldo, select de conta bancária (contas já cadastradas + "+ Adicionar nova
conta") e valor do pagamento.

### 8.1 Campo de valor usa máscara de centavos

Diferente do campo de valor do depósito, o campo de saque não aceita
`fill()` — o mask ignora o evento e o estado interno do formulário fica
desatualizado (confirmado: `fill('100')` resultava em "Informe o valor do
saque." ao submeter, como se nada tivesse sido digitado). É necessário usar
`pressSequentially`, que dispara eventos de teclado reais, e os dígitos são
interpretados como **centavos** da direita para a esquerda — digitar
`"10000"` resulta em "R$ 100,00". Implementado em
`SaquePage.preencherValorEmReais()`.

### 8.2 Cadastro de nova conta bancária — endpoint real confirmado

Ao escolher "+ Adicionar nova conta", abre um segundo modal ("Nova conta",
empilhado sobre o de saque) com: Número do banco (busca, não select nativo —
nomes oficiais na FEBRABAN divergem do nome popular dos bancos), Agência, Número da conta e Tipo de conta (Conta
corrente/Conta poupança).

Confirmado via captura direta de rede em pre-prod:

| Rota | Body real | Observação |
|---|---|---|
| `POST /api/clientes/registerBankAccount` | `{ bank, agencyNumber, accountNumber, accountType }` | Com token de sessão mockado, o backend real rejeita com **401** (mesma limitação de sempre — não é endpoint desabilitado). Mockado com sucesso (`mockRegistrarContaComSucesso`) para o fluxo principal. |

### 8.3 Lista de contas bancárias é buscada uma única vez

`GET /api/clientes/allBankAccounts` é buscado uma única vez durante o
carregamento pós-login e fica em cache no front-end — sobrescrever esse mock
**depois** de `mockSessaoAutenticada`/login não tem efeito nenhum (o
front-end já renderizou com a resposta anterior). Por isso
`mockContaBancariaExistente` precisa ser chamado **depois** de
`mockSessaoAutenticada` mas **antes** da navegação de login, exatamente como
`mockAmbienteDeConfiguracao`/`mockDepositoPixComSucesso` já fazem em
`sessaoComPix` — daí a fixture
`sessaoComContaBancaria` em vez de reaproveitar `sessaoComPix`.

Depois de selecionar uma conta no dropdown, é preciso esperar a lista de
opções desaparecer antes de interagir com o próximo campo — o portal do
Radix Select às vezes fica no DOM e intercepta cliques (`subtree intercepts
pointer events`), mesmo com a conta já selecionada.

### 8.4 O botão "Verifique para sacar" nunca fica `disabled`

Diferente do botão de depósito, o de saque **não tem o atributo HTML
`disabled`** em nenhum momento — ele é sempre clicável. A validação (conta
selecionada, valor mínimo, saldo) acontece só depois do clique, e o
resultado é uma mensagem inline. Os testes de exceção clicam em "Verifique
para sacar" e verificam a mensagem, em vez de checar um estado desabilitado
que não existe no DOM.

Mensagens confirmadas ao vivo contra pre-prod:

| Cenário | Mensagem |
|---|---|
| Valor abaixo do mínimo | `"Saque mínimo de R$ 30,00"` |
| Saldo insuficiente | `"Saldo insuficiente para realizar o saque."` |

### 8.5 Confirmação final do saque — não coberta

O saldo exibido no modal de saque vem do mock de sessão (`getCliente`), não
de `financial/position` — sobrescrever `financial/position` com um saldo
maior não teve efeito nenhum na validação. Como o saldo mockado da sessão é
sempre `R$ 0,00`, qualquer valor de saque acima do mínimo cai no bloqueio de
"saldo insuficiente" antes de chegar num eventual endpoint de confirmação
real — que por isso **não foi identificado nesta sessão**. Para cobrir o
fluxo de saque bem-sucedido de ponta a ponta no futuro, seria necessário
mockar também o campo `balance` retornado por `getCliente` (em
`mockSessaoAutenticada`) com um valor suficiente, de forma isolada para os
testes de saque (sem afetar os demais, que dependem de saldo zerado).

## Caminho para tornar isso 100% real no futuro

- **Cadastro:** se o time de backend disponibilizar um jeito de emitir o
  token de CPF assinado em pre-prod (ou um modo de teste que o dispense), o
  cadastro volta a ser real de ponta a ponta, e os mocks de `mockCadastroApi.js` e `mockSessao.js` deixam
  de ser necessários.
- **Depósito:** se o ambiente de pre-prod passar a permitir geração real de
  PIX (arquivo de config acessível), os mocks de
  `mockAmbienteDeConfiguracao` e `mockDepositoPixComSucesso` também deixam de
  ser necessários — o fluxo real já funciona, só estava desabilitado no
  ambiente.
- **Saque:** se alguém do time de backend confirmar como emitir um token de
  sessão válido para uma conta de teste (ou disponibilizar uma conta com
  saldo real em pre-prod), o cadastro de conta bancária passa a não precisar
  de `mockRegistrarContaComSucesso`, e vira possível descobrir e cobrir o
  endpoint real de confirmação do saque — hoje bloqueado antes mesmo de ser
  alcançado, pelo saldo mockado sempre zerado (ver seção 8.5).
