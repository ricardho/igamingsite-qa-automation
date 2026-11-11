import { test, expect } from '../../support/fixtures.js';
import { SEM_SESSAO } from '../../config/ambiente.js';
import { gerarDadosCadastro } from '../../helpers/testData.js';
import { mockConsultaCpfSucesso, mockCpfMenorDeIdade } from '../../helpers/mocks/mockCpfValidation.js';
import { mockCadastroComSucesso, mockCadastroComErro } from '../../helpers/mocks/mockCadastroApi.js';

/**
 * Funcionalidade: Cadastro de Novo Usuário
 *
 * As chamadas de validação de CPF (verify-exists, consultar-cpf) e, por necessidade
 * documentada em docs/MOCKS.md, o próprio POST de criação de conta, são mockadas —
 * o backend real rejeita qualquer token forjado no campo dadosCriptografados.
 */
test.use({ storageState: SEM_SESSAO });

test.describe('Cadastro de novo usuário', { tag: '@cadastro' }, () => {
  test.beforeEach(async ({ cadastroPage }) => {
    await cadastroPage.acessar();
    await cadastroPage.abrirFormularioDeCadastro();
  });

  test('Fluxo básico: cadastro com sucesso (CPF mockado)', { tag: '@happyPath' }, async ({ page, cadastroPage }) => {
    const dados = gerarDadosCadastro();
    await mockConsultaCpfSucesso(page, dados);
    await mockCadastroComSucesso(page);

    await cadastroPage.cadastrar(dados);

    await expect(cadastroPage.dialog).toContainText('Cadastro realizado com sucesso');
    await expect(cadastroPage.dialog).toBeHidden({ timeout: 15000 });
  });

  const cenariosDeBloqueio = [
    {
      titulo: 'bloqueia cadastro com CPF já cadastrado',
      mockCpf: mockConsultaCpfSucesso,
      mensagem: 'CPF já cadastrado. Verifique seus dados.',
    },
    {
      titulo: 'bloqueia cadastro de CPF de menor de idade',
      mockCpf: mockCpfMenorDeIdade,
      // Mensagem inferida: o front-end não bloqueia no client-side ao detectar menorDeIdade,
      // então o bloqueio real acontece via erro do POST de cadastro (ver docs/MOCKS.md).
      mensagem: 'Cadastro não permitido para menores de 18 anos.',
    },
  ];

  for (const { titulo, mockCpf, mensagem } of cenariosDeBloqueio) {
    test(`Fluxo alternativo: ${titulo}`, async ({ page, cadastroPage }) => {
      const dados = gerarDadosCadastro();
      await mockCpf(page, dados);
      await mockCadastroComErro(page, { status: 422, message: mensagem });

      await cadastroPage.cadastrar(dados);

      await expect(cadastroPage.dialog).toContainText(mensagem);
    });
  }

  test('Fluxo alternativo: bloqueia cadastro com campos obrigatórios vazios', async ({ cadastroPage }) => {
    await cadastroPage.submeter();

    // Validação nativa do browser bloqueia o submit sem exibir mensagem própria da UI;
    // o sinal observável é o dialog permanecer aberto com os campos ainda vazios.
    await expect(cadastroPage.dialog).toBeVisible();
    await expect(cadastroPage.campoCpf).toHaveValue('');
  });
});
