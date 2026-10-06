# Techne — Catálogo V3

Versão V3 do catálogo estático para GitHub Pages, com painel administrativo via API do GitHub.

## Estrutura

- `index.html` — catálogo público
- `admin.html` — painel administrativo
- `admin.js` — integração com GitHub API
- `app.js` — catálogo
- `styles.css` — estilos
- `data/*.json` — dados editáveis
- `assets/` — logo e imagens

## GitHub / Admin

No painel, informe:

- Usuário: seu usuário do GitHub
- Repositório: nome exato do repositório, por exemplo `catalogo-techne`
- Branch: normalmente `main`
- Token: Fine-grained Personal Access Token

Para o token, selecione somente o repositório do catálogo e dê `Repository permissions → Contents → Read and write`.

### Diagnóstico V3

O login agora testa separadamente:

1. repositório;
2. branch;
3. `data/settings.json`;
4. carregamento dos dados.

Em caso de erro, o painel mostra o HTTP status e uma explicação prática. Os principais códigos são 401 (token), 403 (permissão), 404 (repositório/branch/arquivo ou acesso do token), 409 (conflito) e 429 (limite).

O token não é salvo no código, em JSON ou no GitHub. Ele fica somente na memória da página durante a sessão.
