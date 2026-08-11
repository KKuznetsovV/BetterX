import { useEffect, useRef, useState } from 'react';
import './Profile.css';
import useService from '../../../hooks/use-service';
import ProfileService from '../../../services/auth-aware/ProfileService';
import FollowingService from '../../../services/auth-aware/FollowingService';
import Post from '../../post/Post';
import NewPost from '../new/NewPost';
import Spinner from '../../common/spinner/Spinner';
import SpinnerButton from '../../common/spinner-button/SpinnerButton';
import { useParams, useLocation } from 'react-router-dom';
import useUser from '../../../hooks/use-user';
import type User from '../../models/User';
import { getAvatar } from '../../../utils/avatar';
import useAsyncAction from '../../../hooks/use-async-action';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { populate } from '../../../redux/profile-slice';
import { follow as followAction, unfollow as unfollowAction } from '../../../redux/following-slice';
import EditProfile from './EditProfile';

interface ProfileLocationState {
    user?: User;
    targetPostId?: string | null;
    targetCommentId?: string | null;
}

export default function Profile() {
    const profileService = useService(ProfileService);
    const followingService = useService(FollowingService);
    const currentUser = useUser();
    const { userId } = useParams<{ userId: string }>();
    const location = useLocation();
    const locationState = location.state as ProfileLocationState | null;
    const searchParams = new URLSearchParams(location.search);
    const stateUser = locationState?.user;
    const targetPostId = searchParams.get('targetPostId') ?? locationState?.targetPostId ?? null;
    const targetCommentId = searchParams.get('targetCommentId') ?? locationState?.targetCommentId ?? null;
    const dispatch = useAppDispatch();
    const profile = useAppSelector(state => state.profileSlice.posts);
    const profileRef = useRef(profile);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    const following = useAppSelector(state => state.followingSlice.following);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
    const isOwnProfile = !userId || userId === currentUser?.id;
    const isFollowing = following.some(u => u.id === userId);

    const [handleFollow, isFollowLoading] = useAsyncAction(async () => {
        if (!userId) return;
        await followingService.follow(userId);
        dispatch(followAction(stateUser ?? profile[0]?.user));
    });

    const [handleUnfollow, isUnfollowLoading] = useAsyncAction(async () => {
        if (!userId) return;
        await followingService.unfollow(userId);
        dispatch(unfollowAction({ id: userId }));
    });

    useEffect(() => {
        (async () => {
            try {
                const cached = profileRef.current;
                if (isOwnProfile && cached.length > 0 && cached[0].userId === currentUser?.id) {
                    setIsLoaded(true);
                    return;
                }
                setIsLoading(true);
                const posts = isOwnProfile
                    ? await profileService.getProfile()
                    : await profileService.getProfileByUserId(userId!);
                dispatch(populate(posts));
                setIsLoaded(true);
            } catch (e) {
                setIsLoaded(false);
                alert(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [isOwnProfile, profileService, userId, dispatch, currentUser?.id]);

    useEffect(() => {
        if (!isLoaded) return;
        const targetElementId = targetCommentId
            ? `comment-${targetCommentId}`
            : targetPostId
                ? `post-${targetPostId}`
                : null;
        if (!targetElementId) return;

        let tries = 0;
        const maxTries = 40;
        const tryScroll = () => {
            const element = document.getElementById(targetElementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (tries < maxTries) {
                tries += 1;
                window.setTimeout(tryScroll, 150);
            }
        };

        tryScroll();
    }, [isLoaded, profile.length, targetPostId, targetCommentId, location.key]);

    const displayUser = profile.length > 0 ? profile[0].user : stateUser;
    const displayCurrentUser = profile.length > 0 ? profile[0].user : currentUser;

    return (
        <div className="profile">
            {isOwnProfile && displayCurrentUser && (
                <div className="profile-own-header">
                    <button type="button" className="profile-header-avatar-btn" onClick={() => setAvatarLightboxOpen(true)}>
                        <img
                            className="profile-header-avatar"
                            src={getAvatar(displayCurrentUser.avatarUrl)}
                            alt={displayCurrentUser.name}
                        />
                    </button>
                    <div className="profile-header-meta">
                        <div className="profile-header-name">{displayCurrentUser.name}</div>
                        <div className="profile-header-username">@{displayCurrentUser.username}</div>
                    </div>
                    <button className="profile-edit-button" type="button" onClick={() => setIsEditingProfile(true)}>
                        Edit Profile
                    </button>
                </div>
            )}
            {!isOwnProfile && displayUser && (
                <div className="profile-header">
                    <button type="button" className="profile-header-avatar-btn" onClick={() => setAvatarLightboxOpen(true)}>
                        <img
                            className="profile-header-avatar"
                            src={getAvatar(displayUser.avatarUrl)}
                            alt={displayUser.name}
                        />
                    </button>
                    <div className="profile-header-meta">
                        <div className="profile-header-name">{displayUser.name}</div>
                        <div className="profile-header-username">@{displayUser.username}</div>
                    </div>
                    {isFollowing
                        ? <SpinnerButton className="profile-unfollow-button" type="button" label="Unfollow" loadingLabel="Unfollowing..." isLoading={isUnfollowLoading} onClick={handleUnfollow} />
                        : <SpinnerButton className="profile-follow-button" type="button" label="Follow" loadingLabel="Following..." isLoading={isFollowLoading} onClick={handleFollow} />
                    }
                </div>
            )}
            {isOwnProfile && <NewPost />}
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <>
                    {profile.length === 0
                        ? <p className="profile-empty">No posts yet.</p>
                        : profile.map(post => (
                            <Post
                                key={post.id}
                                post={post}
                                isReadOnly={!isOwnProfile}
                                isNotificationTarget={targetPostId === post.id}
                                focusCommentId={targetPostId === post.id ? targetCommentId : undefined}
                            />
                        ))
                    }
                </>
            )}
            {!isLoading && !isLoaded && <div><h4>Error loading posts...</h4></div>}
            {isEditingProfile && currentUser && (
                <EditProfile currentUser={currentUser} onClose={() => setIsEditingProfile(false)} />
            )}
            {avatarLightboxOpen && (displayCurrentUser || displayUser) && (
                <div className="profile-lightbox" onClick={() => setAvatarLightboxOpen(false)}>
                    <button className="profile-lightbox-close" onClick={() => setAvatarLightboxOpen(false)}>✕</button>
                    <img
                        className="profile-lightbox-img"
                        src={getAvatar((displayCurrentUser ?? displayUser)!.avatarUrl)}
                        alt={(displayCurrentUser ?? displayUser)!.name}
                        onClick={() => setAvatarLightboxOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}
