import type User from '../../models/User';
import SpinnerButton from '../../common/spinner-button/SpinnerButton';
import { getAvatar } from '../../../utils/avatar';
import { useNavigate } from 'react-router-dom';
import useAsyncAction from '../../../hooks/use-async-action';
import useService from '../../../hooks/use-service';
import FollowingService from '../../../services/auth-aware/FollowingService';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { follow as followAction, unfollow as unfollowAction } from '../../../redux/following-slice';
import './follow.css';

interface FollowProps {
    user: User;
    readOnly?: boolean;
}

export default function Follow({ user, readOnly = false }: FollowProps) {
    const { id, name, username, avatarUrl } = user;
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const followingService = useService(FollowingService);
    const isFollowing = useAppSelector(state =>
        state.followingSlice.following.some(u => u.id === id)
    );

    const [handleFollow, isFollowLoading] = useAsyncAction(async () => {
        await followingService.follow(id);
        dispatch(followAction(user));
    });

    const [handleUnfollow, isUnfollowLoading] = useAsyncAction(async () => {
        await followingService.unfollow(id);
        dispatch(unfollowAction({ id }));
    });

    function openProfile() {
        navigate(`/profile/${id}`, { state: { user } });
    }

    return (
        <div className="follow">
            <button type="button" className="follow-profile-link" onClick={openProfile}>
                <img className="follow-avatar" src={getAvatar(avatarUrl)} alt={name} />
                <div className="follow-meta">
                    <div className="follow-name">{name}</div>
                    <div className="follow-username">@{username}</div>
                </div>
            </button>
            {!readOnly && !isFollowing && (
                <SpinnerButton className="follow-button" type="button" label="Follow" loadingLabel="Following..." isLoading={isFollowLoading} onClick={handleFollow} />
            )}
            {!readOnly && isFollowing && (
                <SpinnerButton className="unfollow-button" type="button" label="Unfollow" loadingLabel="Unfollowing..." isLoading={isUnfollowLoading} onClick={handleUnfollow} />
            )}
        </div>
    );
}
