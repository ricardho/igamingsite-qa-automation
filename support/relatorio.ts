import { test } from '@playwright/test';

/**
 * Envolve uma ação de negócio em um `test.step` nomeado — é o que aparece no
 * relatório HTML/trace ("Abrir modal de saque", "Selecionar conta"...).
 * `box: true` faz um erro apontar para a linha do spec que chamou o passo, em
 * vez de para o interior do Page Object.
 */
export function passo<T>(nome: string, acao: () => Promise<T>): Promise<T> {
  return test.step(nome, acao, { box: true });
}

/**
 * Registra um aviso visível no relatório (annotation) sem falhar o teste. Usado
 * sempre que a suíte toma um caminho de contingência (retentativa, clique
 * forçado, gate fechado via reload...) — assim a instabilidade fica registrada
 * em vez de silenciosamente absorvida.
 */
export function registrarAviso(descricao: string): void {
  try {
    test.info().annotations.push({ type: 'aviso', description: descricao });
  } catch {
    // Fora do contexto de um teste (ex.: import em tempo de carga) não há onde anotar.
  }
}

export function resumirErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem.split('\n')[0].slice(0, 200);
}

/**
 * Repete uma ação instável até `tentativas` vezes, registrando cada falha
 * intermediária como aviso no relatório. Na falha final, lança um erro que diz
 * o que estava sendo tentado e qual foi o último motivo.
 */
export async function tentarAte<T>(
  descricao: string,
  acao: (tentativa: number) => Promise<T>,
  { tentativas = 3, antesDeRepetir }: { tentativas?: number; antesDeRepetir?: () => Promise<unknown> } = {}
): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await acao(tentativa);
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa === tentativas) break;
      registrarAviso(`${descricao}: tentativa ${tentativa}/${tentativas} falhou — ${resumirErro(erro)}`);
      await antesDeRepetir?.();
    }
  }
  throw new Error(`${descricao}: falhou após ${tentativas} tentativas. Último erro: ${resumirErro(ultimoErro)}`, {
    cause: ultimoErro,
  });
}
