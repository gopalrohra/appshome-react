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
    refreshAccessToken: async () => '',
    fetchWithAuth: async () => undefined,
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
    if (auth && typeof auth.fetchWithAuth === 'function') {
        return auth.fetchWithAuth(url, options);
    }

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
    const refreshPromiseRef = useRef(null);
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
        setJwtState('');
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

    const refreshAccessToken = useCallback(async () => {
        if (!config.refreshTokenUrl || !jwt) {
            throw new Error('Unable to refresh JWT');
        }
        if (refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        refreshPromiseRef.current = refreshJwt(config, jwt)
            .then((nextJwt) => {
                if (!nextJwt) {
                    throw new Error('Unable to refresh JWT');
                }
                setJwt(nextJwt);
                return nextJwt;
            })
            .catch((err) => {
                setJwt('');
                throw err;
            })
            .finally(() => {
                refreshPromiseRef.current = null;
            });

        return refreshPromiseRef.current;
    }, [config, jwt, setJwt]);

    const fetchWithAuth = useCallback(async (url, options = {}) => {
        const { skipAuthRefresh, ...requestOptions } = options;
        const response = await authorizedFetch(url, requestOptions, jwt);
        if (response.status !== 401 || skipAuthRefresh || !config.refreshTokenUrl || !jwt) {
            return response;
        }

        const nextJwt = await refreshAccessToken();
        return authorizedFetch(url, requestOptions, nextJwt);
    }, [config.refreshTokenUrl, jwt, refreshAccessToken]);

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
        refreshAccessToken,
        fetchWithAuth,
        config,
        navigate,
    }), [jwt, user, isAuthenticated, isAuthenticating, login, logout, changePassword, setJwt, exchangeAuthCode, refreshAccessToken, fetchWithAuth, config, navigate]);
}

export function startAuthorizeRedirect(config, redirectUrl) {
    const normalizedConfig = normalizeConfig(config);
    const normalizedRedirectUrl = redirectUrl || normalizedConfig.defaultRedirectPath;
    writePendingRedirect(normalizedConfig, normalizedRedirectUrl);
    const state = window.btoa(JSON.stringify({ redirectUrl: normalizedRedirectUrl }));
    window.location.href = withParams(normalizedConfig.authorizeUrl, {
        client_id: normalizedConfig.clientId,
        redirect_uri: getAppUrl(normalizedConfig.callbackPath),
        state,
    });
}

export function decodeAuthState(state, defaultRedirectPath = '/', config = {}) {
    const fallbackRedirectPath = readPendingRedirect(config) || defaultRedirectPath;
    if (!state) {
        clearPendingRedirect(config);
        return { redirectUrl: fallbackRedirectPath };
    }
    try {
        const decodedState = JSON.parse(window.atob(state));
        clearPendingRedirect(config);
        if (decodedState && decodedState.redirectUrl) {
            return decodedState;
        }
        return { redirectUrl: fallbackRedirectPath };
    } catch (err) {
        clearPendingRedirect(config);
        return { redirectUrl: fallbackRedirectPath };
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

async function refreshJwt(config, jwt) {
    const response = await fetch(config.refreshTokenUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error('Unable to refresh JWT');
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
    return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
}

function redirectTo(path, replace, navigate) {
    if (navigate && path.startsWith('/')) {
        navigate(path);
        return;
    }
    if (replace) {
        window.location.replace(path);
    } else {
        window.location.href = path;
    }
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

function pendingRedirectStorageKey(config = {}) {
    const normalizedConfig = normalizeConfig(config);
    return normalizedConfig.redirectStorageKey || `${storageKey(normalizedConfig)}.redirect`;
}

function writePendingRedirect(config, redirectUrl) {
    try {
        window.sessionStorage.setItem(pendingRedirectStorageKey(config), redirectUrl);
    } catch (err) {
        return;
    }
}

function readPendingRedirect(config) {
    try {
        return window.sessionStorage.getItem(pendingRedirectStorageKey(config));
    } catch (err) {
        return '';
    }
}

function clearPendingRedirect(config) {
    try {
        window.sessionStorage.removeItem(pendingRedirectStorageKey(config));
    } catch (err) {
        return;
    }
}

function toBase64(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
}

async function authorizedFetch(url, options, jwt) {
    const headers = {
        ...(options.headers || {}),
    };
    if (jwt) {
        headers.Authorization = `Bearer ${jwt}`;
    }

    return fetch(url, {
        ...options,
        headers,
    });
}

function DefaultSpinner({ label = 'Loading' }) {
    return <div>{label}</div>;
}
