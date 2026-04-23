---
title: Arquitetura
icon: layers
---

# Arquitetura

O `portfolio-hub` é um site estático que agrega metadados, documentação e changelogs de múltiplos projetos. Ele não executa os projetos, não tem backend em runtime e não depende de nenhuma API externa para montar o conteúdo principal — tudo parte de arquivos versionados no Git.

## Visão geral

```mermaid
flowchart TB
    subgraph Projetos["Repositórios de Projeto"]
        PT["project-template\n(ou qualquer repo)"]
    end

    subgraph Hub["portfolio-hub (.github/workflows)"]
        PU["project-update.yml\n(repository_dispatch)"]
        RD["receive-docs.yml\n(update-docs)"]
        RR["receive-release.yml\n(new-release)"]
        CL["changelog.yml"]
        DP["deploy.yml"]
    end

    subgraph Conteudo["Conteúdo versionado"]
        META["projects/*.json"]
        DOCS["docs/slug/*.md"]
        CHANGELOGS["changelogs/*.md"]
        BLOG["content/blog/*.md"]
    end

    ASTRO["Astro build"]
    PAGES["GitHub Pages"]

    PT -->|"project-update"| PU
    PT -->|"update-docs"| RD
    PT -->|"new-release"| RR

    PU --> META
    PU --> DOCS
    PU --> CHANGELOGS

    RD --> DOCS
    RR --> META
    RR --> CHANGELOGS

    META --> ASTRO
    DOCS --> ASTRO
    CHANGELOGS --> ASTRO
    BLOG --> ASTRO

    ASTRO -->|"deploy.yml"| PAGES
```

## Camadas principais

### 1. Metadados dos projetos

Cada projeto possui um arquivo em `projects/<slug>.json` que define o que é exibido nos cards e na página do projeto.

```mermaid
classDiagram
    class ProjectMetadata {
        +string name
        +string display_name
        +string description
        +string version
        +string status
        +string[] tags
        +string repo_url
        +string docs_updated_at
        +string changelog_updated_at
    }
```

Esse arquivo é criado automaticamente pelo workflow `project-update.yml` na primeira release de projetos integrados via `project-template`. Pode também ser criado manualmente para projetos que não usam automação.

### 2. Documentação por projeto

A pasta `docs/<slug>/` contém os arquivos Markdown técnicos do projeto. Cada arquivo pode definir:

- `title` via frontmatter — nome exibido na sidebar
- `icon` via frontmatter — ícone da aba
- diagramas Mermaid inline

Arquivos comuns: `README.md`, `architecture.md`, `usage.md`, `api.md`, `security.md`

### 3. Changelog por projeto

Cada projeto mantém um arquivo em `changelogs/<slug>.md`. Essa camada é separada da documentação intencionalmente:

- documentação explica **como** o projeto funciona
- changelog explica **o que mudou** entre versões

### 4. Blog

Posts em `content/blog/*.md` com frontmatter YAML. O nome do arquivo define a URL (`content/blog/meu-post.md` → `/blog/meu-post`).

### 5. Renderização

O Astro lê todos os arquivos no build e gera HTML estático. Não há fetch de dados em runtime.

| Página | Arquivo |
|---|---|
| Homepage com projetos e filtros | `src/pages/index.astro` |
| Página de projeto com docs e changelog | `src/pages/projects/[slug].astro` |
| Listagem do blog | `src/pages/blog/index.astro` |
| Post individual | `src/pages/blog/[slug].astro` |
| Navbar compartilhada | `src/components/Nav.astro` |
| Shell global e tokens CSS | `src/layouts/Layout.astro` |

## Workflows do hub

### deploy.yml

Dispara em todo push para `main`. Faz o build do Astro e publica no GitHub Pages.

```mermaid
flowchart LR
    A["push em main"] --> B["Astro build"]
    B --> C["GitHub Pages"]
```

### changelog.yml

Dispara em push para `main` (exceto mudanças em `docs/`, `content/`, `projects/`). Gera o `CHANGELOG.md` do próprio hub usando conventional-changelog e commita com `[skip ci]`.

### project-update.yml

Dispara via `repository_dispatch: project-update`. Usado pelo `project-template` após cada release.

**O que faz:**
1. Cria `projects/<slug>.json` se não existir
2. Atualiza todos os campos de metadados (versão, descrição, tags, repo_url)
3. Busca `CHANGELOG.md` do repositório → `changelogs/<slug>.md`
4. Busca `docs/README.md`, `docs/architecture.md`, `docs/usage.md` → `docs/<slug>/`
5. Commita e faz push (usa `PORTFOLIO_TOKEN` para disparar o deploy)

```mermaid
sequenceDiagram
    participant Repo as Repositório do Projeto
    participant Hub as portfolio-hub
    participant Pages as GitHub Pages

    Repo->>Hub: repository_dispatch: project-update
    Hub->>Hub: atualiza projects/<slug>.json
    Hub->>Repo: GET CHANGELOG.md
    Hub->>Repo: GET docs/*.md
    Hub->>Hub: commita mudanças
    Hub->>Pages: deploy.yml dispara
    Pages-->>Repo: site atualizado
```

### receive-docs.yml

Dispara via `repository_dispatch: update-docs`. Para repositórios que atualizam documentação independentemente de releases.

**O que faz:**
1. Lista todos os arquivos em `docs/` no commit especificado
2. Baixa cada arquivo → `docs/<slug>/`
3. Atualiza `docs_updated_at` em `projects/<slug>.json`
4. Commita e faz push

**Payload esperado:**

```json
{
  "project": "nome-do-projeto",
  "repo_url": "https://github.com/org/repo",
  "commit_sha": "abc123def",
  "updated_at": "2026-04-21T10:00:00Z"
}
```

### receive-release.yml

Dispara via `repository_dispatch: new-release`. Para repositórios com processo de release próprio.

**O que faz:**
1. Atualiza `projects/<slug>.json` com nova versão, preservando `docs_updated_at` e `tags` existentes
2. Busca `CHANGELOG.md` do repositório (fallback: body da última release no GitHub)
3. Commita e faz push

**Payload esperado:**

```json
{
  "project": "nome-do-projeto",
  "display_name": "Nome Exibido",
  "version": "1.2.0",
  "description": "Descrição do projeto",
  "repo_url": "https://github.com/org/repo",
  "updated_at": "2026-04-21T10:00:00Z"
}
```

## Workflows do project-template

Projetos criados a partir do `project-template` têm três workflows próprios:

```mermaid
flowchart LR
    F["feature/** ou bug/**"] -->|"push → ci.yml"| D["develop\n(PR automático)"]
    D -->|"merge → promote.yml"| M["main\n(PR automático)"]
    M -->|"merge → release.yml"| R["vX.Y.Z\nCHANGELOG\nGitHub Release"]
    R -->|"repository_dispatch\nproject-update"| H["portfolio-hub"]
    H -->|"deploy.yml"| P["GitHub Pages"]
```

| Workflow | Gatilho | Função |
|---|---|---|
| `ci.yml` | push em `feature/**` ou `bug/**` | Abre PR automático para `develop` |
| `promote.yml` | push em `develop` | Abre PR automático para `main` |
| `release.yml` | push em `main` | Bump de versão, changelog, tag, release, notifica hub |

## Fluxo de build

```mermaid
flowchart LR
    A["projects/*.json"] --> D["Astro build"]
    B["docs/<slug>/*.md"] --> D
    C["changelogs/*.md"] --> D
    E["content/blog/*.md"] --> D
    D --> F["HTML estático"]
    F --> G["GitHub Pages"]
```

## Decisões arquiteturais

### O hub como agregador, não runtime

O `portfolio-hub` centraliza apresentação, documentação e changelog. Cada projeto pode usar qualquer stack ou estratégia de deploy — o hub não sabe nem precisa saber como o projeto roda.

### Separação entre docs e releases

Existem dois tipos de atualização com naturezas distintas:

| Tipo | Objetivo | Atualiza |
|---|---|---|
| `update-docs` | Conteúdo técnico evoluiu | `docs/<slug>/`, `docs_updated_at` |
| `new-release` | Nova versão publicada | `version`, `changelog`, `changelog_updated_at` |
| `project-update` | Tudo de uma vez (usado pelo template) | Todos os campos |

### Git como fonte de verdade

Toda atualização passa por um commit no repositório do hub. Isso garante:

- histórico auditável de todas as mudanças
- rollback trivial via `git revert`
- revisão em pull requests antes de ir ao ar
- nenhum estado externo para gerenciar

### PORTFOLIO_TOKEN como ponte entre repositórios

O token permite que projetos externos façam push de conteúdo para o hub. Armazenado como secret da organização MatheusAzevedoDev, é herdado por todos os repositórios sem configuração individual.

## Sistema visual

A interface foi construída para leitura técnica:

- tipografia: **Syne** (display/headings), **DM Sans** (corpo), **JetBrains Mono** (código)
- tokens CSS em custom properties (`--fg-1`, `--accent`, `--border`, etc.)
- navbar compartilhada via componente `Nav.astro`
- cards com filtros por tag e status na homepage
- sidebar de documentação gerada a partir dos arquivos em `docs/<slug>/`
- renderização de Markdown com suporte nativo a Mermaid

## Escalabilidade

Adicionar um novo projeto ao hub requer apenas:

1. um JSON em `projects/`
2. uma pasta em `docs/`
3. um arquivo em `changelogs/`

O restante da renderização é reaproveitado automaticamente. O modelo funciona para qualquer número de projetos sem mudança de código.
