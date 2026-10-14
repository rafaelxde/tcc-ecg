import {

  AfterViewInit,

  ChangeDetectorRef,

  Component,

  ElementRef,

  effect,

  inject,

  OnDestroy,

  ViewChild

} from '@angular/core';



import { FormsModule } from '@angular/forms';

import Chart from 'chart.js/auto';



import {

  EcgProcessingService,

  TipoRitmo

} from './core/ecg-processing';



import {

  EcgFileService

} from './core/ecg-file';

import {
  type EcgRecording,
  type EcgRecordingSource,
  type EcgSignalQuality
} from './core/ecg-recording';



import {

  ArquivoAnotacoesMITBIH,

  EcgValidationService,

  MetricasValidacaoPicos

} from './core/ecg-validation';

import {
  AuthService
} from './core/auth.service';

import {
  AnaliseSalva,
  AnalysisHistoryService
} from './core/analysis-history.service';

import {
  FirebaseEcgService,
  type BlocoECGFirebase
} from './core/firebase-ecg.service';

import {
  AccountPanelComponent
} from './components/account-panel/account-panel.component';



type Cenario =

  | 'normal'

  | 'taquicardia'

  | 'bradicardia'

  | 'irregular';





type SecaoApp =

  | 'dashboard'

  | 'monitoramento'

  | 'eventos'

  | 'simulador'

  | 'historico'

  | 'resultados'

  | 'relatorio';





interface EventoECG {

  id: number;

  horario: string;

  tipo: string;

  bpm: number | null;

  rr: number | null;

  variabilidade: number | null;

}





interface ResultadoValidacaoSalvo {

  id: string;

  registro: string;

  inicioSegmento: number;

  duracaoSegmento: number;

  arquivo: string;

  dataHora: string;

  statusFinal: TipoRitmo;

  referencia: number;

  detectados: number;

  verdadeirosPositivos: number;

  falsosPositivos: number;

  falsosNegativos: number;

  sensibilidade: number;

  precisao: number;

  f1Score: number;

  toleranciaMs: number;

  latenciaMediaMs: number;

}


interface RelatorioECG {
  id: string;
  usuarioUid: string | null;
  usuarioNome: string | null;
  usuarioEmail: string | null;
  geradoEm: string;
  tipoAnalise: string;
  origem: string;
  arquivo: string | null;
  registro: string | null;
  inicioSegmento: number | null;
  duracaoSegmento: number | null;
  frequenciaHz: number;
  totalAmostras: number;
  statusFinal: TipoRitmo;
  bpm: number | null;
  rr: number | null;
  variabilidade: number | null;
  picosR: number;
  latenciaMediaMs: number | null;
  validacao: MetricasValidacaoPicos | null;
  dispositivo: string | null;
  derivacao: string | null;
  unidade: string | null;
  qualidadeSinal: EcgSignalQuality;
}


@Component({

  selector: 'app-root',

  standalone: true,

  imports: [
    FormsModule,
    AccountPanelComponent
  ],

  templateUrl: './app.html',

  styleUrl: './app.scss'

})

export class App implements AfterViewInit, OnDestroy {



  @ViewChild('ecgCanvas')

  ecgCanvas!: ElementRef<HTMLCanvasElement>;





  /*

   * ==========================

   * DADOS DA INTERFACE

   * ==========================

   */



  bpm: number | null = null;



  rr: number | null = null;



  variabilidade: number | null = null;



  status: TipoRitmo =

    'Analisando sinal';



  mensagemAnalise =

    'Aguardando dados suficientes para análise';



  picosR = 0;



  latencia = 0;



  monitorando = false;



  secaoAtiva: SecaoApp =

    'dashboard';


  relatorioAtual:
    RelatorioECG | null = null;

  historicoAnalises:
    AnaliseSalva[] = [];

  historicoCarregando =
    false;

  erroHistorico: string | null =
    null;

  relatorioVisivel =
    false;

  firebaseConectado =
    false;

  codigoSessaoSmartwatch:
    string | null = null;

  erroSmartwatch:
    string | null = null;

  private cancelarEscutaFirebase?:
    () => void;

  private cancelarEscutaHistorico?:
    () => void;

  private ultimaChaveFirebase:
    string | null = null;

  private sessaoFirebaseAtual:
    string | null = null;

  /*
   * Mantemos o UID da sessão separado do usuário exibido pelo AuthService.
   * Assim, ainda conseguimos encerrar uma captura iniciada por uma conta
   * mesmo quando o Firebase Auth já comunicou o logout.
   */
  private uidSessaoFirebaseAtual:
    string | null = null;

  private removerPreparadorDeSaida?:
    () => void;

  private uidRelatorioDaSessao:
    string | null = null;

  private viewInicializada =
    false;

  /*
   * A chave antiga era global no localStorage e podia expor o último
   * relatório para outra pessoa no mesmo navegador. Ela é removida na
   * inicialização e não é mais usada para gravar dados de ECG.
   */
  private readonly chaveRelatorioLegado =
    'ecg-watch-relatorio-atual-v1';

  private readonly prefixoChaveRelatorioDaSessao =
    'ecg-watch-relatorio-sessao-v1:';





  /*

   * ==========================

   * CENÁRIO DO SIMULADOR

   * ==========================

   */



  cenario: Cenario =

    'normal';





  /*

   * ==========================

   * EVENTOS

   * ==========================

   */



  eventos: EventoECG[] = [];



  private ultimoStatusRegistrado: TipoRitmo =

    'Analisando sinal';



  private contadorEventos = 0;





  /*

   * ==========================

   * IMPORTAÇÃO DE ECG

   * ==========================

   */



  arquivoSelecionado: string | null = null;

  gravacaoAtual:
    EcgRecording | null = null;

  consentimentoSmartwatch =
    false;

  frequenciaAmostragemAtual =
    250;

  unidadeSinalAtual =
    'normalizado';

  derivacaoAtual:
    string | null = null;

  dispositivoAtual:
    string | null = null;

  qualidadeSinalAtual:
    EcgSignalQuality =
      'unknown';



  amostrasArquivo: number[] = [];



  indiceArquivo = 0;



  analisandoArquivo = false;



  erroArquivo: string | null = null;



  arquivoAnotacoesSelecionado:

    string | null = null;



  anotacoesReferencia:

    ArquivoAnotacoesMITBIH | null = null;



  picosDetectadosArquivo:

    number[] = [];



  metricasValidacao:

    MetricasValidacaoPicos | null = null;



  erroAnotacoes:

    string | null = null;



  origemSinal =

    'Simulador';





  /*

   * ==========================

   * RESULTADOS DE VALIDAÇÃO

   * ==========================

   */



  resultadosValidacao:

    ResultadoValidacaoSalvo[] = [];



  latenciaMediaAnalise:

    number | null = null;



  private latenciasArquivo:

    number[] = [];



  private readonly chaveResultados =

    'ecg-watch-resultados-validacao-v1';





  /*

   * ==========================

   * GRÁFICO E TIMER

   * ==========================

   */



  private chart?: Chart<'line'>;



  private timer?:

    ReturnType<typeof setInterval>;





  /*

   * ==========================

   * CONFIGURAÇÕES DO ECG

   * ==========================

   */



  private readonly sampleRatePadrao = 250;



  private maxPoints = 650;

  private readonly segundosVisiveisGrafico =
    2.6;



  private ecgData: number[] = [];

  private amostrasProcessadasSessao =
    0;


  /*

   * ==========================

   * VARIÁVEIS DO SIMULADOR

   * ==========================

   */



  private fase = 0;



  private bpmGeracao = 74;



  private readonly ecgProcessor =
    inject(EcgProcessingService);

  private readonly ecgFileService =
    inject(EcgFileService);

  private readonly ecgValidationService =
    inject(EcgValidationService);

  private readonly cdr =
    inject(ChangeDetectorRef);

  readonly authService =
    inject(AuthService);

  private readonly firebaseEcg =
    inject(FirebaseEcgService);

  private readonly analysisHistory =
    inject(AnalysisHistoryService);


  constructor() {

    this.removerRelatorioLegado();

    this.removerPreparadorDeSaida =
      this.authService
        .registrarPreparadorDeSaida(
          () => this.prepararSaidaSegura()
        );

    effect(() => {

      const usuario =
        this.authService.usuario();

      const uidAtual =
        usuario?.uid ?? null;

      const houveTrocaDeConta =
        this.uidRelatorioDaSessao !==
        uidAtual;

      if (
        houveTrocaDeConta &&
        (
          this.uidRelatorioDaSessao ||
          this.relatorioAtual
        )
      ) {

        /*
         * Também cobre troca de conta fora do botão de logout, como em
         * outra aba. A limpeza é imediata; o encerramento no Firebase
         * continua em segundo plano porque effects não podem ser async.
         */
        void this.prepararSaidaSegura();
      }

      this.uidRelatorioDaSessao =
        uidAtual;

      if (usuario?.emailVerificado) {

        this.carregarRelatorioDaSessao(
          usuario.uid
        );
      }

      if (
        this.cancelarEscutaHistorico
      ) {

        this.cancelarEscutaHistorico();

        this.cancelarEscutaHistorico =
          undefined;
      }

      if (!usuario) {

        this.historicoAnalises = [];
        this.historicoCarregando = false;
        this.erroHistorico = null;

        return;
      }

      if (!usuario.emailVerificado) {

        this.historicoAnalises = [];
        this.historicoCarregando = false;
        this.erroHistorico =
          'Confirme seu e-mail para acessar o histórico protegido.';

        return;
      }

      this.historicoCarregando =
        true;

      this.erroHistorico =
        null;

      this.cancelarEscutaHistorico =
        this.analysisHistory
          .escutarMinhasAnalises(
            usuario.uid,
            analises => {

              this.historicoAnalises =
                analises;

              this.historicoCarregando =
                false;

              this.cdr.detectChanges();
            }
          );
    });
  }




  /*

   * ==========================

   * CICLO DO COMPONENTE

   * ==========================

   */



  ngAfterViewInit(): void {

    this.carregarResultadosSalvos();

    this.configurarSinalSimulado();

    this.criarGraficoECG();

    this.configurarGerador(
      'normal'
    );

    this.viewInicializada =
      true;

    this.iniciarMonitoramento();
  }


  ngOnDestroy(): void {

    this.removerPreparadorDeSaida?.();

    this.removerPreparadorDeSaida =
      undefined;

    if (this.timer) {
      clearInterval(this.timer);
    }

    if (
      this.cancelarEscutaFirebase
    ) {
      this.interromperEscutaFirebase();
    }

    void this.encerrarSessaoFirebaseAtual();

    if (
      this.cancelarEscutaHistorico
    ) {
      this.cancelarEscutaHistorico();
    }

    this.chart?.destroy();
  }








  /*

   * ==========================

   * NAVEGAÇÃO DA INTERFACE

   * ==========================

   */



  irParaSecao(

    secao: SecaoApp

  ): void {



    this.secaoAtiva =

      secao;



    const elemento =

      document.getElementById(

        secao

      );



    elemento?.scrollIntoView({

      behavior: 'smooth',

      block: 'start'

    });

  }





  /*

   * ==========================

   * TROCA DE CENÁRIO

   * ==========================

   */



  selecionarCenario(

    cenario: Cenario

  ): void {

    if (
      this.firebaseConectado
    ) {
      this.desconectarFirebase();
    }

    this.configurarSinalSimulado();



    this.cenario =

      cenario;



    this.configurarGerador(

      cenario

    );



    this.reiniciarMonitoramento();

  }





  /*

   * Configura SOMENTE o sinal

   * gerado pelo simulador.

   *

   * A classificação será realizada

   * pelo EcgProcessingService.

   */



  private configurarGerador(

    cenario: Cenario

  ): void {



    switch (cenario) {



      case 'normal':



        this.bpmGeracao = 74;



        break;





      case 'taquicardia':



        this.bpmGeracao = 125;



        break;





      case 'bradicardia':



        this.bpmGeracao = 48;



        break;





      case 'irregular':



        this.bpmGeracao = 82;



        break;

    }

  }





  /*

   * ==========================

   * CRIAÇÃO DO GRÁFICO

   * ==========================

   */



  private criarGraficoECG(): void {



    this.ecgData =

      new Array(

        this.maxPoints

      ).fill(0);





    this.chart =

      new Chart(

        this.ecgCanvas.nativeElement,

        {



          type: 'line',



          data: {



            labels:

              this.ecgData.map(

                (_, index) => index

              ),



            datasets: [

              {



                data:

                  this.ecgData,



                borderColor:

                  '#22d3a6',



                borderWidth: 2,



                pointRadius: 0,



                tension: 0.05,



                fill: false

              }

            ]

          },





          options: {



            responsive: true,



            maintainAspectRatio: false,



            animation: false,



            plugins: {



              legend: {

                display: false

              },



              tooltip: {

                enabled: false

              }

            },





            scales: {



              x: {



                display: false,



                grid: {

                  display: false

                }

              },





              y: {



                min: -0.5,



                max: 1.2,



                ticks: {

                  display: false

                },



                grid: {



                  color:

                    'rgba(148, 163, 184, 0.08)'

                },



                border: {

                  display: false

                }

              }

            }

          }

        }

      );

  }


  private configurarTaxaAmostragem(
    frequenciaHz: number
  ): void {

    this.ecgProcessor
      .configurarTaxaAmostragem(
        frequenciaHz
      );

    this.frequenciaAmostragemAtual =
      frequenciaHz;

    this.maxPoints =
      Math.max(
        250,
        Math.round(
          frequenciaHz *
          this.segundosVisiveisGrafico
        )
      );
  }


  private configurarSinalSimulado(): void {

    this.configurarTaxaAmostragem(
      this.sampleRatePadrao
    );

    this.gravacaoAtual =
      null;

    this.unidadeSinalAtual =
      'normalizado';

    this.derivacaoAtual =
      null;

    this.dispositivoAtual =
      null;

    this.qualidadeSinalAtual =
      'unknown';

    this.origemSinal =
      'Simulador';
  }


  private aplicarGravacao(
    gravacao: EcgRecording,
    nomeArquivo: string
  ): void {

    this.configurarTaxaAmostragem(
      gravacao.samplingHz
    );

    this.gravacaoAtual =
      gravacao;

    this.arquivoSelecionado =
      nomeArquivo;

    this.amostrasArquivo =
      gravacao.samples;

    this.unidadeSinalAtual =
      gravacao.unit;

    this.derivacaoAtual =
      gravacao.lead;

    this.qualidadeSinalAtual =
      gravacao.quality;

    this.dispositivoAtual =
      [
        gravacao.device?.manufacturer,
        gravacao.device?.model
      ]
        .filter(
          (
            valor
          ): valor is string =>
            Boolean(
              valor
            )
        )
        .join(
          ' '
        ) ||
      null;

    this.origemSinal =
      this.descreverOrigemGravacao(
        gravacao.source
      );
  }


  private descreverOrigemGravacao(
    origem: EcgRecordingSource
  ): string {

    switch (origem) {

      case 'smartwatch':
        return this.dispositivoAtual
          ? `Smartwatch • ${this.dispositivoAtual}`
          : 'Smartwatch importado';

      case 'mit-bih':
        return 'Arquivo MIT-BIH';

      case 'firebase':
        return 'Firebase / Nuvem';

      case 'simulator':
        return 'Simulador';

      default:
        return 'Arquivo importado';
    }
  }


  private limparGrafico(): void {

    this.ecgData =
      new Array(
        this.maxPoints
      ).fill(0);

    if (!this.chart) {
      return;
    }

    this.chart.data.labels =
      this.ecgData.map(
        (_, indice) => indice
      );

    this.chart.data.datasets[0].data =
      [...this.ecgData];

    this.chart.update(
      'none'
    );
  }


  private aplicarMetadadosBlocoFirebase(
    bloco: BlocoECGFirebase
  ): boolean {

    const frequenciaMudou =
      this.amostrasProcessadasSessao > 0 &&
      this.frequenciaAmostragemAtual !==
        bloco.frequenciaHz;

    if (frequenciaMudou) {

      this.erroSmartwatch =
        'A sessão recebeu blocos com taxas de amostragem diferentes. A captura foi interrompida para evitar um relatório incorreto.';

      this.mensagemAnalise =
        'Resultado inconclusivo: taxa de amostragem inconsistente.';

      return false;
    }

    if (
      this.amostrasProcessadasSessao === 0
    ) {

      this.configurarTaxaAmostragem(
        bloco.frequenciaHz
      );

      this.limparGrafico();
    }

    this.unidadeSinalAtual =
      bloco.unidade === 'normalizado'
        ? 'normalizado'
        : bloco.unidade ??
          'normalizado';

    this.derivacaoAtual =
      bloco.derivacao ??
      null;

    this.dispositivoAtual =
      [
        bloco.dispositivo?.fabricante,
        bloco.dispositivo?.modelo
      ]
        .filter(
          (
            valor
          ): valor is string =>
            Boolean(
              valor
            )
        )
        .join(
          ' '
        ) ||
      null;

    this.qualidadeSinalAtual =
      bloco.qualidade === 'boa'
        ? 'good'
        : bloco.qualidade === 'baixa'
          ? 'poor'
          : 'unknown';

    this.origemSinal =
      bloco.registro
        ? `Firebase • MIT-BIH ${bloco.registro}`
        : this.dispositivoAtual
          ? `Smartwatch • ${this.dispositivoAtual}`
          : bloco.origem ||
            'Firebase / Nuvem';

    if (
      this.qualidadeSinalAtual ===
      'poor'
    ) {

      this.erroSmartwatch =
        'O dispositivo informou baixa qualidade ou falta de contato dos eletrodos. Este bloco não será classificado.';

      this.mensagemAnalise =
        'Resultado inconclusivo: verifique o contato com o smartwatch.';

      return false;
    }

    return true;
  }





  /*

   * ==========================

   * MONITORAMENTO

   * ==========================

   */



  iniciarMonitoramento(): void {

    if (
      this.gravacaoAtual &&
      this.amostrasArquivo.length > 0
    ) {

      this.analisarArquivo();

      return;
    }

    this.configurarTaxaAmostragem(
      this.sampleRatePadrao
    );



    /*

     * Garante que não existam

     * dois timers simultâneos.

     */



    if (this.timer) {



      clearInterval(

        this.timer

      );

    }





    this.monitorando =

      true;





    /*

     * 10 amostras a cada 40 ms:

     *

     * 10 / 0,04 = 250 Hz

     */



    this.timer =

      setInterval(

        () => {



          const inicio =

            performance.now();





          /*

           * Processamos 10 amostras

           * a cada ciclo.

           */



          for (

            let i = 0;

            i < 10;

            i++

          ) {



            /*

             * SIMULADOR:

             * gera uma amostra numérica.

             */



            const amostraBruta =

              this.gerarAmostraECG();





            /*

             * PROCESSADOR:

             *

             * recebe somente o valor

             * da amostra.

             *

             * Ele não sabe qual cenário

             * foi escolhido.

             */



            const resultado =

              this.ecgProcessor

                .processarAmostra(

                  amostraBruta

                );

            this.amostrasProcessadasSessao++;





            /*

             * Adiciona sinal filtrado

             * ao gráfico.

             */



            this.ecgData.push(

              resultado.sinalFiltrado

            );



            this.ecgData.shift();





            /*

             * Atualiza os valores

             * calculados pelo algoritmo.

             */



            this.picosR =

              resultado.quantidadePicosR;



            this.bpm =

              resultado.bpm;



            this.rr =

              resultado.rr;



            this.variabilidade =

              resultado.variabilidade;



            this.status =

              resultado.status;

          }





          /*

           * Atualiza mensagem baseada

           * na classificação.

           */



          this.atualizarMensagem();





          /*

           * Verifica se surgiu

           * um novo evento.

           */



          this.verificarEvento();





          /*

           * Atualiza o gráfico.

           */



          if (this.chart) {



            this.chart

              .data

              .datasets[0]

              .data =

                [...this.ecgData];



            this.chart.update(

              'none'

            );

          }





          /*

           * Calcula tempo gasto

           * no processamento.

           */



          const fim =

            performance.now();





          this.latencia =

            Number(

              (

                fim -

                inicio

              ).toFixed(1)

            );





          /*

           * Força atualização da tela

           * nas versões atuais do Angular.

           */



          this.cdr.detectChanges();



        },

        40

      );

  }





  /*

   * ==========================

   * PAUSAR MONITORAMENTO

   * ==========================

   */



  pararMonitoramento(): void {

    if (this.timer) {

      clearInterval(
        this.timer
      );

      this.timer =
        undefined;
    }

    this.interromperEscutaFirebase();

    void this.encerrarSessaoFirebaseAtual();

    this.firebaseConectado =
      false;

    this.monitorando =
      false;
  }


  private interromperEscutaFirebase(): void {

    this.cancelarEscutaFirebase?.();

    this.cancelarEscutaFirebase =
      undefined;

    this.ultimaChaveFirebase =
      null;
  }


  private async encerrarSessaoFirebaseAtual(): Promise<void> {

    const uid =
      this.uidSessaoFirebaseAtual;

    const sessaoId =
      this.sessaoFirebaseAtual;

    /*
     * Limpamos o estado local antes da chamada remota. Assim, nenhum bloco
     * atrasado do Firebase volta a aparecer enquanto o logout é concluído.
     */
    this.sessaoFirebaseAtual =
      null;

    this.uidSessaoFirebaseAtual =
      null;

    this.codigoSessaoSmartwatch =
      null;

    if (
      !uid ||
      !sessaoId
    ) {
      return;
    }

    try {

      await this.firebaseEcg
        .encerrarSessao(
          uid,
          sessaoId
        );

    } catch (erro) {

      console.warn(
        'Não foi possível encerrar a sessão de ECG no Firebase.',
        erro
      );
    }
  }


  /**
   * Executado pelo AuthService antes de sair. Pode ser chamado também em
   * uma troca de conta detectada pelo Firebase Auth.
   */
  async prepararSaidaSegura(): Promise<void> {

    const uidsComDadosLocais =
      new Set(
        [
          this.uidRelatorioDaSessao,
          this.relatorioAtual?.usuarioUid
        ].filter(
          (
            uid
          ): uid is string =>
            Boolean(uid)
        )
      );

    for (
      const uid
      of uidsComDadosLocais
    ) {

      this.removerRelatorioDaSessao(
        uid
      );
    }

    this.uidRelatorioDaSessao =
      null;

    if (this.timer) {

      clearInterval(this.timer);

      this.timer =
        undefined;
    }

    this.interromperEscutaFirebase();

    this.firebaseConectado =
      false;

    this.monitorando =
      false;

    this.limparEstadoVisualPrivado();

    await this.encerrarSessaoFirebaseAtual();

    if (this.viewInicializada) {
      this.iniciarMonitoramento();
    }

    this.cdr.detectChanges();
  }


  async conectarFirebase(): Promise<void> {

    const usuario =
      this.authService.usuario();

    if (!usuario) {

      this.mensagemAnalise =
        'Entre na sua conta para conectar ao fluxo em nuvem.';

      this.cdr.detectChanges();

      return;
    }

    if (!usuario.emailVerificado) {

      this.erroSmartwatch =
        'Confirme seu e-mail antes de iniciar uma sessão de smartwatch.';

      this.mensagemAnalise =
        'Sessão protegida indisponível até a confirmação do e-mail.';

      this.cdr.detectChanges();

      return;
    }

    this.pararMonitoramento();

    this.gravacaoAtual =
      null;

    this.arquivoSelecionado =
      null;

    this.metricasValidacao =
      null;

    this.unidadeSinalAtual =
      'normalizado';

    this.derivacaoAtual =
      null;

    this.dispositivoAtual =
      null;

    this.qualidadeSinalAtual =
      'unknown';

    this.erroSmartwatch =
      null;

    this.mensagemAnalise =
      'Preparando uma sessão privada para o smartwatch...';

    let sessaoId: string;

    try {

      const sessao =
        await this.firebaseEcg
          .criarSessao(
            usuario.uid,
            {
              origem: 'Smartwatch / aplicativo companheiro'
            }
          );

      sessaoId =
        sessao.id;

    } catch (erro) {

      this.erroSmartwatch =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível criar a sessão privada no Firebase.';

      this.mensagemAnalise =
        'Não foi possível preparar a conexão com o smartwatch.';

      this.cdr.detectChanges();

      return;
    }

    /*
     * O logout pode ter sido iniciado enquanto a criação da sessão estava
     * aguardando a rede. Nesse caso, não vinculamos a sessão à conta que já
     * saiu e a encerramos imediatamente.
     */
    if (
      this.authService.usuario()?.uid !==
      usuario.uid
    ) {

      try {

        await this.firebaseEcg
          .encerrarSessao(
            usuario.uid,
            sessaoId
          );

      } catch (erro) {

        console.warn(
          'Não foi possível encerrar a sessão criada durante o logout.',
          erro
        );
      }

      return;
    }

    this.ecgProcessor.resetar();

    this.amostrasProcessadasSessao =
      0;

    this.picosR = 0;
    this.bpm = null;
    this.rr = null;
    this.variabilidade = null;
    this.status = 'Analisando sinal';

    this.ultimoStatusRegistrado =
      'Analisando sinal';

    this.limparGrafico();

    this.origemSinal =
      'Smartwatch / Firebase';

    this.firebaseConectado =
      true;

    this.monitorando =
      true;

    this.mensagemAnalise =
      'Sessão preparada. Aguardando o aplicativo do smartwatch enviar o ECG...';

    this.ultimaChaveFirebase =
      null;

    this.sessaoFirebaseAtual =
      sessaoId;

    this.uidSessaoFirebaseAtual =
      usuario.uid;

    this.codigoSessaoSmartwatch =
      sessaoId;

    this.cancelarEscutaFirebase =
      this.firebaseEcg
        .escutarSessao(
          usuario.uid,
          sessaoId,
          bloco => {

            const chave =
              `${bloco.sessao}-${bloco.sequencia}`;

            if (
              chave ===
              this.ultimaChaveFirebase
            ) {
              return;
            }

            if (
              this.sessaoFirebaseAtual !==
              bloco.sessao
            ) {
              return;
            }

            this.ultimaChaveFirebase =
              chave;

            if (
              !this.aplicarMetadadosBlocoFirebase(
                bloco
              )
            ) {
              this.cdr.detectChanges();

              return;
            }

            const inicio =
              performance.now();

            for (
              const amostra
              of bloco.amostras
            ) {

              if (
                !Number.isFinite(
                  amostra
                )
              ) {
                continue;
              }

              const resultado =
                this.ecgProcessor
                  .processarAmostra(
                    amostra
                  );

              this.amostrasProcessadasSessao++;

              this.ecgData.push(
                resultado.sinalFiltrado
              );

              this.ecgData.shift();

              this.picosR =
                resultado.quantidadePicosR;

              this.bpm =
                resultado.bpm;

              this.rr =
                resultado.rr;

              this.variabilidade =
                resultado.variabilidade;

              this.status =
                resultado.status;
            }

            this.atualizarMensagem();

            this.verificarEvento();

            if (this.chart) {

              this.chart.data
                .datasets[0]
                .data =
                  [...this.ecgData];

              this.chart.update(
                'none'
              );
            }

            const fim =
              performance.now();

            this.latencia =
              Number(
                (
                  fim -
                  inicio
                ).toFixed(1)
              );

            this.cdr.detectChanges();
          },
          erro => {
            this.erroSmartwatch =
              'Não foi possível receber dados da sessão no Firebase.';

            this.mensagemAnalise =
              erro.message;

            this.cdr.detectChanges();
          }
        );
  }


  desconectarFirebase(): void {

    this.interromperEscutaFirebase();

    void this.encerrarSessaoFirebaseAtual();

    this.firebaseConectado =
      false;

    this.monitorando =
      false;

    this.mensagemAnalise =
      'Conexão com o Firebase encerrada.';

    this.cdr.detectChanges();
  }



  /*

   * ==========================

   * REINICIAR ANÁLISE

   * ==========================

   */



  reiniciarMonitoramento(): void {



    /*

     * Reinicia o gerador.

     */



    this.fase = 0;





    /*

     * Reinicia o processador.

     */



    this.ecgProcessor

      .resetar();


    this.amostrasProcessadasSessao =
      0;


    /*

     * Limpa dados exibidos.

     */



    this.picosR = 0;



    this.bpm = null;



    this.rr = null;



    this.variabilidade =

      null;



    this.status =

      'Analisando sinal';



    this.mensagemAnalise =

      'Aguardando dados suficientes para análise';





    /*

     * Permite que o novo cenário

     * gere outro evento.

     */



    this.ultimoStatusRegistrado =

      'Analisando sinal';





    /*

     * Limpa somente o gráfico.

     *

     * O histórico de eventos

     * permanece salvo na tela.

     */



    this.limparGrafico();





    this.iniciarMonitoramento();

  }





  /*

   * ==========================

   * IMPORTAÇÃO DE ECG

   * ==========================

   */



  async selecionarArquivo(

    event: Event,
    origemEsperada:
      EcgRecordingSource =
        'file'

  ): Promise<void> {



    const input =

      event.target as HTMLInputElement;



    const arquivo =

      input.files?.[0];



    if (!arquivo) {

      return;

    }



    this.erroArquivo = null;

    this.erroSmartwatch = null;



    this.erroAnotacoes = null;

    this.relatorioVisivel =
      false;



    /*

     * Mantemos as anotações já carregadas.

     * Assim, o usuário pode selecionar CSV e JSON

     * em qualquer ordem sem perder a referência.

     */

    this.metricasValidacao =

      null;



    this.picosDetectadosArquivo =

      [];



    try {



      this.pararMonitoramento();



      const gravacao =

        await this.ecgFileService

          .lerGravacao(

            arquivo,

            origemEsperada

          );



      this.aplicarGravacao(
        gravacao,
        arquivo.name
      );



      this.indiceArquivo = 0;



      this.ecgProcessor

        .resetar();



      this.picosR = 0;

      this.bpm = null;

      this.rr = null;

      this.variabilidade = null;

      this.status = 'Analisando sinal';



      this.mensagemAnalise =

        'Arquivo carregado. Aguardando início da análise.';



      this.ultimoStatusRegistrado =

        'Analisando sinal';



      this.limparGrafico();

      if (
        origemEsperada ===
        'smartwatch' &&
        gravacao.quality ===
          'poor'
      ) {

        this.erroSmartwatch =
          'O arquivo indica sinal de baixa qualidade. Ele será mantido como inconclusivo e não será classificado.';
      }



      this.cdr.detectChanges();



    } catch (erro) {



      this.arquivoSelecionado =

        null;



      this.amostrasArquivo = [];



      this.indiceArquivo = 0;

      this.configurarSinalSimulado();

      this.limparGrafico();



      const mensagem =
        erro instanceof Error
          ? erro.message
          : 'Erro ao carregar arquivo';

      if (
        origemEsperada ===
        'smartwatch'
      ) {

        this.erroSmartwatch =
          mensagem;

      } else {

        this.erroArquivo =
          mensagem;
      }



      this.cdr.detectChanges();

    }

  }


  async selecionarArquivoSmartwatch(
    event: Event
  ): Promise<void> {

    if (!this.authService.podeUsarDadosClinicos()) {

      this.erroSmartwatch =
        'Entre em uma conta com e-mail confirmado para importar um ECG de smartwatch.';

      return;
    }

    if (
      !this.consentimentoSmartwatch
    ) {

      this.erroSmartwatch =
        'Confirme o consentimento para importar dados de saúde antes de selecionar o arquivo.';

      return;
    }

    await this.selecionarArquivo(
      event,
      'smartwatch'
    );
  }





  async selecionarAnotacoes(

    event: Event

  ): Promise<void> {



    const input =

      event.target as HTMLInputElement;



    const arquivo =

      input.files?.[0];



    if (!arquivo) {

      return;

    }



    this.erroAnotacoes =

      null;



    this.metricasValidacao =

      null;



    try {



      const anotacoes =

        await this.ecgValidationService

          .lerArquivoAnotacoes(

            arquivo

          );



      this.arquivoAnotacoesSelecionado =

        arquivo.name;



      this.anotacoesReferencia =

        anotacoes;



      this.cdr.detectChanges();



    } catch (erro) {



      this.arquivoAnotacoesSelecionado =

        null;



      this.anotacoesReferencia =

        null;



      this.erroAnotacoes =

        erro instanceof Error

          ? erro.message

          : 'Erro ao carregar anotações';



      this.cdr.detectChanges();

    }

  }





  analisarArquivo(): void {

    if (
      this.gravacaoAtual?.source ===
        'smartwatch' &&
      !this.authService.podeUsarDadosClinicos()
    ) {

      this.erroSmartwatch =
        'Confirme seu e-mail antes de analisar ou salvar um ECG de smartwatch.';

      return;
    }

    if (

      this.amostrasArquivo.length === 0

    ) {



      this.erroArquivo =

        'Selecione um arquivo antes de iniciar a análise.';



      return;

    }

    if (
      this.gravacaoAtual?.source ===
        'smartwatch' &&
      this.gravacaoAtual.quality ===
        'poor'
    ) {

      this.erroSmartwatch =
        'A análise foi bloqueada porque o próprio dispositivo informou baixa qualidade de sinal. Repita a medição com os eletrodos em contato.';

      this.mensagemAnalise =
        'Resultado inconclusivo: qualidade do sinal insuficiente.';

      this.cdr.detectChanges();

      return;
    }



    if (this.timer) {

      clearInterval(this.timer);

    }



    this.erroArquivo = null;

    this.erroSmartwatch = null;

    this.configurarTaxaAmostragem(
      this.gravacaoAtual?.samplingHz ??
      this.frequenciaAmostragemAtual
    );



    this.ecgProcessor

      .resetar();


    this.amostrasProcessadasSessao =
      0;


    this.indiceArquivo = 0;



    this.picosDetectadosArquivo =

      [];



    this.metricasValidacao =

      null;



    this.latenciasArquivo = [];



    this.latenciaMediaAnalise =

      null;



    this.analisandoArquivo = true;



    this.monitorando = true;



    this.picosR = 0;

    this.bpm = null;

    this.rr = null;

    this.variabilidade = null;

    this.status = 'Analisando sinal';



    this.mensagemAnalise =
      this.gravacaoAtual?.source ===
        'smartwatch'
        ? 'Analisando ECG de smartwatch (resultado experimental)...'
        : 'Analisando ECG importado...';



    this.ultimoStatusRegistrado =

      'Analisando sinal';



    this.limparGrafico();



    this.timer =

      setInterval(

        () => {



          const inicio =

            performance.now();



          for (

            let i = 0;

            i < 10;

            i++

          ) {



            if (

              this.indiceArquivo >=

              this.amostrasArquivo.length

            ) {



              this.finalizarAnaliseArquivo();



              return;

            }



            const amostra =

              this.amostrasArquivo[

                this.indiceArquivo

              ];



            this.indiceArquivo++;



            const resultado =

              this.ecgProcessor

                .processarAmostra(

                  amostra

                );

            this.amostrasProcessadasSessao++;



            if (

              resultado.indicePicoR !== null

            ) {



              this.picosDetectadosArquivo.push(

                resultado.indicePicoR

              );

            }



            this.ecgData.push(

              resultado.sinalFiltrado

            );



            this.ecgData.shift();



            this.picosR =

              resultado.quantidadePicosR;



            this.bpm =

              resultado.bpm;



            this.rr =

              resultado.rr;



            this.variabilidade =

              resultado.variabilidade;



            this.status =

              resultado.status;

          }



          this.atualizarMensagem();



          this.verificarEvento();



          if (this.chart) {



            this.chart.data

              .datasets[0]

              .data =

                [...this.ecgData];



            this.chart.update(

              'none'

            );

          }



          const fim =

            performance.now();



          this.latencia =

            Number(

              (

                fim -

                inicio

              ).toFixed(1)

            );



          this.latenciasArquivo.push(

            this.latencia

          );



          this.cdr.detectChanges();



        },

        40

      );

  }





  private finalizarAnaliseArquivo(): void {

    if (this.timer) {

      clearInterval(
        this.timer
      );

      this.timer =
        undefined;
    }

    this.monitorando =
      false;

    this.analisandoArquivo =
      false;

    this.atualizarMensagem();

    this.verificarEvento();

    this.latenciaMediaAnalise =
      this.calcularMedia(
        this.latenciasArquivo
      );

    if (
      this.anotacoesReferencia &&
      this.gravacaoAtual?.source !==
        'smartwatch'
    ) {

      this.metricasValidacao =
        this.ecgValidationService
          .compararPicos(
            this.picosDetectadosArquivo,
            this.anotacoesReferencia,
            this.frequenciaAmostragemAtual,
            100
          );

      this.salvarResultadoValidacao();
    }

    if (
      this.status ===
      'Analisando sinal'
    ) {

      this.mensagemAnalise =
        'Não foi possível obter dados suficientes para classificar o ECG.';

    } else {

      this.mensagemAnalise =
        `Análise concluída: ${this.status}`;
    }

    this.criarRelatorioAtual(
      this.gravacaoAtual?.source ===
        'smartwatch'
        ? 'Análise de ECG de smartwatch'
        : 'Análise de ECG importado'
    );

    this.relatorioVisivel =
      true;

    this.cdr.detectChanges();

    setTimeout(
      () =>
        this.irParaSecao(
          'relatorio'
        ),
      0
    );
  }


  gerarRelatorioManual(): void {

    if (
      this.picosR === 0 &&
      this.status ===
        'Analisando sinal'
    ) {
      return;
    }

    this.criarRelatorioAtual(
      this.firebaseConectado
        ? 'Monitoramento via Firebase'
        : 'Monitoramento atual'
    );

    this.relatorioVisivel =
      true;

    this.cdr.detectChanges();

    setTimeout(
      () =>
        this.irParaSecao(
          'relatorio'
        ),
      0
    );
  }


  abrirRelatorio(): void {

    if (!this.relatorioAtual) {
      return;
    }

    this.relatorioVisivel =
      true;

    setTimeout(
      () =>
        this.irParaSecao(
          'relatorio'
        ),
      0
    );
  }


  fecharRelatorio(): void {

    this.relatorioVisivel =
      false;
  }


  private criarRelatorioAtual(
    tipoAnalise: string
  ): void {

    const anotacoes =
      this.anotacoesReferencia;

    const usuario =
      this.authService.usuario();

    this.relatorioAtual = {

      id:
        `rel-${Date.now()}`,

      usuarioUid:
        usuario?.uid ?? null,

      usuarioNome:
        usuario?.nome ?? null,

      usuarioEmail:
        usuario?.email ?? null,

      geradoEm:
        new Date().toISOString(),

      tipoAnalise,

      origem:
        this.origemSinal,

      arquivo:
        this.arquivoSelecionado,

      registro:
        anotacoes?.record ??
        null,

      inicioSegmento:
        anotacoes?.inicio_segmento_s ??
        null,

      duracaoSegmento:
        anotacoes?.duracao_segmento_s ??
        Number(
          (
            this.amostrasProcessadasSessao /
            this.frequenciaAmostragemAtual
          ).toFixed(2)
        ),

      frequenciaHz:
        this.frequenciaAmostragemAtual,

      totalAmostras:
        this.amostrasProcessadasSessao,

      statusFinal:
        this.status,

      bpm:
        this.bpm,

      rr:
        this.rr,

      variabilidade:
        this.variabilidade,

      picosR:
        this.picosR,

      latenciaMediaMs:
        this.latenciaMediaAnalise ??
        this.latencia,

      validacao:
        this.metricasValidacao
          ? {
              ...this.metricasValidacao
            }
          : null,

      dispositivo:
        this.dispositivoAtual,

      derivacao:
        this.derivacaoAtual,

      unidade:
        this.unidadeSinalAtual,

      qualidadeSinal:
        this.qualidadeSinalAtual
    };

    if (
      usuario?.emailVerificado &&
      this.relatorioAtual
    ) {

      this.salvarRelatorioDaSessao(
        usuario.uid,
        this.relatorioAtual
      );

      const analise:
        AnaliseSalva = {

        id:
          this.relatorioAtual.id,

        usuarioUid:
          usuario.uid,

        usuarioNome:
          usuario.nome,

        usuarioEmail:
          usuario.email,

        geradoEm:
          this.relatorioAtual.geradoEm,

        tipoAnalise:
          this.relatorioAtual.tipoAnalise,

        origem:
          this.relatorioAtual.origem,

        arquivo:
          this.relatorioAtual.arquivo,

        registro:
          this.relatorioAtual.registro,

        inicioSegmento:
          this.relatorioAtual.inicioSegmento,

        duracaoSegmento:
          this.relatorioAtual.duracaoSegmento,

        frequenciaHz:
          this.relatorioAtual.frequenciaHz,

        totalAmostras:
          this.relatorioAtual.totalAmostras,

        statusFinal:
          this.relatorioAtual.statusFinal,

        bpm:
          this.relatorioAtual.bpm,

        rr:
          this.relatorioAtual.rr,

        variabilidade:
          this.relatorioAtual.variabilidade,

        picosR:
          this.relatorioAtual.picosR,

        latenciaMediaMs:
          this.relatorioAtual.latenciaMediaMs,

        validacao:
          this.relatorioAtual.validacao
            ? {
                ...this.relatorioAtual.validacao
              }
            : null,

        dispositivo:
          this.relatorioAtual.dispositivo,

        derivacao:
          this.relatorioAtual.derivacao,

        unidade:
          this.relatorioAtual.unidade,

        qualidadeSinal:
          this.relatorioAtual.qualidadeSinal
      };

      void this.analysisHistory
        .salvar(
          analise
        )
        .catch(
          erro => {
            console.error(
              'Não foi possível salvar o relatório no histórico da conta.',
              erro
            );
          }
        );
    }
  }


  abrirAnaliseHistorico(
    analise: AnaliseSalva
  ): void {

    const usuario =
      this.authService.usuario();

    if (
      !usuario ||
      !usuario.emailVerificado ||
      analise.usuarioUid !==
      usuario.uid
    ) {
      return;
    }

    this.relatorioAtual = {
      id: analise.id,
      usuarioUid: analise.usuarioUid,
      usuarioNome: analise.usuarioNome,
      usuarioEmail: analise.usuarioEmail,
      geradoEm: analise.geradoEm,
      tipoAnalise: analise.tipoAnalise,
      origem: analise.origem,
      arquivo: analise.arquivo,
      registro: analise.registro,
      inicioSegmento: analise.inicioSegmento,
      duracaoSegmento: analise.duracaoSegmento,
      frequenciaHz: analise.frequenciaHz,
      totalAmostras: analise.totalAmostras,
      statusFinal: analise.statusFinal,
      bpm: analise.bpm,
      rr: analise.rr,
      variabilidade: analise.variabilidade,
      picosR: analise.picosR,
      latenciaMediaMs: analise.latenciaMediaMs,
      validacao:
        analise.validacao
          ? {
              ...analise.validacao
            }
          : null,
      dispositivo:
        analise.dispositivo ?? null,
      derivacao:
        analise.derivacao ?? null,
      unidade:
        analise.unidade ?? null,
      qualidadeSinal:
        analise.qualidadeSinal ?? 'unknown'
    };

    this.salvarRelatorioDaSessao(
      usuario.uid,
      this.relatorioAtual
    );

    this.relatorioVisivel =
      true;

    setTimeout(
      () =>
        this.irParaSecao(
          'relatorio'
        ),
      0
    );
  }


  async excluirAnaliseHistorico(
    analise: AnaliseSalva
  ): Promise<void> {

    const usuario =
      this.authService.usuario();

    if (
      !usuario ||
      !usuario.emailVerificado
    ) {
      return;
    }

    await this.analysisHistory
      .excluir(
        usuario.uid,
        analise.id
      );
  }


  private removerRelatorioLegado(): void {

    try {

      localStorage.removeItem(
        this.chaveRelatorioLegado
      );

    } catch {

      /*
       * Alguns navegadores bloqueiam Storage em modo privado. Nesse caso,
       * não há dado legado acessível que a aplicação possa remover.
       */
    }
  }


  private chaveRelatorioDaSessao(
    uid: string
  ): string {

    return `${this.prefixoChaveRelatorioDaSessao}${uid}`;
  }


  private salvarRelatorioDaSessao(
    uid: string,
    relatorio: RelatorioECG
  ): void {

    if (
      relatorio.usuarioUid !==
      uid
    ) {

      this.removerRelatorioDaSessao(
        uid
      );

      return;
    }

    try {

      sessionStorage.setItem(
        this.chaveRelatorioDaSessao(
          uid
        ),
        JSON.stringify(
          relatorio
        )
      );

      this.uidRelatorioDaSessao =
        uid;

    } catch (erro) {

      console.warn(
        'Não foi possível manter o relatório apenas durante esta sessão.',
        erro
      );
    }
  }


  private removerRelatorioDaSessao(
    uid: string
  ): void {

    try {

      sessionStorage.removeItem(
        this.chaveRelatorioDaSessao(
          uid
        )
      );

    } catch {

      // Não há persistência de sessão disponível para limpar.
    }
  }


  private carregarRelatorioDaSessao(
    uid: string
  ): void {

    if (
      this.authService.usuario()?.uid !==
      uid
    ) {
      return;
    }

    try {

      const salvo =
        sessionStorage.getItem(
          this.chaveRelatorioDaSessao(
            uid
          )
        );

      if (!salvo) {
        return;
      }

      const convertido =
        JSON.parse(
          salvo
        ) as RelatorioECG;

      if (
        !convertido ||
        typeof convertido !==
          'object' ||
        convertido.usuarioUid !== uid
      ) {

        this.removerRelatorioDaSessao(
          uid
        );

        return;
      }

      this.relatorioAtual =
        {
          ...convertido,
          dispositivo:
            convertido.dispositivo ??
            null,
          derivacao:
            convertido.derivacao ??
            null,
          unidade:
            convertido.unidade ??
            null,
          qualidadeSinal:
            convertido.qualidadeSinal ??
            'unknown'
        };

      this.relatorioVisivel =
        false;

    } catch {

      this.removerRelatorioDaSessao(
        uid
      );

      this.relatorioAtual =
        null;
    }
  }


  private limparEstadoVisualPrivado(): void {

    this.relatorioAtual =
      null;

    this.relatorioVisivel =
      false;

    this.historicoAnalises =
      [];

    this.historicoCarregando =
      false;

    this.erroHistorico =
      null;

    this.gravacaoAtual =
      null;

    this.arquivoSelecionado =
      null;

    this.amostrasArquivo =
      [];

    this.indiceArquivo =
      0;

    this.analisandoArquivo =
      false;

    this.erroArquivo =
      null;

    this.arquivoAnotacoesSelecionado =
      null;

    this.anotacoesReferencia =
      null;

    this.picosDetectadosArquivo =
      [];

    this.metricasValidacao =
      null;

    this.erroAnotacoes =
      null;

    this.erroSmartwatch =
      null;

    this.consentimentoSmartwatch =
      false;

    this.eventos =
      [];

    this.contadorEventos =
      0;

    this.fase =
      0;

    this.ecgProcessor.resetar();

    this.amostrasProcessadasSessao =
      0;

    this.picosR =
      0;

    this.bpm =
      null;

    this.rr =
      null;

    this.variabilidade =
      null;

    this.latencia =
      0;

    this.latenciaMediaAnalise =
      null;

    this.status =
      'Analisando sinal';

    this.ultimoStatusRegistrado =
      'Analisando sinal';

    this.mensagemAnalise =
      'Aguardando dados suficientes para análise';

    this.configurarSinalSimulado();

    this.limparGrafico();

    this.secaoAtiva =
      'dashboard';
  }


  formatarDataRelatorio(
    valor: string
  ): string {

    return new Date(
      valor
    ).toLocaleString(
      'pt-BR'
    );
  }


  imprimirRelatorio(): void {

    const relatorio =
      this.relatorioAtual;

    if (!relatorio) {
      return;
    }

    const validacao =
      relatorio.validacao;

    const janela =
      window.open(
        '',
        '_blank',
        'width=980,height=760'
      );

    if (!janela) {
      return;
    }

    const texto =
      (valor: unknown) =>
        this.escaparHtml(
          valor === null ||
          valor === undefined
            ? '--'
            : String(valor)
        );

    const data =
      texto(
        this.formatarDataRelatorio(
          relatorio.geradoEm
        )
      );

    const validacaoHtml =
      validacao
        ? `
          <section>
            <h2>Validação MIT-BIH</h2>
            <div class="grid">
              <div><span>Referência</span><strong>${texto(validacao.batimentosReferencia)}</strong></div>
              <div><span>Detectados</span><strong>${texto(validacao.picosDetectados)}</strong></div>
              <div><span>VP</span><strong>${texto(validacao.verdadeirosPositivos)}</strong></div>
              <div><span>FP</span><strong>${texto(validacao.falsosPositivos)}</strong></div>
              <div><span>FN</span><strong>${texto(validacao.falsosNegativos)}</strong></div>
              <div><span>Sensibilidade</span><strong>${texto(validacao.sensibilidade)}%</strong></div>
              <div><span>Precisão</span><strong>${texto(validacao.precisao)}%</strong></div>
              <div><span>F1-score</span><strong>${texto(validacao.f1Score)}%</strong></div>
            </div>
          </section>
        `
        : `
          <section>
            <h2>Validação</h2>
            <p class="muted">
              Esta análise não possui arquivo de anotações de referência associado.
            </p>
          </section>
        `;

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório ECG Watch</title>
        <style>
          *{box-sizing:border-box}
          body{font-family:Arial,sans-serif;margin:0;color:#172033;background:#fff}
          .page{max-width:900px;margin:0 auto;padding:38px}
          .header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #16a085;padding-bottom:18px}
          .brand{font-size:25px;font-weight:800;color:#0f766e}
          .subtitle{margin-top:5px;color:#64748b;font-size:12px}
          .date{text-align:right;font-size:12px;color:#64748b}
          h1{font-size:22px;margin:28px 0 8px}
          h2{font-size:15px;margin:26px 0 12px;color:#0f766e}
          .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
          .grid div{border:1px solid #dbe4ea;border-radius:9px;padding:12px}
          .grid span{display:block;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
          .grid strong{display:block;margin-top:6px;font-size:15px}
          .meta{width:100%;border-collapse:collapse;margin-top:14px}
          .meta td{padding:9px 8px;border-bottom:1px solid #e8eef2;font-size:12px}
          .meta td:first-child{width:32%;color:#64748b}
          .notice{margin-top:28px;border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 14px;font-size:11px;line-height:1.5}
          .muted{color:#64748b;font-size:12px}
          .footer{margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;display:flex;justify-content:space-between}
          @media print{.page{padding:15px}}
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <div class="brand">ECG Watch</div>
              <div class="subtitle">Relatório de análise eletrocardiográfica — protótipo acadêmico</div>
            </div>
            <div class="date">Gerado em<br><strong>${data}</strong></div>
          </div>

          <h1>Resumo da análise</h1>
          <div class="grid">
            <div><span>Status final</span><strong>${texto(relatorio.statusFinal)}</strong></div>
            <div><span>Frequência</span><strong>${texto(relatorio.bpm)} BPM</strong></div>
            <div><span>Intervalo R-R</span><strong>${texto(relatorio.rr)} ms</strong></div>
            <div><span>Variabilidade</span><strong>${texto(relatorio.variabilidade)} ms</strong></div>
          </div>

          <h2>Identificação da sessão</h2>
          <table class="meta">
            <tr><td>Usuário</td><td>${texto(relatorio.usuarioNome ?? 'Sessão local')}</td></tr>
            <tr><td>E-mail</td><td>${texto(relatorio.usuarioEmail)}</td></tr>
          </table>

          <h2>Dados do processamento</h2>
          <table class="meta">
            <tr><td>Tipo de análise</td><td>${texto(relatorio.tipoAnalise)}</td></tr>
            <tr><td>Origem</td><td>${texto(relatorio.origem)}</td></tr>
            <tr><td>Arquivo</td><td>${texto(relatorio.arquivo)}</td></tr>
            <tr><td>Dispositivo</td><td>${texto(relatorio.dispositivo)}</td></tr>
            <tr><td>Derivação</td><td>${texto(relatorio.derivacao)}</td></tr>
            <tr><td>Unidade</td><td>${texto(relatorio.unidade)}</td></tr>
            <tr><td>Qualidade do sinal</td><td>${texto(relatorio.qualidadeSinal === 'good' ? 'Boa' : relatorio.qualidadeSinal === 'poor' ? 'Baixa / inconclusiva' : 'Não informada')}</td></tr>
            <tr><td>Registro MIT-BIH</td><td>${texto(relatorio.registro)}</td></tr>
            <tr><td>Início do segmento</td><td>${texto(relatorio.inicioSegmento)} s</td></tr>
            <tr><td>Duração do segmento</td><td>${texto(relatorio.duracaoSegmento)} s</td></tr>
            <tr><td>Taxa de amostragem</td><td>${texto(relatorio.frequenciaHz)} Hz</td></tr>
            <tr><td>Total de amostras</td><td>${texto(relatorio.totalAmostras)}</td></tr>
            <tr><td>Picos R detectados</td><td>${texto(relatorio.picosR)}</td></tr>
            <tr><td>Latência média</td><td>${texto(relatorio.latenciaMediaMs)} ms</td></tr>
          </table>

          ${validacaoHtml}

          <div class="notice">
            <strong>Importante:</strong>
            este relatório é gerado por um protótipo acadêmico de apoio à análise de sinais.
            Ele não representa diagnóstico médico e não substitui avaliação de um profissional de saúde.
          </div>

          <div class="footer">
            <span>ECG Watch • TCC</span>
            <span>Relatório ${texto(relatorio.id)}</span>
          </div>
        </div>
        <script>
          window.onload = () => {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);

    janela.document.close();
  }


  private escaparHtml(
    valor: string
  ): string {

    return valor.replace(
      /[&<>"']/g,
      caractere => {

        const mapa:
          Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
          };

        return mapa[
          caractere
        ];
      }
    );
  }


  /*

   * ==========================

   * RESULTADOS DE VALIDAÇÃO

   * ==========================

   */



  private salvarResultadoValidacao(): void {



    if (

      !this.metricasValidacao ||

      !this.anotacoesReferencia

    ) {

      return;

    }



    const registro =

      this.anotacoesReferencia.record;



    const inicio =

      this.anotacoesReferencia

        .inicio_segmento_s;



    const duracao =

      this.anotacoesReferencia

        .duracao_segmento_s;



    const id =

      `${registro}-${inicio}-${duracao}`;



    const resultado:

      ResultadoValidacaoSalvo = {



      id,

      registro,

      inicioSegmento: inicio,

      duracaoSegmento: duracao,

      arquivo:

        this.arquivoSelecionado ??

        'ECG importado',

      dataHora:

        new Date().toISOString(),

      statusFinal:

        this.status,

      referencia:

        this.metricasValidacao

          .batimentosReferencia,

      detectados:

        this.metricasValidacao

          .picosDetectados,

      verdadeirosPositivos:

        this.metricasValidacao

          .verdadeirosPositivos,

      falsosPositivos:

        this.metricasValidacao

          .falsosPositivos,

      falsosNegativos:

        this.metricasValidacao

          .falsosNegativos,

      sensibilidade:

        this.metricasValidacao

          .sensibilidade,

      precisao:

        this.metricasValidacao

          .precisao,

      f1Score:

        this.metricasValidacao

          .f1Score,

      toleranciaMs:

        this.metricasValidacao

          .toleranciaMs,

      latenciaMediaMs:

        this.latenciaMediaAnalise ??

        0

    };



    const indiceExistente =

      this.resultadosValidacao

        .findIndex(

          item =>

            item.id === id

        );



    if (

      indiceExistente >= 0

    ) {



      this.resultadosValidacao[

        indiceExistente

      ] = resultado;



    } else {



      this.resultadosValidacao.push(

        resultado

      );

    }



    this.resultadosValidacao =

      [...this.resultadosValidacao]

        .sort(

          (a, b) =>

            Number(a.registro) -

            Number(b.registro)

        );



    localStorage.setItem(

      this.chaveResultados,

      JSON.stringify(

        this.resultadosValidacao

      )

    );

  }





  private carregarResultadosSalvos(): void {



    try {



      const salvo =

        localStorage.getItem(

          this.chaveResultados

        );



      if (!salvo) {

        return;

      }



      const dados =

        JSON.parse(salvo);



      if (

        Array.isArray(dados)

      ) {



        this.resultadosValidacao =

          dados;

      }



    } catch {



      this.resultadosValidacao =

        [];

    }

  }





  limparResultados(): void {



    this.resultadosValidacao =

      [];



    localStorage.removeItem(

      this.chaveResultados

    );



    this.cdr.detectChanges();

  }





  private calcularMedia(

    valores: number[]

  ): number {



    if (

      valores.length === 0

    ) {

      return 0;

    }



    const soma =

      valores.reduce(

        (total, valor) =>

          total + valor,

        0

      );



    return Number(

      (

        soma /

        valores.length

      ).toFixed(2)

    );

  }





  get totalSegmentosValidados(): number {

    return this.resultadosValidacao.length;

  }





  get totalBatimentosReferencia(): number {



    return this.resultadosValidacao

      .reduce(

        (total, item) =>

          total + item.referencia,

        0

      );

  }





  get totalVerdadeirosPositivos(): number {



    return this.resultadosValidacao

      .reduce(

        (total, item) =>

          total +

          item.verdadeirosPositivos,

        0

      );

  }





  get totalFalsosPositivos(): number {



    return this.resultadosValidacao

      .reduce(

        (total, item) =>

          total +

          item.falsosPositivos,

        0

      );

  }





  get totalFalsosNegativos(): number {



    return this.resultadosValidacao

      .reduce(

        (total, item) =>

          total +

          item.falsosNegativos,

        0

      );

  }





  get sensibilidadeGlobal(): number {



    const denominador =

      this.totalVerdadeirosPositivos +

      this.totalFalsosNegativos;



    return this.percentualGlobal(

      this.totalVerdadeirosPositivos,

      denominador

    );

  }





  get precisaoGlobal(): number {



    const denominador =

      this.totalVerdadeirosPositivos +

      this.totalFalsosPositivos;



    return this.percentualGlobal(

      this.totalVerdadeirosPositivos,

      denominador

    );

  }





  get f1Global(): number {



    const sensibilidade =

      this.sensibilidadeGlobal;



    const precisao =

      this.precisaoGlobal;



    if (

      sensibilidade + precisao === 0

    ) {

      return 0;

    }



    return Number(

      (

        2 *

        sensibilidade *

        precisao /

        (

          sensibilidade +

          precisao

        )

      ).toFixed(2)

    );

  }





  get latenciaMediaGlobal(): number {



    return this.calcularMedia(

      this.resultadosValidacao.map(

        item =>

          item.latenciaMediaMs

      )

    );

  }





  private percentualGlobal(

    numerador: number,

    denominador: number

  ): number {



    if (

      denominador === 0

    ) {

      return 0;

    }



    return Number(

      (

        numerador /

        denominador *

        100

      ).toFixed(2)

    );

  }





  /*

   * ==========================

   * GERADOR DE ECG

   * ==========================

   */



  private gerarAmostraECG(): number {



    /*

     * Calcula quanto avançamos

     * dentro de um batimento.

     */



    const incremento =

      this.bpmGeracao /

      (

        60 *

        this.sampleRatePadrao

      );





    this.fase +=

      incremento;





    /*

     * Um novo batimento começou.

     */



    if (this.fase >= 1) {



      this.fase -= 1;



      this.novoBatimentoGerado();

    }





    let sinal = 0;





    /*

     * Onda P

     */



    sinal +=

      0.12 *

      this.gaussiana(

        this.fase,

        0.18,

        0.025

      );





    /*

     * Onda Q

     */



    sinal +=

      -0.15 *

      this.gaussiana(

        this.fase,

        0.36,

        0.012

      );





    /*

     * Pico R

     */



    sinal +=

      1.0 *

      this.gaussiana(

        this.fase,

        0.40,

        0.010

      );





    /*

     * Onda S

     */



    sinal +=

      -0.30 *

      this.gaussiana(

        this.fase,

        0.43,

        0.012

      );





    /*

     * Onda T

     */



    sinal +=

      0.22 *

      this.gaussiana(

        this.fase,

        0.67,

        0.045

      );





    /*

     * Pequeno ruído simulando

     * imperfeições de captura.

     */



    sinal +=

      (

        Math.random() -

        0.5

      ) *

      0.018;





    /*

     * No cenário irregular,

     * aumentamos levemente o ruído.

     */



    if (

      this.cenario ===

      'irregular'

    ) {



      sinal +=

        (

          Math.random() -

          0.5

        ) *

        0.025;

    }





    return sinal;

  }





  /*

   * ==========================

   * NOVO BATIMENTO SIMULADO

   * ==========================

   */



  private novoBatimentoGerado(): void {



    /*

     * Apenas no cenário irregular

     * alteramos a frequência entre

     * os batimentos.

     */



    if (

      this.cenario ===

      'irregular'

    ) {



      this.bpmGeracao =

        Math.floor(

          55 +

          Math.random() *

          65

        );

    }

  }





  /*

   * ==========================

   * FUNÇÃO GAUSSIANA

   * ==========================

   *

   * Utilizada para criar as ondas

   * P, Q, R, S e T.

   */



  private gaussiana(

    x: number,

    centro: number,

    largura: number

  ): number {



    return Math.exp(

      -Math.pow(

        x - centro,

        2

      ) /

      (

        2 *

        Math.pow(

          largura,

          2

        )

      )

    );

  }





  /*

   * ==========================

   * MENSAGEM DE ANÁLISE

   * ==========================

   */



  private atualizarMensagem(): void {



    switch (this.status) {



      case 'Analisando sinal':



        this.mensagemAnalise =

          'Aguardando dados suficientes para análise';



        break;





      case 'Ritmo Sinusal':



        this.mensagemAnalise =

          'Nenhuma anomalia detectada';



        break;





      case 'Taquicardia':



        this.mensagemAnalise =

          'Frequência cardíaca elevada detectada';



        break;





      case 'Bradicardia':



        this.mensagemAnalise =

          'Frequência cardíaca reduzida detectada';



        break;





      case 'Ritmo Irregular':



        this.mensagemAnalise =

          'Variabilidade elevada dos intervalos R-R';



        break;

    }

  }





  /*

   * ==========================

   * REGISTRO DE EVENTOS

   * ==========================

   */



  private verificarEvento(): void {



    /*

     * Ainda não temos dados

     * suficientes.

     */



    if (

      this.status ===

      'Analisando sinal'

    ) {



      return;

    }





    /*

     * Ritmo normal não entra

     * no histórico de alertas.

     */



    if (

      this.status ===

      'Ritmo Sinusal'

    ) {



      this.ultimoStatusRegistrado =

        'Ritmo Sinusal';



      return;

    }





    /*

     * Evita registrar o mesmo

     * alerta dezenas de vezes.

     */



    if (

      this.status ===

      this.ultimoStatusRegistrado

    ) {



      return;

    }





    this.contadorEventos++;





    /*

     * Horário atual do evento.

     */



    const agora =

      new Date();





    const horario =

      agora.toLocaleTimeString(

        'pt-BR',

        {

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit'

        }

      );





    /*

     * Criação do registro.

     */



    const novoEvento: EventoECG = {



      id:

        this.contadorEventos,



      horario,



      tipo:

        this.status,



      bpm:

        this.bpm,



      rr:

        this.rr,



      variabilidade:

        this.variabilidade

    };





    /*

     * Evento mais recente aparece

     * no início da lista.

     */



    this.eventos.unshift(

      novoEvento

    );





    /*

     * Limita a lista a

     * 20 registros.

     */



    if (

      this.eventos.length > 20

    ) {



      this.eventos.pop();

    }





    this.ultimoStatusRegistrado =

      this.status;

  }





  /*

   * ==========================

   * LIMPAR HISTÓRICO

   * ==========================

   */



  limparHistorico(): void {



    this.eventos = [];



    this.contadorEventos = 0;



    this.ultimoStatusRegistrado =

      this.status;



    this.cdr.detectChanges();

  }





  /*

   * ==========================

   * ALERTA VISUAL

   * ==========================

   */



  get possuiAlerta(): boolean {



    return (

      this.status !==

        'Ritmo Sinusal' &&

      this.status !==

        'Analisando sinal'

    );

  }



}
