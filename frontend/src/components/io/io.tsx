import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import SocketMessages from "socket-enums-kkuznetsovv-123"
import socket from "./socket"
import { useAppDispatch, useAppSelector } from "../../redux/hooks"
import { add, remove, update, addComment, updateComment, removeComment, updateUser as updateProfileUser, addLike as addLikeProfile, removeLike as removeLikeProfile } from "../../redux/profile-slice"
import { addFollower, removeFollower, updateUser as updateFollowersUser } from '../../redux/followers-slice'
import { follow as addFollowing, unfollow as removeFollowing, updateUser as updateFollowingUser } from '../../redux/following-slice'
import { updateUser as updateFeedUser, markPending, removeFromFeed, updatePost as updatePostFeed, addComment as addCommentFeed, updateComment as updateCommentFeed, removeComment as removeCommentFeed, addLike as addLikeFeed, removeLike as removeLikeFeed } from '../../redux/feed-slice'
import { updateUser as updateUsersUser } from '../../redux/users-slice'
import { addViewedFollower, removeViewedFollower, addViewedFollowing, removeViewedFollowing } from '../../redux/viewed-follows-slice'
import { add as addNotification } from '../../redux/notifications-slice'
import type Post from "../models/Post"
import type PostComment from "../models/PostComment"
import type User from "../models/User"
import type Like from "../models/Like"
import type AppNotification from "../models/AppNotification"
import useUser from "../../hooks/use-user"


export default function Io({ children }: { children: ReactNode }) {
    const dispatch = useAppDispatch()
    const currentUser = useUser()
    const currentUserId = currentUser?.id
    const following = useAppSelector(state => state.followingSlice.following)
    const followingRef = useRef(following)
    useEffect(() => { followingRef.current = following }, [following])
    const viewedUserId = useAppSelector(state => state.viewedFollowsSlice.userId)
    const viewedUserIdRef = useRef(viewedUserId)
    useEffect(() => { viewedUserIdRef.current = viewedUserId }, [viewedUserId])

    useEffect(() => {
        function handleEvent(eventName: string, payload: object) {
            const p = payload as { socketId?: string }
            if (p.socketId && p.socketId === socket.id) return
            switch (eventName) {
                case SocketMessages.NEW_POST: {
                    const post = payload as Post
                    dispatch(add(post))
                    if (post.userId !== currentUserId && followingRef.current.some(u => u.id === post.userId)) {
                        dispatch(markPending())
                    }
                    break
                }
                case SocketMessages.UPDATE_POST:
                    dispatch(update(payload as { id: string; title: string; body: string; imageUrl?: string | null }))
                    dispatch(updatePostFeed(payload as { id: string; title: string; body: string; imageUrl?: string | null }))
                    break
                case SocketMessages.DELETE_POST: {
                    const { id } = payload as { id: string }
                    dispatch(remove({ id }))
                    dispatch(removeFromFeed({ id }))
                    break
                }
                case SocketMessages.NEW_COMMENT:
                    dispatch(addComment(payload as PostComment))
                    dispatch(addCommentFeed(payload as PostComment))
                    break
                case SocketMessages.UPDATE_COMMENT:
                    dispatch(updateComment(payload as PostComment))
                    dispatch(updateCommentFeed(payload as PostComment))
                    break
                case SocketMessages.NEW_NOTIFICATION: {
                    const notif = payload as AppNotification
                    if (notif.recipientId === currentUserId) {
                        dispatch(addNotification(notif))
                    }
                    break
                }
                case SocketMessages.DELETE_COMMENT:
                    dispatch(removeComment(payload as { id: string; postId: string }))
                    dispatch(removeCommentFeed(payload as { id: string; postId: string }))
                    break
                case SocketMessages.NEW_FOLLOW: {
                    const { follower, followee } = payload as { follower: User; followee: User }
                    if (followee.id === currentUserId) dispatch(addFollower(follower))
                    if (follower.id === currentUserId) dispatch(addFollowing(followee))
                    // update viewed profile sidebar if the event involves the viewed user
                    const vid = viewedUserIdRef.current
                    if (vid) {
                        if (followee.id === vid) dispatch(addViewedFollower(follower))
                        if (follower.id === vid) dispatch(addViewedFollowing(followee))
                    }
                    break
                }
                case SocketMessages.UNFOLLOW: {
                    const { followerId, followeeId } = payload as { followerId: string; followeeId: string }
                    if (followeeId === currentUserId) dispatch(removeFollower({ id: followerId }))
                    if (followerId === currentUserId) dispatch(removeFollowing({ id: followeeId }))
                    // update viewed profile sidebar if the event involves the viewed user
                    const vid = viewedUserIdRef.current
                    if (vid) {
                        if (followeeId === vid) dispatch(removeViewedFollower({ id: followerId }))
                        if (followerId === vid) dispatch(removeViewedFollowing({ id: followeeId }))
                    }
                    break
                }
                case SocketMessages.NEW_PROFILE: {
                    const u = payload as { id: string; name: string; username: string; avatarUrl?: string | null }
                    dispatch(updateProfileUser(u))
                    dispatch(updateFeedUser(u))
                    dispatch(updateFollowersUser(u))
                    dispatch(updateFollowingUser(u))
                    dispatch(updateUsersUser(u))
                    break
                }
                case 'NEW_LIKE': {
                    const { like } = payload as { like: Like }
                    dispatch(addLikeProfile(like))
                    dispatch(addLikeFeed(like))
                    break
                }
                case 'REMOVE_LIKE': {
                    const data = payload as { userId: string; postId?: string; commentId?: string }
                    dispatch(removeLikeProfile(data))
                    dispatch(removeLikeFeed(data))
                    break
                }
            }
        }
        socket.onAny(handleEvent)
        return () => { socket.offAny(handleEvent) }
    }, [dispatch, currentUserId])
    return (
        <>{ children }</>
    )
}