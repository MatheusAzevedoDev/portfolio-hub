# Arquitetura

## Visão Geral do Sistema

```mermaid
flowchart TB
    subgraph GH["GitHub Ecosystem"]
        PR(["Repos de Projeto\nrepo-a · repo-b"])
        CI["GitHub Actions CI\ndisparado por git tag"]
        HUB["portfolio-hub\nsource of truth"]
        PAGES["GitHub Pages\nsite estático"]

        PR -->|"git tag v*.*.*"| CI
        CI -->|"repository_dispatch\nnew-release"| HUB
        HUB -->|"push → rebuild Astro"| PAGES
        PR -->|"push em docs/"| DOCWF["GitHub Actions\nDocs Workflow"]
        DOCWF -->|"repository_dispatch\nupdate-docs"| HUB
    end

    subgraph AWS
        APIGW["API Gateway\nREST endpoint"]
        LAMBDA["Lambda Functions\nNode · Python · Go"]
        S3[("S3\nprojects.json")]
        CW["CloudWatch\nlogs + métricas"]

        APIGW --> LAMBDA
        LAMBDA --> CW
    end

    CI -->|"sam deploy"| LAMBDA
    HUB -->|"upload JSON"| S3
    PAGES -->|"fetch /health\nem runtime"| APIGW
```

## Dois Fluxos Independentes

O coração do design é a separação entre **documentação** (iterativa) e **changelog** (marco formal):

```mermaid
flowchart LR
    subgraph F1["Fluxo 1 — Docs  (~1 min)"]
        A1["git push\nem docs/"] --> B1["Actions: docs.yml"]
        B1 --> C1["dispatch:\nupdate-docs"]
        C1 --> D1["portfolio-hub\natualiza docs/"]
        D1 --> E1["Pages reconstruído\n✓ Docs atualizados"]
    end

    subgraph F2["Fluxo 2 — Release  (~2 min)"]
        A2["git tag v1.0.0"] --> B2["Actions: release.yml"]
        B2 --> C2a["sam deploy\n→ Lambda"]
        B2 --> C2b["dispatch:\nnew-release"]
        C2b --> D2["portfolio-hub\natualiza changelog"]
        D2 --> E2["Pages reconstruído\n✓ Changelog + Lambda live"]
    end
```

## Fluxo Completo de uma Release

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant CI as GitHub Actions CI
    participant Hub as portfolio-hub
    participant Lambda as AWS Lambda
    participant Pages as GitHub Pages

    Dev->>CI: git tag v2.0.0 && git push --tags
    activate CI
    CI->>CI: checkout + build + test
    CI->>Lambda: sam deploy (update function code)
    Lambda-->>CI: deployed ✓
    CI->>Hub: repository_dispatch: new-release
    deactivate CI

    activate Hub
    Hub->>Hub: update projects/meu-projeto.json
    Hub->>Hub: fetch + save CHANGELOG.md
    Hub->>Hub: git commit + push
    deactivate Hub

    activate Pages
    Pages->>Pages: npm run build (Astro)
    Pages->>Pages: deploy to gh-pages
    deactivate Pages

    Note over Pages,Lambda: Visitor acessa o portfolio
    Pages->>Lambda: fetch /health (runtime check)
    Lambda-->>Pages: { status: ok, version: 2.0.0, latency: 142ms }
```

## Componentes Detalhados

### GitHub Ecosystem

| Componente | Função |
|---|---|
| `repo-projeto-*` | Código-fonte com workflows `docs.yml` e `release.yml` |
| `portfolio-hub` | Repositório central: agrega JSONs, docs e changelogs |
| GitHub Actions CI | Disparado por tag: build, test, empacota e deploya Lambda |
| GitHub Actions Deploy | Disparado por push no hub: reconstrói Astro e publica no Pages |
| GitHub Pages | Serve o portfolio estático com HTTPS |

### AWS

| Serviço | Função |
|---|---|
| **API Gateway** | Endpoint REST público por projeto |
| **Lambda** | Executa o código — cobra apenas por invocação |
| **S3** | Armazena `projects.json` consolidado |
| **CloudWatch** | Logs, métricas e alertas das Lambdas |
| **IAM + OIDC** | Autenticação sem chaves estáticas |

## Decisões de Design (ADRs)

### ADR-001: GitHub Pages em vez de S3 Static Hosting

**Decisão:** GitHub Pages para hosting.

**Motivo:** Zero custo, HTTPS automático, integração nativa com Actions. S3 + CloudFront adicionaria R$ 10–30/mês sem benefício real.

### ADR-002: Lambda em vez de ECS Fargate

**Decisão:** Lambda functions.

**Motivo:** Portfolio tem tráfego intermitente (zero na maioria do tempo). Fargate cobra por hora mesmo sem tráfego. Lambda: free tier de 1 milhão de invocações/mês.

**Trade-off:** Cold start de 200–800ms. Aceitável para demonstrações.

### ADR-005: OIDC em vez de chaves estáticas na AWS

**Decisão:** OpenID Connect para autenticação do GitHub Actions.

**Motivo:** Chaves estáticas podem vazar em logs ou forks. OIDC usa tokens temporários por execução.

### ADR-006: Dois fluxos independentes

**Decisão:** Eventos `update-docs` e `new-release` separados.

**Motivo:** Documentação e releases têm cadências completamente diferentes. Misturar os dois force-acoplaria a qualidade da documentação ao ritmo de releases.
