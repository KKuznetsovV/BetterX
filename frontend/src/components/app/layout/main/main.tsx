import { Navigate, Route, Routes } from 'react-router-dom';
import Profile from '../../../posts/profile/Profile';
import Feed from '../../../posts/feed/Feed';
import NotFound from '../layout/not-found/NotFound';
import Follows from '../../../follows/Follows';
import FollowsAll from '../../../follows/follows-all/FollowsAll';
import Users from '../../../users/Users';

export default function Main() {
    return (
        <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/" element={<Navigate to="/profile" />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/follows" element={<Follows />} />
            <Route path="/follows/followers" element={<FollowsAll type="followers" />} />
            <Route path="/follows/following" element={<FollowsAll type="following" />} />
            <Route path="/follows/followers/:userId" element={<FollowsAll type="followers" />} />
            <Route path="/follows/following/:userId" element={<FollowsAll type="following" />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}
