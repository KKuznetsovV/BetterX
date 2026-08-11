import { useEffect, useState, type PropsWithChildren } from 'react';
import axios from 'axios';
import AuthContext from './AuthContext';
import Login from '../login/Login';
import SignupForm from '../signup/Signup';

const JWT_KEY = 'jwt';
type AuthMode = 'login' | 'signup';

export default function Auth(props: PropsWithChildren) {
    const [jwt, setJwt] = useState<string>(() => {
        const token = sessionStorage.getItem(JWT_KEY) ?? '';
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        return token;
    });
    const [mode, setMode] = useState<AuthMode>('login');

    useEffect(() => {
        if (jwt) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [jwt]);

    function saveJwt(token: string) {
        if (token) {
            sessionStorage.setItem(JWT_KEY, token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setJwt(token);
    }

    function logout() {
        sessionStorage.removeItem(JWT_KEY);
        delete axios.defaults.headers.common['Authorization'];
        setJwt('');
    }

    return (
        <AuthContext.Provider value={{ jwt, saveJwt, logout }}>
            {jwt
                ? props.children
                : mode === 'login'
                    ? <Login onSignup={() => setMode('signup')} />
                    : <SignupForm onLogin={() => setMode('login')} />
            }
        </AuthContext.Provider>
    );
}

