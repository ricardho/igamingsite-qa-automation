import type { Page } from '@playwright/test';
import { mockJson } from './http.js';

/**
 * O POST real de /api/clientes/cadastro rejeita com 500 genérico ("Ocorreu um problema
 * inesperado, tente novamente.") qualquer token forjado no campo dadosCriptografados —
 * o backend só aceita tokens assinados pelo próprio serviço de validação de CPF, que
 * não conseguimos emitir de fora. Por decisão conjunta, mockamos esse POST
 * inteiro nos cenários que dependem de cadastro (ver docs/MOCKS.md para o histórico
 * completo da investigação).
 */
const ROTA_CADASTRO = '**/api/clientes/cadastro';

export async function mockCadastroComSucesso(page: Page): Promise<void> {
  await mockJson(page, ROTA_CADASTRO, { success: true, message: 'Cadastro realizado com sucesso' }, 201);
}

export async function mockCadastroComErro(
  page: Page,
  { status = 422, message }: { status?: number; message: string }
): Promise<void> {
  await mockJson(page, ROTA_CADASTRO, { success: false, message }, status);
}
