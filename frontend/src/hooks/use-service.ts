import { useContext, useMemo } from 'react';
import axios, { type AxiosInstance } from 'axios';
import AuthContext from '../components/auth/auth/AuthContext';
import type AuthAwareService from '../services/auth-aware/AuthAware';
import socket from '../components/io/socket';

export default function useService<T extends AuthAwareService>(
    Service: { new(axiosInstance: AxiosInstance): T }
): T {
    const { jwt } = useContext(AuthContext)!;
    return useMemo(() => {
        const axiosInstance = axios.create({
            headers: { Authorization: `Bearer ${jwt}` }
        });
        axiosInstance.interceptors.request.use(config => {
            if (socket.id) config.headers['X-Socket-Id'] = socket.id;
            return config;
        });
        return new Service(axiosInstance);
    }, [jwt, Service]);
}
