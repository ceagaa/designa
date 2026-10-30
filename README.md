# Designa

O Designa organiza as designações da congregação em um só lugar — sem planilha perdida no grupo do WhatsApp.

A ideia é simples: cada voluntário tem uma ficha, cada departamento tem seu jeito de montar a escala, e no fim tudo vira um PDF bonito ou um link para compartilhar.

A interface é pensada para o celular primeiro — botões grandes, uma coluna só e tudo o que é importante alcancável com o polegar. Funciona bem no computador também.

## O que dá para fazer

- **Campo** — cadastre os voluntários, os dias e horários de saída e deixe o rodízio distribuir. Também dá para fixar uma pessoa em um dia e ajustar qualquer nome na mão.
- **AVI** — organize as funções de áudio, vídeo, palco, microfone e os dois indicadores. O rodízio respeita os dias de reunião (configurados no setor) e o limite mensal de cada voluntário. O PDF sai em ordem cronológica, igual à planilha.
- **TPL** — monte a estrutura (pontos de apoio, locais de trabalho, períodos e dias) e escolha as duplas manualmente. A escala do TPL fica disponível em um link público.
- **Voluntários** — cada pessoa pertence a um departamento e vê só os campos que fazem sentido para ele. Fichas antigas sem departamento continuam valendo como Campo.
- **Links públicos** — compartilhe a escala do Campo, do AVI ou do TPL com quem precisa ver, sem precisar criar conta.
- **Equipe** — o administrador pode convidar ajudantes para cada departamento. Cada um acessa apenas o que é do seu setor.
- **Notificações** — avisos de escala e lembretes podem chegar pelo navegador, se as notificações forem ativadas.

## Como usar

1. **Crie a conta de administrador.** No primeiro acesso, informe seu nome, e-mail, senha e o nome da congregação.
2. **Cadastre os voluntários.** Em **Voluntários**, primeiro escolha o departamento e depois preencha a ficha — cada um mostra só os campos que fazem sentido. No Campo, marque os dias e horários disponíveis. No AVI, escolha as reuniões e as funções. No TPL, basta o nome.
3. **Configure o Campo.** Em **Locais**, defina os dias da semana, horários e pontos de encontro. Se quiser, escolha quem dirige e quem ajuda em cada dia.
4. **Monte a escala.** Na tela **Designações**, abra o setor. O AVI e o Campo têm o botão **Gerar** (rodízio automático); em qualquer um dos três dá para clicar em **Ajustar escala** e trocar nome por nome. No TPL, as duplas são montadas nesse modo de ajuste.
5. **Compartilhe.** Baixe o PDF ou use o botão **Link** para enviar a escala pública.

## Rodando o projeto

Você vai precisar de Node.js e de uma conta na Cloudflare autenticada no Wrangler. O desenvolvimento usa o D1 remoto de produção; não há banco local.

```bash
npm install
npm run dev                # frontend + Worker local + D1 remoto
```

O app abre em `http://localhost:5173`.
As alterações feitas no localhost são gravadas no banco de produção.

Outros comandos úteis:

```bash
npm run typecheck          # confere os tipos
npm run lint               # oxlint
npm run build              # gera a versão de produção em /dist
npm run dev:remote         # alias de dev; também usa o D1 remoto
node test-ux.mjs           # roteiro de UX no navegador (precisa do dev server no ar)
```

## Publicando

```bash
npx wrangler login
npm run db:migrate         # aplica as migrações no D1 remoto
npm run deploy             # build + publica o Worker
```

O Worker serve o site e a API no mesmo domínio. O banco fica no **Cloudflare D1**.

Para as notificações push, configure as chaves `PUSH_VAPID_PUBLICA` e `PUSH_VAPID_PRIVADA` como secrets do Worker:

```bash
npx wrangler secret put PUSH_VAPID_PUBLICA
npx wrangler secret put PUSH_VAPID_PRIVADA
```

## Por dentro

- **Frontend:** React 19 + Vite + Tailwind CSS
- **Backend:** Cloudflare Worker + Hono
- **Banco:** Cloudflare D1 (SQLite)
- **Exportação:** html2canvas + jsPDF
- **Notificações:** Web Push

As principais pastas:

```text
src/
  App.tsx              telas, navegação e sincronização
  server.ts            API do Worker e geração agendada
  components/          telas e componentes visuais
  lib/                 regras de negócio, tipos e utilidades
migrations/            estrutura do banco D1
```

## Uma observação

O Designa foi feito para simplificar a organização, não para substituir o cuidado com as pessoas. Se alguma escala não ficar como você esperava, ajuste na mão — o rodízio é só um ponto de partida.
