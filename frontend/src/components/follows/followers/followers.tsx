import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Follow from '../follow/follow';
import Spinner from '../../common/spinner/Spinner';
import useService from '../../../hooks/use-service';
import FollowersService from '../../../services/auth-aware/FollowersService';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { populate } from '../../../redux/followers-slice';
import { setViewedFollowers } from '../../../redux/viewed-follows-slice';
import './followers.css';

const PREVIEW_LIMIT = 6;

interface FollowersProps {
    userId?: string;
}

export default function Followers({ userId }: FollowersProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const followersService = useService(FollowersService);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const handleViewAll = () => navigate(userId ? `/follows/followers/${userId}` : '/follows/followers');
    const ownFollowers = useAppSelector(state => state.followersSlice.followers);
    const viewedFollowers = useAppSelector(state => state.viewedFollowsSlice.followers);

    // own followers
    useEffect(() => {
        if (userId) return;
        if (ownFollowers.length > 0) {
            setIsLoaded(true);
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                const data = await followersService.getFollowers();
                dispatch(populate(data));
                setIsLoaded(true);
            } catch (e) {
                setIsLoaded(false);
                alert(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [userId, ownFollowers.length, followersService, dispatch]);

    // foreign user followers
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        setIsLoaded(false);
        setIsLoading(true);
        (async () => {
            try {
                const data = await followersService.getFollowersOf(userId);
                if (!cancelled) {
                    dispatch(setViewedFollowers({ userId, followers: data }));
                    setIsLoaded(true);
                }
            } catch {
                if (!cancelled) setIsLoaded(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, followersService, dispatch]);

    const list = userId ? viewedFollowers : ownFollowers;

    return (
        <div className="followers">
            <button className="followers-heading" onClick={handleViewAll}>
                <span className="followers-heading-icon">👥</span>
                <h2>Followers</h2>
                <span className="followers-badge">{list.length}</span>
            </button>
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <div className="followers-list">
                    {list.length === 0 && <div className="followers-empty">No followers yet.</div>}
                    {list.slice(0, PREVIEW_LIMIT).map(user => <Follow key={user.id} user={user} readOnly={!!userId} />)}
                    {list.length > PREVIEW_LIMIT && (
                        <button className="followers-see-all" onClick={handleViewAll}>See all {list.length} ›</button>
                    )}
                </div>
            )}
            {!isLoading && !isLoaded && <div className="followers-error">Error loading followers.</div>}
        </div>
    );
}
