# Changelog

## [1.0.0] - 2026-04-21

### Adicionado
- Site Astro com GitHub Pages deployment via GitHub Actions
- Suporte a múltiplos projetos via `projects/*.json`
- Página de documentação por projeto com navegação entre seções
- Página de changelog por projeto com entradas versionadas
- Renderização de diagramas Mermaid em documentação e changelogs
- Live status: health check em runtime contra a Lambda ao vivo
- Dois fluxos GitOps independentes: `update-docs` e `new-release`
- Workflow `receive-docs.yml`: agrega documentação do repo de origem
- Workflow `receive-release.yml`: agrega changelog e atualiza metadados
- Workflow `deploy.yml`: reconstrói e publica o site no GitHub Pages
- IAM Role com OIDC para deploy sem chaves estáticas
- SAM template base para Lambda com health endpoint
- Handlers de health check em Python e Node.js (TypeScript)
- Documentação de arquitetura com diagramas de fluxo e sequência

### Segurança
- Autenticação AWS via OIDC — sem `AWS_ACCESS_KEY_ID` em secrets
- CORS configurado para aceitar apenas `usuario.github.io`
- IAM policy de menor privilégio: apenas ações necessárias para deploy

### Infraestrutura
- API Gateway REST com CORS para o domínio do portfolio
- Lambda com timeout de 30s e 256 MB de memória (configurável)
- S3 bucket com versionamento e política de leitura pública para `/public/`
- CloudWatch com retenção de logs de 7 dias
