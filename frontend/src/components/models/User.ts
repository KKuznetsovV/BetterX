import type LoginModel from "./login";

export default interface User extends LoginModel {
    id: string;
    name: string;
    avatarUrl?: string | null;
    createdAt: string;
    updatedAt: string;
}