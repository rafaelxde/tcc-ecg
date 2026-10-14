import {
  Injectable,
  computed,
  signal
} from '@angular/core';

import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';

import {
  get,
  ref,
  serverTimestamp,
  set,
  update
} from 'firebase/database';

import {
  auth,
  database
} from './firebase';


export interface SessaoUsuario {
  uid: string;
  nome: string;
  email: string;
  emailVerificado: boolean;
  fotoUrl: string | null;
}


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly preparadoresDeSaida =
    new Set<() => Promise<void> | void>();


  readonly usuario =
    signal<SessaoUsuario | null>(
      null
    );


  readonly carregando =
    signal(
      true
    );


  readonly autenticado =
    computed(
      () =>
        this.usuario() !== null
    );


  readonly emailConfirmado =
    computed(
      () =>
        this.usuario()?.emailVerificado ===
        true
    );


  readonly podeUsarDadosClinicos =
    computed(
      () =>
        this.emailConfirmado()
    );


  constructor() {

    onAuthStateChanged(
      auth,
      async usuarioFirebase => {

        try {

          if (!usuarioFirebase) {

            this.usuario.set(
              null
            );

            return;
          }

          const sessao =
            await this.criarSessao(
              usuarioFirebase
            );

          this.usuario.set(
            sessao
          );

          await this.sincronizarPerfilSePossivel(
            usuarioFirebase,
            sessao
          );

        } finally {

          this.carregando.set(
            false
          );
        }
      }
    );
  }


  async entrarEmail(
    email: string,
    senha: string
  ): Promise<void> {

    try {

      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        senha
      );

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  async cadastrarEmail(
    nome: string,
    email: string,
    senha: string
  ): Promise<void> {

    const nomeLimpo =
      nome.trim();

    if (
      nomeLimpo.length < 2
    ) {

      throw new Error(
        'Informe seu nome.'
      );
    }

    if (!this.senhaAtendeRequisitos(senha)) {

      throw new Error(
        'Use uma senha com ao menos 8 caracteres, letra maiúscula, letra minúscula e número.'
      );
    }

    try {

      const credencial =
        await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          senha
        );

      await updateProfile(
        credencial.user,
        {
          displayName:
            nomeLimpo
        }
      );

      /*
       * A confirmação é enviada logo após o cadastro. Caso o Firebase
       * recuse o envio temporariamente, a conta continua utilizável para
       * que a pessoa possa solicitar um novo link pelo painel.
       */
      try {

        await sendEmailVerification(
          credencial.user
        );

      } catch (erro) {

        console.warn(
          'Conta criada, mas não foi possível enviar a confirmação de e-mail agora.',
          erro
        );
      }

      const sessao =
        await this.criarSessao(
          credencial.user,
          nomeLimpo
        );

      this.usuario.set(
        sessao
      );

      await this.sincronizarPerfilSePossivel(
        credencial.user,
        sessao
      );

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  async entrarGoogle(): Promise<void> {

    const provider =
      new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  async recuperarSenha(
    email: string
  ): Promise<void> {

    const emailLimpo =
      email.trim().toLowerCase();

    if (!emailLimpo) {

      throw new Error(
        'Informe o e-mail da conta.'
      );
    }

    try {

      await sendPasswordResetEmail(
        auth,
        emailLimpo
      );

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  /**
   * Reenvia o link de confirmação para a conta autenticada.
   *
   * @returns `true` se um novo link foi enviado; `false` se o e-mail já
   * estava confirmado quando o estado foi atualizado.
   */
  async reenviarConfirmacaoEmail(): Promise<boolean> {

    const usuarioFirebase =
      auth.currentUser;

    if (!usuarioFirebase) {

      throw new Error(
        'Entre na sua conta para confirmar o e-mail.'
      );
    }

    try {

      await reload(
        usuarioFirebase
      );

      if (usuarioFirebase.emailVerified) {
        await usuarioFirebase.getIdToken(
          true
        );
      }

      const sessao = await this.atualizarSessaoLocal(
        usuarioFirebase
      );

      await this.sincronizarPerfilSePossivel(
        usuarioFirebase,
        sessao
      );

      if (usuarioFirebase.emailVerified) {
        return false;
      }

      await sendEmailVerification(
        usuarioFirebase
      );

      return true;

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  /**
   * Atualiza a informação de confirmação depois que a pessoa abre o link
   * recebido por e-mail.
   */
  async atualizarConfirmacaoEmail(): Promise<boolean> {

    const usuarioFirebase =
      auth.currentUser;

    if (!usuarioFirebase) {

      throw new Error(
        'Entre na sua conta para atualizar a confirmação de e-mail.'
      );
    }

    try {

      await reload(
        usuarioFirebase
      );

      if (usuarioFirebase.emailVerified) {
        /* Atualiza o token para que as regras do Realtime Database recebam o novo estado. */
        await usuarioFirebase.getIdToken(
          true
        );
      }

      const sessao = await this.atualizarSessaoLocal(
        usuarioFirebase
      );

      await this.sincronizarPerfilSePossivel(
        usuarioFirebase,
        sessao
      );

      return usuarioFirebase.emailVerified;

    } catch (erro) {

      throw new Error(
        this.traduzirErro(
          erro
        )
      );
    }
  }


  /**
   * Registra uma limpeza assíncrona que deve ocorrer antes do logout, como
   * encerrar uma sessão remota de smartwatch. A função retornada remove o
   * hook quando o componente deixa de precisar dele.
   */
  registrarPreparadorDeSaida(
    callback: () => Promise<void> | void
  ): () => void {

    this.preparadoresDeSaida.add(
      callback
    );

    return () => {
      this.preparadoresDeSaida.delete(
        callback
      );
    };
  }


  async sair(): Promise<void> {

    for (
      const preparar of
      [...this.preparadoresDeSaida]
    ) {

      try {

        await preparar();

      } catch (erro) {

        /*
         * Uma limpeza falha não pode impedir a pessoa de sair da conta.
         * O erro fica registrado para diagnóstico, mas o logout continua.
         */
        console.warn(
          'Não foi possível concluir uma limpeza antes do logout.',
          erro
        );
      }
    }

    await signOut(
      auth
    );

    this.usuario.set(
      null
    );
  }


  private async criarSessao(
    usuarioFirebase: User,
    nomeAlternativo?: string
  ): Promise<SessaoUsuario> {

    const email =
      usuarioFirebase.email
        ?.trim()
        .toLowerCase() ??
      '';

    let nome =
      nomeAlternativo ||
      usuarioFirebase.displayName ||
      email.split('@')[0] ||
      'Usuário';

    let fotoUrl =
      usuarioFirebase.photoURL;

    try {

      const perfilSnapshot =
        await get(
          ref(
            database,
            `usuarios/${usuarioFirebase.uid}`
          )
        );

      if (
        perfilSnapshot.exists()
      ) {

        const perfil =
          perfilSnapshot.val();

        nome =
          String(
            perfil?.nome ||
            nome
          );

        fotoUrl =
          perfil?.fotoUrl
            ? String(
                perfil.fotoUrl
              )
            : fotoUrl;
      }

    } catch {
      // O perfil local do Firebase Auth já é suficiente.
    }

    return {
      uid:
        usuarioFirebase.uid,
      nome,
      email,
      emailVerificado:
        usuarioFirebase.emailVerified,
      fotoUrl
    };
  }


  private async atualizarSessaoLocal(
    usuarioFirebase: User
  ): Promise<SessaoUsuario> {

    const sessao =
      await this.criarSessao(
        usuarioFirebase
      );

    this.usuario.set(
      sessao
    );

    return sessao;
  }


  private async sincronizarPerfilSePossivel(
    usuarioFirebase: User,
    sessao: SessaoUsuario
  ): Promise<void> {

    if (!sessao.emailVerificado) {
      return;
    }

    try {

      await this.sincronizarPerfil(
        usuarioFirebase,
        sessao
      );

    } catch (erro) {

      /*
       * A autenticação e a confirmação do e-mail continuam válidas mesmo
       * se a rede ou as regras do banco estiverem indisponíveis agora.
       */
      console.warn(
        'Não foi possível sincronizar o perfil no Realtime Database.',
        erro
      );
    }
  }


  private async sincronizarPerfil(
    usuarioFirebase: User,
    sessao: SessaoUsuario
  ): Promise<void> {

    const perfilRef =
      ref(
        database,
        `usuarios/${usuarioFirebase.uid}`
      );

    const existente =
      await get(
        perfilRef
      );

    const dadosBase = {
      uid:
        sessao.uid,
      nome:
        sessao.nome,
      email:
        sessao.email,
      emailVerificado:
        sessao.emailVerificado,
      fotoUrl:
        sessao.fotoUrl ?? '',
      ultimoLoginEm:
        serverTimestamp()
    };

    if (
      existente.exists()
    ) {

      await update(
        perfilRef,
        dadosBase
      );

      return;
    }

    await set(
      perfilRef,
      {
        ...dadosBase,
        criadoEm:
          serverTimestamp()
      }
    );
  }


  private senhaAtendeRequisitos(
    senha: string
  ): boolean {

    return senha.length >= 8 &&
      /[a-z]/.test(senha) &&
      /[A-Z]/.test(senha) &&
      /\d/.test(senha);
  }


  private traduzirErro(
    erro: unknown
  ): string {

    const codigo =
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro
        ? String(
            (
              erro as {
                code?: unknown
              }
            ).code
          )
        : '';

    switch (codigo) {

      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mail ou senha incorretos.';

      case 'auth/email-already-in-use':
        return 'Este e-mail já possui uma conta.';

      case 'auth/invalid-email':
        return 'Informe um e-mail válido.';

      case 'auth/weak-password':
        return 'A senha informada é muito fraca.';

      case 'auth/popup-closed-by-user':
        return 'A janela do Google foi fechada antes de concluir o login.';

      case 'auth/popup-blocked':
        return 'O navegador bloqueou a janela de login do Google.';

      case 'auth/account-exists-with-different-credential':
        return 'Já existe uma conta com este e-mail usando outro método de login.';

      case 'auth/operation-not-allowed':
        return 'Este método de login ainda não foi ativado no Firebase.';

      case 'auth/network-request-failed':
        return 'Falha de conexão com o Firebase.';

      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

      case 'auth/api-key-not-valid':
        return 'A chave de configuração do Firebase é inválida.';

      default:
        console.error(
          'Firebase Authentication:',
          erro
        );

        return codigo
          ? `Não foi possível autenticar (${codigo}).`
          : 'Não foi possível autenticar.';
    }
  }
}
