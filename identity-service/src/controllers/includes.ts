import User from "../models/User";

export const followingIncludes = [
    {
        model: User,
        as: 'following'
    }
];

export const followersIncludes = [
    {
        model: User,
        as: 'followers'
    }
];
