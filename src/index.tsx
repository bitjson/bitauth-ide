import React from 'react';
import './index.scss';
import { App } from './App';
import * as serviceWorker from './serviceWorker';
import { Provider, configureStore } from './state/store';
import LogRocket from 'logrocket';
import { createRoot } from 'react-dom/client';

if (process.env.NODE_ENV === 'production') {
  LogRocket.init('wkulwl/bitauth-ide');
}

const store = configureStore();

const root = createRoot(document.getElementById('root')!);
if (process.env.NODE_ENV === 'development') {
  console.log(
    'Bitauth IDE is running in development mode. Please note, we use an experimental version of React with support for Concurrent Mode. This is supposed to require Strict Mode, which is not yet supported by Blueprint: https://github.com/palantir/blueprint/issues/3979. However, this incompatibility does not appear to cause problems in Bitauth IDE (other than warnings).'
  );
}

/**
 * If running inside Cypress, make the Redux store available on the window
 * object.
 */
if ((window as any).Cypress) {
  (window as any).store = store;
}

const render = (app: typeof App) =>
  root.render(
    <Provider store={store}>
      <App />
    </Provider>
  );

render(App);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();

if (process.env.NODE_ENV === 'development') {
  if (module.hot) {
    module.hot.accept('./App', () => {
      const NextApp = require('./App').default;
      render(NextApp);
    });
  }
}
