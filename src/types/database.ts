export type RegistrationStatus = 'en_attente' | 'paye' | 'refuse' | 'probleme';

export type Registration = {
  id: string;
  agent_id: string;
  seq: number;
  email: string;
  mdp: string;
  status: RegistrationStatus;
  amount: number | null;
  admin_note: string | null;
  confirmed_at: string | null;
  exported_at: string | null;
  created_at: string;
};

export type RegistrationListItem = Omit<Registration, 'agent_id'>;

export type RegistrationWithAgent = Registration & {
  profiles: { full_name: string };
};

export type RecentRegistration = Omit<Registration, 'mdp'> & {
  profiles: { full_name: string };
};

export type StatusHistoryEntry = {
  from_status: RegistrationStatus | null;
  to_status: RegistrationStatus;
  amount: number | null;
  note: string | null;
  changed_by_name: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  registration_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type RegistrationStatusRpcError =
  | { code: '42501'; message: string }
  | { code: '22023'; message: string }
  | { code: 'P0002'; message: string };

export type RegistrationStatusRpcErrorCode = RegistrationStatusRpcError['code'];

export type AgentStats = {
  total: number;
  payes: number;
  en_attente: number;
  refuses: number;
  problemes: number;
  montant_total: number | null;
};

export type AdminStats = {
  agents_total: number;
  agents_suspended: number;
  total: number;
  payes: number;
  en_attente: number;
  refuses: number;
  problemes: number;
  montant_total: number;
};

export type AgentOverview = {
  agent_id: string;
  full_name: string;
  whatsapp: string;
  is_suspended: boolean;
  created_at: string;
  total: number;
  payes: number;
  en_attente: number;
  montant_total: number;
  last_activity: string | null;
};

export type DailyPoint = {
  day: string;
  total: number;
  payes: number;
};

export type RegistrationFilters = {
  status: RegistrationStatus | null;
  search: string;
};

export type AdminRegistrationFilters = RegistrationFilters & {
  agentName: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
  exported?: 'all' | 'exported' | 'not_exported';
};

export type RegistrationExportRow = Registration & {
  profiles: { full_name: string; whatsapp: string } | null;
};
