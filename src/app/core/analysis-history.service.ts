import {
  Injectable
} from '@angular/core';

import {
  Unsubscribe,
  onValue,
  ref,
  remove,
  set
} from 'firebase/database';

import {
  MetricasValidacaoPicos
} from './ecg-validation';

import {
  TipoRitmo
} from './ecg-processing';

import {
  type EcgSignalQuality
} from './ecg-recording';

import {
  database
} from './firebase';


export interface AnaliseSalva {
  id: string;
  usuarioUid: string;
  usuarioNome: string;
  usuarioEmail: string;
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
  dispositivo?: string | null;
  derivacao?: string | null;
  unidade?: string | null;
  qualidadeSinal?: EcgSignalQuality;
}


@Injectable({
  providedIn: 'root'
})
export class AnalysisHistoryService {

  async salvar(
    analise: AnaliseSalva
  ): Promise<void> {

    await set(
      ref(
        database,
        `analises/${analise.usuarioUid}/${analise.id}`
      ),
      analise
    );
  }


  escutarMinhasAnalises(
    uid: string,
    callback: (
      analises: AnaliseSalva[]
    ) => void
  ): Unsubscribe {

    const caminho =
      ref(
        database,
        `analises/${uid}`
      );

    return onValue(
      caminho,
      snapshot => {

        if (
          !snapshot.exists()
        ) {

          callback([]);
          return;
        }

        const valor =
          snapshot.val() as
            Record<string, AnaliseSalva>;

        const lista =
          Object.values(
            valor
          )
            .sort(
              (a, b) =>
                new Date(
                  b.geradoEm
                ).getTime() -
                new Date(
                  a.geradoEm
                ).getTime()
            );

        callback(
          lista
        );
      },
      erro => {

        console.error(
          'Não foi possível carregar o histórico de análises.',
          erro
        );

        callback([]);
      }
    );
  }


  async excluir(
    uid: string,
    analiseId: string
  ): Promise<void> {

    await remove(
      ref(
        database,
        `analises/${uid}/${analiseId}`
      )
    );
  }
}
