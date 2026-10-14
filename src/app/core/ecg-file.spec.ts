import { EcgFileService } from './ecg-file';
import {
  describe,
  expect,
  it
} from 'vitest';


function criarArquivo(
  nome: string,
  conteudo: string
): File {

  return {
    name: nome,
    text: async () =>
      conteudo
  } as File;
}


describe('EcgFileService', () => {

  const service =
    new EcgFileService();


  it('normaliza um CSV legado e respeita a origem informada', async () => {

    const gravacao =
      await service.lerGravacao(
        criarArquivo(
          'ecg-legado.csv',
          'tempo;ecg\n0;0.10\n0.004;0.25'
        ),
        'smartwatch'
      );


    expect(
      gravacao
    ).toEqual({
      samples: [
        0.10,
        0.25
      ],
      samplingHz: 250,
      unit: 'normalized',
      source: 'smartwatch',
      device: null,
      lead: null,
      quality: 'unknown',
      metadata: {
        importedFileName:
          'ecg-legado.csv',
        importedFormat:
          'csv'
      }
    });
  });


  it('lê os metadados de uma exportação de smartwatch', async () => {

    const gravacao =
      await service.lerGravacao(
        criarArquivo(
          'galaxy-watch.json',
          JSON.stringify({
            samples: [
              0.01,
              '0.02',
              'inválida',
              0.03
            ],
            samplingHz: 500,
            unit: 'µV',
            source: 'Galaxy Watch',
            device: {
              manufacturer: 'Samsung',
              model: 'Galaxy Watch6'
            },
            lead: 'lead1',
            quality: 'boa',
            recordedAt: '2026-10-13T09:00:00-03:00',
            sessionId: 'sessao-123',
            metadata: {
              firmware: '1.0.0'
            }
          })
        )
      );


    expect(
      gravacao.samples
    ).toEqual([
      0.01,
      0.02,
      0.03
    ]);

    expect(
      gravacao.samplingHz
    ).toBe(500);

    expect(
      gravacao.unit
    ).toBe('uV');

    expect(
      gravacao.source
    ).toBe('smartwatch');

    expect(
      gravacao.device
    ).toEqual({
      manufacturer: 'Samsung',
      model: 'Galaxy Watch6'
    });

    expect(
      gravacao.lead
    ).toBe('I');

    expect(
      gravacao.quality
    ).toBe('good');

    expect(
      gravacao.metadata
    ).toEqual({
      firmware: '1.0.0',
      recordedAt: '2026-10-13T09:00:00-03:00',
      sessionId: 'sessao-123',
      importedFileName: 'galaxy-watch.json',
      importedFormat: 'json'
    });
  });


  it('mantém lerArquivo como compatibilidade para consumidores legados', async () => {

    await expect(
      service.lerArquivo(
        criarArquivo(
          'amostras.json',
          '[0.1, 0.2, 0.3]'
        )
      )
    ).resolves.toEqual([
      0.1,
      0.2,
      0.3
    ]);
  });


  it('rejeita uma taxa de amostragem inválida', async () => {

    await expect(
      service.lerGravacao(
        criarArquivo(
          'invalido.json',
          JSON.stringify({
            samples: [
              0.1
            ],
            samplingHz: 0
          })
        )
      )
    ).rejects.toThrow(
      'A taxa de amostragem deve ser um número maior que zero.'
    );
  });
});
