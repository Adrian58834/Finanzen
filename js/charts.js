/**
 * FinanZen - Módulo de Gráficos e Visualização de Dados
 */

class FinanceCharts {
  constructor() {
    this.flowChartInstance = null;
    this.categoryChartInstance = null;
    this.netWorthChartInstance = null;
    this.incomeCategoryChartInstance = null;
  }

  getCurrency() {
    return (window.financialState && window.financialState.settings.currency) || 'BRL';
  }

  formatCurrency(value) {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: this.getCurrency()
      }).format(value);
    } catch (e) {
      return 'R$ ' + (Number(value) || 0).toFixed(2);
    }
  }

  currencySymbol() {
    try {
      const parts = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: this.getCurrency()
      }).formatToParts(0);
      const symbol = parts.find(p => p.type === 'currency');
      return symbol ? symbol.value : 'R$';
    } catch (e) {
      return 'R$';
    }
  }

  initOrUpdateFlowChart(canvasId, year = new Date().getFullYear()) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const flowData = window.financialState.getMonthlyFlow(year);

    if (this.flowChartInstance) {
      this.flowChartInstance.data.labels = flowData.labels;
      this.flowChartInstance.data.datasets[0].data = flowData.income;
      this.flowChartInstance.data.datasets[1].data = flowData.expense;
      this.flowChartInstance.update();
      return;
    }

    this.flowChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: flowData.labels,
        datasets: [
          {
            label: 'Receitas',
            data: flowData.income,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 28
          },
          {
            label: 'Despesas',
            data: flowData.expense,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderColor: '#f43f5e',
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 16,
              color: '#94a3b8',
              font: {
                family: 'Plus Jakarta Sans',
                weight: '600',
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                return ` ${label}: ${this.formatCurrency(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (value) => this.currencySymbol() + ' ' + value
            }
          }
        }
      }
    });
  }

  initOrUpdateCategoryChart(canvasId, monthStr = 'all') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const catData = window.financialState.getExpensesByCategory(monthStr);

    const labels = catData.map(c => c.name);
    const dataValues = catData.map(c => c.total);
    const backgroundColors = catData.map(c => c.color);

    // Se não houver despesas no período selecionado
    if (dataValues.length === 0) {
      if (this.categoryChartInstance) {
        this.categoryChartInstance.destroy();
        this.categoryChartInstance = null;
      }
      ctx.parentElement.innerHTML = `
        <div class="empty-state" style="padding: 24px 0;">
          <i class="ri-pie-chart-line empty-state-icon" style="font-size: 2.2rem;"></i>
          <p class="empty-state-title" style="font-size: 0.95rem;">Sem despesas neste período</p>
          <p class="empty-state-desc" style="font-size: 0.8rem;">Cadastre despesas para visualizar a divisão por categorias.</p>
        </div>
        <canvas id="${canvasId}"></canvas>
      `;
      return;
    }

    if (this.categoryChartInstance) {
      this.categoryChartInstance.data.labels = labels;
      this.categoryChartInstance.data.datasets[0].data = dataValues;
      this.categoryChartInstance.data.datasets[0].backgroundColor = backgroundColors;
      this.categoryChartInstance.update();
      return;
    }

    this.categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: backgroundColors,
            borderColor: '#111827',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 10,
              color: '#94a3b8',
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${this.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  initOrUpdateNetWorthChart(canvasId, monthsCount = 12) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const data = window.financialState.getNetWorthEvolution(monthsCount);

    if (this.netWorthChartInstance) {
      this.netWorthChartInstance.data.labels = data.labels;
      this.netWorthChartInstance.data.datasets[0].data = data.values;
      this.netWorthChartInstance.update();
      return;
    }

    const chartCtx = ctx.getContext('2d');
    let gradient = null;
    if (chartCtx) {
      gradient = chartCtx.createLinearGradient(0, 0, 0, 260);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
      gradient.addColorStop(0.7, 'rgba(168, 85, 247, 0.12)');
      gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
    }

    this.netWorthChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Patrimônio Líquido',
            data: data.values,
            borderColor: '#6366f1',
            borderWidth: 2.5,
            backgroundColor: gradient || 'rgba(99, 102, 241, 0.15)',
            fill: true,
            tension: 0.38,
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => {
                return ` Patrimônio: ${this.formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (value) => this.currencySymbol() + ' ' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value)
            }
          }
        }
      }
    });
  }

  initOrUpdateIncomeCategoryChart(canvasId, monthStr = 'all') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const catData = window.financialState.getIncomeByCategory(monthStr);

    const labels = catData.map(c => c.name);
    const dataValues = catData.map(c => c.total);
    const backgroundColors = catData.map(c => c.color);

    if (dataValues.length === 0) {
      if (this.incomeCategoryChartInstance) {
        this.incomeCategoryChartInstance.destroy();
        this.incomeCategoryChartInstance = null;
      }
      ctx.parentElement.innerHTML = `
        <div class="empty-state" style="padding: 24px 0;">
          <i class="ri-pie-chart-line empty-state-icon" style="font-size: 2.2rem;"></i>
          <p class="empty-state-title" style="font-size: 0.95rem;">Sem receitas neste período</p>
          <p class="empty-state-desc" style="font-size: 0.8rem;">Cadastre receitas para visualizar a distribuição por fontes.</p>
        </div>
        <canvas id="${canvasId}"></canvas>
      `;
      return;
    }

    if (this.incomeCategoryChartInstance) {
      this.incomeCategoryChartInstance.data.labels = labels;
      this.incomeCategoryChartInstance.data.datasets[0].data = dataValues;
      this.incomeCategoryChartInstance.data.datasets[0].backgroundColor = backgroundColors;
      this.incomeCategoryChartInstance.update();
      return;
    }

    this.incomeCategoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: backgroundColors,
            borderColor: '#111827',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 10,
              color: '#94a3b8',
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${this.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

window.financeCharts = new FinanceCharts();
