export type ProviderConnection = {
  id: string;
  provider: string;
  providerConnectionId: string;
  institutionId?: string;
  institutionName: string;
};

export type NormalizedAccount = {
  externalId: string;
  type: 'bank' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'other';
  subtype?: string;
  name: string;
  officialName?: string;
  mask?: string;
  currency: string;
  currentBalance?: number;
  availableBalance?: number;
  creditLimit?: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedTransaction = {
  externalAccountId: string;
  externalId?: string;
  deduplicationKey: string;
  type: 'income' | 'expense' | 'transfer';
  status: 'pending' | 'posted' | 'voided';
  amount: number;
  currency: string;
  date: string;
  postedAt?: string;
  description: string;
  rawDescription?: string;
  merchantName?: string;
  categoryKey?: string;
  metadata?: Record<string, unknown>;
};

export type SyncResult = {
  cursor?: string;
  accounts: NormalizedAccount[];
  transactions: NormalizedTransaction[];
};

export type WebhookEvent = {
  id: string;
  type: string;
  providerConnectionId?: string;
  connectionStatus?: 'pending' | 'active' | 'attention' | 'expired' | 'revoked' | 'error';
  shouldSync?: boolean;
  payload: Record<string, unknown>;
};

export interface OpenFinanceProvider {
  readonly name: string;
  createConnectSession(input: { userId: string; callbackUrl: string }): Promise<{ authorizationUrl: string }>;
  syncConnection(connection: ProviderConnection): Promise<SyncResult>;
  disconnect(connection: ProviderConnection): Promise<void>;
  parseWebhook(req: Request): Promise<WebhookEvent>;
}

export class ProviderNotConfiguredError extends Error {}

/**
 * Ponto único de integração com o fornecedor escolhido.
 *
 * Ao contratar um provedor, implemente o adaptador neste diretório e retorne-o
 * abaixo. Nenhuma das demais funções ou telas precisará conhecer o formato da
 * API externa.
 */
export function getProviderAdapter(): OpenFinanceProvider {
  const provider = Deno.env.get('OPEN_FINANCE_PROVIDER') || '';
  if (!provider) {
    throw new ProviderNotConfiguredError('Defina OPEN_FINANCE_PROVIDER nos secrets das Edge Functions.');
  }

  throw new ProviderNotConfiguredError(`O adaptador do provedor “${provider}” ainda não foi implementado.`);
}
