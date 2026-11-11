import type { Page } from '@playwright/test';
import { construirJwtFake, type DadosPessoa } from '../jwt.js';
import { mockJson } from './http.js';

async function mockVerifyExists(page: Page, { alreadyExists = false } = {}): Promise<void> {
  await mockJson(page, '**/api/clientes/verify-exists**', { success: true, results: { alreadyExists } });
}

async function mockConsultarCpf(
  page: Page,
  { nome, nascimento, genero, menorDeIdade = false }: DadosPessoa & { menorDeIdade?: boolean }
): Promise<void> {
  await mockJson(page, '**/api/clientes/consultar-cpf**', {
    success: true,
    results: {
      validarCpfAtivado: true,
      nome,
      menorDeIdade,
      genero,
      dados: construirJwtFake({ nascimento, nome, genero }),
    },
    pagination: null,
  });
}

/** Mock do caminho feliz: CPF válido, maior de idade, ainda não cadastrado. */
export async function mockConsultaCpfSucesso(page: Page, dados: DadosPessoa): Promise<void> {
  await mockVerifyExists(page, { alreadyExists: false });
  await mockConsultarCpf(page, { ...dados, menorDeIdade: false });
}

/**
 * NOTA: mapeamos que a versão atual do front-end não chama verify-exists antes do
 * submit — o bloqueio de "CPF já cadastrado" hoje é observado como erro do
 * POST /api/clientes/cadastro (ver mockCadastroComErro em mockCadastroApi.ts).
 * Mantemos este mock por conformidade com o contrato de API documentado e para o
 * dia em que o front-end passar a consultar essa rota antes do submit.
 */
export async function mockCpfJaCadastrado(page: Page): Promise<void> {
  await mockVerifyExists(page, { alreadyExists: true });
}

export async function mockCpfMenorDeIdade(page: Page, dados: DadosPessoa): Promise<void> {
  await mockVerifyExists(page, { alreadyExists: false });
  await mockConsultarCpf(page, { ...dados, menorDeIdade: true });
}

/** Simula falha da Receita Federal ao validar o CPF (contrato fornecido, sem teste dedicado ainda). */
export async function mockErroValidacaoReceita(page: Page): Promise<void> {
  await mockJson(
    page,
    '**/api/clientes/consultar-cpf**',
    { success: false, message: 'CPF deu erro ao validar na receita federal' },
    422
  );
}
