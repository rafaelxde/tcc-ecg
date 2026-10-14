# TccEcg

Protótipo acadêmico em Angular para visualização e análise experimental de ECG.
Ele inclui simulador, importação de dados MIT-BIH, validação de picos R e um
módulo de importação/recepção de ECG de smartwatch.

> Importante: o resultado é apoio acadêmico e não substitui avaliação médica.

## Smartwatch

O dashboard aceita uma exportação CSV/JSON de ECG e respeita a taxa de
amostragem declarada pela origem. Também pode criar uma sessão privada no
Firebase para um aplicativo companheiro autenticado com o mesmo usuário.

Veja [a especificação de integração](docs/INTEGRACAO_SMARTWATCH.md) antes de
conectar um dispositivo real.

## Login e privacidade

O simulador e os arquivos de validação podem ser usados localmente. Histórico,
relatórios persistidos e dados de smartwatch exigem uma conta Firebase com
e-mail confirmado. Ao sair, o app encerra a sessão do smartwatch e remove o
relatório temporário deste navegador.

Depois de alterar `public/firebase-rules.json`, publique as regras no projeto
certo:

```bash
npx firebase-tools deploy --only database --project ecg-watch-tcc
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
