import { Injectable } from '@angular/core';

export interface AnotacaoReferencia {
  sample_original: number;
  sample_relativo_original: number;
  sample_250hz: number;
  tempo_relativo_s: number;
  simbolo: string;
  aux_note: string;
  eh_batimento: boolean;
}

export interface ArquivoAnotacoesMITBIH {
  record: string;
  database: string;
  annotator: string;
  inicio_segmento_s: number;
  duracao_segmento_s: number;
  frequencia_original_hz: number;
  frequencia_exportada_hz: number;
  total_amostras_ecg: number;
  total_anotacoes_segmento: number;
  total_batimentos_referencia: number;
  resumo_simbolos_batimento: Record<string, number>;
  resumo_ritmos_aux: Record<string, number>;
  annotations: AnotacaoReferencia[];
}

export interface MetricasValidacaoPicos {
  batimentosReferencia: number;
  picosDetectados: number;
  verdadeirosPositivos: number;
  falsosPositivos: number;
  falsosNegativos: number;
  sensibilidade: number;
  precisao: number;
  f1Score: number;
  toleranciaMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class EcgValidationService {

  async lerArquivoAnotacoes(
    arquivo: File
  ): Promise<ArquivoAnotacoesMITBIH> {

    const texto =
      await arquivo.text();

    let dados: unknown;

    try {

      dados =
        JSON.parse(
          texto
        );

    } catch {

      throw new Error(
        'O arquivo de anotações não contém JSON válido.'
      );
    }


    if (
      !dados ||
      typeof dados !== 'object'
    ) {

      throw new Error(
        'Formato de anotações inválido.'
      );
    }


    const convertido =
      dados as ArquivoAnotacoesMITBIH;


    if (
      !Array.isArray(
        convertido.annotations
      )
    ) {

      throw new Error(
        'O JSON não possui a lista "annotations".'
      );
    }


    if (
      typeof convertido.record !==
      'string'
    ) {

      throw new Error(
        'O JSON não informa o registro MIT-BIH.'
      );
    }


    return convertido;
  }


  compararPicos(
    picosDetectados: number[],
    anotacoes:
      ArquivoAnotacoesMITBIH,
    sampleRate = 250,
    toleranciaMs = 100
  ): MetricasValidacaoPicos {

    /*
     * A tolerância de 100 ms é um
     * critério experimental do protótipo.
     *
     * A ideia é considerar correto um
     * pico detectado suficientemente
     * próximo da anotação de referência.
     */

    const toleranciaAmostras =
      Math.round(
        sampleRate *
        toleranciaMs /
        1000
      );


    const referencia =
      anotacoes.annotations
        .filter(
          anotacao =>
            anotacao.eh_batimento
        )
        .map(
          anotacao =>
            anotacao.sample_250hz
        )
        .sort(
          (a, b) => a - b
        );


    const detectados =
      [...picosDetectados]
        .sort(
          (a, b) => a - b
        );


    let i = 0;
    let j = 0;

    let verdadeirosPositivos = 0;
    let falsosPositivos = 0;
    let falsosNegativos = 0;


    /*
     * Matching um-para-um.
     *
     * Uma anotação oficial não pode
     * ser usada para validar dois
     * picos detectados.
     */

    while (
      i < detectados.length &&
      j < referencia.length
    ) {

      const detectado =
        detectados[i];

      const esperado =
        referencia[j];

      const diferenca =
        detectado -
        esperado;


      if (
        Math.abs(
          diferenca
        ) <= toleranciaAmostras
      ) {

        verdadeirosPositivos++;

        i++;
        j++;

        continue;
      }


      if (
        detectado <
        esperado - toleranciaAmostras
      ) {

        falsosPositivos++;

        i++;

        continue;
      }


      falsosNegativos++;

      j++;
    }


    falsosPositivos +=
      detectados.length - i;

    falsosNegativos +=
      referencia.length - j;


    const sensibilidade =
      this.percentual(
        verdadeirosPositivos,
        verdadeirosPositivos +
          falsosNegativos
      );


    const precisao =
      this.percentual(
        verdadeirosPositivos,
        verdadeirosPositivos +
          falsosPositivos
      );


    const f1Score =
      sensibilidade +
        precisao === 0
        ? 0
        : Number(
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


    return {

      batimentosReferencia:
        referencia.length,

      picosDetectados:
        detectados.length,

      verdadeirosPositivos,

      falsosPositivos,

      falsosNegativos,

      sensibilidade,

      precisao,

      f1Score,

      toleranciaMs
    };
  }


  private percentual(
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
}
