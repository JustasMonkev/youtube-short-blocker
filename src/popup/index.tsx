import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { redirectPopupPageIfNeeded } from './utils/popupRuntime';
import './styles.css';

export function bootstrapPopup(targetWindow = window, targetDocument = document): void {
  if (redirectPopupPageIfNeeded(targetWindow)) {
    return;
  }

  const rootElement = targetDocument.getElementById('root');

  if (!rootElement) {
    throw new Error('Popup root element was not found.');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrapPopup();
