import { EcgProcessingService, type ResultadoECG } from './ecg-processing';
import { describe, expect, it } from 'vitest';

describe('EcgProcessingService', () => {
  it('mantém 250 Hz como taxa de amostragem padrão', () => {
    const service = new EcgProcessingService();
    const configuracao = service.obterConfiguracao();

    expect(service.obterTaxaAmostragem()).toBe(250);
    expect(configuracao).toEqual({
      taxaAmostragemHz: 250,
    });
    expect(Object.isFrozen(configuracao)).toBe(true);
  });

  it.each([250, 500, 512])(
    'calcula os mesmos RR e BPM para um ritmo de 60 BPM a %i Hz',
    (taxaAmostragemHz) => {
      const service = new EcgProcessingService();

      service.configurarTaxaAmostragem(taxaAmostragemHz);

      const resultado = processarPicosAUmSegundo(service, taxaAmostragemHz);

      expect(resultado.quantidadePicosR).toBe(4);
      expect(resultado.rr).toBe(1000);
      expect(resultado.bpm).toBe(60);
    },
  );

  it('redimensiona os parâmetros temporais ao configurar 500 Hz', () => {
    const service = new EcgProcessingService();
    const parametros = service as unknown as {
      periodoRefratario: number;
      amostrasEstabilizacao: number;
      janelaInclinacao: number;
    };

    expect(parametros.periodoRefratario).toBe(63);
    expect(parametros.amostrasEstabilizacao).toBe(50);
    expect(parametros.janelaInclinacao).toBe(12);

    service.configurarTaxaAmostragem(500);

    expect(parametros.periodoRefratario).toBe(125);
    expect(parametros.amostrasEstabilizacao).toBe(100);
    expect(parametros.janelaInclinacao).toBe(24);
  });

  it('rejeita taxas de amostragem inseguras sem alterar a configuração atual', () => {
    const service = new EcgProcessingService();

    expect(() => service.configurarTaxaAmostragem(49)).toThrow(RangeError);
    expect(() => service.configurarTaxaAmostragem(2001)).toThrow(RangeError);
    expect(() => service.configurarTaxaAmostragem(Number.NaN)).toThrow(RangeError);
    expect(() => service.configurarTaxaAmostragem(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(service.obterTaxaAmostragem()).toBe(250);
  });

  it('reinicia as medições ao trocar a taxa de amostragem', () => {
    const service = new EcgProcessingService();

    const resultadoAnterior = processarPicosAUmSegundo(service, 250);

    expect(resultadoAnterior.quantidadePicosR).toBe(4);

    service.configurarTaxaAmostragem(500);

    const resultadoAposTroca = service.processarAmostra(0);

    expect(resultadoAposTroca.quantidadePicosR).toBe(0);
    expect(resultadoAposTroca.rr).toBeNull();
    expect(resultadoAposTroca.bpm).toBeNull();
  });
});

function processarPicosAUmSegundo(
  service: EcgProcessingService,
  taxaAmostragemHz: number,
): ResultadoECG {
  const indicesPico = [
    Math.round(taxaAmostragemHz * 0.4),
    Math.round(taxaAmostragemHz * 1.4),
    Math.round(taxaAmostragemHz * 2.4),
    Math.round(taxaAmostragemHz * 3.4),
  ];
  const ultimoIndice = Math.round(taxaAmostragemHz * 3.5);
  let resultado: ResultadoECG | null = null;

  for (let indice = 0; indice <= ultimoIndice; indice++) {
    resultado = service.processarAmostra(indicesPico.includes(indice) ? 1 : 0);
  }

  if (resultado === null) {
    throw new Error('O sinal de teste não contém amostras.');
  }

  return resultado;
}
