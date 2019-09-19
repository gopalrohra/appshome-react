import React, {useState, useEffect} from 'react';
import config from './config';
export const useSSO = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    useEffect(() => {
        const script = document.createElement("script");
        script.src = config.SESSION_JS_URL;
        script.async=true;
        script.onload = function() {
            console.log("Script loaded");
            window.authSession.addLoginListeners(
                (msg) => {
                    setIsAuthenticated(true)
                    setIsAuthenticating(false);
                },
                (msg) => {
                    setIsAuthenticated(false)
                    setIsAuthenticating(false);
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
        }, [])   ;
        return [isAuthenticated, isAuthenticating];
};
