import { faker } from '@faker-js/faker';
import { AMBIENTE } from '../config/ambiente.js';
import { gerarCpfValido } from '../utils/cpfGenerator.js';

/** Formato compartilhado por toda a suíte (mocks, Page Objects, Services). */
export interface DadosCadastro {
  cpf: string;
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  nascimento: string;
  genero: string;
}

/** Credenciais que não existem em nenhum ambiente — usadas nos cenários de login inválido (Web e API). */
export const CREDENCIAIS_INVALIDAS = {
  login: 'qa.automation.naoexiste@teste.com',
  senha: 'SenhaErrada@123',
} as const;

export function gerarNomeCompleto(): string {
  return `QA Automation ${faker.person.firstName()}`;
}

/**
 * E-mail único por chamada. Um sufixo aleatório (em vez de `Date.now()`) evita
 * colisão entre workers paralelos que gerem dados no mesmo milissegundo.
 */
export function gerarEmail(): string {
  return `qa.automation.${faker.string.alphanumeric({ length: 12, casing: 'lower' })}@teste.com`;
}

export function gerarTelefone(): string {
  const numero = faker.string.numeric(8);
  return `+55 11 9${numero.slice(0, 4)}-${numero.slice(4)}`;
}

/** Data de nascimento de um adulto (18-65 anos), no formato esperado pelo JWT de consultar-cpf. */
export function gerarDataNascimentoAdulto(): string {
  return faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().slice(0, 10);
}

/** Massa de dados completa para um cadastro de teste. */
export function gerarDadosCadastro(): DadosCadastro {
  return {
    cpf: gerarCpfValido(),
    nome: gerarNomeCompleto(),
    email: gerarEmail(),
    telefone: gerarTelefone(),
    senha: AMBIENTE.senhaQa,
    nascimento: gerarDataNascimentoAdulto(),
    genero: 'Masculino',
  };
}

/**
 * Dados FIXOS da sessão mockada reaproveitável (ver tests/setup/sessao.setup.ts
 * e support/fixtures.ts). Precisam ser determinísticos: o setup grava o
 * storageState com esses dados em um processo e os testes os reutilizam em
 * outros workers — um valor gerado na carga do módulo (ex.: CPF aleatório)
 * seria diferente em cada processo. O CPF abaixo é sintético, com dígitos
 * verificadores válidos.
 */
export const DADOS_SESSAO_MOCKADA: DadosCadastro = {
  cpf: '529.982.247-25',
  nome: 'QA Automation Sessao',
  email: 'qa.automation.sessao@teste.com',
  telefone: '+55 11 91234-5678',
  senha: AMBIENTE.senhaQa,
  nascimento: '1995-05-15',
  genero: 'Masculino',
};
