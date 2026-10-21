# FinanZen - Sistema Completo de Gestão Financeira Pessoal

O **FinanZen** é uma aplicação web (PWA) moderna, sofisticada e intuitiva projetada para transformar o controle do seu dinheiro em uma experiência agradável, visual e eficiente.

Roda 100% no navegador, sem servidor próprio. A sincronização em nuvem é **opcional**.

**Versão atual:** 1.8.1 — consulte o [histórico de alterações](CHANGELOG.md).

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

> Atualizando uma instalação anterior para a versão 1.6.3 ou superior:
> execute novamente o arquivo `supabase/schema.sql` no SQL Editor. O script é
> idempotente e cria o histórico de segurança sem apagar a tabela atual.

---

## Desenvolvimento

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
