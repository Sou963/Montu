import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the voice assistant', () => {
  render(<App />);
  expect(screen.getAllByRole('heading', { name: /Funny AI/ })[0]).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /ভয়েস চালু করুন/i })).toBeInTheDocument();
});
