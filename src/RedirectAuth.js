import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export const AuthContext = createContext({
    jwt: '',
    accessToken: '',
    access_token: '',
    user: null,
    isAuthenticated: false,
    isAuthenticating: true,
    login: () => {},
    logout: () => {},
    changePassword: () => {},
    setJwt: () => {},
});

const defaultConfig = {
    callbackPath: '/auth/callback',
    defaultRedirectPath: '/',
    persistence: 'memory',
};

export function AuthProvider({ children, config, navigate }) {
    const auth = useRedirectAuth(config, navigate);
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const AuthContextProvider = AuthProvider;

export function useAppshomeAuth() {
    return useContext(AuthContext);
}

export function AuthCallback({ navigate, spinner, renderError }) {
    const auth = useAppshomeAuth();
    const [error, setError] = useState('');
    const hasStarted = useRef(false);
    const Spinner = spinner || DefaultSpinner;

    useEffect(() => {
        if (hasStarted.current) {
            return;
        }
        hasStarted.current = true;

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const { redirectUrl } = decodeAuthState(state, auth.config.defaultRedirectPath);

        if (!code) {
            setError('The authorization server did not send an auth code.');
            return;
        }

        auth.exchangeAuthCode(code)
            .then((jwt) => {
                if (!jwt) {
                    throw new Error('The backend response did not include a JWT.');
                }
                auth.setJwt(jwt);
                redirectTo(redirectUrl || auth.config.defaultRedirectPath, true, navigate || auth.navigate);
            })
            .catch((err) => {
                setError(err.message || 'Unable to complete sign in.');
            });
    }, [auth, navigate]);

    if (error) {
        if (renderError) {
            return renderError(error, auth);
        }
        return (
            <div>
                <h1>We could not finish authentication.</h1>
                <p>{error}</p>
                <button type="button" onClick={() => auth.login(auth.config.defaultRedirectPath)}>Try again</button>
            </div>
        );
    }

    return <Spinner label="Completing sign in" />;
}

export function AuthenticatedUser({ children, fallback = null }) {
    const auth = useAppshomeAuth();
    if (auth.isAuthenticating) {
        return null;
    }
    return auth.isAuthenticated ? children : fallback;
}

export function requireAuth(auth, element, fallback) {
    if (!auth || !auth.isAuthenticated) {
        return fallback || null;
    }
    return element;
}

export function authFetch(auth, url, options = {}) {
    const token = auth && (auth.jwt || auth.accessToken || auth.access_token);
    const headers = Object.assign({}, options.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
    return fetch(url, Object.assign({}, options, { headers }));
}

export function getAuthHeader(auth) {
    const token = auth && (auth.jwt || auth.accessToken || auth.access_token);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useRedirectAuth(rawConfig, navigate) {
    const config = useMemo(() => normalizeConfig(rawConfig), [rawConfig]);
    const [jwt, setJwtState] = useState(() => readStoredJwt(config));
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    const user = useMemo(() => getUserFromJwt(jwt), [jwt]);
    const isAuthenticated = Boolean(jwt);

    const setJwt = useCallback((nextJwt) => {
        const normalizedJwt = nextJwt || '';
        setJwtState(normalizedJwt);
        writeStoredJwt(config, normalizedJwt);
    }, [config]);

    const login = useCallback((redirectUrl = currentPath()) => {
        startAuthorizeRedirect(config, redirectUrl);
    }, [config]);

    const logout = useCallback(() => {
        clearStoredJwt(config);
        //setJwtState('');
        if (config.logoutUrl) {
            window.location.href = withParams(config.logoutUrl, { redirect_url: getAppUrl('/') });
        }
    }, [config]);

    const changePassword = useCallback((redirectUrl = currentPath()) => {
        if (config.changePasswordUrl) {
            window.location.href = withParams(config.changePasswordUrl, { redirect_url: getAppUrl(redirectUrl) });
        }
    }, [config]);

    const exchangeAuthCode = useCallback((authCode) => exchangeCode(config, authCode), [config]);

    useEffect(() => {
        if (!config.sessionStatusUrl) {
            setIsAuthenticating(false);
            return undefined;
        }

        let isActive = true;

        const syncSession = async () => {
            const data = await getSessionStatus(config);
            if (!isActive) {
                return;
            }

            if (jwt && data && data.logged_in === false) {
                setJwt('');
            } else if (!jwt && data && data.logged_in === true && window.location.pathname !== config.callbackPath) {
                startAuthorizeRedirect(config, currentPath());
            }
            setIsAuthenticating(false);
        };

        const syncWhenVisible = () => {
            if (document.visibilityState === 'visible') {
                syncSession();
            }
        };

        syncSession();
        document.addEventListener('visibilitychange', syncWhenVisible);
        window.addEventListener('focus', syncSession);

        return () => {
            isActive = false;
            document.removeEventListener('visibilitychange', syncWhenVisible);
            window.removeEventListener('focus', syncSession);
        };
    }, [config, jwt, setJwt]);

    return useMemo(() => ({
        jwt,
        accessToken: jwt,
        access_token: jwt,
        user,
        isAuthenticated,
        isAuthenticating,
        login,
        logout,
        changePassword,
        setJwt,
        exchangeAuthCode,
        config,
        navigate,
    }), [jwt, user, isAuthenticated, isAuthenticating, login, logout, changePassword, setJwt, exchangeAuthCode, config, navigate]);
}

export function startAuthorizeRedirect(config, redirectUrl) {
    const normalizedConfig = normalizeConfig(config);
    const state = window.btoa(JSON.stringify({ redirectUrl: redirectUrl || normalizedConfig.defaultRedirectPath }));
    window.location.href = withParams(normalizedConfig.authorizeUrl, {
        client_id: normalizedConfig.clientId,
        redirect_uri: getAppUrl(normalizedConfig.callbackPath),
        state,
    });
}

export function decodeAuthState(state, defaultRedirectPath = '/') {
    if (!state) {
        return { redirectUrl: defaultRedirectPath };
    }
    try {
        return JSON.parse(window.atob(state));
    } catch (err) {
        return { redirectUrl: defaultRedirectPath };
    }
}

export function withParams(url, params) {
    const target = new URL(url, window.location.origin);
    Object.keys(params).forEach((key) => {
        if (params[key]) {
            target.searchParams.set(key, params[key]);
        }
    });
    return target.toString();
}

export function getAppUrl(path) {
    return `${window.location.protocol}//${window.location.host}${path}`;
}

export function getUserFromJwt(jwt) {
    if (!jwt) {
        return null;
    }
    try {
        const payload = JSON.parse(window.atob(toBase64(jwt.split('.')[1])));
        return {
            name: payload.name || payload.username || payload.email || 'User',
            email: payload.email,
            user_id: payload.user_id || payload.sub,
        };
    } catch (err) {
        return { name: 'User' };
    }
}

function normalizeConfig(config = {}) {
    return Object.assign({}, defaultConfig, config);
}

async function exchangeCode(config, authCode) {
    const response = await fetch(config.tokenExchangeUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code: authCode,
            callback_url: getAppUrl(config.callbackPath),
        }),
    });

    if (!response.ok) {
        throw new Error('Unable to exchange auth code');
    }

    const data = await response.json();
    return data.jwt || data.token || data.access_token;
}

async function getSessionStatus(config) {
    try {
        const response = await fetch(config.sessionStatusUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            cache: 'no-store',
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    } catch (err) {
        return null;
    }
}

function currentPath() {
    return `${window.location.pathname}${window.location.search}`;
}

function redirectTo(path, replace, navigate) {
    if (navigate) {
        navigate(path, replace);
        return;
    }
    if (replace) {
        window.history.replaceState(null, '', path);
    } else {
        window.history.pushState(null, '', path);
    }
    window.dispatchEvent(new Event('popstate'));
}

function readStoredJwt(config) {
    if (config.persistence !== 'localStorage') {
        return '';
    }
    try {
        return window.localStorage.getItem(storageKey(config)) || '';
    } catch (err) {
        return '';
    }
}

function writeStoredJwt(config, jwt) {
    if (config.persistence !== 'localStorage') {
        return;
    }
    try {
        if (jwt) {
            window.localStorage.setItem(storageKey(config), jwt);
        } else {
            window.localStorage.removeItem(storageKey(config));
        }
    } catch (err) {
        return;
    }
}

function clearStoredJwt(config) {
    if (config.persistence === 'localStorage') {
        try {
            window.localStorage.removeItem(storageKey(config));
        } catch (err) {
            return;
        }
    }
}

function storageKey(config) {
    return config.storageKey || `appshome.auth.${config.clientId}`;
}

function toBase64(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
}

function DefaultSpinner({ label = 'Loading' }) {
    return <div>{label}</div>;
}
