"""
Exportador de segmentos reais da MIT-BIH Arrhythmia Database
para CSV compatível com o protótipo ECG Watch.

Uso:
    python exportar_mitbih.py --record 100 --inicio 0 --duracao 30

Dependências:
    pip install wfdb scipy numpy

O script:
1. baixa o registro diretamente da PhysioNet via WFDB;
2. lê o primeiro canal de ECG;
3. converte de 360 Hz para 250 Hz;
4. salva CSV no formato:
       time,ecg
       0.000,0.123456
       ...
"""

import argparse
from pathlib import Path

import numpy as np
import wfdb
from scipy.signal import resample_poly


FS_DESTINO = 250


def exportar_registro(
    record_name: str,
    inicio_s: float,
    duracao_s: float,
    saida: Path,
) -> None:
    # Lê o cabeçalho primeiro para descobrir a frequência original.
    cabecalho = wfdb.rdheader(record_name, pn_dir="mitdb")
    fs_origem = int(round(cabecalho.fs))

    inicio_amostra = int(round(inicio_s * fs_origem))
    fim_amostra = int(round((inicio_s + duracao_s) * fs_origem))

    # Baixa apenas o trecho necessário do registro.
    registro = wfdb.rdrecord(
        record_name,
        pn_dir="mitdb",
        sampfrom=inicio_amostra,
        sampto=fim_amostra,
        physical=True,
    )

    if registro.p_signal is None or registro.p_signal.size == 0:
        raise RuntimeError("O registro não retornou amostras de ECG.")

    # Usa o primeiro canal disponível.
    sinal = np.asarray(registro.p_signal[:, 0], dtype=float)

    # Remove valores inválidos, se existirem.
    if np.isnan(sinal).any():
        sinal = np.nan_to_num(sinal, nan=float(np.nanmedian(sinal)))

    # MIT-BIH usa 360 Hz. O protótipo atual trabalha em 250 Hz,
    # então fazemos reamostragem preservando o formato do sinal.
    if fs_origem != FS_DESTINO:
        # 360 -> 250 = fator 25/36.
        # Para outros valores, calculamos uma razão inteira simplificada.
        import math

        divisor = math.gcd(fs_origem, FS_DESTINO)
        up = FS_DESTINO // divisor
        down = fs_origem // divisor

        sinal = resample_poly(sinal, up, down)

    tempo = np.arange(len(sinal), dtype=float) / FS_DESTINO

    saida.parent.mkdir(parents=True, exist_ok=True)

    with saida.open("w", encoding="utf-8", newline="") as arquivo:
        arquivo.write("time,ecg\n")

        for t, valor in zip(tempo, sinal):
            arquivo.write(f"{t:.3f},{valor:.6f}\n")

    print()
    print("ECG exportado com sucesso.")
    print(f"Registro MIT-BIH: {record_name}")
    print(f"Trecho original: {inicio_s:.2f}s até {inicio_s + duracao_s:.2f}s")
    print(f"Frequência original: {fs_origem} Hz")
    print(f"Frequência exportada: {FS_DESTINO} Hz")
    print(f"Amostras exportadas: {len(sinal)}")
    print(f"Arquivo: {saida.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Exporta trecho da MIT-BIH para CSV a 250 Hz."
    )

    parser.add_argument(
        "--record",
        default="100",
        help="Registro MIT-BIH, por exemplo: 100, 101, 200.",
    )

    parser.add_argument(
        "--inicio",
        type=float,
        default=0.0,
        help="Segundo inicial do trecho.",
    )

    parser.add_argument(
        "--duracao",
        type=float,
        default=30.0,
        help="Duração do trecho em segundos.",
    )

    parser.add_argument(
        "--saida",
        default=None,
        help="Nome do CSV de saída.",
    )

    args = parser.parse_args()

    if args.inicio < 0:
        raise SystemExit("--inicio não pode ser negativo.")

    if args.duracao <= 0:
        raise SystemExit("--duracao deve ser maior que zero.")

    if args.saida:
        saida = Path(args.saida)
    else:
        inicio_txt = str(args.inicio).replace(".", "_")
        duracao_txt = str(args.duracao).replace(".", "_")
        saida = Path(
            f"mitbih_{args.record}_{inicio_txt}s_{duracao_txt}s_250hz.csv"
        )

    exportar_registro(
        record_name=args.record,
        inicio_s=args.inicio,
        duracao_s=args.duracao,
        saida=saida,
    )


if __name__ == "__main__":
    main()
