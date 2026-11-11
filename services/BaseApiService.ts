import { test, type APIRequestContext } from '@playwright/test';

type Metodo = 'get' | 'post';

/** Envelope padrão das respostas do backend. */
export interface RespostaApi<T = unknown> {
  success?: boolean;
  message?: string;
  errors?: { message?: string };
  results?: T;
}

export interface ResultadoChamada<T> {
  status: number;
  /** Corpo já interpretado como JSON — `null` se a resposta não for JSON válido. */
  body: T | null;
  /** Corpo bruto, para diagnóstico quando `body` vier `null`. */
  texto: string;
}

interface OpcoesChamada {
  data?: unknown;
  /** Token de sessão — vira `Authorization: Bearer <token>`. */
  token?: string;
  headers?: Record<string, string>;
}

/** Campos nunca gravados em claro nos anexos do relatório. */
const CAMPOS_SENSIVEIS = /senha|password|token|secret|authorization/i;

function mascararSensiveis(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(mascararSensiveis);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, v]) => [chave, CAMPOS_SENSIVEIS.test(chave) ? '***' : mascararSensiveis(v)])
    );
  }
  return valor;
}

function interpretarJson<T>(texto: string): T | null {
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

/**
 * Exige que a resposta seja JSON e devolve o corpo tipado. Sem isso, uma
 * resposta HTML (ex.: página de erro do gateway) viraria um
 * "cannot read properties of null" pouco útil no spec.
 */
export function corpoJson<T>(resultado: ResultadoChamada<T>): T {
  if (resultado.body === null) {
    throw new Error(`Resposta não é JSON válido (HTTP ${resultado.status}): ${resultado.texto.slice(0, 300)}`);
  }
  return resultado.body;
}

/**
 * Base dos Service Objects de API. Concentra montagem de URL, headers e
 * autenticação, e registra cada chamada como um passo do relatório com a
 * request/response anexadas (campos sensíveis mascarados). Nenhum método faz
 * asserção — cada um devolve `{ status, body, texto }` para o spec decidir.
 */
export abstract class BaseApiService {
  protected readonly request: APIRequestContext;
  readonly baseURL: string;

  protected constructor(request: APIRequestContext, baseURL: string) {
    this.request = request;
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  protected async chamar<T = RespostaApi>(
    metodo: Metodo,
    caminho: string,
    { data, token, headers = {} }: OpcoesChamada = {}
  ): Promise<ResultadoChamada<T>> {
    const url = `${this.baseURL}${caminho}`;
    const rotulo = `${metodo.toUpperCase()} ${caminho}`;

    return test.step(
      rotulo,
      async () => {
        const resposta = await this.request[metodo](url, {
          data,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
        });
        const texto = await resposta.text();
        const body = interpretarJson<T>(texto);

        await test.info().attach(rotulo, {
          contentType: 'application/json',
          body: JSON.stringify(
            {
              request: { metodo: metodo.toUpperCase(), url, data: mascararSensiveis(data) },
              response: { status: resposta.status(), body: body === null ? texto.slice(0, 2000) : mascararSensiveis(body) },
            },
            null,
            2
          ),
        });

        return { status: resposta.status(), body, texto };
      },
      { box: true }
    );
  }
}
