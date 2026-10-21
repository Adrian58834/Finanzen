# Histórico de alterações

Este arquivo registra as mudanças relevantes de cada versão do FinanZen.

## 1.7.0 — 21/10/2026

### Desktop e mobile

- Corrigido o botão **Novo** no celular ao mover o menu para um portal fora do cabeçalho com efeito de vidro.
- Adicionada uma ação central **Novo** na barra inferior mobile, com área de toque ampliada.
- A navegação mobile agora possui cinco ações legíveis; Cartões, Orçamentos, Metas e Ajustes ficam organizados em **Mais**.
- Corrigidos estouros horizontais em telas de 320 px nos gráficos, comparativos e painel de vencimentos.
- Cabeçalho, cartões, formulários e rodapés de modais receberam espaçamento e dimensões de toque consistentes.

### Funcionalidade e acessibilidade

- Os modais agora controlam foco, tecla `Esc`, atributos ARIA e bloqueio de rolagem da página.
- Os menus de período, Novo e Mais fecham uns aos outros para evitar camadas sobrepostas.
- Adicionada suíte de interface em Chrome/Edge para testar desktop, mobile, navegação, atalhos e cadastro de despesa.

## 1.6.3 — 20/10/2026

### Proteção contra perda de dados

- A sincronização agora combina registros locais e da nuvem em vez de substituir toda a base automaticamente.
- Exclusões passam a ser registradas para impedir que itens removidos reapareçam durante o merge.
- A geração de recorrências agora ocorre somente depois da primeira comparação com a nuvem.
- Criados pontos de recuperação automáticos antes de sincronizar, importar ou restaurar dados.
- Adicionada a área **Recuperação de dados**, com criação, download, restauração e exclusão de cópias.
- O schema do Supabase agora mantém as 30 versões anteriores de cada usuário.

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
