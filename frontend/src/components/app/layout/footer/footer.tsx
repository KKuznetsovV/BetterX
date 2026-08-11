import './footer.css'
export default function Footer() {
    const currentServer =
        import.meta.env.VITE_REST_SERVER_URL ??
        import.meta.env.VITE_API_URL ??
        'not configured';

    return (
        <div className="footer">
            <div className="footer-left">
                <img className="footer-logo" src="/BetterX-logo.png" alt="BetterX" />
                <span>&copy; {new Date().getFullYear()} BetterX. All rights reserved.</span>
            </div>
            <div className="footer-right">
                <span>current server: {currentServer}</span>
            </div>
        </div>
    )
}
