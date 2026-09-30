/**
 * Interaction helpers of the selection SPA tests.
 */
import { fireEvent, within } from '@testing-library/react';

/** Fills a DateTimeInput (date and time in the official zone) found by its label inside `container`. */
export function setDateTime(
  container: HTMLElement,
  label: RegExp,
  date: string,
  time: string,
): void {
  const group = within(container).getByRole('group', { name: label });
  fireEvent.change(within(group).getByLabelText('Date'), { target: { value: date } });
  fireEvent.change(within(group).getByLabelText('Time'), { target: { value: time } });
}
