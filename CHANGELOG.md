# Histórico de alterações

Este arquivo registra as mudanças relevantes de cada versão do FinanZen.

## 1.6.2 — 20/10/2026

### Central de configurações

- A aba passou a exibir somente os blocos de navegação, sem formulários ou listas abertos diretamente.
- Cada bloco abre sua função completa em uma visualização separada.
- Adicionado botão para voltar à central, suporte à tecla `Esc` e restauração de foco.
- A instalação do aplicativo ganhou um bloco próprio.
- O painel de blocos foi adaptado para desktop e celular.

## 1.6.1 — 20/10/2026

### Configurações por módulos

- Cada função passou a ter um bloco independente com seus próprios controles.
- Moeda, Categorias e Contas deixaram de compartilhar o mesmo cartão.
- Adicionados atalhos para acessar diretamente cada módulo de configuração.
- Formulários e listas ganharam uma estrutura responsiva e mais consistente.

## 1.6.0 — 20/10/2026

### Conta e configurações

- Reorganizada a tela de ajustes em Conta, Dados e backup, Organização e Integrações.
- Login e sincronização reunidos na seção **Conta e acesso**.
- Removida a seção “Zona de Perigo”.
- Restauração dos dados movida para a conta conectada.

### Segurança

- A restauração agora exige a senha atual da conta.
- A senha é validada pelo Supabase usando um cliente temporário e não é armazenada.
- Os dados restaurados são persistidos imediatamente e enviados para a nuvem.

## 1.5.2 — 20/10/2026

### Interface

- Reorganizado o botão global **Novo**.
- Movimentações principais agrupadas em Receita, Despesa e Transferência.
- Ações de organização separadas em Conta, Orçamento e Meta.
- Menu adaptado para telas menores, com apresentação em painel no celular.

### Acessibilidade

- Adicionados estados ARIA ao botão e ao menu.
- Incluída navegação por teclado com setas, `Home`, `End` e `Esc`.
- Melhorado o destaque visual de foco dos atalhos.

### Manutenção

- Atualizado o cache da PWA e os arquivos estáticos para a versão 1.5.2.
- Mantida a validação automatizada de sintaxe e integridade do projeto.
