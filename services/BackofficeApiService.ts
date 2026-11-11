import type { APIRequestContext } from '@playwright/test';
import { AMBIENTE } from '../config/ambiente.js';
import { BaseApiService, type ResultadoChamada, type RespostaApi } from './BaseApiService.js';

export interface ContaBancaria {
  bank: number;
  agencyNumber: string;
  accountNumber: string;
  accountType: string;
}

/**
 * Service Object da API de operações financeiras/cadastro (backoffice-api-igamingsite).
 */
export class BackofficeApiService extends BaseApiService {
  constructor(request: APIRequestContext, baseURL: string = AMBIENTE.backofficeApiUrl) {
    super(request, baseURL);
  }

  /**
   * GET /api/clientes/cpf-cadastrado?cpf=X
   * NOTA: o nome usado em versões antigas deste projeto (`verify-exists`)
   * nunca existiu de verdade em pre-prod (404) — ver docs/MOCKS.md seção 7.2.
   */
  consultarCpfExistente(cpf: string): Promise<ResultadoChamada<RespostaApi<{ alreadyExists: boolean }>>> {
    return this.chamar('get', `/api/clientes/cpf-cadastrado?cpf=${encodeURIComponent(cpf)}`);
  }

  /** POST /api/clientes/cadastro — cria a conta (rota principal). */
  cadastro(dadosUsuario: Record<string, unknown>): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/api/clientes/cadastro', { data: dadosUsuario });
  }

  /** GET /api/clientes/allBankAccounts — lista as contas bancárias do cliente autenticado. */
  listarContasBancarias(token?: string): Promise<ResultadoChamada<RespostaApi<ContaBancaria[]>>> {
    return this.chamar('get', '/api/clientes/allBankAccounts', { token });
  }

  /** POST /api/clientes/registerBankAccount — cadastra uma conta bancária para saque. */
  registrarContaBancaria(dadosConta: ContaBancaria, token?: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/api/clientes/registerBankAccount', { data: dadosConta, token });
  }
}
