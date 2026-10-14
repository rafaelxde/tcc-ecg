import {
  Injectable
} from '@angular/core';

import {
  onChildAdded,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  update,
  type Unsubscribe
} from 'firebase/database';

import {
  database
} from './firebase';


export type QualidadeSinalECG =
  | 'boa'
  | 'baixa'
  | 'desconhecida';


export interface DispositivoECG {
  fabricante?: string;
  modelo?: string;
  firmware?: string;
}


export interface BlocoECGFirebase {
  sessao: string;
  sequencia: number;
  frequenciaHz: number;
  amostras: number[];
  timestamp: number;
  origem: string;
  registro?: string;
  unidade?: 'mV' | 'uV' | 'normalizado';
  derivacao?: string;
  dispositivo?: DispositivoECG;
  qualidade?: QualidadeSinalECG;
}


export interface SessaoECGFirebase {
  id: string;
  usuarioUid: string;
  criadaEm: number;
  origem: string;
  frequenciaHz?: number;
  unidade?: 'mV' | 'uV' | 'normalizado';
  derivacao?: string;
  dispositivo?: DispositivoECG;
  qualidade?: QualidadeSinalECG;
  status: 'ativa' | 'encerrada';
}


@Injectable({
  providedIn: 'root'
})
export class FirebaseEcgService {

  private readonly maximoAmostrasPorBloco =
    5000;

  /*
   * Caminho legado mantido apenas para demonstrações já existentes.
   * Novas sessões devem usar ecg_stream/{uid}/{sessao}/blocos.
   */
  private readonly caminhoLegado =
    'ecg_stream/bloco_atual';


  escutarBlocos(
    callback: (
      bloco: BlocoECGFirebase
    ) => void
  ): Unsubscribe {

    const blocoRef =
      ref(
        database,
        this.caminhoLegado
      );

    return onValue(
      blocoRef,
      snapshot => {

        if (!snapshot.exists()) {
          return;
        }

        const bloco =
          this.normalizarBloco(
            snapshot.val()
          );

        if (bloco) {
          callback(bloco);
        }
      }
    );
  }


  async criarSessao(
    usuarioUid: string,
    dados: Omit<
      SessaoECGFirebase,
      'id' | 'usuarioUid' | 'criadaEm' | 'status'
    > = {
      origem: 'Smartwatch'
    }
  ): Promise<SessaoECGFirebase> {

    if (!usuarioUid) {
      throw new Error(
        'Não foi possível criar uma sessão sem usuário autenticado.'
      );
    }

    const sessoesRef =
      ref(
        database,
        `ecg_stream/${usuarioUid}`
      );

    const sessaoRef =
      push(sessoesRef);

    if (!sessaoRef.key) {
      throw new Error(
        'Não foi possível gerar o identificador da sessão.'
      );
    }

    const sessao: SessaoECGFirebase = {
      id: sessaoRef.key,
      usuarioUid,
      criadaEm: Date.now(),
      origem: dados.origem,
      frequenciaHz: dados.frequenciaHz,
      unidade: dados.unidade,
      derivacao: dados.derivacao,
      dispositivo: dados.dispositivo,
      qualidade: dados.qualidade ?? 'desconhecida',
      status: 'ativa'
    };

    await set(
      ref(
        database,
        `ecg_stream/${usuarioUid}/${sessao.id}/metadados`
      ),
      sessao
    );

    return sessao;
  }


  escutarSessao(
    usuarioUid: string,
    sessaoId: string,
    callback: (
      bloco: BlocoECGFirebase
    ) => void,
    aoErro?: (
      erro: Error
    ) => void
  ): Unsubscribe {

    const blocosRef =
      query(
        ref(
          database,
          `ecg_stream/${usuarioUid}/${sessaoId}/blocos`
        ),
        orderByChild('sequencia')
      );

    return onChildAdded(
      blocosRef,
      snapshot => {

        const bloco =
          this.normalizarBloco(
            snapshot.val(),
            sessaoId
          );

        if (bloco) {
          callback(bloco);
        }
      },
      erro => {
        aoErro?.(
          erro as Error
        );
      }
    );
  }


  async enviarBlocoParaSessao(
    usuarioUid: string,
    sessaoId: string,
    bloco: BlocoECGFirebase
  ): Promise<void> {

    const blocoNormalizado =
      this.normalizarBloco(
        {
          ...bloco,
          sessao: sessaoId
        },
        sessaoId
      );

    if (!blocoNormalizado) {
      throw new Error(
        'Bloco de ECG inválido.'
      );
    }

    await set(
      ref(
        database,
        `ecg_stream/${usuarioUid}/${sessaoId}/blocos/${blocoNormalizado.sequencia}`
      ),
      blocoNormalizado
    );
  }


  async encerrarSessao(
    usuarioUid: string,
    sessaoId: string
  ): Promise<void> {

    await update(
      ref(
        database,
        `ecg_stream/${usuarioUid}/${sessaoId}/metadados`
      ),
      {
        status: 'encerrada',
        encerradaEm: Date.now()
      }
    );
  }


  /*
   * Compatibilidade com o publicador antigo do protótipo.
   * Não usar para novas integrações porque ele sobrescreve o último bloco.
   */
  async enviarBloco(
    bloco: BlocoECGFirebase
  ): Promise<void> {

    const blocoRef =
      ref(
        database,
        this.caminhoLegado
      );

    await set(
      blocoRef,
      bloco
    );
  }


  private normalizarBloco(
    dados: unknown,
    sessaoPadrao = 'sessao-desconhecida'
  ): BlocoECGFirebase | null {

    if (!dados || typeof dados !== 'object') {
      return null;
    }

    const valor =
      dados as Record<string, unknown>;

    if (!Array.isArray(valor['amostras'])) {
      return null;
    }

    const amostras =
      valor['amostras']
        .map(
          item => Number(item)
        )
        .filter(
          item => Number.isFinite(item)
        );

    const frequenciaHz =
      Number(
        valor['frequenciaHz'] ?? 250
      );

    const sequencia =
      Number(
        valor['sequencia'] ?? 0
      );

    if (
      amostras.length === 0 ||
      amostras.length > this.maximoAmostrasPorBloco ||
      !Number.isFinite(frequenciaHz) ||
      frequenciaHz <= 0 ||
      !Number.isInteger(sequencia) ||
      sequencia < 0
    ) {
      return null;
    }

    return {
      sessao: String(
        valor['sessao'] ?? sessaoPadrao
      ),
      sequencia,
      frequenciaHz,
      amostras,
      timestamp: Number(
        valor['timestamp'] ?? Date.now()
      ),
      origem: String(
        valor['origem'] ?? 'Firebase'
      ),
      registro: valor['registro']
        ? String(valor['registro'])
        : undefined,
      unidade: this.normalizarUnidade(
        valor['unidade']
      ),
      derivacao: valor['derivacao']
        ? String(valor['derivacao'])
        : undefined,
      dispositivo: this.normalizarDispositivo(
        valor['dispositivo']
      ),
      qualidade: this.normalizarQualidade(
        valor['qualidade']
      )
    };
  }


  private normalizarUnidade(
    valor: unknown
  ): BlocoECGFirebase['unidade'] {

    return valor === 'mV' ||
      valor === 'uV' ||
      valor === 'normalizado'
        ? valor
        : undefined;
  }


  private normalizarQualidade(
    valor: unknown
  ): QualidadeSinalECG {

    return valor === 'boa' ||
      valor === 'baixa'
        ? valor
        : 'desconhecida';
  }


  private normalizarDispositivo(
    valor: unknown
  ): DispositivoECG | undefined {

    if (!valor || typeof valor !== 'object') {
      return undefined;
    }

    const dispositivo =
      valor as Record<string, unknown>;

    return {
      fabricante: dispositivo['fabricante']
        ? String(dispositivo['fabricante'])
        : undefined,
      modelo: dispositivo['modelo']
        ? String(dispositivo['modelo'])
        : undefined,
      firmware: dispositivo['firmware']
        ? String(dispositivo['firmware'])
        : undefined
    };
  }
}
