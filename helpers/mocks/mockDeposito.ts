import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { mockJson, responderJson } from './http.js';

const parametrosSite: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/parametrosSite.json', import.meta.url)), 'utf-8')
);

const ID_PAGAMENTO_MOCK = 'f7e33cc8-fa90-41dd-ab28-997b8e1e5738';

/** Payload PIX "copia e cola" fictício (formato EMV válido, CRC16 correto, recebedor inexistente). */
const QR_CODE_PIX_FICTICIO =
  '00020101021226780014br.gov.bcb.pix2556pix.alphapay.example/v2/7f3a9c1e2b4d4e8fa6c05d9b1e2f3a4c5204000053039865802BR5916iGamingSite Ltda6009Sao Paulo62070503***6304298C';

/**
 * No ambiente de pre-prod, `GET .../config/parametros-site.json` (config de métodos
 * de pagamento, servida por um storage estático) retorna 403 para qualquer
 * requisição — confirmado até fora do navegador, então não é um problema do nosso
 * mock, é uma limitação do ambiente. Sem essa config, o app não sabe qual gateway
 * PIX usar e a UI mostra "Não foi possível carregar os métodos de pagamento". Aqui
 * servimos uma config mínima (helpers/fixtures/parametrosSite.json) para simular o
 * ambiente funcionando. Ver docs/MOCKS.md.
 */
export async function mockAmbienteDeConfiguracao(page: Page): Promise<void> {
  await mockJson(page, '**/api/clientes/configs**', { success: true, results: {} });
  await mockJson(page, '**/config/parametros-site.json**', parametrosSite);
}

/**
 * Mocka o endpoint de geração de PIX (`POST /api/financeiro/processar-pagamento`) e
 * o de checagem de status (`GET /api/financeiro/verificar-pagamento`), seguindo o
 * contrato de resposta da API — pre-prod também não permite gerar um PIX de verdade
 * (nem com a config acima mockada — o gateway em si está desabilitado nesse
 * ambiente).
 */
export async function mockDepositoPixComSucesso(
  page: Page,
  { nomeCliente = 'QA Automation' }: { nomeCliente?: string } = {}
): Promise<void> {
  await page.route('**/api/financeiro/processar-pagamento', (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as { valor?: unknown };
    return responderJson(route, {
      success: true,
      results: {
        error: false,
        metodo: 'pix',
        pagamento_id: ID_PAGAMENTO_MOCK,
        titular: 'IGAMINGSITE',
        valor: payload.valor,
        status: 'pending',
        detalhes_status: 'Pendente',
        validade: 86400,
        qr_code: QR_CODE_PIX_FICTICIO,
        qr_code_base64: '',
        selected_payment_method: 'alphapay',
        cliente: nomeCliente,
      },
      pagination: null,
    });
  });

  await mockJson(page, '**/api/financeiro/verificar-pagamento**', {
    success: true,
    results: {
      error: false,
      deposito_primeiro: false,
      deposito_status: 'pending',
      deposito_valor: 0,
      deposito_id: ID_PAGAMENTO_MOCK,
      pessoa_nome: nomeCliente,
      pessoa_sobrenome: '',
      pessoa_telefone: '',
      pessoa_email: '',
    },
    pagination: null,
  });
}
