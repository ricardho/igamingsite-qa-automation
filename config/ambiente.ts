import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Configuração de ambiente centralizada — único lugar da suíte que conhece URLs
 * e credenciais. Os valores vêm de variáveis de ambiente (arquivo `.env` na raiz,
 * ver `.env.example`, ou variáveis do próprio CI). Os defaults apontam para o
 * ambiente de demonstração e existem só para o projeto subir sem configuração.
 */
const ARQUIVO_ENV = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(ARQUIVO_ENV)) process.loadEnvFile(ARQUIVO_ENV);

function variavel(nome: string, padrao: string): string {
  const valor = process.env[nome]?.trim();
  return valor ? valor : padrao;
}

export const AMBIENTE = {
  baseUrl: variavel('BASE_URL', 'https://pre-prod.igamingsite.com/'),
  playerApiUrl: variavel('PLAYER_API_URL', 'https://player-api.pre-prod.igamingsite.com'),
  backofficeApiUrl: variavel('BACKOFFICE_API_URL', 'https://backoffice.pre-prod.igamingsite.com'),
  /**
   * Senha sintética usada apenas nos fluxos mockados (nenhuma conta real usa
   * essa senha). Credenciais reais, se um dia existirem, devem vir só do `.env`.
   */
  senhaQa: variavel('QA_SENHA_PADRAO', 'QaTeste@123'),
} as const;

/**
 * Arquivos de storageState gerados pelos projects de setup (ver
 * playwright.config.ts). Desktop e mobile têm arquivos próprios: o header
 * mobile só reconhece uma sessão criada por uma jornada visual em viewport
 * mobile (ver README, seção "Mobile").
 */
export const ARQUIVOS_SESSAO = {
  desktop: 'playwright/.auth/sessao-desktop.json',
  mobile: 'playwright/.auth/sessao-mobile.json',
} as const;

/** storageState vazio — para specs que precisam começar deslogados (cadastro/login). */
export const SEM_SESSAO = { cookies: [], origins: [] };
