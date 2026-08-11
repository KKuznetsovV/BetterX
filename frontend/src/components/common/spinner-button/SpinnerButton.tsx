import spinnerSrc from '../../../assets/spinner.gif'
import './SpinnerButton.css'

interface SpinnerButtonProps {
    isLoading: boolean
    label: string
    loadingLabel?: string
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    className?: string
}

export default function SpinnerButton({ isLoading, label, loadingLabel, onClick, type = 'button', className }: SpinnerButtonProps) {
    if (isLoading) {
        return (
            <div className={`spinner-button-loading ${className ?? ''}`}>
                <img src={spinnerSrc} className="spinner-button-img" alt="loading" />
                <span>{loadingLabel ?? `${label}...`}</span>
            </div>
        )
    }

    return (
        <button className={className} type={type} onClick={onClick}>
            {label}
        </button>
    )
}
