import type { APIRequestContext } from '@playwright/test';
import { AMBIENTE } from '../config/ambiente.js';
import { BaseApiService, type ResultadoChamada, type RespostaApi } from './BaseApiService.js';

export interface ListaJogosCassino {
  gameList: unknown[];
}

/**
 * Service Object da API principal do jogador (player-api-igamingsite): auth,
 * saldo e cassino. Endpoints confirmados contra pre-prod real antes de codar
 * (ver docs/API-TESTES.md).
 */
export class PlayerApiService extends BaseApiService {
  constructor(request: APIRequestContext, baseURL: string = AMBIENTE.playerApiUrl) {
    super(request, baseURL);
  }

  /** POST /auth/login */
  login(identificador: string, senha: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/auth/login', {
      data: { username: identificador, password: senha, googleId: null, googleIdToken: null, loginMode: 'email' },
    });
  }

  /** POST /auth/verify-login-data — pré-validação de credenciais. */
  verifyLoginData(identificador: string, senha: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/auth/verify-login-data', { data: { username: identificador, password: senha } });
  }

  /** POST /auth/refresh */
  refreshToken(refreshToken: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/auth/refresh', { data: { refreshToken } });
  }

  /** POST /auth/logout */
  logout(token?: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('post', '/auth/logout', { token });
  }

  /** GET /financial/position — saldo total, liberado para saque e bônus. */
  getSaldo(token?: string): Promise<ResultadoChamada<RespostaApi>> {
    return this.chamar('get', '/financial/position', { token });
  }

  /**
   * POST /casino/games — lista de jogos (gameList, populares, fornecedores).
   * Confirmado direto contra pre-prod: é POST, não GET (o documento de
   * referência dizia GET) e não exige token. Não usa o envelope padrão.
   */
  listarJogosCassino(): Promise<ResultadoChamada<ListaJogosCassino>> {
    return this.chamar<ListaJogosCassino>('post', '/casino/games');
  }
}
