import React, {useState, useEffect} from 'react';
export const useAuthentication = (ssoScriptUrl, clientId) => {
    const [auth, setAuth] =useState ({isAuthenticated: false, isAuthenticating: true, authCode: null});
    useEffect(() => startAuthentication(ssoScriptUrl, clientId, setAuth), []);
        return auth;
};
function startAuthentication(ssoScriptUrl, clientId, setAuth) {
    const script = document.createElement("script");
    script.src = ssoScriptUrl;
    script.async=true;
    script.onload = function() {
        console.log("Script loaded");
        window.authSession.addLoginListeners((msg) => authSuccess(msg, setAuth), (msg) => authFailure(msg, setAuth));
        console.log("Attached login listeners, going to check authentication status");
        window.authSession.onReady(() =>  window.authSession.isAuthenticated(clientId));
        console.log("Requested the authentication status");
    };
    document.body.appendChild(script);
    return () => window.authSession.removeLoginListeners();
    }
    function authSuccess(msg, setAuth) {
        const _authStatus ={
            authCode: msg.code,
            isAuthenticated: true,
            isAuthenticating:false,
            accessToken: msg.access_token,
            userId: msg.user_id,
            userEmail: msg.user_email,
    };
    setAuth(_authStatus);
        console.log("Assigned status to authStatus: " + JSON.stringify(_authStatus));
    }
    function authFailure            (msg, setAuth) {
        const _authStatus = {
            isAuthenticated: false,
            isAuthenticating: false,
            authCode: null,
        };
        setAuth(_authStatus);
    }