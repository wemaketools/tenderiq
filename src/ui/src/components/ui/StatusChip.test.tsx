import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CHIP_TONES, ENUMS, enumTone } from '@contracts/enums';
import type { EnumName } from '@contracts/enums';

import { tEnum } from '../../lib/i18n';
import { Chip, OverdueChip, StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('has a design-system tone and a non-empty label for every value of every enumeration', () => {
    const problems: string[] = [];
    let checked = 0;
    for (const name of Object.keys(ENUMS) as EnumName[]) {
      for (const value of ENUMS[name]) {
        checked += 1;
        const tone = enumTone(name, value);
        if (!(CHIP_TONES as readonly string[]).includes(tone))
          problems.push(`${name}.${value}: tone ${tone}`);
        if (tEnum(name, value).trim() === '') problems.push(`${name}.${value}: empty label`);
      }
    }
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(500);
  });

  it('renders the label text with the tone class of the enumeration value', () => {
    render(<StatusChip enum="tenders.status" value="closed" />);
    const chip = screen.getByText('Closed / awaiting opening');
    expect(chip).toHaveClass('tiq-chip', `tiq-chip--${enumTone('tenders.status', 'closed')}`);
  });

  it('renders every tone class of the design system', () => {
    render(
      <>
        {CHIP_TONES.map((tone) => (
          <Chip key={tone} tone={tone}>
            {tone}
          </Chip>
        ))}
      </>,
    );
    for (const tone of CHIP_TONES) {
      expect(screen.getByText(tone)).toHaveClass(`tiq-chip--${tone}`);
    }
  });

  it('marks overdue items with an outlined danger chip', () => {
    render(<OverdueChip />);
    expect(screen.getByText('Overdue')).toHaveClass('tiq-chip--danger', 'tiq-chip--outlined');
  });
});
