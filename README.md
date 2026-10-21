# FinanZen - Sistema Completo de Gestão Financeira Pessoal

O **FinanZen** é uma aplicação web (PWA) moderna, sofisticada e intuitiva projetada para transformar o controle do seu dinheiro em uma experiência agradável, visual e eficiente.

Roda 100% no navegador, sem servidor próprio. A sincronização em nuvem é **opcional**.

**Versão atual:** 1.9.1 — consulte o [histórico de alterações](CHANGELOG.md).

---

## Principais Funcionalidades

1. **Dashboard Inteligente**:
   - Cartões de indicadores com Saldo Líquido, Total de Receitas, Total de Despesas e Taxa de Poupança.
   - Gráfico de **Fluxo de Caixa Mensal** (evolução de receitas vs despesas ao longo dos 12 meses).
   - Gráfico de **Distribuição de Gastos** (Donut interativo por categoria com porcentagens).
   - Comparação com o mês anterior, previsão de gastos e lista das transações mais recentes.

2. **Gestão de Transações**:
   - Cadastro detalhado de **Receitas** e **Despesas** (descrição, valor, categoria, conta/cartão, status pago/pendente, vencimento, notas).
   - **Parcelamento no cartão** (até 24x) com pré-visualização do valor de cada parcela.
   - **Lançamentos fixos/recorrentes** (mensal ou semanal) com escolha do dia do mês.
   - Filtros instantâneos por período (mês a mês ou geral), tipo, categoria e status.
   - Busca textual instantânea, edição e exclusão de lançamentos.
   - **Transferências entre contas** com taxa opcional e recorrência.

3. **Cartões de Crédito**:
   - Visão por cartão e por período de fatura.
   - Regras de **fechamento** e **vencimento** por cartão, com cálculo automático de faturas.
   - **Despesas lançadas no cartão viram "Fatura futura"** (pendentes): aparecem normalmente no sistema e compõem a fatura do cartão, mas só ficam marcadas como pagas quando a fatura é paga.
   - **Pagamento da fatura** registra a transferência da conta pagadora para o cartão, quitando as compras do ciclo.

4. **Orçamentos & Tetos de Gastos**:
   - Teto máximo de gasto mensal por categoria.
   - Barras de progresso com inteligência visual:
     - **Verde**: Gastos sob controle.
     - **Amarelo**: Atenção (mais de 75% atingido).
     - **Vermelho**: Limite estourado (mais de 100%).

5. **Metas & Cofrinhos Financeiros**:
   - Guarde dinheiro para sonhos específicos (Viagens, Reserva de Emergência, Veículo, Imóvel).
   - Acompanhamento percentual do progresso com data limite.
   - Aporte rápido "+ Guardar" diretamente na meta.

6. **Relatórios & Educação Financeira**:
   - Top 5 maiores despesas do período, evolução do patrimônio e **score financeiro**.
   - Dicas práticas de educação financeira (como a regra 50/30/20).

7. **Privacidade e Dados Seus**:
   - Dados armazenados no navegador via `localStorage`.
   - **Backup completo (JSON)** para download e restauração.
   - **Exportação para planilhas (CSV)** compatível com Excel e Google Sheets.
   - Pontos de recuperação automáticos antes de sincronizações e importações.
   - **Modo Escuro** e **Modo Claro** com memória de preferência.

8. **PWA - Instalável e Offline**:
   - Instalável no celular (Android/iOS) e no PC pelo navegador.
   - Service Worker guarda o app para funcionar sem internet após a primeira visita.

9. **Sincronização em Nuvem (opcional)**:
   - Login por e-mail e senha via **Supabase**, com sincronização automática entre aparelhos.
   - Merge conservador: registros exclusivos do navegador e da nuvem são preservados.
   - Histórico das 30 versões anteriores no Supabase e controle de exclusões.
   - Sem configurar o Supabase, o app segue 100% local e nenhum dado sai do dispositivo.

10. **Fundação Open Finance (em preparação)**:
   - Modelo normalizado, RLS, cliente web e Edge Functions preparados para integração.
   - Conexões reais permanecem bloqueadas até a configuração de um provedor.
   - Consulte [OPEN-FINANCE.md](OPEN-FINANCE.md) para implantação e requisitos de segurança.

---

## Como Executar

Não é necessário instalar nenhum servidor ou banco de dados.

1. Abra o arquivo `index.html` diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Brave, Safari), **ou**
2. Utilize extensões como *Live Server* no VS Code.

Para publicar, verifique [DEPLOY.md](DEPLOY.md) (guia completo) e [GUIA-RAPIDO.md](GUIA-RAPIDO.md) (resumo de 1 página).

> Atualizando uma instalação anterior para a versão 1.9.1 ou superior:
> execute novamente o arquivo `supabase/schema.sql` no SQL Editor. O script é
> idempotente, preserva a tabela atual, cria o controle de revisão e bloqueia
> gravações diretas de clientes antigos.

---

## Desenvolvimento

### Atualização para 1.9.1: contas e sincronização

Execute o arquivo completo `supabase/schema.sql` no SQL Editor do Supabase antes de publicar esta versão. Ele mantém os dados e o histórico existentes, adiciona revisões e a função `finanzen_compare_and_set`, e bloqueia gravações diretas de versões antigas. Atualize o aplicativo em todos os aparelhos. O cliente exige a tabela padrão `finanzen_data`.

Cada usuário agora tem seus próprios dados, preferências, histórico local e metadados de sincronização. Ao sair, o aplicativo volta ao espaço local do navegador. Os dados antigos, sem identificação de proprietário, permanecem nesse espaço e não são associados automaticamente à primeira conta que entrar. Para migrá-los, saia da conta, exporte o backup JSON, entre na conta correta e importe o arquivo.

Dados, preferências e o marcador de alteração são salvos juntos. Falhas de gravação revertem a alteração em memória e exibem um erro. Uma aba desatualizada deve ser recarregada antes de editar. Documentos locais ilegíveis são preservados e sua sobrescrita fica bloqueada.

Os envios são serializados e conferem a revisão no servidor. Em caso de conflito, o cliente relê e combina os dados, com até três tentativas. A comparação com a última cópia sincronizada preserva edições independentes em registros diferentes. Se dois aparelhos alterarem o mesmo registro, a edição local pendente tem prioridade; exclusões registradas prevalecem. O histórico permite recuperar versões anteriores. Edições feitas durante um envio continuam pendentes para o próximo envio.

O isolamento é entre os espaços do aplicativo. As cópias locais continuam no perfil do navegador e podem ser acessadas por quem controla esse perfil.

```bash
npm test        # testes de negócio, sync e integridade (node:test)
npm run test:ui # fluxos reais de desktop/mobile no Chrome ou Edge
npm run check   # verificação de sintaxe de todos os JS
```

### Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `js/state.js` | Lógica de negócio e persistência (localStorage) |
| `js/app.js` | Interface e renderização |
| `js/charts.js` | Gráficos (Chart.js) |
| `js/sync.js` | Sincronização com Supabase |
| `js/open-finance.js` | Cliente seguro e interface do Open Finance |
| `js/sync-config.js` | URL e chave pública do Supabase (opcional) |
| `sw.js` | Service Worker (cache e modo offline) |
| `CHANGELOG.md` | Histórico organizado das versões |
| `tests/` | Testes automatizados |
| `supabase/schema.sql` | Tabela e políticas RLS da nuvem |
| `supabase/open-finance-schema.sql` | Tabelas normalizadas e RLS do Open Finance |
| `supabase/functions/` | Backend e contrato do provedor Open Finance |

---

*Desenvolvido com carinho para simplificar e alavancar sua liberdade financeira.*
