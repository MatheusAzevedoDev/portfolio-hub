# portfolio-hub

Portfólio técnico com documentação viva, releases rastreáveis e automação via GitHub Actions.

## Começando

```bash
npm install
npm run dev
```

Acesse em `http://localhost:4321`

## Configuração

Edite `src/config.ts` para personalizar o site:

```ts
export const SITE_CONFIG = {
  githubUser: 'seu-usuario',
  linkedinUrl: 'https://linkedin.com/in/seu-perfil',
  repoName: 'portfolio-hub',
  siteName: 'Seu Nome',
  siteDescription: 'Descrição do site',
};
```

## Estrutura

```
portfolio-hub/
├── content/
│   └── blog/            # Posts do blog (Markdown)
├── docs/                # Documentação dos projetos por slug
├── projects/            # Metadados dos projetos (JSON)
├── changelogs/          # Changelogs dos projetos por slug
├── src/
│   ├── components/      # Componentes Astro (Nav, ProjectCard, BlogCard)
│   ├── layouts/         # Layout global
│   └── pages/           # Páginas (index, blog, projects)
└── .github/workflows/   # CI/CD e automação
```

## Projetos

Cada projeto é representado por um arquivo JSON em `projects/`:

```json
{
  "name": "seu-projeto",
  "display_name": "Seu Projeto",
  "description": "Descrição do projeto",
  "version": "1.0.0",
  "tags": ["Go", "Kubernetes"],
  "repo_url": "https://github.com/usuario/repo",
  "status": "active",
  "docs_updated_at": "2026-04-21T00:00:00Z",
  "changelog_updated_at": "2026-04-21T00:00:00Z"
}
```

**Status válidos:** `active` | `wip` | `archived`

> Projetos integrados via `project-template` criam e atualizam este arquivo automaticamente a cada release.

## Blog

Posts ficam em `content/blog/` como arquivos Markdown com frontmatter:

```markdown
---
title: Título do post
description: Descrição breve
date: 2026-04-21
tags: [Go, GitOps]
featured: true
---

Conteúdo aqui...
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run preview` | Preview do build |
| `npm run changelog` | Atualiza `CHANGELOG.md` desde o último tag |
| `npm run changelog:all` | Regenera `CHANGELOG.md` do histórico completo |

## Workflows

| Arquivo | Gatilho | Função |
|---------|---------|--------|
| `deploy.yml` | push em `main` | Build e deploy no GitHub Pages |
| `changelog.yml` | push em `main` | Gera e commita o `CHANGELOG.md` do hub |
| `project-update.yml` | `repository_dispatch: project-update` | Atualiza metadados, docs e changelog de um projeto |
| `receive-docs.yml` | `repository_dispatch: update-docs` | Atualiza apenas a documentação de um projeto |
| `receive-release.yml` | `repository_dispatch: new-release` | Atualiza versão e changelog de um projeto |

## Documentação

Para integrar novos projetos e entender a arquitetura completa, veja a [documentação do portfolio-hub](./docs/gitops-portfolio-lambda/).
