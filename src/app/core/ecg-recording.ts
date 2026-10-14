/**
 * Contrato normalizado para uma gravação de ECG importada pelo protótipo.
 *
 * A representação é deliberadamente independente do fabricante: um arquivo
 * legado, uma exportação de smartwatch ou uma futura integração móvel devem
 * chegar ao restante da aplicação com a mesma estrutura.
 */

export const ECG_DEFAULT_SAMPLING_HZ =
  250;


export type EcgRecordingUnit =
  | 'mV'
  | 'uV'
  | 'normalized';


export type EcgRecordingSource =
  | 'file'
  | 'smartwatch'
  | 'mit-bih'
  | 'firebase'
  | 'simulator'
  | 'unknown';


export type EcgSignalQuality =
  | 'good'
  | 'poor'
  | 'unknown';


/**
 * Identificação opcional do dispositivo que gerou a gravação.
 *
 * `null` é usado quando o arquivo não fornece a informação, o que evita
 * propagar objetos parcialmente preenchidos para os consumidores.
 */
export interface EcgRecordingDevice {

  manufacturer:
    string | null;

  model:
    string | null;
}


/**
 * Dados suplementares preservados da exportação de origem, como data da
 * gravação, identificador da sessão e versão do firmware.
 */
export interface EcgRecordingMetadata {

  [key: string]: unknown;
}


export interface EcgRecording {

  /** Amostras numéricas do sinal, na ordem original da gravação. */
  samples: number[];

  /** Taxa de amostragem real do sinal em hertz. */
  samplingHz: number;

  /** Unidade de amplitude declarada pela origem. */
  unit: EcgRecordingUnit;

  /** Origem normalizada da gravação. */
  source: EcgRecordingSource;

  /** Fabricante e modelo, quando declarados pela origem. */
  device: EcgRecordingDevice | null;

  /** Derivação do ECG, por exemplo `I`; `null` quando não informada. */
  lead: string | null;

  /** Qualidade declarada do sinal pela origem. */
  quality: EcgSignalQuality;

  /** Metadados adicionais sem impacto direto no processamento do sinal. */
  metadata: EcgRecordingMetadata;
}
