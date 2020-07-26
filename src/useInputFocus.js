import { useEffect, useRef } from 'react';
export default function useInputFocus() {
    const refElement = useRef(null);
    useEffect(() => {
        refElement.current.focus();
    }, []);
    return refElement;
}