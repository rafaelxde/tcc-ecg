import { Injectable } from '@angular/core';

export type TipoRitmo =
  'Analisando sinal' | 'Ritmo Sinusal' | 'Taquicardia' | 'Bradicardia' | 'Ritmo Irregular';

export interface ResultadoECG {
  sinalFiltrado: number;

  picoRDetectado: boolean;

  indicePicoR: number | null;

  quantidadePicosR: number;

  bpm: number | null;

  rr: number | null;

  variabilidade: number | null;

  status: TipoRitmo;
}

export interface ConfiguracaoProcessamentoECG {
  taxaAmostragemHz: number;
}

const TAXA_AMOSTRAGEM_PADRAO_HZ = 250;

const TAXA_AMOSTRAGEM_MINIMA_HZ = 50;

const TAXA_AMOSTRAGEM_MAXIMA_HZ = 2000;

const PERIODO_REFRATARIO_MS = 250;

const PERIODO_ESTABILIZACAO_MS = 200;

/*
 * A janela original tinha 12 amostras a 250 Hz: aproximadamente 48 ms.
 */
const JANELA_INCLINACAO_MS = 48;

const ALPHA_BASELINE_250_HZ = 0.995;

@Injectable({
  providedIn: 'root',
})
export class EcgProcessingService {
  /*
   * Mantemos 250 Hz como padrão para não alterar o comportamento do
   * simulador e dos dados MIT-BIH que já utilizam essa frequência.
   */
  private sampleRate = TAXA_AMOSTRAGEM_PADRAO_HZ;

  /*
   * Limiar mínimo de amplitude.
   *
   * Ele continua existindo, mas não é
   * mais suficiente sozinho para aceitar
   * um pico R.
   */
  private readonly limiarR = 0.45;

  /*
   * 250 ms.
   *
   * Evita detectar duas vezes o mesmo QRS.
   */
  private get periodoRefratario(): number {
    return this.milissegundosParaAmostras(PERIODO_REFRATARIO_MS);
  }

  /*
   * 200 ms iniciais usados como período
   * de estabilização do filtro.
   *
   * Isso evita falsos picos causados
   * pela inicialização da linha de base.
   */
  private get amostrasEstabilizacao(): number {
    return this.milissegundosParaAmostras(PERIODO_ESTABILIZACAO_MS);
  }

  /*
   * Janela usada para medir quão rápida
   * foi a subida do sinal.
   *
   * QRS tende a ter variação muito mais
   * rápida do que ondas mais largas,
   * como a onda T.
   */
  private get janelaInclinacao(): number {
    return this.milissegundosParaAmostras(JANELA_INCLINACAO_MS);
  }

  /*
   * Antes de termos um QRS confiável,
   * usamos este valor mínimo.
   */
  private readonly limiarInclinacaoInicial = 0.18;

  /*
   * Depois que já existem QRS detectados,
   * o limiar de inclinação passa a se
   * adaptar à morfologia observada.
   */
  private readonly fatorInclinacaoAdaptativa = 0.4;

  private readonly limiarInclinacaoMinimo = 0.08;

  private sampleIndex = 0;

  private ultimoPicoRIndex: number | null = null;

  private quantidadePicosR = 0;

  /*
   * ==========================
   * FILTRO DE LINHA DE BASE
   * ==========================
   */

  private baseline = 0;

  private get alphaBaseline(): number {
    /*
     * Conserva a mesma resposta temporal do filtro de linha de base
     * configurada originalmente para 250 Hz. Sem essa correção, um sinal
     * de 500 Hz faria o filtro se adaptar duas vezes mais rápido.
     */
    if (this.sampleRate === TAXA_AMOSTRAGEM_PADRAO_HZ) {
      return ALPHA_BASELINE_250_HZ;
    }

    return Math.pow(ALPHA_BASELINE_250_HZ, TAXA_AMOSTRAGEM_PADRAO_HZ / this.sampleRate);
  }

  /*
   * ==========================
   * AMOSTRAS ANTERIORES
   * ==========================
   */

  private amostraAnterior2 = 0;

  private amostraAnterior1 = 0;

  private sinalFiltradoAnterior = 0;

  /*
   * Guarda as últimas variações
   * absolutas do sinal.
   */
  private historicoInclinacao: number[] = [];

  /*
   * Estimativa adaptativa da inclinação
   * típica de um QRS já aceito.
   */
  private nivelInclinacaoQRS: number | null = null;

  /*
   * ==========================
   * DADOS R-R
   * ==========================
   */

  private rrHistorico: number[] = [];

  private bpm: number | null = null;

  private rr: number | null = null;

  private variabilidade: number | null = null;

  /*
   * ==========================
   * CLASSIFICAÇÃO
   * ==========================
   */

  private status: TipoRitmo = 'Analisando sinal';

  private irregularidadeAtiva = false;

  private janelasIrregularesConsecutivas = 0;

  private janelasRegularesConsecutivas = 0;

  /*
   * Configura a taxa declarada na origem do ECG antes de processar a sessão.
   * Ao trocar a taxa, o estado é limpo para que intervalos R-R de sessões
   * diferentes nunca sejam combinados.
   */
  configurarTaxaAmostragem(taxaAmostragemHz: number): void {
    this.validarTaxaAmostragem(taxaAmostragemHz);

    if (this.sampleRate === taxaAmostragemHz) {
      return;
    }

    this.sampleRate = taxaAmostragemHz;

    this.resetar();
  }

  obterTaxaAmostragem(): number {
    return this.sampleRate;
  }

  obterConfiguracao(): Readonly<ConfiguracaoProcessamentoECG> {
    return Object.freeze({
      taxaAmostragemHz: this.sampleRate,
    });
  }

  processarAmostra(amostraBruta: number): ResultadoECG {
    /*
     * ==========================
     * 1. FILTRAGEM
     * ==========================
     */

    this.baseline = this.alphaBaseline * this.baseline + (1 - this.alphaBaseline) * amostraBruta;

    const sinalFiltrado = amostraBruta - this.baseline;

    /*
     * ==========================
     * 2. INCLINAÇÃO / ENERGIA
     * ==========================
     *
     * Calculamos a variação entre
     * amostras consecutivas.
     *
     * Um QRS costuma mudar rapidamente.
     * Uma onda T costuma ser mais larga
     * e, portanto, menos inclinada.
     */

    /*
     * A diferença entre amostras diminui quando a mesma onda é capturada
     * com mais pontos por segundo. A normalização mantém os limiares de
     * inclinação calibrados a 250 Hz comparáveis para 125, 500 ou 512 Hz.
     */
    const inclinacaoAtual =
      Math.abs(sinalFiltrado - this.sinalFiltradoAnterior) *
      (this.sampleRate / TAXA_AMOSTRAGEM_PADRAO_HZ);

    this.historicoInclinacao.push(inclinacaoAtual);

    if (this.historicoInclinacao.length > this.janelaInclinacao) {
      this.historicoInclinacao.shift();
    }

    const inclinacaoMaxima =
      this.historicoInclinacao.length > 0 ? Math.max(...this.historicoInclinacao) : 0;

    /*
     * Limiar adaptativo.
     *
     * Depois dos primeiros QRS, o sistema
     * aprende aproximadamente qual é a
     * velocidade de subida típica daquele
     * ECG.
     */

    const limiarInclinacao =
      this.nivelInclinacaoQRS === null
        ? this.limiarInclinacaoInicial
        : Math.max(
            this.limiarInclinacaoMinimo,
            this.nivelInclinacaoQRS * this.fatorInclinacaoAdaptativa,
          );

    /*
     * ==========================
     * 3. DETECÇÃO DO PICO R
     * ==========================
     */

    let picoRDetectado = false;

    let indicePicoR: number | null = null;

    const ehMaximoLocal =
      this.amostraAnterior1 > this.amostraAnterior2 && this.amostraAnterior1 > sinalFiltrado;

    const passouDoLimiarAmplitude = this.amostraAnterior1 > this.limiarR;

    const passouDoLimiarInclinacao = inclinacaoMaxima >= limiarInclinacao;

    const indicePossivelPico = this.sampleIndex - 1;

    const filtroEstabilizado = indicePossivelPico >= this.amostrasEstabilizacao;

    const foraPeriodoRefratario =
      this.ultimoPicoRIndex === null ||
      indicePossivelPico - this.ultimoPicoRIndex > this.periodoRefratario;

    /*
     * Agora um pico precisa cumprir:
     *
     * 1. máximo local;
     * 2. amplitude mínima;
     * 3. inclinação compatível com QRS;
     * 4. período refratário;
     * 5. filtro já estabilizado.
     *
     * Isso reduz a chance de confundir
     * ondas T com novos picos R.
     */

    if (
      ehMaximoLocal &&
      passouDoLimiarAmplitude &&
      passouDoLimiarInclinacao &&
      foraPeriodoRefratario &&
      filtroEstabilizado
    ) {
      picoRDetectado = true;

      indicePicoR = indicePossivelPico;

      /*
       * Atualiza lentamente a inclinação
       * típica dos QRS aceitos.
       */

      if (this.nivelInclinacaoQRS === null) {
        this.nivelInclinacaoQRS = inclinacaoMaxima;
      } else {
        this.nivelInclinacaoQRS = 0.875 * this.nivelInclinacaoQRS + 0.125 * inclinacaoMaxima;
      }

      this.registrarPicoR(indicePossivelPico);
    }

    /*
     * Atualiza memória do sinal.
     */

    this.amostraAnterior2 = this.amostraAnterior1;

    this.amostraAnterior1 = sinalFiltrado;

    this.sinalFiltradoAnterior = sinalFiltrado;

    this.sampleIndex++;

    return {
      sinalFiltrado,

      picoRDetectado,

      indicePicoR,

      quantidadePicosR: this.quantidadePicosR,

      bpm: this.bpm,

      rr: this.rr,

      variabilidade: this.variabilidade,

      status: this.status,
    };
  }

  private registrarPicoR(indiceAtual: number): void {
    this.quantidadePicosR++;

    if (this.ultimoPicoRIndex !== null) {
      const diferencaAmostras = indiceAtual - this.ultimoPicoRIndex;

      const rrCalculado = (diferencaAmostras / this.sampleRate) * 1000;

      this.rr = Math.round(rrCalculado);

      this.bpm = Math.round(60000 / rrCalculado);

      this.rrHistorico.push(this.rr);

      if (this.rrHistorico.length > 8) {
        this.rrHistorico.shift();
      }

      this.variabilidade = this.calcularDesvioPadrao(this.rrHistorico);

      this.classificarRitmo();
    }

    this.ultimoPicoRIndex = indiceAtual;
  }

  private classificarRitmo(): void {
    if (this.bpm === null) {
      this.status = 'Analisando sinal';

      return;
    }

    if (this.rrHistorico.length >= 6 && this.variabilidade !== null) {
      const mediaRR =
        this.rrHistorico.reduce((soma, valor) => soma + valor, 0) / this.rrHistorico.length;

      const coeficienteVariacao = this.variabilidade / mediaRR;

      const maiorRR = Math.max(...this.rrHistorico);

      const menorRR = Math.min(...this.rrHistorico);

      const amplitudeRR = maiorRR - menorRR;

      /*
       * Critérios experimentais
       * do protótipo.
       *
       * Não representam diagnóstico
       * clínico.
       */

      const janelaIrregular = coeficienteVariacao >= 0.1 && amplitudeRR >= 160;

      if (janelaIrregular) {
        this.janelasIrregularesConsecutivas++;

        this.janelasRegularesConsecutivas = 0;
      } else {
        this.janelasRegularesConsecutivas++;

        this.janelasIrregularesConsecutivas = 0;
      }

      if (this.janelasIrregularesConsecutivas >= 2) {
        this.irregularidadeAtiva = true;
      }

      if (this.irregularidadeAtiva && this.janelasRegularesConsecutivas >= 3) {
        this.irregularidadeAtiva = false;
      }
    }

    if (this.irregularidadeAtiva) {
      this.status = 'Ritmo Irregular';

      return;
    }

    if (this.bpm > 100) {
      this.status = 'Taquicardia';

      return;
    }

    if (this.bpm < 60) {
      this.status = 'Bradicardia';

      return;
    }

    this.status = 'Ritmo Sinusal';
  }

  private calcularDesvioPadrao(valores: number[]): number {
    if (valores.length < 2) {
      return 0;
    }

    const media = valores.reduce((total, valor) => total + valor, 0) / valores.length;

    const variancia =
      valores.reduce((total, valor) => {
        return total + Math.pow(valor - media, 2);
      }, 0) / valores.length;

    return Math.round(Math.sqrt(variancia));
  }

  private milissegundosParaAmostras(milissegundos: number): number {
    return Math.max(1, Math.round((milissegundos / 1000) * this.sampleRate));
  }

  private validarTaxaAmostragem(taxaAmostragemHz: number): void {
    if (
      typeof taxaAmostragemHz !== 'number' ||
      !Number.isFinite(taxaAmostragemHz) ||
      taxaAmostragemHz < TAXA_AMOSTRAGEM_MINIMA_HZ ||
      taxaAmostragemHz > TAXA_AMOSTRAGEM_MAXIMA_HZ
    ) {
      throw new RangeError(
        `A taxa de amostragem deve ser um número finito entre ${TAXA_AMOSTRAGEM_MINIMA_HZ} e ${TAXA_AMOSTRAGEM_MAXIMA_HZ} Hz.`,
      );
    }
  }

  resetar(): void {
    this.sampleIndex = 0;

    this.ultimoPicoRIndex = null;

    this.quantidadePicosR = 0;

    this.baseline = 0;

    this.amostraAnterior1 = 0;

    this.amostraAnterior2 = 0;

    this.sinalFiltradoAnterior = 0;

    this.historicoInclinacao = [];

    this.nivelInclinacaoQRS = null;

    this.rrHistorico = [];

    this.bpm = null;

    this.rr = null;

    this.variabilidade = null;

    this.irregularidadeAtiva = false;

    this.janelasIrregularesConsecutivas = 0;

    this.janelasRegularesConsecutivas = 0;

    this.status = 'Analisando sinal';
  }
}
