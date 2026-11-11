import { test, expect } from '@playwright/test';
import { cpfEhValido, gerarCpfValido } from '../../utils/cpfGenerator.js';
import { escaparRegex } from '../../utils/texto.js';
import { DADOS_SESSAO_MOCKADA, gerarDadosCadastro, gerarEmail } from '../../helpers/testData.js';

/**
 * Testes unitários dos utilitários da suíte — rodam sem browser e sem rede
 * (project "unit"), então são o gate que roda em todo push no CI.
 */
test.describe('Gerador de CPF', { tag: '@unit' }, () => {
  test('gera CPFs formatados e com dígitos verificadores válidos', () => {
    for (let i = 0; i < 200; i++) {
      const cpf = gerarCpfValido();
      expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
      expect(cpfEhValido(cpf), `CPF gerado inválido: ${cpf}`).toBe(true);
    }
  });

  test('aceita CPF válido com e sem máscara', () => {
    expect(cpfEhValido('529.982.247-25')).toBe(true);
    expect(cpfEhValido('52998224725')).toBe(true);
  });

  const invalidos = [
    { caso: 'com dígito verificador errado', cpf: '529.982.247-26' },
    { caso: 'com todos os dígitos iguais', cpf: '111.111.111-11' },
    { caso: 'com menos de 11 dígitos', cpf: '5299822472' },
    { caso: 'vazio', cpf: '' },
  ];
  for (const { caso, cpf } of invalidos) {
    test(`rejeita CPF ${caso}`, () => {
      expect(cpfEhValido(cpf)).toBe(false);
    });
  }
});

test.describe('Massa de dados', { tag: '@unit' }, () => {
  test('gera e-mails únicos mesmo em sequência rápida', () => {
    const emails = new Set(Array.from({ length: 500 }, gerarEmail));
    expect(emails.size).toBe(500);
  });

  test('gera cadastro completo com CPF válido', () => {
    const dados = gerarDadosCadastro();
    expect(cpfEhValido(dados.cpf)).toBe(true);
    expect(dados.email).toMatch(/^qa\.automation\.[a-z0-9]+@teste\.com$/);
    expect(dados.nascimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('sessão mockada é determinística e tem CPF válido', () => {
    expect(cpfEhValido(DADOS_SESSAO_MOCKADA.cpf)).toBe(true);
  });
});

test.describe('Utilitários de texto', { tag: '@unit' }, () => {
  test('escaparRegex trata caracteres especiais como literais', () => {
    const banco = 'BANCO S.A. (BRASIL)';
    expect(new RegExp(escaparRegex(banco)).test(banco)).toBe(true);
    expect(new RegExp(escaparRegex('S.A.')).test('SXAX')).toBe(false);
  });
});
