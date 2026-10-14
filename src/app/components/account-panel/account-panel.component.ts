import {
  Component,
  HostListener,
  inject
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  AuthService
} from '../../core/auth.service';


type ModoConta =
  | 'login'
  | 'cadastro';


@Component({
  selector: 'app-account-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account-panel.component.html',
  styleUrl: './account-panel.component.scss'
})
export class AccountPanelComponent {

  readonly authService =
    inject(AuthService);

  menuAberto = false;
  modalAberto = false;

  modo: ModoConta =
    'login';

  nome = '';
  email = '';
  senha = '';
  confirmarSenha = '';

  processando = false;
  erro: string | null = null;
  sucesso: string | null = null;

  processandoVerificacao = false;
  erroVerificacao: string | null = null;
  mensagemVerificacao: string | null = null;


  abrirLogin(): void {
    this.modo = 'login';
    this.modalAberto = true;
    this.menuAberto = false;
    this.limparMensagens();
  }


  abrirCadastro(): void {
    this.modo = 'cadastro';
    this.modalAberto = true;
    this.menuAberto = false;
    this.limparMensagens();
  }


  fecharModal(): void {
    this.modalAberto = false;
    this.senha = '';
    this.confirmarSenha = '';
    this.limparMensagens();
  }


  alternarMenu(): void {
    this.menuAberto =
      !this.menuAberto;
  }


  async entrarEmail(): Promise<void> {

    if (
      !this.email.trim() ||
      !this.senha
    ) {
      this.erro =
        'Informe o e-mail e a senha.';
      return;
    }

    this.processando = true;
    this.limparMensagens();

    try {

      await this.authService
        .entrarEmail(
          this.email,
          this.senha
        );

      this.fecharModal();

    } catch (erro) {

      this.erro =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível entrar.';

    } finally {
      this.processando = false;
    }
  }


  async cadastrar(): Promise<void> {

    if (
      !this.nome.trim() ||
      !this.email.trim() ||
      !this.senha
    ) {
      this.erro =
        'Preencha nome, e-mail e senha.';
      return;
    }

    if (
      this.senha !==
      this.confirmarSenha
    ) {
      this.erro =
        'As senhas não coincidem.';
      return;
    }

    this.processando = true;
    this.limparMensagens();

    try {

      await this.authService
        .cadastrarEmail(
          this.nome,
          this.email,
          this.senha
        );

      this.fecharModal();

    } catch (erro) {

      this.erro =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível criar a conta.';

    } finally {
      this.processando = false;
    }
  }


  async entrarGoogle(): Promise<void> {

    this.processando = true;
    this.limparMensagens();

    try {

      await this.authService
        .entrarGoogle();

      this.fecharModal();

    } catch (erro) {

      this.erro =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível entrar com o Google.';

    } finally {
      this.processando = false;
    }
  }


  async recuperarSenha(): Promise<void> {

    this.limparMensagens();

    if (!this.email.trim()) {
      this.erro =
        'Digite seu e-mail primeiro.';
      return;
    }

    this.processando = true;

    try {

      await this.authService
        .recuperarSenha(
          this.email
        );

      this.sucesso =
        'Enviamos um link de redefinição para o seu e-mail.';

    } catch (erro) {

      this.erro =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível enviar o e-mail.';

    } finally {
      this.processando = false;
    }
  }


  async reenviarConfirmacaoEmail(): Promise<void> {

    this.processandoVerificacao = true;
    this.limparMensagensVerificacao();

    try {

      const enviado =
        await this.authService
          .reenviarConfirmacaoEmail();

      this.mensagemVerificacao =
        enviado
          ? 'Enviamos um novo link de confirmação para o seu e-mail.'
          : 'Seu e-mail já está confirmado.';

    } catch (erro) {

      this.erroVerificacao =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível reenviar a confirmação.';

    } finally {
      this.processandoVerificacao = false;
    }
  }


  async atualizarConfirmacaoEmail(): Promise<void> {

    this.processandoVerificacao = true;
    this.limparMensagensVerificacao();

    try {

      const confirmado =
        await this.authService
          .atualizarConfirmacaoEmail();

      this.mensagemVerificacao =
        confirmado
          ? 'E-mail confirmado. Seus recursos protegidos estão liberados.'
          : 'Ainda não identificamos a confirmação. Abra o link enviado e tente novamente.';

    } catch (erro) {

      this.erroVerificacao =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível atualizar a confirmação.';

    } finally {
      this.processandoVerificacao = false;
    }
  }


  async sair(): Promise<void> {
    this.menuAberto = false;
    this.limparMensagensVerificacao();
    await this.authService.sair();
  }


  iniciais(): string {
    const usuario =
      this.authService.usuario();

    if (!usuario) {
      return 'U';
    }

    const partes =
      usuario.nome
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (
      partes.length >= 2
    ) {
      return (
        partes[0][0] +
        partes[partes.length - 1][0]
      ).toUpperCase();
    }

    return usuario.nome
      .slice(0, 2)
      .toUpperCase();
  }


  @HostListener(
    'document:keydown.escape'
  )
  fecharComEscape(): void {
    this.fecharModal();
    this.menuAberto = false;
  }


  private limparMensagens(): void {
    this.erro = null;
    this.sucesso = null;
  }


  private limparMensagensVerificacao(): void {
    this.erroVerificacao = null;
    this.mensagemVerificacao = null;
  }
}
