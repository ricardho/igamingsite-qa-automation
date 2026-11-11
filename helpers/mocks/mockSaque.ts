import type { Page } from '@playwright/test';
import { mockJson } from './http.js';

/** Conta bancária usada tanto no mock de listagem quanto no de cadastro. */
export const CONTA_BANCARIA_MOCK = {
  bank: 128,
  bankName: 'NU PAGAMENTOS S.A.',
  agencyNumber: '0001',
  accountNumber: '1234567',
  accountType: 'corrente',
} as const;

/**
 * Pré-popula a lista de contas bancárias do usuário. Precisa ser registrado
 * DEPOIS de mockSessaoAutenticada (que também mocka essa rota, vazia) e ANTES
 * da navegação de login — o front-end busca essa lista uma única vez durante
 * o carregamento pós-login e mantém em cache; registrar o mock depois disso
 * não tem efeito (ver docs/MOCKS.md seção 8).
 */
export async function mockContaBancariaExistente(page: Page): Promise<void> {
  await mockJson(page, '**/api/clientes/allBankAccounts**', {
    success: true,
    results: [{ id: 555, ...CONTA_BANCARIA_MOCK }],
  });
}

/**
 * Endpoint real de cadastro de conta bancária, confirmado via captura direta
 * de rede em pre-prod: `POST /api/clientes/registerBankAccount` com body
 * `{ bank, agencyNumber, accountNumber, accountType }`. Com o token de sessão
 * mockado, o backend real rejeita com 401 — mockamos a resposta de sucesso.
 */
export async function mockRegistrarContaComSucesso(page: Page): Promise<void> {
  const { bankName: _nomeBanco, ...conta } = CONTA_BANCARIA_MOCK;
  await mockJson(page, '**/api/clientes/registerBankAccount', { success: true, results: { id: 556, ...conta } }, 201);
}
