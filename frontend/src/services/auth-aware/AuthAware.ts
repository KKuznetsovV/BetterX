import type { AxiosInstance } from 'axios';

export default abstract class AuthAwareService {
    public axiosInstance: AxiosInstance;
    constructor(axiosInstance: AxiosInstance) {
        this.axiosInstance = axiosInstance;
    }
}
