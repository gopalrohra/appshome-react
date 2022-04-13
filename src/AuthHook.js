import React, { useState, useEffect } from 'react';
export const useAuth = (params) => {
    const [auth, setAuth] = useState({ isAuthenticating: true, user: null });
    useEffect(() => startAuthentication(params, setAuth), []);
    return auth;
};
function startAuthentication(params, setAuth) {
    const script = document.createElement("script");
    script.src = params.ssoScriptUrl;
    script.async = true;
    script.onload = function () {
        console.log("Script loaded");
        window.authSession.addLoginListeners((msg) => authSuccess(msg, setAuth, params), (msg) => authFailure(msg, setAuth));
        console.log("Attached login listeners, going to check authentication status");
        window.authSession.onReady(() => window.authSession.isAuthenticated(params.clientId));
        console.log("Requested the authentication status for clientId: " + params.clientId);
    };
    document.body.appendChild(script);
    return () => window.authSession.removeLoginListeners();
}
function authSuccess(msg, setAuth, params) {
    params.authCallback(msg.code)
        .then(res => {
            if (res.status === "Success") {
                console.log("Assigned status to authStatus: " + JSON.stringify(res));
                setAuth({ isAuthenticating: false, user: res });
            }
        });
}
function authFailure(msg, setAuth) {
    const _authStatus = {
        isAuthenticating: false,
        user: null,
    };
    setAuth(_authStatus);
}