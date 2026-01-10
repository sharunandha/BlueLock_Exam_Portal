import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from '../components/Login';
import { vi } from 'vitest';

test('Login calls onLogin with correct user', async () => {
  const onLogin = vi.fn();
  render(<Login onLogin={onLogin} />);

  const input = screen.getByPlaceholderText(/e.g. egoist_01@bluelock.com/i);
  const submit = screen.getByText(/Access Portal/i);

  await fireEvent.input(input, { target: { value: 'test_user@bluelock.com' } });
  await fireEvent.click(submit);

  expect(onLogin).toHaveBeenCalled();
  expect(onLogin).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'test_user@bluelock.com', role: 'student' })
  );
});
