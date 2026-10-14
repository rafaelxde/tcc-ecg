# Integração de ECG por smartwatch

Este módulo é uma extensão acadêmica do protótipo. Ele recebe um traçado de ECG
de uma derivação já capturado por um smartwatch ou pelo aplicativo companheiro.
Ele não transforma dados de frequência cardíaca por PPG em ECG e não fornece
diagnóstico clínico.

## Importação por arquivo

O formato preferido é JSON. O leitor também aceita CSV legado, mas o CSV não
carrega automaticamente metadados como taxa de amostragem, dispositivo ou
qualidade do sinal.

```json
{
  "source": "smartwatch",
  "samplingHz": 500,
  "unit": "mV",
  "device": {
    "manufacturer": "Samsung",
    "model": "Galaxy Watch"
  },
  "lead": "I",
  "quality": "good",
  "recordedAt": "2026-10-13T10:00:00Z",
  "samples": [0.01, 0.03, 0.12, 0.84, 0.18, -0.06]
}
```

Campos aceitos:

- `samples` (ou `amostras`): lista ordenada de valores numéricos do ECG;
- `samplingHz`, `samplingRate`, `sampleRate` ou `frequenciaHz`: taxa entre
  50 e 2000 Hz;
- `unit`: `mV`, `uV` ou `normalized`;
- `device` / `dispositivo`: fabricante e modelo opcionais;
- `lead` / `derivacao`: por exemplo, `I`;
- `quality` / `qualidade`: `good`, `poor` ou `unknown`.

Se o dispositivo informar `poor`, o dashboard conserva o registro, mas bloqueia
a classificação e o apresenta como inconclusivo.

## Fluxo Firebase para aplicativo companheiro

O dashboard cria uma sessão privada ao selecionar **Preparar sessão**. A conta
precisa estar autenticada e com o e-mail confirmado. O aplicativo companheiro
deve autenticar o mesmo usuário no Firebase e publicar blocos ordenados neste
caminho:

```text
ecg_stream/{uid}/{sessionId}/blocos/{sequencia}
```

Exemplo de bloco:

```json
{
  "sessao": "sessionId exibido no dashboard",
  "sequencia": 0,
  "frequenciaHz": 500,
  "amostras": [0.01, 0.03, 0.12],
  "timestamp": 1791885600000,
  "origem": "Samsung Health Sensor SDK",
  "unidade": "mV",
  "derivacao": "I",
  "dispositivo": {
    "fabricante": "Samsung",
    "modelo": "Galaxy Watch"
  },
  "qualidade": "boa"
}
```

Cada sequência deve ser publicada apenas uma vez. A regra do Realtime Database
em `public/firebase-rules.json` limita leitura e escrita ao `uid` autenticado
com e-mail confirmado, valida a estrutura dos blocos e impede novos blocos
depois que a sessão é encerrada. Ela precisa ser publicada no projeto Firebase
antes do uso real.

Com a conta Firebase correta selecionada, a configuração `firebase.json`
permite publicar as regras com:

```bash
npx firebase-tools deploy --only database --project ecg-watch-tcc
```

## Limites do protótipo

- O detector foi validado com MIT-BIH; qualquer resultado de smartwatch é
  experimental e precisa de validação por modelo de dispositivo.
- Não misture ECG com sinais PPG de frequência cardíaca.
- A aplicação não deve ser usada para diagnóstico, tratamento ou alerta médico.
- ECG é dado pessoal sensível: colete consentimento e siga a LGPD antes de
  armazenar dados reais de participantes ou clientes.
