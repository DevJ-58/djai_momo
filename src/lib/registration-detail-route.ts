export function getRegistrationDetailId(search: string): string {
  return new URLSearchParams(search).get('r') ?? '';
}

export function updateRegistrationDetailParam(search: string, registrationId: string | null): string {
  const params = new URLSearchParams(search);
  if (registrationId) params.set('r', registrationId);
  else params.delete('r');
  const query = params.toString();
  return query ? `?${query}` : '';
}
