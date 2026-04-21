# GitOps Portfolio Lambda

Sistema de portfolio GitOps totalmente automatizado com dois fluxos independentes por projeto: **documentação contínua** e **releases versionadas**.

## Motivação

Portfolios tradicionais envelhecem — a documentação fica desatualizada e não há forma de saber qual versão está rodando. Este sistema resolve isso:

- A documentação é atualizada automaticamente a cada `git push` em `docs/`
- Cada `git tag` dispara deploy na AWS e registra uma entrada no changelog
- O portfolio sempre reflete o estado real dos projetos

## Casos de Uso

| Situação | Como funciona |
|---|---|
| Melhorar explicação de um endpoint | Push em `docs/` → documentação atualizada em ~1 min |
| Lançar nova versão | `git tag v2.0.0` → Lambda deployada + changelog atualizado em ~2 min |
| Adicionar novo projeto | Criar `projects/meu-projeto.json` → aparece no portfolio |
| Verificar status ao vivo | Clique em "Demo ao vivo" → health check na Lambda real |

## Stack

- **GitHub Pages** — hosting estático gratuito com HTTPS
- **GitHub Actions** — CI/CD automatizado sem servidor
- **AWS Lambda** — execução serverless por invocação
- **AWS API Gateway** — endpoint REST público
- **Astro** — gerador de site estático com suporte a conteúdo dinâmico

## Princípios GitOps

O `portfolio-hub` é a **única fonte de verdade**. Nenhum estado é declarado fora dele.

```
git tag → CI → Lambda deployed → portfolio-hub updated → GitHub Pages rebuilt
```

Zero intervenção manual entre `git tag` e o portfolio publicado.
