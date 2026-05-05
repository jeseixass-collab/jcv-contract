# JCV Contract

Gerador de contratos da JCV Academy com assistente de IA integrado.

## Como rodar

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

3. Acesse http://localhost:5173

## Build para produção

```bash
npm run build
```

## Funcionalidades

- Editor de contrato com prévia em tempo real
- Exportação em PDF e impressão
- Histórico de rascunhos (salvo no navegador)
- **Assistente IA (Claude)**:
  - Extrator de dados: cola qualquer texto e preenche o formulário automaticamente
  - Análise inteligente: detecta erros e inconsistências nos dados
  - Chat: tira dúvidas sobre cláusulas e preenchimento

## Estrutura

```
src/
  App.tsx          # Componente principal + painel de IA
  main.tsx         # Entry point
  index.css        # Estilos globais + Tailwind
  utils/
    numberToWords.ts  # Conversão de números por extenso (pt-BR)
```

## Variáveis de ambiente

A chave da API Claude é gerenciada automaticamente via proxy.
