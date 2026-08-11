import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Follow from '../follow/follow';
import Spinner from '../../common/spinner/Spinner';
import useService from '../../../hooks/use-service';
import FollowingService from '../../../services/auth-aware/FollowingService';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { populate } from '../../../redux/following-slice';
import { setViewedFollowing, clearViewedFollows } from '../../../redux/viewed-follows-slice';
import './following.css';

const PREVIEW_LIMIT = 6;

interface FollowingProps {
    userId?: string;
}

export default function Following({ userId }: FollowingProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const followingService = useService(FollowingService);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const handleViewAll = () => navigate(userId ? `/follows/following/${userId}` : '/follows/following');
    const ownFollowing = useAppSelector(state => state.followingSlice.following);
    const viewedFollowing = useAppSelector(state => state.viewedFollowsSlice.following);

    // own following
    useEffect(() => {
        if (userId) return;
        if (ownFollowing.length > 0) {
            setIsLoaded(true);
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                const data = await followingService.getFollowing();
                dispatch(populate(data));
                setIsLoaded(true);
            } catch (e) {
                setIsLoaded(false);
                alert(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [userId, ownFollowing.length, followingService, dispatch]);

    // foreign user following — fetches both followers+following together so slice stays consistent
    useEffect(() => {
        if (!userId) {
            dispatch(clearViewedFollows());
            return;
        }
        let cancelled = false;
        setIsLoaded(false);
        setIsLoading(true);
        (async () => {
            try {
                const data = await followingService.getFollowingOf(userId);
                if (!cancelled) {
                    dispatch(setViewedFollowing({ userId, following: data }));
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
    }, [userId, followingService, dispatch]);

    const list = userId ? viewedFollowing : ownFollowing;

    return (
        <div className="following">
            <button className="following-heading" onClick={handleViewAll}>
                <span className="following-heading-icon">➡️</span>
                <h2>Following</h2>
                <span className="following-badge">{list.length}</span>
            </button>
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <div className="following-list">
                    {list.length === 0 && <div className="following-empty">Not following anyone yet.</div>}
                    {list.slice(0, PREVIEW_LIMIT).map(user => <Follow key={user.id} user={user} readOnly={!!userId} />)}
                    {list.length > PREVIEW_LIMIT && (
                        <button className="following-see-all" onClick={handleViewAll}>See all {list.length} ›</button>
                    )}
                </div>
            )}
            {!isLoading && !isLoaded && <div className="following-error">Error loading following.</div>}
        </div>
    );
}
