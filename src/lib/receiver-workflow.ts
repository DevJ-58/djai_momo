export type ReceiverProgressStatus = 'nouveau' | 'en_cours' | 'termine';
export type ReceiverResult = 'gagne' | 'echec' | 'renonce';

export type ReceiverRegistration = {
  id: string;
  agent_id: string;
  send_day: string;
  day_seq: number;
  email: string;
  mdp: string;
  numero: string | null;
  description: string | null;
  progress_status: ReceiverProgressStatus;
  result: ReceiverResult | null;
  prize: number | null;
};

export function normalizeReceiverPrize(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function formatReceiverPrize(value: unknown): string | null {
  const amount = normalizeReceiverPrize(value);
  return amount === null ? null : amount.toLocaleString('fr-FR');
}

export function getAddedReceiverIds(
  previousIds: ReadonlySet<string> | null,
  currentIds: readonly string[],
): string[] {
  if (previousIds === null) return [];
  return currentIds.filter((id) => !previousIds.has(id));
}

export type ReceiverAmountMutation = 'set_result' | 'update_prize';
export type ReceiverValidationTrigger = 'input' | 'ok' | 'enter' | 'blur' | 'leave';

const amountCharacters = /^\d[\d \u00a0\u202f]*$/;

export function parseReceiverAmount(value: string): number | null {
  const normalized = value.trim();
  if (!normalized || !amountCharacters.test(normalized)) return null;

  const amount = Number(normalized.replace(/[ \u00a0\u202f]/g, ''));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 999_999_999
    ? amount
    : null;
}

export function formatReceiverAmount(value: string): string {
  if (!/^[\d \u00a0\u202f]*$/.test(value)) return value;
  const digits = value.replace(/[ \u00a0\u202f]/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function chooseReceiverAmountMutation(
  result: ReceiverResult | null,
  amount: number | null,
): ReceiverAmountMutation | null {
  if (amount === null) return null;
  return result === 'gagne' ? 'update_prize' : 'set_result';
}

export function shouldSubmitReceiverAmount(
  trigger: ReceiverValidationTrigger,
  amount: number | null,
  inFlight: boolean,
  lastSavedAmount: number | undefined,
): boolean {
  return trigger !== 'input'
    && amount !== null
    && !inFlight
    && amount !== lastSavedAmount;
}

export function sortReceiverRegistrations<T extends Pick<ReceiverRegistration, 'send_day' | 'day_seq'>>(
  items: readonly T[],
): T[] {
  return [...items].sort((first, second) => (
    first.send_day.localeCompare(second.send_day) || first.day_seq - second.day_seq
  ));
}

export function getReceiverStartIndex(items: readonly Pick<ReceiverRegistration, 'progress_status'>[]): number {
  if (items.length === 0) return 0;
  const firstTodo = items.findIndex((item) => item.progress_status !== 'termine');
  return firstTodo === -1 ? items.length - 1 : firstTodo;
}
