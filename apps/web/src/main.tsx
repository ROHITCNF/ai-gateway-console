import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { HttpGatewayClient } from './gateway';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing in index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App client={new HttpGatewayClient()} />
    </BrowserRouter>
  </StrictMode>,
);
