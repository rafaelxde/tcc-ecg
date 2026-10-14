"""
Exporta um trecho da MIT-BIH Arrhythmia Database para:

1) CSV de ECG reamostrado para 250 Hz
2) JSON com as anotações de referência (.atr) do mesmo trecho

Dependências:
    python -m pip install wfdb scipy numpy

Exemplo:
    python .\src\exportar_mitbih_com_anotacoes.py --record 100 --inicio 0 --duracao 30
"""

import argparse
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import wfdb
from scipy.signal import resample_poly


FS_DESTINO = 250

SIMBOLOS_BATIMENTO = {
    "N", "L", "R", "B",
    "A", "a", "J", "S",
    "V", "r", "F",
    "e", "j", "n",
    "E", "/", "f", "Q"
}


def exportar(
    record_name: str,
    inicio_s: float,
    duracao_s: float,
    pasta_saida: Path,
) -> None:
    cabecalho = wfdb.rdheader(
        record_name,
        pn_dir="mitdb"
    )

    fs_origem = int(round(cabecalho.fs))

    inicio_amostra = int(round(inicio_s * fs_origem))
    fim_amostra = int(round((inicio_s + duracao_s) * fs_origem))

    registro = wfdb.rdrecord(
        record_name,
        pn_dir="mitdb",
        sampfrom=inicio_amostra,
        sampto=fim_amostra,
        physical=True,
    )

    if registro.p_signal is None or registro.p_signal.size == 0:
        raise RuntimeError("O registro não retornou amostras de ECG.")

    sinal = np.asarray(
        registro.p_signal[:, 0],
        dtype=float
    )

    if np.isnan(sinal).any():
        mediana = float(np.nanmedian(sinal))
        sinal = np.nan_to_num(sinal, nan=mediana)

    if fs_origem != FS_DESTINO:
        divisor = math.gcd(fs_origem, FS_DESTINO)
        up = FS_DESTINO // divisor
        down = fs_origem // divisor
        sinal_250 = resample_poly(sinal, up, down)
    else:
        sinal_250 = sinal

    tempo = np.arange(
        len(sinal_250),
        dtype=float
    ) / FS_DESTINO

    pasta_saida.mkdir(
        parents=True,
        exist_ok=True
    )

    prefixo = (
        f"mitbih_{record_name}_"
        f"{str(inicio_s).replace('.', '_')}s_"
        f"{str(duracao_s).replace('.', '_')}s_250hz"
    )

    csv_saida = pasta_saida / f"{prefixo}.csv"
    json_saida = pasta_saida / f"{prefixo}_anotacoes.json"

    with csv_saida.open(
        "w",
        encoding="utf-8",
        newline=""
    ) as arquivo:
        arquivo.write("time,ecg\n")

        for t, valor in zip(tempo, sinal_250):
            arquivo.write(
                f"{t:.3f},{valor:.6f}\n"
            )

    anotacoes = wfdb.rdann(
        record_name,
        "atr",
        pn_dir="mitdb"
    )

    samples = np.asarray(
        anotacoes.sample,
        dtype=int
    )

    simbolos = list(anotacoes.symbol)

    aux_notes = list(
        anotacoes.aux_note
        if anotacoes.aux_note is not None
        else [""] * len(samples)
    )

    mascara = (
        (samples >= inicio_amostra) &
        (samples < fim_amostra)
    )

    indices = np.where(mascara)[0]

    lista_anotacoes = []
    simbolos_batimentos_segmento = []
    ritmos_encontrados = []

    for idx in indices:
        sample_original = int(samples[idx])
        sample_relativo = sample_original - inicio_amostra

        sample_250 = int(
            round(
                sample_relativo *
                FS_DESTINO /
                fs_origem
            )
        )

        simbolo = str(simbolos[idx])
        aux = str(aux_notes[idx] or "")

        eh_batimento = simbolo in SIMBOLOS_BATIMENTO

        if eh_batimento:
            simbolos_batimentos_segmento.append(
                simbolo
            )

        if aux.startswith("("):
            ritmos_encontrados.append(
                aux
            )

        lista_anotacoes.append({
            "sample_original": sample_original,
            "sample_relativo_original": sample_relativo,
            "sample_250hz": sample_250,
            "tempo_relativo_s": round(
                sample_relativo / fs_origem,
                6
            ),
            "simbolo": simbolo,
            "aux_note": aux,
            "eh_batimento": eh_batimento,
        })

    resumo_batimentos = dict(
        Counter(
            simbolos_batimentos_segmento
        )
    )

    resumo_ritmos = dict(
        Counter(
            ritmos_encontrados
        )
    )

    payload = {
        "record": record_name,
        "database": "MIT-BIH Arrhythmia Database",
        "annotator": "atr",
        "inicio_segmento_s": inicio_s,
        "duracao_segmento_s": duracao_s,
        "frequencia_original_hz": fs_origem,
        "frequencia_exportada_hz": FS_DESTINO,
        "total_amostras_ecg": int(len(sinal_250)),
        "total_anotacoes_segmento": int(len(lista_anotacoes)),
        "total_batimentos_referencia": int(
            len(simbolos_batimentos_segmento)
        ),
        "resumo_simbolos_batimento": resumo_batimentos,
        "resumo_ritmos_aux": resumo_ritmos,
        "annotations": lista_anotacoes,
    }

    with json_saida.open(
        "w",
        encoding="utf-8"
    ) as arquivo:
        json.dump(
            payload,
            arquivo,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("Exportação concluída.")
    print(f"Registro MIT-BIH: {record_name}")
    print(
        f"Trecho: {inicio_s:.2f}s até "
        f"{inicio_s + duracao_s:.2f}s"
    )
    print(f"Frequência original: {fs_origem} Hz")
    print(f"Frequência exportada: {FS_DESTINO} Hz")
    print(f"Amostras ECG: {len(sinal_250)}")
    print(
        "Batimentos de referência no trecho: "
        f"{len(simbolos_batimentos_segmento)}"
    )
    print(
        "Resumo dos símbolos de batimento: "
        f"{resumo_batimentos}"
    )

    if resumo_ritmos:
        print(
            "Rótulos de ritmo encontrados: "
            f"{resumo_ritmos}"
        )
    else:
        print(
            "Nenhum rótulo auxiliar de mudança de ritmo "
            "foi encontrado neste trecho."
        )

    print()
    print(f"CSV:  {csv_saida.resolve()}")
    print(f"JSON: {json_saida.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Exporta ECG e anotações oficiais da MIT-BIH."
        )
    )

    parser.add_argument(
        "--record",
        default="100",
        help="Registro MIT-BIH, por exemplo 100, 101, 200."
    )

    parser.add_argument(
        "--inicio",
        type=float,
        default=0.0,
        help="Segundo inicial do trecho."
    )

    parser.add_argument(
        "--duracao",
        type=float,
        default=30.0,
        help="Duração em segundos."
    )

    parser.add_argument(
        "--pasta",
        default="dados_mitbih",
        help="Pasta onde CSV e JSON serão salvos."
    )

    args = parser.parse_args()

    if args.inicio < 0:
        raise SystemExit(
            "--inicio não pode ser negativo."
        )

    if args.duracao <= 0:
        raise SystemExit(
            "--duracao deve ser maior que zero."
        )

    exportar(
        record_name=args.record,
        inicio_s=args.inicio,
        duracao_s=args.duracao,
        pasta_saida=Path(args.pasta),
    )


if __name__ == "__main__":
    main()
