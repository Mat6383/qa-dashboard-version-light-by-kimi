import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'error', onClose, duration = 5000 }) => {
    const [visible, setVisible] = useState(true);
    const timerRef = useRef(null);
    const remainingRef = useRef(duration);
    const startTimeRef = useRef(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const startTimer = (ms) => {
        clearTimer();
        startTimeRef.current = Date.now();
        remainingRef.current = ms;
        timerRef.current = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, ms);
    };

    useEffect(() => {
        if (!message) return;
        setVisible(true);
        startTimer(duration);
        return clearTimer;
    }, [message, duration, onClose]);

    const handleMouseEnter = () => {
        if (timerRef.current && startTimeRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            remainingRef.current = Math.max(0, remainingRef.current - elapsed);
            clearTimer();
        }
    };

    const handleMouseLeave = () => {
        if (remainingRef.current > 0) {
            startTimer(remainingRef.current);
        }
    };

    if (!message) return null;

    return (
        <div
            role="alert"
            aria-live="polite"
            className={`toast toast--${type}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)'
            }}
        >
            <AlertCircle size={20} />
            <span className="toast-message">{message}</span>
            <button
                onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
                className="toast-close"
                aria-label="Close"
                type="button"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
