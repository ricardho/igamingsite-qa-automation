import { faker } from '@faker-js/faker';

function calcularDigitoVerificador(base: number[]): number {
  let soma = 0;
  let peso = base.length + 1;
  for (const n of base) soma += n * peso--;
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * CPF sintético com dígitos verificadores válidos (módulo 11). O backend real
 * de KYC não reconhece esse CPF como pertencente a uma pessoa real, então o uso
 * em cadastro depende de mockar a validação (ver helpers/mocks/mockCpfValidation.ts).
 */
export function gerarCpfValido(): string {
  const numeros = Array.from({ length: 9 }, () => faker.number.int({ min: 0, max: 9 }));
  const d1 = calcularDigitoVerificador(numeros);
  const d2 = calcularDigitoVerificador([...numeros, d1]);
  const digitos = [...numeros, d1, d2].join('');
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** Valida os dígitos verificadores de um CPF (aceita com ou sem máscara). */
export function cpfEhValido(cpf: string): boolean {
  const digitos = (cpf || '').replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const numeros = digitos.slice(0, 9).split('').map(Number);
  const d1 = calcularDigitoVerificador(numeros);
  const d2 = calcularDigitoVerificador([...numeros, d1]);
  return digitos === `${numeros.join('')}${d1}${d2}`;
}
