import { useContext } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import authService from '../../../services/auth';
import AuthContext from '../auth/AuthContext';
import type LoginModel from '../../models/login';
import SpinnerButton from '../../common/spinner-button/SpinnerButton';
import './login.css';

interface LoginProps {
    onSignup: () => void;
}

export default function Login({ onSignup }: LoginProps) {
    const { saveJwt } = useContext(AuthContext)!;
    const { register, handleSubmit, formState } = useForm<LoginModel>();
    const navigate = useNavigate();

    async function login(credentials: LoginModel) {
        try {
            const { jwt } = await authService.login(credentials);
            navigate('/profile');
            saveJwt(jwt);
        } catch (e) {
            alert(e);
        }
    }

    function helpLoggingIn() {
        alert('Please contact support to reset your password.');
    }

    return (
        <div className='Login'>
            <div className='login-hero'>
                <img className='login-hero-logo' src='/BetterX-logo.png' alt='BetterX' />
                <h1 className='login-hero-title'>Welcome to BetterX</h1>
                <p className='login-hero-text'>
                    The social platform that puts <em>you</em> first.
                    Share thoughts, follow people you care about, and join a community built on better conversations.
                </p>
            </div>
            <div className='login-card'>
                <h2 className='login-title'>Sign in to BetterX</h2>
                <form className='login-form' onSubmit={handleSubmit(login)}>
                    <input
                        className='login-input'
                        placeholder='Username'
                        {...register('username', { required: 'Username is required' })}
                    />
                    <div className='error'>{formState.errors.username?.message}</div>
                    <input
                        className='login-input'
                        type='password'
                        placeholder='Password'
                        {...register('password', { required: 'Password is required' })}
                    />
                    <div className='error'>{formState.errors.password?.message}</div>
                    <SpinnerButton className='login-button' type='submit' label='Login' loadingLabel='Logging in...' isLoading={formState.isSubmitting} />
                </form>
                <div className='login-footer'>
                    <button className='login-link-primary' type='button' onClick={onSignup}>Sign up</button>
                    <button className='login-link-secondary' type='button' onClick={helpLoggingIn}>Help logging in</button>
                </div>
            </div>
        </div>
    );
}