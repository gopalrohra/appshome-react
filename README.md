# appshome-react
React re-usable components and hooks.

## Redirect auth

Use `AuthProvider` for the browser redirect based auth flow. The provider handles authorize redirects, `/auth/callback` code exchange, session status checks, logout, change password, and JWT user parsing.

```jsx
import { AuthCallback, AuthProvider, useAppshomeAuth } from 'appshome-react';
import { navigate } from 'hookrouter';

const authConfig = {
  clientId: process.env.REACT_APP_CLIENT_ID,
  authorizeUrl: process.env.REACT_APP_AUTH_AUTHORIZE_URL,
  logoutUrl: process.env.REACT_APP_AUTH_LOGOUT_URL,
  changePasswordUrl: process.env.REACT_APP_AUTH_CHANGE_PASSWORD_URL,
  sessionStatusUrl: process.env.REACT_APP_AUTH_SESSION_STATUS_URL,
  tokenExchangeUrl: process.env.REACT_APP_AUTH_TOKEN_EXCHANGE_URL,
  callbackPath: '/auth/callback',
  defaultRedirectPath: '/',
  persistence: 'memory',
};

function Root() {
  return (
    <AuthProvider config={authConfig} navigate={navigate}>
      <App />
    </AuthProvider>
  );
}

function CallbackRoute() {
  return <AuthCallback navigate={navigate} />;
}

function SomeComponent() {
  const auth = useAppshomeAuth();
  return <button onClick={() => auth.login('/dashboard')}>Sign in</button>;
}
```

The token exchange endpoint should accept:

```json
{ "code": "authorization-code", "callback_url": "https://app.example/auth/callback" }
```

and return one of:

```json
{ "jwt": "..." }
```

`persistence` defaults to `memory`. Set it to `localStorage` only for apps that explicitly need refresh persistence.
