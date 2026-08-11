import { useContext, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import AuthContext from '../../../auth/auth/AuthContext'
import useUser from '../../../../hooks/use-user'
import { useAppDispatch, useAppSelector } from '../../../../redux/hooks'
import { invalidate } from '../../../../redux/feed-slice'
import { resetAll } from '../../../../redux/reset-action'
import NotificationBell from '../../../notifications/NotificationBell'
import './header.css'

function getInitialDark() {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function Header() {
    const { logout } = useContext(AuthContext)!
    const user = useUser()
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const stale = useAppSelector(state => state.feedSlice.stale)
    const [dark, setDark] = useState(getInitialDark)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
        localStorage.setItem('theme', dark ? 'dark' : 'light')
    }, [dark])

    function handleToggleDark() {
        setDark(d => !d)
    }

    function handleReloadFeed() {
        dispatch(invalidate())
    }

    function handleHome() {
        navigate('/profile')
    }

    return (
        <div className="header">
            <div className="header-row">
                <div className="header-brand">
                    <button type="button" className="header-logo-btn" onClick={handleHome} title="Go home">
                        <img src="/BetterX-logo.png" alt="BetterX logo" className="header-logo" />
                    </button>
                </div>
                <nav className="header-nav">
                    <NavLink
                        to="/profile"
                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    >
                        Profile
                    </NavLink>
                    <span className="nav-divider">|</span>
                    <NavLink
                        to="/feed"
                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    >
                        Feed
                    </NavLink>
                    <span className="nav-divider">|</span>
                    <NavLink
                        to="/users"
                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    >
                        Users
                    </NavLink>
                </nav>
                <div className="header-user">
                    <button type="button" className="header-welcome" onClick={() => navigate('/profile')}>Welcome, {user?.name}</button>
                    <button
                        className="header-theme-toggle"
                        aria-label="Toggle dark mode"
                        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                        onClick={handleToggleDark}
                    >
                        {dark ? '☀️' : '🌙'}
                    </button>
                    <NotificationBell />
                    <button className="logout-button" onClick={() => { dispatch(resetAll()); logout(); }}>Logout</button>
                </div>
            </div>
            {stale && (
                <div className="header-feed-banner">
                    <span>Your feed has new posts from people you follow.</span>
                    <button className="header-feed-banner-btn" onClick={handleReloadFeed}>
                        Reload feed
                    </button>
                </div>
            )}
        </div>
    )
}
