import { useLocation } from 'react-router-dom';
import Followers from './followers/followers';
import Following from './following/following';
import useUser from '../../hooks/use-user';
import './Follows.css';

export default function Follows() {
    const currentUser = useUser();
    const { pathname } = useLocation();
    const profileMatch = /^\/profile\/([^/]+)$/.exec(pathname);
    const viewedUserId = profileMatch?.[1];
    const isOwnProfile = !viewedUserId || viewedUserId === currentUser?.id;
    const foreignUserId = isOwnProfile ? undefined : viewedUserId;

    return (
        <div className='Follows'>
            <div className='follows-panels'>
                <Following userId={foreignUserId} />
                <Followers userId={foreignUserId} />
            </div>
        </div>
    );
}
