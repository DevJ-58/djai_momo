import { describe, expect, it } from 'vitest';
import { getRegistrationDetailId, updateRegistrationDetailParam } from './registration-detail-route';

describe('registration detail route', () => {
  it('opens the registration referenced by ?r independently from list filters', () => {
    expect(getRegistrationDetailId('?status=paye&page=9&r=registration-42')).toBe('registration-42');
  });

  it('removes only ?r while preserving active filters', () => {
    expect(updateRegistrationDetailParam('?status=paye&search=mail&r=registration-42', null))
      .toBe('?status=paye&search=mail');
  });

  it('replaces the registration id without adding another parameter', () => {
    expect(updateRegistrationDetailParam('?status=gagne&r=old', 'new')).toBe('?status=gagne&r=new');
  });
});
