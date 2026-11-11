import { expect, type Page } from '@playwright/test';
import { gerarDadosCadastro, type DadosCadastro } from '../helpers/testData.js';
import { mockCadastroComSucesso } from '../helpers/mocks/mockCadastroApi.js';
import { mockConsultaCpfSucesso } from '../helpers/mocks/mockCpfValidation.js';
import { mockSessaoAutenticada } from '../helpers/mocks/mockSessao.js';
import { CadastroPage } from '../pages/CadastroPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { passo } from './relatorio.js';

/**
 * Ações compostas reutilizáveis (jornadas que atravessam mais de uma página).
 * Cada uma registra os mocks de que precisa — quem chama não precisa saber
 * quais rotas o fluxo depende.
 */

/** Cadastra um usuário do zero: mocka validação de CPF e o POST de cadastro, navega e preenche. */
export async function cadastrarNovoUsuario(page: Page, dados: DadosCadastro = gerarDadosCadastro()): Promise<DadosCadastro> {
  return passo(`Cadastrar novo usuário (${dados.email})`, async () => {
    await mockConsultaCpfSucesso(page, dados);
    await mockCadastroComSucesso(page);

    const cadastroPage = new CadastroPage(page);
    await cadastroPage.acessar();
    await cadastroPage.abrirFormularioDeCadastro();
    await cadastroPage.cadastrar(dados);
    await expect(cadastroPage.dialog, 'modal de cadastro deveria fechar após o sucesso').toBeHidden({ timeout: 15000 });
    await cadastroPage.fecharGateDeVerificacaoSeAberto();

    return dados;
  });
}

/**
 * Cadastra um usuário novo e loga com ele, retornando só quando o header já
 * reflete a sessão (o fechamento do modal de login, sozinho, não garante isso).
 * Usado pelo setup do storageState e pelo spec de integração cadastro+login.
 */
export async function cadastrarEFazerLogin(page: Page, dados: DadosCadastro = gerarDadosCadastro()): Promise<DadosCadastro> {
  await mockSessaoAutenticada(page, dados);
  await cadastrarNovoUsuario(page, dados);

  return passo('Fazer login com o usuário recém-cadastrado', async () => {
    const loginPage = new LoginPage(page);
    await loginPage.abrirFormularioDeLogin();
    await loginPage.logar({ login: dados.email, senha: dados.senha });
    await loginPage.header.aguardarSessaoAutenticada(20000);
    return dados;
  });
}
