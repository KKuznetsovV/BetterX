import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { populate, markAllRead as markAllReadAction, markOneRead as markOneReadAction } from '../../redux/notifications-slice'
import useService from '../../hooks/use-service'
import NotificationsService from '../../services/auth-aware/NotificationsService'
import { getAvatar } from '../../utils/avatar'
import './NotificationBell.css'

function notifLabel(type: string, actorName?: string): string {
    const name = actorName ?? 'Someone'
    if (type === 'comment') return `${name} commented on your post`
    if (type === 'follow') return `${name} started following you`
    if (type === 'post') return `${name} published a new post`
    return 'New notification'
}

export default function NotificationBell() {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const notificationsService = useService(NotificationsService)
    const { items, loaded } = useAppSelector(state => state.notificationsSlice)
    const [open, setOpen] = useState(false)
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
    const wrapRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const unread = items.filter(n => !n.read).length

    useEffect(() => {
        if (!loaded) {
            notificationsService.getNotifications().then(data => dispatch(populate(data))).catch(() => {})
        }
    }, [loaded, notificationsService, dispatch])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node
            const clickInsideWrap = wrapRef.current?.contains(target)
            const clickInsidePanel = panelRef.current?.contains(target)
            if (!clickInsideWrap && !clickInsidePanel) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function handleOpen() {
        const next = !open
        if (next && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setPanelStyle({
                position: 'fixed',
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            })
        }
        setOpen(next)
        if (next && unread > 0) {
            await notificationsService.markAllRead().catch(() => {})
            dispatch(markAllReadAction())
        }
    }

    async function handleNotifClick(notif: typeof items[0]) {
        if (!notif.read) {
            await notificationsService.markOneRead(notif.id).catch(() => {})
            dispatch(markOneReadAction(notif.id))
        }
        setOpen(false)
        if (notif.type === 'post') {
            if (notif.actorId) {
                const params = new URLSearchParams()
                if (notif.postId) params.set('targetPostId', notif.postId)
                navigate(`/profile/${notif.actorId}${params.toString() ? `?${params.toString()}` : ''}`, { state: { targetPostId: notif.postId } })
            }
            return
        }
        if (notif.type === 'comment') {
            const params = new URLSearchParams()
            if (notif.postId) params.set('targetPostId', notif.postId)
            if (notif.commentId) params.set('targetCommentId', notif.commentId)
            navigate(
                { pathname: '/profile', search: params.toString() ? `?${params.toString()}` : '' },
                {
                    state: {
                        targetPostId: notif.postId,
                        targetCommentId: notif.commentId,
                    },
                }
            )
            return
        }
        if (notif.type === 'follow' && notif.actorId) {
            navigate(`/profile/${notif.actorId}`)
        }
    }

    const panel = open && (
        <div className="notif-panel" style={panelStyle} ref={panelRef}>
            <div className="notif-panel-header">
                <span className="notif-panel-title">Notifications</span>
                {items.some(n => !n.read) && (
                    <button type="button" className="notif-mark-all" onClick={async () => {
                        await notificationsService.markAllRead().catch(() => {})
                        dispatch(markAllReadAction())
                    }}>Mark all read</button>
                )}
            </div>
            {items.length === 0 ? (
                <p className="notif-empty">No notifications yet.</p>
            ) : (
                <ul className="notif-list">
                    {items.map(notif => (
                        <li
                            key={notif.id}
                            className={`notif-item${notif.read ? '' : ' notif-item--unread'}`}
                            onClick={() => handleNotifClick(notif)}
                        >
                            <img
                                className="notif-avatar"
                                src={getAvatar(notif.actor?.avatarUrl)}
                                alt={notif.actor?.name ?? '?'}
                            />
                            <div className="notif-content">
                                <span className="notif-text">{notifLabel(notif.type, notif.actor?.name)}</span>
                                <span className="notif-time">{new Date(notif.createdAt).toLocaleString()}</span>
                            </div>
                            {!notif.read && <span className="notif-dot" />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )

    return (
        <div className="notif-bell-wrap" ref={wrapRef}>
            <button
                ref={btnRef}
                type="button"
                className={`notif-bell-btn${unread > 0 ? ' notif-bell-btn--active' : ''}`}
                aria-label="Notifications"
                title="Notifications"
                onClick={handleOpen}
            >
                🔔
                {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {panel && createPortal(panel, document.body)}
        </div>
    )
}
