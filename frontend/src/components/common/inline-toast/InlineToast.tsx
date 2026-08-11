import { useEffect } from 'react'
import './InlineToast.css'

export type InlineToastTone = 'info' | 'warning' | 'error'

interface InlineToastProps {
    message: string
    tone?: InlineToastTone
    autoCloseMs?: number
    onClose?: () => void
}

export default function InlineToast({ message, tone = 'info', autoCloseMs = 4200, onClose }: InlineToastProps) {
    useEffect(() => {
        if (!onClose || autoCloseMs <= 0) return
        const id = window.setTimeout(() => onClose(), autoCloseMs)
        return () => window.clearTimeout(id)
    }, [onClose, autoCloseMs, message])

    return (
        <div className={`inline-toast inline-toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
            <span className="inline-toast-text">{message}</span>
            {onClose && (
                <button type="button" className="inline-toast-close" onClick={onClose} aria-label="Dismiss message">
                    x
                </button>
            )}
        </div>
    )
}
