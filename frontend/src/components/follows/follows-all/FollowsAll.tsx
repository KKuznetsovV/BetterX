import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Follow from '../follow/follow';
import SuggestedUsers from '../suggested-users/SuggestedUsers';
import Spinner from '../../common/spinner/Spinner';
import useService from '../../../hooks/use-service';
import FollowersService from '../../../services/auth-aware/FollowersService';
import FollowingService from '../../../services/auth-aware/FollowingService';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { populate as populateFollowers } from '../../../redux/followers-slice';
import { populate as populateFollowing } from '../../../redux/following-slice';
import { setViewedFollowers, setViewedFollowing } from '../../../redux/viewed-follows-slice';
import './FollowsAll.css';

interface FollowsAllProps {
    type: 'followers' | 'following';
}

const ICONS = { followers: '👥', following: '➡️' };
const LABELS = { followers: 'Followers', following: 'Following' };

export default function FollowsAll({ type }: FollowsAllProps) {
    const { userId } = useParams<{ userId?: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const followersService = useService(FollowersService);
    const followingService = useService(FollowingService);

    const ownFollowers = useAppSelector(state => state.followersSlice.followers);
    const ownFollowing = useAppSelector(state => state.followingSlice.following);
    const viewedFollowers = useAppSelector(state => state.viewedFollowsSlice.followers);
    const viewedFollowing = useAppSelector(state => state.viewedFollowsSlice.following);
    const viewedUserId = useAppSelector(state => state.viewedFollowsSlice.userId);

    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [search, setSearch] = useState('');

    const isOwnProfile = !userId;

    const list = isOwnProfile
        ? (type === 'followers' ? ownFollowers : ownFollowing)
        : (type === 'followers' ? viewedFollowers : viewedFollowing);

    useEffect(() => {
        if (isOwnProfile && list.length > 0) { setIsLoaded(true); return; }
        if (!isOwnProfile && viewedUserId === userId && list.length > 0) { setIsLoaded(true); return; }

        let cancelled = false;
        setIsLoaded(false);
        setIsLoading(true);

        (async () => {
            try {
                if (type === 'followers') {
                    const data = isOwnProfile
                        ? await followersService.getFollowers()
                        : await followersService.getFollowersOf(userId!);
                    if (cancelled) return;
                    if (isOwnProfile) dispatch(populateFollowers(data));
                    else dispatch(setViewedFollowers({ userId: userId!, followers: data }));
                } else {
                    const data = isOwnProfile
                        ? await followingService.getFollowing()
                        : await followingService.getFollowingOf(userId!);
                    if (cancelled) return;
                    if (isOwnProfile) dispatch(populateFollowing(data));
                    else dispatch(setViewedFollowing({ userId: userId!, following: data }));
                }
                setIsLoaded(true);
            } catch {
                if (!cancelled) setIsLoaded(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, type, viewedUserId, isOwnProfile]);

    const filtered = list.filter(u => {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });

    const label = LABELS[type];
    const icon = ICONS[type];

    return (
        <div className='FollowsAll'>
            <div className='follows-all-header'>
                <button className='follows-all-back' onClick={() => navigate(-1)}>←</button>
                <span className='follows-all-icon'>{icon}</span>
                <h2 className='follows-all-title'>{label}</h2>
                <span className='follows-all-count'>{list.length}</span>
            </div>
            <input
                className='follows-all-search'
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <div className='follows-all-list'>
                    {filtered.length === 0
                        ? <div className='follows-all-empty'>No {label.toLowerCase()} found.</div>
                        : filtered.map(user => <Follow key={user.id} user={user} readOnly={!isOwnProfile} />)
                    }
                </div>
            )}
            {!isLoading && !isLoaded && <div className='follows-all-error'>Error loading {label.toLowerCase()}.</div>}
            {isOwnProfile && <SuggestedUsers />}
        </div>
    );
}
