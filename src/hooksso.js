import React, {useState, useEffect} from 'react';
export const useSSO = (sso_script) => {
    const [authStatus, setAuthStatus] =useState ({isAuthenticated: false, isAuthenticating: true, authCode: null});
    useEffect(() => {
        const script = document.createElement("script");
        script.src = sso_script;
        script.async=true;
        script.onload = function() {
            console.log("Script loaded");
            window.authSession.addLoginListeners(
                (msg) => {
                    const _authStatus ={
                        authCode: msg.code,
                        isAuthenticated: true,
                        isAuthenticating:false,
                };
                setAuthStatus(_authStatus);
                    console.log("Assigned status to authStatus: " + JSON.stringify(_authStatus));
                },
                (msg) => {
                    const _authStatus = {
                        isAuthenticated: false,
                        isAuthenticating: false,
                        authCode: null,
                    };
                    setAuthStatus(_authStatus);
                }
            );
            console.log("Attached login listeners, going to check authentication status");
            window.authSession.onReady(() => {
                window.authSession.isAuthenticated();
            });
            console.log("Requested the authentication status");
        };
        document.body.appendChild(script);
        return () => {
            window.authSession.removeLoginListeners();
        };
        }, []);
        return authStatus;
};
