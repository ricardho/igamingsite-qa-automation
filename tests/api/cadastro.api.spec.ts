import { test, expect } from '../../support/fixtures.js';
import { corpoJson } from '../../services/BaseApiService.js';
import { construirJwtFake } from '../../helpers/jwt.js';
import { gerarDadosCadastro } from '../../helpers/testData.js';
import { gerarCpfValido } from '../../utils/cpfGenerator.js';

/**
 * Testes de API pura do serviço backoffice-api-igamingsite — cadastro.
 *
 * O endpoint de checagem de CPF existente é `cpf-cadastrado`
 * — o nome `verify-exists`, usado em versões antigas deste projeto, nunca
 * existiu de verdade (404 confirmado). Ver docs/MOCKS.md seção 7.2.
 */
test.describe('Cadastro — API (backoffice-api-igamingsite)', { tag: '@smoke-preprod' }, () => {
  test('cpf-cadastrado retorna sucesso para um CPF novo', async ({ backofficeApi }) => {
    const resposta = await backofficeApi.consultarCpfExistente(gerarCpfValido());

    expect(resposta.status).toBe(200);
    const body = corpoJson(resposta);
    expect(body.success).toBe(true);
    expect(body.results?.alreadyExists).toBe(false);
  });

  test('Bloqueia cadastro com campos obrigatórios vazios', async ({ backofficeApi }) => {
    const resposta = await backofficeApi.cadastro({});

    expect(resposta.status).toBe(412);
    expect(corpoJson(resposta).message).toContain('Senha deve possuir no mínimo 6 caracteres');
  });

  /**
   * Documenta o bloqueio conhecido (ver docs/MOCKS.md seção 2): o backend só
   * aceita no campo dadosCriptografados um token assinado pelo próprio serviço
   * de validação de CPF, que não conseguimos emitir de fora. Se essa asserção
   * um dia falhar (deixar de retornar 500), é sinal de que o bloqueio foi resolvido ou o contrato
   * mudou — o que merece investigação.
   */
  test('Cadastro real é bloqueado sem um token de CPF assinado pelo servidor (limitação conhecida do ambiente)', async ({ backofficeApi }) => {
    const dados = gerarDadosCadastro();
    const resposta = await backofficeApi.cadastro({
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      telefone: '(11) 91234-5678',
      senha: dados.senha,
      senha_confirmacao: dados.senha,
      googleId: '',
      googleIdToken: '',
      afiliado: '',
      utm_source: null,
      utm_campaign: null,
      utm_medium: null,
      utm_content: null,
      utm_term: null,
      dadosCriptografados: construirJwtFake({ nascimento: '1990-01-01', nome: dados.nome, genero: dados.genero }),
      termsAccepted: true,
      nationality: 'Brasil',
    });

    expect(resposta.status).toBe(500);
    expect(corpoJson(resposta).message).toBe('Ocorreu um problema inesperado, tente novamente.');
  });
});
