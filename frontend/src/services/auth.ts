import axios from 'axios';
import type Jwt from '../components/models/Jwt';
import type LoginModel from '../components/models/login';
import type Signup from '../components/models/Signup';

class AuthService {
    async login(credentials: LoginModel): Promise<Jwt> {
        const { data } = await axios.post<Jwt>(
            `${import.meta.env.VITE_API_URL}/auth/login`,
            credentials
        );
        return data;
    }

    async signup(signup: Signup): Promise<Jwt> {
        const { data } = await axios.post<Jwt>(
            `${import.meta.env.VITE_API_URL}/auth/signup`,
            signup
        );
        return data;
    }
}

const authService = new AuthService();
export default authService;

