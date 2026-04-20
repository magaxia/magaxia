# 🔧 CONFIGURAÇÃO DO FIREBASE

## ⚠️ IMPORTANTE: Você precisa configurar o Firebase antes de usar o sistema!

### Passos para configurar:

1. **Acesse o Firebase Console:**
   - Vá para: https://console.firebase.google.com/
   - Crie um novo projeto ou selecione um existente

2. **Ative os serviços necessários:**
   - Authentication (para login)
   - Firestore Database (para armazenar dados)

3. **Obtenha as configurações:**
   - No seu projeto Firebase, vá em "Configurações" (ícone de engrenagem)
   - Selecione "Configuração do SDK"
   - Copie as configurações da seção "Configuração do SDK do Firebase"

4. **Substitua no arquivo `sistema-auth.js`:**
   - Abra o arquivo `sistema-auth.js`
   - Substitua o objeto `firebaseConfig` pelas suas configurações reais

### Exemplo de configuração real:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC_REAL_API_KEY_HERE",
  authDomain: "your-project-12345.firebaseapp.com",
  projectId: "your-project-12345",
  storageBucket: "your-project-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
};
```

### Problemas comuns:

- **Erro "No Firebase App '[DEFAULT]' has been created"**: Configurações incorretas
- **Erro "Failed to load resource"**: Arquivo `sistema-auth.js` não encontrado
- **Erro de segurança**: Não use arquivos locais diretamente - use um servidor local

### Para testar localmente:

Use um servidor local como:

- `python -m http.server 8000`
- `npx http-server`
- Extensão Live Server do VS Code

Depois acesse: `http://localhost:8000/produtos.html`
