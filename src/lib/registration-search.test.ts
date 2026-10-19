import { describe, expect, it } from 'vitest';
import { registrationSearchFilter } from './registration-search';

describe('registrationSearchFilter', () => {
  it('searches the identifier and normalized number', () => {
    expect(registrationSearchFilter('+225 07 01.02-03(04)'))
      .toBe('email.ilike."%+225 07 01.02-03(04)%",numero.ilike."%+2250701020304%"');
  });

  it('escapes PostgREST pattern characters', () => {
    expect(registrationSearchFilter('test%_name'))
      .toBe('email.ilike."%test\\%\\_name%",numero.ilike."%test\\%\\_name%"');
  });
});
