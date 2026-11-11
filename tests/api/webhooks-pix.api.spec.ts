import { test } from '../../support/fixtures.js';

/**
 * Webhooks de PIX (payment-gateway-igamingsite) são chamados pelos
 * provedores (Tetra, AlphaPay, OneBank) diretamente — não são acionáveis pelo
 * cliente, e a geração real de PIX está desabilitada em pre-prod (ver
 * docs/MOCKS.md seção 6). Não reproduzível nem testável automaticamente
 * nesta camada; documentado aqui como esqueleto para quando/se houver um
 * ambiente que permita simular a chamada do provedor.
 *
 * Endpoints reais (contrato documentado, não implementado):
 *   POST /api/payment/tetra/webhook
 *   POST /api/payment/alphapay/webhook
 *   POST /api/payment/onebank/webhook
 */
test.describe('Webhooks PIX — API (payment-gateway-igamingsite)', { tag: '@integration-only-prod' }, () => {
  test.skip('Confirmação de depósito via webhook do provedor PIX', () => {
    // Não implementado: ver nota acima. Verificação apenas via logs/observabilidade.
  });
});
