import { Injectable } from '@angular/core';

import {
  ECG_DEFAULT_SAMPLING_HZ,
  type EcgRecording,
  type EcgRecordingDevice,
  type EcgRecordingMetadata,
  type EcgRecordingSource,
  type EcgRecordingUnit,
  type EcgSignalQuality
} from './ecg-recording';


type JsonObject =
  Record<string, unknown>;


@Injectable({
  providedIn: 'root'
})
export class EcgFileService {

  /**
   * Lê um arquivo de ECG e o converte para o contrato normalizado da
   * aplicação. Arquivos CSV e JSON legados continuam aceitos; um JSON de
   * smartwatch pode declarar frequência, unidade, dispositivo e qualidade.
   */
  async lerGravacao(
    arquivo: File,
    sourceHint?: EcgRecordingSource
  ): Promise<EcgRecording> {

    const extensao =
      arquivo.name
        .split('.')
        .pop()
        ?.toLowerCase();

    const texto =
      await arquivo.text();


    if (
      extensao === 'csv'
    ) {

      return this.lerCSV(
        texto,
        arquivo.name,
        sourceHint
      );
    }


    if (
      extensao === 'json'
    ) {

      return this.lerJSON(
        texto,
        arquivo.name,
        sourceHint
      );
    }


    throw new Error(
      'Formato não suportado. Utilize CSV ou JSON.'
    );
  }


  /**
   * Mantido para não quebrar os fluxos antigos da tela, que trabalham
   * somente com a lista de amostras.
   */
  async lerArquivo(
    arquivo: File
  ): Promise<number[]> {

    const gravacao =
      await this.lerGravacao(
        arquivo
      );

    return gravacao.samples;
  }


  private lerCSV(
    texto: string,
    nomeArquivo: string,
    sourceHint?: EcgRecordingSource
  ): EcgRecording {

    const linhas =
      texto
        .split(/\r?\n/)
        .map(
          linha =>
            linha.trim()
        )
        .filter(
          linha =>
            linha.length > 0
        );

    const samples: number[] = [];


    for (
      const linha of linhas
    ) {

      /*
       * Aceita, por exemplo:
       *
       * 0.123
       *
       * ou:
       *
       * tempo,ecg
       * 0.00,0.123
       *
       * Também aceita ponto e vírgula ou tabulação como separador. Quando há
       * várias colunas, a última numérica é tomada como o sinal ECG.
       */
      const numeros =
        linha
          .split(/[,;\t]/)
          .map(
            coluna =>
              coluna.trim()
          )
          .filter(
            coluna =>
              coluna.length > 0
          )
          .map(
            coluna =>
              Number(coluna)
          )
          .filter(
            valor =>
              Number.isFinite(valor)
          );


      /* Cabeçalhos e linhas sem números são ignorados. */
      if (
        numeros.length === 0
      ) {

        continue;
      }


      samples.push(
        numeros[
          numeros.length - 1
        ]
      );
    }


    if (
      samples.length === 0
    ) {

      throw new Error(
        'Nenhuma amostra numérica encontrada no CSV.'
      );
    }


    return this.criarGravacao(
      samples,
      {
        source:
          sourceHint ??
          'file',
        metadata: {
          importedFileName:
            nomeArquivo,
          importedFormat:
            'csv'
        }
      }
    );
  }


  private lerJSON(
    texto: string,
    nomeArquivo: string,
    sourceHint?: EcgRecordingSource
  ): EcgRecording {

    let dados: unknown;

    try {

      dados =
        JSON.parse(
          texto
        );

    } catch {

      throw new Error(
        'O arquivo não contém JSON válido.'
      );
    }


    /* Formato legado mais simples: [0.01, 0.02, 0.95]. */
    if (
      Array.isArray(
        dados
      )
    ) {

      return this.criarGravacao(
        this.extrairAmostras(
          dados
        ),
        {
          source:
            sourceHint ??
            'file',
          metadata: {
            importedFileName:
              nomeArquivo,
            importedFormat:
              'json'
          }
        }
      );
    }


    if (
      !this.ehObjetoJson(
        dados
      )
    ) {

      throw new Error(
        'Formato JSON inválido. Utilize um array numérico ou um objeto com "samples".'
      );
    }


    const samples =
      this.extrairAmostras(
        dados['samples'] ??
        dados['amostras'] ??
        dados['ecg'] ??
        dados['signal']
      );

    const device =
      this.normalizarDispositivo(
        dados
      );

    const rawSource =
      dados['source'] ??
      dados['origem'];

    const source =
      this.normalizarOrigem(
        rawSource,
        sourceHint ??
          (
            device !== null
              ? 'smartwatch'
              : 'file'
          )
      );

    const metadata =
      this.normalizarMetadata(
        dados['metadata'] ??
        dados['meta']
      );

    const rawSourceText =
      this.normalizarTexto(
        rawSource
      );


    if (
      rawSourceText !== null &&
      source === 'unknown'
    ) {

      metadata['originalSource'] =
        rawSourceText;
    }


    this.copiarMetadadoSeDefinido(
      metadata,
      'recordedAt',
      dados['recordedAt'] ??
      dados['recorded_at']
    );

    this.copiarMetadadoSeDefinido(
      metadata,
      'timestamp',
      dados['timestamp']
    );

    this.copiarMetadadoSeDefinido(
      metadata,
      'sessionId',
      dados['sessionId'] ??
      dados['session_id'] ??
      dados['sessao']
    );

    metadata['importedFileName'] =
      nomeArquivo;

    metadata['importedFormat'] =
      'json';


    return this.criarGravacao(
      samples,
      {
        samplingHz:
          this.normalizarFrequencia(
            dados['samplingHz'] ??
            dados['samplingRate'] ??
            dados['sampleRate'] ??
            dados['frequenciaHz'] ??
            dados['frequencyHz']
          ),
        unit:
          this.normalizarUnidade(
            dados['unit'] ??
            dados['units'] ??
            dados['unidade']
          ),
        source,
        device,
        lead:
          this.normalizarDerivacao(
            dados['lead'] ??
            dados['derivacao']
          ),
        quality:
          this.normalizarQualidade(
            dados['quality'] ??
            dados['signalQuality'] ??
            dados['qualidade']
          ),
        metadata
      }
    );
  }


  private criarGravacao(
    samples: number[],
    dados: {
      samplingHz?: number;
      unit?: EcgRecordingUnit;
      source: EcgRecordingSource;
      device?: EcgRecordingDevice | null;
      lead?: string | null;
      quality?: EcgSignalQuality;
      metadata?: EcgRecordingMetadata;
    }
  ): EcgRecording {

    return {
      samples,
      samplingHz:
        dados.samplingHz ??
        ECG_DEFAULT_SAMPLING_HZ,
      unit:
        dados.unit ??
        'normalized',
      source:
        dados.source,
      device:
        dados.device ??
        null,
      lead:
        dados.lead ??
        null,
      quality:
        dados.quality ??
        'unknown',
      metadata:
        dados.metadata ??
        {}
    };
  }


  private extrairAmostras(
    dados: unknown
  ): number[] {

    if (
      !Array.isArray(
        dados
      )
    ) {

      throw new Error(
        'Formato JSON inválido. A propriedade "samples" deve ser uma lista.'
      );
    }


    const samples =
      dados
        .map(
          valor =>
            this.normalizarNumero(
              valor
            )
        )
        .filter(
          (
            valor
          ): valor is number =>
            valor !== null
        );


    if (
      samples.length === 0
    ) {

      throw new Error(
        'Nenhuma amostra numérica encontrada no JSON.'
      );
    }


    return samples;
  }


  private normalizarFrequencia(
    valor: unknown
  ): number {

    if (
      valor === undefined ||
      valor === null ||
      valor === ''
    ) {

      return ECG_DEFAULT_SAMPLING_HZ;
    }


    const frequencia =
      this.normalizarNumero(
        valor
      );

    if (
      frequencia === null ||
      frequencia <= 0
    ) {

      throw new Error(
        'A taxa de amostragem deve ser um número maior que zero.'
      );
    }


    return frequencia;
  }


  private normalizarUnidade(
    valor: unknown
  ): EcgRecordingUnit {

    const texto =
      this.normalizarTexto(
        valor
      );

    if (
      texto === null
    ) {

      return 'normalized';
    }


    const unidade =
      texto
        .toLowerCase()
        .replaceAll('μ', 'u')
        .replaceAll('µ', 'u')
        .replaceAll(' ', '');


    if (
      [
        'mv',
        'millivolt',
        'millivolts'
      ].includes(
        unidade
      )
    ) {

      return 'mV';
    }


    if (
      [
        'uv',
        'microvolt',
        'microvolts'
      ].includes(
        unidade
      )
    ) {

      return 'uV';
    }


    if (
      [
        'normalized',
        'normalised',
        'normalizado',
        'normalizada',
        'raw',
        'adc'
      ].includes(
        unidade
      )
    ) {

      return 'normalized';
    }


    throw new Error(
      'Unidade de ECG não suportada. Utilize mV, uV ou normalized.'
    );
  }


  private normalizarOrigem(
    valor: unknown,
    fallback: EcgRecordingSource
  ): EcgRecordingSource {

    const texto =
      this.normalizarTexto(
        valor
      );

    if (
      texto === null
    ) {

      return fallback;
    }


    const origem =
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');


    if (
      [
        'file',
        'arquivo',
        'import',
        'imported-file'
      ].includes(
        origem
      )
    ) {

      return 'file';
    }


    if (
      origem.includes('watch') ||
      origem.includes('wear') ||
      origem.includes('smart')
    ) {

      return 'smartwatch';
    }


    if (
      origem === 'mit-bih' ||
      origem === 'mitbih'
    ) {

      return 'mit-bih';
    }


    if (
      origem === 'firebase'
    ) {

      return 'firebase';
    }


    if (
      origem === 'simulator' ||
      origem === 'simulador'
    ) {

      return 'simulator';
    }


    if (
      origem === 'unknown' ||
      origem === 'desconhecida'
    ) {

      return 'unknown';
    }


    return 'unknown';
  }


  private normalizarDispositivo(
    dados: JsonObject
  ): EcgRecordingDevice | null {

    const dispositivo =
      this.ehObjetoJson(
        dados['device']
      )
        ? dados['device']
        : this.ehObjetoJson(
            dados['dispositivo']
          )
          ? dados['dispositivo']
          : null;

    const modeloComoTexto =
      typeof dados['device'] === 'string'
        ? dados['device']
        : typeof dados['dispositivo'] === 'string'
          ? dados['dispositivo']
          : undefined;

    const manufacturer =
      this.normalizarTexto(
        dispositivo?.['manufacturer'] ??
        dispositivo?.['brand'] ??
        dispositivo?.['fabricante'] ??
        dados['manufacturer'] ??
        dados['brand'] ??
        dados['fabricante']
      );

    const model =
      this.normalizarTexto(
        dispositivo?.['model'] ??
        dispositivo?.['name'] ??
        dispositivo?.['modelo'] ??
        dados['model'] ??
        dados['modelo'] ??
        modeloComoTexto
      );


    if (
      manufacturer === null &&
      model === null
    ) {

      return null;
    }


    return {
      manufacturer,
      model
    };
  }


  private normalizarDerivacao(
    valor: unknown
  ): string | null {

    const derivacao =
      this.normalizarTexto(
        valor
      );

    if (
      derivacao === null
    ) {

      return null;
    }


    const derivacaoSemEspacos =
      derivacao.replaceAll(
        ' ',
        ''
      );


    if (
      derivacaoSemEspacos.toLowerCase() ===
      'lead1'
    ) {

      return 'I';
    }


    return derivacaoSemEspacos;
  }


  private normalizarQualidade(
    valor: unknown
  ): EcgSignalQuality {

    const texto =
      this.normalizarTexto(
        valor
      );

    if (
      texto === null
    ) {

      return 'unknown';
    }


    const qualidade =
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');


    if (
      [
        'good',
        'boa',
        'bom',
        'ok',
        'valid',
        'high'
      ].includes(
        qualidade
      )
    ) {

      return 'good';
    }


    if (
      [
        'poor',
        'bad',
        'ruim',
        'baixa',
        'low',
        'invalid'
      ].includes(
        qualidade
      )
    ) {

      return 'poor';
    }


    return 'unknown';
  }


  private normalizarMetadata(
    valor: unknown
  ): EcgRecordingMetadata {

    if (
      !this.ehObjetoJson(
        valor
      )
    ) {

      return {};
    }


    return {
      ...valor
    };
  }


  private copiarMetadadoSeDefinido(
    metadata: EcgRecordingMetadata,
    chave: string,
    valor: unknown
  ): void {

    if (
      valor !== undefined &&
      valor !== null
    ) {

      metadata[chave] =
        valor;
    }
  }


  private normalizarNumero(
    valor: unknown
  ): number | null {

    if (
      typeof valor === 'number'
    ) {

      return Number.isFinite(
        valor
      )
        ? valor
        : null;
    }


    if (
      typeof valor !== 'string' ||
      valor.trim() === ''
    ) {

      return null;
    }


    const numero =
      Number(
        valor
      );

    return Number.isFinite(
      numero
    )
      ? numero
      : null;
  }


  private normalizarTexto(
    valor: unknown
  ): string | null {

    if (
      typeof valor !== 'string'
    ) {

      return null;
    }


    const texto =
      valor.trim();

    return texto.length > 0
      ? texto
      : null;
  }


  private ehObjetoJson(
    valor: unknown
  ): valor is JsonObject {

    return (
      typeof valor === 'object' &&
      valor !== null &&
      !Array.isArray(
        valor
      )
    );
  }
}
