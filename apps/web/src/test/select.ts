import { fireEvent, screen } from '@testing-library/react';

/** Opens a Radix select (shadcn `Select`) and picks the option with this visible name. */
export function chooseOption(trigger: HTMLElement, name: string | RegExp) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name }));
}
