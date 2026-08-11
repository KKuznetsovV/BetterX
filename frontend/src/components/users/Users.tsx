import { useEffect, useState } from 'react';
import useService from '../../hooks/use-service';
import useUser from '../../hooks/use-user';
import UsersService from '../../services/auth-aware/UsersService';
import Follow from '../follows/follow/follow';
import SuggestedUsers from '../follows/suggested-users/SuggestedUsers';
import Spinner from '../common/spinner/Spinner';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { populate } from '../../redux/users-slice';
import './Users.css';

export default function Users() {
    const usersService = useService(UsersService);
    const currentUser = useUser();
    const dispatch = useAppDispatch();
    const users = useAppSelector(state => state.usersSlice.users);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (users.length > 0) {
            setIsLoaded(true);
            return;
        }
        (async () => {
            try {
                setIsLoading(true);
                const data = await usersService.getUsers();
                dispatch(populate(data));
                setIsLoaded(true);
            } catch (e) {
                setIsLoaded(false);
                alert(e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [users.length, usersService, dispatch]);

    const filteredUsers = users
        .filter(u => u.id !== currentUser?.id)
        .filter(u => {
            const q = search.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className='Users'>
            <SuggestedUsers />
            <input
                className='users-search'
                placeholder='Search by name or username...'
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            {isLoading && <Spinner />}
            {!isLoading && isLoaded && (
                <div className='users-list'>
                    {filteredUsers.length === 0
                        ? <p className='users-empty'>No users found.</p>
                        : filteredUsers.map(user => (
                            <Follow key={user.id} user={user} />
                        ))
                    }
                </div>
            )}
            {!isLoading && !isLoaded && <div><h4>Error loading users...</h4></div>}
        </div>
    );
}
