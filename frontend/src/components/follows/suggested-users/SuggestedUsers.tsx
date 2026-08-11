import { useEffect, useState } from 'react';
import Follow from '../follow/follow';
import Spinner from '../../common/spinner/Spinner';
import useService from '../../../hooks/use-service';
import useAsyncAction from '../../../hooks/use-async-action';
import RecommendationsService from '../../../services/auth-aware/RecommendationsService';
import type SuggestedUser from '../../models/SuggestedUser';
import './SuggestedUsers.css';

export default function SuggestedUsers() {
    const recommendationsService = useService(RecommendationsService);
    const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [topicInput, setTopicInput] = useState('');
    const [appliedTopic, setAppliedTopic] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setIsLoading(true);
                const data = await recommendationsService.getSuggestedUsers();
                setSuggestions(data);
                setIsLoaded(true);
            } catch {
                setIsLoaded(false);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [recommendationsService]);

    const [handleSearch, isSearching] = useAsyncAction(async () => {
        const trimmed = topicInput.trim();
        const data = await recommendationsService.getSuggestedUsers(trimmed || undefined);
        setSuggestions(data);
        setIsLoaded(true);
        setAppliedTopic(trimmed || null);
    });

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        handleSearch();
    }

    const [handleClear, isClearing] = useAsyncAction(async () => {
        setTopicInput('');
        setAppliedTopic(null);
        const data = await recommendationsService.getSuggestedUsers();
        setSuggestions(data);
        setIsLoaded(true);
    });

    const isBusy = isLoading || isSearching || isClearing;

    return (
        <div className="suggested-users">
            <h4 className="suggested-users-title">Suggested for you</h4>
            <form className="suggested-users-topic-form" onSubmit={handleSubmit}>
                <input
                    className="suggested-users-topic-input"
                    placeholder="Suggest by topic, e.g. 'hiking and mountains'..."
                    value={topicInput}
                    onChange={e => setTopicInput(e.target.value)}
                    maxLength={200}
                />
                <button type="submit" className="suggested-users-topic-button" disabled={isBusy || !topicInput.trim()}>
                    {isSearching ? 'Searching...' : 'Suggest'}
                </button>
                {appliedTopic && (
                    <button type="button" className="suggested-users-topic-clear" disabled={isBusy} onClick={handleClear}>
                        Clear
                    </button>
                )}
            </form>
            {isBusy && <Spinner />}
            {!isBusy && isLoaded && suggestions.length === 0 && appliedTopic && (
                <p className="suggested-users-empty">No users found matching "{appliedTopic}".</p>
            )}
            {!isBusy && isLoaded && suggestions.length > 0 && (
                <div className="suggested-users-list">
                    {suggestions.map(suggestion => (
                        <div className="suggested-user" key={suggestion.userId}>
                            <Follow
                                user={{
                                    id: suggestion.userId,
                                    name: suggestion.name,
                                    username: suggestion.username,
                                    avatarUrl: suggestion.avatarUrl,
                                    password: '',
                                    createdAt: '',
                                    updatedAt: '',
                                }}
                            />
                            <p className="suggested-user-reason">{suggestion.reasonToFollow}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

