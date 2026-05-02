# Magaxia - Backend Modular e Profissional

## Objetivo

Criar uma camada backend segura e modular para a aplicação existente, preservando o funcionamento atual do frontend estático.

## Etapas planejadas

1. Backend seguro e modular
2. 2FA admin + sessões seguras
3. Antifraude score em tempo real
4. Ledger financeiro profissional
5. Dashboard executivo
6. CI/CD + backup + monitoramento
7. UX premium

## Como usar

1. Instale dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
3. Configure as variáveis e inicie:
   ```bash
   npm start
   ```

## Stage 1 - Backend Modular

- `index.js`: servidor Express com headers de segurança, rate limiting e rotas modulares.
- `routes/auth.js`: autenticação centralizada e sessão segura via cookie.
- `routes/antifraud.js`: API de score e eventos antifraude.
- `routes/ledger.js`: registros financeiros com ledger seguro.

> O servidor novo é um acréscimo. O servidor estático atual (`server.js`) continua disponível para testes conservadores.
