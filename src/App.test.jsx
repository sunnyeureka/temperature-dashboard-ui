import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

const setOption = vi.fn();
const on = vi.fn();
const dispose = vi.fn();

vi.mock('echarts', () => ({
  init: () => ({
    setOption,
    getOption: () => ({ dataZoom: [{ start: 95, end: 100 }] }),
    on,
    dispose,
  }),
}));

beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({
        T1: [
          { time: new Date().toISOString(), temperature: "1.23" },
        ]
      })
    })
  );
});

afterAll(() => {
  vi.restoreAllMocks();
});


describe('App component', () => {
  it('renders title and cards', () => {
    render(<App />);
    expect(screen.getByText('Live Temperature Monitoring')).toBeInTheDocument();
    expect(screen.getByText('WebSocket Status')).toBeInTheDocument();
    expect(screen.getByText('Active Sensors')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('renders the chart container', () => {
    render(<App />);
    const chart = document.querySelector('.chart');
    expect(chart).toBeInTheDocument();
  });
});

describe('ECharts setup', () => {
  it('should initialize echarts and set options', () => {
    render(<App />);
    expect(setOption).toHaveBeenCalled();
  });

  it('should attach datazoom event handler', () => {
    render(<App />);
    expect(on).toHaveBeenCalledWith('datazoom', expect.any(Function));
  });

  it('should dispose chart on unmount', () => {
    const { unmount } = render(<App />);
    unmount();
    expect(dispose).toHaveBeenCalled();
  });
});
