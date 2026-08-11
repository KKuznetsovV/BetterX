import './Feed.css';
import { useEffect, useState } from 'react';
import useService from '../../../hooks/use-service';
import FeedService from '../../../services/auth-aware/FeedService';
import Post from '../../post/Post';
import Spinner from '../../common/spinner/Spinner';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { populate } from '../../../redux/feed-slice';

export default function Feed() {
    const feedService = useService(FeedService);
    const dispatch = useAppDispatch();
    const feed = useAppSelector(state => state.feedSlice.feed);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (feed.length > 0) {
            setIsLoaded(true);
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                const posts = await feedService.getFeed();
                dispatch(populate(posts));
                setIsLoaded(true);
            } catch (e) {
                setIsLoaded(false);
                alert(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [feed.length, feedService, dispatch]);

    return (
        <div className="feed">
            <div className="feed-header">
                <span className="feed-header-icon">📰</span>
                <h2>Your Feed</h2>
            </div>
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <>
                    {feed.length === 0 && (
                        <div className="feed-empty">
                            <span className="feed-empty-icon">🌱</span>
                            Follow people to see their posts here.
                        </div>
                    )}
                    {feed.map(post => (
                        <div key={post.id} className="feed-post-wrap">
                            <Post post={post} isReadOnly={true} />
                        </div>
                    ))}
                </>
            )}
            {!isLoading && !isLoaded && <div className="feed-error">⚠️ Error loading feed.</div>}
        </div>
    );
}
