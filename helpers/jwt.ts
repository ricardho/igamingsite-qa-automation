import crypto from 'node:crypto';

export interface DadosPessoa {
  nome: string;
  nascimento: string;
  genero: string;
}

/**
 * Monta um JWT no mesmo formato do campo "dados" retornado por consultar-cpf
 * (header {typ,alg} + payload {nascimento,nome,genero}), mas com
 * assinatura aleatória. O front-end só lê o payload; o backend real rejeita a
 * assinatura (ver docs/MOCKS.md seção 2) — usado tanto pelo mock de CPF (Web)
 * quanto pelo teste de API que documenta esse bloqueio.
 */
export function construirJwtFake({ nascimento, nome, genero }: DadosPessoa): string {
  const base64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = base64url({ typ: 'JWT', alg: 'HS256' });
  const payload = base64url({ nascimento, nome, genero });
  const assinatura = crypto.randomBytes(32).toString('base64url');
  return `${header}.${payload}.${assinatura}`;
}
