# GitOps Portfolio — System Design com AWS Lambda

**Versão:** 1.0.0  
**Stack:** GitHub Pages · GitHub Actions · AWS API Gateway · Lambda · S3 · CloudWatch  
**Estratégia:** GitOps com múltiplos runtimes Lambda  

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura e Componentes](#2-arquitetura-e-componentes)
3. [Dois Fluxos Independentes](#3-dois-fluxos-independentes)
4. [Fluxo Completo de uma Release](#4-fluxo-completo-de-uma-release)
5. [Estrutura de Repositórios](#5-estrutura-de-repositórios)
6. [Configuração AWS](#6-configuração-aws)
7. [GitHub Actions Workflows](#7-github-actions-workflows)
8. [GitHub Pages e Dados em Runtime](#8-github-pages-e-dados-em-runtime)
9. [Release Notes Automáticas](#9-release-notes-automáticas)
10. [Segurança e IAM](#10-segurança-e-iam)
11. [Custos Estimados](#11-custos-estimados)
12. [Decisões de Design (ADRs)](#12-decisões-de-design-adrs)

---

## 1. Visão Geral

Este sistema implementa um **portfolio GitOps totalmente automatizado** com dois fluxos independentes por projeto: um para **documentação** e outro para **changelogs**. Cada um tem seu próprio gatilho, ciclo de vida e seção dedicada no portfolio.

| Fluxo | Gatilho | O que atualiza |
|---|---|---|
| Documentação | Push em `docs/` no repo do projeto | Página de documentação do projeto no portfolio |
| Changelog | `git tag vX.Y.Z` no repo do projeto | Release notes + deploy da Lambda no AWS |

A separação é intencional: você pode melhorar a documentação de um projeto existente sem criar uma nova release, e pode fazer uma release sem precisar reescrever a documentação.

### Princípios GitOps aplicados

| Princípio | Implementação |
|---|---|
| Git como fonte de verdade | `portfolio-hub` é o único lugar onde o estado é declarado |
| Automação completa | Zero intervenção manual entre `git tag` e portfolio publicado |
| Imutabilidade | Cada release é versionada e rastreável via Git history |
| Reconciliação contínua | Actions monitora todos os repos e mantém o hub sincronizado |

### O que acontece em cada fluxo

**Fluxo de documentação** — disparado por push em `docs/` (~1 min):

```
git push (alteração em docs/)
          │
          ▼
  GitHub Actions detecta mudança em docs/
          │
          ▼
  Dispatch: update-docs → portfolio-hub
          │
          ▼
  portfolio-hub atualiza docs/meu-projeto.md
          │
          ▼
  GitHub Pages atualizado com:
  ✓ Documentação revisada do projeto
  ✓ Seção de arquitetura, uso e exemplos
```

**Fluxo de changelog** — disparado por `git tag` (~2 min):

```
git tag v1.0.0 && git push --tags
          │
          ▼
  GitHub Actions CI dispara
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
Deploy Lambda   Dispatch: new-release → portfolio-hub
no AWS          │
                ▼
          portfolio-hub atualiza
          changelogs/meu-projeto.md
                │
                ▼
          GitHub Pages atualizado com:
          ✓ Nova entrada no changelog
          ✓ Link para a Lambda ao vivo
          ✓ Status de saúde em tempo real
```

---

## 2. Arquitetura e Componentes

### Camadas do sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│ GITHUB ECOSYSTEM                                                     │
│                                                                      │
│  Project Repos ──► GitHub Actions CI ──────────────────────────┐    │
│  (repo-a, repo-b)       │                                       │    │
│                         │ repository_dispatch                   │    │
│                         ▼                                       │    │
│                   portfolio-hub                                 │    │
│                   (source of truth)                             │    │
│                         │                                       │    │
│                         ▼                                       │    │
│                   Actions Deploy ──► GitHub Pages               │    │
│                         │           (portfolio estático)        │    │
│                         │                    │                  │    │
│                         │ upload JSON        │ fetch (runtime)  │    │
└─────────────────────────┼────────────────────┼──────────────────┘    │
                          │                    │                        │
┌─────────────────────────▼────────────────────▼──────────────────┐    │
│ AWS                                                              │◄───┘
│                                                                  │  deploy fn
│  S3 Bucket ◄──── Actions Deploy                                  │
│  projects/*.json                                                 │
│                                                                  │
│  API Gateway ◄────────────────────── GitHub Pages (fetch)        │
│       │                                                          │
│       ▼                                                          │
│  Lambda functions  (Node · Python · Go · qualquer runtime)       │
│       │                                                          │
│       ▼                                                          │
│  CloudWatch  (logs · métricas · alertas)                         │
└──────────────────────────────────────────────────────────────────┘
```

### Componentes detalhados

**GitHub Ecosystem**

| Componente | Função |
|---|---|
| `repo-projeto-*` | Código-fonte de cada projeto individual com seu próprio workflow |
| `portfolio-hub` | Repositório central: agrega JSONs e Markdowns de todos os projetos |
| GitHub Actions CI | Disparado por tag: builda, testa, empacota e faz deploy da Lambda |
| GitHub Actions Deploy | Disparado por push no hub: reconstrói o Astro e publica no Pages |
| GitHub Pages | Serve o portfolio estático com HTTPS via `usuario.github.io` |

**AWS**

| Serviço | Função | Custo base |
|---|---|---|
| **API Gateway** | Expõe um endpoint REST público para cada projeto | $3.50/milhão de requisições |
| **Lambda** | Executa o código de cada projeto sem servidor | $0.20/milhão de invocações |
| **S3** | Armazena os `projects/*.json` com metadados | ~$0.023/GB/mês |
| **CloudWatch** | Coleta logs e métricas das Lambdas | $0.50/GB de logs ingeridos |
| **IAM** | Controla permissões entre serviços | Gratuito |

---

## 3. Dois Fluxos Independentes

O coração do design está na separação entre o que muda frequentemente (documentação) e o que representa marcos formais (releases). Cada fluxo tem seu próprio evento de dispatch, sua própria pasta no `portfolio-hub` e sua própria seção na página do projeto.

### Fluxo 1 — Documentação

**Gatilho:** qualquer push que altere arquivos dentro de `docs/` no repo do projeto.

**O que contém `docs/`:**
- `docs/README.md` — visão geral, motivação, casos de uso
- `docs/architecture.md` — decisões técnicas, diagramas, trade-offs
- `docs/usage.md` — como rodar localmente, exemplos de requisição/resposta
- `docs/api.md` — contrato da API, parâmetros, erros (opcional)

**Evento de dispatch enviado:**
```json
{
  "event-type": "update-docs",
  "client-payload": {
    "project": "meu-projeto",
    "docs_path": "docs/",
    "repo_url": "https://github.com/usuario/meu-projeto",
    "commit_sha": "a1b2c3d",
    "updated_at": "2025-04-20T10:00:00Z"
  }
}
```

**O que o portfolio-hub faz ao receber:**
1. Faz fetch de cada arquivo em `docs/` via API do GitHub
2. Salva em `docs/meu-projeto/` no hub
3. Atualiza o campo `docs_updated_at` no `projects/meu-projeto.json`
4. Commit e push → Actions Deploy reconstrói o site

**Resultado no portfolio:** a seção de documentação da página do projeto é atualizada sem criar nenhuma release, sem alterar o changelog, sem re-deployar a Lambda.

---

### Fluxo 2 — Changelog

**Gatilho:** criação de uma tag semântica (`v*.*.*`) no repo do projeto.

**O que contém `CHANGELOG.md`:**
Cada entrada no changelog corresponde a uma versão e descreve o que mudou. O arquivo fica na raiz do projeto e segue o padrão Keep a Changelog (detalhado na seção 9).

**Evento de dispatch enviado:**
```json
{
  "event-type": "new-release",
  "client-payload": {
    "project": "meu-projeto",
    "version": "v2.1.0",
    "runtime": "python3.12",
    "api_endpoint": "https://abc123.execute-api.sa-east-1.amazonaws.com/prod/meu-projeto",
    "repo_url": "https://github.com/usuario/meu-projeto",
    "updated_at": "2025-04-20T14:32:00Z"
  }
}
```

**O que o portfolio-hub faz ao receber:**
1. Atualiza `projects/meu-projeto.json` com nova versão e endpoint
2. Faz fetch do `CHANGELOG.md` do repo e salva em `changelogs/meu-projeto.md`
3. Commit e push → Actions Deploy reconstrói o site

**Resultado no portfolio:** nova entrada no changelog do projeto com versão, data e descrição das mudanças. A Lambda ao vivo já está deployada e respondendo antes mesmo do portfolio ser atualizado.

---

### Como os dois fluxos se complementam na página do projeto

A página de cada projeto no portfolio é dividida em duas abas ou seções distintas:

```
┌─────────────────────────────────────────────────────┐
│  meu-projeto                              v2.1.0 ●  │
│  Breve descrição do projeto                          │
├─────────────────────┬───────────────────────────────┤
│  DOCUMENTAÇÃO       │  CHANGELOG                    │
│                     │                               │
│  > Visão geral      │  v2.1.0 — 2025-04-20          │
│  > Arquitetura      │  + Endpoint /analyze           │
│  > Como usar        │  ~ Timeout aumentado           │
│  > API reference    │                               │
│                     │  v2.0.0 — 2025-03-15          │
│                     │  + Reescrita em Python 3.12   │
│                     │  + Integração Bedrock         │
├─────────────────────┴───────────────────────────────┤
│  Demo ao vivo: [Testar endpoint]   Latência: 142ms  │
└─────────────────────────────────────────────────────┘
```

A documentação é atualizada de forma contínua. O changelog só cresce a cada release formal. Os dois são independentes — você pode ter uma documentação excelente em um projeto em v0.1.0, ou um changelog longo em um projeto com documentação mínima.

---

## 4. Fluxo Completo de uma Release

### Passo a passo detalhado

```
1. Developer
   └─ git tag v2.1.0 && git push --tags
          │
2. GitHub Actions CI (no repo do projeto)
   ├─ Checkout do código
   ├─ Build do projeto (make build / npm run build / go build)
   ├─ Testes automatizados
   ├─ Empacota função em .zip (ou container image)
   ├─ aws lambda update-function-code --zip-file ...
   ├─ aws lambda publish-version
   └─ repository-dispatch → portfolio-hub
          │
3. portfolio-hub recebe o evento
   ├─ Atualiza projects/meu-projeto.json com nova versão
   ├─ Copia CHANGELOG.md do projeto para changelogs/meu-projeto.md
   └─ git commit + git push
          │
4. GitHub Actions Deploy (no portfolio-hub)
   ├─ Lê todos os projects/*.json
   ├─ Gera páginas Astro para cada projeto
   ├─ Renderiza changelogs/*.md como release notes
   ├─ Upload do projects.json consolidado para o S3
   └─ Deploy para GitHub Pages (gh-pages branch)
          │
5. Visitor acessa o portfolio
   ├─ HTML estático carrega do GitHub Pages
   ├─ JavaScript faz fetch para API Gateway do projeto
   ├─ API Gateway roteia para a Lambda correta
   ├─ Lambda responde com dados ao vivo
   └─ Portfolio exibe status: online / latência / versão
```

---

## 5. Estrutura de Repositórios

### Repositório de cada projeto

```
repo-meu-projeto/
├── .github/
│   └── workflows/
│       ├── release.yml          ← fluxo 2: disparado por git tag
│       └── docs.yml             ← fluxo 1: disparado por push em docs/
├── src/                         ← código do projeto
├── docs/                        ← fluxo 1: documentação contínua
│   ├── README.md                ← visão geral, motivação, casos de uso
│   ├── architecture.md          ← decisões técnicas, diagramas
│   ├── usage.md                 ← como rodar, exemplos de request/response
│   └── api.md                   ← contrato da API (opcional)
├── CHANGELOG.md                 ← fluxo 2: atualizado a cada release
├── template.yaml                ← SAM template para deploy da Lambda
└── Makefile                     ← targets: build, test, package
```

### portfolio-hub

```
portfolio-hub/
├── .github/
│   └── workflows/
│       ├── receive-docs.yml     ← escuta evento update-docs
│       ├── receive-release.yml  ← escuta evento new-release
│       └── deploy.yml           ← reconstrói e publica o site
├── projects/
│   ├── projeto-a.json           ← metadados: versão, endpoint, runtime, datas
│   ├── projeto-b.json
│   └── projeto-n.json
├── docs/                        ← fluxo 1: documentação de cada projeto
│   ├── projeto-a/
│   │   ├── README.md
│   │   ├── architecture.md
│   │   └── usage.md
│   └── projeto-b/
│       └── README.md
├── changelogs/                  ← fluxo 2: changelog de cada projeto
│   ├── projeto-a.md
│   └── projeto-b.md
└── src/                         ← código do site Astro
    ├── pages/
    │   ├── index.astro
    │   └── projects/
    │       └── [slug].astro     ← página gerada por projeto (docs + changelog)
    ├── components/
    │   ├── ProjectCard.astro
    │   ├── ProjectDocs.astro    ← renderiza docs/ do projeto
    │   ├── ProjectChangelog.astro ← renderiza changelogs/*.md
    │   └── LiveStatus.astro     ← faz fetch na Lambda em runtime
    └── content/
        └── projects/            ← Astro Content Collections dos JSONs
```

### Formato do `projects/meu-projeto.json`

```json
{
  "name": "meu-projeto",
  "display_name": "Meu Projeto",
  "description": "Breve descrição do que o projeto faz",
  "version": "2.1.0",
  "runtime": "python3.12",
  "tags": ["api", "machine-learning", "python"],
  "api_endpoint": "https://abc123.execute-api.sa-east-1.amazonaws.com/prod/meu-projeto",
  "repo_url": "https://github.com/usuario/meu-projeto",
  "region": "sa-east-1",
  "docs_updated_at": "2025-04-20T10:00:00Z",
  "changelog_updated_at": "2025-04-20T14:32:00Z"
}
```

Os dois campos de data são atualizados por fluxos separados: `docs_updated_at` pelo workflow de documentação, `changelog_updated_at` pelo workflow de release. Isso permite exibir no portfolio quando cada seção foi atualizada pela última vez de forma independente.

---

## 6. Configuração AWS

### Pré-requisitos

```bash
# Instalar AWS CLI e SAM CLI
brew install awscli aws-sam-cli

# Configurar credenciais
aws configure
# AWS Access Key ID: [sua key]
# AWS Secret Access Key: [seu secret]
# Default region: sa-east-1
# Default output format: json
```

### SAM Template base (`template.yaml` em cada projeto)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        ENV: !Ref Environment

Parameters:
  Environment:
    Type: String
    Default: prod

Resources:
  MeuProjetoFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub "portfolio-${Environment}-meu-projeto"
      CodeUri: dist/
      Handler: handler.lambda_handler   # ajuste por runtime
      Runtime: python3.12               # node22.x | python3.12 | provided.al2
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref PortfolioApi
            Path: /meu-projeto/{proxy+}
            Method: ANY

  PortfolioApi:
    Type: AWS::Serverless::Api
    Properties:
      Name: !Sub "portfolio-api-${Environment}"
      StageName: !Ref Environment
      Cors:
        AllowOrigin: "'https://usuario.github.io'"
        AllowHeaders: "'Content-Type'"
        AllowMethods: "'GET,POST,OPTIONS'"

Outputs:
  ApiEndpoint:
    Value: !Sub "https://${PortfolioApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}"
    Export:
      Name: !Sub "portfolio-${Environment}-api-endpoint"
```

### S3 Bucket para metadados

```bash
# Criar o bucket (uma única vez)
aws s3api create-bucket \
  --bucket portfolio-metadata-SEUNOME \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

# Habilitar versionamento
aws s3api put-bucket-versioning \
  --bucket portfolio-metadata-SEUNOME \
  --versioning-configuration Status=Enabled

# Política pública de leitura para o portfolio
aws s3api put-bucket-policy \
  --bucket portfolio-metadata-SEUNOME \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::portfolio-metadata-SEUNOME/public/*"
    }]
  }'
```

---

## 7. GitHub Actions Workflows

Cada projeto tem dois workflows independentes. O `portfolio-hub` tem dois receivers correspondentes.

### Workflow de documentação (`docs.yml`) — fluxo 1

```yaml
name: Update Docs

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'   # só dispara quando docs/ é alterado

jobs:
  notify-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Dispatch docs update to portfolio-hub
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PORTFOLIO_TOKEN }}
          repository: usuario/portfolio-hub
          event-type: update-docs
          client-payload: |
            {
              "project": "${{ github.event.repository.name }}",
              "repo_url": "https://github.com/${{ github.repository }}",
              "commit_sha": "${{ github.sha }}",
              "updated_at": "${{ github.event.head_commit.timestamp }}"
            }
```

### Workflow de release (`release.yml`) — fluxo 2

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

env:
  AWS_REGION: sa-east-1
  STACK_NAME: portfolio-prod-${{ github.event.repository.name }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # necessário para OIDC

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC - sem chaves estáticas)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsPortfolioRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup runtime
        # Detecta a linguagem e instala o runtime correto
        run: |
          if [ -f "package.json" ]; then
            echo "RUNTIME=nodejs" >> $GITHUB_ENV
          elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
            echo "RUNTIME=python" >> $GITHUB_ENV
          elif [ -f "go.mod" ]; then
            echo "RUNTIME=go" >> $GITHUB_ENV
          fi

      - name: Build
        run: make build   # cada projeto define seu próprio Makefile

      - name: Test
        run: make test

      - name: Deploy Lambda via SAM
        run: |
          sam build
          sam deploy \
            --stack-name ${{ env.STACK_NAME }} \
            --region ${{ env.AWS_REGION }} \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --capabilities CAPABILITY_IAM

      - name: Get API endpoint
        id: endpoint
        run: |
          ENDPOINT=$(aws cloudformation describe-stacks \
            --stack-name ${{ env.STACK_NAME }} \
            --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
            --output text)
          echo "url=$ENDPOINT" >> $GITHUB_OUTPUT

      - name: Notify portfolio-hub
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PORTFOLIO_TOKEN }}
          repository: usuario/portfolio-hub
          event-type: new-release
          client-payload: |
            {
              "project": "${{ github.event.repository.name }}",
              "display_name": "${{ github.event.repository.description }}",
              "version": "${{ github.ref_name }}",
              "runtime": "${{ env.RUNTIME }}",
              "api_endpoint": "${{ steps.endpoint.outputs.url }}",
              "repo_url": "https://github.com/${{ github.repository }}",
              "updated_at": "${{ github.event.head_commit.timestamp }}"
            }
```

### Workflow do portfolio-hub — recebe documentação (`receive-docs.yml`)

```yaml
name: Receive Docs Update

on:
  repository_dispatch:
    types: [update-docs]

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Fetch docs from project repo
        run: |
          PROJECT="${{ github.event.client_payload.project }}"
          REPO="${{ github.event.client_payload.repo_url }}"
          OWNER_REPO="${REPO#https://github.com/}"
          SHA="${{ github.event.client_payload.commit_sha }}"

          mkdir -p docs/${PROJECT}

          # Lista e faz fetch de cada arquivo em docs/
          FILES=$(curl -sf \
            -H "Authorization: token ${{ secrets.PORTFOLIO_TOKEN }}" \
            "https://api.github.com/repos/${OWNER_REPO}/contents/docs?ref=${SHA}" \
            | jq -r '.[].name')

          for FILE in $FILES; do
            curl -sf \
              -H "Authorization: token ${{ secrets.PORTFOLIO_TOKEN }}" \
              "https://raw.githubusercontent.com/${OWNER_REPO}/${SHA}/docs/${FILE}" \
              > docs/${PROJECT}/${FILE}
          done

      - name: Update docs_updated_at in project JSON
        run: |
          PROJECT="${{ github.event.client_payload.project }}"
          TIMESTAMP="${{ github.event.client_payload.updated_at }}"
          
          # Atualiza apenas o campo docs_updated_at, preserva o restante
          jq --arg ts "$TIMESTAMP" '.docs_updated_at = $ts' \
            projects/${PROJECT}.json > /tmp/updated.json
          mv /tmp/updated.json projects/${PROJECT}.json

      - name: Commit and push
        run: |
          git config user.name "portfolio-bot[bot]"
          git config user.email "portfolio-bot@users.noreply.github.com"
          git add docs/ projects/
          git commit -m "docs(${{ github.event.client_payload.project }}): update documentation"
          git push
```

### Workflow do portfolio-hub — recebe release (`receive-release.yml`)

```yaml
name: Receive Release

on:
  repository_dispatch:
    types: [new-release]

jobs:
  update-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Update project metadata
        run: |
          PROJECT="${{ github.event.client_payload.project }}"
          
          # Preserva docs_updated_at se já existir
          DOCS_TS=$(jq -r '.docs_updated_at // ""' projects/${PROJECT}.json 2>/dev/null || echo "")
          
          cat > projects/${PROJECT}.json << EOF
          {
            "name": "${PROJECT}",
            "display_name": "${{ github.event.client_payload.display_name }}",
            "version": "${{ github.event.client_payload.version }}",
            "runtime": "${{ github.event.client_payload.runtime }}",
            "api_endpoint": "${{ github.event.client_payload.api_endpoint }}",
            "repo_url": "${{ github.event.client_payload.repo_url }}",
            "region": "sa-east-1",
            "docs_updated_at": "${DOCS_TS}",
            "changelog_updated_at": "${{ github.event.client_payload.updated_at }}"
          }
          EOF

      - name: Fetch CHANGELOG.md from project repo
        run: |
          PROJECT="${{ github.event.client_payload.project }}"
          REPO_URL="${{ github.event.client_payload.repo_url }}"
          OWNER_REPO="${REPO_URL#https://github.com/}"

          curl -sf \
            -H "Authorization: token ${{ secrets.PORTFOLIO_TOKEN }}" \
            "https://raw.githubusercontent.com/${OWNER_REPO}/main/CHANGELOG.md" \
            > changelogs/${PROJECT}.md || \
          curl -sf \
            -H "Authorization: token ${{ secrets.PORTFOLIO_TOKEN }}" \
            "https://api.github.com/repos/${OWNER_REPO}/releases/latest" \
            | jq -r '"## " + .tag_name + "\n\n" + .body' \
            > changelogs/${PROJECT}.md

      - name: Commit and push
        run: |
          git config user.name "portfolio-bot[bot]"
          git config user.email "portfolio-bot@users.noreply.github.com"
          git add projects/ changelogs/
          git commit -m "release(${{ github.event.client_payload.project }}): ${{ github.event.client_payload.version }}"
          git push
```

### Workflow de deploy do site (`deploy.yml`)

```yaml
name: Deploy Portfolio

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm ci
        working-directory: src

      - name: Build Astro site
        run: npm run build
        working-directory: src

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsPortfolioRole
          aws-region: sa-east-1

      - name: Upload consolidated JSON to S3
        run: |
          # Gera projects.json consolidado com todos os projetos
          node -e "
            const fs = require('fs');
            const files = fs.readdirSync('projects').filter(f => f.endsWith('.json'));
            const projects = files.map(f => JSON.parse(fs.readFileSync('projects/' + f)));
            fs.writeFileSync('src/dist/projects.json', JSON.stringify(projects, null, 2));
          "
          aws s3 cp src/dist/projects.json \
            s3://portfolio-metadata-SEUNOME/public/projects.json \
            --cache-control "max-age=60"

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: src/dist
```

---

## 8. GitHub Pages e Dados em Runtime

### Componente `LiveStatus.astro`

O portfolio serve HTML estático, mas cada página de projeto busca dados ao vivo da Lambda:

```astro
---
// src/components/LiveStatus.astro
interface Props {
  endpoint: string;
  projectName: string;
}
const { endpoint, projectName } = Astro.props;
---

<div id={`status-${projectName}`} data-endpoint={endpoint}>
  <span class="status-dot loading"></span>
  <span class="status-text">verificando...</span>
</div>

<script>
  document.querySelectorAll('[data-endpoint]').forEach(async (el) => {
    const endpoint = el.getAttribute('data-endpoint');
    const name = el.id.replace('status-', '');
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');

    try {
      const start = Date.now();
      const res = await fetch(`${endpoint}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      const data = await res.json();

      dot.className = 'status-dot online';
      text.textContent = `online · ${latency}ms · v${data.version ?? '?'}`;
    } catch {
      dot.className = 'status-dot offline';
      text.textContent = 'offline';
    }
  });
</script>
```

### Handler de health check em cada Lambda

Cada projeto deve implementar um endpoint `/health`:

**Python:**
```python
# handler.py
import json
import os

VERSION = os.environ.get("VERSION", "unknown")

def lambda_handler(event, context):
    path = event.get("path", "/")
    
    if path.endswith("/health"):
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://usuario.github.io"
            },
            "body": json.dumps({
                "status": "ok",
                "version": VERSION,
                "runtime": "python"
            })
        }
    
    # lógica principal do projeto
    return main_handler(event, context)
```

**Node.js (TypeScript):**
```typescript
// handler.ts
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

const VERSION = process.env.VERSION ?? 'unknown';

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  if (event.path.endsWith('/health')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://usuario.github.io',
      },
      body: JSON.stringify({ status: 'ok', version: VERSION, runtime: 'nodejs' }),
    };
  }

  // lógica principal do projeto
  return mainHandler(event);
};
```

---

## 9. Release Notes Automáticas

### Formato recomendado para `CHANGELOG.md`

Siga o padrão [Keep a Changelog](https://keepachangelog.com):

```markdown
# Changelog

## [2.1.0] - 2025-04-20

### Adicionado
- Endpoint `/analyze` para processamento de texto com LLM
- Suporte a streaming via Server-Sent Events

### Alterado
- Timeout aumentado de 30s para 60s para modelos maiores

### Corrigido
- Bug de codificação UTF-8 em inputs com caracteres especiais

## [2.0.0] - 2025-03-15

### Adicionado
- Reescrita completa em Python 3.12
- Integração com Amazon Bedrock
```

### Automatizando o CHANGELOG com Conventional Commits

Instale o `release-please` da Google para gerar CHANGELOGs automaticamente:

```yaml
# .github/workflows/release-please.yml (em cada projeto)
name: Release Please

on:
  push:
    branches: [main]

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/release-please-action@v4
        with:
          release-type: simple
          # ou: node, python, go — detecta automaticamente
```

Com isso, basta usar mensagens de commit no padrão:
- `feat: nova funcionalidade` → versão minor
- `fix: correção de bug` → versão patch
- `feat!: breaking change` → versão major

---

## 10. Segurança e IAM

### Role do GitHub Actions (OIDC — sem chaves estáticas)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:usuario/*:ref:refs/tags/*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

### Policy mínima para deploy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaDeploy",
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:PublishVersion",
        "lambda:GetFunction",
        "lambda:CreateFunction",
        "lambda:AddPermission"
      ],
      "Resource": "arn:aws:lambda:sa-east-1:ACCOUNT_ID:function:portfolio-*"
    },
    {
      "Sid": "ApiGatewayDeploy",
      "Effect": "Allow",
      "Action": [
        "apigateway:*"
      ],
      "Resource": "arn:aws:apigateway:sa-east-1::/*"
    },
    {
      "Sid": "CloudFormationDeploy",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*"
      ],
      "Resource": "arn:aws:cloudformation:sa-east-1:ACCOUNT_ID:stack/portfolio-*"
    },
    {
      "Sid": "S3MetadataUpload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::portfolio-metadata-SEUNOME/*"
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/portfolio-lambda-execution-role"
    }
  ]
}
```

### GitHub Secrets necessários

| Secret | Onde configurar | Valor |
|---|---|---|
| `PORTFOLIO_TOKEN` | Cada repo de projeto | PAT com `repo` scope no portfolio-hub |
| `AWS_ACCOUNT_ID` | Cada repo de projeto | ID numérico da sua conta AWS |
| `GITHUB_TOKEN` | Automático | Fornecido pelo Actions |

---

## 11. Custos Estimados

Considerando uso típico de portfolio pessoal (baixo tráfego):

| Serviço | Uso estimado/mês | Custo |
|---|---|---|
| GitHub Pages | Hosting estático | **Gratuito** |
| GitHub Actions | ~500 minutos (repos públicos) | **Gratuito** |
| Lambda | 10.000 invocações/mês | **Gratuito** (dentro do free tier) |
| API Gateway | 10.000 requisições/mês | **Gratuito** (dentro do free tier) |
| S3 | < 1 MB de JSONs | **Gratuito** (dentro do free tier) |
| CloudWatch | Logs básicos | **Gratuito** (5 GB/mês) |
| **Total** | | **~R$ 0/mês** |

### Free tier da AWS (válido por 12 meses)

- Lambda: 1 milhão de invocações/mês + 400.000 GB-segundos
- API Gateway: 1 milhão de chamadas REST/mês
- S3: 5 GB de armazenamento + 20.000 GET + 2.000 PUT
- CloudWatch: 5 GB de logs + 3 dashboards + 10 alarmes

Após o free tier (ou para projetos com tráfego real):

| Cenário | Custo mensal estimado |
|---|---|
| Portfolio pessoal (< 1K visitas/dia) | < R$ 5 |
| Portfolio com demos pesadas (1K–10K/dia) | R$ 10–50 |
| Portfolio profissional com alto tráfego | R$ 50–200 |

---

## 12. Decisões de Design (ADRs)

### ADR-001: GitHub Pages em vez de S3 Static Hosting

**Decisão:** Usar GitHub Pages para servir o site estático.

**Motivo:** Zero custo, HTTPS automático, integração nativa com GitHub Actions, domínio `usuario.github.io` gratuito. O S3 + CloudFront seria ~R$ 10–30/mês a mais sem benefício real para portfolio pessoal.

**Trade-off:** Sem CDN customizável, sem controle de headers avançado. Aceitável para portfolio.

---

### ADR-002: Lambda em vez de ECS Fargate

**Decisão:** Usar Lambda functions para os projetos em vez de containers no ECS.

**Motivo:** Portfolio tem tráfego intermitente (zero na maioria do tempo). Fargate cobra ~$0.04/vCPU/hora mesmo sem tráfego. Lambda só cobra por invocação, com free tier generoso. Para demos de portfolio, Lambda é ideal.

**Trade-off:** Cold start de 200–800ms na primeira invocação após inatividade. Aceitável para demonstrações.

---

### ADR-003: API Gateway REST em vez de HTTP API

**Decisão:** Usar API Gateway REST API (v1) em vez de HTTP API (v2).

**Motivo:** REST API tem melhor suporte a CORS granular, usage plans para rate limiting, e stage variables que facilitam múltiplos projetos no mesmo gateway. HTTP API é mais barato mas menos configurável.

**Trade-off:** REST API custa $3.50/milhão vs $1.00/milhão do HTTP API. Para portfolio pessoal, a diferença é centavos.

---

### ADR-004: repository_dispatch em vez de webhooks customizados

**Decisão:** Usar o mecanismo nativo `repository_dispatch` do GitHub para notificar o portfolio-hub.

**Motivo:** Zero infraestrutura adicional, sem necessidade de endpoint público para receber webhooks, rastreável pelo GitHub Actions UI. Alternativas como SNS/SQS adicionariam complexidade e custo desnecessários.

**Trade-off:** Latência de ~30 segundos para o dispatch ser processado. Aceitável para pipeline de portfolio.

---

### ADR-005: OIDC em vez de chaves estáticas na AWS

**Decisão:** Usar OpenID Connect (OIDC) para autenticação do GitHub Actions na AWS.

**Motivo:** Chaves de acesso estáticas (`AWS_ACCESS_KEY_ID`) são um risco de segurança — podem vazar em logs, ser comprometidas em forks. OIDC usa tokens temporários por execução, sem segredo armazenado.

**Trade-off:** Setup inicial mais complexo (criação do OIDC provider + role). Vale o esforço pela segurança.

### ADR-006: Dois fluxos independentes para documentação e changelog

**Decisão:** Separar o pipeline em dois eventos de dispatch distintos (`update-docs` e `new-release`), cada um com seu próprio workflow no hub e sua própria pasta de artefatos.

**Motivo:** Documentação e releases têm cadências completamente diferentes. Documentação é iterativa — você melhora explicações, adiciona exemplos, corrige erros sem criar uma versão nova. Releases são marcos formais que envolvem deploy, versionamento semântico e comunicação de mudanças. Misturar os dois em um único fluxo force-acoplaria a qualidade da documentação ao ritmo de releases, ou vice-versa.

**Trade-off:** Dois workflows por projeto em vez de um. O overhead é mínimo (menos de 20 linhas de YAML cada) e o ganho em clareza e flexibilidade é significativo.

---

- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/)
- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [release-please](https://github.com/googleapis/release-please)
